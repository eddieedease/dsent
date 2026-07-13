import * as THREE from 'three';

// All textures are generated procedurally on canvases: no asset files needed.
// Aesthetic: dark cyberpunk surfaces with neon emissive accents.

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

// Cheap value-noise fill.
function noiseFill(ctx, size, base, variation) {
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random();
    img.data[i] = base[0] + n * variation[0];
    img.data[i + 1] = base[1] + n * variation[1];
    img.data[i + 2] = base[2] + n * variation[2];
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function crackle(ctx, size, color, count) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 3 + Math.floor(Math.random() * 5);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * size * 0.2;
      y += (Math.random() - 0.5) * size * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function toTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dark rocky/tech cave wall, tinted per level.
export function rockTexture(tint) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  noiseFill(ctx, size, tint.base, tint.variation);
  crackle(ctx, size, 'rgba(0,0,0,0.45)', 40);
  crackle(ctx, size, 'rgba(120,160,255,0.08)', 25);
  return toTexture(c);
}

// Dark metal floor with grid seams (color comes from the emissive grid map).
export function floorTexture(tint) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  noiseFill(ctx, size, tint.floorBase, [18, 18, 22]);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 7;
  for (let i = 0; i <= size; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  return toTexture(c);
}

// Emissive companion for the floor: glowing neon grid lines on black.
export function gridGlowTexture(neonCss) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = neonCss;
  ctx.shadowColor = neonCss;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2.5;
  for (let i = 0; i <= size; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  return toTexture(c);
}

// Dark metal panel; neon strips are drawn dim here and glow via the emissive map.
export function panelTexture(neonCss) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  noiseFill(ctx, size, [22, 26, 38], [22, 22, 28]);
  // rivet grid
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let x = 16; x < size; x += 56) {
    for (let y = 16; y < size; y += 56) {
      ctx.fillRect(x, y, 4, 4);
    }
  }
  // horizontal seams
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 3;
  for (let y = 64; y < size; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  // dim base for the light strips
  ctx.fillStyle = neonCss;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(8, 0, 16, size);
  ctx.fillRect(size - 24, 0, 16, size);
  ctx.globalAlpha = 1;
  return toTexture(c);
}

// Emissive companion for panels: only the neon strips glow.
export function panelGlowTexture(neonCss) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = neonCss;
  ctx.shadowColor = neonCss;
  ctx.shadowBlur = 14;
  ctx.fillRect(8, 0, 16, size);
  ctx.fillRect(size - 24, 0, 16, size);
  return toTexture(c);
}

// Round soft glow sprite for projectiles / explosions.
export function glowTexture() {
  const size = 64;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
