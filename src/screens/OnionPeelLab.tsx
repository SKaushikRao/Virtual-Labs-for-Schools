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
  { id: 1, text: "Place the Compound Microscope on the table.", expectedTool: "Microscope" },
  { id: 2, text: "Peel onion epidermal membrane and place on Glass Slide.", expectedTool: "Onion Peel" },
  { id: 3, text: "Add 1 drop of Safranin Stain & cover with Coverslip.", expectedTool: "Safranin" },
  { id: 4, text: "Mount prepared slide onto the microscope stage.", expectedTool: "Slide Mount" },
  { id: 5, text: "Turn the Coarse Focus Knob to view high-res cellular structure.", expectedTool: "Focus Knob" }
];

const INVENTORY_ITEMS = [
  { id: 'Microscope', type: 'Scope', color: '#10b981', icon: '🔬', name: 'Microscope', desc: 'Compound monocular laboratory optical microscope' },
  { id: 'Onion Peel', type: 'Slide', color: '#e2e8f0', icon: '🧅', name: 'Onion Peel', desc: 'Thin transparent epidermal layer of onion bulb' },
  { id: 'Safranin', type: 'Dropper', color: '#f43f5e', icon: '🧪', name: 'Safranin Stain', desc: 'Nucleus and cell wall specific biological dye' },
  { id: 'Focus Knob', type: 'Tool', color: '#38bdf8', icon: '🎛️', name: 'Focus Knob', desc: 'Calibrated fine/coarse objective adjustment dial' },
];

