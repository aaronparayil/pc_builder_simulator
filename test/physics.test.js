import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPhysics } from '../src/three/physics.js';

// carried size in metres, then the zoom it is carried at
const PARTS = {
  motherboard: [[0.244, 0.305, 0.034], 1],
  cpu: [[0.04, 0.04, 0.005], 3.5],
  'low-profile cooler': [[0.092, 0.092, 0.06], 2.17],
  'tower cooler': [[0.069, 0.127, 0.152], 1.31],
  'dual-tower cooler': [[0.117, 0.127, 0.152], 1.31],
  'liquid cooler': [[0.3, 0.169, 0.149], 1],
  'ram (short)': [[0.023, 0.133, 0.031], 1.5],
  'ram (tall)': [[0.023, 0.133, 0.042], 1.5],
  'hard drive': [[0.147, 0.026, 0.102], 1.36],
  'sata ssd': [[0.1, 0.007, 0.07], 2],
  'm.2 drive': [[0.08, 0.022, 0.002], 2.5],
  'm.2 with heatsink': [[0.08, 0.022, 0.008], 2.5],
  'graphics card': [[0.333, 0.082, 0.159], 1],
  psu: [[0.232, 0.157, 0.14], 1],
};
const ROOM = { minX: -5, maxX: 5, minZ: -5, maxZ: 5, H: 3 };
const desk = new THREE.Box3(new THREE.Vector3(-1, 0, -0.5), new THREE.Vector3(1, 0.75, 0.5));

/** Let a part go and run for up to ten seconds; returns where it came to rest. */
function drop([size, zoom], { at = [3, 1.2, 3], quat = new THREE.Quaternion(), vel = [0, 0, 0], spin = [0, 0, 0] } = {}) {
  const physics = createPhysics({ solids: [desk], room: ROOM });
  const object = new THREE.Object3D();
  object.position.set(...at);
  object.quaternion.copy(quat);
  object.scale.setScalar(zoom);
  const half = new THREE.Vector3(...size).multiplyScalar(0.5);
  const body = physics.add(object, half, new THREE.Vector3(...vel), new THREE.Vector3(...spin));
  let t = 0;
  for (; t < 10 && !body.asleep; t += 1 / 72) physics.step(1 / 72);
  object.updateMatrix();
  const box = new THREE.Box3(half.clone().negate(), half.clone()).applyMatrix4(object.matrix);
  return { asleep: body.asleep, t, height: box.max.y - box.min.y, bottom: box.min.y, thin: Math.min(...size) * zoom };
}

function assertFlat(r, floor, label) {
  assert.ok(r.asleep, `${label}: never came to rest`);
  assert.ok(Math.abs(r.bottom - floor) < 0.01, `${label}: rests at ${r.bottom.toFixed(3)}, not ${floor}`);
  assert.ok(r.height < r.thin * 1.25 + 0.012, `${label}: ${r.height.toFixed(3)} high, thinnest side ${r.thin.toFixed(3)}`);
}

// every way to hold a box square, so each edge and face starts straight down
const UPRIGHT = [];
for (const x of [0, 1, 2, 3]) for (const z of [0, 1, 2, 3]) UPRIGHT.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(x * Math.PI / 2, 0, z * Math.PI / 2)));

for (const [name, part] of Object.entries(PARTS)) {
  test(`${name}: lies flat however squarely it is let go`, () => {
    UPRIGHT.forEach((quat, i) => {
      assertFlat(drop(part, { quat }), 0, `floor, pose ${i}`);
      assertFlat(drop(part, { quat, at: [0, 1.2, 0] }), 0.75, `desk, pose ${i}`);
    });
  });

  test(`${name}: lies flat after being thrown`, () => {
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    for (let i = 0; i < 60; i++) {
      const quat = new THREE.Quaternion(rnd(), rnd(), rnd(), rnd()).normalize();
      const r = drop(part, { quat, at: [3 + rnd(), 1.5, 3 + rnd()], vel: [rnd() * 2, rnd() * 4, rnd() * 2], spin: [rnd() * 15, rnd() * 15, rnd() * 15] });
      assertFlat(r, 0, `throw ${i}`);
    }
  });
}
