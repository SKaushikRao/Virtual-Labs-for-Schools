import React, { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Text, ContactShadows, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Eye, Sparkles, Heart as HeartIcon, Info, Hand, Navigation2, ZoomIn, CheckCircle2 } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import { useHandTracking, HandData } from '../hooks/useHandTracking';
import { usePointerInput } from '../hooks/usePointerInput';
import { labAudio } from '../utils/LabAudio';
import { cn } from '../utils/cn';
import { LabTopBar } from '../components/ui/LabTopBar';
import { GestureCursor } from '../components/ui/GestureCursor';
import { AIMentorPanel } from '../components/mentor/AIMentorPanel';
import { GestureTutorial } from '../components/GestureTutorial';
import { WebcamVisionOverlay } from '../components/camera/WebcamVisionOverlay';

export interface AnatomyPart {
  id: string;
  name: string;
  desc: string;
  pos: [number, number, number];
  chamber: string;
  type: 'deoxygenated' | 'oxygenated' | 'artery';
}

const ANATOMY_PARTS: AnatomyPart[] = [
  {
    id: 'aorta',
    name: 'Aorta',
    desc: 'Main systemic artery delivering high-pressure oxygenated blood from the Left Ventricle to the entire body.',
    pos: [0.1, 1.25, 0.25],
    chamber: 'Systemic Circuit',
    type: 'artery',
  },
  {
    id: 'pulmonary_artery',
    name: 'Pulmonary Artery',
    desc: 'Pumps deoxygenated blood from the Right Ventricle toward both lungs for alveolar gaseous exchange.',
    pos: [-0.45, 0.95, 0.45],
    chamber: 'Pulmonary Circuit',
    type: 'artery',
  },
  {
    id: 'right_atrium',
    name: 'Right Atrium',
    desc: 'Receives deoxygenated blood returning from upper and lower body tissues via Superior & Inferior Vena Cava.',
    pos: [-0.95, 0.35, 0.35],
    chamber: 'Right Heart (Deox)',
    type: 'deoxygenated',
  },
  {
    id: 'right_ventricle',
    name: 'Right Ventricle',
    desc: 'Muscular chamber that pumps deoxygenated blood into the pulmonary artery toward lung capillaries.',
    pos: [-0.55, -0.65, 0.55],
    chamber: 'Right Heart (Deox)',
    type: 'deoxygenated',
  },
  {
    id: 'left_atrium',
    name: 'Left Atrium',
    desc: 'Receives freshly oxygen-rich blood returning from both lungs via the four pulmonary veins.',
    pos: [0.85, 0.45, -0.2],
    chamber: 'Left Heart (Oxygenated)',
    type: 'oxygenated',
  },
  {
    id: 'left_ventricle',
    name: 'Left Ventricle',
    desc: 'Thick muscular myocardium generating highest systolic pressure (~120 mmHg) to pump blood through the Aorta.',
    pos: [0.45, -0.75, 0.45],
    chamber: 'Left Heart (Oxygenated)',
    type: 'oxygenated',
  },
];

