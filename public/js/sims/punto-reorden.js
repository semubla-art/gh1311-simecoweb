// 3.4 Punto de reorden con demanda variable (ventas perdidas).
import { mulberry32, normal } from '../lib/rng.js';
import { zFromServiceLevel } from '../lib/stats.js';
import { num, pct } from '../lib/format.js';

const DAYS = 180;

export const meta = {
  id: 'punto-reorden', title: 'Punto de reorden con demanda variable', short: 'Punto de reorden', category: 'Inventarios',
  horizon: DAYS, stepLabel: 'Día +1', stochastic: true, defaultSeed: 11, tickMs: 80,
  clock: (t) => `Día ${t} de ${DAYS}`,
  intro: 'La demanda diaria no es fija: algunos días se vende más. ¿Con cuánto inventario hay que pedir para no quedarse sin producto mientras llega el pedido? La respuesta es el inventario de seguridad.',
  card: 'Calcula el inventario de seguridad para un nivel de servicio dado y míralo funcionar.',
};

export const params = [
  { key: 'dbar', label: 'Demanda diaria promedio (d̄)', min: 5, max: 100, step: 1, default: 20, unit: 'u/día',
    meaning: 'unidades que se venden en un día típico.' },
  { key: 'sd', label: 'Variabilidad diaria (σ)', min: 0, max: 20, step: 0.5, default: 5, unit: 'u/día',
    meaning: 'desviación estándar de la demanda diaria: qué tanto se aleja un día del promedio.' },
  { key: 'L', label: 'Tiempo de entrega (L)', min: 1, max: 30, step: 1, default: 7, unit: 'días',
    meaning: 'días que tarda en llegar un pedido; durante ese tiempo hay riesgo de faltante.' },
  { key: 'sl', label: 'Nivel de servicio objetivo', min: 80, max: 99.9, step: 0.1, default: 95, unit: '%',
    meaning: 'probabilidad deseada de no quedarse sin producto durante un ciclo de reposición.' },
  { key: 'Q', label: 'Tamaño de pedido (Q)', min: 50, max: 1000, step: 10, default: 300, unit: 'u',
    meaning: 'cantidad que se pide cada vez (puedes usar el EOQ).' },
];

export function reorderPoint({ dbar, sd, L, sl }) {
  const z = zFromServiceLevel(sl / 100);
  const ss = z * sd * Math.sqrt(L);
  return { z, ss, rop: dbar * L + ss };
}

export function simulate(p, { seed = meta.defaultSeed } = {}) {
  const { dbar, sd, L, Q } = p;
  const { z, ss, rop } = reorderPoint(p);
  const rng = mulberry32(seed);
  let inv = ss + Q;
  const pipe = [];
  const days = [{ day: 0, demand: 0, sold: 0, inv, pos: inv, ordered: false, arrived: false, short: 0 }];
  const cum = [{ demand: 0, sold: 0, shortDays: 0, invSum: 0, orders: 0 }];
  for (let d = 1; d <= DAYS; d++) {
    let arrived = false;
    for (let i = pipe.length - 1; i >= 0; i--) {
      if (pipe[i].at === d) { inv += pipe[i].q; pipe.splice(i, 1); arrived = true; }
    }
    const demand = Math.max(0, Math.round(dbar + sd * normal(rng)));
    const sold = Math.min(inv, demand);
    inv -= sold;
    const short = demand - sold;
    const pos = inv + pipe.reduce((s, o) => s + o.q, 0);
    let ordered = false;
    if (pos <= rop) { pipe.push({ at: d + L, q: Q }); ordered = true; }
    days.push({ day: d, demand, sold, inv, pos: ordered ? pos + Q : pos, ordered, arrived, short });
    const c = cum[d - 1];
    cum.push({
      demand: c.demand + demand, sold: c.sold + sold, shortDays: c.shortDays + (short > 0 ? 1 : 0),
      invSum: c.invSum + inv, orders: c.orders + (ordered ? 1 : 0),
    });
  }
  return { p, seed, horizon: DAYS, z, ss, rop, I0: ss + Q, days, cum };
}

