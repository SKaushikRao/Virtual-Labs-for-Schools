import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface PourSourceState {
  isPouring: boolean;
  tiltAngle: number;
  flowRate: number;
  substance: string;
  color: string;
}

export interface FillableContainerState {
  currentVolume: number;
  maxCapacity: number;
  targetVolume: number | null;
  liquidColor: string;
  isOverflowing: boolean;
  name: string;
}

/**
 * Calculates flow rate (ml/s) based on tilt angle in degrees.
 * Threshold is ~40 degrees from upright.
 */
export function calculateFlowRate(tiltAngleDeg: number, baseRate = 30): number {
  if (tiltAngleDeg < 40) return 0;
  const progress = Math.min(1, Math.max(0, (tiltAngleDeg - 40) / 45));
  return baseRate * progress;
}

/**
 * Volumetrically blends two colors based on volume ratio.
 */
export function blendLiquidColors(
  existingHex: string,
  existingVol: number,
  incomingHex: string,
  incomingVol: number
): string {
  if (existingVol <= 0) return incomingHex;
  if (incomingVol <= 0) return existingHex;
  const total = existingVol + incomingVol;
  const c1 = new THREE.Color(existingHex);
  const c2 = new THREE.Color(incomingHex);
  c1.lerp(c2, incomingVol / total);
  return `#${c1.getHexString()}`;
}

interface PourStreamMeshProps {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  active: boolean;
  flowRate?: number;
}

/**
 * Renders a dynamic curved stream of falling liquid from spout to container surface,
 * with animated splash droplets at the impact point.
 */
export function PourStreamMesh({ from, to, color, active, flowRate = 20 }: PourStreamMeshProps) {
  const streamRef = useRef<THREE.Mesh>(null);
  const dropletsRef = useRef<THREE.Points>(null);
  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  // Particle positions for droplet splashes
  const dropletCount = 18;
  const dropletPositions = useMemo(() => new Float32Array(dropletCount * 3), [dropletCount]);
  const dropletVelocities = useMemo(() => {
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < dropletCount; i++) {
      vels.push(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 2.0 + 0.5,
        (Math.random() - 0.5) * 1.5
      ));
    }
    return vels;
  }, [dropletCount]);

  useFrame((_, delta) => {
    if (!active) {
      if (streamRef.current) streamRef.current.visible = false;
      if (dropletsRef.current) dropletsRef.current.visible = false;
      return;
    }

    if (streamRef.current) {
      streamRef.current.visible = true;

      // Build a smooth curved path from spout to liquid surface
      const midPoint = new THREE.Vector3(
        (from.x + to.x) / 2,
        Math.max(to.y + 0.1, (from.y + to.y) / 2 - 0.15),
        (from.z + to.z) / 2
      );

      const curve = new THREE.QuadraticBezierCurve3(from, midPoint, to);
      const radius = Math.min(0.06, Math.max(0.02, (flowRate / 40) * 0.05));
      const geom = new THREE.TubeGeometry(curve, 12, radius, 8, false);
      
      if (streamRef.current.geometry) streamRef.current.geometry.dispose();
      streamRef.current.geometry = geom;
    }

    if (dropletsRef.current) {
      dropletsRef.current.visible = true;
      const positions = dropletsRef.current.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < dropletCount; i++) {
        const i3 = i * 3;
        const vel = dropletVelocities[i];
        
        positions[i3] += vel.x * delta;
        positions[i3 + 1] += (vel.y - 9.8 * delta * 0.5) * delta;
        positions[i3 + 2] += vel.z * delta;

        // Reset droplets when they fall below target surface or go too high
        if (positions[i3 + 1] < to.y || positions[i3 + 1] > to.y + 1.0) {
          positions[i3] = to.x + (Math.random() - 0.5) * 0.1;
          positions[i3 + 1] = to.y + 0.02;
          positions[i3 + 2] = to.z + (Math.random() - 0.5) * 0.1;
          vel.set(
            (Math.random() - 0.5) * 1.8,
            Math.random() * 2.2 + 0.8,
            (Math.random() - 0.5) * 1.8
          );
        }
      }

      dropletsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={streamRef}>
        <meshPhysicalMaterial
          color={colorObj}
          transmission={0.85}
          roughness={0.1}
          transparent
          opacity={0.85}
          emissive={colorObj}
          emissiveIntensity={0.25}
        />
      </mesh>

      <points ref={dropletsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[dropletPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={colorObj}
          size={0.06}
          transparent
          opacity={0.75}
        />
      </points>
    </group>
  );
}

interface LiquidMeshProps {
  position?: [number, number, number];
  radiusTop: number;
  radiusBottom: number;
  maxHeight: number;
  fillRatio: number;
  color: string;
  transparent?: boolean;
  opacity?: number;
}

/**
 * Renders liquid level inside a beaker/dish/well with volume-based height and animated surface.
 */
export function LiquidMesh({
  position = [0, 0, 0],
  radiusTop,
  radiusBottom,
  maxHeight,
  fillRatio,
  color,
  transparent = true,
  opacity = 0.85,
}: LiquidMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const colorObj = useMemo(() => new THREE.Color(color), [color]);
  const clampedRatio = Math.max(0.001, Math.min(1.0, fillRatio));
  const height = maxHeight * clampedRatio;
  const yOffset = position[1] + height / 2;

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.color.lerp(colorObj, 0.1);
      }
    }
  });

  if (fillRatio <= 0.001) return null;

  return (
    <group position={[position[0], yOffset, position[2]]}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[radiusTop, radiusBottom, height, 32]} />
        <meshStandardMaterial
          color={colorObj}
          roughness={0.15}
          metalness={0.1}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}
