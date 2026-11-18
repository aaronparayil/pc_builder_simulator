import * as THREE from 'three';

export const SANS = '"Space Grotesk", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

export function canvasTexture(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const metal = (color, roughness = 0.35, metalness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const plastic = (color, roughness = 0.55) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.1 });
export const gold = new THREE.MeshStandardMaterial({ color: 0xd4a548, metalness: 1, roughness: 0.3 });

/** Unlit material whose colour is animated when the PC is powered (see workshop.js). */
export const rgbMaterial = () => new THREE.MeshBasicMaterial({ color: 0x202228, toneMapped: false });

export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A deterministic random generator so procedural details don't change between loads. */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Fit `text` on one line at the largest size up to `max`. */
export function fitFont(ctx, text, weight, family, max, width) {
  let size = max;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    size -= 1;
  } while (ctx.measureText(text).width > width && size > 8);
}
