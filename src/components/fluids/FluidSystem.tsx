import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// 0. FOUNDATIONAL ANIMATION ARCHITECTURE & INPUT SMOOTHING
// ============================================================================

/**
 * Exponential Moving Average (EMA) smoothing for 2D/3D vectors and numbers.
 * Eliminates hand tracking jitter while maintaining under-50ms responsiveness.
 */
export class EMASmoother {
  private alpha: number;
  private currentVal: number | null = null;

  constructor(alpha = 0.28) {
    this.alpha = alpha;
  }

  update(target: number): number {
    if (this.currentVal === null) {
      this.currentVal = target;
    } else {
      this.currentVal = this.currentVal + this.alpha * (target - this.currentVal);
    }
    return this.currentVal;
  }

  reset(val?: number) {
    this.currentVal = val !== undefined ? val : null;
  }

  get value(): number {
    return this.currentVal ?? 0;
  }
}

export class Vector3Smoother {
  private alpha: number;
  public current: THREE.Vector3;

  constructor(alpha = 0.3) {
    this.alpha = alpha;
    this.current = new THREE.Vector3();
  }

  update(target: THREE.Vector3): THREE.Vector3 {
    this.current.lerp(target, this.alpha);
    return this.current;
  }

  set(x: number, y: number, z: number) {
    this.current.set(x, y, z);
  }
}

/**
 * Central Liquid State Data Model
 */
export interface ContainerLiquidState {
  id: string;
  volume: number; // current ml
  capacity: number; // max ml
  color: THREE.Color;
  substance: string;
  temperature: number; // deg C
  isStirring: boolean;
  stirVelocity: number;
  pH: number;
  bloomProgress?: number; // 0..1 for indicator diffusion bloom
}

// ============================================================================
// 1. REALISTIC GLASSWARE: BOROSILICATE BEAKER WITH ETCHED GRADUATION
// ============================================================================

export interface GlasswareBeakerProps {
  radius?: number;
  height?: number;
  position?: [number, number, number];
  scale?: [number, number, number];
  isHovered?: boolean;
}

