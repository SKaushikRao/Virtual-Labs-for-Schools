import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Text, ContactShadows, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Eye, Sparkles, Heart as HeartIcon, Info } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import { useHandTracking } from '../hooks/useHandTracking';
import { usePointerInput } from '../hooks/usePointerInput';
import { labAudio } from '../utils/LabAudio';
import { cn } from '../utils/cn';
import { LabTopBar } from '../components/ui/LabTopBar';
import { GestureCursor } from '../components/ui/GestureCursor';
import { AIMentorPanel } from '../components/mentor/AIMentorPanel';
import { GestureTutorial } from '../components/GestureTutorial';

const ANATOMY_PARTS = [
  { id: 'aorta', name: 'Aorta', desc: 'Main artery delivering oxygenated blood under high pressure to the systemic circulation.', pos: [0.1, 1.2, 0.2], chamber: 'Systemic Circuit' },
  { id: 'pulmonary_artery', name: 'Pulmonary Artery', desc: 'Transports deoxygenated blood from Right Ventricle to lungs for oxygenation.', pos: [-0.4, 0.9, 0.4], chamber: 'Pulmonary Circuit' },
  { id: 'right_atrium', name: 'Right Atrium', desc: 'Receives deoxygenated blood returning from upper and lower body via Vena Cava.', pos: [-0.9, 0.3, 0.3], chamber: 'Right Heart (Deox)' },
  { id: 'right_ventricle', name: 'Right Ventricle', desc: 'Pumps deoxygenated blood into the pulmonary artery toward the alveoli.', pos: [-0.5, -0.6, 0.5], chamber: 'Right Heart (Deox)' },
  { id: 'left_atrium', name: 'Left Atrium', desc: 'Receives oxygen-rich blood returning from the pulmonary veins of both lungs.', pos: [0.8, 0.4, -0.2], chamber: 'Left Heart (Oxygenated)' },
  { id: 'left_ventricle', name: 'Left Ventricle', desc: 'Thick muscular myocardium generating peak systolic pressure to supply the entire body.', pos: [0.4, -0.7, 0.4], chamber: 'Left Heart (Oxygenated)' },
];

