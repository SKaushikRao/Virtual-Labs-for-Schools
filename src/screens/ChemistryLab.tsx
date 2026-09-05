import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

import { useAppStore } from '../store/useAppStore';
import { useHandTracking } from '../hooks/useHandTracking';
import { usePointerInput } from '../hooks/usePointerInput';
import { labAudio } from '../utils/LabAudio';
import { cn } from '../utils/cn';
import { LabTopBar } from '../components/ui/LabTopBar';
import { GestureCursor } from '../components/ui/GestureCursor';
import { AIMentorPanel } from '../components/mentor/AIMentorPanel';
import { GestureTutorial } from '../components/GestureTutorial';

const EXPERIMENT_STEPS = [
  { id: 1, text: "Place the Beaker on the table.", expectedTool: "Beaker" },
  { id: 2, text: "Rinse the Beaker with Distilled Water.", expectedTool: "Distilled Water" },
  { id: 3, text: "Fill the Beaker with 50ml of NaOH (Base).", expectedTool: "NaOH" },
  { id: 4, text: "Add 2 drops of Phenolphthalein Indicator.", expectedTool: "Indicator" },
  { id: 5, text: "Perform Titration using HCl (Acid).", expectedTool: "HCl" }
];

const INVENTORY_ITEMS = [
  { id: 'Beaker', type: 'Beaker', color: '#ffffff', icon: '🥛', name: 'Beaker 250ml', desc: 'Standard borosilicate reaction vessel' },
  { id: 'Distilled Water', type: 'Bottle', color: '#aaddff', icon: '💧', name: 'Dist. Water', desc: 'Pure water solvent' },
  { id: 'NaOH', type: 'Bottle', color: '#4e44ff', icon: '🧪', name: 'NaOH (0.1M)', desc: 'Strong base alkali solution' },
  { id: 'Indicator', type: 'Dropper', color: '#ffffff', icon: '💉', name: 'Phenolphthalein', desc: 'Turns pink in alkaline pH' },
  { id: 'HCl', type: 'Tube', color: '#ff0000', icon: '🧪', name: 'HCl (0.1M)', desc: 'Hydrochloric acid titrant' },
  { id: 'Salt', type: 'Powder', color: '#ffffff', icon: '🧂', name: 'NaCl Salt', desc: 'Crystalline sodium chloride' },
  { id: 'Filter Paper', type: 'Paper', color: '#ffffff', icon: '📄', name: 'Filter Paper', desc: 'Cellulose filter paper' },
];

import { PourStreamMesh, LiquidMesh, calculateFlowRate, blendLiquidColors } from '../components/fluids/FluidSystem';