export function GlasswareBeaker({
  radius = 0.78,
  height = 1.5,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  isHovered = false,
}: GlasswareBeakerProps) {
  const graduationMarks = [
    { ml: '25ml', y: -0.32 },
    { ml: '50ml', y: -0.08 },
    { ml: '75ml', y: 0.16 },
    { ml: '100ml', y: 0.4 },
    { ml: '150ml', y: 0.64 },
  ];

  return (
    <group position={position} scale={scale}>
      {/* 1. Borosilicate Glass Outer Cylinder */}
      <mesh position={[0, height / 2 - 0.5, 0]}>
        <cylinderGeometry args={[radius, radius * 0.96, height, 36, 1, true]} />
        <meshPhysicalMaterial
          color="#dbeafe"
          transmission={0.92}
          opacity={0.38}
          transparent
          roughness={0.04}
          metalness={0.05}
          ior={1.47} // Borosilicate glass refractive index
          reflectivity={0.5}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 2. Glass Base (Thick bottom base) */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[radius * 0.96, radius * 0.96, 0.08, 36]} />
        <meshPhysicalMaterial
          color="#bfdbfe"
          roughness={0.08}
          transmission={0.85}
          transparent
          opacity={0.65}
          clearcoat={0.9}
        />
      </mesh>

      {/* 3. Reinforced Lip / Spout Rim (Torus ring) */}
      <mesh position={[0, height - 0.5, 0]}>
        <torusGeometry args={[radius, 0.035, 16, 36]} />
        <meshPhysicalMaterial
          color="#93c5fd"
          roughness={0.05}
          transmission={0.88}
          transparent
          opacity={0.7}
          clearcoat={1.0}
        />
      </mesh>

      {/* 4. Etched Volume Markings & Numerals */}
      {graduationMarks.map((mark, idx) => (
        <group key={idx} position={[radius * 0.97, mark.y, 0]}>
          <mesh>
            <boxGeometry args={[0.02, 0.015, 0.18]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
          <Text
            position={[0.12, 0, 0]}
            fontSize={0.09}
            color="#ffffff"
            anchorX="left"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {mark.ml}
          </Text>
        </group>
      ))}

      {/* 5. Glass Specular Highlight Stripe */}
      <mesh position={[-radius * 0.7, height / 2 - 0.5, radius * 0.6]} rotation={[0, 0.4, 0]}>
        <planeGeometry args={[0.08, height * 0.88]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ============================================================================
// 2. REALISTIC TITRATION BURETTE WITH ROTATING STOPCOCK VALVE
// ============================================================================

export interface GlasswareBuretteProps {
  liquidHeightRatio?: number; // 0..1
  liquidColor?: THREE.Color;
  valveOpen?: boolean;
  position?: [number, number, number];
}

export function GlasswareBurette({
  liquidHeightRatio = 0.8,
  liquidColor = new THREE.Color('#f5d0fe'),
  valveOpen = false,
  position = [0, 0, 0],
}: GlasswareBuretteProps) {
  const valveRef = useRef<THREE.Mesh>(null);
  const targetRotationZ = valveOpen ? Math.PI / 2 : 0;

  useFrame(() => {
    if (valveRef.current) {
      valveRef.current.rotation.z = THREE.MathUtils.lerp(
        valveRef.current.rotation.z,
        targetRotationZ,
        0.2
      );
    }
  });

  return (
    <group position={position}>
      {/* Tall graduated glass column */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 2.8, 24, 1, true]} />
        <meshPhysicalMaterial
          color="#dbeafe"
          transmission={0.92}
          opacity={0.35}
          transparent
          roughness={0.05}
          ior={1.47}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Internal Liquid Column inside burette */}
      <mesh position={[0, -0.2 + (liquidHeightRatio * 2.6) / 2, 0]}>
        <cylinderGeometry args={[0.13, 0.13, Math.max(0.01, liquidHeightRatio * 2.6), 20]} />
        <meshStandardMaterial
          color={liquidColor}
          transparent
          opacity={0.85}
          roughness={0.1}
        />
      </mesh>

      {/* Etched graduation ticks along burette */}
      {[-0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4].map((yVal, idx) => (
        <mesh key={idx} position={[0.16, yVal, 0]}>
          <boxGeometry args={[0.01, 0.01, 0.08]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Stopcock valve housing & rotating lever */}
      <group position={[0, -0.3, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.4, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh ref={valveRef} position={[0, 0, 0.18]}>
          <boxGeometry args={[0.08, 0.45, 0.06]} />
          <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.4} />
        </mesh>
      </group>

      {/* Narrow nozzle tip at bottom */}
      <mesh position={[0, -0.65, 0]}>
        <coneGeometry args={[0.08, 0.35, 16]} />
        <meshPhysicalMaterial color="#bfdbfe" transmission={0.9} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// ============================================================================
// 3. REALISTIC LIQUID FILL WITH CONCAVE CURVED MENISCUS & BLOOM EFFECT
// ============================================================================

export interface LiquidFillRealisticProps {
  volumeRef: React.MutableRefObject<number>;
  maxCapacity: number;
  containerRadius: number;
  containerHeight: number;
  colorRef: React.MutableRefObject<THREE.Color>;
  offsetY?: number;
  position?: [number, number, number];
  isStirringRef?: React.MutableRefObject<boolean>;
  stirVelocityRef?: React.MutableRefObject<number>;
  bloomProgressRef?: React.MutableRefObject<number>; // 0..1 for indicator diffusion bloom
}

export function LiquidFill({
  volumeRef,
  maxCapacity,
  containerRadius,
  containerHeight,
  colorRef,
  offsetY = 0,
  position = [0, 0, 0],
  isStirringRef,
  stirVelocityRef,
  bloomProgressRef,
}: LiquidFillRealisticProps) {
  const cylinderRef = useRef<THREE.Mesh>(null!);
  const meniscusRef = useRef<THREE.Mesh>(null!);
  const bloomMeshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const meniscusMatRef = useRef<THREE.MeshStandardMaterial>(null!);

  const easeLevelRef = useRef<number>(0);

  useFrame((state, delta) => {
    if (!cylinderRef.current) return;
    const vol = volumeRef.current || 0;
    const targetRatio = THREE.MathUtils.clamp(vol / maxCapacity, 0, 1);

    // Ease-out cubic interpolation so filling decelerates naturally near target volume
    easeLevelRef.current = THREE.MathUtils.damp(easeLevelRef.current, targetRatio, 9.0, delta);

    const currentHeight = easeLevelRef.current * containerHeight;
    const baseRadius = containerRadius * 0.94;

    // Anchor at base and scale upward
    cylinderRef.current.scale.set(1, Math.max(currentHeight, 0.001), 1);
    cylinderRef.current.position.set(
      position[0],
      position[1] + offsetY + currentHeight / 2,
      position[2]
    );

    // Meniscus top cap positioned exactly at the liquid surface
    if (meniscusRef.current) {
      const surfaceY = position[1] + offsetY + currentHeight;
      meniscusRef.current.position.set(position[0], surfaceY, position[2]);

      // Add gentle wave ripple / stir wobble to meniscus
      const stirVel = stirVelocityRef?.current || 0;
      const isStirring = isStirringRef?.current || false;
      const rippleFreq = isStirring ? 25 : 4;
      const rippleAmp = isStirring ? 0.015 : 0.003;
      const wobble = Math.sin(state.clock.elapsedTime * rippleFreq) * rippleAmp;
      meniscusRef.current.position.y += wobble;

      meniscusRef.current.visible = vol > 0.5;
    }

    // Indicator Diffusion Bloom ring effect
    if (bloomMeshRef.current && bloomProgressRef) {
      const prog = bloomProgressRef.current || 0;
      if (prog > 0 && prog < 1) {
        bloomMeshRef.current.visible = true;
        bloomMeshRef.current.position.set(
          position[0],
          position[1] + offsetY + currentHeight - 0.02,
          position[2]
        );
        const bloomRadius = THREE.MathUtils.lerp(0.1, baseRadius * 0.9, prog);
        bloomMeshRef.current.scale.set(bloomRadius, 1, bloomRadius);
      } else {
        bloomMeshRef.current.visible = false;
      }
    }

    // Color sync
    if (matRef.current && colorRef.current) {
      matRef.current.color.copy(colorRef.current);
      matRef.current.emissive.copy(colorRef.current);
      matRef.current.emissiveIntensity = 0.25;
    }
    if (meniscusMatRef.current && colorRef.current) {
      meniscusMatRef.current.color.copy(colorRef.current);
      meniscusMatRef.current.emissive.copy(colorRef.current);
      meniscusMatRef.current.emissiveIntensity = 0.35;
    }

    cylinderRef.current.visible = vol > 0.2;
  });

  return (
    <group>
      {/* Main Liquid Column */}
      <mesh ref={cylinderRef} position={[position[0], position[1] + offsetY, position[2]]}>
        <cylinderGeometry args={[containerRadius * 0.94, containerRadius * 0.92, 1, 32]} />
        <meshStandardMaterial
          ref={matRef}
          transparent
          opacity={0.88}
          roughness={0.12}
          metalness={0.08}
          color={colorRef.current}
        />
      </mesh>

      {/* Concave Curved Meniscus Disk (Slight dip in center) */}
      <mesh ref={meniscusRef} visible={false}>
        <cylinderGeometry args={[containerRadius * 0.94, containerRadius * 0.94, 0.04, 32]} />
        <meshStandardMaterial
          ref={meniscusMatRef}
          transparent
          opacity={0.92}
          roughness={0.08}
          metalness={0.1}
          color={colorRef.current}
        />
      </mesh>

      {/* Localized Indicator Diffusion Bloom Disk */}
      <mesh ref={bloomMeshRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#ff44ec" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

// ============================================================================
// 4. REALISTIC POUR STREAM WITH SURFACE IMPACT RIPPLES
// ============================================================================

export interface PourStreamRealisticProps {
  isPouringRef: React.MutableRefObject<boolean>;
  sourcePositionRef: React.MutableRefObject<THREE.Vector3>;
  targetYRef: React.MutableRefObject<number>;
  colorRef: React.MutableRefObject<THREE.Color>;
  streamRadius?: number;
}

export function PourStream({
  isPouringRef,
  sourcePositionRef,
  targetYRef,
  colorRef,
  streamRadius = 0.03,
}: PourStreamRealisticProps) {
  const streamMeshRef = useRef<THREE.Mesh>(null!);
  const rippleMeshRef = useRef<THREE.Mesh>(null!);
  const streamMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const rippleMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const rippleScaleRef = useRef<number>(0);

  // Droplet particle pool
  const dropletsRef = useRef<THREE.Mesh[]>([]);

  useFrame((state, delta) => {
    if (!streamMeshRef.current) return;

    if (!isPouringRef.current) {
      streamMeshRef.current.visible = false;
      if (rippleMeshRef.current) rippleMeshRef.current.visible = false;
      return;
    }

    streamMeshRef.current.visible = true;
    const source = sourcePositionRef.current;
    const targetY = targetYRef.current;
    const dropHeight = Math.max(source.y - targetY, 0.05);

    // Micro-wobble sine wave on pour stream
    const wobbleX = Math.sin(state.clock.elapsedTime * 30) * 0.015;
    const wobbleZ = Math.cos(state.clock.elapsedTime * 25) * 0.015;

    // Position stream between spout and current liquid surface
    streamMeshRef.current.position.set(
      source.x + wobbleX,
      source.y - dropHeight / 2,
      source.z + wobbleZ
    );
    // Tapering scale: slightly narrower near bottom impact point
    streamMeshRef.current.scale.set(1, dropHeight, 1);

    // Animate radial impact ripple on receiving liquid surface
    if (rippleMeshRef.current) {
      rippleMeshRef.current.visible = true;
      rippleMeshRef.current.position.set(source.x, targetY + 0.01, source.z);

      rippleScaleRef.current = (rippleScaleRef.current + delta * 3.5) % 1.0;
      const rScale = THREE.MathUtils.lerp(0.05, 0.35, rippleScaleRef.current);
      rippleMeshRef.current.scale.set(rScale, rScale, rScale);

      if (rippleMatRef.current) {
        rippleMatRef.current.opacity = (1.0 - rippleScaleRef.current) * 0.75;
      }
    }

    if (streamMatRef.current && colorRef.current) {
      streamMatRef.current.color.copy(colorRef.current);
    }
    if (rippleMatRef.current && colorRef.current) {
      rippleMatRef.current.color.copy(colorRef.current);
    }
  });

  return (
    <group>
      {/* Tapering Falling Stream (Wider at spout, narrow at impact) */}
      <mesh ref={streamMeshRef} visible={false}>
        <cylinderGeometry args={[streamRadius * 0.75, streamRadius * 1.1, 1, 16]} />
        <meshBasicMaterial ref={streamMatRef} transparent opacity={0.92} color={colorRef.current} />
      </mesh>

      {/* Surface Impact Ripple Ring */}
      <mesh ref={rippleMeshRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 1.0, 24]} />
        <meshBasicMaterial ref={rippleMatRef} transparent opacity={0.7} color={colorRef.current} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ============================================================================
// 5. STIRRING / SWIRL TURBULENCE VORTEX
// ============================================================================

export interface SwirlEffectProps {
  isSwirlingRef: React.MutableRefObject<boolean>;
  position: [number, number, number];
  radius: number;
  height?: number;
  colorRef: React.MutableRefObject<THREE.Color>;
}

export function SwirlEffect({
  isSwirlingRef,
  position,
  radius,
  colorRef,
}: SwirlEffectProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const swirlSpeedRef = useRef<number>(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const isSwirling = isSwirlingRef.current;

    // Decay smoothly over ~1 second when stirring stops
    swirlSpeedRef.current = THREE.MathUtils.lerp(
      swirlSpeedRef.current,
      isSwirling ? 12 : 0,
      delta * (isSwirling ? 8 : 2.5)
    );

    if (swirlSpeedRef.current < 0.05) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    groupRef.current.rotation.y += delta * swirlSpeedRef.current;
    groupRef.current.position.set(
      position[0],
      position[1] + Math.sin(state.clock.elapsedTime * 18) * 0.015,
      position[2]
    );
  });

  return (
    <group ref={groupRef} position={position} visible={false}>
      {[-0.04, 0, 0.04].map((yOff, i) => (
        <mesh key={i} position={[0, yOff, 0]} rotation={[0.15 * (i + 1), 0, 0]}>
          <torusGeometry args={[radius * (0.55 + i * 0.15), 0.018, 12, 32]} />
          <meshBasicMaterial color={colorRef.current} transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// 6. MULTI-LAYER SPECTRAL FLAME & EMBER PARTICLES (FLAME TEST)
// ============================================================================

export interface LayeredFlameProps {
  targetColor: string; // Active metal emission hex (e.g. #ffb700, #00ffc8, #d8b4fe, #0099ff)
  isLit?: boolean;
  position?: [number, number, number];
}

export function LayeredFlame({
  targetColor,
  isLit = true,
  position = [0, 0, 0],
}: LayeredFlameProps) {
  const innerCoreRef = useRef<THREE.Mesh>(null!);
  const outerEnvelopeRef = useRef<THREE.Mesh>(null!);
  const innerColorRef = useRef<THREE.Color>(new THREE.Color('#00f2ff'));
  const outerColorRef = useRef<THREE.Color>(new THREE.Color(targetColor));
  const lightRef = useRef<THREE.PointLight>(null!);

  // Ember particles
  const particleGroupRef = useRef<THREE.Group>(null!);
  const particleCount = 18;
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map(() => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 0.25,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 0.25
      ),
      speedY: 1.2 + Math.random() * 1.4,
      driftX: (Math.random() - 0.5) * 0.4,
      life: Math.random(),
    }));
  }, []);

  useFrame((state, delta) => {
    if (!innerCoreRef.current || !isLit) return;

    // Smooth 300-400ms cross-fade into metal emission spectra
    const targetObj = new THREE.Color(targetColor);
    outerColorRef.current.lerp(targetObj, delta * 4.5);

    // Inner core stays high-temperature blue-cyan/white core with a hint of emission
    const baseBlue = new THREE.Color('#38bdf8');
    innerColorRef.current.lerp(baseBlue.clone().lerp(targetObj, 0.35), delta * 4.5);

    // Non-periodic organic flicker using multiple prime harmonic frequencies
    const t = state.clock.elapsedTime;
    const flicker1 = Math.sin(t * 19.3) * 0.08;
    const flicker2 = Math.cos(t * 27.7) * 0.06;
    const flicker3 = Math.sin(t * 13.1) * 0.05;
    const totalFlicker = flicker1 + flicker2 + flicker3;

    innerCoreRef.current.scale.set(
      1 + flicker2 * 0.6,
      1 + flicker1 * 1.2,
      1 + flicker3 * 0.6
    );

    outerEnvelopeRef.current.scale.set(
      1 + flicker1 * 0.8,
      1 + totalFlicker * 1.5,
      1 + flicker2 * 0.8
    );

    if (lightRef.current) {
      lightRef.current.color.copy(outerColorRef.current);
      lightRef.current.intensity = 2.4 + totalFlicker * 0.8;
    }

    // Update rising spectral ember particles
    if (particleGroupRef.current) {
      particleGroupRef.current.children.forEach((child, i) => {
        const p = particles[i];
        p.pos.y += p.speedY * delta;
        p.pos.x += p.driftX * delta;
        p.life -= delta * 0.9;

        if (p.life <= 0 || p.pos.y > 1.8) {
          p.pos.set((Math.random() - 0.5) * 0.2, 0.1, (Math.random() - 0.5) * 0.2);
          p.life = 1.0;
        }

        child.position.copy(p.pos);
        const scale = THREE.MathUtils.lerp(0.04, 0.005, 1.0 - p.life);
        child.scale.set(scale, scale, scale);
      });
    }
  });

  if (!isLit) return null;

  return (
    <group position={position}>
      {/* 1. Inner Reducing Core (High temperature, narrower) */}
      <mesh ref={innerCoreRef} position={[0, 0.45, 0]}>
        <coneGeometry args={[0.18, 0.85, 20]} />
        <meshBasicMaterial color={innerColorRef.current} transparent opacity={0.88} />
      </mesh>

      {/* 2. Outer Oxidizing Flame Envelope (Ion emission color) */}
      <mesh ref={outerEnvelopeRef} position={[0, 0.65, 0]}>
        <coneGeometry args={[0.32, 1.35, 24]} />
        <meshBasicMaterial color={outerColorRef.current} transparent opacity={0.65} />
      </mesh>

      {/* 3. Dynamic Spectral Point Light */}
      <pointLight ref={lightRef} color={targetColor} intensity={2.5} distance={6} position={[0, 0.6, 0]} />

      {/* 4. Rising Spectral Embers Pool */}
      <group ref={particleGroupRef}>
        {particles.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color={outerColorRef.current} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ============================================================================
// 7. HELPER UTILITIES
// ============================================================================

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
  const weight = Math.min(1, Math.max(0, incomingVolume / totalVolume));
  colorRef.current.lerp(incomingColor, weight);
}

/**
 * Flow rate (ml/s) calculation based on container tilt angle in degrees.
 * Starts past 28 deg threshold, reaching full flow at 60 deg.
 */
export function calculateFlowRate(tiltAngleDeg: number, maxRate = 32): number {
  if (tiltAngleDeg < 28) return 0;
  const progress = Math.min(1, Math.max(0, (tiltAngleDeg - 28) / 32));
  return maxRate * Math.pow(progress, 1.4); // Quadratic flow ramp
}

