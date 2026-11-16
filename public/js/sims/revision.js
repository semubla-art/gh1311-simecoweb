// 3.5 Sistemas de revisión: continua (Q, R) vs. periódica (T, S).
import { mulberry32, normal } from '../lib/rng.js';
import { zFromServiceLevel } from '../lib/stats.js';
import { num, money, pct } from '../lib/format.js';

const DAYS = 365, PER = 7, STEPS = Math.ceil(DAYS / PER);
export const COSTS = { order: 50, hold: 2, short: 5 };

export const meta = {
  id: 'revision', title: 'Sistemas de revisión: continua vs. periódica', short: 'Revisión', category: 'Inventarios',
  horizon: STEPS, stepLabel: '+7 días', stochastic: true, defaultSeed: 11, tickMs: 160,
  clock: (t) => `Día ${Math.min(DAYS, t * PER)} de ${DAYS}`,
  dayAt: (t) => Math.min(DAYS, t * PER),
  intro: 'Dos políticas enfrentan exactamente la misma demanda. La revisión continua (Q, R) vigila el inventario todo el tiempo y pide una cantidad fija. La periódica (T, S) solo revisa cada T días y completa hasta un nivel objetivo.',
  card: 'Enfrenta las políticas (Q, R) y (T, S) con la misma demanda y compara costos y faltantes.',
};

export const params = [
  { key: 'dbar', label: 'Demanda diaria promedio (d̄)', min: 5, max: 100, step: 1, default: 20, unit: 'u/día', meaning: 'consumo promedio por día.' },
  { key: 'sd', label: 'Variabilidad diaria (σ)', min: 0, max: 20, step: 0.5, default: 5, unit: 'u/día', meaning: 'desviación estándar de la demanda diaria.' },
  { key: 'L', label: 'Tiempo de entrega (L)', min: 1, max: 30, step: 1, default: 7, unit: 'días', meaning: 'días entre pedir y recibir, igual para ambas políticas.' },
  { key: 'sl', label: 'Nivel de servicio', min: 80, max: 99.9, step: 0.1, default: 95, unit: '%', meaning: 'probabilidad objetivo de no tener faltantes en un ciclo.' },
  { key: 'Q', label: 'Lote continuo (Q)', min: 50, max: 1000, step: 10, default: 300, unit: 'u', meaning: 'cantidad fija que pide la revisión continua.' },
  { key: 'T', label: 'Periodo de revisión (T)', min: 1, max: 60, step: 1, default: 14, unit: 'días', meaning: 'cada cuántos días revisa la política periódica.' },
];

function runPolicy(kind, demand, { R, S, Q, T, L, I0 }) {
  let inv = I0;
  const pipe = [];
  const inventory = [], cum = [{ demand: 0, served: 0, short: 0, shortDays: 0, invSum: 0, orders: 0 }];
  for (let d = 0; d < demand.length; d++) {
    for (let i = pipe.length - 1; i >= 0; i--) if (pipe[i].at === d) { inv += pipe[i].q; pipe.splice(i, 1); }
    const sold = Math.min(inv, demand[d]);
    const short = demand[d] - sold;
    inv -= sold;
    inventory.push(inv);
    const pos = inv + pipe.reduce((s, o) => s + o.q, 0);
    let ordered = 0;
    if (kind === 'continua' && pos <= R) { pipe.push({ at: d + L, q: Q }); ordered = 1; }
    if (kind === 'periodica' && d % T === 0) {
      const q = Math.max(0, Math.round(S - pos));
      if (q > 0) { pipe.push({ at: d + L, q }); ordered = 1; }
    }
    const c = cum[d];
    cum.push({
      demand: c.demand + demand[d], served: c.served + sold, short: c.short + short,
      shortDays: c.shortDays + (short > 0 ? 1 : 0), invSum: c.invSum + inv, orders: c.orders + ordered,
    });
  }
  return { inventory, cum };
}

/** Indicadores de una política tras `days` días. */
export function policyStats(run, days) {
  const c = run.cum[days];
  const avgInv = days > 0 ? c.invSum / days : NaN;
  return {
    avgInv, orders: c.orders, shortDays: c.shortDays, short: c.short,
    fillRate: c.demand > 0 ? c.served / c.demand : NaN,
    cost: COSTS.order * c.orders + COSTS.hold * (days > 0 ? avgInv : 0) * (days / 365) + COSTS.short * c.short,
  };
}

export function simulate(p, { seed = meta.defaultSeed } = {}) {
  const { dbar, sd, L, sl, Q, T } = p;
  const rng = mulberry32(seed);
  const demand = [];
  for (let d = 0; d < DAYS; d++) demand.push(Math.max(0, Math.round(dbar + sd * normal(rng))));
  const z = zFromServiceLevel(sl / 100);
  const R = dbar * L + z * sd * Math.sqrt(L);
  const S = dbar * (T + L) + z * sd * Math.sqrt(T + L);
  const cfg = { R, S, Q, T, L, I0: R + Q / 2 };
  return {
    p, seed, horizon: STEPS, demand, z, R, S,
    continua: runPolicy('continua', demand, cfg),
    periodica: runPolicy('periodica', demand, cfg),
  };
}

