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
  { id: 1, text: "Place the Tripod Stand & Burner on the bench.", expectedTool: "Tripod Burner" },
  { id: 2, text: "Add 50ml Distilled Water into the evaporating dish.", expectedTool: "Distilled Water" },
  { id: 3, text: "Dissolve Copper Sulphate (CuSO4) powder until saturated.", expectedTool: "CuSO4 Powder" },
  { id: 4, text: "Heat solution to crystallization point.", expectedTool: "Stirrer" },
  { id: 5, text: "Allow undisturbed cooling to precipitate blue crystals.", expectedTool: "Cooling Dish" }
];

const INVENTORY_ITEMS = [
  { id: 'Tripod Burner', type: 'Apparatus', color: '#666', icon: '🔥', name: 'Tripod & Burner', desc: 'Heating assembly with wire gauze' },
  { id: 'Distilled Water', type: 'Bottle', color: '#aaddff', icon: '💧', name: 'Dist. Water', desc: 'Pure water solvent' },
  { id: 'CuSO4 Powder', type: 'Powder', color: '#2563eb', icon: '🧪', name: 'CuSO4 Powder', desc: 'Copper Sulphate pentahydrate powder' },
  { id: 'Stirrer', type: 'Rod', color: '#ffffff', icon: '🪄', name: 'Glass Stirrer', desc: 'Used for continuous uniform dissolution' },
  { id: 'Cooling Dish', type: 'Dish', color: '#60a5fa', icon: '❄️', name: 'China Dish', desc: 'Porcelain dish for slow undisturbed crystallization' },
];

