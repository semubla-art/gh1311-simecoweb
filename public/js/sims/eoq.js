// 3.3 Cantidad económica de pedido (EOQ).
import { num, money, pct } from '../lib/format.js';

const STEPS = 73, DAYS = 365, PER = 5;

export const meta = {
  id: 'eoq', title: 'Cantidad económica de pedido (EOQ)', short: 'EOQ', category: 'Inventarios',
  horizon: STEPS, stepLabel: '+5 días', stochastic: false, tickMs: 120,
  clock: (t) => `Día ${Math.min(DAYS, t * PER)} de ${DAYS}`,
  intro: '¿Cuántas unidades pedir cada vez? Pedir mucho ahorra en pedidos pero llena el almacén; pedir poco hace lo contrario. El modelo EOQ encuentra el lote que equilibra ambos costos.',
  card: 'Encuentra el tamaño de lote que minimiza el costo de pedir más el de almacenar.',
  actions: [{
    id: 'use-qstar', label: 'Usar Q*',
    apply: (p, r) => ({ Q: Math.min(1500, Math.max(20, Math.round(r.qStar / 5) * 5)) }),
  }],
};

export const params = [
  { key: 'D', label: 'Demanda anual (D)', min: 100, max: 10000, step: 100, default: 1200, unit: 'u/año',
    meaning: 'unidades que se venden o consumen en un año.' },
  { key: 'S', label: 'Costo por pedido (S)', min: 5, max: 500, step: 5, default: 50, unit: '$/pedido',
    meaning: 'costo fijo de emitir, transportar y recibir un pedido.' },
  { key: 'H', label: 'Costo de mantener (H)', min: 0.5, max: 20, step: 0.5, default: 2, unit: '$/u·año',
    meaning: 'costo de guardar una unidad un año: capital, espacio, seguros, merma.' },
  { key: 'c', label: 'Costo unitario (c)', min: 1, max: 100, step: 1, default: 10, unit: '$/u',
    meaning: 'precio de compra de cada unidad; no cambia Q* pero sí el costo total.' },
  { key: 'L', label: 'Tiempo de entrega (L)', min: 0, max: 30, step: 1, default: 5, unit: 'días',
    meaning: 'días entre emitir el pedido y recibirlo; define el punto de reorden.' },
  { key: 'Q', label: 'Tu tamaño de pedido (Q)', min: 20, max: 1500, step: 5, default: 400, unit: 'u',
    meaning: 'lote que eliges para compararlo con el óptimo.' },
];

export const totalCost = (D, S, H, Q) => (D * S) / Q + (H * Q) / 2;

/** Inventario del diente de sierra en el día `day` (arranca en Q y repone a Q al llegar a 0). */
export function sawtooth(Q, rate, upTo) {
  const pts = [];
  const cyc = Q / rate;
  let d = 0;
  while (d < upTo - 1e-9) {
    const end = Math.min(d + cyc, upTo);
    pts.push([d, Q], [end, Q - (end - d) * rate]);
    d = end;
  }
  return pts;
}

export function simulate(p) {
  const { D, S, H, c, L, Q } = p;
  const qStar = Math.sqrt((2 * D * S) / H);
  const tcStar = totalCost(D, S, H, qStar);
  const tcQ = totalCost(D, S, H, Q);
  const rate = D / 365;
  return {
    p, horizon: STEPS, qStar, tcStar, tcQ, rate,
    ordersPerYear: D / qStar, cycleDays: (365 * qStar) / D, rop: rate * L,
    penalty: tcQ / tcStar - 1, purchase: D * c,
    table: [0.5, 0.75, 1, 1.25, 1.5, 2].map((k) => {
      const q = qStar * k;
      return { k, q, n: D / q, order: (D * S) / q, hold: (H * q) / 2, total: totalCost(D, S, H, q) };
    }),
  };
}

