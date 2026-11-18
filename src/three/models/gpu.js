import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createFan } from '../pcCase.js';
import { GPU_LOOKS, GPU_DESIGNS } from '../../data/looks.js';
import { box, canvasTexture, fitFont, gold, metal, plastic, rgbMaterial, SANS } from './common.js';

/**
 * A graphics card built to the product's real length, height and slot thickness.
 * Local frame (matches the case): x runs from the I/O bracket (0) to the far end,
 * y = 0 is the top of the PCB with the cooler hanging below (fans face -y),
 * z = 0 is the PCIe edge and +z is the logo side that faces the glass.
 */
export function buildGpu(part) {
  const look = GPU_LOOKS[part.id] || GPU_LOOKS.rtx4060;
  const d = GPU_DESIGNS[look.design];
  const L = look.length, H = look.height, T = look.slots * 0.02;
  const g = new THREE.Group();
  const rgb = [];
  const fans = [];

  // Backplate, PCB and the gold PCIe fingers
  box(g, L - 0.004, 0.0025, H - 0.002, metal(d.backplate, 0.45, 0.7), L / 2 + 0.002, 0.0029, H / 2);
  box(g, L - 0.01, 0.0016, H - 0.006, plastic(0x0d0f12), L / 2, 0.0008, H / 2);
  box(g, 0.089, 0.0014, 0.009, gold, 0.0845, 0.0008, -0.0035);

  // Cooler shroud
  const shroudH = T - 0.006;
  const shroud = new THREE.Mesh(new RoundedBoxGeometry(L - 0.006, shroudH, H, 3, 0.006), metal(d.shroud, 0.5, look.design === 'flagship' ? 0.85 : 0.35));
  shroud.position.set(L / 2 + 0.003, -0.0016 - shroudH / 2, H / 2);
  shroud.castShadow = shroud.receiveShadow = true;
  g.add(shroud);
  const bottom = -0.0016 - shroudH;

  // Trim lines along the logo side
  const trim = metal(d.trim, 0.4, 0.8);
  box(g, L - 0.02, 0.0015, 0.001, trim, L / 2 + 0.003, -0.005, H + 0.0004);
  box(g, L - 0.02, 0.0015, 0.001, trim, L / 2 + 0.003, bottom + 0.004, H + 0.0004);
  const accent = d.rgb ? rgbMaterial() : new THREE.MeshStandardMaterial({ color: d.accent, emissive: d.accent, emissiveIntensity: 0.25, roughness: 0.4 });
  if (d.rgb) rgb.push(accent);
  box(g, L * 0.32, 0.002, 0.0012, accent, L * 0.22, bottom + 0.009, H + 0.0006);

  // Product name on the side that faces the window
  const label = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.42, Math.min(shroudH * 0.55, 0.022)), new THREE.MeshStandardMaterial({
    transparent: true,
    roughness: 0.5,
    map: canvasTexture(1024, 160, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = d.text;
      fitFont(ctx, look.label, 700, SANS, 120, w - 20);
      ctx.textBaseline = 'middle';
      ctx.fillText(look.label, 10, h / 2 + 4);
    }),
  }));
  label.position.set(L * 0.62, -0.0016 - shroudH * 0.45, H + 0.0008);
  g.add(label);

  // Fans on the underside, each in a recessed opening
  const pitch = (L - 0.03) / look.fans;
  const D = Math.min(H * 0.84, pitch * 0.96);
  const hole = plastic(0x08090b, 0.9);
  for (let i = 0; i < look.fans; i++) {
    const x = 0.02 + pitch * (i + 0.5);
    const ring = d.rgb ? rgbMaterial() : new THREE.MeshBasicMaterial({ color: 0x15171c });
    if (d.rgb) rgb.push(ring);
    const fan = createFan(D, ring);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(x, bottom - 0.0012, H / 2);
    g.add(fan);
    fans.push(fan);
    const recess = new THREE.Mesh(new THREE.CircleGeometry(D / 2 - 0.002, 40), hole);
    recess.rotation.x = Math.PI / 2;
    recess.position.set(x, bottom - 0.0004, H / 2);
    g.add(recess);
  }

  // Heatsink fins visible at the far end
  const finCount = Math.round(T / 0.0022);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.0006, H - 0.016), metal(0x9aa0aa, 0.35), finCount);
  const m = new THREE.Matrix4();
  for (let i = 0; i < finCount; i++) {
    m.makeTranslation(L - 0.004, -0.004 - (i * (shroudH - 0.008)) / Math.max(1, finCount - 1), H / 2);
    fins.setMatrixAt(i, m);
  }
  g.add(fins);

  // Power connector(s) on the top edge, I/O bracket at the rear
  const plugs = part.watts > 300 ? 1 : part.watts > 200 ? 2 : 1;
  for (let i = 0; i < plugs; i++) box(g, part.watts > 400 ? 0.019 : 0.021, 0.0075, 0.009, plastic(0x0b0c0f), L * 0.66 + i * 0.024, -0.005, H + 0.003);
  box(g, 0.0012, T + 0.004, H + 0.012, metal(0xb9bec6, 0.3), -0.0006, -T / 2 + 0.003, H / 2);
  box(g, 0.004, 0.002, 0.016, metal(0xb9bec6, 0.3), 0.001, 0.004, H + 0.006);

  g.userData.rgb = rgb;
  g.userData.fans = fans;
  return g;
}
