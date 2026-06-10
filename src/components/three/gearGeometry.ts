import * as THREE from "three";

export type GearParams = {
  teeth: number;
  /** Pitch-ish radius to the tooth root circle. */
  radius: number;
  /** Radial height of each tooth above the root circle. */
  toothDepth: number;
  /** Extrusion thickness. */
  thickness: number;
  /** Circular bore radius (0 = solid disc). */
  bore?: number;
};

/**
 * Procedural involute-approximate gear: trapezoidal teeth on a root circle,
 * matching the chunky 12-tooth silhouette of the MECG logo mark. Built as a
 * THREE.Shape (with an optional bore hole) and extruded with a small bevel so
 * rim lighting catches the tooth edges.
 */
export function createGearGeometry({
  teeth,
  radius,
  toothDepth,
  thickness,
  bore = 0,
}: GearParams): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const tipRadius = radius + toothDepth;
  const step = (Math.PI * 2) / teeth;
  // Tooth occupies ~46% of the pitch, gap ~54%; tip is narrower than the
  // base so each tooth reads as a trapezoid (logo silhouette).
  const rootHalf = step * 0.23;
  const tipHalf = step * 0.15;

  for (let i = 0; i < teeth; i++) {
    const center = i * step;
    const gapEnd = center - rootHalf;
    const tipStart = center - tipHalf;
    const tipEnd = center + tipHalf;
    const rootEnd = center + rootHalf;

    if (i === 0) {
      shape.moveTo(Math.cos(gapEnd) * radius, Math.sin(gapEnd) * radius);
    } else {
      // Root arc from the previous tooth's trailing edge to this tooth.
      shape.absarc(0, 0, radius, center - step + rootHalf, gapEnd, false);
    }

    shape.lineTo(Math.cos(tipStart) * tipRadius, Math.sin(tipStart) * tipRadius);
    shape.absarc(0, 0, tipRadius, tipStart, tipEnd, false);
    shape.lineTo(Math.cos(rootEnd) * radius, Math.sin(rootEnd) * radius);
  }

  // Close the final root arc back to the first tooth's leading edge.
  shape.absarc(0, 0, radius, (teeth - 1) * step + rootHalf, -rootHalf, false);

  if (bore > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.08,
    bevelSize: thickness * 0.06,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.center();
  return geometry;
}
