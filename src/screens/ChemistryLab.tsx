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
import {
  LiquidFill,
  PourStream,
  SwirlEffect,
  calculateFlowRate,
  blendAndSetColor,
} from '../components/fluids/FluidSystem';

const EXPERIMENT_STEPS = [
  { id: 1, text: "Place the Beaker on the table.", expectedTool: "Beaker" },
  { id: 2, text: "Rinse the Beaker with Distilled Water (20ml).", expectedTool: "Distilled Water" },
  { id: 3, text: "Fill the Beaker with 50ml of NaOH (Base).", expectedTool: "NaOH" },
  { id: 4, text: "Add 2 drops of Phenolphthalein Indicator.", expectedTool: "Indicator" },
  { id: 5, text: "Perform Titration using HCl (Acid) & Shake/Stir to Neutralize.", expectedTool: "HCl" }
];

const INVENTORY_ITEMS = [
  { id: 'Beaker', type: 'Beaker', color: '#ffffff', icon: '🥛', name: 'Beaker 250ml', desc: 'Standard borosilicate reaction vessel' },
  { id: 'Distilled Water', type: 'Bottle', color: '#aaddff', icon: '💧', name: 'Dist. Water', desc: 'Pure water solvent (Target: 20ml)' },
  { id: 'NaOH', type: 'Bottle', color: '#4e44ff', icon: '🧪', name: 'NaOH (0.1M)', desc: 'Strong base alkali solution (Target: 50ml)' },
  { id: 'Indicator', type: 'Dropper', color: '#ff44ec', icon: '💉', name: 'Phenolphthalein', desc: 'Turns pink in alkaline pH' },
  { id: 'HCl', type: 'Tube', color: '#f5d0fe', icon: '🧪', name: 'HCl (0.1M)', desc: 'Acid titrant — shake to mix and neutralize' },
  { id: 'Salt', type: 'Powder', color: '#ffffff', icon: '🧂', name: 'NaCl Salt', desc: 'Crystalline sodium chloride' },
  { id: 'Filter Paper', type: 'Paper', color: '#ffffff', icon: '📄', name: 'Filter Paper', desc: 'Cellulose filter paper' },
];

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
  const [canvasKey, setCanvasKey] = useState(0);
  const [mistakeShaking, setMistakeShaking] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<typeof INVENTORY_ITEMS[0] | null>(null);

  // Diagnostic & Telemetry display state (updated throttled, not 60fps)
  const [displayVolume, setDisplayVolume] = useState(0);
  const [displayPh, setDisplayPh] = useState(7.0);
  const [neutralized, setNeutralized] = useState(false);
  const [targetPrompt, setTargetPrompt] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState({ tilt: 0, pouring: false, shakeScore: 0 });

  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'Chemistry Laboratory Initialized. Place beaker to begin.', type: 'info' }
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
      addLog(`Placed ${item.name} on table. Drag and tilt over beaker to pour!`, "info");
    }
  };

  const spawnItemRef = useRef(spawnItem);
  spawnItemRef.current = spawnItem;

  // Custom DOM Cursor & Hotbar Gesture detection
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
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#c084fc] mb-1">Volumetric Analysis</span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">HCl vs NaOH Titration</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Pour reagents continuously into the beaker. Tilt bottles past 45° to pour. Shake test-tubes to mix and reach equivalence.
            </p>
          </motion.div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4 font-mono">
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
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold font-mono", isCurrent ? "bg-[#4e44ff] text-white shadow-[0_0_15px_#4e44ff]" : "bg-white/20 text-white")}>
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
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 font-mono">Total Points</span>
              <span className="text-2xl font-mono font-bold text-[#c084fc]">{score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#4e44ff] to-[#ff44ec] transition-all duration-700" style={{ width: `${Math.min(100, score)}%` }} />
            </div>
          </div>
        </div>

        {/* Center 3D Interactive Canvas */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#05060f] pointer-events-none">
          <Canvas
            key={canvasKey}
            camera={{ position: [0, 2, 7.5], fov: 45 }}
            gl={{
              powerPreference: 'high-performance',
              antialias: true,
              failIfMajorPerformanceCaveat: false,
              alpha: false,
              preserveDrawingBuffer: false,
            }}
            onCreated={({ gl, scene }) => {
              scene.background = new THREE.Color('#05060f');
              const domEl = gl.domElement;
              domEl.style.backgroundColor = '#05060f';
              domEl.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                console.warn('WebGL Context Lost. Remounting canvas to auto-recover...');
                setTimeout(() => setCanvasKey(k => k + 1), 60);
              }, false);
            }}
            style={{ background: '#05060f', width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <color attach="background" args={["#05060f"]} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 5]} intensity={1.4} />
            <pointLight position={[6, 8, 6]} intensity={1.5} color="#00f2ff" />
            <pointLight position={[-6, 6, -3]} intensity={1.2} color="#ff00ea" />

            <LabScene 
              getPointer={getPointer}
              activeStep={activeStep}
              setActiveStep={setActiveStep}
              setCurrentStep={setCurrentStep}
              triggerSuccess={triggerSuccess}
              triggerMistake={triggerMistake}
              neutralized={neutralized}
              setNeutralized={setNeutralized}
              setDisplayVolume={setDisplayVolume}
              setDisplayPh={setDisplayPh}
              setTargetPrompt={setTargetPrompt}
              setDebugInfo={setDebugInfo}
              spawnedItems={spawnedItems}
              setSpawnedItems={setSpawnedItems}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={25} blur={2} />
          </Canvas>

          {/* Action indicator */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3">
              <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", debugInfo.pouring ? "bg-cyan-400 shadow-[0_0_12px_#38bdf8]" : "bg-emerald-400 shadow-[0_0_10px_#10b981]")} />
              <span className="text-xs font-mono font-medium text-white/90">
                {activeStep <= 5 ? `Step ${activeStep}: ${EXPERIMENT_STEPS[activeStep-1].text}` : "Equivalence Point Reached — Lab Complete!"}
              </span>
            </div>

            {/* Target Volume Prompt Banner */}
            {targetPrompt && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-500/20 backdrop-blur-md border border-emerald-400/50 px-4 py-1.5 rounded-full text-[11px] font-mono font-semibold text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                {targetPrompt}
              </motion.div>
            )}
          </div>

          <video ref={videoRef} playsInline muted className="absolute w-36 h-28 top-20 right-6 object-cover rounded-2xl border border-white/20 opacity-40 z-10 scale-x-[-1] pointer-events-none" />
        </div>

        {/* Right Telemetry Panel */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3 font-mono">Live Telemetry</h3>
             <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">Volume (V)</div>
                   <div className="text-lg font-mono font-bold text-cyan-300">{displayVolume.toFixed(1)} ml</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">pH Value</div>
                   <div className="text-lg font-mono font-bold text-[#ff44ec] transition-all">
                     {displayPh.toFixed(1)}
                   </div>
                </div>
             </div>
             <div className="w-full bg-white/5 p-2.5 rounded-xl border border-white/5 flex items-center justify-between font-mono text-xs">
                <span className="text-white/50">Reaction State:</span>
                <span className={cn("font-bold", neutralized ? "text-emerald-400" : activeStep >= 4 ? "text-rose-400" : "text-cyan-300")}>
                  {neutralized ? "Equivalence (pH 7.0)" : activeStep >= 4 ? "Basic Solution" : displayVolume > 0 ? "Aqueous Solvent" : "Empty Vessel"}
                </span>
             </div>
          </div>

          {/* Diagnostic Debug HUD */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 shrink-0 pointer-events-auto shadow-2xl font-mono text-[10px] space-y-1 text-white/70">
            <div className="text-[9px] uppercase text-[#c084fc] font-bold mb-1">Fluid Dynamics Engine</div>
            <div className="flex justify-between"><span>Pouring State:</span><span className={debugInfo.pouring ? "text-emerald-400 font-bold" : "text-white/40"}>{debugInfo.pouring ? "ACTIVE (Flowing)" : "IDLE"}</span></div>
            <div className="flex justify-between"><span>Tilt Angle:</span><span>{debugInfo.tilt.toFixed(0)}° (Threshold 35°)</span></div>
            <div className="flex justify-between"><span>Shake Score:</span><span className={debugInfo.shakeScore >= 3 ? "text-amber-300 font-bold" : "text-white/50"}>{debugInfo.shakeScore} / 3 reversals</span></div>
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
                 onMouseEnter={() => {
                   setHoveredItem(item);
                   labAudio.playHoverSound();
                 }}
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
  neutralized,
  setNeutralized,
  setDisplayVolume,
  setDisplayPh,
  setTargetPrompt,
  setDebugInfo,
  spawnedItems,
  setSpawnedItems,
}: any) {
  const { viewport } = useThree();
  const draggedItemIdRef = useRef<string | null>(null);
  const hoveredItemIdRef = useRef<string | null>(null);
  const itemGroupsRef = useRef<{ [key: string]: THREE.Group | null }>({});
  const wasActive = useRef(false);
  const targetPosRef = useRef(new THREE.Vector3());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // --- Concrete Ref-Driven Fluid State (Zero React Re-renders in Hot Loop) ---
  const volumeRef = useRef<number>(0);
  const colorRef = useRef<THREE.Color>(new THREE.Color('#aaddff'));
  const isPouringRef = useRef<boolean>(false);
  const sourcePositionRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const targetYRef = useRef<number>(0);
  const streamColorRef = useRef<THREE.Color>(new THREE.Color('#aaddff'));

  // --- Test-tube Shake-to-mix state ---
  const isSwirlingRef = useRef<boolean>(false);
  const positionHistoryRef = useRef<{ pos: THREE.Vector3; time: number }[]>([]);
  const shakeScoreRef = useRef<number>(0);
  const lastShakeAudioTime = useRef<number>(0);

  const hasPromptedTarget = useRef(false);
  const hasWarnedOverpour = useRef(false);
  const throttleTimer = useRef<number>(0);

  useFrame((state, delta) => {
    const ptr = getPointer();
    const ndcX = ptr.x * 2 - 1;
    const ndcY = -(ptr.y * 2 - 1);
    const targetX = ndcX * (viewport.width / 2);
    const targetY = ndcY * (viewport.height / 2);
    targetPosRef.current.lerp(new THREE.Vector3(targetX, targetY, 2), 0.35);

    // Hover detection - evaluates against instantaneous pointer coords
    if (!draggedItemIdRef.current) {
      let foundHover: string | null = null;
      let minHoverDist = 2.6;

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

    // Grab item - Instantaneous pickup on pinch
    if (grabbed) {
      let targetGrabId = hoveredItemIdRef.current;
      if (!targetGrabId) {
        let minGrabDist = 2.8;
        spawnedItems.forEach((item: any) => {
          if (item.id === 'Beaker') return;
          const dist = new THREE.Vector2(targetX, targetY).distanceTo(new THREE.Vector2(item.x, item.y));
          if (dist < minGrabDist) {
            minGrabDist = dist;
            targetGrabId = item.id;
          }
        });
      }
      if (targetGrabId) {
        draggedItemIdRef.current = targetGrabId;
        labAudio.playGrabSound();
        // Immediately warp group to hand to eliminate any visual pickup lag
        const grp = itemGroupsRef.current[targetGrabId];
        if (grp) {
          grp.position.set(targetX, targetY, 1.5);
        }
      }
    }

    const heldId = draggedItemIdRef.current;
    const beaker = spawnedItems.find((i: any) => i.id === 'Beaker');

    // --- Shake Detection Logic for held Test-Tube / Bottle ---
    if (ptr.active && heldId) {
      const now = state.clock.elapsedTime;
      const curPos = targetPosRef.current.clone();
      positionHistoryRef.current.push({ pos: curPos, time: now });
      positionHistoryRef.current = positionHistoryRef.current.filter(p => now - p.time < 0.5);

      if (positionHistoryRef.current.length >= 4) {
        let reversals = 0;
        for (let i = 2; i < positionHistoryRef.current.length; i++) {
          const v1 = positionHistoryRef.current[i - 1].pos.clone().sub(positionHistoryRef.current[i - 2].pos);
          const v2 = positionHistoryRef.current[i].pos.clone().sub(positionHistoryRef.current[i - 1].pos);
          if (v1.length() > 0.015 && v2.length() > 0.015 && v1.normalize().dot(v2.normalize()) < -0.3) {
            reversals++;
          }
        }
        shakeScoreRef.current = reversals;

        if (reversals >= 3) {
          if (now - lastShakeAudioTime.current > 0.4) {
            labAudio.playRattleSound();
            lastShakeAudioTime.current = now;
          }

          // Trigger swirl and mix reaction
          if (activeStep === 5 && volumeRef.current >= 45) {
            isSwirlingRef.current = true;
            // Smoothly lerp color to pale neutral/clear solution
            colorRef.current.lerp(new THREE.Color('#f5d0fe'), 0.15);
            setNeutralized(true);
          }
        }
      }
    } else {
      shakeScoreRef.current = 0;
    }

    // --- Concrete Pour Trigger Logic ---
    let currentTilt = 0;
    if (ptr.active && heldId && beaker) {
      const distToBeaker = new THREE.Vector2(targetPosRef.current.x, targetPosRef.current.y).distanceTo(
        new THREE.Vector2(beaker.x, beaker.y + 1.2)
      );

      const isAboveContainer = distToBeaker < 2.5 && targetPosRef.current.y > beaker.y + 0.3;
      currentTilt = isAboveContainer ? 55 : 0;
      const shouldPour = isAboveContainer && currentTilt > 35;

      isPouringRef.current = shouldPour;

      if (shouldPour) {
        const flowRate = calculateFlowRate(currentTilt, 28);
        const addedVol = flowRate * delta;

        // Spout world position & Container target liquid surface Y
        const spoutWorldPos = new THREE.Vector3(targetPosRef.current.x - 0.25, targetPosRef.current.y - 0.25, 0);
        const liquidSurfaceY = beaker.y - 0.45 + (volumeRef.current / 100) * 1.4;

        sourcePositionRef.current.copy(spoutWorldPos);
        targetYRef.current = liquidSurfaceY;

        // Step 2: Distilled Water rinse
        if (heldId === 'Distilled Water' && activeStep === 2) {
          streamColorRef.current.set('#aaddff');
          volumeRef.current = Math.min(25, volumeRef.current + addedVol);
          blendAndSetColor(colorRef, volumeRef.current, new THREE.Color('#aaddff'), addedVol);

          if (volumeRef.current >= 20 && !hasPromptedTarget.current) {
            hasPromptedTarget.current = true;
            labAudio.playSuccessChime();
            setTargetPrompt('Target reached (20ml rinse) — release bottle to finish step!');
          }
        }
        // Step 3: NaOH Base Fill
        else if (heldId === 'NaOH' && activeStep === 3) {
          streamColorRef.current.set('#4e44ff');
          volumeRef.current = Math.min(100, volumeRef.current + addedVol);
          blendAndSetColor(colorRef, volumeRef.current, new THREE.Color('#4e44ff'), addedVol);

          if (volumeRef.current >= 50 && !hasPromptedTarget.current) {
            hasPromptedTarget.current = true;
            labAudio.playSuccessChime();
            setTargetPrompt('Target reached (50ml NaOH) — release bottle to stop!');
          }
          if (volumeRef.current > 75 && !hasWarnedOverpour.current) {
            hasWarnedOverpour.current = true;
            triggerMistake('Overpoured NaOH! Solution excess basicity.');
          }
        }
        // Step 4: Phenolphthalein Indicator
        else if (heldId === 'Indicator' && activeStep === 4) {
          streamColorRef.current.set('#ff44ec');
          colorRef.current.set('#ff44ec'); // Turns vibrant magenta pink in basic solution
          setTargetPrompt('Indicator added! Vibrant pink color indicates alkaline pH 13.');
        }
        // Step 5: HCl Titration Pour
        else if (heldId === 'HCl' && activeStep === 5) {
          streamColorRef.current.set('#f5d0fe');
          volumeRef.current = Math.min(100, volumeRef.current + addedVol);

          if (volumeRef.current >= 75 && !hasPromptedTarget.current) {
            hasPromptedTarget.current = true;
            labAudio.playSuccessChime();
            setTargetPrompt('Equivalence threshold reached! Now shake the beaker/tube to mix!');
          }
          if (volumeRef.current > 95 && !hasWarnedOverpour.current) {
            hasWarnedOverpour.current = true;
            triggerMistake('Over-titrated! Excess acid added.');
          }
        }
      }
    } else {
      isPouringRef.current = false;
    }

    // Smoothly drag held item directly in 3D (Zero React re-renders in hot loop)
    if (ptr.active && heldId) {
      const grp = itemGroupsRef.current[heldId];
      if (grp) {
        grp.position.set(targetPosRef.current.x, targetPosRef.current.y, 1.5);
      }
    }

    // Item Release & Step Transition
    if (released && heldId) {
      labAudio.playReleaseSound();
      setTargetPrompt(null);
      hasPromptedTarget.current = false;
      hasWarnedOverpour.current = false;

      const dropX = targetPosRef.current.x;
      const dropY = targetPosRef.current.y;

      setSpawnedItems((prev: any) => {
        const item = prev.find((i: any) => i.id === heldId);
        if (!item || !beaker) return prev;

        const distToBeaker = new THREE.Vector2(dropX, dropY).distanceTo(new THREE.Vector2(beaker.x, beaker.y + 1.2));

        if (distToBeaker < 3.2) {
          const expected = EXPERIMENT_STEPS[activeStep - 1];
          if (expected && expected.expectedTool === heldId) {
            if (heldId === 'Distilled Water') {
              if (volumeRef.current >= 15) {
                triggerSuccess(`Beaker rinsed with ${volumeRef.current.toFixed(1)}ml Distilled Water.`, 20);
                setActiveStep(3);
                setCurrentStep(3);
                draggedItemIdRef.current = null;
                return prev.filter((i: any) => i.id !== heldId);
              } else {
                triggerMistake("Not enough water rinsed! Please pour at least 15-20ml.");
              }
            } else if (heldId === 'NaOH') {
              if (volumeRef.current >= 45) {
                triggerSuccess(`Filled with ${volumeRef.current.toFixed(1)}ml NaOH alkali solution.`, 20);
                setActiveStep(4);
                setCurrentStep(4);
                draggedItemIdRef.current = null;
                return prev.filter((i: any) => i.id !== heldId);
              } else {
                triggerMistake("Incomplete fill! Please pour at least 45-50ml of NaOH.");
              }
            } else if (heldId === 'Indicator') {
              triggerSuccess("Phenolphthalein added — Solution turned deep pink (pH 13.0)!", 20);
              setActiveStep(5);
              setCurrentStep(5);
              draggedItemIdRef.current = null;
              return prev.filter((i: any) => i.id !== heldId);
            } else if (heldId === 'HCl') {
              if (volumeRef.current >= 65) {
                setNeutralized(true);
                colorRef.current.set('#f5d0fe');
                triggerSuccess("Neutralization equivalence achieved (pH 7.0)! Endpoint reached!", 30);
                setActiveStep(6);
                setCurrentStep(6);
                draggedItemIdRef.current = null;
                return prev.filter((i: any) => i.id !== heldId);
              } else {
                triggerMistake("Under-titrated! Pour more HCl and shake to reach endpoint.");
              }
            }
          } else {
            triggerMistake(`Incorrect reagent! For Step ${activeStep}, use: ${expected?.expectedTool}`);
          }
        }
        return prev.map((i: any) => (i.id === heldId ? { ...i, isDragging: false, x: dropX, y: -0.5 } : i));
      });
      draggedItemIdRef.current = null;
    }

    // --- Throttled UI Telemetry & Debug HUD Sync (5Hz, zero frame drop) ---
    throttleTimer.current += delta;
    if (throttleTimer.current > 0.15) {
      throttleTimer.current = 0;
      setDisplayVolume(volumeRef.current);
      
      const curPh = activeStep < 3 ? 7.0 : activeStep === 3 || activeStep === 4 ? 13.0 : neutralized ? 7.0 : 9.5;
      setDisplayPh(curPh);

      setDebugInfo({
        tilt: currentTilt,
        pouring: isPouringRef.current,
        shakeScore: shakeScoreRef.current,
      });
    }

    wasActive.current = ptr.active;
  });

  const beaker = spawnedItems.find((i: any) => i.id === 'Beaker');

  return (
    <>
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[14, 0.4, 4.5]} />
        <meshStandardMaterial color="#121324" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Unlit, high-visibility continuous falling pour stream */}
      <PourStream
        isPouringRef={isPouringRef}
        sourcePositionRef={sourcePositionRef}
        targetYRef={targetYRef}
        colorRef={streamColorRef}
        streamRadius={0.03}
      />

      {/* Rising liquid level anchored at base of Beaker */}
      {beaker && (
        <LiquidFill
          volumeRef={volumeRef}
          maxCapacity={100}
          containerRadius={0.72}
          containerHeight={1.35}
          colorRef={colorRef}
          offsetY={-0.45}
          position={[beaker.x, beaker.y, 0]}
        />
      )}

      {/* Swirl turbulence effect when shaken */}
      {beaker && (
        <SwirlEffect
          isSwirlingRef={isSwirlingRef}
          position={[beaker.x, beaker.y + 0.1, 0]}
          radius={0.65}
          height={0.4}
          colorRef={colorRef}
        />
      )}

      {spawnedItems.map((item: any) => (
        <group
          key={item.id}
          ref={(el) => { if (el) itemGroupsRef.current[item.id] = el; }}
          position={[item.x, item.y, item.isDragging ? 1.5 : 0]}
        >
          {item.type === 'Beaker' && (
            <group position={[0, 0, 0]}>
              {/* Borosilicate Glass Beaker Body */}
              <mesh position={[0, 0.25, 0]}>
                <cylinderGeometry args={[0.78, 0.75, 1.5, 32, 1, true]} />
                <meshStandardMaterial
                  color="#ffffff"
                  roughness={0.1}
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                />
              </mesh>
              {/* Beaker Base Bottom */}
              <mesh position={[0, -0.5, 0]}>
                <cylinderGeometry args={[0.75, 0.75, 0.05, 32]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.2} transparent opacity={0.6} />
              </mesh>
              {/* Beaker Lip / Spout Rim */}
              <mesh position={[0, 1.0, 0]}>
                <torusGeometry args={[0.78, 0.03, 16, 32]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.1} />
              </mesh>
              {/* Volume Graduation Lines */}
              {[-0.2, 0.1, 0.4, 0.7].map((yMark, idx) => (
                <group key={idx} position={[0.77, yMark, 0]}>
                  <mesh>
                    <boxGeometry args={[0.02, 0.02, 0.15]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                  <Text position={[0.15, 0, 0]} fontSize={0.1} color="#ffffff" anchorX="left">
                    {`${(idx + 1) * 25}ml`}
                  </Text>
                </group>
              ))}
            </group>
          )}

          {item.type === 'Bottle' && (
            <group 
              position={[0, 0.3, 0]}
              rotation={item.isDragging ? [0, 0, -0.75] : [0, 0, 0]}
              scale={hoveredId === item.id ? [1.12, 1.12, 1.12] : [1, 1, 1]}
            >
              <mesh>
                <cylinderGeometry args={[0.48, 0.52, 1.2, 24]} />
                <meshStandardMaterial 
                  color={item.color} 
                  roughness={0.2} 
                  transparent 
                  opacity={0.85}
                  emissive={hoveredId === item.id ? item.color : '#000000'}
                  emissiveIntensity={hoveredId === item.id ? 0.35 : 0}
                />
              </mesh>
              <mesh position={[0, 0.7, 0]}>
                <cylinderGeometry args={[0.18, 0.22, 0.3, 16]} />
                <meshStandardMaterial color="#64748b" roughness={0.4} />
              </mesh>
              <Text position={[0, 0.05, 0.54]} fontSize={0.15} color="#ffffff" anchorX="center">
                {item.name}
              </Text>
            </group>
          )}

          {item.type === 'Dropper' && (
            <group 
              position={[0, 0.3, 0]}
              rotation={item.isDragging ? [0, 0, -0.7] : [0, 0, 0]}
              scale={hoveredId === item.id ? [1.15, 1.15, 1.15] : [1, 1, 1]}
            >
              <mesh position={[0, 0.7, 0]}>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshStandardMaterial 
                  color={item.color} 
                  roughness={0.7}
                  emissive={hoveredId === item.id ? item.color : '#000000'}
                  emissiveIntensity={hoveredId === item.id ? 0.4 : 0}
                />
              </mesh>
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 1.1, 16]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.45} />
              </mesh>
              <Text position={[0, 1.05, 0]} fontSize={0.13} color="#ffffff" anchorX="center">
                {item.name}
              </Text>
            </group>
          )}

          {item.type === 'Tube' && (
            <group 
              position={[0, 0.3, 0]}
              rotation={item.isDragging ? [0, 0, -0.8] : [0, 0, 0]}
              scale={hoveredId === item.id ? [1.15, 1.15, 1.15] : [1, 1, 1]}
            >
              <mesh>
                <cylinderGeometry args={[0.2, 0.2, 1.3, 24]} />
                <meshStandardMaterial 
                  color="#ffffff" 
                  transparent 
                  opacity={0.45}
                  roughness={0.1}
                />
              </mesh>
              {/* Internal acid liquid */}
              <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.17, 0.17, 0.8, 16]} />
                <meshStandardMaterial color="#f5d0fe" transparent opacity={0.85} />
              </mesh>
              <Text position={[0, 0.8, 0]} fontSize={0.14} color="#ffffff" anchorX="center">
                {item.name}
              </Text>
            </group>
          )}
        </group>
      ))}
    </>
  );
}
