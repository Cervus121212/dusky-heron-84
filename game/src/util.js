// Shared math + deterministic RNG for COSTA LUNA.
// Every random choice in the city uses a seeded generator so the world is identical
// on every load (same seed -> same streets, same buildings, same traffic spawn).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

// Smallest signed angle from a to b, in [-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Ease an angle toward a target at most `rate` radians per second.
export function angleEase(current, target, rate, dt) {
  const d = angleDiff(current, target);
  const step = clamp(d, -rate * dt, rate * dt);
  return current + step;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function fmtCash(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fmtClock(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = Math.floor(totalMin % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Pick a deterministic element from an array with a seeded rng.
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
