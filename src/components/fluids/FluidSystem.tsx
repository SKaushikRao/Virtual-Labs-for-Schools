import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- 1.1 LiquidFill: Rising level anchored at base, zero React re-renders ---
export interface LiquidFillProps {
  volumeRef: React.MutableRefObject<number>; // 0..maxCapacity, mutated in useFrame
  maxCapacity: number;
  containerRadius: number;
  containerHeight: number;
  colorRef: React.MutableRefObject<THREE.Color>;
  offsetY?: number; // base Y position inside the container
  position?: [number, number, number];
}

export function LiquidFill({
  volumeRef,
  maxCapacity,
  containerRadius,
  containerHeight,
  colorRef,
  offsetY = 0,
  position = [0, 0, 0],
}: LiquidFillProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  useFrame(() => {
    if (!meshRef.current) return;
    const vol = volumeRef.current || 0;
    const fillRatio = THREE.MathUtils.clamp(vol / maxCapacity, 0, 1);
    const currentHeight = fillRatio * containerHeight;

    // Scale from 0 at base, not center — offset position.y so it grows upward anchored at base
    meshRef.current.scale.y = Math.max(currentHeight, 0.001);
    meshRef.current.position.y = position[1] + offsetY + currentHeight / 2;
    meshRef.current.position.x = position[0];
    meshRef.current.position.z = position[2];

    if (materialRef.current && colorRef.current) {
      materialRef.current.color.copy(colorRef.current);
      materialRef.current.emissive.copy(colorRef.current);
      materialRef.current.emissiveIntensity = 0.2;
    }

    // Hide when empty to avoid tiny zero-mesh artifacts
    meshRef.current.visible = vol > 0.1;
  });

  return (
    <mesh ref={meshRef} position={[position[0], position[1] + offsetY, position[2]]}>
      <cylinderGeometry args={[containerRadius * 0.95, containerRadius * 0.9, 1, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        transparent
        opacity={0.85}
        roughness={0.15}
        metalness={0.1}
        color={colorRef.current}
      />
    </mesh>
  );
}

// --- 1.2 PourStream: Falling visual using unlit MeshBasicMaterial for guaranteed visibility ---
export interface PourStreamProps {
  isPouringRef: React.MutableRefObject<boolean>;
  sourcePositionRef: React.MutableRefObject<THREE.Vector3>; // World position of spout
  targetYRef: React.MutableRefObject<number>; // Current liquid surface world Y
  colorRef: React.MutableRefObject<THREE.Color>;
  streamRadius?: number;
}

export function PourStream({
  isPouringRef,
  sourcePositionRef,
  targetYRef,
  colorRef,
  streamRadius = 0.025,
}: PourStreamProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(() => {
    if (!meshRef.current) return;
    if (!isPouringRef.current) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const source = sourcePositionRef.current;
    const targetY = targetYRef.current;
    const dropHeight = Math.max(source.y - targetY, 0.02);

    // Position stream between spout and current liquid surface, scaled to fill the vertical gap
    meshRef.current.position.set(source.x, source.y - dropHeight / 2, source.z);
    meshRef.current.scale.set(1, dropHeight, 1);

    if (materialRef.current && colorRef.current) {
      materialRef.current.color.copy(colorRef.current);
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <cylinderGeometry args={[streamRadius, streamRadius * 0.8, 1, 12]} />
      <meshBasicMaterial
        ref={materialRef}
        transparent
        opacity={0.9}
        color={colorRef.current}
      />
    </mesh>
  );
}

// --- 1.3 Swirl / Mixing Turbulence Mesh for Test Tubes ---
export interface SwirlEffectProps {
  isSwirlingRef: React.MutableRefObject<boolean>;
  position: [number, number, number];
  radius: number;
  height: number;
  colorRef: React.MutableRefObject<THREE.Color>;
}

export function SwirlEffect({ isSwirlingRef, position, radius, height, colorRef }: SwirlEffectProps) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (!isSwirlingRef.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    groupRef.current.rotation.y += delta * 12;
    groupRef.current.position.set(position[0], position[1] + Math.sin(state.clock.elapsedTime * 15) * 0.02, position[2]);
  });

  return (
    <group ref={groupRef} position={position} visible={false}>
      {[-0.05, 0, 0.05].map((yOff, i) => (
        <mesh key={i} position={[0, yOff, 0]} rotation={[0.2 * i, 0, 0]}>
          <torusGeometry args={[radius * 0.7, 0.015, 8, 16]} />
          <meshBasicMaterial color={colorRef.current} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// --- 1.4 Helper utilities ---

/**
 * Volumetrically blends two colors smoothly in-place into colorRef
 */
export function blendAndSetColor(
  colorRef: React.MutableRefObject<THREE.Color>,
  existingVolume: number,
  incomingColor: THREE.Color,
  incomingVolume: number
) {
  const totalVolume = existingVolume + incomingVolume;
  if (totalVolume <= 0) return;
  colorRef.current.lerp(incomingColor, Math.min(1, incomingVolume / totalVolume));
}

/**
 * Flow rate (ml/s) calculation based on tilt angle in degrees
 */
export function calculateFlowRate(tiltAngleDeg: number, baseRate = 35): number {
  if (tiltAngleDeg < 35) return 0;
  const progress = Math.min(1, Math.max(0, (tiltAngleDeg - 35) / 45));
  return baseRate * progress;
}
