// The eight story jobs of COSTA LUNA — Rico Solano runs jobs for fixer Lena
// Cruz while Det. Marlow's Luna PD hunts him. Total mission cash: $19,000.
// Steps are 1-based; E prioritizes a mission interact over entering a car.

import { dist2 } from './util.js';

const SAFEHOUSE = { x: -60, z: -168 };
const GARAGE = { x: -120, z: 24 };
const DOCKS_PICKUP = { x: 264, z: 60 };
const DEALERS = { x: 264, z: 120 };
const MARINA = { x: 60, z: 232 };
const M5_TARGET = { x: -150, z: -232 };
const VAN = { x: -180, z: 232 };
const YACHT = { x: 60, z: 232 };

const DEFS = [
  {
    id: 1, name: 'First Wheels', chapter: 'CHAPTER 1 — FIRST WHEELS', reward: 500,
    brief: 'Lena needs a driver. Take the garage sedan, then get back to the safehouse.',
    dialog: ['Lena Cruz', 'Rico. You\'re out, I\'m in. First job\'s easy: grab the blue sedan in the garage, then come home. Don\'t scratch it.'],
    steps: [
      { text: 'Go to the garage and take the sedan (E)', pos: GARAGE, radius: 6, interact: true },
      { text: 'Drive back to the safehouse', pos: SAFEHOUSE, radius: 8 },
    ],
  },
  {
    id: 2, name: 'The Pickup', chapter: 'CHAPTER 2 — THE PICKUP', reward: 800,
    brief: 'A package is waiting at the docks. Collect it and bring it home.',
    dialog: ['Lena Cruz', 'Package at the docks, slip 60. Pick it up, no questions, and bring it to the safehouse. Eyes open — the docks are Viktor\'s turf.'],
    steps: [
      { text: 'Pick up the package at the docks (E)', pos: DOCKS_PICKUP, radius: 6, interact: true },
      { text: 'Bring the package to the safehouse', pos: SAFEHOUSE, radius: 8 },
    ],
  },
  {
    id: 3, name: 'Hot Pursuit', chapter: 'CHAPTER 3 — HOT PURSUIT', reward: 1200,
    brief: 'Luna PD is on you — 3 stars. Lose the heat completely.',
    dialog: ['Det. Marlow', 'Solano. We see you. Every unit in Costa Luna is looking for that car. Run all you want — you\'ll run out of road.'],
    onStart: (G) => { G.police.setStars(3); },
    steps: [
      { text: 'Lose the cops — get to 0 stars', pos: null, radius: 0, check: (G) => G.police.stars === 0 },
    ],
  },
  {
    id: 4, name: 'Dockside Deal', chapter: 'CHAPTER 4 — DOCKSIDE DEAL', reward: 2000,
    brief: 'Viktor\'s dealers are holding Lena\'s cash at the docks. Take it back.',
    dialog: ['Lena Cruz', 'Viktor\'s boys took my cut. Four of them, dock 120. Take it back, Rico. Then grab the cash and walk away like you own the place.'],
    onStart: (G) => { G.combat.spawnEnemies(4, DEALERS.x, DEALERS.z, 0xc22a2a); },
    steps: [
      { text: 'Take down all 4 dealers at the docks', pos: DEALERS, radius: 10, check: (G) => G.combat.aliveCount() === 0 },
      { text: 'Grab the cash (E)', pos: DEALERS, radius: 5, interact: true },
    ],
  },
  {
    id: 5, name: 'Getaway Driver', chapter: 'CHAPTER 5 — GETAWAY DRIVER', reward: 2500,
    brief: 'Pick up the courier at the marina, then run north in 90 seconds.',
    dialog: ['Lena Cruz', 'Courier\'s waiting at the marina, no time for hellos — just drive. North gate, ninety seconds. The clock is already running.'],
    steps: [
      { text: 'Pick up the courier at the marina', pos: MARINA, radius: 8, auto: true },
      { text: 'Reach the north gate in 90 seconds', pos: M5_TARGET, radius: 9, timed: 90 },
    ],
  },
  {
    id: 6, name: 'The Informant', chapter: 'CHAPTER 6 — THE INFORMANT', reward: 3000,
    brief: 'The green sedan circling downtown knows where Marlow hides the files. Ram it until it stops.',
    dialog: ['Lena Cruz', 'The informant drives a green sedan, circles downtown like he owns it. He won\'t talk — so ram him until his car does.'],
    onStart: (G) => {
      const s = G.cars.sedan;
      s.orbit.hp = 120; s.orbit.maxHp = 120; s.orbit.angle = 0;
      G.missions.chaseTarget = s;
    },
    steps: [
      { text: 'Ram the green sedan until it stops', pos: null, radius: 0, check: (G) => G.cars.sedan.orbit.hp <= 0 },
    ],
  },
  {
    id: 7, name: 'Beachfront Heist', chapter: 'CHAPTER 7 — BEACHFRONT HEIST', reward: 4000,
    brief: 'Steal the van on the beach, lose the 3-star heat, then get home.',
    dialog: ['Lena Cruz', 'A van full of product is parked on the beach. Take it. The moment you touch it, Marlow will light you up — so lose them, then come home.'],
    steps: [
      { text: 'Steal the van on the beach (E)', pos: VAN, radius: 6, interact: true, van: true },
      { text: 'Lose the heat — get to 0 stars', pos: null, radius: 0, check: (G) => G.police.stars === 0 },
      { text: 'Bring the van to the safehouse', pos: SAFEHOUSE, radius: 9 },
    ],
  },
  {
    id: 8, name: 'King of Luna', chapter: 'CHAPTER 8 — KING OF LUNA', reward: 5000,
    brief: 'Survive 60 seconds at 4 stars, then sail out on La Sirena.',
    dialog: ['Det. Marlow', 'Four stars, Solano. Roadblocks, Air One, everything I have. Sixty seconds and you\'re mine — or you\'re king of this town.'],
    onStart: (G) => { G.police.setStars(4); },
    steps: [
      { text: 'Survive 60 seconds at 4 stars', pos: null, radius: 0, timed: 60, survive: true },
      { text: 'Reach the yacht La Sirena', pos: YACHT, radius: 9 },
    ],
  },
];

