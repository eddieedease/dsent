import * as THREE from 'three';

// All textures are generated procedurally on canvases: no asset files needed.

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

// Cheap value-noise: random dots blurred by repeated downscale/upscale.
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

// Rocky cave wall, tinted per level.
export function rockTexture(tint) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  noiseFill(ctx, size, tint.base, tint.variation);
  crackle(ctx, size, 'rgba(0,0,0,0.35)', 40);
  crackle(ctx, size, 'rgba(255,255,255,0.10)', 25);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Metal panel with a bright light strip, used as sparse wall accents.
export function panelTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  noiseFill(ctx, size, [70, 72, 78], [30, 30, 30]);
  // rivet grid
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let x = 16; x < size; x += 56) {
    for (let y = 16; y < size; y += 56) {
      ctx.fillRect(x, y, 4, 4);
    }
  }
  // vertical light strips near edges
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#ffd27f');
  grad.addColorStop(0.5, '#fff6dd');
  grad.addColorStop(1, '#ffd27f');
  ctx.fillStyle = grad;
  ctx.fillRect(8, 0, 18, size);
  ctx.fillRect(size - 26, 0, 18, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Emissive-ish floor grating.
export function floorTexture(tint) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  noiseFill(ctx, size, tint.floorBase, [25, 25, 25]);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 6;
  for (let i = 0; i <= size; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
