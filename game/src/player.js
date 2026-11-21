// The player on foot in COSTA LUNA: Rico Solano.
// Walks with WASD relative to the camera, enters/exits cars with E, and
// interacts with missions (E prioritizes a mission interact over entering a car).

import * as THREE from 'three';
import { clamp, dist2 } from './util.js';

export function buildPlayer(G) {
  // Humanoid: jacket body, head, legs. Simple shapes, reads clearly at range.
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2a7a8a, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a078, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), jacket);
  body.position.y = 1.25; body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 2.05; head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.7 }));
  cap.position.y = 2.32; group.add(cap);
  const legs = [];
  for (const lx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.32), pants);
    leg.position.set(lx, 0.38, 0); leg.castShadow = true;
    group.add(leg); legs.push(leg);
  }
  group.position.set(-60, 0, -150);
  G.scene.add(group);

  const player = {
    x: -60, z: -150, heading: Math.PI / 2,
    health: 100, armour: 0,
    inCar: false, car: null,
    mesh: group,
    walkSpeed: 6, runSpeed: 9,
    walkPhase: 0,

    syncMesh() {
      group.position.set(this.x, 0, this.z);
      group.rotation.y = this.heading;
    },

    setPlayer(x, z) {
      this.x = x; this.z = z;
      this.syncMesh();
    },

    // Enter the nearest car within 5 m of (x, z). Returns the car or null.
    // Never "enter" the car the player is already driving: without this, an
    // E press next to another car ties at distance 0 with the current car,
    // and the list order (not the mission target) decides the winner.
    tryEnterCarAt(x, z) {
      let best = null, bestD = 5;
      for (const car of G.cars.list) {
        if (car.isTraffic) continue;
        if (car === this.car) continue;
        const d = dist2(x, z, car.x, car.z);
        if (d < bestD) { bestD = d; best = car; }
      }
      if (!best) return null;
      this.inCar = true;
      this.car = best;
      group.visible = false;
      // Snap the player onto the car so the camera and physics agree.
      this.x = best.x; this.z = best.z; this.heading = best.heading;
      return best;
    },

    exitCar() {
      if (!this.inCar || !this.car) return false;
      const c = this.car;
      // Step out to the car's left side.
      const sx = c.x + Math.cos(c.heading) * 2.6;
      const sz = c.z - Math.sin(c.heading) * 2.6;
      this.inCar = false;
      this.car = null;
      this.x = sx; this.z = sz;
      group.visible = true;
      this.syncMesh();
      return true;
    },

    // E key: mission interact first, then entering a car.
    interact() {
      if (G.missions.tryInteract()) return true;
      if (!this.inCar) {
        const car = this.tryEnterCarAt(this.x, this.z);
        if (car) {
          G.display.msg('Entered ' + car.name.replace(/-/g, ' '));
          return true;
        }
      }
      return false;
    },

    damage(amount) {
      let rest = amount;
      if (this.armour > 0) {
        const absorbed = Math.min(this.armour, rest);
        this.armour -= absorbed;
        rest -= absorbed;
      }
      this.health -= rest;
      G.hud.flashDamage();
      if (this.health <= 0) {
        this.health = 0;
        G.onPlayerDown();
      }
    },

    update(dt) {
      if (this.inCar) return;
      const k = G.keys;
      const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      if (fwd === 0 && strafe === 0) { this.syncMesh(); return; }
      const run = k.ShiftLeft || k.ShiftRight;
      const speed = run ? this.runSpeed : this.walkSpeed;
      const yaw = G.cam.yaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      let mx = (fx * fwd + rx * strafe);
      let mz = (fz * fwd + rz * strafe);
      const len = Math.hypot(mx, mz) || 1;
      mx /= len; mz /= len;
      // Per-axis collision so the walker slides along walls, never sticks.
      let nx = this.x + mx * speed * dt;
      let nz = this.z + mz * speed * dt;
      const cx = G.town.collideCircle(nx, this.z, 0.6);
      nx = cx.x;
      const cz = G.town.collideCircle(nx, nz, 0.6);
      nz = cz.z;
      this.x = clamp(nx, -300, 300);
      this.z = clamp(nz, -300, 300);
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * speed * 1.6;
      legs[0].rotation.x = Math.sin(this.walkPhase) * 0.5;
      legs[1].rotation.x = -Math.sin(this.walkPhase) * 0.5;
      this.syncMesh();
    },
  };
  return player;
}
