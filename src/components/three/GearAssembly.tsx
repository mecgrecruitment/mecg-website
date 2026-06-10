"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createGearGeometry } from "./gearGeometry";

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
};

/**
 * The MECG signature scene: the 12-tooth logo gear driving two partners —
 * one solid (the machine), one wireframe (the drawing). Scroll advances the
 * drivetrain; the pointer tilts the whole assembly like a part under
 * inspection. With `animated=false` the assembly holds a composed static pose.
 */
export default function GearAssembly({ animated }: GearAssemblyProps) {
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
    }
  });

  return (
    <group ref={groupRef} rotation={[-0.42, 0.12, 0.08]}>
      {/* Lighting: hot maize rim from behind-right, cold blue fill, low ambient. */}
      <ambientLight intensity={0.18} />
      <directionalLight position={[6, 4, 6]} intensity={1.1} color="#f5823a" />
      <directionalLight position={[-7, -2, 4]} intensity={0.5} color="#4168b1" />
      <pointLight position={[0, 0, 5]} intensity={9} color="#ffb072" distance={14} decay={2} />

      {/* A — the drive gear (the logo mark, solid machined metal). */}
      <group ref={gearARef}>
        <mesh geometry={geomA}>
          <meshStandardMaterial color="#13233f" metalness={0.9} roughness={0.32} />
        </mesh>
        {/* Floating hub inside the bore, like the 2D mark's center disc. */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[GEAR_A.radius * 0.34, GEAR_A.radius * 0.34, 0.62, 36]} />
          <meshStandardMaterial color="#f5823a" metalness={0.65} roughness={0.3} />
        </mesh>
      </group>

      {/* B — the pinion (small, fast, solid). */}
      <group ref={gearBRef} position={POS_B}>
        <mesh geometry={geomB}>
          <meshStandardMaterial color="#1b3257" metalness={0.88} roughness={0.36} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[GEAR_B.radius * 0.26, GEAR_B.radius * 0.26, 0.54, 28]} />
          <meshStandardMaterial color="#9dbdfa" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* C — the ring gear, drawn not built: blueprint wireframe. */}
      <group ref={gearCRef} position={POS_C}>
        <lineSegments geometry={edgesC}>
          <lineBasicMaterial color="#f5823a" transparent opacity={0.38} />
        </lineSegments>
      </group>
    </group>
  );
}
