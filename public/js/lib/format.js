// Formato numérico con Intl.NumberFormat('es-MX'), con formateadores en caché.
const cache = new Map();

function fmt(min, max) {
  const k = min + ':' + max;
  if (!cache.has(k)) {
    cache.set(k, new Intl.NumberFormat('es-MX', { minimumFractionDigits: min, maximumFractionDigits: max }));
  }
  return cache.get(k);
}

/** Número con `dec` decimales fijos. */
export function num(v, dec = 0) {
  if (v === Infinity) return '∞';
  if (v === -Infinity) return '−∞';
  if (!Number.isFinite(v)) return '—';
  const s = fmt(dec, dec).format(Math.abs(v) < 0.5 * 10 ** -dec ? 0 : v);
  return s.replace('-', '−');
}

/** Número con hasta `dec` decimales (sin ceros a la derecha). */
export function numTrim(v, dec = 2) {
  if (!Number.isFinite(v)) return num(v);
  return fmt(0, dec).format(v).replace('-', '−');
}

export function money(v, dec = 2) {
  if (!Number.isFinite(v)) return num(v);
  return (v < 0 ? '−$' : '$') + num(Math.abs(v), dec);
}

export function pct(v, dec = 1) {
  if (!Number.isFinite(v)) return num(v);
  return num(v * 100, dec) + ' %';
}

/** Decimales que implica un paso de deslizador (0.25 → 2). */
export function decimalsOf(step) {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}