export function CrystallizationLab() {
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
  const [crystalsFormed, setCrystalsFormed] = useState(false);
  const [solutionTemp, setSolutionTemp] = useState(25);

  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'Crystallization Laboratory Initialized.', type: 'info' }
  ]);

  const [spawnedItems, setSpawnedItems] = useState<{id: string, type: string, color: string, name: string, x: number, y: number, isDragging: boolean}[]>([
    { id: 'Tripod Burner', type: 'Apparatus', color: '#666', name: 'Tripod & Burner', x: 0, y: -0.6, isDragging: false }
  ]);
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
    const count = spawnedItemsRef.current.filter(i => i.id !== 'Tripod Burner').length;
    const xPos = -4 + (count % 4) * 2;
    setSpawnedItems(prev => [...prev, { ...item, x: xPos, y: -0.6, isDragging: false }]);
    addLog(`Placed ${item.name} on bench. Drag into the dish on the tripod!`, "info");
  };

  const spawnItemRef = useRef(spawnItem);
  spawnItemRef.current = spawnItem;

  // Gesture hotbar click detection
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
    <div className="w-full h-screen relative bg-gradient-to-b from-[#05060f] via-[#090a1a] to-[#04050d] flex flex-col overflow-hidden cursor-none select-none">
      <GestureCursor getPointer={getPointer} />
      <GestureTutorial />
      <AIMentorPanel />

      <LabTopBar
        title="Preparation of Pure Copper Sulphate Crystals"
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
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#c084fc] mb-1">Purification Process</span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Crystallization</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Dissolve CuSO4, heat to saturation point, then allow slow undisturbed cooling to form pure triclinic crystals.
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
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 font-mono">Score</span>
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
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 5]} intensity={1.2} />
            <pointLight position={[6, 8, 6]} intensity={1.5} color="#60a5fa" />
            <pointLight position={[-6, 6, -3]} intensity={1.2} color="#4e44ff" />

            <CrystallizationScene 
              getPointer={getPointer}
              activeStep={activeStep}
              setActiveStep={setActiveStep}
              setCurrentStep={setCurrentStep}
              triggerSuccess={triggerSuccess}
              triggerMistake={triggerMistake}
              crystalsFormed={crystalsFormed}
              setCrystalsFormed={setCrystalsFormed}
              solutionTemp={solutionTemp}
              setSolutionTemp={setSolutionTemp}
              spawnedItems={spawnedItems}
              setSpawnedItems={setSpawnedItems}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={25} blur={2} />
          </Canvas>

          {/* Action indicator */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_10px_#60a5fa]" />
            <span className="text-xs font-mono font-medium text-white/90">
              {activeStep <= 5 ? `Step ${activeStep}: ${EXPERIMENT_STEPS[activeStep-1].text}` : "Pure CuSO4 Crystals Synthesized!"}
            </span>
          </div>

          <video ref={videoRef} playsInline muted className="absolute w-36 h-28 top-20 right-6 object-cover rounded-2xl border border-white/20 opacity-40 z-10 scale-x-[-1] pointer-events-none" />
        </div>

        {/* Right Telemetry */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3 font-mono">Thermodynamics</h3>
             <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">Temperature</div>
                   <div className="text-base font-mono font-bold text-amber-300">{solutionTemp}°C</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">State</div>
                   <div className="text-base font-mono font-bold text-cyan-300">{crystalsFormed ? 'Precipitated' : activeStep >= 4 ? 'Saturated' : 'Dilute'}</div>
                </div>
             </div>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0 font-mono">Thermal Log</h3>
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

function CrystallizationScene({ getPointer, activeStep, setActiveStep, setCurrentStep, triggerSuccess, triggerMistake, crystalsFormed, setCrystalsFormed, solutionTemp, setSolutionTemp, spawnedItems, setSpawnedItems }: any) {
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
      let minDist = 3.0;
      spawnedItems.forEach((item: any) => {
        if (item.id === 'Tripod Burner') return;
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

        const tripod = prev.find((i: any) => i.id === 'Tripod Burner');
        if (tripod) {
          const distToDish = new THREE.Vector2(item.x, item.y).distanceTo(new THREE.Vector2(tripod.x, tripod.y + 1.2));
          if (distToDish < 3.2) {
            const expected = EXPERIMENT_STEPS[activeStep - 1];
            if (expected && expected.expectedTool === item.id) {
              labAudio.playPourEffect();
              
              if (item.id === 'Distilled Water') {
                triggerSuccess("Added 50ml distilled water solvent.");
              } else if (item.id === 'CuSO4 Powder') {
                triggerSuccess("Added Copper Sulphate powder to form deep blue solution.");
              } else if (item.id === 'Stirrer') {
                setSolutionTemp(85);
                triggerSuccess("Heated and stirred solution to saturation point (85°C).");
              } else if (item.id === 'Cooling Dish') {
                setSolutionTemp(22);
                setCrystalsFormed(true);
                triggerSuccess("Pure deep-blue CuSO4.5H2O crystals precipitated!", 30);
              }

              const nextStep = activeStep + 1;
              setActiveStep(nextStep);
              setCurrentStep(nextStep);
              draggedItemIdRef.current = null;
              return prev.filter((i: any) => i.id !== item.id);
            } else {
              triggerMistake(`Incorrect tool! For Step ${activeStep}, you need: ${expected?.expectedTool}`);
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

      {spawnedItems.map((item: any) => (
        <group key={item.id} position={[item.x, item.y, item.isDragging ? 1.5 : 0]}>
          {item.type === 'Apparatus' && (
            <group position={[0, 0, 0]}>
              {/* Tripod legs */}
              <mesh position={[-0.8, 0, 0]} rotation={[0, 0, -0.2]}>
                <cylinderGeometry args={[0.06, 0.06, 2, 16]} />
                <meshStandardMaterial color="#444" metalness={0.8} />
              </mesh>
              <mesh position={[0.8, 0, 0]} rotation={[0, 0, 0.2]}>
                <cylinderGeometry args={[0.06, 0.06, 2, 16]} />
                <meshStandardMaterial color="#444" metalness={0.8} />
              </mesh>
              {/* Gauze Ring */}
              <mesh position={[0, 1, 0]}>
                <cylinderGeometry args={[1.2, 1.2, 0.1, 24]} />
                <meshStandardMaterial color="#222" metalness={0.5} />
              </mesh>
              {/* Evaporating China Dish */}
              <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.9, 0.6, 0.4, 32]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.2} />
              </mesh>
              {/* Solution / Crystals */}
              <mesh position={[0, 1.3, 0]}>
                <cylinderGeometry args={[0.8, 0.5, 0.2, 32]} />
                <meshStandardMaterial color="#2563eb" transparent opacity={0.85} />
              </mesh>
              {crystalsFormed && (
                <group position={[0, 1.4, 0]}>
                  <mesh position={[-0.3, 0.1, 0.2]} rotation={[0.4, 0.5, 0]}>
                    <octahedronGeometry args={[0.2]} />
                    <meshStandardMaterial color="#1d4ed8" roughness={0.1} metalness={0.3} />
                  </mesh>
                  <mesh position={[0.3, 0.1, -0.2]} rotation={[-0.2, 0.3, 0.5]}>
                    <octahedronGeometry args={[0.25]} />
                    <meshStandardMaterial color="#2563eb" roughness={0.1} metalness={0.3} />
                  </mesh>
                  <Text position={[0, 1, 0]} fontSize={0.3} color="#60a5fa" anchorX="center" outlineWidth={0.02}>
                    Pure Crystals Formed!
                  </Text>
                </group>
              )}
            </group>
          )}

          {item.type === 'Bottle' && (
            <group position={[0, 0.3, 0]}>
              <mesh>
                <cylinderGeometry args={[0.5, 0.5, 1.2, 24]} />
                <meshStandardMaterial color="#aaddff" roughness={0.2} transparent opacity={0.8} />
              </mesh>
              <Text position={[0, 0.1, 0.52]} fontSize={0.16} color="#ffffff" anchorX="center">H2O</Text>
            </group>
          )}

          {item.type === 'Powder' && (
            <group position={[0, 0.3, 0]}>
              <mesh>
                <boxGeometry args={[0.8, 0.8, 0.8]} />
                <meshStandardMaterial color="#2563eb" roughness={0.9} />
              </mesh>
              <Text position={[0, 0, 0.42]} fontSize={0.16} color="#ffffff" anchorX="center">CuSO4</Text>
            </group>
          )}

          {item.type === 'Rod' && (
            <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0.2]}>
              <cylinderGeometry args={[0.04, 0.04, 1.8, 16]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
            </mesh>
          )}

          {item.type === 'Dish' && (
            <group position={[0, 0.2, 0]}>
              <mesh>
                <cylinderGeometry args={[0.8, 0.6, 0.3, 24]} />
                <meshStandardMaterial color="#e2e8f0" />
              </mesh>
              <Text position={[0, 0.4, 0]} fontSize={0.18} color="#ffffff" anchorX="center">Cooler</Text>
            </group>
          )}
        </group>
      ))}
    </>
  );
}
