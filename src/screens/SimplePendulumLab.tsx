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

const EXPERIMENT_STEPS = [
  { id: 1, text: "Set up the Pendulum Stand on the bench.", expectedTool: "Pendulum Stand" },
  { id: 2, text: "Attach 50cm String and Brass Bob to the clamp.", expectedTool: "Bob (50cm)" },
  { id: 3, text: "Displace the Bob sideways (< 15°) to initiate oscillation.", expectedTool: "Displace" },
  { id: 4, text: "Start the Digital Stopwatch and count 10 oscillations.", expectedTool: "Stopwatch" },
  { id: 5, text: "Change string length to 80cm and record the new period.", expectedTool: "Bob (80cm)" }
];

const INVENTORY_ITEMS = [
  { id: 'Pendulum Stand', type: 'Stand', color: '#64748b', icon: '🏗️', name: 'Pendulum Stand', desc: 'Rigid vertical retort stand with clamp' },
  { id: 'Bob (50cm)', type: 'Bob', color: '#f59e0b', icon: '🟡', name: 'Bob (50cm)', desc: 'Spherical brass bob with 50cm inextensible thread' },
  { id: 'Stopwatch', type: 'Tool', color: '#06b6d4', icon: '⏱️', name: 'Digital Stopwatch', desc: 'High-precision millisecond laboratory timer' },
  { id: 'Bob (80cm)', type: 'Bob', color: '#3b82f6', icon: '🔵', name: 'Bob (80cm)', desc: 'Spherical brass bob with 80cm thread' },
];

