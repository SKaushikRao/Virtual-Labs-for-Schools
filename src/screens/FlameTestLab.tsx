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
import { WebcamVisionOverlay } from '../components/camera/WebcamVisionOverlay';
import { LayeredFlame, EMASmoother } from '../components/fluids/FluidSystem';

const EXPERIMENT_STEPS = [
  { id: 1, text: 'Place the Bunsen Burner on the bench and ignite it.', expectedTool: 'Burner' },
  { id: 2, text: 'Clean the Platinum Wire Loop in Conc. HCl.', expectedTool: 'HCl Cleaner' },
  { id: 3, text: 'Dip the loop into Sodium Salt (NaCl) and hold in flame.', expectedTool: 'NaCl Dish' },
  { id: 4, text: 'Clean loop in HCl and test Copper Salt (CuCl2) in flame.', expectedTool: 'CuCl2 Dish' },
  { id: 5, text: 'Clean loop in HCl and test Potassium Salt (KCl) in flame.', expectedTool: 'KCl Dish' },
];

const INVENTORY_ITEMS = [
  { id: 'Burner', type: 'Burner', color: '#00f2ff', icon: '🔥', name: 'Bunsen Burner', desc: 'Gas burner providing high-temperature flame' },
  { id: 'Wire Loop', type: 'Loop', color: '#cbd5e1', icon: '🪄', name: 'Platinum Wire Loop', desc: 'Inert loop for sampling metal salts' },
  { id: 'HCl Cleaner', type: 'Bottle', color: '#0099ff', icon: '🧪', name: 'Conc. HCl Wash', desc: 'Cleanses platinum wire loop between tests' },
  { id: 'NaCl Dish', type: 'Dish', color: '#ffb700', icon: '🟡', name: 'NaCl (Sodium)', desc: 'Produces intense golden-yellow flame (589nm)' },
  { id: 'CuCl2 Dish', type: 'Dish', color: '#00ffc8', icon: '🟢', name: 'CuCl2 (Copper)', desc: 'Produces vivid blue-green flame (510nm)' },
  { id: 'KCl Dish', type: 'Dish', color: '#d8b4fe', icon: '🟣', name: 'KCl (Potassium)', desc: 'Produces delicate lilac violet flame (766nm)' },
];

