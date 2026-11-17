// look.js — palette and procedural canvas textures for YARDLINE.
// Every surface in the yard is generated here at load time; the game ships no
// image assets. All randomness is seeded so staged screenshots are stable.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

export const INK = {
  skyTop: '#131a29',
  skyMid: '#2b2a40',
  horizonWarm: '#a05a30',
  horizonHot: '#c97a35',
  fog: '#2b2320',
  concrete: '#363d45',
  concreteSpeck: '#262c33',
  wall: '#3d4650',
  steelRust: '#7c4a30',
  steelTeal: '#2e6f6a',
  steelOlive: '#6e6b3a',
  steelSlate: '#4d5a6c',
  azure: '#35c4e8',
  crimson: '#e8483f',
  amber: '#f0a830',
  lamp: '#ffbe78',
  hazardYellow: '#c8a11e',
  gunmetal: '#2b2f35',
  polymer: '#17191d',
  darkPart: '#22262c',
};

// Small deterministic PRNG (LCG) — every texture and gameplay roll draws from one.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sheet(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, rx = 1, ry = 1) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

function speckle(g, w, h, n, colors, rng, maxR = 1.6) {
  for (let i = 0; i < n; i += 1) {
    g.fillStyle = colors[(rng() * colors.length) | 0];
    const r = 0.4 + rng() * maxR;
    g.fillRect(rng() * w, rng() * h, r, r);
  }
}

// Dusk sky: indigo zenith, violet middle, a warm band at the horizon, a low sun
// glow toward the south-west and a sparse star field up high.
export function skyTexture() {
  const [c, g] = sheet(1024, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, INK.skyTop);
  grad.addColorStop(0.42, INK.skyMid);
  grad.addColorStop(0.66, '#6b4a3a');
  grad.addColorStop(0.71, INK.horizonWarm);
  grad.addColorStop(0.74, INK.horizonHot);
  // Ease the horizon glow down instead of cutting to black: a hard stop here
  // read as a flat orange band with a sharp edge in the buy screenshot.
  grad.addColorStop(0.77, '#8a5230');
  grad.addColorStop(0.8, '#4a2e22');
  grad.addColorStop(0.85, '#1a1418');
  grad.addColorStop(1, '#0b0d11');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  const glow = g.createRadialGradient(138, 360, 8, 138, 360, 150);
  glow.addColorStop(0, 'rgba(255, 190, 120, 0.85)');
  glow.addColorStop(0.35, 'rgba(230, 140, 70, 0.35)');
  glow.addColorStop(1, 'rgba(230, 140, 70, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 200, 1024, 312);
  const rng = makeRng(97);
  for (let i = 0; i < 90; i += 1) {
    const y = rng() * 190;
    const a = 0.25 + rng() * 0.55;
    g.fillStyle = `rgba(235, 240, 255, ${a.toFixed(2)})`;
    const s = rng() < 0.12 ? 2 : 1;
    g.fillRect(rng() * 1024, y, s, s);
  }
  return toTex(c);
}

export function concreteTexture() {
  const [c, g] = sheet(256, 256);
  g.fillStyle = INK.concrete;
  g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 900, [INK.concreteSpeck, '#3d454e', '#2e353d'], makeRng(11));
  g.strokeStyle = 'rgba(20, 22, 26, 0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = 20 + i * 48 + ((i * 37) % 13);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(80, y + 4, 170, y - 4, 256, y + 2);
    g.stroke();
  }
  return toTex(c, 6, 5);
}

export function steelTexture(base, code) {
  const [c, g] = sheet(256, 128);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 16) {
    g.fillStyle = 'rgba(0, 0, 0, 0.22)';
    g.fillRect(x, 0, 5, 128);
    g.fillStyle = 'rgba(255, 255, 255, 0.07)';
    g.fillRect(x + 9, 0, 3, 128);
  }
  speckle(g, 256, 128, 260, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.06)'], makeRng(23), 2.2);
  g.fillStyle = 'rgba(240, 238, 230, 0.75)';
  g.font = 'bold 26px monospace';
  g.fillText(code, 18, 52);
  g.fillStyle = 'rgba(240, 238, 230, 0.22)';
  g.font = '11px monospace';
  g.fillText('MAX GROSS 30 480 KG', 18, 74);
  return toTex(c);
}

export function hazardTexture() {
  const [c, g] = sheet(128, 128);
  g.fillStyle = '#151517';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = INK.hazardYellow;
  for (let x = -128; x < 256; x += 32) {
    g.beginPath();
    g.moveTo(x, 128);
    g.lineTo(x + 16, 128);
    g.lineTo(x + 16 + 128, 0);
    g.lineTo(x + 128, 0);
    g.closePath();
    g.fill();
  }
  return toTex(c, 3, 1);
}

export function woodTexture() {
  const [c, g] = sheet(128, 128);
  g.fillStyle = '#6d5136';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) {
    g.fillStyle = 'rgba(0, 0, 0, 0.28)';
    g.fillRect(0, y, 128, 2);
    g.strokeStyle = 'rgba(60, 40, 22, 0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      const gy = y + 6 + i * 7;
      g.beginPath();
      g.moveTo(0, gy);
      g.bezierCurveTo(40, gy + 2, 90, gy - 2, 128, gy + 1);
      g.stroke();
    }
  }
  return toTex(c);
}

// Floor stencil: big worn YARDLINE letters on a transparent sheet.
export function decalTexture() {
  const [c, g] = sheet(512, 128);
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = 'rgba(232, 226, 210, 0.85)';
  g.font = 'bold 72px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('YARDLINE', 256, 64);
  const rng = makeRng(41);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i += 1) {
    g.fillRect(rng() * 512, rng() * 128, 2 + rng() * 4, 1 + rng() * 2);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Muzzle flash: white-yellow core, orange halo, four spikes.
export function flashTexture() {
  const [c, g] = sheet(128, 128);
  const core = g.createRadialGradient(64, 64, 2, 64, 64, 46);
  core.addColorStop(0, 'rgba(255, 250, 225, 1)');
  core.addColorStop(0.35, 'rgba(255, 210, 110, 0.9)');
  core.addColorStop(0.7, 'rgba(255, 140, 40, 0.35)');
  core.addColorStop(1, 'rgba(255, 120, 30, 0)');
  g.fillStyle = core;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255, 230, 160, 0.95)';
  for (let i = 0; i < 4; i += 1) {
    g.save();
    g.translate(64, 64);
    g.rotate((i * Math.PI) / 2 + Math.PI / 4);
    g.beginPath();
    g.moveTo(0, -58);
    g.lineTo(5, -8);
    g.lineTo(-5, -8);
    g.closePath();
    g.fill();
    g.restore();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildLook() {
  return {
    sky: skyTexture(),
    concrete: concreteTexture(),
    rust: steelTexture(INK.steelRust, 'YL-07'),
    teal: steelTexture(INK.steelTeal, 'YL-12'),
    olive: steelTexture(INK.steelOlive, 'YL-23'),
    slate: steelTexture(INK.steelSlate, 'YL-31'),
    hazard: hazardTexture(),
    wood: woodTexture(),
    decal: decalTexture(),
    flash: flashTexture(),
  };
}