export function summarize(r, t) {
  const c = r.cum[t];
  const fill = c.demand > 0 ? c.sold / c.demand : NaN;
  const avgInv = t > 0 ? c.invSum / t : NaN;
  const shown = r.days.slice(0, t + 1);
  const yMax = Math.max(r.I0, r.rop, ...r.days.map((d) => d.inv), 10) * 1.08;
  const markers = [];
  for (const d of shown) {
    if (d.short > 0) markers.push({ x: d.day, y: 0, shape: 'bar', color: 'danger' });
    if (d.ordered) markers.push({ x: d.day, y: d.inv, shape: 'triangle', color: 'accent-2' });
  }
  const rows = shown.slice(-60).map((d) => [
    String(d.day), d.day ? num(d.demand) : '—', d.day ? num(d.sold) : '—', num(d.inv, 1), num(d.pos, 1),
    [d.arrived && 'llega pedido', d.ordered && 'pedido', d.short > 0 && `faltan ${d.short} u`].filter(Boolean).join(', ') || '—',
  ]);
  return {
    kpis: [
      { label: 'Inventario de seguridad', value: num(r.ss, 2) + ' u', note: `z = ${num(r.z, 3)}` },
      { label: 'Punto de reorden', value: num(r.rop, 2) + ' u', note: 'd̄·L + SS' },
      { label: 'Tasa de surtido', value: t ? pct(fill, 2) : '—', note: `${num(c.sold)} de ${num(c.demand)} u` },
      { label: 'Días con faltante', value: num(c.shortDays), note: `de ${t} días`, tone: c.shortDays > 0 ? 'danger' : undefined },
      { label: 'Inventario promedio', value: t ? num(avgInv, 1) + ' u' : '—', note: 'al cierre de cada día' },
      { label: 'Pedidos emitidos', value: num(c.orders), note: `de ${num(r.p.Q)} u cada uno` },
    ],
    blocks: [{
      type: 'chart', id: 'inventario', title: 'Inventario disponible día a día',
      legend: [
        { label: 'Inventario', color: 'accent' },
        { label: 'Punto de reorden', color: 'accent-2', dash: 'dashed' },
        { label: 'Inventario de seguridad', color: 'series-3', dash: 'dotted' },
        { label: 'Día con faltante', color: 'danger', shape: 'bar' },
        { label: 'Pedido emitido', color: 'accent-2', shape: 'triangle' },
      ],
      alt: t === 0
        ? `Arranca con ${num(r.I0, 1)} u. El punto de reorden es ${num(r.rop, 1)} u y el inventario de seguridad ${num(r.ss, 1)} u.`
        : `Al día ${t} quedan ${num(r.days[t].inv)} u; se han emitido ${c.orders} pedidos, hubo ${c.shortDays} días con faltante y la tasa de surtido es ${pct(fill, 2)}.`,
      x: { min: 0, max: DAYS, label: 'Día' },
      y: { min: 0, max: yMax, label: 'Unidades' },
      series: [{ color: 'accent', points: shown.map((d) => [d.day, d.inv]) }],
      hlines: [
        { y: r.rop, color: 'accent-2', dash: 'dashed', label: 'ROP' },
        { y: r.ss, color: 'series-3', dash: 'dotted', label: 'SS' },
      ],
      markers,
      table: {
        summary: 'Ver datos de la simulación en tabla', caption: `Últimos ${rows.length} días hasta el día ${t}`,
        columns: ['Día', 'Demanda', 'Vendido', 'Inventario', 'Posición', 'Evento'], rows,
      },
    }],
  };
}

export const explain = {
  what: 'Cada día llega una demanda aleatoria con distribución normal de media d̄ y desviación σ (generada con la semilla, así puedes repetir el experimento). Cuando la posición de inventario (disponible + en camino) cae al punto de reorden se pide Q, que llega L días después. La demanda no atendida se pierde.',
  formulas: ['SS = z · σ · √L', 'ROP = d̄ · L + SS', 'z = Φ⁻¹(nivel de servicio)'],
  effects: [
    'Con σ = 0 no hace falta inventario de seguridad: el modelo vuelve al EOQ.',
    'Pasar de 95 % a 99 % de servicio sube el inventario de seguridad un 41 %: los últimos puntos de servicio son caros.',
    'El inventario de seguridad crece con la raíz del tiempo de entrega: un proveedor más rápido ahorra inventario.',
    'Cambiar la semilla muestra que el mismo nivel de servicio puede dar años con más o menos faltantes.',
  ],
  business: [
    'Configurar alertas de reabastecimiento en el ERP o el punto de venta.',
    'Poner precio al nivel de servicio: cuánto inventario cuesta cada punto porcentual.',
    'Justificar inversiones para reducir la variabilidad o el tiempo de entrega.',
  ],
};
