// 3.7 Beer Game simplificado (regla «anclar y ajustar» de Sterman).
import { mulberry32, normal } from '../lib/rng.js';
import { variance } from '../lib/stats.js';
import { num, money } from '../lib/format.js';

const WEEKS = 36;
export const ROLES = ['Minorista', 'Mayorista', 'Distribuidor', 'Fábrica'];
export const GAME = { weeks: WEEKS, target: 12, L: 2, theta: 0.25, alpha: 0.3, beta: 0.5, invCost: 0.5, backCost: 1 };
const COLORS = ['accent', 'series-3', 'accent-2', 'series-4'];
const DASHES = ['solid', 'dashed', 'solid', 'dashed'];

export const meta = {
  id: 'beer-game', title: 'Beer Game (versión simplificada)', short: 'Beer Game', category: 'Cadena de suministro',
  horizon: WEEKS, stepLabel: 'Semana +1', stochastic: true, defaultSeed: 42, tickMs: 300,
  clock: (t) => `Semana ${t} de ${WEEKS}`,
  modes: [{ value: 'auto', label: 'Automático' }, { value: 'jugar', label: 'Jugar como minorista' }],
  intro: 'Cuatro empresas venden cerveza en cadena: minorista, mayorista, distribuidor y fábrica. Solo el minorista ve al cliente. Juega como minorista o deja que los cuatro roles decidan solos, y mira cómo se desordena la cadena.',
  card: 'Juega como minorista contra tres eslabones automáticos durante 36 semanas.',
};

export const params = [];

export function customerDemand(seed) {
  const rng = mulberry32(seed);
  const demand = [];
  for (let t = 0; t < WEEKS; t++) demand.push(t < 4 ? 4 : Math.max(0, Math.round(8 + 2 * normal(rng))));
  return demand;
}

/**
 * p.mode: 'auto' | 'jugar'; p.user: pedidos del minorista escritos por la persona (en modo jugar).
 * Devuelve la demanda, los pedidos y una foto del estado de cada rol al final de cada semana.
 */
export function simulate(p = {}, { seed = meta.defaultSeed } = {}) {
  const { target, L, theta, alpha, beta, invCost, backCost } = GAME;
  const play = p.mode === 'jugar';
  const user = p.user || [];
  const demand = customerDemand(seed);
  const st = ROLES.map(() => ({ inv: target, back: 0, pipe: Array(L).fill(4), exp: 4, sl: 4 * L, orders: [], cost: 0, shipped: 0 }));
  const snap = () => st.map((s) => ({ inv: s.inv, back: s.back, sl: s.sl, last: s.orders.length ? s.orders[s.orders.length - 1] : null, cost: s.cost }));
  const snaps = [snap()];
  const incoming = [4, 4, 4, 4];
  for (let t = 0; t < WEEKS; t++) {
    incoming[0] = demand[t];
    const placed = [];
    for (let i = 0; i < 4; i++) {
      const s = st[i];
      const arrived = s.pipe.shift();
      s.inv += arrived; s.sl -= arrived;
      const due = incoming[i] + s.back;
      const ship = Math.min(s.inv, due);
      s.inv -= ship; s.back = due - ship; s.shipped = ship;
      s.exp = theta * incoming[i] + (1 - theta) * s.exp;
      const net = s.inv - s.back;
      let o = Math.max(0, Math.round(s.exp + alpha * (target - net) + alpha * beta * (s.exp * L - s.sl)));
      if (i === 0 && play && user[t] !== undefined) o = Math.max(0, Math.min(99, Math.round(user[t])));
      s.orders.push(o); placed.push(o); s.sl += o;
      s.cost += invCost * s.inv + backCost * s.back;
    }
    for (let i = 0; i < 4; i++) st[i].pipe.push(i < 3 ? st[i + 1].shipped : placed[3]);
    for (let i = 1; i < 4; i++) incoming[i] = placed[i - 1];
    snaps.push(snap());
  }
  return { p, seed, play, horizon: WEEKS, demand, orders: st.map((s) => s.orders), snaps };
}

/** Amplificación Var(pedidos)/Var(demanda) de cada rol en las primeras t semanas. */
export function ratiosAt(r, t) {
  if (t < 2) return ROLES.map(() => NaN);
  const vD = variance(r.demand.slice(0, t));
  if (!(vD > 0)) return ROLES.map(() => NaN);
  return r.orders.map((o) => variance(o.slice(0, t)) / vD);
}

