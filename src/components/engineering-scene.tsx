"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type SceneVariant = "project" | "process" | "cta";

const projectForms = [
  [
    [-1.35, 0.45, 0],
    [0, 0.45, 0],
    [1.35, 0.45, 0],
    [-0.65, -0.8, 0],
    [0.65, -0.8, 0],
  ],
  [
    [-1.2, 0, 0],
    [0, 0.85, 0],
    [1.2, 0, 0],
    [-0.7, -0.9, 0],
    [0.7, -0.9, 0],
  ],
  [
    [-1.3, 0.75, 0],
    [0, 0.75, 0],
    [1.3, 0.75, 0],
    [-1.3, -0.75, 0],
    [0, -0.75, 0],
    [1.3, -0.75, 0],
  ],
] as const;

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function ProjectAssembly({ index, active, reducedMotion }: { index: number; active: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const progress = useRef(reducedMotion ? 1 : 0);
  const positions = projectForms[index % projectForms.length];

  useFrame((state, delta) => {
    if (!group.current || reducedMotion) return;
    progress.current = THREE.MathUtils.damp(progress.current, active ? 1 : 0, 4, delta);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, state.pointer.x * 0.16, 4, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -state.pointer.y * 0.1, 4, delta);
  });

  return (
    <group ref={group} rotation={[-0.18, -0.22, 0.04]}>
      {positions.map((position, partIndex) => (
        <Part key={partIndex} position={position} index={partIndex} progress={progress} solid={partIndex === index % positions.length} />
      ))}
      <mesh position={[0, 0, -0.38]}>
        <boxGeometry args={[3.9, 2.75, 0.12]} />
        <meshBasicMaterial color="#3f63af" transparent opacity={0.08} wireframe />
      </mesh>
    </group>
  );
}

function Part({ position, index, progress, solid }: { position: readonly [number, number, number]; index: number; progress: React.RefObject<number>; solid: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const directionZ = index % 2 ? 0.5 : -0.35;
  const directionLength = Math.hypot(position[0], position[1], directionZ) || 1;
  const directionX = position[0] / directionLength;
  const directionY = position[1] / directionLength;

  useFrame(() => {
    if (!ref.current) return;
    const separation = (1 - progress.current) * 0.5;
    ref.current.position.set(
      position[0] + directionX * separation,
      position[1] + directionY * separation,
      (directionZ / directionLength) * separation,
    );
    ref.current.rotation.z = (1 - progress.current) * (index % 2 ? 0.08 : -0.08);
  });

  return (
    <mesh ref={ref}>
      {index % 3 === 0 ? <cylinderGeometry args={[0.5, 0.5, 0.34, 8]} /> : <boxGeometry args={[0.92, 0.72, 0.34]} />}
      <meshStandardMaterial
        color={solid ? "#fe904d" : "#3f63af"}
        emissive={solid ? "#fe904d" : "#070d1f"}
        emissiveIntensity={0.18}
        metalness={0.55}
        roughness={0.4}
        wireframe={!solid}
        transparent={!solid}
        opacity={solid ? 1 : 0.72}
      />
    </mesh>
  );
}

function ProcessMechanism({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const gears = useRef<Array<THREE.Group | null>>([]);

  useFrame((state, delta) => {
    if (!group.current || reducedMotion || !active) return;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -0.18 - state.pointer.y * 0.05, 4, delta);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, -0.25 + state.pointer.x * 0.08, 4, delta);
    gears.current.forEach((gear, index) => {
      if (gear) gear.rotation.z += delta * (index % 2 ? -0.16 : 0.16);
    });
  });

  return (
    <group ref={group} rotation={[-0.18, -0.25, 0]}>
      {[-1.55, -0.52, 0.52, 1.55].map((x, index) => (
        <group key={x} position={[x, index % 2 ? -0.18 : 0.18, 0]}>
          <group ref={(node) => { gears.current[index] = node; }}>
            <mesh><torusGeometry args={[0.43, 0.12, 10, 12]} /><meshStandardMaterial color={index === 3 ? "#fe904d" : "#3f63af"} metalness={0.65} roughness={0.36} /></mesh>
            <mesh><boxGeometry args={[0.7, 0.07, 0.08]} /><meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.55} /></mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.7, 0.07, 0.08]} /><meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.55} /></mesh>
          </group>
          <mesh position={[0, 0, -0.02]}>
            <cylinderGeometry args={[0.11, 0.11, 0.3, 16]} />
            <meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.55} />
          </mesh>
          {index < 3 ? (
            <mesh position={[0.52, index % 2 ? 0.18 : -0.18, -0.08]} rotation={[0, 0, index % 2 ? 0.16 : -0.16]}>
              <boxGeometry args={[0.82, 0.08, 0.08]} />
              <meshStandardMaterial color="#3f63af" metalness={0.5} roughness={0.45} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}

function CtaAssembly({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, -0.45 + state.pointer.x * 0.12, 4, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -0.25 - state.pointer.y * 0.07, 4, delta);
  });

  return (
    <group ref={group} rotation={[-0.25, -0.45, 0.08]}>
      <mesh>
        <cylinderGeometry args={[1.18, 1.18, 0.42, 12]} />
        <meshBasicMaterial color="#3f63af" transparent opacity={0.42} wireframe />
      </mesh>
      <mesh position={[0, 0, 0.37]}>
        <torusGeometry args={[0.72, 0.14, 10, 16]} />
        <meshBasicMaterial color="#fe904d" transparent opacity={0.55} wireframe />
      </mesh>
      <mesh position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 1.35, 16]} />
        <meshBasicMaterial color="#3f63af" transparent opacity={0.35} wireframe />
      </mesh>
    </group>
  );
}

export default function EngineeringScene({ variant, projectIndex = 0, className = "" }: { variant: SceneVariant; projectIndex?: number; className?: string }) {
  const [active, setActive] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  return (
    <div
      className={className}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      aria-hidden="true"
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={active && !reducedMotion ? "always" : "demand"}
        camera={{ position: [0, 0, 7], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 5, 7]} intensity={3.2} color="#ffffff" />
        <directionalLight position={[-4, -2, 3]} intensity={1.4} color="#3f63af" />
        {variant === "project" ? <ProjectAssembly index={projectIndex} active={active || reducedMotion} reducedMotion={reducedMotion} /> : null}
        {variant === "process" ? <ProcessMechanism active={active} reducedMotion={reducedMotion} /> : null}
        {variant === "cta" ? <CtaAssembly reducedMotion={reducedMotion} /> : null}
      </Canvas>
    </div>
  );
}
