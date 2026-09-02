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

const HEART_PARTS = [
  { id: 'RA', name: 'Right Atrium', type: 'Deoxygenated', desc: 'Receives deoxygenated blood from Superior & Inferior Vena Cava', color: '#3b82f6', pos: [-1.2, 0.6, 0] },
  { id: 'RV', name: 'Right Ventricle', type: 'Deoxygenated', desc: 'Pumps deoxygenated blood to the lungs via Pulmonary Artery', color: '#1d4ed8', pos: [-0.9, -0.6, 0] },
  { id: 'LA', name: 'Left Atrium', type: 'Oxygenated', desc: 'Receives oxygenated blood returning from the lungs via Pulmonary Veins', color: '#f43f5e', pos: [1.2, 0.6, 0] },
  { id: 'LV', name: 'Left Ventricle', type: 'Oxygenated', desc: 'Thick muscular chamber pumping oxygenated blood to body via Aorta', color: '#e11d48', pos: [0.9, -0.6, 0] },
  { id: 'Aorta', name: 'Aorta', type: 'Systemic', desc: 'Main systemic artery distributing oxygenated blood under high pressure', color: '#dc2626', pos: [0, 1.6, 0] },
];

export function HumanHeartLab() {
  const addScore = useAppStore(state => state.addScore);
  const score = useAppStore(state => state.score);
  const setCurrentStep = useAppStore(state => state.setCurrentStep);
  const setTotalSteps = useAppStore(state => state.setTotalSteps);
  const setRecentMistake = useAppStore(state => state.setRecentMistake);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isReady, cursorRef } = useHandTracking(videoRef);
  const getPointer = usePointerInput(cursorRef);

  const [activePart, setActivePart] = useState<typeof HEART_PARTS[0]>(HEART_PARTS[0]);
  const [inspectedParts, setInspectedParts] = useState<string[]>([]);
  const [bpm, setBpm] = useState(72);

  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'success'}[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'Human Heart 3D Anatomical Explorer Loaded.', type: 'info' }
  ]);

  useEffect(() => {
    setTotalSteps(5);
    setCurrentStep(inspectedParts.length + 1);
  }, [setTotalSteps, setCurrentStep, inspectedParts]);

  const addLog = (msg: string, type: 'info'|'warn'|'success' = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg, type }]);
  };

  const handleSelectPart = (part: typeof HEART_PARTS[0]) => {
    setActivePart(part);
    if (!inspectedParts.includes(part.id)) {
      labAudio.playSuccessChime();
      addScore(20);
      setInspectedParts(prev => [...prev, part.id]);
      addLog(`Mastered structure: ${part.name} (${part.type})`, 'success');
    } else {
      labAudio.playGrabSound();
    }
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-[#05060f] via-[#0b0818] to-[#04050d] flex flex-col overflow-hidden cursor-none select-none">
      <GestureCursor getPointer={getPointer} />
      <GestureTutorial />
      <AIMentorPanel />

      <LabTopBar
        title="Human Heart & Circulatory System Interactive Explorer"
        subject="Biology"
        currentStep={inspectedParts.length}
        totalSteps={5}
        isReady={isReady}
      />

      <main className="flex-1 flex p-6 gap-6 relative z-10 min-h-0">
        {/* Left Explorer Checklist */}
        <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto hidden md:flex z-20 pointer-events-none">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 flex flex-col shrink-0 pointer-events-auto shadow-2xl">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-400 mb-1">Cardiovascular System</span>
            <h2 className="text-xl font-bold leading-tight mb-2 text-white">Anatomy & Circulation</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Pinch or click any cardiac chamber to inspect oxygenated vs deoxygenated pathways.
            </p>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4 font-mono">
              <span>🫀</span> Chamber Exploration Checklist
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {HEART_PARTS.map((part) => {
                const isDone = inspectedParts.includes(part.id);
                const isCurrent = activePart.id === part.id;
                return (
                  <button
                    key={part.id}
                    onClick={() => handleSelectPart(part)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between",
                      isCurrent
                        ? "bg-white/10 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        : "bg-white/5 border-white/5 hover:bg-white/10"
                    )}
                  >
                    <div>
                      <div className="text-xs font-bold text-white font-display">{part.name}</div>
                      <div className="text-[9px] font-mono" style={{ color: part.color }}>{part.type}</div>
                    </div>
                    {isDone ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                        ✓
                      </div>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/20 to-transparent backdrop-blur-md rounded-2xl border border-emerald-500/30 p-5 shrink-0 pointer-events-auto shadow-2xl">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 font-mono">Cardiology XP</span>
              <span className="text-2xl font-mono font-bold text-emerald-300">{score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700" style={{ width: `${(inspectedParts.length / 5) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Center 3D Anatomical Heart Scene */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-transparent pointer-events-none">
          <Canvas camera={{ position: [0, 1, 7], fov: 45 }} style={{ pointerEvents: 'none' }}>
            <ambientLight intensity={0.7} />
            <pointLight position={[6, 8, 6]} intensity={1.8} color="#f43f5e" />
            <pointLight position={[-6, 6, -3]} intensity={1.5} color="#3b82f6" />

            <Heart3DScene 
              getPointer={getPointer}
              activePart={activePart}
              handleSelectPart={handleSelectPart}
              bpm={bpm}
            />
            <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={25} blur={2} />
          </Canvas>

          {/* Action Callout */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3 pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-mono font-medium text-white/90">
              Pulsating at {bpm} BPM • {inspectedParts.length}/5 Structures Mastered
            </span>
          </div>

          <video ref={videoRef} playsInline muted className="absolute w-36 h-28 top-20 right-6 object-cover rounded-2xl border border-white/20 opacity-40 z-10 scale-x-[-1] pointer-events-none" />
        </div>

        {/* Right Part Details & Circulation Info */}
        <div className="w-80 flex flex-col gap-4 shrink-0 hidden lg:flex ml-auto z-20 pointer-events-none">
          <motion.div
            key={activePart.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 shrink-0 pointer-events-auto shadow-2xl"
          >
             <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-emerald-400">Selected Anatomy</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold" style={{ backgroundColor: `${activePart.color}33`, color: activePart.color }}>
                  {activePart.type}
                </span>
             </div>
             <h3 className="text-2xl font-bold font-display text-white mb-2">{activePart.name}</h3>
             <p className="text-xs text-white/70 leading-relaxed mb-4">{activePart.desc}</p>

             <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] font-mono text-white/60">
                <span>Blood Type: </span>
                <span className="font-bold text-white">
                  {activePart.type === 'Oxygenated' ? '🔴 High O2 / Low CO2' : activePart.type === 'Deoxygenated' ? '🔵 High CO2 / Low O2' : '⚪ High Pressure Systemic'}
                </span>
             </div>
          </motion.div>

          <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 shrink-0 font-mono">Cardiac Log</h3>
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

      {/* Bottom Quick Chamber Selector */}
      <div className="absolute bottom-5 w-full flex justify-center z-30 pointer-events-none">
        <div className="flex gap-3 bg-[#0b0818]/80 backdrop-blur-2xl border border-white/15 p-3 rounded-3xl overflow-x-auto max-w-[90vw] pointer-events-auto shadow-2xl shrink-0 mx-8 items-center">
           {HEART_PARTS.map((part) => (
              <button
                 key={part.id}
                 onClick={() => handleSelectPart(part)}
                 className={cn(
                   "px-4 py-2.5 rounded-2xl text-xs font-mono font-bold transition-all hover:scale-105 cursor-pointer border",
                   activePart.id === part.id
                     ? "bg-white/15 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                     : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                 )}
              >
                 {part.name}
              </button>
           ))}
        </div>
      </div>
    </div>
  );
}

function Heart3DScene({ getPointer, activePart, handleSelectPart, bpm }: any) {
  const heartMeshRef = useRef<THREE.Group>(null);
  const wasActive = useRef(false);

  useFrame(({ clock }) => {
    // Cardiac pulsating rhythm
    if (heartMeshRef.current) {
      const pulseRate = (bpm / 60) * Math.PI * 2;
      const t = clock.getElapsedTime() * pulseRate;
      const beat = 1 + Math.pow(Math.sin(t), 4) * 0.08;
      heartMeshRef.current.scale.set(beat, beat, beat);
      heartMeshRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.2;
    }

    const ptr = getPointer();
    const grabbed = ptr.active && !wasActive.current;

    if (grabbed) {
      // Find closest heart hotspot
      const px = (ptr.x * 2 - 1) * 3;
      const py = -(ptr.y * 2 - 1) * 2;
      let closest: any = null;
      let minDist = 1.8;
      HEART_PARTS.forEach((part) => {
        const dist = new THREE.Vector2(px, py).distanceTo(new THREE.Vector2(part.pos[0], part.pos[1]));
        if (dist < minDist) {
          minDist = dist;
          closest = part;
        }
      });
      if (closest) {
        handleSelectPart(closest);
      }
    }
    wasActive.current = ptr.active;
  });

  return (
    <group ref={heartMeshRef} position={[0, 0, 0]}>
      {/* Central Ventricle Mass */}
      <mesh position={[0, -0.4, 0]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial color="#991b1b" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Left Ventricle Muscular Wall */}
      <mesh position={[0.6, -0.6, 0.3]}>
        <sphereGeometry args={[1.1, 24, 24]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.3} />
      </mesh>

      {/* Right Ventricle */}
      <mesh position={[-0.6, -0.6, 0.3]}>
        <sphereGeometry args={[1.0, 24, 24]} />
        <meshStandardMaterial color="#1e40af" roughness={0.3} />
      </mesh>

      {/* Right Atrium */}
      <mesh position={[-1.1, 0.8, 0]}>
        <sphereGeometry args={[0.8, 24, 24]} />
        <meshStandardMaterial color="#2563eb" roughness={0.4} />
      </mesh>

      {/* Left Atrium */}
      <mesh position={[1.1, 0.8, 0]}>
        <sphereGeometry args={[0.8, 24, 24]} />
        <meshStandardMaterial color="#e11d48" roughness={0.4} />
      </mesh>

      {/* Aorta Arch */}
      <group position={[0, 1.6, 0]}>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <torusGeometry args={[0.9, 0.3, 16, 32, Math.PI]} />
          <meshStandardMaterial color="#dc2626" roughness={0.3} />
        </mesh>
      </group>

      {/* Pulmonary Artery */}
      <group position={[-0.4, 1.2, 0.4]}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <cylinderGeometry args={[0.25, 0.25, 1.4, 16]} />
          <meshStandardMaterial color="#1d4ed8" roughness={0.3} />
        </mesh>
      </group>

      {/* Hotspot Indicators */}
      {HEART_PARTS.map((part) => (
        <group key={part.id} position={part.pos as any}>
          <mesh>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color={activePart.id === part.id ? '#00f2ff' : part.color} />
          </mesh>
          <pointLight color={part.color} intensity={1} distance={2} />
          <Text position={[0, 0.4, 0]} fontSize={0.2} color="#ffffff" anchorX="center" outlineWidth={0.02}>
            {part.name}
          </Text>
        </group>
      ))}
    </group>
  );
}
