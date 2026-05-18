import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Text, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';

import { useAppStore } from '../store/useAppStore';
import { useHandTracking } from '../hooks/useHandTracking';
import { usePointerInput } from '../hooks/usePointerInput';
import { cn } from '../utils/cn';

const EXPERIMENT_STEPS = [
  { id: 1, text: "Place the Beaker on the table.", expectedTool: "Beaker" },
  { id: 2, text: "Rinse the Beaker with Distilled Water.", expectedTool: "Distilled Water" },
  { id: 3, text: "Fill the Beaker with 50ml of NaOH (Base).", expectedTool: "NaOH" },
  { id: 4, text: "Add 2 drops of Phenolphthalein Indicator.", expectedTool: "Indicator" },
  { id: 5, text: "Perform Titration using HCl (Acid).", expectedTool: "HCl" }
];

const INVENTORY_ITEMS = [
  { id: 'Beaker', type: 'Beaker', color: '#ffffff', icon: '🥛', name: 'Beaker 250ml' },
  { id: 'Distilled Water', type: 'Bottle', color: '#aaddff', icon: '💧', name: 'Dist. Water' },
  { id: 'NaOH', type: 'Bottle', color: '#4e44ff', icon: '🧪', name: 'NaOH (0.1M)' },
  { id: 'Indicator', type: 'Dropper', color: '#ffffff', icon: '💉', name: 'Phenolphthalein' },
  { id: 'HCl', type: 'Tube', color: '#ff0000', icon: '🧪', name: 'HCl (0.1M)' },
  { id: 'Salt', type: 'Powder', color: '#ffffff', icon: '🧂', name: 'NaCl Salt' },
  { id: 'Filter Paper', type: 'Paper', color: '#ffffff', icon: '📄', name: 'Filter Paper' },
];