export function HumanHeartLab() {
  const addScore = useAppStore((state) => state.addScore);
  const score = useAppStore((state) => state.score);
  const setCurrentStep = useAppStore((state) => state.setCurrentStep);
  const setTotalSteps = useAppStore((state) => state.setTotalSteps);
  const setExperiment = useAppStore((state) => state.setExperiment);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isReady, handStateRef, handsRef } = useHandTracking(videoRef);
  const getPointer = usePointerInput(handStateRef);

  const [selectedPart, setSelectedPart] = useState<typeof ANATOMY_PARTS[0] | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [activeGesture, setActiveGesture] = useState<'none' | 'rotate' | 'zoom'>('none');
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

  const handleSelectPart = (part: typeof ANATOMY_PARTS[0]) => {
    labAudio.playHoverSound();
    setSelectedPart(part);
    addScore(10);
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-[#05060f] via-[#14060c] to-[#04050d] flex flex-col overflow-hidden cursor-none select-none">
      <GestureCursor getPointer={getPointer} />
      <GestureTutorial />
      <AIMentorPanel />

      <LabTopBar
        title="3D Human Heart & Blood Circulation Anatomy"
        subject="Biology"
        currentStep={selectedPart ? ANATOMY_PARTS.findIndex(p => p.id === selectedPart.id) + 1 : 1}
        totalSteps={4}
        isReady={isReady}
      />

      <main className="flex-1 flex p-6 gap-6 relative z-10 min-h-0">
        {/* Left Anatomy Sidebar */}
        <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto hidden md:flex z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-rose-500/30 p-5 flex flex-col shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 mb-1">
              <HeartIcon size={16} className="animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] font-mono">Cardiovascular System</span>
            </div>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Interactive 3D Heart</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Explore 4-chamber human cardiology with continuous two-hand gesture tracking or mouse orbit.
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
                const isSelected = selectedPart?.id === part.id;
                return (
                  <button
                    key={part.id}
                    onClick={() => handleSelectPart(part)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1',
                      isSelected
                        ? 'bg-rose-500/20 border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{part.name}</span>
                      <span className="text-[9px] font-mono text-rose-300/80">{part.chamber}</span>
                    </div>
                    <p className="text-[10px] text-white/50 line-clamp-2 leading-relaxed">{part.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gesture Guide Pill */}
          <div className="bg-gradient-to-r from-rose-950/40 to-black/40 border border-rose-500/20 rounded-2xl p-4 shrink-0 pointer-events-auto shadow-2xl">
            <div className="text-[10px] uppercase font-bold text-rose-400 mb-2 font-mono flex items-center gap-1.5">
              <Sparkles size={12} />
              <span>Gesture Controls</span>
            </div>
            <div className="space-y-1 text-xs text-white/70">
              <div className="flex items-center justify-between">
                <span>🖐️ 1 Hand</span>
                <span className="font-mono text-rose-300">Rotate / Orbit</span>
              </div>
              <div className="flex items-center justify-between">
                <span>👐 2 Hands</span>
                <span className="font-mono text-cyan-300">Distance Zoom</span>
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
              domEl.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                console.warn('WebGL Context Lost. Remounting canvas to auto-recover...');
                setTimeout(() => setCanvasKey(k => k + 1), 60);
              }, false);
            }}
            style={{ background: '#05060f', width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <color attach="background" args={["#05060f"]} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} />
            <pointLight position={[6, 8, 6]} intensity={2.0} color="#f43f5e" />
            <pointLight position={[-6, 6, -3]} intensity={1.5} color="#38bdf8" />

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
                onSelectPart={handleSelectPart}
                resetCounter={resetCounter}
                setActiveGesture={setActiveGesture}
              />
            </Suspense>

            <ContactShadows position={[0, -2.4, 0]} opacity={0.5} scale={15} blur={2.5} />
          </Canvas>

          {/* Gesture Indicator Badge */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none shadow-xl">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full animate-pulse',
                activeGesture === 'rotate'
                  ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e]'
                  : activeGesture === 'zoom'
                  ? 'bg-cyan-400 shadow-[0_0_12px_#22d3ee]'
                  : 'bg-emerald-400'
              )}
            />
            <span className="text-xs font-mono font-medium text-white/90">
              {activeGesture === 'rotate'
                ? 'Gesture: 1-Hand Orbit Active'
                : activeGesture === 'zoom'
                ? 'Gesture: 2-Hand Zoom Active'
                : 'Cardiology 3D Viewport • Ready'}
            </span>
          </div>

          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute w-36 h-28 top-20 right-6 object-cover rounded-2xl border border-white/20 opacity-40 z-10 scale-x-[-1] pointer-events-none"
          />
        </div>

        {/* Right Info & Details Panel */}
        <div className="w-72 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
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

            {selectedPart ? (
              <motion.div
                key={selectedPart.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <div className="text-base font-bold text-rose-300">{selectedPart.name}</div>
                  <div className="text-[10px] font-mono text-white/60">{selectedPart.chamber}</div>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">{selectedPart.desc}</p>
              </motion.div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-white/50">
                <Info size={20} className="mx-auto mb-2 text-white/30" />
                <span>Select an anatomical hotspot on the heart model or list to inspect physiology.</span>
              </div>
            )}
          </div>

          {/* Double Circulation Info */}
          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3 font-mono">
              Double Circulation
            </h3>
            <div className="space-y-2 text-xs font-mono text-white/70">
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                <span className="font-bold">Pulmonary Circuit:</span> Right Ventricle &rarr; Lungs &rarr; Left Atrium
              </div>
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                <span className="font-bold">Systemic Circuit:</span> Left Ventricle &rarr; Aorta &rarr; Body Tissues
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

useGLTF.preload('/models/heart.glb');

function HeartScene({
  handsRef,
  getPointer,
  showLabels,
  selectedPart,
  onSelectPart,
  resetCounter,
  setActiveGesture,
}: any) {
  const { scene } = useGLTF('/models/heart.glb');
  const { camera } = useThree();

  const modelGroupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef(new THREE.Euler(0, 0, 0));
  const targetZoom = useRef(5.5);
  const prevHandDistance = useRef<number | null>(null);
  const prevPointer = useRef<{ x: number; y: number; isDown: boolean }>({ x: 0.5, y: 0.5, isDown: false });

  // Reset view handler
  useEffect(() => {
    targetRotation.current.set(0, 0, 0);
    targetZoom.current = 5.5;
  }, [resetCounter]);

  useFrame((_, delta) => {
    const hands = handsRef.current || [];
    const ptr = getPointer();

    let currentGesture: 'none' | 'rotate' | 'zoom' = 'none';

    // 1. Two-Hand Distance Zoom
    if (hands.length >= 2) {
      currentGesture = 'zoom';
      const h1 = hands[0].center;
      const h2 = hands[1].center;
      const dist = Math.sqrt((h1.x - h2.x) ** 2 + (h1.y - h2.y) ** 2);

      if (prevHandDistance.current !== null) {
        const deltaDist = dist - prevHandDistance.current;
        // Hands moving apart -> zoom in (smaller camera distance); together -> zoom out
        targetZoom.current = Math.max(3.0, Math.min(8.5, targetZoom.current - deltaDist * 6.0));
      }
      prevHandDistance.current = dist;
    } else {
      prevHandDistance.current = null;
    }

    // 2. Single-Hand Orbit Rotation
    if (hands.length === 1) {
      currentGesture = 'rotate';
      const hand = hands[0];
      const lm = hand.landmarks;

      if (lm.length >= 18) {
        // Compute palm normal from wrist (0), index MCP (5), pinky MCP (17)
        const wrist = new THREE.Vector3(lm[0].x, lm[0].y, lm[0].z);
        const indexMcp = new THREE.Vector3(lm[5].x, lm[5].y, lm[5].z);
        const pinkyMcp = new THREE.Vector3(lm[17].x, lm[17].y, lm[17].z);

        const v1 = indexMcp.clone().sub(wrist);
        const v2 = pinkyMcp.clone().sub(wrist);
        const normal = v1.cross(v2).normalize();

        // Map palm normal to pitch and yaw
        const targetYaw = (normal.x * 2.5) + (hand.center.x - 0.5) * 3.0;
        const targetPitch = (normal.y * 2.0) - (hand.center.y - 0.5) * 2.5;

        targetRotation.current.y = targetYaw;
        targetRotation.current.x = targetPitch;
      }
    }

    // 3. Mouse / Touch fallback when no hands in frame
    if (hands.length === 0 && ptr.active) {
      currentGesture = 'rotate';
      const dx = ptr.x - prevPointer.current.x;
      const dy = ptr.y - prevPointer.current.y;
      targetRotation.current.y += dx * 4.0;
      targetRotation.current.x += dy * 4.0;
    }
    prevPointer.current = { x: ptr.x, y: ptr.y, isDown: ptr.active };

    setActiveGesture(currentGesture);

    // Apply smooth damped lerp to model rotation & camera zoom
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
      <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.1}>
        <primitive object={scene} scale={[1.8, 1.8, 1.8]} />

        {/* Anatomical 3D Labels / Hotspots */}
        {showLabels &&
          ANATOMY_PARTS.map((part) => {
            const isSelected = selectedPart?.id === part.id;
            return (
              <group key={part.id} position={part.pos as [number, number, number]}>
                <mesh onClick={() => onSelectPart(part)}>
                  <sphereGeometry args={[0.12, 16, 16]} />
                  <meshStandardMaterial
                    color={isSelected ? '#f43f5e' : '#00f2ff'}
                    emissive={isSelected ? '#f43f5e' : '#00f2ff'}
                    emissiveIntensity={0.8}
                  />
                </mesh>
                <Text
                  position={[0, 0.22, 0]}
                  fontSize={0.15}
                  color={isSelected ? '#f43f5e' : '#ffffff'}
                  anchorX="center"
                  outlineWidth={0.02}
                  outlineColor="#000000"
                >
                  {part.name}
                </Text>
              </group>
            );
          })}
      </Float>
    </group>
  );
}
