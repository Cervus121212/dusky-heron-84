// Combat for COSTA LUNA: two weapon slots, aimed straight along cam.yaw,
// tracers, and enemies that shoot back (2 damage a hit, armour first).

import * as THREE from 'three';
import { dist2, angleDiff } from './util.js';

export const WEAPONS = [
  { name: 'PISTOL', damage: 34, range: 42, interval: 0.32, ammo: Infinity },
  { name: 'SMG', damage: 22, range: 36, interval: 0.11, ammo: 120 },
];

function makeEnemyMesh(jacketColor) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), jacket);
  body.position.y = 1.25; body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 2.05; group.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xaa8810, emissiveIntensity: 0.8 }));
  hat.position.y = 2.32; group.add(hat);
  for (const lx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.32), pants);
    leg.position.set(lx, 0.38, 0); group.add(leg);
  }
  return group;
}

export function buildCombat(G) {
  const combat = {
    weapons: WEAPONS,
    weaponIndex: 0,
    ammo: 120, // SMG reserve
    cooldown: 0,
    enemies: [],
    tracers: [],

    weapon() { return WEAPONS[this.weaponIndex]; },

    switchWeapon(i) {
      if (i >= 0 && i < WEAPONS.length) {
        this.weaponIndex = i;
        G.hud.refresh();
      }
    },

    shoot() {
      const w = this.weapon();
      if (this.cooldown > 0) return false;
      if (G.player.inCar) return false; // no drive-by: shoot on foot only
      if (w.name === 'SMG' && this.ammo <= 0) {
        G.display.msg('SMG out of ammo — press 1 for pistol');
        return false;
      }
      this.cooldown = w.interval;
      if (w.name === 'SMG') this.ammo--;
      const px = G.player.x, pz = G.player.z;
      const dirX = Math.sin(G.cam.yaw), dirZ = Math.cos(G.cam.yaw);
      // Nearest enemy inside the aim cone and range.
      let best = null, bestScore = Infinity;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.x - px, dz = e.z - pz;
        const d = Math.hypot(dx, dz);
        if (d > w.range) continue;
        const ang = Math.abs(angleDiff(G.cam.yaw, Math.atan2(dx, dz)));
        if (ang > 0.12) continue;
        const score = d + ang * 40;
        if (score < bestScore) { bestScore = score; best = e; }
      }
      let endX = px + dirX * w.range, endZ = pz + dirZ * w.range;
      if (best) {
        endX = best.x; endZ = best.z;
        best.hp -= w.damage;
        if (best.hp <= 0) {
          best.alive = false;
          best.mesh.rotation.x = -Math.PI / 2; // falls flat
          best.mesh.position.y = 0.3;
        }
      }
      this.addTracer(px, 1.5, pz, endX, 1.4, endZ);
      G.sound.shot();
      G.hud.refresh();
      return !!best;
    },

    addTracer(x1, y1, z1, x2, y2, z2) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
      ]);
      const mat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(geo, mat);
      G.scene.add(line);
      this.tracers.push({ line, life: 0.09 });
    },

    spawnEnemies(n, x, z, jacketColor = 0xc22a2a) {
      const made = [];
      for (let i = 0; i < n; i++) {
        const mesh = makeEnemyMesh(jacketColor);
        const ex = x + (i % 2 ? 4 : -4) + (i > 1 ? 3 : -3);
        const ez = z + (i < 2 ? 3 : -3);
        mesh.position.set(ex, 0, ez);
        G.scene.add(mesh);
        const e = { mesh, x: ex, z: ez, hp: 100, alive: true, shootT: 0.8 + i * 0.4 };
        this.enemies.push(e);
        made.push(e);
      }
      return made;
    },

    clearEnemies() {
      for (const e of this.enemies) G.scene.remove(e.mesh);
      this.enemies = [];
    },

    aliveCount() { return this.enemies.filter((e) => e.alive).length; },

    update(dt) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      for (const t of this.tracers) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      }
      while (this.tracers.length && this.tracers[0].life <= 0) {
        const t = this.tracers.shift();
        G.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
      }
      // Enemies shoot the player when close (2 damage a hit, armour first).
      for (const e of this.enemies) {
        if (!e.alive) continue;
        e.mesh.rotation.y = Math.atan2(G.player.x - e.x, G.player.z - e.z);
        const d = dist2(e.x, e.z, G.player.x, G.player.z);
        if (d < 30) {
          e.shootT -= dt;
          if (e.shootT <= 0) {
            e.shootT = 1.2;
            if (!G.player.inCar) {
              G.player.damage(2);
              this.addTracer(e.x, 1.5, e.z, G.player.x, 1.4, G.player.z);
            }
          }
        }
      }
    },
  };
  return combat;
}
