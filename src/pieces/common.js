// Shared geometry helpers for piece sets. Units: 1 = one board square.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

const geoCache = new Map();
export function cached(key, fn) {
  if (!geoCache.has(key)) geoCache.set(key, fn());
  return geoCache.get(key);
}

// Smooth lathe from [radius, height] control points using a Catmull-Rom spline.
export function lathe(points, { segments = 40, samples = 80, smooth = true } = {}) {
  let pts = points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  if (smooth) {
    const curve = new THREE.SplineCurve(pts);
    pts = curve.getPoints(samples);
  }
  // Close the bottom and top on the axis for solid looking pieces.
  pts.unshift(new THREE.Vector2(0.0001, points[0][1]));
  pts.push(new THREE.Vector2(0.0001, points[points.length - 1][1]));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

// Lathe that keeps crisp corners: every profile segment is its own band.
export function latheSharp(points, segments = 40) {
  const pts = [[0.0001, points[0][1]], ...points, [0.0001, points[points.length - 1][1]]];
  const bands = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) continue;
    const g = new THREE.LatheGeometry([new THREE.Vector2(Math.max(a[0], 0.0001), a[1]), new THREE.Vector2(Math.max(b[0], 0.0001), b[1])], segments);
    bands.push(g.index ? g.toNonIndexed() : g);
  }
  const g = mergeGeometries(bands);
  // Few segments = faceted prism (flat normals); many = round (keep the lathe's own normals).
  if (segments <= 12) g.computeVertexNormals();
  return g;
}

// Round out an extruded silhouette: thicker at the neck, narrower toward the nose and ears.
export function taperHorse(g) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nose = THREE.MathUtils.smoothstep(x, -0.05, 0.42);
    const top = THREE.MathUtils.smoothstep(y, 0.75, 1.0);
    const k = 1.35 - nose * 0.65 - top * 0.4;
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// Classic horse-head silhouette (x forward, y up), normalised to ~1 unit tall.
export function horseShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0);
  s.bezierCurveTo(-0.34, 0.25, -0.33, 0.45, -0.24, 0.62); // back of neck
  s.bezierCurveTo(-0.2, 0.72, -0.16, 0.8, -0.12, 0.86); // mane
  s.lineTo(-0.1, 0.98); // ear tip
  s.lineTo(-0.02, 0.86);
  s.bezierCurveTo(0.06, 0.86, 0.14, 0.8, 0.2, 0.7); // forehead
  s.bezierCurveTo(0.27, 0.6, 0.34, 0.52, 0.38, 0.45); // nose bridge
  s.bezierCurveTo(0.41, 0.4, 0.39, 0.33, 0.33, 0.31); // muzzle
  s.bezierCurveTo(0.26, 0.29, 0.2, 0.33, 0.14, 0.39); // mouth / jaw
  s.bezierCurveTo(0.06, 0.42, 0.0, 0.36, 0.03, 0.27); // throat
  s.bezierCurveTo(0.1, 0.18, 0.22, 0.12, 0.24, 0.0); // chest
  s.lineTo(-0.3, 0);
  return s;
}

// Angular / low-poly horse silhouette for modern & cyberpunk sets.
export function angularHorseShape() {
  const s = new THREE.Shape();
  const pts = [[-0.3, 0], [-0.3, 0.55], [-0.15, 0.85], [-0.1, 1.0], [0.0, 0.86], [0.16, 0.8], [0.4, 0.5], [0.36, 0.36], [0.12, 0.4], [0.02, 0.3], [0.24, 0]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  s.lineTo(pts[0][0], pts[0][1]);
  return s;
}

export function extrudeShape(shape, depth, bevel = 0.03, curveSegments = 18) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

export function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Facing: white pieces look toward black (−z), black toward white (+z).
export function faceRotation(color) {
  return color === 'w' ? Math.PI / 2 : -Math.PI / 2;
}
