// Generador pseudoaleatorio con semilla (mulberry32) y normal estándar (Box–Muller).
// Toda la aleatoriedad de js/sims/ pasa por aquí: nunca se usa el generador del navegador.

/** Devuelve una función que produce números uniformes en [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal estándar por Box–Muller; consume 2 números del generador. */
export function normal(rng) {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Exponencial con tasa `rate` (en las mismas unidades que se pidan). */
export function exponential(rng, rate) {
  return -Math.log(1 - rng()) / rate;
}

/** Normaliza una semilla al rango 1–9999. */
export function cleanSeed(v, fallback = 1) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(9999, Math.max(1, n));
}