export function OnionPeelLab() {
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
  const [focusedCellView, setFocusedCellView] = useState(false);

  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'Cytology Microscopy Lab Initialized.', type: 'info' }
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

    if (activeStep === 1 && item.id !== 'Microscope') {
      triggerMistake("Place the Microscope on the table first.");
      return;
    }

    if (item.id === 'Microscope') {
      setSpawnedItems(prev => [...prev, { ...item, x: 0, y: -0.6, isDragging: false }]);
      triggerSuccess("Compound microscope mounted on bench.");
      setActiveStep(2);
      setCurrentStep(2);
    } else {
      labAudio.playGrabSound();
      const count = spawnedItemsRef.current.filter(i => i.id !== 'Microscope').length;
      const xPos = -4 + count * 2.2;
      setSpawnedItems(prev => [...prev, { ...item, x: xPos, y: -0.6, isDragging: false }]);
      addLog(`Placed ${item.name} on bench.`, "info");
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
    <div className="w-full h-screen relative bg-gradient-to-b from-[#05060f] via-[#061412] to-[#04050d] flex flex-col overflow-hidden cursor-none select-none">
      <GestureCursor getPointer={getPointer} />
      <GestureTutorial />
      <AIMentorPanel />

      <LabTopBar
        title="Onion Peel Cell Observation Under Microscope"
        subject="Biology"
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
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-400 mb-1">Plant Cytology</span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Plant Cell Anatomy</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Mount stained epidermal peel under objective lens to observe cell walls, nucleus, and cytoplasm.
            </p>
          </motion.div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4 font-mono">
              <span>📋</span> Slide Prep Steps
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
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold font-mono", isCurrent ? "bg-emerald-500 text-black font-bold shadow-[0_0_15px_#10b981]" : "bg-white/20 text-white")}>
                        {step.id}
                      </div>
                    )}
                    <span className={cn("text-[11px] leading-relaxed transition-colors", isCompleted ? "text-white/40 line-through" : "text-white/90", isCurrent && "font-bold text-emerald-300")}>{step.text}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/20 to-transparent backdrop-blur-md rounded-2xl border border-emerald-500/30 p-5 shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 font-mono">Biology XP</span>
              <span className="text-2xl font-mono font-bold text-emerald-300">{score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700" style={{ width: `${Math.min(100, score)}%` }} />
            </div>
          </div>
        </div>

        {/* Center 3D Scene / High-Res Microscope View */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-transparent pointer-events-none">
          {focusedCellView ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-[480px] h-[480px] rounded-full border-4 border-emerald-400/80 bg-emerald-950/80 backdrop-blur-xl shadow-[0_0_50px_rgba(16,185,129,0.5)] overflow-hidden relative flex items-center justify-center pointer-events-auto"
            >
              {/* Cellular Grid Graphics */}
              <div className="w-full h-full p-8 grid grid-cols-3 grid-rows-3 gap-2 opacity-90">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border-2 border-emerald-400/60 rounded-xl bg-emerald-800/40 p-2 flex flex-col justify-between relative shadow-inner">
                    <span className="text-[8px] font-mono text-emerald-300">Cell #{i+1}</span>
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500/90 self-end mr-1 shadow-[0_0_8px_#f43f5e]" title="Nucleus" />
                    <span className="text-[7px] text-white/50">Cell Wall & Vacuole</span>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-4 bg-black/60 px-4 py-1.5 rounded-full text-xs font-mono text-emerald-300 border border-emerald-500/40">
                Magnification: 400x (High Power)
              </div>
            </motion.div>
          ) : (
            <Canvas camera={{ position: [0, 2, 7.5], fov: 45 }} style={{ pointerEvents: 'none' }}>
              <ambientLight intensity={0.6} />
              <pointLight position={[6, 8, 6]} intensity={1.5} color="#10b981" />
              <pointLight position={[-6, 6, -3]} intensity={1.2} color="#06b6d4" />

              <MicroscopeScene 
                getPointer={getPointer}
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                setCurrentStep={setCurrentStep}
                triggerSuccess={triggerSuccess}
                triggerMistake={triggerMistake}
                setFocusedCellView={setFocusedCellView}
                spawnedItems={spawnedItems}
                setSpawnedItems={setSpawnedItems}
              />
              <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={25} blur={2} />
            </Canvas>
          )}

          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none">
            <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", focusedCellView ? "bg-emerald-400 shadow-[0_0_10px_#10b981]" : "bg-cyan-400")} />
            <span className="text-xs font-mono font-medium text-white/90">
              {activeStep <= 5 ? `Step ${activeStep}: ${EXPERIMENT_STEPS[activeStep-1].text}` : "Plant Cell Cytology Complete!"}
            </span>
          </div>

          <video ref={videoRef} playsInline muted className="absolute w-36 h-28 top-20 right-6 object-cover rounded-2xl border border-white/20 opacity-40 z-10 scale-x-[-1] pointer-events-none" />
        </div>

        {/* Right Telemetry */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl font-mono">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3">Microscopy Status</h3>
             <div className="space-y-2 mb-3 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                   <span className="text-white/50">Stain</span>
                   <span className="text-rose-400 font-bold">Safranin (Pink)</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                   <span className="text-white/50">Focus</span>
                   <span className="text-emerald-400 font-bold">{focusedCellView ? 'Sharp (400x)' : 'Unfocused'}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                   <span className="text-white/50">Specimen</span>
                   <span className="text-cyan-300 font-bold">Allium Cepa (Onion)</span>
                </div>
             </div>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0 font-mono">Observation Log</h3>
             <div className="flex-1 space-y-3 font-mono text-[10px] text-white/40 overflow-y-auto pr-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                     <span className="text-emerald-400 shrink-0">[{log.time}]</span>
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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-3 px-4 py-2 rounded-xl bg-black/80 backdrop-blur-xl border border-emerald-500/30 text-center shadow-xl pointer-events-none">
              <div className="text-xs font-bold text-white font-display">{hoveredItem.name}</div>
              <div className="text-[10px] font-mono text-emerald-200/80">{hoveredItem.desc}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3.5 bg-[#061412]/80 backdrop-blur-2xl border border-white/15 p-3 rounded-3xl overflow-x-auto max-w-[90vw] pointer-events-auto shadow-2xl shrink-0 mx-8 items-end">
           {INVENTORY_ITEMS.map((item) => (
              <div 
                 key={item.id}
                 data-item-id={item.id}
                 data-item-type={item.type}
                 data-item-color={item.color}
                 data-item-name={item.name}
                 onClick={handleInventoryClick}
                 onMouseEnter={() => setHoveredItem(item)}
                 onMouseLeave={() => setHoveredItem(null)}
                 className="min-w-[100px] h-28 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-white/10 transition-all cursor-pointer group hover:-translate-y-3 hover:border-emerald-400/60 select-none"
              >
                 <div className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-200">{item.icon}</div>
                 <span className="text-[10px] font-mono text-center px-1 text-white/70 group-hover:text-emerald-300 font-medium">{item.name}</span>
              </div>
           ))}
        </div>
      </div>
    </div>
  );
}

function MicroscopeScene({ getPointer, activeStep, setActiveStep, setCurrentStep, triggerSuccess, triggerMistake, setFocusedCellView, spawnedItems, setSpawnedItems }: any) {
  const { viewport } = useThree();
  const draggedItemIdRef = useRef<string | null>(null);
  const wasActive = useRef(false);
  const targetPosRef = useRef(new THREE.Vector3());

  useFrame(() => {
    const ptr = getPointer();
    const targetX = (ptr.x * 2 - 1) * (viewport.width / 2);
    const targetY = -(ptr.y * 2 - 1) * (viewport.height / 2);
    targetPosRef.current.lerp(new THREE.Vector3(targetX, targetY, 2), 0.4);

    const grabbed = ptr.active && !wasActive.current;
    const released = !ptr.active && wasActive.current;

    if (grabbed) {
      let closest: any = null;
      let minDist = 2.8;
      spawnedItems.forEach((item: any) => {
        if (item.id === 'Microscope') return;
        const dist = new THREE.Vector2(targetX, targetY).distanceTo(new THREE.Vector2(item.x, item.y));
        if (dist < minDist) {
          minDist = dist;
          closest = item;
        }
      });
      if (closest) {
        draggedItemIdRef.current = closest.id;
        labAudio.playGrabSound();
        setSpawnedItems((prev: any) => prev.map((i: any) => i.id === closest.id ? { ...i, isDragging: true } : i));
      }
    }

    if (ptr.active && draggedItemIdRef.current) {
      setSpawnedItems((prev: any) => prev.map((i: any) => i.id === draggedItemIdRef.current ? { ...i, x: targetPosRef.current.x, y: targetPosRef.current.y } : i));
    }

    if (released && draggedItemIdRef.current) {
      const itemId = draggedItemIdRef.current;
      setSpawnedItems((prev: any) => {
        const item = prev.find((i: any) => i.id === itemId);
        if (!item) return prev;

        const scope = prev.find((i: any) => i.id === 'Microscope');
        if (scope) {
          const distToScope = new THREE.Vector2(item.x, item.y).distanceTo(new THREE.Vector2(scope.x, scope.y + 1));
          if (distToScope < 3) {
            const expected = EXPERIMENT_STEPS[activeStep - 1];
            if (expected && expected.expectedTool === item.id) {
              labAudio.playPourEffect();

              if (item.id === 'Onion Peel') {
                triggerSuccess("Mounted thin onion peel membrane onto slide.");
              } else if (item.id === 'Safranin') {
                triggerSuccess("Added drop of Safranin stain. Nuclei stained dark pink.");
              } else if (item.id === 'Focus Knob') {
                setFocusedCellView(true);
                triggerSuccess("Focus adjusted! High-power viewport active: Observed cell walls and peripheral nuclei!");
              }

              const nextStep = activeStep + 1;
              setActiveStep(nextStep);
              setCurrentStep(nextStep);
              draggedItemIdRef.current = null;
              return prev.filter((i: any) => i.id !== item.id);
            } else {
              triggerMistake(`Wrong tool for Step ${activeStep}! Needed: ${expected?.expectedTool}`);
            }
          }
        }
        return prev.map((i: any) => i.id === item.id ? { ...i, isDragging: false, y: -0.6 } : i);
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

      {/* Microscope Model */}
      {spawnedItems.some((i: any) => i.id === 'Microscope') && (
        <group position={[0, -0.6, 0]}>
          {/* Base */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[1.2, 1.4, 0.3, 24]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
          </mesh>
          {/* Curved Arm */}
          <mesh position={[0, 1.8, -0.4]}>
            <boxGeometry args={[0.4, 2.8, 0.6]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          {/* Stage */}
          <mesh position={[0, 1.2, 0.4]}>
            <boxGeometry args={[2, 0.1, 1.6]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {/* Eyepiece / Objective Body Tube */}
          <mesh position={[0, 2.6, 0.4]} rotation={[-0.2, 0, 0]}>
            <cylinderGeometry args={[0.25, 0.2, 1.8, 16]} />
            <meshStandardMaterial color="#0284c7" metalness={0.9} />
          </mesh>
        </group>
      )}

      {spawnedItems.map((item: any) => (
        <group key={item.id} position={[item.x, item.y, item.isDragging ? 1.5 : 0]}>
          {item.type === 'Slide' && (
            <group position={[0, 0.2, 0]}>
              <mesh>
                <boxGeometry args={[1.6, 0.05, 0.8]} />
                <meshPhysicalMaterial color="#ffffff" transmission={0.9} transparent opacity={0.8} />
              </mesh>
              <Text position={[0, 0.3, 0]} fontSize={0.16} color="#ffffff" anchorX="center">Slide</Text>
            </group>
          )}

          {item.type === 'Dropper' && (
            <group position={[0, 0.4, 0]}>
              <mesh position={[0, 0.8, 0]}>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshStandardMaterial color={item.color} />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 1.2, 16]} />
                <meshPhysicalMaterial color="#ffffff" transmission={0.9} transparent opacity={0.5} />
              </mesh>
            </group>
          )}

          {item.type === 'Tool' && (
            <group position={[0, 0.3, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.4, 0.4, 0.4, 16]} />
                <meshStandardMaterial color="#0284c7" metalness={0.9} />
              </mesh>
              <Text position={[0, 0.6, 0]} fontSize={0.18} color="#00f2ff" anchorX="center">Focus Dial</Text>
            </group>
          )}
        </group>
      ))}
    </>
  );
}