// Helper: Calculate 3D Euclidean distance between landmarks
function getLmDist(
  p1: { x: number; y: number; z?: number },
  p2: { x: number; y: number; z?: number }
) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Gesture classifier per hand
function classifyHand(hand: HandData) {
  const lm = hand.landmarks;
  if (!lm || lm.length < 21) {
    return {
      isPalm: false,
      isPointing: false,
      isPinching: false,
      tipPos: { x: 0.5, y: 0.5 },
      palmCenter: hand.center || { x: 0.5, y: 0.5 },
      normal: new THREE.Vector3(0, 0, 1),
    };
  }

  const wrist = lm[0];
  // Fingers extension logic relative to wrist & MCP
  const indexExt = getLmDist(lm[8], wrist) > getLmDist(lm[6], wrist) * 1.1;
  const middleExt = getLmDist(lm[12], wrist) > getLmDist(lm[10], wrist) * 1.1;
  const ringExt = getLmDist(lm[16], wrist) > getLmDist(lm[14], wrist) * 1.1;
  const pinkyExt = getLmDist(lm[20], wrist) > getLmDist(lm[18], wrist) * 1.1;

  const extendedFingers = (indexExt ? 1 : 0) + (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);

  // Open Palm: at least 3-4 non-thumb fingers extended
  const isPalm = extendedFingers >= 3;

  // Index Pointing: Index finger extended while middle, ring, and pinky are curled into palm
  const isPointing = indexExt && !middleExt && !ringExt && !pinkyExt;

  // Compute Palm Normal
  const v1 = new THREE.Vector3(lm[5].x - lm[0].x, lm[5].y - lm[0].y, (lm[5].z || 0) - (lm[0].z || 0));
  const v2 = new THREE.Vector3(lm[17].x - lm[0].x, lm[17].y - lm[0].y, (lm[17].z || 0) - (lm[0].z || 0));
  const normal = v1.cross(v2).normalize();

  return {
    isPalm,
    isPointing,
    isPinching: hand.isPinching,
    tipPos: { x: lm[8].x, y: lm[8].y },
    palmCenter: {
      x: (lm[0].x + lm[5].x + lm[17].x) / 3,
      y: (lm[0].y + lm[5].y + lm[17].y) / 3,
    },
    normal,
  };
}

