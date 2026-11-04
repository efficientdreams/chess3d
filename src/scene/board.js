// The chessboard resting on the stump. Everything inside `root` uses board units
// (1 unit = 1 square); `root` is scaled down to real-world metres.
import * as THREE from 'three';
import { STUMP_TOP } from './environment.js';
import { mulberry32, fbm2 } from './noise.js';
import { FILES } from '../chess/engine.js';

export const BOARD_SCALE = 0.064; // metres per square
const BORDER = 0.62;
const THICK = 0.42;
const HALF = 4 + BORDER;

export function squareToLocal(i, y = 0) {
  return new THREE.Vector3((i & 7) - 3.5, y, 3.5 - (i >> 3));
}

function boardCanvas() {
  const PX = 1024;
  const unit = PX / (HALF * 2);
  const c = document.createElement('canvas');
  c.width = c.height = PX;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(PX, PX);
  const rng = mulberry32(77);
  const sqSeed = Array.from({ length: 64 }, () => rng() * 100);
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      const ux = x / unit - HALF, uy = y / unit - HALF; // board units, uy downwards = towards rank 1
      const i = (y * PX + x) * 4;
      let r, g, b;
      if (Math.abs(ux) < 4 && Math.abs(uy) < 4) {
        const file = Math.floor(ux + 4), rankFromTop = Math.floor(uy + 4);
        const light = (file + rankFromTop) % 2 === 0;
        const s = sqSeed[file * 8 + rankFromTop];
        const horiz = (file + rankFromTop) % 2 === 0;
        const a = horiz ? ux : uy, bb = horiz ? uy : ux;
        const grain = Math.sin((bb * 9 + fbm2(a * 0.6 + s, bb * 3 + s, 3) * 4.0) * 3.0) * 0.5 + 0.5;
        const fine = fbm2(a * 2 + s, bb * 30, 2) * 0.12;
        const v = 0.86 + grain * 0.12 + fine;
        if (light) { r = 226 * v; g = 196 * v; b = 150 * v; } else { r = 104 * v; g = 64 * v; b = 40 * v; }
        // Bevelled edge between squares
        const fx = ux + 4 - file, fy = uy + 4 - rankFromTop;
        const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
        if (edge < 0.012) { r *= 0.7; g *= 0.7; b *= 0.7; }
      } else {
        // Walnut frame with gold inlay line
        const along = Math.abs(ux) > Math.abs(uy) ? uy : ux;
        const grain = Math.sin((along * 2 + fbm2(ux * 0.8, uy * 0.8, 3) * 3) * 6) * 0.5 + 0.5;
        const v = 0.75 + grain * 0.2 + fbm2(ux * 6, uy * 6, 2) * 0.1;
        r = 70 * v; g = 42 * v; b = 26 * v;
        const m = Math.max(Math.abs(ux), Math.abs(uy));
        if ((m > 4.07 && m < 4.11) || (m > HALF - 0.12 && m < HALF - 0.09)) { r = 205; g = 165; b = 80; }
      }
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Coordinates on the frame
  ctx.fillStyle = '#e8cf92';
  ctx.font = `bold ${Math.round(unit * 0.36)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let f = 0; f < 8; f++) {
    const x = (f - 4 + 0.5 + HALF) * unit;
    ctx.fillText(FILES[f], x, (HALF + 4 + BORDER * 0.45) * unit);
    ctx.save();
    ctx.translate(x, (HALF - 4 - BORDER * 0.45) * unit);
    ctx.rotate(Math.PI);
    ctx.fillText(FILES[f], 0, 0);
    ctx.restore();
  }
  for (let r = 0; r < 8; r++) {
    const y = (HALF + 4 - r - 0.5) * unit;
    ctx.fillText(String(r + 1), (HALF - 4 - BORDER * 0.45) * unit, y);
    ctx.save();
    ctx.translate((HALF + 4 + BORDER * 0.45) * unit, y);
    ctx.rotate(Math.PI);
    ctx.fillText(String(r + 1), 0, 0);
    ctx.restore();
  }
  return c;
}

function starShape(outer = 0.32, inner = 0.14, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

export class Board {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.scale.setScalar(BOARD_SCALE);
    this.root.position.set(0, STUMP_TOP + THICK * BOARD_SCALE, 0);
    scene.add(this.root);

    const tex = new THREE.CanvasTexture(boardCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const topMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const sideMat = new THREE.MeshStandardMaterial({ color: '#3d2416', roughness: 0.55 });
    const geo = new THREE.BoxGeometry(HALF * 2, THICK, HALF * 2);
    geo.translate(0, -THICK / 2, 0);
    const mesh = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.root.add(mesh);
    // Small feet
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.2, 12), sideMat);
      foot.position.set(x * (HALF - 0.6), -THICK - 0.1, z * (HALF - 0.6));
      this.root.add(foot);
    }

    // Invisible pick plane
    this.pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.pickPlane.rotation.x = -Math.PI / 2;
    this.pickPlane.position.y = 0.001;
    this.root.add(this.pickPlane);

    // Highlights
    this.hlGeo = new THREE.PlaneGeometry(0.98, 0.98);
    this.hlGeo.rotateX(-Math.PI / 2);
    this.highlights = new Map(); // key -> [meshes]
    this.markerGroup = new THREE.Group();
    this.root.add(this.markerGroup);
    this.dotGeo = new THREE.CircleGeometry(0.16, 32);
    this.dotGeo.rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.38, 0.47, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.markerMats = {
      move: new THREE.MeshBasicMaterial({ color: '#f6e7a1', transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
      capture: new THREE.MeshBasicMaterial({ color: '#ff8a5c', transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    };
    this.hoverMesh = new THREE.Mesh(this.hlGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    this.hoverMesh.visible = false;
    this.hoverMesh.renderOrder = 2;
    this.root.add(this.hoverMesh);

    // Stars for tutorial drills
    const sg = new THREE.ExtrudeGeometry(starShape(), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    sg.center();
    this.starGeo = sg;
    this.starMat = new THREE.MeshStandardMaterial({ color: '#ffd34d', emissive: '#d99a00', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 });
    this.stars = new Map();
    this.fadingStars = [];
    this.time = 0;
  }

  setHighlights(key, squares, color, opacity = 0.45, y = 0.004) {
    this.clearHighlights(key);
    const meshes = [];
    for (const s of squares) {
      const m = new THREE.Mesh(this.hlGeo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      }));
      m.position.copy(squareToLocal(s, 0.02 + y * 2));
      m.renderOrder = 2;
      m.userData.baseOpacity = opacity;
      m.userData.pulse = key === 'hint' || key === 'check' || key === 'target';
      this.root.add(m);
      meshes.push(m);
    }
    this.highlights.set(key, meshes);
  }

  clearHighlights(key) {
    const list = key ? [key] : [...this.highlights.keys()];
    for (const k of list) {
      for (const m of this.highlights.get(k) || []) { this.root.remove(m); m.material.dispose(); }
      this.highlights.delete(k);
    }
  }

  showMoveMarkers(moves) {
    this.clearMoveMarkers();
    for (const m of moves) {
      const cap = !!m.captured;
      const mesh = new THREE.Mesh(cap ? this.ringGeo : this.dotGeo, cap ? this.markerMats.capture : this.markerMats.move);
      mesh.position.copy(squareToLocal(m.to, 0.05));
      mesh.renderOrder = 3;
      this.markerGroup.add(mesh);
    }
  }

  clearMoveMarkers() {
    while (this.markerGroup.children.length) this.markerGroup.remove(this.markerGroup.children[0]);
  }

  setHover(i) {
    if (i === null || i === undefined || i < 0) { this.hoverMesh.visible = false; return; }
    this.hoverMesh.visible = true;
    this.hoverMesh.position.copy(squareToLocal(i, 0.035));
  }

  // `raised` squares hold a piece, so their stars float above it.
  setStars(squares, raised = []) {
    for (const s of this.stars.values()) this.root.remove(s);
    this.stars.clear();
    for (const sqi of squares) {
      const m = new THREE.Mesh(this.starGeo, this.starMat);
      m.userData.baseY = raised.includes(sqi) ? 1.75 : 0.5;
      m.position.copy(squareToLocal(sqi, m.userData.baseY));
      m.castShadow = true;
      m.userData.phase = Math.random() * 6;
      this.root.add(m);
      this.stars.set(sqi, m);
    }
  }

  collectStar(sqi) {
    const m = this.stars.get(sqi);
    if (!m) return false;
    this.stars.delete(sqi);
    m.material = this.starMat.clone();
    m.material.transparent = true;
    m.userData.fade = 0;
    this.fadingStars.push(m);
    return true;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    for (const m of this.stars.values()) {
      m.rotation.y = t * 1.6 + m.userData.phase;
      m.position.y = m.userData.baseY + Math.sin(t * 2.4 + m.userData.phase) * 0.08;
    }
    for (let i = this.fadingStars.length - 1; i >= 0; i--) {
      const m = this.fadingStars[i];
      m.userData.fade += dt * 2.2;
      const f = m.userData.fade;
      m.scale.setScalar(1 + f * 1.5);
      m.position.y += dt * 2.5;
      m.rotation.y += dt * 12;
      m.material.opacity = Math.max(0, 1 - f);
      if (f >= 1) { this.root.remove(m); m.material.dispose(); this.fadingStars.splice(i, 1); }
    }
    for (const [, meshes] of this.highlights) {
      for (const m of meshes) {
        if (m.userData.pulse) m.material.opacity = m.userData.baseOpacity * (0.6 + 0.4 * Math.sin(t * 5));
      }
    }
  }

  // Convert a world-space hit point to a square index (or -1).
  pointToSquare(worldPoint) {
    const p = this.root.worldToLocal(worldPoint.clone());
    const f = Math.floor(p.x + 4), r = Math.floor(4 - p.z);
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    return r * 8 + f;
  }
}