export function SimplePendulumLab() {
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

  // Pendulum physics state
  const [pendulumLength, setPendulumLength] = useState<number>(0.5); // meters
  const [isOscillating, setIsOscillating] = useState(false);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchTime, setStopwatchTime] = useState(0.0);
  const [oscillationCount, setOscillationCount] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);

  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'Simple Pendulum Laboratory Loaded.', type: 'info' }
  ]);

  const [spawnedItems, setSpawnedItems] = useState<{id: string, type: string, color: string, name: string, x: number, y: number, isDragging: boolean}[]>([]);
  const spawnedItemsRef = useRef(spawnedItems);
  spawnedItemsRef.current = spawnedItems;

  useEffect(() => {
    setTotalSteps(EXPERIMENT_STEPS.length);
    setCurrentStep(1);
  }, [setTotalSteps, setCurrentStep]);

  // Stopwatch counter
  useEffect(() => {
    let interval: any;
    if (stopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchTime(prev => +(prev + 0.1).toFixed(1));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [stopwatchRunning]);

  // Theoretical period T = 2 * PI * sqrt(L / 9.8)
  const theoreticalPeriod = (2 * Math.PI * Math.sqrt(pendulumLength / 9.8)).toFixed(2);

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

    if (activeStep === 1 && item.id !== 'Pendulum Stand') {
      triggerMistake("Place the Pendulum Stand on the bench first.");
      return;
    }

    if (item.id === 'Pendulum Stand') {
      setSpawnedItems(prev => [...prev, { ...item, x: 0, y: -0.6, isDragging: false }]);
      triggerSuccess("Pendulum stand mounted on bench.");
      setActiveStep(2);
      setCurrentStep(2);
    } else {
      labAudio.playGrabSound();
      const count = spawnedItemsRef.current.filter(i => i.id !== 'Pendulum Stand').length;
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
    <div className="w-full h-screen relative bg-gradient-to-b from-[#05060f] via-[#080d1e] to-[#04050d] flex flex-col overflow-hidden cursor-none select-none">
      <GestureCursor getPointer={getPointer} />
      <GestureTutorial />
      <AIMentorPanel />

      <LabTopBar
        title="Simple Pendulum (Time Period vs Length)"
        subject="Physics"
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
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-cyan-400 mb-1">Harmonic Motion</span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Pendulum Mechanics</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Verify $T = 2\pi\sqrt{'{'}L/g{'}'}$ by measuring oscillation period for different string lengths.
            </p>
          </motion.div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4 font-mono">
              <span>📋</span> Measurement Steps
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
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold font-mono", isCurrent ? "bg-cyan-500 text-black font-bold shadow-[0_0_15px_#00f2ff]" : "bg-white/20 text-white")}>
                        {step.id}
                      </div>
                    )}
                    <span className={cn("text-[11px] leading-relaxed transition-colors", isCompleted ? "text-white/40 line-through" : "text-white/90", isCurrent && "font-bold text-cyan-300")}>{step.text}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/20 to-transparent backdrop-blur-md rounded-2xl border border-cyan-500/30 p-5 shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 font-mono">Physics XP</span>
              <span className="text-2xl font-mono font-bold text-cyan-300">{score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-700" style={{ width: `${Math.min(100, score)}%` }} />
            </div>
          </div>
        </div>

        {/* Center 3D Scene */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#05060f] pointer-events-none">
          <Canvas
            key={canvasKey}
            camera={{ position: [0, 2, 8], fov: 45 }}
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
            <ambientLight intensity={0.6} />
            <pointLight position={[6, 8, 6]} intensity={1.5} color="#00f2ff" />
            <pointLight position={[-6, 6, -3]} intensity={1.2} color="#3b82f6" />

            <PendulumScene 
              getPointer={getPointer}
              activeStep={activeStep}
              setActiveStep={setActiveStep}
              setCurrentStep={setCurrentStep}
              triggerSuccess={triggerSuccess}
              triggerMistake={triggerMistake}
              pendulumLength={pendulumLength}
              setPendulumLength={setPendulumLength}
              isOscillating={isOscillating}
              setIsOscillating={setIsOscillating}
              setStopwatchRunning={setStopwatchRunning}
              setOscillationCount={setOscillationCount}
              spawnedItems={spawnedItems}
              setSpawnedItems={setSpawnedItems}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={25} blur={2} />
          </Canvas>

          {/* Action indicator */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none">
            <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isOscillating ? "bg-emerald-400 shadow-[0_0_10px_#10b981]" : "bg-cyan-400")} />
            <span className="text-xs font-mono font-medium text-white/90">
              {activeStep <= 5 ? `Step ${activeStep}: ${EXPERIMENT_STEPS[activeStep-1].text}` : "T ∝ √L Law Confirmed!"}
            </span>
          </div>

          <video ref={videoRef} playsInline muted className="absolute w-36 h-28 top-20 right-6 object-cover rounded-2xl border border-white/20 opacity-40 z-10 scale-x-[-1] pointer-events-none" />
        </div>

        {/* Right Telemetry */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl font-mono">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3">Stopwatch & Telemetry</h3>
             <div className="p-4 bg-black/50 border border-cyan-500/30 rounded-2xl text-center mb-3">
                <div className="text-[10px] uppercase text-cyan-300 font-bold mb-1">Elapsed Time (t)</div>
                <div className="text-3xl font-bold text-white tracking-widest">{stopwatchTime.toFixed(1)} s</div>
             </div>
             <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1">Length (L)</div>
                   <div className="text-base font-bold text-cyan-300">{(pendulumLength * 100).toFixed(0)} cm</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1">Period (T)</div>
                   <div className="text-base font-bold text-emerald-400">{theoreticalPeriod} s</div>
                </div>
             </div>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0 font-mono">Harmonics Log</h3>
             <div className="flex-1 space-y-3 font-mono text-[10px] text-white/40 overflow-y-auto pr-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                     <span className="text-cyan-400 shrink-0">[{log.time}]</span>
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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-3 px-4 py-2 rounded-xl bg-black/80 backdrop-blur-xl border border-cyan-500/30 text-center shadow-xl pointer-events-none">
              <div className="text-xs font-bold text-white font-display">{hoveredItem.name}</div>
              <div className="text-[10px] font-mono text-cyan-200/80">{hoveredItem.desc}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3.5 bg-[#080d1e]/80 backdrop-blur-2xl border border-white/15 p-3 rounded-3xl overflow-x-auto max-w-[90vw] pointer-events-auto shadow-2xl shrink-0 mx-8 items-end">
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
                 className="min-w-[100px] h-28 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-white/10 transition-all cursor-pointer group hover:-translate-y-3 hover:border-cyan-400/60 select-none"
              >
                 <div className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-200">{item.icon}</div>
                 <span className="text-[10px] font-mono text-center px-1 text-white/70 group-hover:text-cyan-300 font-medium">{item.name}</span>
              </div>
           ))}
        </div>
      </div>
    </div>
  );
}