export function ChemistryLab() {
  const addScore = useAppStore(state => state.addScore);
  const score = useAppStore(state => state.score);
  const setCurrentStep = useAppStore(state => state.setCurrentStep);
  const setTotalSteps = useAppStore(state => state.setTotalSteps);
  const setRecentMistake = useAppStore(state => state.setRecentMistake);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isReady, cursorRef: handCursorRef } = useHandTracking(videoRef);
  const getPointer = usePointerInput(handCursorRef);

  const [activeStep, setActiveStep] = useState(1);
  const [mistakeShaking, setMistakeShaking] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<typeof INVENTORY_ITEMS[0] | null>(null);

  // Continuous Fluid State
  const [beakerVolume, setBeakerVolume] = useState(0); // in ml (max 100ml)
  const [beakerColor, setBeakerColor] = useState('#aaddff');
  const [isPouringNow, setIsPouringNow] = useState(false);
  const [targetPrompt, setTargetPrompt] = useState<string | null>(null);
  const [neutralized, setNeutralized] = useState(false);

  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'Chemistry Lab ready. Place beaker on table to start.', type: 'info' }
  ]);

  const [spawnedItems, setSpawnedItems] = useState<{id: string, type: string, color: string, name: string, x: number, y: number, isDragging: boolean}[]>([]);
  const spawnedItemsRef = useRef(spawnedItems);
  spawnedItemsRef.current = spawnedItems;

  useEffect(() => {
    setTotalSteps(EXPERIMENT_STEPS.length);
    setCurrentStep(1);
  }, [setTotalSteps, setCurrentStep]);

  const addLog = (msg: string, type: 'info'|'warn'|'success' = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg, type }]);
  };

  const triggerMistake = (msg: string) => {
    labAudio.playErrorBuzz();
    setRecentMistake(msg);
    setMistakeShaking(true);
    setTimeout(() => setMistakeShaking(false), 500);
    addLog(msg, "warn");
  };

  const triggerSuccess = (msg: string, points = 20) => {
    labAudio.playSuccessChime();
    addScore(points);
    setRecentMistake(null);
    addLog(msg, "success");
  };

  const spawnItem = (item: {id: string, type: string, color: string, name: string}) => {
    if (spawnedItemsRef.current.some(i => i.id === item.id)) return;
    
    labAudio.playGrabSound();

    if (item.id === 'Beaker') {
      setSpawnedItems(prev => [...prev, { ...item, x: 0, y: -0.5, isDragging: false }]);
      triggerSuccess("Beaker placed successfully on the table.", 20);
      setActiveStep(2);
      setCurrentStep(2);
    } else {
      const nonBeakerCount = spawnedItemsRef.current.filter(i => i.id !== 'Beaker').length;
      const xPos = -4 + nonBeakerCount * 2;
      setSpawnedItems(prev => [...prev, { ...item, x: xPos, y: -0.5, isDragging: false }]);
      addLog(`Placed ${item.name} on table. Hold and tilt over beaker to pour.`, "info");
    }
  };

  const spawnItemRef = useRef(spawnItem);
  spawnItemRef.current = spawnItem;

  // Custom DOM Cursor & Hotbar Pinch Gesture detection
  useEffect(() => {
    let animId: number;
    let wasActive = false;
    const checkGesture = () => {
      const ptr = getPointer();
      const px = ptr.x * window.innerWidth;
      const py = ptr.y * window.innerHeight;

      if (ptr.active && !wasActive) {
        const el = document.elementFromPoint(px, py);
        const itemEl = el?.closest('[data-item-id]');
        if (itemEl) {
          const id = itemEl.getAttribute('data-item-id')!;
          const type = itemEl.getAttribute('data-item-type')!;
          const color = itemEl.getAttribute('data-item-color')!;
          const name = itemEl.getAttribute('data-item-name')!;
          spawnItemRef.current({ id, type, color, name });
        }
      }
      wasActive = ptr.active;
      animId = requestAnimationFrame(checkGesture);
    };
    animId = requestAnimationFrame(checkGesture);
    return () => cancelAnimationFrame(animId);
  }, [getPointer]);

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-[#05060f] via-[#080918] to-[#04050d] flex flex-col overflow-hidden cursor-none select-none">
      <GestureCursor getPointer={getPointer} />
      <GestureTutorial />
      <AIMentorPanel />

      <LabTopBar
        title="Acid-Base Neutralization Titration"
        subject="Chemistry"
        currentStep={activeStep}
        totalSteps={5}
        isReady={isReady}
      />

      <main className="flex-1 flex p-6 gap-6 relative z-10 min-h-0">
        {/* Left Procedure Guide */}
        <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto hidden md:flex z-20 pointer-events-none">
          <motion.div 
            animate={mistakeShaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            className={cn(
              "bg-white/5 backdrop-blur-md rounded-2xl border p-5 flex flex-col shrink-0 pointer-events-auto shadow-2xl transition-all",
              mistakeShaking ? "border-red-500/80 bg-red-500/10" : "border-white/10"
            )}
          >
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#c084fc] mb-1 font-mono">Module 1</span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Acid-Base Titration</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Tilt reagent bottles over the beaker to pour liquid continuously. Watch the fill line and stop pouring at target volume!
            </p>
          </motion.div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4 flex items-center gap-2 shrink-0 font-mono">
              <span>📋</span> Procedure Steps
            </h3>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {EXPERIMENT_STEPS.map((step) => {
                const isCompleted = step.id < activeStep;
                const isCurrent = step.id === activeStep;
                return (
                  <div key={step.id} className={cn("flex gap-3 items-start transition-all duration-300", !isCompleted && !isCurrent && "opacity-40", isCurrent && "scale-[1.02]")}>
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                      </div>
                    ) : (
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold font-mono", isCurrent ? "bg-[#4e44ff] text-white shadow-[0_0_15px_#4e44ff] border border-purple-400" : "bg-white/20 text-white")}>
                        {step.id}
                      </div>
                    )}
                    <span className={cn("text-[11px] leading-relaxed transition-colors", isCompleted ? "text-white/40 line-through" : "text-white/90", isCurrent && "font-bold text-[#c084fc]")}>{step.text}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#4e44ff]/20 to-transparent backdrop-blur-md rounded-2xl border border-[#4e44ff]/30 p-5 shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 font-mono">Score</span>
              <span className="text-2xl font-mono font-bold text-[#c084fc]">{score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#4e44ff] to-[#ff44ec] transition-all duration-700" style={{ width: `${Math.min(100, score)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Center 3D Canvas */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-transparent pointer-events-none">
          <Canvas camera={{ position: [0, 2, 7.5], fov: 45 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} />
            <pointLight position={[6, 8, 6]} intensity={1.5} color="#c084fc" />
            <pointLight position={[-6, 6, -3]} intensity={1.2} color="#4e44ff" />

            <LabScene 
               getPointer={getPointer} 
               activeStep={activeStep} 
               setActiveStep={setActiveStep} 
               setCurrentStep={setCurrentStep}
               triggerSuccess={triggerSuccess}
               triggerMistake={triggerMistake}
               beakerColor={beakerColor}
               setBeakerColor={setBeakerColor}
               beakerVolume={beakerVolume}
               setBeakerVolume={setBeakerVolume}
               neutralized={neutralized}
               setNeutralized={setNeutralized}
               setIsPouringNow={setIsPouringNow}
               setTargetPrompt={setTargetPrompt}
               spawnedItems={spawnedItems}
               setSpawnedItems={setSpawnedItems}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={25} blur={2} />
          </Canvas>

          {/* Action indicator & Stop Pour Prompt */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3">
              <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isPouringNow ? "bg-cyan-400 shadow-[0_0_12px_#22d3ee]" : "bg-[#c084fc]")} />
              <span className="text-xs font-mono font-medium text-white/90">
                {activeStep <= 5 ? `Active Step ${activeStep}: ${EXPERIMENT_STEPS[activeStep-1].text}` : "Experiment Successfully Neutralized!"}
              </span>
            </div>

            {/* Target Reached Stop Prompt Banner */}
            <AnimatePresence>
              {targetPrompt && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -5 }}
                  className="bg-emerald-500/90 text-white font-bold text-xs px-5 py-2 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.7)] border border-emerald-300 flex items-center gap-2 animate-bounce"
                >
                  <span>🛑</span>
                  <span>{targetPrompt}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <video ref={videoRef} playsInline muted className="absolute w-36 h-28 top-20 right-6 object-cover rounded-2xl border border-white/20 opacity-40 z-10 scale-x-[-1] pointer-events-none" />
        </div>

        {/* Right Telemetry */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3 font-mono">Live Telemetry</h3>
             <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">Volume (V)</div>
                   <div className="text-lg font-mono font-bold text-cyan-300">{beakerVolume.toFixed(1)} ml</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">pH Value</div>
                   <div className="text-lg font-mono font-bold text-[#ff44ec] transition-all">
                     {activeStep < 3 ? '7.0' : activeStep === 3 ? '13.0' : activeStep === 4 ? '13.0' : neutralized ? '7.0' : '9.5'}
                   </div>
                </div>
             </div>
             <div className="w-full bg-white/5 p-2.5 rounded-xl border border-white/5 flex items-center justify-between font-mono text-xs">
                <span className="text-white/50">Reaction State:</span>
                <span className={cn("font-bold", neutralized ? "text-emerald-400" : activeStep >= 4 ? "text-rose-400" : "text-cyan-300")}>
                  {neutralized ? "Equivalence (pH 7)" : activeStep >= 4 ? "Basic Solution" : "Pre-reaction"}
                </span>
             </div>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0 font-mono">Event Log</h3>
             <div className="flex-1 space-y-3 font-mono text-[10px] text-white/40 overflow-y-auto pr-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                     <span className="text-[#c084fc] shrink-0">[{log.time}]</span>
                     <span className={cn(log.type === 'warn' ? "text-[#ff44ec] font-bold" : log.type === 'success' ? "text-emerald-400 font-bold" : "text-white/80")}>
                       {log.msg}
                     </span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </main>

      {/* Inventory Hotbar */}
      <div className="absolute bottom-5 w-full flex flex-col items-center z-30 pointer-events-none">
        <AnimatePresence>
          {hoveredItem && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-3 px-4 py-2 rounded-xl bg-black/80 backdrop-blur-xl border border-purple-500/30 text-center shadow-xl pointer-events-none">
              <div className="text-xs font-bold text-white font-display">{hoveredItem.name}</div>
              <div className="text-[10px] font-mono text-purple-200/80">{hoveredItem.desc}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3.5 bg-[#080918]/80 backdrop-blur-2xl border border-white/15 p-3 rounded-3xl overflow-x-auto max-w-[90vw] pointer-events-auto shadow-2xl shrink-0 mx-8 items-end">
           {INVENTORY_ITEMS.map((item) => (
              <div 
                 key={item.id}
                 data-item-id={item.id}
                 data-item-type={item.type}
                 data-item-color={item.color}
                 data-item-name={item.name}
                 onClick={() => spawnItem(item)}
                 onPointerDown={() => spawnItem(item)}
                 onMouseEnter={() => setHoveredItem(item)}
                 onMouseLeave={() => setHoveredItem(null)}
                 className="min-w-[100px] h-28 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-white/10 transition-all cursor-pointer group hover:-translate-y-3 hover:border-purple-400/60 select-none"
              >
                 <div className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-200">{item.icon}</div>
                 <span className="text-[10px] font-mono text-center px-1 text-white/70 group-hover:text-purple-300 font-medium">{item.name}</span>
              </div>
           ))}
        </div>
      </div>
    </div>
  );
}

function LabScene({
  getPointer,
  activeStep,
  setActiveStep,
  setCurrentStep,
  triggerSuccess,
  triggerMistake,
  beakerColor,
  setBeakerColor,
  beakerVolume,
  setBeakerVolume,
  neutralized,
  setNeutralized,
  setIsPouringNow,
  setTargetPrompt,
  spawnedItems,
  setSpawnedItems,
}: any) {
  const { viewport } = useThree();
  const draggedItemIdRef = useRef<string | null>(null);
  const hoveredItemIdRef = useRef<string | null>(null);
  const wasActive = useRef(false);
  const targetPosRef = useRef(new THREE.Vector3());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [particles, setParticles] = useState<number[]>([]);

  // Pouring stream tracking
  const [streamActive, setStreamActive] = useState(false);
  const [streamFrom, setStreamFrom] = useState(new THREE.Vector3());
  const [streamTo, setStreamTo] = useState(new THREE.Vector3());
  const [streamColor, setStreamColor] = useState('#ffffff');
  const [currentFlowRate, setCurrentFlowRate] = useState(20);

  const hasPromptedTarget = useRef(false);
  const hasWarnedOverpour = useRef(false);

  useFrame((_, delta) => {
    const ptr = getPointer();
    const ndcX = ptr.x * 2 - 1;
    const ndcY = -(ptr.y * 2 - 1);
    const targetX = ndcX * (viewport.width / 2);
    const targetY = ndcY * (viewport.height / 2);
    targetPosRef.current.lerp(new THREE.Vector3(targetX, targetY, 2), 0.35);

    // Hover detection
    if (!draggedItemIdRef.current) {
      let foundHover: string | null = null;
      let minHoverDist = 2.4;

      spawnedItems.forEach((item: any) => {
        if (item.id === 'Beaker') return;
        const dist = new THREE.Vector2(targetX, targetY).distanceTo(new THREE.Vector2(item.x, item.y));
        if (dist < minHoverDist) {
          minHoverDist = dist;
          foundHover = item.id;
        }
      });

      if (foundHover !== hoveredItemIdRef.current) {
        if (foundHover) labAudio.playHoverSound();
        hoveredItemIdRef.current = foundHover;
        setHoveredId(foundHover);
      }
    }

    const grabbed = ptr.active && !wasActive.current;
    const released = !ptr.active && wasActive.current;

    // Grab
    if (grabbed && hoveredItemIdRef.current) {
      const grabId = hoveredItemIdRef.current;
      draggedItemIdRef.current = grabId;
      labAudio.playGrabSound();
      setSpawnedItems((prev: any) => prev.map((i: any) => (i.id === grabId ? { ...i, isDragging: true } : i)));
    }

    // Continuous Pouring Logic when bottle is dragged over Beaker
    const heldId = draggedItemIdRef.current;
    const beaker = spawnedItems.find((i: any) => i.id === 'Beaker');

    if (ptr.active && heldId && beaker) {
      const distToBeaker = new THREE.Vector2(targetPosRef.current.x, targetPosRef.current.y).distanceTo(
        new THREE.Vector2(beaker.x, beaker.y + 1.6)
      );

      const isOverBeaker = distToBeaker < 2.5 && targetPosRef.current.y > beaker.y + 0.5;

      if (isOverBeaker) {
        // Tilt angle increases as bottle moves closer to pouring position
        const tiltDeg = 55; // Tilt threshold exceeded
        const flow = calculateFlowRate(tiltDeg, 25); // ~25 ml/sec

        const spoutPos = new THREE.Vector3(targetPosRef.current.x - 0.25, targetPosRef.current.y - 0.3, 0);
        const liquidSurfaceY = beaker.y - 0.3 + (beakerVolume / 100) * 1.5;
        const targetSurfacePos = new THREE.Vector3(beaker.x, liquidSurfaceY, 0);

        setStreamFrom(spoutPos);
        setStreamTo(targetSurfacePos);
        setCurrentFlowRate(flow);
        setStreamActive(true);
        setIsPouringNow(true);

        const expected = EXPERIMENT_STEPS[activeStep - 1];

        // Step 2: Distilled Water rinse
        if (heldId === 'Distilled Water' && activeStep === 2) {
          setStreamColor('#aaddff');
          setBeakerVolume((v: number) => {
            const nextVol = Math.min(25, v + flow * delta);
            if (nextVol >= 20 && !hasPromptedTarget.current) {
              hasPromptedTarget.current = true;
              labAudio.playSuccessChime();
              setTargetPrompt('Target reached (20ml rinse) — stop pouring!');
            }
            return nextVol;
          });
        }

        // Step 3: NaOH Base Fill
        if (heldId === 'NaOH' && activeStep === 3) {
          setStreamColor('#4e44ff');
          setBeakerVolume((v: number) => {
            const nextVol = Math.min(100, v + flow * delta);
            if (nextVol >= 50 && !hasPromptedTarget.current) {
              hasPromptedTarget.current = true;
              labAudio.playSuccessChime();
              setTargetPrompt('Target reached (50ml NaOH) — stop pouring!');
            }
            if (nextVol > 75 && !hasWarnedOverpour.current) {
              hasWarnedOverpour.current = true;
              triggerMistake('Overpoured NaOH! Solution excess basic.');
            }
            return nextVol;
          });
        }

        // Step 4: Indicator addition (dropper)
        if (heldId === 'Indicator' && activeStep === 4) {
          setStreamColor('#ff44ec');
          setBeakerColor('#ff44ec');
          setTargetPrompt('Indicator added! Observe vibrant pink basic color.');
        }

        // Step 5: HCl Titration Pour
        if (heldId === 'HCl' && activeStep === 5) {
          setStreamColor('#f5d0fe');
          setBeakerVolume((v: number) => {
            const nextVol = Math.min(100, v + flow * delta);
            // Equivalence point reached around ~90ml total volume
            if (nextVol >= 85) {
              setBeakerColor('#f5d0fe');
              setNeutralized(true);
              setParticles(Array.from({ length: 25 }).map(() => Math.random()));
              if (!hasPromptedTarget.current) {
                hasPromptedTarget.current = true;
                labAudio.playSuccessChime();
                setTargetPrompt('Equivalence Point Reached (pH 7.0)! Stop titration!');
              }
            }
            if (nextVol > 98 && !hasWarnedOverpour.current) {
              hasWarnedOverpour.current = true;
              triggerMistake('Over-titrated! Solution turned acidic.');
            }
            return nextVol;
          });
        }
      } else {
        setStreamActive(false);
        setIsPouringNow(false);
      }
    } else {
      setStreamActive(false);
      setIsPouringNow(false);
    }

    // Dragging position update
    if (ptr.active && draggedItemIdRef.current) {
      setSpawnedItems((prev: any) =>
        prev.map((i: any) =>
          i.id === draggedItemIdRef.current ? { ...i, x: targetPosRef.current.x, y: targetPosRef.current.y } : i
        )
      );
    }

    // Release / Step completion
    if (released && draggedItemIdRef.current) {
      const itemId = draggedItemIdRef.current;
      setStreamActive(false);
      setIsPouringNow(false);
      setTargetPrompt(null);
      hasPromptedTarget.current = false;
      hasWarnedOverpour.current = false;

      setSpawnedItems((prev: any) => {
        const item = prev.find((i: any) => i.id === itemId);
        if (!item) return prev;

        const expected = EXPERIMENT_STEPS[activeStep - 1];
        if (expected && expected.expectedTool === item.id) {
          triggerSuccess(`Completed Step ${activeStep} with ${item.name}!`, 20);

          const nextStep = activeStep + 1;
          setActiveStep(nextStep);
          setCurrentStep(nextStep);

          draggedItemIdRef.current = null;
          hoveredItemIdRef.current = null;
          setHoveredId(null);
          return prev.filter((i: any) => i.id !== item.id);
        }

        labAudio.playReleaseSound();
        return prev.map((i: any) => (i.id === item.id ? { ...i, isDragging: false, y: -0.5 } : i));
      });

      draggedItemIdRef.current = null;
    }

    wasActive.current = ptr.active;
  });

  return (
    <>
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[14, 0.4, 4.5]} />
        <meshStandardMaterial color="#121324" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Dynamic Liquid Pour Stream */}
      <PourStreamMesh
        from={streamFrom}
        to={streamTo}
        color={streamColor}
        active={streamActive}
        flowRate={currentFlowRate}
      />

      {spawnedItems.map((item: any) => (
        <SpawnedItemRenderer
          key={item.id}
          item={item}
          isHovered={hoveredId === item.id}
          beakerColor={item.id === 'Beaker' ? beakerColor : undefined}
          beakerVolume={item.id === 'Beaker' ? beakerVolume : undefined}
          neutralized={item.id === 'Beaker' ? neutralized : undefined}
          particles={item.id === 'Beaker' ? particles : undefined}
        />
      ))}
    </>
  );
}

function SpawnedItemRenderer({ item, isHovered, beakerColor, beakerVolume = 0, neutralized, particles }: any) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      const targetPos = new THREE.Vector3(item.x, item.y, item.isDragging ? 2 : 0);
      groupRef.current.position.lerp(targetPos, 0.35);

      if (item.isDragging) {
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, -Math.PI / 4, 0.2);
        groupRef.current.scale.lerp(new THREE.Vector3(1.12, 1.12, 1.12), 0.2);
      } else if (isHovered) {
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.2);
        groupRef.current.scale.lerp(new THREE.Vector3(1.08, 1.08, 1.08), 0.2);
      } else {
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.2);
        groupRef.current.scale.lerp(new THREE.Vector3(1.0, 1.0, 1.0), 0.2);
      }
    }
  });

  return (
    <group ref={groupRef}>
      {item.type === 'Beaker' && (
        <Float speed={2} rotationIntensity={0.03} floatIntensity={0.08}>
          <Beaker color={beakerColor!} volume={beakerVolume} />
          {neutralized && (
            <Text
              position={[0, 3.2, 0]}
              fontSize={0.55}
              color="#ff44ec"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.03}
              outlineColor="#000000"
            >
              Neutralized (pH 7.0)!
            </Text>
          )}
          {particles &&
            particles.map((p: number, i: number) => <Bubble key={i} delay={p} active={neutralized!} />)}
        </Float>
      )}
      {item.type === 'Bottle' && <Bottle color={item.color} />}
      {item.type === 'Dropper' && <Dropper color={item.color} />}
      {item.type === 'Tube' && <TestTube color={item.color} />}
      {item.type === 'Powder' && <PowderBox color={item.color} />}
      {item.type === 'Paper' && <FilterPaper />}
    </group>
  );
}

