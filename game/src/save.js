// Save / load for COSTA LUNA. One localStorage key, one JSON blob:
// cash, completed missions, player position, clock, reputation.
// Loading never throws: a corrupt or missing save just starts a fresh run.

export const SAVE_KEY = 'portovela-save-v3';

export function buildSave(G) {
  return {
    saveGame() {
      try {
        const data = {
          cash: G.cash,
          completed: [...G.missions.completed],
          missionIndex: G.missions.index,
          player: { x: G.player.x, z: G.player.z, health: G.player.health, armour: G.player.armour },
          clockMin: G.clockMin,
          rep: G.rep,
          savedAt: Date.now(),
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },

    loadSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (typeof data.cash !== 'number') return false;
        G.cash = data.cash;
        G.rep = data.rep || 0;
        G.clockMin = data.clockMin || 18 * 60 + 53;
        if (Array.isArray(data.completed)) {
          G.missions.completed = new Set(data.completed);
        }
        if (data.player) {
          G.player.x = data.player.x; G.player.z = data.player.z;
          G.player.health = data.player.health ?? 100;
          G.player.armour = data.player.armour ?? 0;
          G.player.syncMesh();
        }
        return true;
      } catch (e) { return false; }
    },

    hasSave() {
      try { return localStorage.getItem(SAVE_KEY) !== null; } catch (e) { return false; }
    },
  };
}
