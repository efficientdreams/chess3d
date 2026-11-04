// Procedurally generated canvas textures — no external image assets needed.
import * as THREE from 'three';
import { mulberry32, noise2, fbm2 } from './noise.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pixels(w, h, fn) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// Tileable fbm by sampling noise on a torus-ish wrap (blend at edges).
function tileFbm(x, y, w, h, scale, oct) {
  const a = fbm2(x * scale, y * scale, oct);
  const b = fbm2((x - w) * scale, y * scale, oct);
  const c = fbm2(x * scale, (y - h) * scale, oct);
  const d = fbm2((x - w) * scale, (y - h) * scale, oct);
  const fx = x / w, fy = y / h;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

export function barkTexture() {
  return memo('bark', () => {
    const w = 256, h = 512;
    const c = pixels(w, h, (x, y) => {
      const ridge = Math.abs(Math.sin((x / w) * Math.PI * 14 + tileFbm(x, y, w, h, 0.03, 3) * 5));
      const n = tileFbm(x, y, w, h, 0.08, 4);
      const v = 0.35 + ridge * 0.35 + n * 0.25;
      const moss = Math.max(0, tileFbm(x + 99, y, w, h, 0.02, 3) - 0.1) * 2.2;
      return [
        (98 * v) * (1 - moss) + 78 * moss,
        (76 * v) * (1 - moss) + 108 * moss,
        (54 * v) * (1 - moss) + 42 * moss,
      ];
    });
    return toTexture(c, { repeat: [2, 1] });
  });
}

export function birchTexture() {
  return memo('birch', () => {
    const w = 128, h = 512;
    const rng = mulberry32(7);
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ddd8cc';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const y = rng() * h, x = rng() * w;
      ctx.fillStyle = `rgba(30,25,20,${0.5 + rng() * 0.5})`;
      ctx.fillRect(x, y, 10 + rng() * 40, 1 + rng() * 4);
    }
    return toTexture(c, { repeat: [1, 2] });
  });
}

export function stumpTopTexture() {
  return memo('stumpTop', () => {
    const w = 512;
    const c = pixels(w, w, (x, y) => {
      const dx = x - w / 2, dy = y - w / 2;
      const r = Math.sqrt(dx * dx + dy * dy) / (w / 2);
      const ang = Math.atan2(dy, dx);
      const wob = noise2(Math.cos(ang) * 2 + 5, Math.sin(ang) * 2) * 0.03 + fbm2(x * 0.02, y * 0.02, 2) * 0.02;
      const rings = 0.5 + 0.5 * Math.sin((r + wob) * 90);
      const crack = Math.abs(Math.sin(ang * 3 + noise2(r * 4, 1) * 2)) < 0.02 && r > 0.25 ? 0.5 : 1;
      const n = fbm2(x * 0.05, y * 0.05, 3) * 0.15;
      if (r > 0.94) {
        // bark rim
        const v = 0.4 + fbm2(x * 0.1, y * 0.1, 3) * 0.4;
        return [60 * v, 42 * v, 28 * v];
      }
      const v = (0.72 + rings * 0.2 + n) * crack * (r > 0.88 ? 0.75 : 1);
      return [170 * v, 128 * v, 82 * v];
    });
    return toTexture(c);
  });
}

export function woodTexture(light = true, seed = 1) {
  return memo('wood' + light + seed, () => {
    const w = 256, h = 256;
    const c = pixels(w, h, (x, y) => {
      const grain = Math.sin((y + fbm2(x * 0.01 + seed, y * 0.04, 4) * 40) * 0.35) * 0.5 + 0.5;
      const n = tileFbm(x, y, w, h, 0.05, 3) * 0.2;
      const v = 0.8 + grain * 0.18 + n;
      return light ? [222 * v, 184 * v, 135 * v] : [110 * v, 66 * v, 40 * v];
    });
    return toTexture(c);
  });
}

export function rockTexture() {
  return memo('rock', () => {
    const w = 256;
    const c = pixels(w, w, (x, y) => {
      const n = tileFbm(x, y, w, w, 0.04, 5);
      const n2 = tileFbm(x + 50, y + 70, w, w, 0.15, 3);
      const v = 0.72 + n * 0.35 + n2 * 0.12;
      const moss = Math.max(0, tileFbm(x + 300, y, w, w, 0.025, 3) + 0.05) * 1.6;
      const m = Math.min(1, moss);
      return [168 * v * (1 - m) + 92 * v * m, 162 * v * (1 - m) + 128 * v * m, 150 * v * (1 - m) + 58 * v * m];
    });
    return toTexture(c, { repeat: [2, 2] });
  });
}

