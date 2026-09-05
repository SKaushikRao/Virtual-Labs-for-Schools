import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, ContactShadows } from '@react-three/drei';
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
import { PourStreamMesh, LiquidMesh, calculateFlowRate, blendLiquidColors } from '../components/fluids/FluidSystem';

const EXPERIMENT_STEPS = [
  { id: 1, text: "Place the Multi-Well Spot Plate on the bench.", expectedTool: "Spot Plate" },
  { id: 2, text: "Add Lemon Juice to Well #1 (Acidic).", expectedTool: "Lemon Juice" },
  { id: 3, text: "Add Distilled Water to Well #2 (Neutral).", expectedTool: "Dist. Water" },
  { id: 4, text: "Add Soap Solution to Well #3 (Mild Base).", expectedTool: "Soap Solution" },
  { id: 5, text: "Add Universal Indicator to observe the pH spectrum.", expectedTool: "Indicator Dropper" }
];

const INVENTORY_ITEMS = [
  { id: 'Spot Plate', type: 'Plate', color: '#ffffff', icon: '🧫', name: 'Spot Plate', desc: 'Porcelain multi-cavity reaction tile' },
  { id: 'Lemon Juice', type: 'Dropper', color: '#facc15', icon: '🍋', name: 'Lemon Juice', desc: 'Citric acid solution (pH ~2.2)' },
  { id: 'Dist. Water', type: 'Dropper', color: '#38bdf8', icon: '💧', name: 'Dist. Water', desc: 'Pure neutral solvent (pH ~7.0)' },
  { id: 'Soap Solution', type: 'Dropper', color: '#818cf8', icon: '🧼', name: 'Soap Sol.', desc: 'Mild alkaline surfactant (pH ~9.0)' },
  { id: 'Indicator Dropper', type: 'Dropper', color: '#22c55e', icon: '🧪', name: 'Univ. Indicator', desc: 'Full spectrum pH color reagent' },
];