export function FlameTestLab() {
  const addScore = useAppStore((state) => state.addScore);
  const score = useAppStore((state) => state.score);
  const setCurrentStep = useAppStore((state) => state.setCurrentStep);
  const setTotalSteps = useAppStore((state) => state.setTotalSteps);
  const setRecentMistake = useAppStore((state) => state.setRecentMistake);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isReady, cursorRef, handsRef, lastGesture } = useHandTracking(videoRef);
  const getPointer = usePointerInput(cursorRef);

  const [activeStep, setActiveStep] = useState(1);
  const [canvasKey, setCanvasKey] = useState(0);
  const [mistakeShaking, setMistakeShaking] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<typeof INVENTORY_ITEMS[0] | null>(null);
  const [flameColor, setFlameColor] = useState<string>('#0099ff');
  const [flameLit, setFlameLit] = useState(true);
  const [metalName, setMetalName] = useState<string | null>(null);

  const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'warn' | 'success' }[]>([
    {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      msg: 'Flame Test Laboratory Initialized.',
      type: 'info',
    },
  ]);

  const [spawnedItems, setSpawnedItems] = useState<
    { id: string; type: string; color: string; name: string; x: number; y: number; isDragging: boolean; dippedSample?: string }[]
  >([
    { id: 'Burner', type: 'Burner', color: '#00f2ff', name: 'Bunsen Burner', x: 0, y: -0.6, isDragging: false },
    { id: 'Wire Loop', type: 'Loop', color: '#cbd5e1', name: 'Platinum Wire Loop', x: -3.5, y: -0.6, isDragging: false },
  ]);
  const spawnedItemsRef = useRef(spawnedItems);
  spawnedItemsRef.current = spawnedItems;

  useEffect(() => {
    setTotalSteps(EXPERIMENT_STEPS.length);
    setCurrentStep(1);
  }, [setTotalSteps, setCurrentStep]);

  const addLog = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setLogs((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg, type },
    ]);
  };

  const triggerMistake = (msg: string) => {
    labAudio.playErrorBuzz();
    setRecentMistake(msg);
    setMistakeShaking(true);
    setTimeout(() => setMistakeShaking(false), 500);
    addLog(msg, 'warn');
  };

  const triggerSuccess = (msg: string, points = 20) => {
    labAudio.playSuccessChime();
    addScore(points);
    setRecentMistake(null);
    addLog(msg, 'success');
  };

  const spawnItem = (item: { id: string; type: string; color: string; name: string }) => {
    if (spawnedItemsRef.current.some((i) => i.id === item.id)) return;

    labAudio.playGrabSound();
    const count = spawnedItemsRef.current.filter((i) => i.id !== 'Burner').length;
    const xPos = -4 + (count % 4) * 2.1;
    setSpawnedItems((prev) => [...prev, { ...item, x: xPos, y: -0.6, isDragging: false }]);
    addLog(`Placed ${item.name} on bench. Dip platinum loop and bring to the flame!`, 'info');
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
        title="Flame Test for Metal Ions"
        subject="Chemistry"
        currentStep={activeStep}
        totalSteps={5}
        isReady={isReady}
      />

      <main className="flex-1 flex p-6 gap-6 relative z-10 min-h-0">
        {/* Left Guide Panel */}
        <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto hidden md:flex z-20 pointer-events-none">
          <motion.div
            animate={mistakeShaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            className={cn(
              'bg-white/5 backdrop-blur-md rounded-2xl border p-5 flex flex-col shrink-0 pointer-events-auto shadow-2xl transition-all',
              mistakeShaking ? 'border-red-500/80 bg-red-500/10' : 'border-white/10'
            )}
          >
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#c084fc] mb-1">
              Metal Ion Identification
            </span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Flame Emission Spectra</h2>
            <p className="text-xs text-white/60 leading-relaxed">
              Dip the Platinum Wire Loop into the salt dish or drag metal salt dishes to the Bunsen burner flame to observe spectral emission colors.
            </p>
          </motion.div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4 font-mono flex items-center gap-1.5">
              <span>📋</span> Procedure Steps
            </h3>
            <div className="space-y-3.5 overflow-y-auto flex-1 pr-2">
              {EXPERIMENT_STEPS.map((step) => {
                const isCompleted = step.id < activeStep;
                const isCurrent = step.id === activeStep;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex gap-3 items-start transition-all duration-300',
                      !isCompleted && !isCurrent && 'opacity-40',
                      isCurrent && 'scale-[1.02]'
                    )}
                  >
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        <svg
                          className="w-3 h-3 text-emerald-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold font-mono',
                          isCurrent
                            ? 'bg-[#4e44ff] text-white shadow-[0_0_15px_#4e44ff]'
                            : 'bg-white/20 text-white'
                        )}
                      >
                        {step.id}
                      </div>
                    )}
                    <span
                      className={cn(
                        'text-[11px] leading-relaxed transition-colors',
                        isCompleted ? 'text-white/40 line-through' : 'text-white/90',
                        isCurrent && 'font-bold text-[#c084fc]'
                      )}
                    >
                      {step.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#4e44ff]/20 to-transparent backdrop-blur-md rounded-2xl border border-[#4e44ff]/30 p-5 shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 font-mono">
                Total Score
              </span>
              <span className="text-2xl font-mono font-bold text-[#c084fc]">{score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#4e44ff] to-[#ff44ec] transition-all duration-700"
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center 3D Scene */}
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
              domEl.addEventListener(
                'webglcontextlost',
                (e) => {
                  e.preventDefault();
                  console.warn('WebGL Context Lost. Remounting canvas to auto-recover...');
                  setTimeout(() => setCanvasKey((k) => k + 1), 60);
                },
                false
              );
            }}
            style={{ background: '#05060f', width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <color attach="background" args={['#05060f']} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 5]} intensity={1.4} />
            <pointLight position={[6, 8, 6]} intensity={1.6} color={flameColor} />
            <pointLight position={[-6, 6, -3]} intensity={1.2} color="#4e44ff" />

            <FlameScene
              getPointer={getPointer}
              activeStep={activeStep}
              setActiveStep={setActiveStep}
              setCurrentStep={setCurrentStep}
              triggerSuccess={triggerSuccess}
              triggerMistake={triggerMistake}
              flameLit={flameLit}
              flameColor={flameColor}
              setFlameColor={setFlameColor}
              setMetalName={setMetalName}
              metalName={metalName}
              spawnedItems={spawnedItems}
              setSpawnedItems={setSpawnedItems}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.45} scale={25} blur={2.2} />
          </Canvas>

          {/* Action indicator */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/65 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none shadow-2xl">
            <div
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: flameColor, boxShadow: `0 0 14px ${flameColor}` }}
            />
            <span className="text-xs font-mono font-medium text-white/95">
              {activeStep <= 5
                ? `Step ${activeStep}: ${EXPERIMENT_STEPS[activeStep - 1].text}`
                : 'All Metal Ions Successfully Identified!'}
            </span>
          </div>
        </div>

        {/* Right Telemetry */}
        <div className="w-80 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <WebcamVisionOverlay
            videoRef={videoRef}
            isReady={isReady}
            handsRef={handsRef}
            lastGesture={lastGesture}
          />

          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3 font-mono">
              Flame Spectrometry
            </h3>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 mb-3 flex items-center justify-between">
              <div>
                <div className="text-[9px] uppercase text-white/40 font-mono">Emission Spectrum</div>
                <div className="text-sm font-mono font-bold" style={{ color: flameColor }}>
                  {flameColor === '#ffb700'
                    ? 'Golden Yellow (Na⁺ 589nm)'
                    : flameColor === '#00ffc8'
                    ? 'Bluish-Green (Cu²⁺ 510nm)'
                    : flameColor === '#d8b4fe'
                    ? 'Lilac Violet (K⁺ 766nm)'
                    : 'Base Oxidizing Blue Flame'}
                </div>
              </div>
              <div
                className="w-7 h-7 rounded-full border border-white/30"
                style={{ backgroundColor: flameColor, boxShadow: `0 0 18px ${flameColor}` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">Flame Temp</div>
                <div className="text-base font-mono font-bold text-amber-300">
                  {flameLit ? '1450°C' : '25°C'}
                </div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="text-[9px] uppercase text-white/40 mb-1 font-mono">Excited Ion</div>
                <div className="text-base font-mono font-bold text-cyan-300">{metalName || 'None'}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0 font-mono">
              Spectroscopy Log
            </h3>
            <div className="flex-1 space-y-3 font-mono text-[10px] text-white/40 overflow-y-auto pr-2">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[#c084fc] shrink-0">[{log.time}]</span>
                  <span
                    className={cn(
                      log.type === 'warn'
                        ? 'text-[#ff44ec] font-bold'
                        : log.type === 'success'
                        ? 'text-emerald-400 font-bold'
                        : 'text-white/80'
                    )}
                  >
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
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-3 px-4 py-2 rounded-xl bg-black/80 backdrop-blur-xl border border-purple-500/30 text-center shadow-xl pointer-events-none"
            >
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
              <div className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-200">
                {item.icon}
              </div>
              <span className="text-[10px] font-mono text-center px-1 text-white/70 group-hover:text-purple-300 font-medium">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlameScene({
  getPointer,
  activeStep,
  setActiveStep,
  setCurrentStep,
  triggerSuccess,
  triggerMistake,
  flameLit,
  flameColor,
  setFlameColor,
  setMetalName,
  spawnedItems,
  setSpawnedItems,
}: any) {
  const { viewport } = useThree();
  const draggedItemIdRef = useRef<string | null>(null);
  const itemGroupsRef = useRef<{ [key: string]: THREE.Group | null }>({});
  const wasActive = useRef(false);
  const targetPosRef = useRef(new THREE.Vector3());

  const posSmootherX = useRef(new EMASmoother(0.28));
  const posSmootherY = useRef(new EMASmoother(0.28));

  useFrame(() => {
    const ptr = getPointer();
    const rawTargetX = (ptr.x * 2 - 1) * (viewport.width / 2);
    const rawTargetY = -(ptr.y * 2 - 1) * (viewport.height / 2);

    const smoothX = posSmootherX.current.update(rawTargetX);
    const smoothY = posSmootherY.current.update(rawTargetY);
    targetPosRef.current.set(smoothX, smoothY, 2);

    const grabbed = ptr.active && !wasActive.current;
    const released = !ptr.active && wasActive.current;

    if (grabbed) {
      let closest: any = null;
      let minDist = 3.0;
      spawnedItems.forEach((item: any) => {
        if (item.id === 'Burner') return;
        const dist = new THREE.Vector2(smoothX, smoothY).distanceTo(new THREE.Vector2(item.x, item.y));
        if (dist < minDist) {
          minDist = dist;
          closest = item;
        }
      });
      if (closest) {
        draggedItemIdRef.current = closest.id;
        labAudio.playGrabSound();
        const grp = itemGroupsRef.current[closest.id];
        if (grp) {
          grp.position.set(smoothX, smoothY, 1.5);
        }
      }
    }

    if (ptr.active && draggedItemIdRef.current) {
      const grp = itemGroupsRef.current[draggedItemIdRef.current];
      if (grp) {
        grp.position.set(smoothX, smoothY, 1.5);
      }
    }

    if (released && draggedItemIdRef.current) {
      const itemId = draggedItemIdRef.current;
      const dropX = smoothX;
      const dropY = smoothY;

      setSpawnedItems((prev: any) => {
        const item = prev.find((i: any) => i.id === itemId);
        if (!item) return prev;

        const burner = prev.find((i: any) => i.id === 'Burner');
        if (burner) {
          const distToFlame = new THREE.Vector2(dropX, dropY).distanceTo(
            new THREE.Vector2(burner.x, burner.y + 1.8)
          );
          if (distToFlame < 3.2) {
            const expected = EXPERIMENT_STEPS[activeStep - 1];
            if (expected && (expected.expectedTool === item.id || item.id === 'Wire Loop')) {
              labAudio.playPourEffect();

              if (item.id === 'HCl Cleaner' || (item.id === 'Wire Loop' && activeStep === 2)) {
                setFlameColor('#0099ff');
                setMetalName('HCl Cleaned Loop');
                triggerSuccess('Platinum loop cleansed in Conc. HCl.');
                const nextStep = activeStep + 1;
                setActiveStep(nextStep);
                setCurrentStep(nextStep);
                draggedItemIdRef.current = null;
                return prev;
              } else if (item.id === 'NaCl Dish') {
                setFlameColor('#ffb700');
                setMetalName('Na⁺ (Sodium)');
                triggerSuccess('Observed characteristic Golden-Yellow emission flame for Sodium (589nm)!');
                const nextStep = activeStep + 1;
                setActiveStep(nextStep);
                setCurrentStep(nextStep);
                draggedItemIdRef.current = null;
                return prev.filter((i: any) => i.id !== item.id);
              } else if (item.id === 'CuCl2 Dish') {
                setFlameColor('#00ffc8');
                setMetalName('Cu²⁺ (Copper)');
                triggerSuccess('Observed brilliant Emerald Blue-Green emission flame for Copper (510nm)!');
                const nextStep = activeStep + 1;
                setActiveStep(nextStep);
                setCurrentStep(nextStep);
                draggedItemIdRef.current = null;
                return prev.filter((i: any) => i.id !== item.id);
              } else if (item.id === 'KCl Dish') {
                setFlameColor('#d8b4fe');
                setMetalName('K⁺ (Potassium)');
                triggerSuccess('Observed characteristic Lilac-Violet emission flame for Potassium (766nm)!');
                const nextStep = activeStep + 1;
                setActiveStep(nextStep);
                setCurrentStep(nextStep);
                draggedItemIdRef.current = null;
                return prev.filter((i: any) => i.id !== item.id);
              }
            } else {
              triggerMistake(`Wrong reagent/tool! For Step ${activeStep}, you need: ${expected?.expectedTool}`);
            }
          }
        }
        return prev.map((i: any) =>
          i.id === item.id ? { ...i, isDragging: false, x: dropX, y: -0.6 } : i
        );
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
        <group
          key={item.id}
          ref={(el) => {
            if (el) itemGroupsRef.current[item.id] = el;
          }}
          position={[item.x, item.y, item.isDragging ? 1.5 : 0]}
        >
          {/* Bunsen Burner with Layered Spectral Flame */}
          {item.type === 'Burner' && (
            <group position={[0, 0, 0]}>
              {/* Heavy Cast Iron Base */}
              <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.72, 0.92, 0.35, 32]} />
                <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
              </mesh>
              {/* Air Hole Collar Ring */}
              <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.22, 0.22, 0.2, 24]} />
                <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Chrome Chimney Barrel Tube */}
              <mesh position={[0, 1.25, 0]}>
                <cylinderGeometry args={[0.18, 0.18, 1.4, 28]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.12} />
              </mesh>
              {/* Multi-Layer Organic Flickering Flame & Spectral Embers */}
              {flameLit && <LayeredFlame targetColor={flameColor} isLit={flameLit} position={[0, 1.95, 0]} />}
            </group>
          )}

          {/* Platinum Wire Loop Tool */}
          {item.type === 'Loop' && (
            <group position={[0, 0.4, 0]}>
              {/* Insulated handle */}
              <mesh position={[0, -0.4, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.8, 16]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.5} />
              </mesh>
              {/* Platinum wire stem */}
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.7, 16]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Platinum sampling loop */}
              <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.08, 0.015, 12, 24]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
              </mesh>
              <Text position={[0, 0.95, 0]} fontSize={0.13} color="#ffffff" anchorX="center">
                Platinum Loop
              </Text>
            </group>
          )}

          {/* Conc. HCl Cleaner Reagent Bottle */}
          {item.type === 'Bottle' && (
            <group position={[0, 0.4, 0]}>
              <mesh>
                <cylinderGeometry args={[0.48, 0.5, 1.2, 24]} />
                <meshStandardMaterial color="#0099ff" roughness={0.2} transparent opacity={0.8} />
              </mesh>
              <mesh position={[0, 0.7, 0]}>
                <cylinderGeometry args={[0.18, 0.22, 0.3, 16]} />
                <meshStandardMaterial color="#64748b" roughness={0.4} />
              </mesh>
              <Text position={[0, 0.1, 0.52]} fontSize={0.16} color="#ffffff" anchorX="center">
                Conc. HCl
              </Text>
            </group>
          )}

          {/* Watch Glass Dish with Crystalline Metal Salt */}
          {item.type === 'Dish' && (
            <group position={[0, 0, 0]}>
              {/* Glass Watch Dish */}
              <mesh position={[0, 0.1, 0]}>
                <cylinderGeometry args={[0.82, 0.62, 0.25, 32]} />
                <meshPhysicalMaterial
                  color="#ffffff"
                  roughness={0.1}
                  transmission={0.88}
                  transparent
                  opacity={0.65}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Colored Crystalline Powder inside dish */}
              <mesh position={[0, 0.18, 0]}>
                <cylinderGeometry args={[0.62, 0.62, 0.12, 24]} />
                <meshStandardMaterial color={item.color} roughness={0.9} />
              </mesh>
              <Text
                position={[0, 0.6, 0]}
                fontSize={0.2}
                color={item.color}
                anchorX="center"
                outlineWidth={0.02}
              >
                {item.name}
              </Text>
            </group>
          )}
        </group>
      ))}
    </>
  );
}

