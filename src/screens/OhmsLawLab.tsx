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
  { id: 1, text: "Place the Circuit Breadboard on the bench.", expectedTool: "Breadboard" },
  { id: 2, text: "Connect the 10Ω Standard Resistor across the terminals.", expectedTool: "10Ω Resistor" },
  { id: 3, text: "Connect the DC Battery Power Supply (6V).", expectedTool: "Battery 6V" },
  { id: 4, text: "Close the Key Switch to complete the electrical circuit.", expectedTool: "Key Switch" },
  { id: 5, text: "Adjust Rheostat & observe Voltage (V) and Current (I) on meters.", expectedTool: "Rheostat" }
];

const INVENTORY_ITEMS = [
  { id: 'Breadboard', type: 'Board', color: '#0f172a', icon: '🎛️', name: 'Circuit Board', desc: 'Integrated circuit testing board with ammeter & voltmeter' },
  { id: '10Ω Resistor', type: 'Resistor', color: '#eab308', icon: '⚡', name: '10Ω Resistor', desc: 'Fixed standard carbon film resistance element' },
  { id: 'Battery 6V', type: 'Battery', color: '#ef4444', icon: '🔋', name: 'Battery (6V)', desc: 'DC voltage source providing electromotive force' },
  { id: 'Key Switch', type: 'Switch', color: '#10b981', icon: '🔘', name: 'Plug Key', desc: 'One-way circuit closing contact key' },
  { id: 'Rheostat', type: 'Rheostat', color: '#06b6d4', icon: '🎚️', name: 'Rheostat', desc: 'Variable wire-wound slider resistor' },
];