export function buildMissions(G) {
  const missions = {
    index: 0,
    active: false,
    step: 1,
    completed: new Set(),
    chaseTarget: null,
    stepT: 0,       // timer inside the current step (M5 90 s, M8 60 s)
    beacon: null,

    def() { return DEFS[this.index] || null; },

    start(i) {
      if (i < 0 || i >= DEFS.length) return false;
      this.index = i;
      this.step = 1;
      this.stepT = 0;
      this.active = true;
      const d = DEFS[i];
      if (d.onStart) d.onStart(G);
      const [who, line] = d.dialog;
      G.display.dialog(who, line);
      G.display.msg(d.chapter + ' — ' + d.name + ' ($' + d.reward.toLocaleString() + ')');
      G.hud.refresh();
      return true;
    },

    restart() { return this.start(this.index); },

    objectivePos() {
      const d = this.def();
      if (!d || !this.active) return null;
      const s = d.steps[this.step - 1];
      if (!s || !s.pos) return null;
      if (d.id === 6) { const t = G.cars.sedan; return { x: t.x, z: t.z }; }
      return s.pos;
    },

    objectiveText() {
      const d = this.def();
      if (!d || !this.active) return 'No active job — press ENTER to start the next one.';
      const s = d.steps[this.step - 1];
      let extra = '';
      if (d.id === 6) extra = '  ·  Sedan HP: ' + Math.max(0, Math.ceil(G.cars.sedan.orbit.hp));
      if (s.timed) extra = '  ·  ' + Math.max(0, Math.ceil(s.timed - this.stepT)) + 's left';
      return s.text + extra;
    },

    // E key: consume the press when a mission interact is in range.
    tryInteract() {
      if (!this.active) return false;
      const d = this.def();
      const s = d.steps[this.step - 1];
      if (!s || !s.interact) return false;
      const p = G.player;
      if (dist2(p.x, p.z, s.pos.x, s.pos.z) > s.radius + 2) return false;
      if (d.id === 1 && this.step === 1) {
        // M1: the E press both advances the mission AND puts Rico in the car.
        const car = p.tryEnterCarAt(GARAGE.x, GARAGE.z);
        if (!car) return false;
        this.advance();
        return true;
      }
      if (d.id === 7 && this.step === 1 && s.van) {
        const car = p.tryEnterCarAt(VAN.x, VAN.z);
        if (!car || car !== G.cars.van) return false;
        G.police.setStars(3);
        this.advance();
        G.display.msg('Van stolen — Luna PD is on you! Lose them!');
        return true;
      }
      this.advance();
      return true;
    },

    advance() {
      const d = this.def();
      this.stepT = 0;
      if (this.step < d.steps.length) {
        this.step++;
        G.hud.refresh();
      } else {
        this.complete();
      }
    },

    complete() {
      const d = this.def();
      G.cash += d.reward;
      G.rep += 160;
      this.completed.add(d.id);
      G.trace.push('mission-complete:' + d.id);
      G.sound.complete();
      G.display.dialog('Lena Cruz', 'Job done, Rico. $' + d.reward.toLocaleString() + ' in your pocket. ' + (this.index + 1 < DEFS.length ? 'Next one\'s bigger.' : 'That\'s all eight. You\'re king of Luna.'));
      G.display.msg('JOB COMPLETE — ' + d.name + ' +$' + d.reward.toLocaleString() + '  (total $' + G.cash.toLocaleString() + ')', 5000);
      G.combat.clearEnemies();
      this.index++;
      this.step = 1;
      this.stepT = 0;
      if (this.index < DEFS.length) {
        this.active = false;
        G.hud.refresh();
      } else {
        this.active = false;
        G.display.msg('ALL 8 JOBS DONE — $19,000. You are the King of Luna.', 6000);
        G.hud.refresh();
      }
    },

    fail(reason) {
      const d = this.def();
      G.trace.push('mission-fail:' + d.id);
      G.sound.fail();
      G.display.dialog('Lena Cruz', 'That one\'s blown, Rico. ' + reason + ' Shake it off — we run it again.');
      G.display.msg('JOB FAILED — ' + d.name + '. Press ENTER to retry.', 5000);
      this.active = false;
      G.combat.clearEnemies();
      G.hud.refresh();
    },

    update(dt) {
      if (!this.active) return;
      const d = this.def();
      const s = d.steps[this.step - 1];
      if (!s) return;
      const p = G.player;
      // Timed steps: M5's 90 s run, M8's 60 s survival.
      if (s.timed) {
        this.stepT += dt;
        if (s.survive) {
          if (this.stepT >= s.timed) { this.advance(); return; }
        } else if (this.stepT >= s.timed) {
          this.fail('Out of time.');
          return;
        }
      }
      // M6: ramming the sedan damages it (120/s inside 7 m, in a car).
      if (d.id === 6) {
        const sd = G.cars.sedan;
        if (p.inCar && sd.orbit.hp > 0 && dist2(p.x, p.z, sd.x, sd.z) < 7) {
          sd.orbit.hp -= 120 * dt;
          if (sd.orbit.hp <= 0) { sd.orbit.hp = 0; this.advance(); return; }
        }
      }
      // Auto steps (M5 marina pickup): proximity alone advances.
      if (s.auto && s.pos && dist2(p.x, p.z, s.pos.x, s.pos.z) < s.radius) {
        G.sound.pickup();
        this.advance();
        return;
      }
      // Check steps (M3 lose stars, M4 dealers down, M6 sedan stopped, M7 lose stars).
      if (s.check && s.check(G)) { this.advance(); return; }
      // Plain reach-the-point steps.
      if (s.pos && !s.interact && !s.auto && !s.check) {
        if (dist2(p.x, p.z, s.pos.x, s.pos.z) < s.radius) { this.advance(); return; }
      }
      // Move the beacon to the current objective.
      const op = this.objectivePos();
      if (op && this.beacon) {
        this.beacon.position.set(op.x, 0, op.z);
        this.beacon.visible = true;
      } else if (this.beacon) {
        this.beacon.visible = false;
      }
    },
  };

  // Objective beacon: a gold light pillar the player can see across the city.
  const beaconGeo = new (G.THREE.CylinderGeometry)(1.6, 1.6, 60, 12, 1, true);
  const beaconMat = new (G.THREE.MeshBasicMaterial)({
    color: 0xffd23e, transparent: true, opacity: 0.22, side: G.THREE.DoubleSide, depthWrite: false,
  });
  missions.beacon = new (G.THREE.Mesh)(beaconGeo, beaconMat);
  missions.beacon.visible = false;
  G.scene.add(missions.beacon);

  return missions;
}