export function groundTexture() {
  return memo('ground', () => {
    const w = 512;
    const rng = mulberry32(3);
    const c = pixels(w, w, (x, y) => {
      const n = tileFbm(x, y, w, w, 0.02, 5);
      const n2 = tileFbm(x, y, w, w, 0.2, 2);
      const g = 0.6 + n * 0.5 + n2 * 0.15;
      return [62 * g, 92 * g, 36 * g];
    });
    const ctx = c.getContext('2d');
    // Tiny grass strokes
    for (let i = 0; i < 9000; i++) {
      const x = rng() * w, y = rng() * w;
      const l = 2 + rng() * 5;
      const s = 0.6 + rng() * 0.6;
      ctx.strokeStyle = `rgba(${Math.floor(70 * s)},${Math.floor(115 * s)},${Math.floor(40 * s)},0.6)`;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 2, y - l); ctx.stroke();
    }
    // Fallen leaves / twigs
    for (let i = 0; i < 400; i++) {
      const x = rng() * w, y = rng() * w;
      ctx.fillStyle = rng() < 0.5 ? 'rgba(120,80,30,0.7)' : 'rgba(90,70,35,0.6)';
      ctx.beginPath(); ctx.ellipse(x, y, 2 + rng() * 2, 1 + rng(), rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
    return toTexture(c, { repeat: [40, 40] });
  });
}

export function leafTexture() {
  return memo('leaf', () => {
    const w = 256;
    const c = canvas(w);
    const ctx = c.getContext('2d');
    const rng = mulberry32(11);
    ctx.clearRect(0, 0, w, w);
    for (let i = 0; i < 160; i++) {
      const x = 20 + rng() * (w - 40), y = 20 + rng() * (w - 40);
      const dx = x - w / 2, dy = y - w / 2;
      if (dx * dx + dy * dy > (w / 2 - 15) ** 2) continue;
      const s = 6 + rng() * 10;
      const shade = 0.55 + rng() * 0.45;
      ctx.fillStyle = `rgb(${Math.floor(70 * shade)},${Math.floor(120 * shade)},${Math.floor(40 * shade)})`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI * 2);
      // Oak-ish lobed leaf
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const t = (k / 20) * Math.PI * 2;
        const lobe = 1 + 0.25 * Math.sin(t * 5);
        ctx.lineTo(Math.cos(t) * s * 0.5 * lobe, Math.sin(t) * s * lobe);
      }
      ctx.fill();
      ctx.restore();
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

export function fernTexture() {
  return memo('fern', () => {
    const w = 128, h = 256;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#3f6b22';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.quadraticCurveTo(w / 2 + 6, h / 2, w / 2, 4); ctx.stroke();
    for (let i = 0; i < 22; i++) {
      const t = i / 22;
      const y = h - t * (h - 10);
      const len = (1 - t) * 52 + 6;
      for (const s of [-1, 1]) {
        ctx.fillStyle = `rgb(${60 + i},${110 + i * 2},${35})`;
        ctx.beginPath();
        ctx.moveTo(w / 2, y);
        ctx.quadraticCurveTo(w / 2 + s * len * 0.6, y - 10, w / 2 + s * len, y - 4 - t * 6);
        ctx.quadraticCurveTo(w / 2 + s * len * 0.5, y + 1, w / 2, y + 3);
        ctx.fill();
      }
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

export function softSprite(color = '#ffffff') {
  return memo('sprite' + color, () => {
    const w = 64;
    const c = canvas(w);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.3, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function cloudSprite() {
  return memo('cloud', () => {
    const w = 128;
    const c = pixels(w, w, (x, y) => {
      const dx = (x - w / 2) / (w / 2), dy = (y - w / 2) / (w / 2);
      const r = Math.sqrt(dx * dx + dy * dy);
      const n = fbm2(x * 0.05, y * 0.05, 4) * 0.5 + 0.5;
      const a = Math.max(0, 1 - r) ** 1.5 * n;
      return [255, 255, 255, Math.floor(a * 255)];
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function labelTexture(text, { color = '#f3e2b8', font = 'bold 96px Georgia, serif', size = 128 } = {}) {
  return memo('label' + text + color, () => {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

// Generic tileable value texture used for roughness / bump on pieces.
export function grainTexture(seed = 5) {
  return memo('grain' + seed, () => {
    const w = 256;
    const c = pixels(w, w, (x, y) => {
      const v = 128 + tileFbm(x + seed * 13, y, w, w, 0.06, 4) * 90 + (Math.sin(y * 0.6 + tileFbm(x, y, w, w, 0.02, 2) * 8) * 20);
      return [v, v, v];
    });
    return toTexture(c, { srgb: false });
  });
}