export function summarize(r, t) {
  const { D, S, H, Q } = r.p;
  const day = Math.min(DAYS, t * PER);
  const qMax = Math.max(r.qStar * 3, Q * 1.2);
  const yMax = Math.max(totalCost(D, S, H, qMax), r.tcStar * 2.2);
  const curve = (f) => {
    const pts = [];
    for (let i = 1; i <= 120; i++) {
      const q = (qMax * i) / 120;
      pts.push([q, f(q)]);
    }
    return pts;
  };
  const top = Math.max(r.qStar, Q) * 1.05;
  const nOpt = day > 0 ? Math.ceil(day / r.cycleDays) : 0;
  const nUser = day > 0 ? Math.ceil(day / ((365 * Q) / D)) : 0;
  const pen = r.penalty;
  return {
    kpis: [
      { label: 'Lote óptimo Q*', value: num(r.qStar, 1) + ' u', note: `tu Q: ${num(Q)} u` },
      { label: 'Pedidos por año', value: num(r.ordersPerYear, 2), note: `cada ${num(r.cycleDays, 1)} días` },
      { label: 'Costo anual en Q*', value: money(r.tcStar), note: `pedir + mantener · compra D·c ${money(r.purchase, 0)} aparte` },
      { label: 'Costo con tu Q', value: money(r.tcQ), note: pen < 0.0005 ? 'igual al óptimo' : `+${pct(pen)} sobre el óptimo`, tone: pen < 0.0005 ? 'ok' : undefined },
      { label: 'Punto de reorden', value: num(r.rop, 1) + ' u', note: 'pedir cuando queden estas unidades' },
    ],
    blocks: [
      {
        type: 'chart', id: 'costos', title: 'Costo anual según el tamaño del pedido',
        legend: [
          { label: 'Costo total', color: 'accent' },
          { label: 'Costo de pedir D·S/Q', color: 'accent-2', dash: 'dashed' },
          { label: 'Costo de mantener H·Q/2', color: 'series-3', dash: 'dotted' },
        ],
        alt: `El costo total es mínimo en Q* = ${num(r.qStar, 1)} u con ${money(r.tcStar)} al año, donde se cruzan el costo de pedir y el de mantener. Con tu lote de ${num(Q)} u el costo es ${money(r.tcQ)}.`,
        x: { min: 0, max: qMax, label: 'Tamaño del pedido Q (u)' },
        y: { min: 0, max: yMax, label: 'Costo anual ($)', fmt: (v) => money(v, 0) },
        clip: true,
        series: [
          { color: 'accent-2', dash: 'dashed', points: curve((q) => (D * S) / q) },
          { color: 'series-3', dash: 'dotted', points: curve((q) => (H * q) / 2) },
          { color: 'accent', width: 3, points: curve((q) => totalCost(D, S, H, q)) },
        ],
        vlines: [{ x: r.qStar, color: 'muted', dash: 'dotted', label: `Q* = ${num(r.qStar, 1)}` }],
        markers: [
          { x: r.qStar, y: r.tcStar, shape: 'circle', color: 'ok' },
          { x: Q, y: Math.min(r.tcQ, yMax), shape: 'diamond', color: 'accent-2', label: 'tu Q' },
        ],
        table: {
          summary: 'Ver tabla de costos por tamaño de pedido', caption: 'Costos anuales para múltiplos de Q*',
          columns: ['Q', 'Pedidos/año', 'Costo de pedir', 'Costo de mantener', 'Total'],
          rows: r.table.map((x) => [num(x.q) + (x.k === 1 ? ' (Q*)' : ''), num(x.n, 2), money(x.order), money(x.hold), money(x.total)]),
        },
      },
      {
        type: 'chart', id: 'sierra', title: 'Nivel de inventario durante el año', height: 220,
        legend: [{ label: 'Con Q*', color: 'accent' }, { label: 'Con tu Q', color: 'accent-2', dash: 'dashed' }],
        alt: day === 0
          ? 'Inicia la simulación para ver cómo baja y se repone el inventario.'
          : `Hasta el día ${day}: con Q* se hicieron ${nOpt} pedidos y con tu Q ${nUser}. El inventario promedio es ${num(r.qStar / 2, 1)} u con Q* y ${num(Q / 2, 1)} u con tu Q.`,
        x: { min: 0, max: DAYS, label: 'Día' },
        y: { min: 0, max: top, label: 'Inventario (u)' },
        series: [
          { color: 'accent', points: sawtooth(r.qStar, r.rate, day) },
          { color: 'accent-2', dash: 'dashed', points: sawtooth(Q, r.rate, day) },
        ],
      },
    ],
  };
}

export const explain = {
  what: 'Un artículo con demanda constante y conocida. Cada pedido cuesta S sin importar su tamaño y cada unidad guardada cuesta H al año. El inventario baja en línea recta y se repone de golpe al llegar a cero: el clásico diente de sierra.',
  formulas: ['Q* = √(2·D·S / H)', 'CT(Q) = D·S/Q + H·Q/2 + D·c', 'ROP = (D / 365)·L'],
  effects: [
    'En Q* el costo de pedir es igual al de mantener.',
    'La curva del costo total es plana cerca del óptimo: equivocarse un 20 % sube el costo apenas un 2 %.',
    'Si la demanda se cuadruplica, Q* solo se duplica (crece con la raíz cuadrada).',
    'Bajar S, por ejemplo con pedidos electrónicos, permite lotes más pequeños y frecuentes.',
  ],
  business: [
    'Definir lotes de compra de materias primas y refacciones.',
    'Negociar con proveedores: cuánto vale reducir el costo por pedido.',
    'Estimar el capital inmovilizado en inventario (Q*/2 · c).',
  ],
};
