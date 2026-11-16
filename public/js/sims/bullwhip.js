// 3.6 Efecto látigo (Chen et al., 2000): nivel objetivo S_t = L·MA_p(t).
import { mulberry32, normal } from '../lib/rng.js';
import { variance } from '../lib/stats.js';
import { num } from '../lib/format.js';

const WEEKS = 104, WARMUP = 40;
export const STAGES = ['Consumidor', 'Minorista', 'Mayorista', 'Distribuidor', 'Fábrica'];
const COLORS = ['muted', 'accent', 'series-3', 'accent-2', 'series-4'];
const DASHES = ['dotted', 'solid', 'dashed', 'solid', 'dashed'];

export const meta = {
  id: 'bullwhip', title: 'Efecto látigo (bullwhip effect)', short: 'Efecto látigo', category: 'Cadena de suministro',
  horizon: WEEKS, stepLabel: 'Semana +1', stochastic: true, defaultSeed: 7, tickMs: 110,
  clock: (t) => `Semana ${t} de ${WEEKS}`,
  intro: 'El consumidor compra de forma bastante estable, pero cada eslabón pronostica y repone con retraso. Resultado: los pedidos se vuelven más erráticos cuanto más lejos se está del cliente.',
  card: 'Mira cómo una demanda estable se amplifica eslabón tras eslabón.',
};

export const params = [
  { key: 'mu', label: 'Demanda media (μ)', min: 50, max: 200, step: 5, default: 100, unit: 'u/semana', meaning: 'compras promedio del consumidor final por semana.' },
  { key: 'sd', label: 'Variabilidad de la demanda (σ)', min: 0, max: 40, step: 1, default: 20, unit: 'u/semana', meaning: 'desviación estándar de la demanda semanal del consumidor.' },
  { key: 'L', label: 'Tiempo de entrega (L)', min: 0, max: 8, step: 1, default: 2, unit: 'semanas', meaning: 'semanas que tarda en llegar lo que pide cada eslabón.' },
  { key: 'p', label: 'Semanas del pronóstico (p)', min: 1, max: 20, step: 1, default: 4, unit: 'semanas', meaning: 'cuántas semanas promedia cada eslabón para pronosticar.' },
  { key: 'neg', type: 'checkbox', label: 'Permitir devoluciones (pedidos negativos)', default: true,
    meaning: 'si se desactiva, un pedido nunca es menor que cero, como en la práctica.' },
];

export const theoretical = (L, p) => 1 + (2 * L) / p + (2 * L * L) / (p * p);

export function simulate(prm, { seed = meta.defaultSeed } = {}) {
  const { mu, sd, L, p, neg } = prm;
  const rng = mulberry32(seed);
  const N = WARMUP + WEEKS;
  const D = [];
  for (let i = 0; i < N; i++) D.push(mu + sd * normal(rng));
  const series = [D];
  for (let k = 0; k < 4; k++) {
    const x = series[k], q = [];
    for (let i = 0; i < N; i++) {
      const v = i < p ? x[i] : x[i] + (L / p) * (x[i] - x[i - p]);
      q.push(neg ? v : Math.max(0, v));
    }
    series.push(q);
  }
  return { p: prm, seed, horizon: WEEKS, W: WARMUP, series, theory: theoretical(L, p) };
}

/** Razones Var(q_k)/Var(D) usando las semanas [W, W + t). */
export function ratiosAt(r, t) {
  if (t < 2) return STAGES.map(() => NaN);
  const vD = variance(r.series[0].slice(r.W, r.W + t));
  return r.series.map((s) => {
    const v = variance(s.slice(r.W, r.W + t));
    return vD > 0 ? v / vD : 1;
  });
}

export function summarize(r, t) {
  const ratios = ratiosAt(r, t);
  const maxR = Math.max(...ratios.filter(Number.isFinite), r.theory, 1);
  const vis = r.series.map((s) => s.slice(r.W, r.W + WEEKS));
  const all = vis.flat();
  let yMin = Math.min(0, ...all), yMax = Math.max(...all, 1);
  const pad = (yMax - yMin) * 0.05;
  const negCount = vis.slice(1).reduce((s, arr) => s + arr.slice(0, t).filter((v) => v < 0).length, 0);
  const rows = [];
  for (let i = Math.max(0, t - 60); i < t; i++) rows.push([String(i + 1), ...vis.map((s) => num(s[i], 1))]);
  return {
    kpis: [],
    blocks: [
      {
        type: 'bars', id: 'amplificacion', title: 'Amplificación de la varianza de pedidos',
        note: `Teórico del minorista: 1 + 2L/p + 2L²/p² = ${num(r.theory, 2)}×`,
        items: STAGES.map((name, i) => ({
          label: name, value: ratios[i], max: maxR,
          text: Number.isFinite(ratios[i]) ? num(ratios[i], 2) + '×' : '—', color: COLORS[i] === 'muted' ? 'muted' : COLORS[i],
        })),
        alt: t < 2
          ? 'Avanza al menos dos semanas para medir la amplificación.'
          : `Tras ${t} semanas, la varianza de los pedidos respecto a la del consumidor es: minorista ${num(ratios[1], 2)}×, mayorista ${num(ratios[2], 2)}×, distribuidor ${num(ratios[3], 2)}× y fábrica ${num(ratios[4], 2)}×.`,
      },
      {
        type: 'chart', id: 'pedidos', title: 'Pedidos semanales por eslabón',
        legend: STAGES.map((s, i) => ({ label: s, color: COLORS[i], dash: DASHES[i] })),
        alt: t < 1 ? 'Inicia la simulación para ver los pedidos de cada eslabón.'
          : `Semana ${t}: el consumidor pidió ${num(vis[0][t - 1], 0)} u y la fábrica ${num(vis[4][t - 1], 0)} u.${negCount ? ` Hay ${negCount} pedidos negativos (devoluciones).` : ''}`,
        x: { min: 1, max: WEEKS, label: 'Semana' },
        y: { min: yMin - (yMin < 0 ? pad : 0), max: yMax + pad, label: 'Unidades' },
        series: vis.map((s, i) => ({ color: COLORS[i], dash: DASHES[i], width: i === 0 ? 2.5 : 2, points: s.slice(0, t).map((v, w) => [w + 1, v]) })),
        hlines: yMin < 0 ? [{ y: 0, color: 'muted', width: 1 }] : [],
        table: {
          summary: 'Ver datos de la simulación en tabla', caption: `Pedidos de las últimas ${rows.length} semanas`,
          columns: ['Semana', ...STAGES], rows,
        },
      },
    ],
  };
}

export const explain = {
  what: 'Cuatro eslabones en serie. Cada uno pronostica con un promedio móvil de las últimas p semanas de pedidos que recibe y repone con una política de nivel objetivo S = L · pronóstico. Sus pedidos son la demanda del eslabón siguiente.',
  formulas: ['q(t) = D(t) + (L/p)·[D(t) − D(t−p)]', 'Var(q)/Var(D) = 1 + 2L/p + 2L²/p²'],
  effects: [
    'La amplificación se multiplica en cada eslabón: la fábrica ve la demanda más distorsionada.',
    'Tiempos de entrega más largos (L) empeoran mucho el efecto.',
    'Pronosticar con más historia (p mayor) suaviza los pedidos.',
    'Con L = 0 no hay amplificación: el problema nace del retraso.',
  ],
  business: [
    'Justificar compartir datos de punto de venta con proveedores (VMI, CPFR).',
    'Reducir tiempos de entrega y evitar promociones que inflan pedidos.',
    'Explicar por qué la capacidad de la fábrica oscila aunque el mercado sea estable.',
  ],
};