export function summarize(r, t) {
  const s = r.snaps[t];
  const ratios = ratiosAt(r, t);
  const dem = r.demand.slice(0, t);
  const total = s.reduce((a, x) => a + x.cost, 0);
  const fOrders = r.orders[3].slice(0, t);
  const all = [8, ...r.demand, ...r.orders.flat()];
  const yMax = Math.max(...all) * 1.1;
  const rows = dem.map((c, w) => [String(w + 1), String(c), ...r.orders.map((o) => String(o[w]))]);
  const blocks = [];
  if (r.play) {
    blocks.push({
      type: 'turn', id: 'turno', done: t >= WEEKS, week: t + 1, demand: r.demand[t],
      inv: s[0].inv, back: s[0].back, sl: s[0].sl,
    });
  }
  blocks.push({
    type: 'roles', id: 'roles',
    roles: ROLES.map((name, i) => ({
      name, color: COLORS[i], who: i === 0 && r.play ? 'Tú' : 'Automático',
      rows: [
        { label: 'Inventario', value: num(s[i].inv) },
        { label: 'Pendiente', value: num(s[i].back), danger: s[i].back > 0 },
        { label: 'En camino', value: num(s[i].sl) },
        { label: 'Último pedido', value: s[i].last === null ? '—' : num(s[i].last) },
        { label: 'Costo', value: money(s[i].cost) },
        { label: 'Amplificación', value: Number.isFinite(ratios[i]) ? num(ratios[i], 2) + '×' : '—' },
      ],
    })),
  });
  blocks.push({
    type: 'chart', id: 'pedidos', title: 'Pedidos por semana',
    legend: [{ label: 'Cliente', color: 'ink', dash: 'dotted' }, ...ROLES.map((n, i) => ({ label: n, color: COLORS[i], dash: DASHES[i] }))],
    alt: t < 2 ? 'Inicia la simulación para ver los pedidos de cada rol.'
      : `En ${t} semanas el cliente pidió como máximo ${Math.max(...dem)} cajas, mientras la fábrica llegó a pedir ${Math.max(...fOrders)}. La varianza de los pedidos de la fábrica es ${num(ratios[3], 2)} veces la del cliente.`,
    x: { min: 1, max: WEEKS, label: 'Semana' },
    y: { min: 0, max: yMax, label: 'Cajas' },
    series: [
      { color: 'ink', dash: 'dotted', width: 2.5, points: dem.map((v, w) => [w + 1, v]) },
      ...r.orders.map((o, i) => ({ color: COLORS[i], dash: DASHES[i], points: o.slice(0, t).map((v, w) => [w + 1, v]) })),
    ],
    table: { summary: 'Ver pedidos en tabla', caption: `Pedidos de cada rol hasta la semana ${t}`, columns: ['Semana', 'Cliente', ...ROLES], rows },
  });
  return {
    kpis: [
      { label: 'Costo total de la cadena', value: money(total), note: `semana ${t}` },
      { label: 'Amplificación en la fábrica', value: Number.isFinite(ratios[3]) ? num(ratios[3], 2) + '×' : '—', note: 'Var(pedidos fábrica) / Var(cliente)' },
      { label: 'Pedido máximo de la fábrica', value: fOrders.length ? String(Math.max(...fOrders)) : '—', note: 'cajas en una semana' },
      { label: 'Demanda máxima del cliente', value: dem.length ? String(Math.max(...dem)) : '—', note: 'cajas en una semana' },
    ],
    blocks,
  };
}

export const explain = {
  what: '36 semanas. El cliente pide 4 cajas las primeras 4 semanas y luego alrededor de 8 (aleatorio con la semilla). Cada envío tarda 2 semanas. Cada rol surte lo que puede, acumula pendientes y pide con la regla «anclar y ajustar»: pronóstico + corrección del inventario + corrección parcial de lo que ya viene en camino.',
  formulas: ['D̂ = θ·pedido recibido + (1 − θ)·D̂', 'O = máx(0, D̂ + α(12 − neto) + α·β(D̂·L − en camino))', 'costo = 0.5·inventario + 1·pendiente'],
  paramsExtra: [
    'Inventario inicial (12 cajas): existencias de cada rol en la semana 1, también su objetivo.',
    'Retraso de envío L (2 semanas): tiempo de tránsito entre eslabones y de producción en la fábrica.',
    'θ = 0.25: peso del pedido más reciente en el pronóstico.',
    'α = 0.3: rapidez con que se corrige el inventario hacia el objetivo.',
    'β = 0.5: cuánto se toma en cuenta lo que ya viene en camino (1 = todo).',
    'Costos: $0.50 por caja en inventario y $1 por caja pendiente, cada semana.',
    'Semilla: fija la serie de demanda del cliente para poder repetir la partida.',
  ],
  effects: [
    'Un solo salto en la demanda provoca primero faltantes y después exceso de inventario.',
    'La fábrica llega a pedir más del doble de lo que compra el cliente.',
    'Olvidar lo que ya viene en camino (β bajo) es la causa principal de la sobrerreacción.',
    'Pedir con calma, cerca de la demanda real, reduce el costo de toda la cadena.',
  ],
  business: [
    'Capacitar equipos de compras y planeación en pensamiento sistémico.',
    'Mostrar el valor de compartir información y coordinar pedidos entre empresas.',
    'Diseñar indicadores de desempeño de toda la cadena, no de cada área.',
  ],
};
