// Estadística básica (funciones puras).

export const sum = (a) => a.reduce((s, x) => s + x, 0);

export function mean(a) {
  return a.length ? sum(a) / a.length : NaN;
}

/** Varianza muestral (n − 1). Con menos de 2 datos devuelve NaN. */
export function variance(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
}

/** z para un nivel de servicio p (0–1), Abramowitz–Stegun 26.2.23. */
export function zFromServiceLevel(p) {
  if (p <= 0.5) return p === 0.5 ? 0 : -zFromServiceLevel(1 - p);
  const t = Math.sqrt(-2 * Math.log(1 - p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) /
    (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t ** 3);
}