export function PHTestingLab() {
  const addScore = useAppStore(state => state.addScore);
  const score = useAppStore(state => state.score);
  const setCurrentStep = useAppStore(state => state.setCurrentStep);
  const setTotalSteps = useAppStore(state => state.setTotalSteps);
  const setRecentMistake = useAppStore(state => state.setRecentMistake);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isReady, cursorRef } = useHandTracking(videoRef);
  const getPointer = usePointerInput(cursorRef);

  const [activeStep, setActiveStep] = useState(1);
  const [mistakeShaking, setMistakeShaking] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<typeof INVENTORY_ITEMS[0] | null>(null);

  // 3 Wells: [lemon, water, soap]
  const [wellVolumes, setWellVolumes] = useState<number[]>([0, 0, 0]); // ml
  const [wellColors, setWellColors] = useState<string[]>(['#fef08a', '#bae6fd', '#c7d2fe']);
  const [wellLabels, setWellLabels] = useState<string[]>(['Empty', 'Empty', 'Empty']);
  const [indicatorAdded, setIndicatorAdded] = useState(false);
  const [isPouringNow, setIsPouringNow] = useState(false);
  const [targetPrompt, setTargetPrompt] = useState<string | null>(null);

  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'pH Universal Indicator Lab Initialized.', type: 'info' }
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

    if (activeStep === 1 && item.id !== 'Spot Plate') {
      triggerMistake("Place the Spot Plate on the bench first.");
      return;
    }

    if (item.id === 'Spot Plate') {
      setSpawnedItems(prev => [...prev, { ...item, x: 0, y: -0.6, isDragging: false }]);
      triggerSuccess("Spot plate positioned on bench.");
      setActiveStep(2);
      setCurrentStep(2);
    } else {
      labAudio.playGrabSound();
      const count = spawnedItemsRef.current.filter(i => i.id !== 'Spot Plate').length;
      const xPos = -4 + count * 2.2;
      setSpawnedItems(prev => [...prev, { ...item, x: xPos, y: -0.6, isDragging: false }]);
      addLog(`Placed ${item.name} on bench. Drag & position over the well to dispense.`, "info");
    }
  };

  const spawnItemRef = useRef(spawnItem);
  spawnItemRef.current = spawnItem;

  const handleInventoryClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const id = e.currentTarget.getAttribute('data-item-id')!;
    const type = e.currentTarget.getAttribute('data-item-type')!;
    const color = e.currentTarget.getAttribute('data-item-color')!;
    const name = e.currentTarget.getAttribute('data-item-name')!;
    spawnItemRef.current({ id, type, color, name });
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-[#05060f] via-[#090b1c] to-[#04050d] flex flex-col overflow-hidden cursor-none select-none">
      <GestureCursor getPointer={getPointer} />
      <GestureTutorial />
      <AIMentorPanel />

      <LabTopBar
        title="pH Testing of Common Household Substances"
        subject="Chemistry"
        currentStep={activeStep}
        totalSteps={5}
        isReady={isReady}
      />

      <main className="flex-1 flex p-6 gap-6 relative z-10 min-h-0">
        <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto hidden md:flex z-20 pointer-events-none">
          <motion.div 
            animate={mistakeShaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            className={cn(
              "bg-white/5 backdrop-blur-md rounded-2xl border p-5 flex flex-col shrink-0 pointer-events-auto shadow-2xl",
              mistakeShaking ? "border-red-500/80 bg-red-500/10" : "border-white/10"
            )}
          >
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#c084fc] mb-1">Acids, Bases & Indicators</span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">pH Scale Analysis</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Use universal indicator to test acids (red), neutral water (green), and bases (blue/violet).
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

        {/* Center 3D Scene */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-transparent pointer-events-none">
          <Canvas camera={{ position: [0, 2, 7.5], fov: 45 }} style={{ pointerEvents: 'none' }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} />
            <pointLight position={[6, 8, 6]} intensity={1.5} color="#00f2ff" />
            <pointLight position={[-6, 6, -3]} intensity={1.2} color="#4e44ff" />

            <PHScene 
              getPointer={getPointer}
              activeStep={activeStep}
              setActiveStep={setActiveStep}
              setCurrentStep={setCurrentStep}
              triggerSuccess={triggerSuccess}
              triggerMistake={triggerMistake}
              wellVolumes={wellVolumes}
              setWellVolumes={setWellVolumes}
              wellColors={wellColors}
              setWellColors={setWellColors}
              wellLabels={wellLabels}
              setWellLabels={setWellLabels}
              indicatorAdded={indicatorAdded}
              setIndicatorAdded={setIndicatorAdded}
              setIsPouringNow={setIsPouringNow}
              setTargetPrompt={setTargetPrompt}
              spawnedItems={spawnedItems}
              setSpawnedItems={setSpawnedItems}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={25} blur={2} />
          </Canvas>

          {/* Action indicator */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3">
              <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isPouringNow ? "bg-cyan-400 shadow-[0_0_12px_#38bdf8]" : "bg-emerald-400 shadow-[0_0_10px_#10b981]")} />
              <span className="text-xs font-mono font-medium text-white/90">
                {activeStep <= 5 ? `Step ${activeStep}: ${EXPERIMENT_STEPS[activeStep-1].text}` : "Universal pH Spectrum Verified!"}
              </span>
            </div>

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

        {/* Right Telemetry */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3 font-mono">Universal pH Scale</h3>
             <div className="space-y-2 mb-3 font-mono text-xs">
                <div className={cn("flex items-center justify-between p-2 rounded-lg border transition-all", indicatorAdded ? "bg-red-500/20 border-red-500/40 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "bg-white/5 border-white/10 text-white/70")}>
                  <span>Well 1 (Lemon)</span>
                  <span className="font-bold">{indicatorAdded ? 'pH ~2.2 (Acid)' : wellVolumes[0] > 0 ? `${wellVolumes[0].toFixed(1)}ml` : 'Empty'}</span>
                </div>
                <div className={cn("flex items-center justify-between p-2 rounded-lg border transition-all", indicatorAdded ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-white/5 border-white/10 text-white/70")}>
                  <span>Well 2 (Water)</span>
                  <span className="font-bold">{indicatorAdded ? 'pH 7.0 (Neutral)' : wellVolumes[1] > 0 ? `${wellVolumes[1].toFixed(1)}ml` : 'Empty'}</span>
                </div>
                <div className={cn("flex items-center justify-between p-2 rounded-lg border transition-all", indicatorAdded ? "bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "bg-white/5 border-white/10 text-white/70")}>
                  <span>Well 3 (Soap)</span>
                  <span className="font-bold">{indicatorAdded ? 'pH ~9.0 (Base)' : wellVolumes[2] > 0 ? `${wellVolumes[2].toFixed(1)}ml` : 'Empty'}</span>
                </div>
             </div>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0 font-mono">Assay Event Log</h3>
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

      {/* Hotbar */}
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
                 onClick={handleInventoryClick}
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

function PHScene({ 
  getPointer, 
  activeStep, 
  setActiveStep, 
  setCurrentStep, 
  triggerSuccess, 
  triggerMistake, 
  wellVolumes,
  setWellVolumes,
  wellColors, 
  setWellColors, 
  wellLabels, 
  setWellLabels, 
  indicatorAdded,
  setIndicatorAdded,
  setIsPouringNow,
  setTargetPrompt,
  spawnedItems, 
  setSpawnedItems 
}: any) {
  const { viewport } = useThree();
  const draggedItemIdRef = useRef<string | null>(null);
  const hoveredItemIdRef = useRef<string | null>(null);
  const wasActive = useRef(false);
  const targetPosRef = useRef(new THREE.Vector3());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Pouring stream tracking
  const [streamActive, setStreamActive] = useState(false);
  const [streamFrom, setStreamFrom] = useState(new THREE.Vector3());
  const [streamTo, setStreamTo] = useState(new THREE.Vector3());
  const [streamColor, setStreamColor] = useState('#ffffff');
  const [currentFlowRate, setCurrentFlowRate] = useState(15);

  const hasPromptedTarget = useRef(false);

  // Well x positions relative to plate: -1.6, 0, 1.6
  const wellPositions = [-1.6, 0, 1.6];

  useFrame((_, delta) => {
    const ptr = getPointer();
    const targetX = (ptr.x * 2 - 1) * (viewport.width / 2);
    const targetY = -(ptr.y * 2 - 1) * (viewport.height / 2);
    targetPosRef.current.lerp(new THREE.Vector3(targetX, targetY, 2), 0.35);

    // Hover detection
    if (!draggedItemIdRef.current) {
      let foundHover: string | null = null;
      let minHoverDist = 2.5;

      spawnedItems.forEach((item: any) => {
        if (item.id === 'Spot Plate') return;
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

    // Grab item
    if (grabbed && hoveredItemIdRef.current) {
      const grabId = hoveredItemIdRef.current;
      draggedItemIdRef.current = grabId;
      labAudio.playGrabSound();
      setSpawnedItems((prev: any) => prev.map((i: any) => (i.id === grabId ? { ...i, isDragging: true } : i)));
    }

    const heldId = draggedItemIdRef.current;
    const plate = spawnedItems.find((i: any) => i.id === 'Spot Plate');

    // Continuous Pouring / Dispensing
    if (ptr.active && heldId && plate) {
      // Check which well is closest
      let targetWellIdx = -1;
      let minWellDist = 2.2;

      wellPositions.forEach((xOff, idx) => {
        const wellWorldPos = new THREE.Vector2(plate.x + xOff, plate.y + 0.3);
        const dist = new THREE.Vector2(targetPosRef.current.x, targetPosRef.current.y).distanceTo(wellWorldPos);
        if (dist < minWellDist && targetPosRef.current.y > plate.y + 0.2) {
          minWellDist = dist;
          targetWellIdx = idx;
        }
      });

      if (targetWellIdx >= 0) {
        const flow = calculateFlowRate(50, 15);
        const targetWellX = plate.x + wellPositions[targetWellIdx];
        const targetWellY = plate.y + 0.16;

        // Step 2: Lemon Juice into Well 0
        if (heldId === 'Lemon Juice' && activeStep === 2 && targetWellIdx === 0) {
          setStreamActive(true);
          setStreamFrom(new THREE.Vector3(targetPosRef.current.x, targetPosRef.current.y - 0.3, 0));
          setStreamTo(new THREE.Vector3(targetWellX, targetWellY, 0));
          setStreamColor('#fef08a');
          setCurrentFlowRate(flow);
          setIsPouringNow(true);

          setWellVolumes((v: number[]) => {
            const newV = [...v];
            newV[0] = Math.min(5, newV[0] + flow * delta * 0.4);
            if (newV[0] >= 3 && !hasPromptedTarget.current) {
              hasPromptedTarget.current = true;
              setTargetPrompt("Well 1 filled with Lemon Juice! Release dropper.");
            }
            return newV;
          });
        }
        // Step 3: Dist. Water into Well 1
        else if (heldId === 'Dist. Water' && activeStep === 3 && targetWellIdx === 1) {
          setStreamActive(true);
          setStreamFrom(new THREE.Vector3(targetPosRef.current.x, targetPosRef.current.y - 0.3, 0));
          setStreamTo(new THREE.Vector3(targetWellX, targetWellY, 0));
          setStreamColor('#bae6fd');
          setCurrentFlowRate(flow);
          setIsPouringNow(true);

          setWellVolumes((v: number[]) => {
            const newV = [...v];
            newV[1] = Math.min(5, newV[1] + flow * delta * 0.4);
            if (newV[1] >= 3 && !hasPromptedTarget.current) {
              hasPromptedTarget.current = true;
              setTargetPrompt("Well 2 filled with Distilled Water! Release dropper.");
            }
            return newV;
          });
        }
        // Step 4: Soap Solution into Well 2
        else if (heldId === 'Soap Solution' && activeStep === 4 && targetWellIdx === 2) {
          setStreamActive(true);
          setStreamFrom(new THREE.Vector3(targetPosRef.current.x, targetPosRef.current.y - 0.3, 0));
          setStreamTo(new THREE.Vector3(targetWellX, targetWellY, 0));
          setStreamColor('#c7d2fe');
          setCurrentFlowRate(flow);
          setIsPouringNow(true);

          setWellVolumes((v: number[]) => {
            const newV = [...v];
            newV[2] = Math.min(5, newV[2] + flow * delta * 0.4);
            if (newV[2] >= 3 && !hasPromptedTarget.current) {
              hasPromptedTarget.current = true;
              setTargetPrompt("Well 3 filled with Soap Solution! Release dropper.");
            }
            return newV;
          });
        }
        // Step 5: Indicator into all wells
        else if (heldId === 'Indicator Dropper' && activeStep === 5) {
          setStreamActive(true);
          setStreamFrom(new THREE.Vector3(targetPosRef.current.x, targetPosRef.current.y - 0.3, 0));
          setStreamTo(new THREE.Vector3(targetWellX, targetWellY, 0));
          setStreamColor('#22c55e');
          setCurrentFlowRate(flow);
          setIsPouringNow(true);

          if (!hasPromptedTarget.current) {
            hasPromptedTarget.current = true;
            setTargetPrompt("Dispensing Universal Indicator across wells! Release to complete assay.");
          }
        } else {
          setStreamActive(false);
          setIsPouringNow(false);
        }
      } else {
        setStreamActive(false);
        setIsPouringNow(false);
      }

      // Update dragging position
      setSpawnedItems((prev: any) =>
        prev.map((i: any) =>
          i.id === heldId ? { ...i, x: targetPosRef.current.x, y: targetPosRef.current.y } : i
        )
      );
    } else {
      setStreamActive(false);
      setIsPouringNow(false);
    }

    // Release Item
    if (released && heldId) {
      labAudio.playReleaseSound();
      setTargetPrompt(null);
      hasPromptedTarget.current = false;

      setSpawnedItems((prev: any) => {
        const item = prev.find((i: any) => i.id === heldId);
        if (!item || !plate) return prev;

        const distToPlate = new THREE.Vector2(item.x, item.y).distanceTo(new THREE.Vector2(plate.x, plate.y + 1));

        if (distToPlate < 3.2) {
          const expected = EXPERIMENT_STEPS[activeStep - 1];
          if (expected && expected.expectedTool === heldId) {
            if (heldId === 'Lemon Juice') {
              setWellLabels((l: string[]) => ['Lemon (Citric Acid)', l[1], l[2]]);
              triggerSuccess("Added Lemon Juice into Well 1 (Acidic solution).", 20);
              setActiveStep(3);
              setCurrentStep(3);
              draggedItemIdRef.current = null;
              return prev.filter((i: any) => i.id !== heldId);
            } else if (heldId === 'Dist. Water') {
              setWellLabels((l: string[]) => [l[0], 'Water (Neutral)', l[2]]);
              triggerSuccess("Added Distilled Water into Well 2 (Neutral solvent).", 20);
              setActiveStep(4);
              setCurrentStep(4);
              draggedItemIdRef.current = null;
              return prev.filter((i: any) => i.id !== heldId);
            } else if (heldId === 'Soap Solution') {
              setWellLabels((l: string[]) => [l[0], l[1], 'Soap (Mild Base)']);
              triggerSuccess("Added Soap Solution into Well 3 (Alkaline solution).", 20);
              setActiveStep(5);
              setCurrentStep(5);
              draggedItemIdRef.current = null;
              return prev.filter((i: any) => i.id !== heldId);
            } else if (heldId === 'Indicator Dropper') {
              setIndicatorAdded(true);
              setWellColors(['#ef4444', '#22c55e', '#3b82f6']);
              triggerSuccess("Universal Indicator added! Colors transitioned: Red (pH 2.2), Green (pH 7.0), Blue (pH 9.0)!", 30);
              setActiveStep(6);
              setCurrentStep(6);
              draggedItemIdRef.current = null;
              return prev.filter((i: any) => i.id !== heldId);
            }
          } else {
            triggerMistake(`Wrong dropper! For Step ${activeStep}, you need: ${expected?.expectedTool}`);
          }
        }
        return prev.map((i: any) => (i.id === heldId ? { ...i, isDragging: false, y: -0.6 } : i));
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

      {/* Dynamic Pouring Stream */}
      <PourStreamMesh
        from={streamFrom}
        to={streamTo}
        color={streamColor}
        active={streamActive}
        flowRate={currentFlowRate}
      />

      {spawnedItems.map((item: any) => (
        <group key={item.id} position={[item.x, item.y, item.isDragging ? 1.5 : 0]}>
          {item.type === 'Plate' && (
            <group position={[0, 0, 0]}>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[5.2, 0.3, 2.5]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.1} />
              </mesh>
              
              {/* 3 Porcelain Wells */}
              {wellPositions.map((xOffset, i) => (
                <group key={i} position={[xOffset, 0.16, 0]}>
                  {/* Well indentation */}
                  <mesh>
                    <cylinderGeometry args={[0.62, 0.52, 0.08, 24]} />
                    <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
                  </mesh>
                  
                  {/* Well Liquid */}
                  {wellVolumes[i] > 0 && (
                    <LiquidMesh
                      position={[0, 0.02 + (wellVolumes[i] / 5) * 0.04, 0]}
                      radius={0.48 + (wellVolumes[i] / 5) * 0.08}
                      height={(wellVolumes[i] / 5) * 0.08}
                      color={wellColors[i]}
                      opacity={0.9}
                    />
                  )}

                  <Text position={[0, 0.7, 0]} fontSize={0.16} color="#0f172a" anchorX="center" outlineWidth={0.01}>
                    {`Well ${i+1}: ${wellLabels[i]}`}
                  </Text>
                </group>
              ))}
            </group>
          )}

          {item.type === 'Dropper' && (
            <group 
              position={[0, 0.4, 0]}
              rotation={item.isDragging ? [0, 0, -0.6] : [0, 0, 0]}
              scale={hoveredId === item.id ? [1.15, 1.15, 1.15] : [1, 1, 1]}
            >
              {/* Squeeze bulb */}
              <mesh position={[0, 0.8, 0]}>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshStandardMaterial 
                  color={item.color} 
                  roughness={0.7}
                  emissive={hoveredId === item.id ? item.color : '#000000'}
                  emissiveIntensity={hoveredId === item.id ? 0.4 : 0}
                />
              </mesh>
              {/* Glass pipette body */}
              <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 1.2, 16]} />
                <meshPhysicalMaterial color="#ffffff" transmission={0.9} transparent opacity={0.5} roughness={0.1} />
              </mesh>
              {/* Internal liquid tint */}
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.8, 16]} />
                <meshStandardMaterial color={item.color} transparent opacity={0.75} />
              </mesh>
              <Text position={[0, 1.2, 0]} fontSize={0.14} color="#ffffff" anchorX="center">
                {item.name}
              </Text>
            </group>
          )}
        </group>
      ))}
    </>
  );
}
