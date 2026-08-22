"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type PointerState = {
  active: boolean;
  position: THREE.Vector2;
  velocity: THREE.Vector2;
};

type GearData = {
  positions: Float32Array;
  entrance: Float32Array;
  exit: Float32Array;
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGearData(
  count: number,
  outerRadius: number,
  teeth: number,
  gearPosition: [number, number, number]
): GearData {
  const random = mulberry32(count * 7919 + teeth);
  const bore = outerRadius * 0.2;
  const positions = new Float32Array(count * 3);
  const entrance = new Float32Array(count * 3);
  const exit = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = random() * Math.PI * 2;
    const tooth = THREE.MathUtils.clamp(Math.sin(teeth * theta) * 4, -1, 1);
    const profile = outerRadius * (1 + 0.13 * tooth);
    const radius = Math.sqrt(
      bore * bore + random() * (profile * profile - bore * bore)
    );
    const index = i * 3;
    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius;

    positions[index] = x;
    positions[index + 1] = y;
    positions[index + 2] = (random() - 0.5) * 0.14;

    const entranceAngle = random() * Math.PI * 2;
    const entranceDistance = 1.2 + random() * 3.2;
    entrance[index] = Math.cos(entranceAngle) * entranceDistance;
    entrance[index + 1] = Math.sin(entranceAngle) * entranceDistance;
    entrance[index + 2] = (random() - 0.5) * 2;

    const worldX = gearPosition[0] + x;
    const worldY = gearPosition[1] + y;
    const magnitude = Math.hypot(worldX, worldY) || 1;
    const exitDistance = 7.5 + random() * 5.5;
    exit[index] = (worldX / magnitude) * exitDistance;
    exit[index + 1] = (worldY / magnitude) * exitDistance;
    exit[index + 2] = (random() - 0.5) * 5;
  }

  return { positions, entrance, exit };
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function Gear({
  count,
  outerRadius,
  teeth,
  color,
  position,
  speed,
  entranceDelay,
  reducedMotion,
  pointerState,
  exiting,
}: {
  count: number;
  outerRadius: number;
  teeth: number;
  color: string;
  position: [number, number, number];
  speed: number;
  entranceDelay: number;
  reducedMotion: boolean;
  pointerState: React.RefObject<PointerState>;
  exiting: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const exitProgress = useRef(0);
  const interaction = useRef(0);
  const pointerLocal = useMemo(() => new THREE.Vector3(), []);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  const interactionPlane = useMemo(() => new THREE.Plane(), []);
  const data = useMemo(
    () => makeGearData(count, outerRadius, teeth, position),
    [count, outerRadius, teeth, position]
  );
  const live = useMemo(() => {
    if (reducedMotion) return data.positions.slice();
    const initial = data.positions.slice();
    for (let i = 0; i < initial.length; i++) initial[i] += data.entrance[i];
    return initial;
  }, [data, reducedMotion]);

  useFrame(({ camera, clock, raycaster }, delta) => {
    const group = groupRef.current;
    const points = pointsRef.current;
    if (!group || !points || reducedMotion) return;

    const pointer = pointerState.current;
    const pointerSpeed = Math.min(pointer.velocity.length(), 0.05);
    group.rotation.z += speed * (1 + pointerSpeed * 14) * delta;

    if (pointer.active && !exiting) {
      raycaster.setFromCamera(pointer.position, camera);
      group.getWorldPosition(worldPosition);
      camera.getWorldDirection(cameraDirection);
      interactionPlane.setFromNormalAndCoplanarPoint(
        cameraDirection,
        worldPosition
      );
      const hit = raycaster.ray.intersectPlane(interactionPlane, pointerLocal);
      if (hit) group.worldToLocal(hit);
    }

    const interactionTarget = pointer.active && !exiting ? 1 : 0;
    interaction.current +=
      (interactionTarget - interaction.current) * (1 - Math.exp(-12 * delta));
    exitProgress.current +=
      ((exiting ? 1 : 0) - exitProgress.current) * (1 - Math.exp(-18 * delta));

    const entranceProgress = THREE.MathUtils.clamp(
      (clock.getElapsedTime() - entranceDelay) / 0.9,
      0,
      1
    );
    const entranceAmount = 1 - easeOutCubic(entranceProgress);
    const exitAmount = easeOutCubic(exitProgress.current);
    const influenceRadius = outerRadius * 0.52;
    const influenceRadiusSq = influenceRadius * influenceRadius;
    const settle = 1 - Math.exp(-20 * delta);
    const attr = points.geometry.attributes.position;
    const array = attr.array as Float32Array;

    for (let i = 0; i < array.length; i += 3) {
      let targetX =
        data.positions[i] +
        data.entrance[i] * entranceAmount +
        data.exit[i] * exitAmount;
      let targetY =
        data.positions[i + 1] +
        data.entrance[i + 1] * entranceAmount +
        data.exit[i + 1] * exitAmount;
      let targetZ =
        data.positions[i + 2] +
        data.entrance[i + 2] * entranceAmount +
        data.exit[i + 2] * exitAmount;

      if (interaction.current > 0.001 && !exiting) {
        const dx = data.positions[i] - pointerLocal.x;
        const dy = data.positions[i + 1] - pointerLocal.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < influenceRadiusSq) {
          const distance = Math.sqrt(distanceSq) || 0.001;
          const falloff = 1 - THREE.MathUtils.smoothstep(
            distance,
            influenceRadius * 0.1,
            influenceRadius
          );
          const push = falloff ** 2 * outerRadius * 0.38 * interaction.current;
          targetX += (dx / distance) * push + pointer.velocity.x * falloff * 4;
          targetY += (dy / distance) * push + pointer.velocity.y * falloff * 4;
          targetZ += falloff * 0.3;
        }
      }

      array[i] += (targetX - array[i]) * settle;
      array[i + 1] += (targetY - array[i + 1]) * settle;
      array[i + 2] += (targetZ - array[i + 2]) * settle;
    }

    attr.needsUpdate = true;
    const material = points.material as THREE.PointsMaterial;
    material.opacity = Math.max(0, 0.55 - exitAmount * 0.4);
  });

  return (
    <group ref={groupRef} position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[live, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.055}
          transparent
          opacity={0.55}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

function ParticleBridge({
  from,
  to,
  color,
  reducedMotion,
  pointerState,
  exiting,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  reducedMotion: boolean;
  pointerState: React.RefObject<PointerState>;
  exiting: boolean;
}) {
  const count = 120;
  const ref = useRef<THREE.Points>(null);
  const base = useMemo(() => {
    const random = mulberry32(Math.round((from[0] - to[1]) * 1000));
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const index = i * 3;
      values[index] = THREE.MathUtils.lerp(from[0], to[0], t) + (random() - 0.5) * 0.08;
      values[index + 1] = THREE.MathUtils.lerp(from[1], to[1], t) + (random() - 0.5) * 0.08;
      values[index + 2] = THREE.MathUtils.lerp(from[2], to[2], t) + (random() - 0.5) * 0.08;
    }
    return values;
  }, [from, to]);
  const live = useMemo(() => base.slice(), [base]);

  useFrame(({ clock }, delta) => {
    const points = ref.current;
    if (!points || reducedMotion) return;
    const attr = points.geometry.attributes.position;
    const array = attr.array as Float32Array;
    const activity = Math.min(pointerState.current.velocity.length() * 24, 1);
    const time = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const index = i * 3;
      const wave = Math.sin(i * 0.2 - time * (2.5 + activity * 5));
      const targetZ = base[index + 2] + wave * (0.025 + activity * 0.09);
      array[index + 2] += (targetZ - array[index + 2]) * (1 - Math.exp(-10 * delta));
    }
    attr.needsUpdate = true;
    (points.material as THREE.PointsMaterial).opacity = THREE.MathUtils.lerp(
      (points.material as THREE.PointsMaterial).opacity,
      exiting ? 0 : 0.42 + activity * 0.38,
      1 - Math.exp(-8 * delta)
    );
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[live, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.035}
        transparent
        opacity={0.42}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

const WIDE_POSITIONS = {
  large: [-3.35, 1.55, -1.4] as [number, number, number],
  medium: [3.15, -1.7, -1.5] as [number, number, number],
  small: [2.35, 2.25, -2.2] as [number, number, number],
};

const COMPACT_POSITIONS = {
  large: [-4.2, 1.55, -1.2] as [number, number, number],
  medium: [3.2, -1.65, -1.35] as [number, number, number],
  small: [2.7, 2.15, -2.1] as [number, number, number],
};

function Scene({
  reducedMotion,
  compact,
  pointerState,
  exiting,
}: {
  reducedMotion: boolean;
  compact: boolean;
  pointerState: React.RefObject<PointerState>;
  exiting: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const scaleTarget = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame(({ viewport }, delta) => {
    if (!group.current || reducedMotion) return;
    const targetScale = compact ? 0.78 : Math.min(1, viewport.width / 10.5);
    const settle = 1 - Math.exp(-7 * delta);
    scaleTarget.setScalar(targetScale);
    group.current.scale.lerp(scaleTarget, settle);
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      pointerState.current.position.x * 0.1,
      settle
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -pointerState.current.position.y * 0.06,
      settle
    );
  });

  const counts = compact ? [4000, 2800, 1700] : [6500, 4400, 2600];
  const positions = compact ? COMPACT_POSITIONS : WIDE_POSITIONS;

  return (
    <group ref={group} scale={compact ? 0.78 : 1}>
      <ParticleBridge
        from={positions.large}
        to={positions.small}
        color="#fe904d"
        reducedMotion={reducedMotion}
        pointerState={pointerState}
        exiting={exiting}
      />
      <Gear
        count={counts[0]}
        outerRadius={2.45}
        teeth={11}
        color="#fe904d"
        position={positions.large}
        speed={-0.075}
        entranceDelay={0.05}
        reducedMotion={reducedMotion}
        pointerState={pointerState}
        exiting={exiting}
      />
      <Gear
        count={counts[1]}
        outerRadius={1.65}
        teeth={9}
        color="#3f63af"
        position={positions.medium}
        speed={0.11}
        entranceDelay={0.1}
        reducedMotion={reducedMotion}
        pointerState={pointerState}
        exiting={exiting}
      />
      <Gear
        count={counts[2]}
        outerRadius={1.05}
        teeth={7}
        color="#3f63af"
        position={positions.small}
        speed={-0.16}
        entranceDelay={0.15}
        reducedMotion={reducedMotion}
        pointerState={pointerState}
        exiting={exiting}
      />
    </group>
  );
}

function subscribeMedia(query: string, callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export default function HeroScene({ exiting = false }: { exiting?: boolean }) {
  const reducedMotion = useSyncExternalStore(
    (callback) => subscribeMedia("(prefers-reduced-motion: reduce)", callback),
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
  const compact = useSyncExternalStore(
    (callback) => subscribeMedia("(max-width: 639px)", callback),
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false
  );
  const pointerState = useRef<PointerState>({
    active: false,
    position: new THREE.Vector2(),
    velocity: new THREE.Vector2(),
  });
  const lastPointer = useRef(new THREE.Vector2());

  useEffect(() => {
    const updatePointer = (event: PointerEvent) => {
      const nextX = (event.clientX / window.innerWidth) * 2 - 1;
      const nextY = -(event.clientY / window.innerHeight) * 2 + 1;
      const state = pointerState.current;
      state.velocity.set(nextX - lastPointer.current.x, nextY - lastPointer.current.y);
      state.position.set(nextX, nextY);
      lastPointer.current.set(nextX, nextY);
      state.active = event.pointerType !== "touch" || event.buttons > 0;
    };
    const activatePointer = (event: PointerEvent) => {
      updatePointer(event);
      pointerState.current.active = true;
    };
    const deactivatePointer = () => {
      pointerState.current.active = false;
    };
    const decayVelocity = () => pointerState.current.velocity.multiplyScalar(0.72);

    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerdown", activatePointer, { passive: true });
    window.addEventListener("pointerup", deactivatePointer, { passive: true });
    window.addEventListener("blur", deactivatePointer);
    const decayTimer = window.setInterval(decayVelocity, 32);
    return () => {
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerdown", activatePointer);
      window.removeEventListener("pointerup", deactivatePointer);
      window.removeEventListener("blur", deactivatePointer);
      window.clearInterval(decayTimer);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <Canvas
        dpr={compact ? 1 : [1, 1.75]}
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{ antialias: !compact, alpha: true, powerPreference: "high-performance" }}
      >
        <Scene
          reducedMotion={reducedMotion}
          compact={compact}
          pointerState={pointerState}
          exiting={exiting}
        />
      </Canvas>
    </div>
  );
}