export function ChemistryLab() {
  const setView = useAppStore(state => state.setView);
  const addScore = useAppStore(state => state.addScore);
  const score = useAppStore(state => state.score);
  const selectedExperiment = useAppStore(state => state.selectedExperiment);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isReady, cursorRef: handCursorRef } = useHandTracking(videoRef);
  const getPointer = usePointerInput(handCursorRef);

  const [activeStep, setActiveStep] = useState(1);
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'Lab environment initialized.', type: 'info' }
  ]);

  const [spawnedItems, setSpawnedItems] = useState<{id: string, type: string, color: string, name: string, x: number, y: number, isDragging: boolean}[]>([]);
  const spawnedItemsRef = useRef(spawnedItems);
  spawnedItemsRef.current = spawnedItems;

  const [beakerColor, setBeakerColor] = useState('#ffffff');
  const [neutralized, setNeutralized] = useState(false);

  const addLog = (msg: string, type: 'info'|'warn'|'success' = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg, type }]);
  };

  useEffect(() => {
    if (isReady) {
      addLog('Webcam hand tracking sync: 100%', 'success');
    }
  }, [isReady]);

  const spawnItem = (item: {id: string, type: string, color: string, name: string}) => {
      if (spawnedItemsRef.current.some(i => i.id === item.id)) return;
      
      const expected = EXPERIMENT_STEPS[activeStep - 1];
      if (activeStep === 1 && item.id !== 'Beaker') {
          addLog("Place the Beaker on the table first.", "warn");
          return;
      }
      if (expected && expected.expectedTool !== item.id) {
          addLog(`Not the expected tool right now. You need: ${expected.expectedTool}`, "warn");
      }

      if (item.id === 'Beaker') {
         setSpawnedItems(prev => [...prev, { ...item, x: 0, y: -0.5, isDragging: false }]);
         addScore(20);
         addLog("Beaker placed successfully on the table.", "success");
         setActiveStep(2);
      } else {
         const nonBeakerCount = spawnedItemsRef.current.filter(i => i.id !== 'Beaker').length;
         const xPos = -4 + nonBeakerCount * 2;
         setSpawnedItems(prev => [...prev, { ...item, x: xPos, y: -0.5, isDragging: false }]);
         addLog(`Placed ${item.name} on table.`, "info");
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

  // Custom DOM Cursor
  const cursorDOMRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let animationFrameId: number;
    let wasActiveLocal = false;
    const updateCursor = () => {
      const ptr = getPointer();
      if (cursorDOMRef.current) {
        cursorDOMRef.current.style.transform = `translate(${ptr.x * window.innerWidth}px, ${ptr.y * window.innerHeight}px) translate(-50%, -50%) scale(${ptr.active ? 0.7 : 1})`;
        cursorDOMRef.current.style.borderColor = ptr.active ? '#00FF55' : '#00F0FF';
        cursorDOMRef.current.style.backgroundColor = ptr.active ? 'rgba(0, 255, 85, 0.4)' : 'rgba(0, 240, 255, 0.1)';
      }
      
      const grabbed = ptr.active && !wasActiveLocal;
      if (grabbed) {
          const px = ptr.x * window.innerWidth;
          const py = ptr.y * window.innerHeight;
          const el = document.elementFromPoint(px, py);
          const inventoryItem = el?.closest('[data-item-id]');
          if (inventoryItem) {
              const id = inventoryItem.getAttribute('data-item-id')!;
              const type = inventoryItem.getAttribute('data-item-type')!;
              const color = inventoryItem.getAttribute('data-item-color')!;
              const name = inventoryItem.getAttribute('data-item-name')!;
              spawnItemRef.current({ id, type, color, name });
          }
      }
      wasActiveLocal = ptr.active;

      animationFrameId = requestAnimationFrame(updateCursor);
    };
    updateCursor();
    return () => cancelAnimationFrame(animationFrameId);
  }, [getPointer]);

  return (
    <div className="w-full h-screen relative bg-transparent flex flex-col overflow-hidden cursor-none select-none">
      
      {/* Custom Global Cursor */}
      <div 
        ref={cursorDOMRef} 
        className="fixed top-0 left-0 w-8 h-8 rounded-full border-[3px] z-[100] pointer-events-none will-change-transform flex items-center justify-center shadow-[0_0_15px_rgba(0,242,255,0.5)] transition-colors duration-200"
      >
         <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>

      {/* Top Navigation Bar */}
      <nav className="h-16 flex items-center justify-between px-8 bg-white/5 backdrop-blur-xl border-b border-white/10 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-[#4e44ff] to-[#00f2ff] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(78,68,255,0.5)] cursor-pointer hover:scale-105 transition-transform" onClick={() => setView('experiment-selection')}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </div>
          <span className="text-lg font-bold tracking-tight uppercase">V-Lab <span className="text-[#00f2ff] font-light">Pro</span></span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium tracking-wide">
          <span className="text-white border-b-2 border-[#4e44ff] pb-1 px-1">EXPERIMENT ACTIVE</span>
        </div>
        <div className="flex items-center gap-4 bg-white/10 px-4 py-1.5 rounded-full border border-white/10">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isReady ? "bg-green-400 animate-pulse" : "bg-yellow-500")}></div>
            <span className={cn("text-[10px] uppercase font-bold tracking-widest", isReady ? "text-green-400" : "text-yellow-500")}>
              {isReady ? 'Camera Active' : 'Waiting for Camera...'}
            </span>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex p-6 gap-6 relative z-10 min-h-0">
        
        {/* Left Panel: Experiment Guide */}
        <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto hidden md:flex z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 flex flex-col shrink-0 pointer-events-auto shadow-2xl">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#00f2ff] mb-1">Current Module</span>
            <h2 className="text-xl font-bold leading-tight mb-2">Acid-Base Titration</h2>
            <p className="text-xs text-white/50 leading-relaxed">Drag chemicals from your inventory below into the laboratory environment sequentially.</p>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4 flex items-center gap-2 shrink-0">
              <svg className="w-4 h-4 text-[#4e44ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              Procedure Steps
            </h3>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {EXPERIMENT_STEPS.map((step) => {
                const isCompleted = step.id < activeStep;
                const isCurrent = step.id === activeStep;
                return (
                  <div key={step.id} className={cn("flex gap-3 items-start transition-all duration-300", !isCompleted && !isCurrent && "opacity-40", isCurrent && "scale-[1.02]")}>
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                      </div>
                    ) : (
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-shadow", isCurrent ? "bg-[#4e44ff] text-white shadow-[0_0_15px_#4e44ff]" : "bg-white/20 text-white")}>
                        {step.id}
                      </div>
                    )}
                    <span className={cn("text-[11px] leading-relaxed transition-colors", isCompleted ? "text-white/40 line-through" : "text-white/90", isCurrent && "font-bold text-[#00f2ff]")}>{step.text}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#4e44ff]/20 to-transparent backdrop-blur-md rounded-2xl border border-[#4e44ff]/30 p-5 shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">Lab Score</span>
              <span className="text-2xl font-mono font-bold text-[#00f2ff]">{score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#4e44ff] to-[#00f2ff] transition-all duration-1000" style={{ width: `${Math.min(100, score)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Center Panel: 3D Environment */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-transparent pointer-events-none">
          {/* Grid floor reflection */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(78,68,255,0.05)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] pointer-events-none"></div>

          <Canvas camera={{ position: [0, 2, 8], fov: 45 }} style={{ pointerEvents: 'none' }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#00f2ff" />
            <spotLight position={[-10, 10, -10]} intensity={2} color="#4e44ff" />
            <Environment preset="city" />

            <LabScene 
               getPointer={getPointer} 
               addScore={addScore} 
               activeStep={activeStep} 
               setActiveStep={setActiveStep} 
               addLog={addLog}
               beakerColor={beakerColor}
               setBeakerColor={setBeakerColor}
               neutralized={neutralized}
               setNeutralized={setNeutralized}
               spawnedItems={spawnedItems}
               setSpawnedItems={setSpawnedItems}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={30} blur={2} />
          </Canvas>

          {/* Interactive Tooltips Overlay */}
          <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
             <div className="w-3 h-3 bg-[#00f2ff] rounded-full shadow-[0_0_10px_#00f2ff] animate-pulse"></div>
             <span className="text-sm font-medium tracking-wide">
               {activeStep <= 5 ? `Action: ${EXPERIMENT_STEPS[activeStep-1].text}` : "Experiment Complete!"}
             </span>
          </div>

          <video
            ref={videoRef}
            playsInline
            className="absolute w-40 h-28 top-8 right-8 object-cover rounded-xl border border-white/20 opacity-40 z-10 scale-x-[-1] shadow-2xl"
            muted
          />
        </div>

        {/* Right Panel: Data and Telemetry */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3">Live Telemetry</h3>
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1">Temperature</div>
                   <div className="text-lg font-mono font-bold text-[#ff44ec]">24.8°C</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="text-[9px] uppercase text-white/40 mb-1">pH Level</div>
                   <div className="text-lg font-mono font-bold text-[#00f2ff] transition-all">
                     {activeStep < 4 ? '7.0' : activeStep === 4 ? '12.5' : '7.0'}
                   </div>
                </div>
             </div>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0">Experiment Log</h3>
             <div className="flex-1 space-y-3 font-mono text-[10px] text-white/40 overflow-y-auto pr-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                     <span className="text-[#00f2ff] shrink-0">[{log.time}]</span>
                     <span className={cn(log.type === 'warn' ? "text-[#ff44ec] font-bold" : log.type === 'success' ? "text-green-400 font-bold" : "text-white/80")}>
                       {log.msg}
                     </span>
                  </div>
                ))}
                <div className="w-full h-px bg-white/10 my-4"></div>
             </div>
          </div>
        </div>

      </main>

      {/* Inventory Hotbar (Minecraft Style) */}
      <div className="absolute bottom-6 w-full flex justify-center z-30 pointer-events-none">
        <div className="flex gap-4 bg-[#0a0a14]/60 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl overflow-x-auto max-w-[90vw] pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.8)] scrollbar-hide shrink-0 mx-8 items-end">
           {INVENTORY_ITEMS.map((item) => (
              <div 
                 key={item.id}
                 data-item-id={item.id}
                 data-item-type={item.type}
                 data-item-color={item.color}
                 data-item-name={item.name}
                 onClick={handleInventoryClick}
                 className="min-w-[110px] h-32 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all cursor-pointer group hover:-translate-y-4 hover:border-[#00f2ff]/50 hover:shadow-[0_10px_20px_rgba(0,242,255,0.2)]"
              >
                 <div className="text-4xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                 <span className="text-[10px] font-mono text-center px-1 text-white/60 group-hover:text-[#00f2ff] font-medium">{item.name}</span>
              </div>
           ))}
        </div>
      </div>
    </div>
  );
}

function LabScene({ getPointer, activeStep, setActiveStep, addLog, addScore, beakerColor, setBeakerColor, neutralized, setNeutralized, spawnedItems, setSpawnedItems }: any) {
  const { viewport } = useThree();
  const draggedItemIdRef = useRef<string | null>(null);
  const wasActive = useRef(false);
  const targetPosRef = useRef(new THREE.Vector3());
  const [particles, setParticles] = useState<number[]>([]);

  useFrame(() => {
    const ptr = getPointer();
    const px = ptr.x * window.innerWidth;
    const py = ptr.y * window.innerHeight;
    
    // Smooth target coordinates based on pointer
    const targetX = (ptr.x * 2 - 1) * (viewport.width / 2);
    const targetY = -(ptr.y * 2 - 1) * (viewport.height / 2);
    targetPosRef.current.lerp(new THREE.Vector3(targetX, targetY, 2), 0.4);

    const grabbed = ptr.active && !wasActive.current;
    const released = !ptr.active && wasActive.current;

    // Pick up items from the table
    if (grabbed) {
        const el = document.elementFromPoint(px, py);
        if (!el?.closest('[data-item-id]')) { // only grab 3D items if not clicking inventory
             let closest: any = null;
             let minDist = 3; 
             spawnedItems.forEach((item: any) => {
                 if (item.id === 'Beaker') return; // Beaker stays fixed once placed
                 const dist = new THREE.Vector2(targetX, targetY).distanceTo(new THREE.Vector2(item.x, item.y));
                 if (dist < minDist) {
                     minDist = dist;
                     closest = item;
                 }
             });
             
             if (closest) {
                 draggedItemIdRef.current = closest.id;
                 setSpawnedItems((prev: any) => prev.map((i: any) => i.id === closest.id ? { ...i, isDragging: true } : i));
             }
        }
    }

    // Dragging
    if (ptr.active && draggedItemIdRef.current) {
         setSpawnedItems((prev: any) => prev.map((i: any) => i.id === draggedItemIdRef.current ? { ...i, x: targetPosRef.current.x, y: targetPosRef.current.y } : i));
    }

    // Drop and React
    if (released && draggedItemIdRef.current) {
         const itemId = draggedItemIdRef.current;
         // Pass previous state to accurately find item and reset
         setSpawnedItems((prev: any) => {
             const item = prev.find((i: any) => i.id === itemId);
             if (!item) return prev;

             const beaker = prev.find((i: any) => i.id === 'Beaker');
             if (beaker) {
                 const distToBeaker = new THREE.Vector2(item.x, item.y).distanceTo(new THREE.Vector2(beaker.x, beaker.y + 2));
                 if (distToBeaker < 3) {
                     const expected = EXPERIMENT_STEPS[activeStep - 1];
                     if (expected && expected.expectedTool === item.id) {
                         addScore(20);
                         addLog(`Successfully added ${item.name}.`, "success");
                         
                         if (item.id === 'NaOH') setBeakerColor('#4e44ff');
                         if (item.id === 'HCl') {
                             setBeakerColor('#ff44ec');
                             setNeutralized(true);
                             addLog("Experiment Complete!", "success");
                             setParticles(Array.from({length: 20}).map(() => Math.random()));
                         }
                         
                         setActiveStep((s: number) => s + 1);
                         
                         // Remove used item
                         draggedItemIdRef.current = null;
                         return prev.filter((i: any) => i.id !== item.id);
                     } else {
                         addLog(`Wrong interaction! You need: ${expected?.expectedTool || 'None'}`, "warn");
                     }
                 }
             }
             
             // Snap back to table if not used or missed
             return prev.map((i: any) => i.id === item.id ? { ...i, isDragging: false, y: -0.5 } : i);
         });
         
         draggedItemIdRef.current = null;
    }

    wasActive.current = ptr.active;
  });

  return (
    <>
      <Table />
      {spawnedItems.map((item: any) => (
         <SpawnedItemRenderer 
             key={item.id}
             item={item}
             beakerColor={item.id === 'Beaker' ? beakerColor : undefined}
             neutralized={item.id === 'Beaker' ? neutralized : undefined}
             particles={item.id === 'Beaker' ? particles : undefined}
         />
      ))}
    </>
  );
}

function SpawnedItemRenderer({ item, beakerColor, neutralized, particles }: any) {
    const groupRef = useRef<THREE.Group>(null);
    
    useFrame(() => {
        if (groupRef.current) {
            const targetPos = new THREE.Vector3(item.x, item.y, item.isDragging ? 2 : 0);
            groupRef.current.position.lerp(targetPos, 0.3);
            
            if (item.isDragging) {
                groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, -Math.PI / 8, 0.2);
            } else {
                groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.2);
            }
        }
    });

    return (
        <group ref={groupRef}>
             {item.type === 'Beaker' && (
                 <Float speed={2} rotationIntensity={0.05} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                    <Beaker color={beakerColor!} />
                    {neutralized && <Text position={[0, 3, 0]} fontSize={0.6} color="#ff44ec" anchorX="center" anchorY="middle" outlineWidth={0.02}>Neutralized!</Text>}
                    {particles && particles.map((p: number, i: number) => (
                       <Bubble key={i} delay={p} active={neutralized!} />
                    ))}
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

function Table() {
  return (
    <mesh position={[0, -2, 0]}>
      <boxGeometry args={[12, 0.5, 4]} />
      <meshStandardMaterial color="#1a1a2e" roughness={0.5} metalness={0.2} />
    </mesh>
  );
}

function Beaker({ color }: { color: string }) {
  return (
    <group position={[0, -1, 0]}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 1.4, 32]} />
        <meshPhysicalMaterial color={color} transmission={0.8} opacity={0.9} transparent roughness={0} ior={1.4} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[1, 1, 2.5, 32]} />
        <meshPhysicalMaterial color="#ffffff" transmission={1} thickness={0.1} roughness={0.05} ior={1.5} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Bottle({ color }: { color: string }) {
  return (
    <group position={[0, -1, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 1.2, 32]} />
        <meshPhysicalMaterial color="#ffffff" transmission={1} roughness={0.1} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 1.0, 32]} />
        <meshPhysicalMaterial color={color} transmission={0.5} roughness={0.2} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.2, 0.6, 0.4, 32]} />
        <meshPhysicalMaterial color="#ffffff" transmission={1} roughness={0.1} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.4, 32]} />
        <meshPhysicalMaterial color="#ffffff" transmission={1} roughness={0.1} transparent opacity={0.4} />
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
          <meshPhysicalMaterial color="#ffffff" transmission={1} transparent opacity={0.4} />
       </mesh>
    </group>
  )
}

function TestTube({ color }: { color: string }) {
  return (
    <group position={[0, -1, 0]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 1.5, 16]} />
        <meshPhysicalMaterial color={color} transmission={0.6} opacity={0.9} transparent roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 2.5, 16]} />
        <meshPhysicalMaterial color="#ffffff" transmission={1} roughness={0.1} transparent opacity={0.3} side={THREE.DoubleSide} />
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