export function summarize(r, t) {
  const day = meta.dayAt(t);
  const a = policyStats(r.continua, day), b = policyStats(r.periodica, day);
  const has = day > 0;
  const best = (x, y, lower = true) => (!has || !Number.isFinite(x) || Math.abs(x - y) < 1e-9 ? null : (lower ? x < y : x > y) ? 0 : 1);
  const rows = [
    { label: 'Punto de reorden R / nivel objetivo S', cells: [num(r.R, 1) + ' u', num(r.S, 1) + ' u'], best: null },
    { label: 'Inventario promedio', cells: has ? [num(a.avgInv, 1) + ' u', num(b.avgInv, 1) + ' u'] : ['—', '—'], best: best(a.avgInv, b.avgInv) },
    { label: 'Pedidos emitidos', cells: [num(a.orders), num(b.orders)], best: best(a.orders, b.orders) },
    { label: 'Días con faltante', cells: [num(a.shortDays), num(b.shortDays)], best: best(a.shortDays, b.shortDays) },
    { label: 'Tasa de surtido', cells: has ? [pct(a.fillRate, 2), pct(b.fillRate, 2)] : ['—', '—'], best: best(a.fillRate, b.fillRate, false) },
    { label: 'Costo acumulado', cells: [money(a.cost), money(b.cost)], best: best(a.cost, b.cost) },
  ];
  const yMax = Math.max(...r.continua.inventory, ...r.periodica.inventory, r.S, 10) * 1.05;
  const vlines = [];
  for (let d = 0; d < day; d += r.p.T) vlines.push({ x: d, color: 'muted', dash: 'dotted', width: 1 });
  const pts = (arr) => arr.slice(0, day).map((v, i) => [i, v]);
  const tableRows = [];
  for (let d = Math.max(0, day - 60); d < day; d++) {
    tableRows.push([String(d), num(r.demand[d]), num(r.continua.inventory[d]), num(r.periodica.inventory[d]), d % r.p.T === 0 ? 'sí' : '—']);
  }
  const cheaper = !has ? '' : a.cost <= b.cost ? 'la continua' : 'la periódica';
  return {
    kpis: [],
    blocks: [
      { type: 'note', id: 'costos', text: `Costos fijos del escenario: ${money(COSTS.order, 0)} por pedido, ${money(COSTS.hold, 0)} por unidad-año almacenada y ${money(COSTS.short, 0)} por unidad no surtida.` },
      {
        type: 'compare', id: 'tabla', caption: `Comparación de políticas al día ${day} (en negrita, la mejor de cada fila)`,
        columns: ['Indicador', 'Continua (Q, R)', 'Periódica (T, S)'], rows,
      },
      {
        type: 'chart', id: 'inventario', title: 'Inventario disponible con cada política',
        legend: [
          { label: 'Continua (Q, R)', color: 'accent' },
          { label: 'Periódica (T, S)', color: 'accent-2', dash: 'dashed' },
          { label: 'Día de revisión', color: 'muted', dash: 'dotted' },
        ],
        alt: has
          ? `Al día ${day}, la continua promedia ${num(a.avgInv, 1)} u con ${a.orders} pedidos y la periódica ${num(b.avgInv, 1)} u con ${b.orders} pedidos; el costo acumulado es menor con ${cheaper}.`
          : `Ambas políticas arrancan con ${num(r.R + r.p.Q / 2, 1)} u. La periódica revisa cada ${r.p.T} días.`,
        x: { min: 0, max: DAYS, label: 'Día' },
        y: { min: 0, max: yMax, label: 'Unidades' },
        series: [
          { color: 'accent', points: pts(r.continua.inventory) },
          { color: 'accent-2', dash: 'dashed', points: pts(r.periodica.inventory) },
        ],
        vlines,
        table: {
          summary: 'Ver datos de la simulación en tabla', caption: `Últimos ${tableRows.length} días hasta el día ${day}`,
          columns: ['Día', 'Demanda', 'Inv. continua', 'Inv. periódica', 'Revisión'], rows: tableRows,
        },
      },
    ],
  };
}

export const explain = {
  what: 'Un año de demanda diaria aleatoria (misma semilla para ambas políticas). La continua pide Q cuando la posición cae a R. La periódica, cada T días, pide lo necesario para llevar la posición hasta S. La periódica debe protegerse durante T + L días, no solo L.',
  formulas: ['R = d̄·L + z·σ·√L', 'S = d̄·(T + L) + z·σ·√(T + L)', 'pedido periódico = S − posición'],
  effects: [
    'Con el mismo nivel de servicio, la periódica necesita más inventario de seguridad.',
    'Los pedidos periódicos cambian de tamaño; los continuos siempre son Q.',
    'Alargar T reduce el número de revisiones y pedidos, pero sube el inventario promedio.',
    'Si T es corto, ambas políticas se parecen.',
  ],
  business: [
    'La continua conviene para artículos caros o críticos (clase A) con inventario en tiempo real.',
    'La periódica simplifica compras consolidadas con un proveedor que visita cada semana.',
    'Comparar el costo de vigilar el inventario contra el costo de tener más existencias.',
  ],
};