export function OhmsLawLab() {
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

  // Electrical Telemetry
  const [circuitClosed, setCircuitClosed] = useState(false);
  const [voltage, setVoltage] = useState(0.0);
  const [current, setCurrent] = useState(0.0);
  const [resistance] = useState(10.0);

  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Ohm's Law Verification Bench Loaded.", type: 'info' }
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

    if (activeStep === 1 && item.id !== 'Breadboard') {
      triggerMistake("Place the Circuit Board on the bench first.");
      return;
    }

    if (item.id === 'Breadboard') {
      setSpawnedItems(prev => [...prev, { ...item, x: 0, y: -0.6, isDragging: false }]);
      triggerSuccess("Circuit board placed with integrated meters.");
      setActiveStep(2);
      setCurrentStep(2);
    } else {
      labAudio.playGrabSound();
      const count = spawnedItemsRef.current.filter(i => i.id !== 'Breadboard').length;
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
        title="Verification of Ohm's Law (V = IR)"
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
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-cyan-400 mb-1">Current & Resistance</span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Ohm's Law Circuit</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Measure potential difference across the resistor and circuit current to verify linearity (V ∝ I).
            </p>
          </motion.div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4 font-mono">
              <span>📋</span> Circuit Procedure
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
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 font-mono">Circuit XP</span>
              <span className="text-2xl font-mono font-bold text-cyan-300">{score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-700" style={{ width: `${Math.min(100, score)}%` }} />
            </div>
          </div>
        </div>

        {/* Center 3D Scene */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-transparent pointer-events-none">
          <Canvas camera={{ position: [0, 2, 7.5], fov: 45 }} style={{ pointerEvents: 'none' }}>
            <ambientLight intensity={0.6} />
            <pointLight position={[6, 8, 6]} intensity={1.5} color="#00f2ff" />
            <pointLight position={[-6, 6, -3]} intensity={1.2} color="#0066ff" />

            <OhmsScene 
              getPointer={getPointer}
              activeStep={activeStep}
              setActiveStep={setActiveStep}
              setCurrentStep={setCurrentStep}
              triggerSuccess={triggerSuccess}
              triggerMistake={triggerMistake}
              circuitClosed={circuitClosed}
              setCircuitClosed={setCircuitClosed}
              setVoltage={setVoltage}
              setCurrent={setCurrent}
              spawnedItems={spawnedItems}
              setSpawnedItems={setSpawnedItems}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={25} blur={2} />
          </Canvas>

          {/* Action indicator */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none">
            <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", circuitClosed ? "bg-emerald-400 shadow-[0_0_10px_#10b981]" : "bg-amber-400")} />
            <span className="text-xs font-mono font-medium text-white/90">
              {activeStep <= 5 ? `Step ${activeStep}: ${EXPERIMENT_STEPS[activeStep-1].text}` : "Ohm's Law (V = IR) Successfully Verified!"}
            </span>
          </div>

          <video ref={videoRef} playsInline muted className="absolute w-36 h-28 top-20 right-6 object-cover rounded-2xl border border-white/20 opacity-40 z-10 scale-x-[-1] pointer-events-none" />
        </div>

        {/* Right Telemetry */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3 font-mono">Multimeter Gauges</h3>
             <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">Voltmeter (V)</div>
                   <div className="text-lg font-mono font-bold text-cyan-300">{voltage.toFixed(2)} V</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">Ammeter (I)</div>
                   <div className="text-lg font-mono font-bold text-emerald-400">{current.toFixed(2)} A</div>
                </div>
             </div>
             <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-center font-mono">
                <div className="text-[10px] uppercase text-cyan-300 font-bold mb-1">Calculated R = V / I</div>
                <div className="text-lg font-bold text-white">{current > 0 ? `${(voltage / current).toFixed(1)} Ω` : 'Open Circuit'}</div>
             </div>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0 font-mono">Circuit Telemetry</h3>
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

function OhmsScene({ getPointer, activeStep, setActiveStep, setCurrentStep, triggerSuccess, triggerMistake, setCircuitClosed, setVoltage, setCurrent, spawnedItems, setSpawnedItems }: any) {
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
        if (item.id === 'Breadboard') return;
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

        const board = prev.find((i: any) => i.id === 'Breadboard');
        if (board) {
          const distToBoard = new THREE.Vector2(item.x, item.y).distanceTo(new THREE.Vector2(board.x, board.y + 1));
          if (distToBoard < 3) {
            const expected = EXPERIMENT_STEPS[activeStep - 1];
            if (expected && expected.expectedTool === item.id) {
              labAudio.playPourEffect();

              if (item.id === '10Ω Resistor') {
                triggerSuccess("10Ω Resistor snapped onto breadboard terminals.");
              } else if (item.id === 'Battery 6V') {
                triggerSuccess("6V DC Power Supply wired to circuit.");
              } else if (item.id === 'Key Switch') {
                setCircuitClosed(true);
                setVoltage(6.0);
                setCurrent(0.6);
                triggerSuccess("Plug key inserted! Current flowing: I = V/R = 6.0V / 10Ω = 0.60 A.");
              } else if (item.id === 'Rheostat') {
                setVoltage(4.0);
                setCurrent(0.4);
                triggerSuccess("Rheostat adjusted: V = 4.0V, I = 0.4A. Linear slope V/I = 10Ω confirmed!");
              }

              const nextStep = activeStep + 1;
              setActiveStep(nextStep);
              setCurrentStep(nextStep);
              draggedItemIdRef.current = null;
              return prev.filter((i: any) => i.id !== item.id);
            } else {
              triggerMistake(`Incorrect component order! Needed: ${expected?.expectedTool}`);
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
          {item.type === 'Board' && (
            <group position={[0, 0, 0]}>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[6, 0.3, 3.5]} />
                <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
              </mesh>
              {/* Meters */}
              <group position={[-1.8, 0.4, -0.6]}>
                <mesh>
                  <cylinderGeometry args={[0.5, 0.5, 0.3, 24]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                <Text position={[0, 0.2, 0]} fontSize={0.2} color="#00f2ff" anchorX="center">V (Volt)</Text>
              </group>
              <group position={[1.8, 0.4, -0.6]}>
                <mesh>
                  <cylinderGeometry args={[0.5, 0.5, 0.3, 24]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                <Text position={[0, 0.2, 0]} fontSize={0.2} color="#10b981" anchorX="center">A (Amp)</Text>
              </group>
            </group>
          )}

          {item.type === 'Resistor' && (
            <group position={[0, 0.3, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.15, 0.15, 1.2, 16]} />
                <meshStandardMaterial color="#ca8a04" />
              </mesh>
              <Text position={[0, 0.4, 0]} fontSize={0.18} color="#ffffff" anchorX="center">10Ω</Text>
            </group>
          )}

          {item.type === 'Battery' && (
            <group position={[0, 0.4, 0]}>
              <mesh>
                <boxGeometry args={[1.2, 0.8, 0.8]} />
                <meshStandardMaterial color="#dc2626" />
              </mesh>
              <Text position={[0, 0.1, 0.42]} fontSize={0.2} color="#ffffff" anchorX="center">6V DC</Text>
            </group>
          )}

          {item.type === 'Switch' && (
            <group position={[0, 0.3, 0]}>
              <mesh>
                <boxGeometry args={[0.8, 0.3, 0.8]} />
                <meshStandardMaterial color="#15803d" />
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.4, 12]} />
                <meshStandardMaterial color="#ffffff" metalness={0.9} />
              </mesh>
            </group>
          )}

          {item.type === 'Rheostat' && (
            <group position={[0, 0.4, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.3, 0.3, 1.6, 16]} />
                <meshStandardMaterial color="#0284c7" metalness={0.8} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </>
  );
}
