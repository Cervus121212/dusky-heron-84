// Pedestrians for COSTA LUNA: 12 walkers on the sidewalks.
// They walk axis-aligned, slide along walls (per-axis collision, never stick),
// and flee at 8 m/s when the player's car comes within 6 m.

import * as THREE from 'three';
import { clamp, mulberry32, dist2 } from './util.js';

const SHIRT_COLORS = [0xd8c25a, 0x5a8ad8, 0xd85a5a, 0x5ad88a, 0xd8a0d8, 0x8ad8d8];

function makeWalkerMesh(shirt) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.42), shirtMat);
  body.position.y = 1.2; body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 1.95; group.add(head);
  for (const lx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.3), pants);
    leg.position.set(lx, 0.35, 0); group.add(leg);
  }
  return group;
}

export function buildPedestrians(G) {
  const rng = mulberry32(G.seed + 31);
  const list = [];
  // Spawn on sidewalks: just off a road line, inside a block edge.
  for (let i = 0; i < 12; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = [-256, -192, -128, -64, 0, 64, 128, 192, 256][Math.floor(rng() * 9)];
    const along = -260 + rng() * 520;
    const x = axis === 'x' ? along : line + 11;
    const z = axis === 'x' ? line + 11 : along;
    const mesh = makeWalkerMesh(SHIRT_COLORS[i % SHIRT_COLORS.length]);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    list.push({
      mesh, x, z,
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 0.8,
      turnT: 2 + rng() * 6,
      phase: rng() * 6,
    });
  }

  const pedestrians = {
    list,

    update(dt) {
      const car = G.player.inCar && G.player.car ? G.player.car : null;
      for (const w of list) {
        let fleeing = false;
        if (car) {
          const d = dist2(w.x, w.z, car.x, car.z);
          if (d < 6) {
            // Run directly away from the car.
            w.heading = Math.atan2(w.x - car.x, w.z - car.z);
            fleeing = true;
          }
        }
        const speed = fleeing ? 8 : w.speed;
        w.turnT -= dt;
        if (!fleeing && w.turnT <= 0) {
          // Turn 90 degrees left or right at random.
          w.heading += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
          w.turnT = 3 + rng() * 7;
        }
        const fx = Math.sin(w.heading), fz = Math.cos(w.heading);
        let nx = w.x + fx * speed * dt;
        let nz = w.z + fz * speed * dt;
        // Per-axis collision: slide along walls instead of sticking.
        const cx = G.town.collideCircle(nx, w.z, 0.5);
        if (cx.hit && !fleeing) { w.heading += Math.PI / 2; w.turnT = 2; }
        nx = cx.x;
        const cz = G.town.collideCircle(nx, nz, 0.5);
        if (cz.hit && !fleeing) { w.heading += Math.PI / 2; w.turnT = 2; }
        nz = cz.z;
        w.x = clamp(nx, -286, 286);
        w.z = clamp(nz, -286, 286);
        w.phase += dt * speed * 2.2;
        w.mesh.position.set(w.x, 0, w.z);
        w.mesh.rotation.y = w.heading;
      }
    },
  };
  return pedestrians;
}