function PendulumScene({ getPointer, activeStep, setActiveStep, setCurrentStep, triggerSuccess, triggerMistake, pendulumLength, setPendulumLength, isOscillating, setIsOscillating, setStopwatchRunning, spawnedItems, setSpawnedItems }: any) {
  const { viewport, camera, raycaster } = useThree();
  const draggedItemIdRef = useRef<string | null>(null);
  const hoveredItemIdRef = useRef<string | null>(null);
  const wasActive = useRef(false);
  const targetPosRef = useRef(new THREE.Vector3());
  const pendulumArmRef = useRef<THREE.Group>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isDraggingHangingBob = useRef(false);

  useFrame(({ clock }) => {
    const ptr = getPointer();
    const ndcX = ptr.x * 2 - 1;
    const ndcY = -(ptr.y * 2 - 1);
    const targetX = ndcX * (viewport.width / 2);
    const targetY = ndcY * (viewport.height / 2);
    targetPosRef.current.lerp(new THREE.Vector3(targetX, targetY, 2), 0.35);

    // Oscillation physics
    if (isOscillating && pendulumArmRef.current && !isDraggingHangingBob.current) {
      const omega = Math.sqrt(9.8 / pendulumLength);
      const angle = 0.28 * Math.sin(clock.getElapsedTime() * omega);
      pendulumArmRef.current.rotation.z = angle;
    }

    // Raycast / Proximity Hover detection when not dragging
    if (!draggedItemIdRef.current && !isDraggingHangingBob.current) {
      let foundHover: string | null = null;
      let minHoverDist = 2.4;

      // Check bench items
      spawnedItems.forEach((item: any) => {
        if (item.id === 'Pendulum Stand') return;
        const dist = new THREE.Vector2(targetX, targetY).distanceTo(new THREE.Vector2(item.x, item.y));
        if (dist < minHoverDist) {
          minHoverDist = dist;
          foundHover = item.id;
        }
      });

      // Check hanging bob for step 3 displacement gesture
      if (activeStep === 3 && spawnedItems.some((i: any) => i.id === 'Pendulum Stand')) {
        const bobWorldPos = new THREE.Vector2(0.2, 3.4 - 0.6 - pendulumLength * 2.5);
        const distToBob = new THREE.Vector2(targetX, targetY).distanceTo(bobWorldPos);
        if (distToBob < 2.0) {
          foundHover = 'HangingBob';
        }
      }

      if (foundHover !== hoveredItemIdRef.current) {
        if (foundHover) labAudio.playHoverSound();
        hoveredItemIdRef.current = foundHover;
        setHoveredId(foundHover);
      }
    }

    const grabbed = ptr.active && !wasActive.current;
    const released = !ptr.active && wasActive.current;

    // Grab transition
    if (grabbed) {
      if (hoveredItemIdRef.current === 'HangingBob' || activeStep === 3) {
        const stand = spawnedItems.find((i: any) => i.id === 'Pendulum Stand');
        if (stand) {
          isDraggingHangingBob.current = true;
          labAudio.playGrabSound();
        }
      }

      if (hoveredItemIdRef.current && hoveredItemIdRef.current !== 'HangingBob') {
        const grabId = hoveredItemIdRef.current;
        draggedItemIdRef.current = grabId;
        labAudio.playGrabSound();
        setSpawnedItems((prev: any) => prev.map((i: any) => i.id === grabId ? { ...i, isDragging: true } : i));
      }
    }

    // Dragging hanging bob to displace
    if (ptr.active && isDraggingHangingBob.current && pendulumArmRef.current) {
      const clampPivotX = 0.2;
      const dx = targetPosRef.current.x - clampPivotX;
      const angle = Math.max(-0.45, Math.min(0.45, -dx * 0.25));
      pendulumArmRef.current.rotation.z = angle;
    }

    // Dragging regular bench items (lerped follow)
    if (ptr.active && draggedItemIdRef.current) {
      setSpawnedItems((prev: any) => prev.map((i: any) => i.id === draggedItemIdRef.current ? { ...i, x: targetPosRef.current.x, y: targetPosRef.current.y } : i));
    }

    // Release transition
    if (released) {
      if (isDraggingHangingBob.current) {
        isDraggingHangingBob.current = false;
        setIsOscillating(true);
        labAudio.playReleaseSound();
        triggerSuccess("Displaced bob released! Simple harmonic oscillation initiated.");
        setActiveStep(4);
        setCurrentStep(4);
      }

      if (draggedItemIdRef.current) {
        const itemId = draggedItemIdRef.current;
        setSpawnedItems((prev: any) => {
          const item = prev.find((i: any) => i.id === itemId);
          if (!item) return prev;

          const stand = prev.find((i: any) => i.id === 'Pendulum Stand');
          if (stand) {
            const distToStand = new THREE.Vector2(item.x, item.y).distanceTo(new THREE.Vector2(stand.x, stand.y + 1));
            if (distToStand < 3.2) {
              const expected = EXPERIMENT_STEPS[activeStep - 1];
              if (expected && expected.expectedTool === item.id) {
                labAudio.playPourEffect();

                if (item.id === 'Bob (50cm)') {
                  setPendulumLength(0.5);
                  triggerSuccess("50cm String & Brass Bob attached to clamp.");
                } else if (item.id === 'Stopwatch') {
                  setStopwatchRunning(true);
                  triggerSuccess("Stopwatch running! 10 Oscillations = 14.2s (Period T = 1.42s).");
                } else if (item.id === 'Bob (80cm)') {
                  setPendulumLength(0.8);
                  triggerSuccess("Changed length to 80cm! Measured Period T = 1.80s. Relationship T ∝ √L verified!");
                }

                const nextStep = activeStep + 1;
                setActiveStep(nextStep);
                setCurrentStep(nextStep);
                draggedItemIdRef.current = null;
                hoveredItemIdRef.current = null;
                setHoveredId(null);
                return prev.filter((i: any) => i.id !== item.id);
              } else {
                triggerMistake(`Invalid tool for Step ${activeStep}! Needed: ${expected?.expectedTool}`);
              }
            }
          }
          labAudio.playReleaseSound();
          return prev.map((i: any) => i.id === item.id ? { ...i, isDragging: false, y: -0.6 } : i);
        });
        draggedItemIdRef.current = null;
      }
    }

    wasActive.current = ptr.active;
  });

  return (
    <>
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[14, 0.4, 4.5]} />
        <meshStandardMaterial color="#121324" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Stand and Pendulum */}
      {spawnedItems.some((i: any) => i.id === 'Pendulum Stand') && (
        <group position={[0, -0.6, 0]}>
          {/* Base */}
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[2, 0.2, 1.5]} />
            <meshStandardMaterial color="#475569" metalness={0.8} />
          </mesh>
          {/* Rod */}
          <mesh position={[-0.8, 1.8, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 3.6, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
          {/* Clamp Arm */}
          <mesh position={[-0.3, 3.4, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 1.2, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>

          {/* Hanging Pendulum Arm */}
          <group ref={pendulumArmRef} position={[0.2, 3.4, 0]}>
            {/* String */}
            <mesh position={[0, -(pendulumLength * 2.5) / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, pendulumLength * 2.5, 8]} />
              <meshStandardMaterial color="#ffffff" emissive="#38bdf8" emissiveIntensity={0.2} />
            </mesh>
            {/* Brass Bob */}
            <mesh position={[0, -(pendulumLength * 2.5), 0]}>
              <sphereGeometry args={[0.32, 24, 24]} />
              <meshStandardMaterial 
                color="#facc15" 
                metalness={0.9} 
                roughness={0.15} 
                emissive={hoveredId === 'HangingBob' ? '#00f2ff' : '#000000'}
                emissiveIntensity={hoveredId === 'HangingBob' ? 0.6 : 0}
              />
            </mesh>
            {/* Invisible large proxy target for easy bob grab */}
            <mesh position={[0, -(pendulumLength * 2.5), 0]} visible={false}>
              <sphereGeometry args={[0.8, 8, 8]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </group>
        </group>
      )}

      {/* Spawned Items with Hover Highlights and Proxies */}
      {spawnedItems.map((item: any) => {
        const isHovered = hoveredId === item.id;
        const scale = item.isDragging ? 1.15 : isHovered ? 1.08 : 1.0;

        return (
          <group 
            key={item.id} 
            position={[item.x, item.y, item.isDragging ? 1.8 : 0]} 
            scale={[scale, scale, scale]}
          >
            {item.type === 'Bob' && (
              <group position={[0, 0.3, 0]}>
                <mesh>
                  <sphereGeometry args={[0.38, 20, 20]} />
                  <meshStandardMaterial 
                    color={item.color} 
                    metalness={0.85} 
                    roughness={0.2}
                    emissive={isHovered ? '#00f2ff' : '#000000'}
                    emissiveIntensity={isHovered ? 0.5 : 0}
                  />
                </mesh>
                {/* Proxy target for easy grabbing */}
                <mesh visible={false}>
                  <sphereGeometry args={[0.9, 8, 8]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
                <Text position={[0, 0.55, 0]} fontSize={0.22} color="#ffffff" anchorX="center" outlineWidth={0.02} outlineColor="#000000">{item.name}</Text>
              </group>
            )}

            {item.type === 'Tool' && (
              <group position={[0, 0.3, 0]}>
                <mesh>
                  <boxGeometry args={[0.9, 1.1, 0.35]} />
                  <meshStandardMaterial 
                    color="#0284c7" 
                    emissive={isHovered ? '#38bdf8' : '#000000'}
                    emissiveIntensity={isHovered ? 0.5 : 0}
                  />
                </mesh>
                {/* Proxy target */}
                <mesh visible={false}>
                  <boxGeometry args={[1.4, 1.6, 0.8]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
                <Text position={[0, 0.1, 0.2]} fontSize={0.18} color="#ffffff" anchorX="center" outlineWidth={0.02} outlineColor="#000000">Stopwatch</Text>
              </group>
            )}
          </group>
        );
      })}
    </>
  );
}
