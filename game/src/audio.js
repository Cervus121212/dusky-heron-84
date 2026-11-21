// Synthesized audio for COSTA LUNA: three radio stations, police sirens and SFX.
// Everything is generated with WebAudio oscillators — no audio files, no network.
// All calls are guarded: in a headless run the context may stay suspended, and
// that must never throw.

import { clamp } from './util.js';

const STATIONS = [
  { name: 'COSTA 88', dj: 'DJ Neon', track: 'Sunset Drive', bpm: 112, root: 55.0, minor: true, wave: 'sawtooth' },
  { name: 'LA VOZ 104', dj: 'La Voz', track: 'Calle Luna', bpm: 100, root: 49.0, minor: false, wave: 'triangle' },
  { name: 'ONDA 97', dj: 'DJ Marea', track: 'Marea Alta', bpm: 124, root: 65.41, minor: true, wave: 'square' },
];

// Bass-line steps (semitone offsets from the station root) per 8th note.
const BASS_PATTERNS = [
  [0, 0, 7, 0, 10, 0, 7, 5],
  [0, 3, 0, 7, 0, 10, 7, 12],
  [0, 0, 12, 0, 7, 10, 12, 7],
];

export function buildAudio(G) {
  const audio = {
    stations: STATIONS,
    stationIndex: 0,
    muted: false,
    ctx: null,
    master: null,
    musicGain: null,
    sirenGain: null,
    sirenOsc: null,
    beatTimer: 0,
    step: 0,

    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.16;
        this.musicGain.connect(this.master);
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenGain.connect(this.master);
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 720;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenOsc.start();
      } catch (e) { this.ctx = null; return false; }
      return true;
    },

    resume() { if (this.ensure() && this.ctx.state === 'suspended') { this.ctx.resume().catch(() => {}); } },

    // One synth beat: kick on the quarter note, bass note on the 8th.
    beat(dt) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      this.beatTimer += dt;
      const st = STATIONS[this.stationIndex];
      const eighth = 60 / st.bpm / 2;
      while (this.beatTimer >= eighth) {
        this.beatTimer -= eighth;
        const t = this.ctx.currentTime + 0.02;
        const step = this.step % 8;
        // Kick: sine dropping 120 -> 40 Hz.
        const kick = this.ctx.createOscillator();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(120, t);
        kick.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        const kg = this.ctx.createGain();
        kg.gain.setValueAtTime(0.5, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        kick.connect(kg); kg.connect(this.musicGain);
        kick.start(t); kick.stop(t + 0.16);
        // Bass: station wave at the pattern note.
        const semis = BASS_PATTERNS[this.stationIndex][step];
        const freq = st.root * Math.pow(2, semis / 12);
        const bass = this.ctx.createOscillator();
        bass.type = st.wave;
        bass.frequency.value = freq;
        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(0.22, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + eighth * 0.95);
        bass.connect(bg); bg.connect(this.musicGain);
        bass.start(t); bass.stop(t + eighth);
        this.step++;
      }
    },

    // Siren wail; volume follows the nearest police unit.
    siren(nearestDist, active) {
      if (!this.ctx) return;
      const target = active ? clamp(1 - nearestDist / 220, 0, 0.5) : 0;
      this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
      const t = this.ctx.currentTime;
      this.sirenOsc.frequency.setTargetAtTime(660 + 160 * Math.sin(t * 2.4), t, 0.1);
    },

    blip(freq, dur, type, vol) {
      if (!this.ensure() || this.ctx.state !== 'running') return;
      try {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = type || 'sine';
        o.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol || 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* headless: ignore */ }
    },

    shot() { this.blip(180, 0.09, 'square', 0.2); },
    pickup() { this.blip(880, 0.12, 'sine', 0.25); this.blip(1320, 0.18, 'sine', 0.2); },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => this.blip(f, 0.22, 'triangle', 0.25), i * 90);
      });
    },
    fail() { this.blip(220, 0.3, 'sawtooth', 0.2); },

    nextStation() {
      this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
      this.step = 0;
      return STATIONS[this.stationIndex];
    },
    station() { return STATIONS[this.stationIndex]; },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
      return this.muted;
    },
  };
  return audio;
}
