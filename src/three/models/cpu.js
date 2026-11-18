import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { box, canvasTexture, fitFont, gold, metal, MONO, SANS, seeded } from './common.js';

// Package sizes in metres (real: AM4/AM5 40 × 40 mm, LGA1700 37.5 × 45 mm)
const SIZES = { AM4: [0.04, 0.04], AM5: [0.04, 0.04], LGA1700: [0.0375, 0.045] };

function lidTexture(part) {
  const amd = part.socket !== 'LGA1700';
  const [family, model] = amd
    ? [part.name.replace(/ \S+$/, '').toUpperCase(), part.name.split(' ').pop()]
    : [part.name.split('-')[0].replace('Core ', 'CORE '), part.name.split('-')[1]];
  return canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#d7dbe1');
    g.addColorStop(0.5, '#bfc4cc');
    g.addColorStop(1, '#cfd3d9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // brushed-metal streaks
    const rnd = seeded(part.id.length * 97);
    for (let i = 0; i < 260; i++) {
      ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '90,95,105'},${0.04 + rnd() * 0.05})`;
      ctx.beginPath();
      const y = rnd() * h;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (rnd() - 0.5) * 8);
      ctx.stroke();
    }
    ctx.fillStyle = '#2b2f36';
    ctx.textAlign = 'left';
    fitFont(ctx, family, 700, SANS, 64, w - 120);
    ctx.fillText(family, 60, 200);
    fitFont(ctx, model, 700, SANS, 92, w - 120);
    ctx.fillText(model, 60, 300);
    ctx.font = `500 26px ${MONO}`;
    ctx.fillStyle = '#4b515b';
    ctx.fillText(`${part.cores}C/${part.threads}T  ${part.socket}`, 60, 360);
    ctx.fillText(amd ? 'DIFFUSED IN TAIWAN' : 'MALAY', 60, 400);
  });
}

/** A CPU package lying in the XY plane with its lid facing +z, centred on the origin. */
export function buildCpu(part) {
  const [w, h] = SIZES[part.socket] || SIZES.AM4;
  const g = new THREE.Group();
  const substrate = new THREE.MeshStandardMaterial({ color: part.socket === 'LGA1700' ? 0x1f5b3a : 0x0f5136, roughness: 0.55 });
  box(g, w, h, 0.0012, substrate, 0, 0, 0.0006);
  const lidSide = metal(0xbfc4cc, 0.35);
  const lidTop = new THREE.MeshStandardMaterial({ map: lidTexture(part), metalness: 0.65, roughness: 0.38 });
  const mats = [lidSide, lidSide, lidSide, lidSide, lidTop, lidSide];

  if (part.socket === 'AM5') {
    // The AM5 lid: a central plate with eight legs and capacitors showing in the cut-outs
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.0032), mats);
    plate.position.z = 0.0012 + 0.0016;
    g.add(plate);
    for (const s of [-1, 1]) {
      for (const o of [-0.0095, 0.0095]) {
        box(g, 0.0055, 0.0042, 0.0032, lidSide, o, s * 0.0168, 0.0028);
        box(g, 0.0042, 0.0055, 0.0032, lidSide, s * 0.0168, o, 0.0028);
      }
    }
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0012, 0.0008, 0.0006), gold, 24);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
      const t = -0.004 + (i % 3) * 0.004 + (i < 3 ? -0.0002 : 0.0002);
      const r = 0.0172 + (i < 3 ? 0 : 0.0016);
      m.makeTranslation(t, s * r, 0.0015); caps.setMatrixAt(n++, m);
      m.makeTranslation(s * r, t, 0.0015); caps.setMatrixAt(n++, m);
    }
    g.add(caps);
  } else if (part.socket === 'LGA1700') {
    // Intel lid: a long plate with side "wings"
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.036, 0.0032), mats);
    plate.position.z = 0.0028;
    g.add(plate);
    box(g, 0.0345, 0.012, 0.0024, lidSide, 0, 0, 0.0024);
    const rnd = seeded(7);
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0009, 0.0006, 0.0005), gold, 30);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 30; i++) {
      const s = i < 15 ? -1 : 1;
      m.makeTranslation(-0.012 + rnd() * 0.024, s * (0.0195 + rnd() * 0.0015), 0.0015);
      caps.setMatrixAt(i, m);
    }
    g.add(caps);
  } else {
    // AM4: a single rounded lid and the gold triangle that marks pin 1
    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.034, 0.0034, 2, 0.0012), lidSide);
    lid.position.z = 0.0029;
    g.add(lid);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.032), lidTop);
    top.position.z = 0.00465;
    g.add(top);
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.002, 3), gold);
    tri.position.set(-w / 2 + 0.0025, -h / 2 + 0.0025, 0.0013);
    g.add(tri);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
