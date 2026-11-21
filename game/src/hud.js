// HUD for COSTA LUNA: stars, cash, clock, rep rank, radio, mission panel,
// health/armour, weapon slots, message pill, dialogs, and the 190 px minimap.
// Minimap colors (from the design spec): land #4d555e, road #9aa3ad,
// sand #dcc78f, sea #2a7a9e, park #6a9a5a, docks #96999e.

import { fmtCash, fmtClock, clamp } from './util.js';

export function buildHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    msgTimer: null,
    dlgTimer: null,

    refresh() {
      const st = G.police.stars;
      $('stars').textContent = '★★★★★'.slice(0, st) + '☆☆☆☆☆'.slice(0, 5 - st);
      $('cash').textContent = fmtCash(G.cash);
      $('clock').textContent = fmtClock(G.clockMin);
      const rep = Math.floor(G.rep);
      const rank = rep < 320 ? 'ROOKIE' : rep < 800 ? 'DRIVER' : 'KING';
      $('rep').textContent = rank + ' · ' + rep + ' REP';
      const station = G.sound.station();
      document.querySelector('#radio .st').textContent = station.name;
      document.querySelector('#radio .dj').textContent = station.dj + ' · ' + station.track;
      const d = G.missions.def();
      const ch = $('mission').querySelector('.ch');
      const mt = $('mission').querySelector('.mt');
      const ob = $('mission').querySelector('.ob');
      const nx = $('mission').querySelector('.nx');
      if (G.missions.active && d) {
        ch.textContent = d.chapter;
        mt.textContent = d.name + ' — $' + d.reward.toLocaleString();
        ob.textContent = G.missions.objectiveText();
        const next = G.missions.index + 1 < 8 ? 'NEXT: ' + ['First Wheels', 'The Pickup', 'Hot Pursuit', 'Dockside Deal', 'Getaway Driver', 'The Informant', 'Beachfront Heist', 'King of Luna'][G.missions.index + 1] : 'FINAL JOB';
        nx.textContent = next;
      } else if (G.missions.completed.size >= 8) {
        ch.textContent = 'COSTA LUNA';
        mt.textContent = 'King of Luna';
        ob.textContent = 'All 8 jobs done — $19,000. The coast is yours.';
        nx.textContent = '';
      } else {
        ch.textContent = 'COSTA LUNA';
        mt.textContent = 'Between jobs';
        ob.textContent = 'Press ENTER to start job ' + (G.missions.index + 1) + ' of 8.';
        nx.textContent = '';
      }
      $('healthfill').style.width = clamp(G.player.health, 0, 100) + '%';
      $('armourfill').style.width = clamp(G.player.armour, 0, 100) + '%';
      const w = G.combat.weapon();
      $('slot0').textContent = '1 · PISTOL ∞';
      $('slot1').textContent = '2 · SMG ' + G.combat.ammo;
      $('slot0').classList.toggle('on', G.combat.weaponIndex === 0);
      $('slot1').classList.toggle('on', G.combat.weaponIndex === 1);
      this.drawMinimap();
    },

    msg(text, durMs = 3000) {
      const el = $('msg');
      el.textContent = text;
      el.style.display = 'block';
      clearTimeout(this.msgTimer);
      this.msgTimer = setTimeout(() => { el.style.display = 'none'; }, durMs);
    },

    dialog(who, text, durMs = 6000) {
      $('dlgnm').textContent = who;
      $('dlgface').textContent = who.charAt(0);
      $('dlgtx').textContent = text;
      const el = $('dialog');
      el.style.display = 'block';
      clearTimeout(this.dlgTimer);
      this.dlgTimer = setTimeout(() => { el.style.display = 'none'; }, durMs);
    },

    flashDamage() {
      const v = $('vignette');
      v.style.opacity = '1';
      setTimeout(() => { v.style.opacity = '0'; }, 180);
    },

    drawMinimap() {
      const cv = $('minimap');
      const x = cv.getContext('2d');
      const S = 190, HALF = 288;
      const px = (m) => ((m + HALF) / (HALF * 2)) * S;
      const pw = (m) => (m / (HALF * 2)) * S;
      x.fillStyle = '#4d555e'; x.fillRect(0, 0, S, S);
      // Parks.
      x.fillStyle = '#6a9a5a';
      x.fillRect(px(-24), px(104), pw(48), pw(48));
      x.fillRect(px(104), px(-152), pw(48), pw(48));
      // Docks apron + beach sand.
      x.fillStyle = '#96999e'; x.fillRect(px(224), 0, S - px(224), px(224));
      x.fillStyle = '#dcc78f'; x.fillRect(0, px(224), S, S - px(224));
      // Sea strip at the very bottom.
      x.fillStyle = '#2a7a9e'; x.fillRect(0, S - 4, S, 4);
      // Roads.
      x.fillStyle = '#9aa3ad';
      for (let g = -256; g <= 256; g += 64) {
        x.fillRect(0, px(g - 8), S, pw(16));
        x.fillRect(px(g - 8), 0, pw(16), S);
      }
      const dot = (mx, mz, color, r = 3) => {
        x.fillStyle = color;
        x.beginPath(); x.arc(px(mx), px(mz), r, 0, Math.PI * 2); x.fill();
      };
      dot(-60, -168, '#7dff9a', 4); // S safehouse
      dot(-120, 24, '#ffd23e', 4);  // G garage
      dot(60, 232, '#9fd8ff', 4);   // Y yacht
      // Objective marker.
      const op = G.missions.objectivePos();
      if (op) {
        x.fillStyle = '#ffd23e';
        x.font = 'bold 16px Arial'; x.textAlign = 'center';
        x.fillText('!', px(op.x), px(op.z) + 5);
      }
      // Police dots.
      for (const c of G.police.cars) dot(c.x, c.z, '#ff4a4a', 2.5);
      if (G.police.heli) dot(G.police.heli.x, G.police.heli.z, '#4aa7ff', 3);
      // Player arrow: white downward triangle rotated by -heading.
      x.save();
      x.translate(px(G.player.x), px(G.player.z));
      x.rotate(-G.player.heading);
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.moveTo(0, 6); x.lineTo(-4.5, -4); x.lineTo(4.5, -4); x.closePath();
      x.fill();
      x.restore();
    },
  };
  return hud;
}