export function HumanHeartLab() {
  const addScore = useAppStore((state) => state.addScore);
  const score = useAppStore((state) => state.score);
  const setCurrentStep = useAppStore((state) => state.setCurrentStep);
  const setTotalSteps = useAppStore((state) => state.setTotalSteps);
  const setExperiment = useAppStore((state) => state.setExperiment);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isReady, handStateRef, handsRef, lastGesture } = useHandTracking(videoRef);
  const getPointer = usePointerInput(handStateRef);

  const [selectedPart, setSelectedPart] = useState<AnatomyPart | null>(null);
  const [hoveredPart, setHoveredPart] = useState<AnatomyPart | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [gestureStatus, setGestureStatus] = useState<string>('Cardiology Viewport • Ready');
  const [gestureMode, setGestureMode] = useState<'idle' | 'rotate' | 'inspect' | 'zoom' | 'dual'>('idle');
  const [cursorScreenPos, setCursorScreenPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0.5,
    y: 0.5,
    visible: false,
  });
  const [resetCounter, setResetCounter] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    setExperiment('human-heart');
    setTotalSteps(4);
    setCurrentStep(1);
    addScore(20);
  }, [setExperiment, setTotalSteps, setCurrentStep, addScore]);

  const handleResetView = () => {
    labAudio.playGrabSound();
    setResetCounter((c) => c + 1);
  };

  const handleSelectPart = (part: AnatomyPart) => {
    labAudio.playHoverSound();
    setSelectedPart(part);
    addScore(10);
  };

  const handleHoverPart = (part: AnatomyPart | null) => {
    if (part && (!hoveredPart || hoveredPart.id !== part.id)) {
      labAudio.playHoverSound();
      setSelectedPart(part);
    }
    setHoveredPart(part);
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-[#05060f] via-[#14060c] to-[#04050d] flex flex-col overflow-hidden cursor-none select-none">
      <GestureCursor getPointer={getPointer} />
      <GestureTutorial />
      <AIMentorPanel />

      <LabTopBar
        title="3D Human Heart & Blood Circulation Anatomy"
        subject="Biology"
        currentStep={selectedPart ? ANATOMY_PARTS.findIndex((p) => p.id === selectedPart.id) + 1 : 1}
        totalSteps={4}
        isReady={isReady}
      />

      {/* Pointing Reticle Overlay when Index Cursor is Active */}
      {cursorScreenPos.visible && (
        <div
          style={{
            transform: `translate3d(${cursorScreenPos.x * window.innerWidth}px, ${cursorScreenPos.y * window.innerHeight}px, 0) translate(-50%, -50%)`,
          }}
          className="fixed top-0 left-0 z-[110] pointer-events-none transition-transform duration-75 will-change-transform flex items-center justify-center"
        >
          <div className="relative flex items-center justify-center">
            {/* Pulsing targeting ring */}
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-emerald-400/90 animate-spin-slow shadow-[0_0_20px_rgba(52,211,153,0.7)] flex items-center justify-center bg-emerald-500/10 backdrop-blur-[1px]" />
            {/* Center crosshair */}
            <div className="absolute w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            <div className="absolute -top-6 px-2 py-0.5 rounded-full bg-black/80 border border-emerald-400/50 text-[10px] font-mono text-emerald-300 font-bold whitespace-nowrap shadow-lg">
              ☝️ {hoveredPart ? hoveredPart.name : 'Index Cursor'}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex p-6 gap-6 relative z-10 min-h-0">
        {/* Left Anatomy Sidebar */}
        <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto hidden md:flex z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-rose-500/30 p-5 flex flex-col shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 mb-1">
              <HeartIcon size={16} className="animate-pulse text-rose-500" />
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] font-mono">Cardiovascular Lab</span>
            </div>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Dual-Hand 3D Heart</h2>
            <p className="text-xs text-white/60 leading-relaxed">
              Use <span className="text-rose-400 font-semibold">Palm movement</span> to rotate, <span className="text-emerald-400 font-semibold">Index finger</span> to inspect chambers, and <span className="text-cyan-400 font-semibold">Both Palms</span> to zoom.
            </p>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 font-mono">
                Anatomical Chambers
              </h3>
              <button
                onClick={() => setShowLabels((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-mono text-rose-300 transition-colors cursor-pointer"
              >
                <Eye size={12} />
                <span>{showLabels ? 'Hide Labels' : 'Show Labels'}</span>
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {ANATOMY_PARTS.map((part) => {
                const isSelected = (selectedPart?.id === part.id) || (hoveredPart?.id === part.id);
                return (
                  <button
                    key={part.id}
                    onClick={() => handleSelectPart(part)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1',
                      isSelected
                        ? 'bg-rose-500/25 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)] scale-[1.02]'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            part.type === 'oxygenated'
                              ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                              : part.type === 'deoxygenated'
                              ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'
                              : 'bg-purple-400 shadow-[0_0_6px_#c084fc]'
                          )}
                        />
                        {part.name}
                      </span>
                      <span className="text-[9px] font-mono text-rose-300/80">{part.chamber}</span>
                    </div>
                    <p className="text-[10px] text-white/60 line-clamp-2 leading-relaxed">{part.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gesture Controls Guide */}
          <div className="bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-black/40 border border-rose-500/30 rounded-2xl p-4 shrink-0 pointer-events-auto shadow-2xl space-y-2">
            <div className="text-[10px] uppercase font-bold text-rose-400 font-mono flex items-center gap-1.5">
              <Sparkles size={12} />
              <span>Gesture Guide</span>
            </div>
            <div className="space-y-1.5 text-xs text-white/80 font-mono">
              <div className="flex items-center justify-between bg-white/5 px-2 py-1 rounded-lg">
                <span className="flex items-center gap-1.5">🖐️ <span className="text-white">Open Palm</span></span>
                <span className="text-[11px] text-rose-300 font-semibold">Move Up/Down/L/R to Rotate</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 px-2 py-1 rounded-lg">
                <span className="flex items-center gap-1.5">☝️ <span className="text-white">Index Finger</span></span>
                <span className="text-[11px] text-emerald-300 font-semibold">Point to Inspect Chamber</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 px-2 py-1 rounded-lg">
                <span className="flex items-center gap-1.5">👐 <span className="text-white">Both Palms</span></span>
                <span className="text-[11px] text-cyan-300 font-semibold">Distance Zooms In/Out</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center 3D Heart Canvas */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#05060f] pointer-events-none">
          <Canvas
            key={canvasKey}
            camera={{ position: [0, 0, 5.5], fov: 45 }}
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
            <ambientLight intensity={0.9} />
            <directionalLight position={[5, 10, 5]} intensity={1.6} />
            <pointLight position={[6, 8, 6]} intensity={2.2} color="#f43f5e" />
            <pointLight position={[-6, 6, -3]} intensity={1.8} color="#38bdf8" />

            <Suspense
              fallback={
                <Html center>
                  <div className="flex flex-col items-center gap-3 text-rose-400 font-mono text-xs">
                    <div className="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading 3D Heart Model...</span>
                  </div>
                </Html>
              }
            >
              <HeartScene
                handsRef={handsRef}
                getPointer={getPointer}
                showLabels={showLabels}
                selectedPart={selectedPart}
                hoveredPart={hoveredPart}
                onSelectPart={handleSelectPart}
                onHoverPart={handleHoverPart}
                resetCounter={resetCounter}
                setGestureStatus={setGestureStatus}
                setGestureMode={setGestureMode}
                setCursorScreenPos={setCursorScreenPos}
              />
            </Suspense>

            <ContactShadows position={[0, -2.4, 0]} opacity={0.5} scale={15} blur={2.5} />
          </Canvas>

          {/* Gesture Indicator Badge */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none shadow-2xl">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full animate-pulse',
                gestureMode === 'dual'
                  ? 'bg-purple-400 shadow-[0_0_15px_#c084fc]'
                  : gestureMode === 'rotate'
                  ? 'bg-rose-500 shadow-[0_0_15px_#f43f5e]'
                  : gestureMode === 'inspect'
                  ? 'bg-emerald-400 shadow-[0_0_15px_#34d399]'
                  : gestureMode === 'zoom'
                  ? 'bg-cyan-400 shadow-[0_0_15px_#22d3ee]'
                  : 'bg-white/60'
              )}
            />
            <span className="text-xs font-mono font-medium text-white/95">{gestureStatus}</span>
          </div>
        </div>

        {/* Right Info & Details Panel with Webcam Vision HUD on Top */}
        <div className="w-80 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <WebcamVisionOverlay
            videoRef={videoRef}
            isReady={isReady}
            handsRef={handsRef}
            lastGesture={lastGesture}
          />

          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 font-mono">
                Anatomy Details
              </h3>
              <button
                onClick={handleResetView}
                className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
                title="Reset Camera & Rotation"
              >
                <RotateCcw size={12} />
                <span>Reset View</span>
              </button>
            </div>

            {selectedPart || hoveredPart ? (
              <motion.div
                key={(hoveredPart || selectedPart)?.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-500/20 to-purple-500/10 border border-rose-500/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold text-rose-300 font-display">
                      {(hoveredPart || selectedPart)?.name}
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200">
                      {(hoveredPart || selectedPart)?.chamber}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-white/90 leading-relaxed font-sans">
                  {(hoveredPart || selectedPart)?.desc}
                </p>
              </motion.div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-white/50">
                <Info size={20} className="mx-auto mb-2 text-white/30" />
                <span>Show an index finger cursor over any heart chamber or click to inspect its physiology.</span>
              </div>
            )}
          </div>

          {/* Double Circulation Info */}
          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3 font-mono">
              Human Double Circulation
            </h3>
            <div className="space-y-2.5 text-xs font-mono text-white/80">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> Pulmonary Circuit (Deox)
                </div>
                <p className="text-[10px] text-cyan-200/70 font-sans">
                  Right Ventricle &rarr; Pulmonary Artery &rarr; Lungs &rarr; Left Atrium
                </p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-300">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Systemic Circuit (Ox)
                </div>
                <p className="text-[10px] text-rose-200/70 font-sans">
                  Left Ventricle &rarr; Aorta &rarr; Body Organs &rarr; Right Atrium
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

useGLTF.preload('/models/heart.glb');

interface HeartSceneProps {
  handsRef: React.RefObject<HandData[]>;
  getPointer: () => { x: number; y: number; active: boolean };
  showLabels: boolean;
  selectedPart: AnatomyPart | null;
  hoveredPart: AnatomyPart | null;
  onSelectPart: (part: AnatomyPart) => void;
  onHoverPart: (part: AnatomyPart | null) => void;
  resetCounter: number;
  setGestureStatus: (status: string) => void;
  setGestureMode: (mode: 'idle' | 'rotate' | 'inspect' | 'zoom' | 'dual') => void;
  setCursorScreenPos: (pos: { x: number; y: number; visible: boolean }) => void;
}

function HeartScene({
  handsRef,
  getPointer,
  showLabels,
  selectedPart,
  hoveredPart,
  onSelectPart,
  onHoverPart,
  resetCounter,
  setGestureStatus,
  setGestureMode,
  setCursorScreenPos,
}: HeartSceneProps) {
  const { scene } = useGLTF('/models/heart.glb');
  const { camera } = useThree();

  const modelGroupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef(new THREE.Euler(0, 0, 0));
  const targetZoom = useRef(5.5);

  const prevPalmPos = useRef<{ x: number; y: number } | null>(null);
  const prevHandDistance = useRef<number | null>(null);
  const prevPointer = useRef<{ x: number; y: number; isDown: boolean }>({ x: 0.5, y: 0.5, isDown: false });

  // Reset view handler
  useEffect(() => {
    targetRotation.current.set(0, 0, 0);
    targetZoom.current = 5.5;
    prevPalmPos.current = null;
    prevHandDistance.current = null;
  }, [resetCounter]);

  useFrame(() => {
    const hands = handsRef.current || [];
    const ptr = getPointer();

    let activeMode: 'idle' | 'rotate' | 'inspect' | 'zoom' | 'dual' = 'idle';
    let statusText = 'Cardiology Viewport • Ready';
    let cursorVisible = false;
    let cursorX = 0.5;
    let cursorY = 0.5;

    // Analyze detected hands
    const handInfos = hands.map((h) => classifyHand(h));

    // Find if we have palm hand(s) and/or pointing hand(s)
    const palmHands = handInfos.filter((h) => h.isPalm);
    const pointingHands = handInfos.filter((h) => h.isPointing);

    // ==========================================
    // 1. DUAL HANDS DETECTED
    // ==========================================
    if (hands.length >= 2) {
      // Case A: Both hands are Open Palms -> Distance Zoom
      if (palmHands.length >= 2) {
        activeMode = 'zoom';
        statusText = '👐 2-Palm Distance Zoom Active';
        const h1 = palmHands[0].palmCenter;
        const h2 = palmHands[1].palmCenter;
        const dist = Math.hypot(h1.x - h2.x, h1.y - h2.y);

        if (prevHandDistance.current !== null) {
          const deltaDist = dist - prevHandDistance.current;
          // Moving hands apart -> Zoom in (smaller camera z); moving closer -> Zoom out
          targetZoom.current = Math.max(3.0, Math.min(8.5, targetZoom.current - deltaDist * 7.0));
        }
        prevHandDistance.current = dist;
        prevPalmPos.current = null;
      }
      // Case B: One hand is Open Palm (Rotation) & Other hand is Index Pointing (Inspection Cursor)
      else if (palmHands.length >= 1 && pointingHands.length >= 1) {
        activeMode = 'dual';
        const palmHand = palmHands[0];
        const pointHand = pointingHands[0];

        // 1. Palm moves -> Rotate Heart (Pitch & Yaw)
        if (prevPalmPos.current) {
          const dx = palmHand.palmCenter.x - prevPalmPos.current.x;
          const dy = palmHand.palmCenter.y - prevPalmPos.current.y;
          // Palm moving right -> turn right; palm moving up (dy < 0) -> turn up
          targetRotation.current.y += dx * 4.5;
          targetRotation.current.x += dy * 4.5;
          targetRotation.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotation.current.x));
        }
        prevPalmPos.current = { x: palmHand.palmCenter.x, y: palmHand.palmCenter.y };

        // 2. Index finger -> Cursor
        cursorVisible = true;
        cursorX = pointHand.tipPos.x;
        cursorY = pointHand.tipPos.y;
        statusText = '🖐️ Palm Rotate + ☝️ Index Inspecting';
        prevHandDistance.current = null;
      }
      // Case C: Fallback for two hands (e.g. general 2-hand zoom)
      else {
        activeMode = 'zoom';
        statusText = '👐 2-Hand Distance Zoom Active';
        const h1 = hands[0].center;
        const h2 = hands[1].center;
        const dist = Math.hypot(h1.x - h2.x, h1.y - h2.y);

        if (prevHandDistance.current !== null) {
          const deltaDist = dist - prevHandDistance.current;
          targetZoom.current = Math.max(3.0, Math.min(8.5, targetZoom.current - deltaDist * 7.0));
        }
        prevHandDistance.current = dist;
        prevPalmPos.current = null;
      }
    }
    // ==========================================
    // 2. SINGLE HAND DETECTED
    // ==========================================
    else if (hands.length === 1) {
      prevHandDistance.current = null;
      const hand = handInfos[0];

      // Single Hand: Index Pointing -> Anatomy Cursor
      if (hand.isPointing) {
        activeMode = 'inspect';
        cursorVisible = true;
        cursorX = hand.tipPos.x;
        cursorY = hand.tipPos.y;
        statusText = '☝️ Index Cursor • Hovering Anatomy';
        prevPalmPos.current = null;
      }
      // Single Hand: Open Palm -> Move palm up/down/left/right to rotate
      else if (hand.isPalm) {
        activeMode = 'rotate';
        statusText = '🖐️ Open Palm • Moving to Rotate';

        if (prevPalmPos.current) {
          const dx = hand.palmCenter.x - prevPalmPos.current.x;
          const dy = hand.palmCenter.y - prevPalmPos.current.y;
          // Moving palm right -> turn right; moving palm up (dy < 0) -> turn up
          targetRotation.current.y += dx * 4.5;
          targetRotation.current.x += dy * 4.5;
          targetRotation.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotation.current.x));
        }
        prevPalmPos.current = { x: hand.palmCenter.x, y: hand.palmCenter.y };
      }
      // Single Hand: Other gesture fallback
      else {
        activeMode = 'rotate';
        statusText = '🖐️ Hand Orbit Active';
        if (prevPalmPos.current) {
          const dx = hand.palmCenter.x - prevPalmPos.current.x;
          const dy = hand.palmCenter.y - prevPalmPos.current.y;
          targetRotation.current.y += dx * 3.5;
          targetRotation.current.x += dy * 3.5;
        }
        prevPalmPos.current = { x: hand.palmCenter.x, y: hand.palmCenter.y };
      }
    }
    // ==========================================
    // 3. MOUSE / TOUCH FALLBACK
    // ==========================================
    else {
      prevPalmPos.current = null;
      prevHandDistance.current = null;

      if (ptr.active) {
        activeMode = 'rotate';
        statusText = '🖱️ Mouse Drag • Rotating View';
        const dx = ptr.x - prevPointer.current.x;
        const dy = ptr.y - prevPointer.current.y;
        targetRotation.current.y += dx * 4.0;
        targetRotation.current.x += dy * 4.0;
        targetRotation.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotation.current.x));
      } else {
        // Use mouse coordinates as inspection cursor when hovering
        cursorX = ptr.x;
        cursorY = ptr.y;
      }
    }

    prevPointer.current = { x: ptr.x, y: ptr.y, isDown: ptr.active };

    // Update on-screen pointing reticle
    setCursorScreenPos({
      x: cursorX,
      y: cursorY,
      visible: cursorVisible,
    });

    // ==========================================
    // 4. RAYCAST / SCREEN-SPACE ANATOMY HOVER CHECK
    // ==========================================
    if (modelGroupRef.current) {
      let nearestPart: AnatomyPart | null = null;
      let minScreenDist = 0.11; // Proximity threshold in screen space (0 to 1)

      const activeInspectX = cursorVisible ? cursorX : ptr.x;
      const activeInspectY = cursorVisible ? cursorY : ptr.y;

      const tempVec = new THREE.Vector3();
      ANATOMY_PARTS.forEach((part) => {
        tempVec.set(...part.pos);
        // Transform local hotspot pos to world pos
        modelGroupRef.current!.localToWorld(tempVec);
        // Project to camera 2D NDC [-1, 1]
        tempVec.project(camera);

        // Convert NDC to normalized screen [0, 1]
        const sx = tempVec.x * 0.5 + 0.5;
        const sy = -tempVec.y * 0.5 + 0.5;

        // Check if hotspot is in front of camera
        if (tempVec.z < 1.0) {
          const dist = Math.hypot(sx - activeInspectX, sy - activeInspectY);
          if (dist < minScreenDist) {
            minScreenDist = dist;
            nearestPart = part;
          }
        }
      });

      if (nearestPart) {
        onHoverPart(nearestPart);
        if (cursorVisible) {
          statusText = `☝️ Inspecting: ${(nearestPart as AnatomyPart).name}`;
        }
      } else if (hoveredPart) {
        onHoverPart(null);
      }
    }

    setGestureMode(activeMode);
    setGestureStatus(statusText);

    // Apply smooth damping lerp to 3D model rotation and camera zoom
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        modelGroupRef.current.rotation.x,
        targetRotation.current.x,
        0.18
      );
      modelGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        modelGroupRef.current.rotation.y,
        targetRotation.current.y,
        0.18
      );
    }

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZoom.current, 0.18);
  });

  return (
    <group ref={modelGroupRef} position={[0, -0.2, 0]}>
      <Float speed={1.5} rotationIntensity={0.04} floatIntensity={0.08}>
        <primitive object={scene} scale={[1.8, 1.8, 1.8]} />

        {/* Anatomical 3D Hotspots & Floating Description Cards */}
        {showLabels &&
          ANATOMY_PARTS.map((part) => {
            const isHovered = hoveredPart?.id === part.id;
            const isSelected = selectedPart?.id === part.id;
            const isActive = isHovered || isSelected;

            const baseColor =
              part.type === 'oxygenated' ? '#f43f5e' : part.type === 'deoxygenated' ? '#00f2ff' : '#a855f7';

            return (
              <group key={part.id} position={part.pos as [number, number, number]}>
                {/* Hotspot Beacon Sphere */}
                <mesh onClick={() => onSelectPart(part)}>
                  <sphereGeometry args={[isActive ? 0.16 : 0.11, 24, 24]} />
                  <meshStandardMaterial
                    color={isActive ? '#ffffff' : baseColor}
                    emissive={baseColor}
                    emissiveIntensity={isActive ? 1.5 : 0.7}
                  />
                </mesh>

                {/* Pulsing Aura Ring when active */}
                {isActive && (
                  <mesh>
                    <ringGeometry args={[0.2, 0.28, 32]} />
                    <meshBasicMaterial color={baseColor} side={THREE.DoubleSide} transparent opacity={0.6} />
                  </mesh>
                )}

                {/* 3D Label Name */}
                <Text
                  position={[0, 0.24, 0]}
                  fontSize={isActive ? 0.17 : 0.14}
                  color={isActive ? '#ffffff' : '#e2e8f0'}
                  anchorX="center"
                  outlineWidth={0.025}
                  outlineColor="#000000"
                >
                  {part.name}
                </Text>

                {/* Floating Description Tooltip on Hover / Select */}
                {isActive && (
                  <Html position={[0, 0.45, 0]} center distanceFactor={7} zIndexRange={[100, 0]}>
                    <div className="bg-black/90 backdrop-blur-md p-3 rounded-2xl border border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.5)] w-56 text-left pointer-events-none transform transition-all duration-200 select-none">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-rose-300 font-display">{part.name}</span>
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-rose-500/30 text-white font-bold">
                          {part.chamber}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/90 leading-snug">{part.desc}</p>
                    </div>
                  </Html>
                )}
              </group>
            );
          })}
      </Float>
    </group>
  );
}