function Beaker({ color, volume = 0 }: { color: string; volume?: number }) {
  return (
    <group position={[0, -1, 0]}>
      {/* Liquid Mesh driven by continuous volume (0 - 100ml) */}
      <LiquidMesh
        position={[0, 0, 0]}
        radiusTop={0.88}
        radiusBottom={0.88}
        maxHeight={2.0}
        fillRatio={volume / 100}
        color={color}
      />
      {/* Glass Beaker Body */}
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[1, 1, 2.5, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.05}
          transmission={0.92}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}


function Bottle({ color }: { color: string }) {
  return (
    <group position={[0, -1, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 1.2, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 1.0, 24]} />
        <meshStandardMaterial color={color} roughness={0.2} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.2, 0.6, 0.4, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.4, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.1, 16]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Dropper({ color }: { color: string }) {
  return (
    <group position={[0, -0.5, 0]}>
       <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ff44ec" roughness={0.8} />
       </mesh>
       <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.4, 16]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.4} />
       </mesh>
    </group>
  );
}

function TestTube({ color }: { color: string }) {
  return (
    <group position={[0, -1, 0]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 1.5, 16]} />
        <meshStandardMaterial color={color} transparent opacity={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 2.5, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PowderBox({ color }: { color: string }) {
  return (
    <group position={[0, -0.5, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <Text position={[0, 0.5, 0.51]} fontSize={0.2} color="#000" anchorX="center" anchorY="middle">Salt</Text>
    </group>
  );
}

function FilterPaper() {
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Bubble({ delay, active }: { delay: number, active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const time = useRef(delay * Math.PI * 2);
  
  useFrame((_, delta) => {
    if (!active || !ref.current) return;
    time.current += delta * 2;
    ref.current.position.y = (Math.sin(time.current) + 1) * 1.5;
    ref.current.position.x = Math.sin(time.current * 2 + delay) * 0.5;
    ref.current.scale.setScalar(Math.max(0, Math.sin(time.current * 0.5)));
  });

  if (!active) return null;

  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
    </mesh>
  );
}
