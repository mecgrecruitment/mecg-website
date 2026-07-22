"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createGearGeometry } from "./gearGeometry";
import type { GearFocus } from "./types";

// Shared tooth pitch so all gears mesh: pitch = 2πr / N must match.
const PITCH = (Math.PI * 2 * 1.7) / 12;
const TOOTH = 0.32;
const radiusFor = (teeth: number) => (PITCH * teeth) / (Math.PI * 2);

const GEAR_A = { teeth: 12, radius: radiusFor(12) }; // the logo gear
const GEAR_B = { teeth: 8, radius: radiusFor(8) };
const GEAR_C = { teeth: 16, radius: radiusFor(16) };

// Line-of-centers angle from A, and meshing distance (roots + one tooth).
const meshDistance = (a: { radius: number }, b: { radius: number }) =>
  a.radius + b.radius + TOOTH + 0.02;

const PHI_B = Math.PI * 0.78; // B sits upper-left of A
const PHI_C = Math.PI * 1.32; // C sits lower-left, half offstage

const POS_B: [number, number, number] = [
  Math.cos(PHI_B) * meshDistance(GEAR_A, GEAR_B),
  Math.sin(PHI_B) * meshDistance(GEAR_A, GEAR_B),
  0,
];
const POS_C: [number, number, number] = [
  Math.cos(PHI_C) * meshDistance(GEAR_A, GEAR_C),
  Math.sin(PHI_C) * meshDistance(GEAR_A, GEAR_C),
  0,
];

/** Rotation for a gear meshed with the driver at line-of-centers angle phi. */
function meshedRotation(thetaDriver: number, nDriver: number, nDriven: number, phi: number) {
  const ratio = nDriver / nDriven;
  return -ratio * thetaDriver + (1 + ratio) * phi + Math.PI / nDriven;
}

type GearAssemblyProps = {
  animated: boolean;
  focus: GearFocus;
};

/**
 * The MECG signature scene: the 12-tooth logo gear driving two partners —
 * one solid (the machine), one wireframe (the drawing). Scroll advances the
 * drivetrain; the pointer tilts the whole assembly like a part under
 * inspection. With `animated=false` the assembly holds a composed static pose.
 */
export default function GearAssembly({ animated, focus }: GearAssemblyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gearARef = useRef<THREE.Group>(null);
  const gearBRef = useRef<THREE.Group>(null);
  const gearCRef = useRef<THREE.Group>(null);

  const geomA = useMemo(
    () =>
      createGearGeometry({
        ...GEAR_A,
        toothDepth: TOOTH,
        thickness: 0.5,
        bore: GEAR_A.radius * 0.62,
      }),
    []
  );
  const geomB = useMemo(
    () =>
      createGearGeometry({
        ...GEAR_B,
        toothDepth: TOOTH,
        thickness: 0.42,
        bore: GEAR_B.radius * 0.5,
      }),
    []
  );
  const geomC = useMemo(
    () =>
      createGearGeometry({
        ...GEAR_C,
        toothDepth: TOOTH,
        thickness: 0.34,
        bore: GEAR_C.radius * 0.72,
      }),
    []
  );

  const edgesC = useMemo(() => new THREE.EdgesGeometry(geomC, 12), [geomC]);

  useFrame((state, delta) => {
    if (!animated) return;

    const scroll = typeof window === "undefined" ? 0 : window.scrollY;
    const theta = state.clock.elapsedTime * 0.22 + scroll * 0.0035;

    if (gearARef.current) gearARef.current.rotation.z = theta;
    if (gearBRef.current)
      gearBRef.current.rotation.z = meshedRotation(theta, GEAR_A.teeth, GEAR_B.teeth, PHI_B);
    if (gearCRef.current)
      gearCRef.current.rotation.z = meshedRotation(theta, GEAR_A.teeth, GEAR_C.teeth, PHI_C);

    if (groupRef.current) {
      const targetY = state.pointer.x * 0.22;
      const targetX = -0.42 - state.pointer.y * 0.14;
      groupRef.current.rotation.y +=
        (targetY - groupRef.current.rotation.y) * Math.min(1, delta * 3);
      groupRef.current.rotation.x +=
        (targetX - groupRef.current.rotation.x) * Math.min(1, delta * 3);
      const targetScale = focus === "strategy" ? 1 : focus === "analysis" ? 1.04 : 0.96;
      const nextScale = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, Math.min(1, delta * 4));
      groupRef.current.scale.setScalar(nextScale);
    }
  });

  return (
    <group ref={groupRef} rotation={[-0.42, 0.12, 0.08]}>
      {/* Lighting: a hemisphere base for soft gradient ambient, a strong warm
          key from front-right for crisp metallic highlights, a cool blue fill,
          an orange rim from behind to lift the gears off the dark field, and a
          warm core glow that catches the hub. */}
      <hemisphereLight args={["#8aa4dd", "#1a1206", 0.5]} />
      <ambientLight intensity={0.1} />
      <directionalLight position={[5, 6, 8]} intensity={2.6} color="#fff1dd" />
      <directionalLight position={[-7, -1, 4]} intensity={0.7} color="#4168b1" />
      <directionalLight position={[-5, 4, -7]} intensity={1.9} color="#f5823a" />
      <pointLight position={[0.5, 0.5, 4.5]} intensity={6} color="#ffb072" distance={16} decay={2} />

      {/* A — the drive gear (the logo mark, solid machined metal). */}
      <group ref={gearARef}>
        <mesh geometry={geomA}>
          <meshStandardMaterial
            color="#16284a"
            metalness={0.85}
            roughness={0.26}
            emissive="#f5823a"
            emissiveIntensity={0.18}
          />
        </mesh>
        {/* Floating hub inside the bore, like the 2D mark's center disc. */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[GEAR_A.radius * 0.34, GEAR_A.radius * 0.34, 0.62, 36]} />
          <meshStandardMaterial
            color="#f5823a"
            metalness={0.6}
            roughness={0.28}
            emissive="#b84f1c"
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>

      {/* B — the pinion (small, fast, solid). */}
      <group ref={gearBRef} position={POS_B}>
        <mesh geometry={geomB}>
          <meshStandardMaterial
            color="#1b3257"
            metalness={0.88}
            roughness={0.36}
            emissive="#9dbdfa"
            emissiveIntensity={0.34}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[GEAR_B.radius * 0.26, GEAR_B.radius * 0.26, 0.54, 28]} />
          <meshStandardMaterial color="#9dbdfa" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* C — the ring gear, drawn not built: blueprint wireframe. */}
      <group ref={gearCRef} position={POS_C}>
        <lineSegments geometry={edgesC}>
          <lineBasicMaterial color="#ffb072" transparent opacity={0.95} />
        </lineSegments>
      </group>
    </group>
  );
}
