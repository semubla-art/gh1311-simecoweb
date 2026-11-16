// 3.8 Teoría de colas (M/M/c) y cuellos de botella en una línea de servicio.
import { mulberry32, exponential } from '../lib/rng.js';
import { mean } from '../lib/stats.js';
import { num, pct } from '../lib/format.js';

const DAY = 480, PER = 10, STEPS = DAY / PER, SAMPLE = 2;

export const meta = {
  id: 'colas', title: 'Teoría de colas y cuellos de botella', short: 'Colas', category: 'Servicios',
  horizon: STEPS, stepLabel: '+10 min', stochastic: true, defaultSeed: 3, tickMs: 160,
  clock: (t) => `Minuto ${t * PER} de ${DAY}`,
  intro: 'Clientes que llegan al azar a un mostrador con uno o varios servidores. Compara las fórmulas del modelo M/M/c con una jornada simulada de 8 horas y encuentra la estación que limita todo el flujo de servicio.',
  card: 'Modelos M/M/1 y M/M/c, y una línea de estaciones con su restricción.',
};

export const params = [
  { key: 'lam', label: 'Tasa de llegada (λ)', min: 0.5, max: 20, step: 0.5, default: 4, unit: 'clientes/h', meaning: 'clientes que llegan en promedio por hora.' },
  { key: 'mu', label: 'Tasa de servicio (μ)', min: 0.5, max: 20, step: 0.5, default: 5, unit: 'clientes/h', meaning: 'clientes que atiende un servidor por hora; 1/μ es el tiempo medio de atención.' },
  { key: 'c', label: 'Servidores (c)', min: 1, max: 6, step: 1, default: 1, unit: '', meaning: 'número de cajeros, ventanillas o agentes que atienden una sola fila.' },
  { key: 'pay', label: 'Capacidad de pago', min: 1, max: 20, step: 0.5, default: 8, unit: 'clientes/h', meaning: 'clientes por hora que procesa la estación de pago.' },
  { key: 'deliv', label: 'Capacidad de entrega', min: 1, max: 20, step: 0.5, default: 10, unit: 'clientes/h', meaning: 'clientes por hora que procesa la estación de entrega.' },
];

/** Modelo analítico M/M/c (Erlang C). Tiempos en horas. */
export function mmc(lam, mu, c) {
  const A = lam / mu, rho = A / c;
  if (rho >= 1) return { rho, stable: false, P0: 0, Pw: 1, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity };
  let s = 0, f = 1;
  for (let n = 0; n < c; n++) { if (n > 0) f *= n; s += A ** n / f; }
  let cf = 1;
  for (let k = 2; k <= c; k++) cf *= k;
  const top = A ** c / (cf * (1 - rho));
  const P0 = 1 / (s + top);
  const Lq = (P0 * A ** c * rho) / (cf * (1 - rho) ** 2);
  const Wq = Lq / lam, W = Wq + 1 / mu;
  return { rho, stable: true, P0, Pw: top * P0, Lq, Wq, W, L: lam * W };
}

/** Línea de servicio: utilización por estación y cuello de botella. */
export function serviceLine({ lam, mu, c, pay, deliv }) {
  const stations = [
    { name: 'Recepción', cap: 12 }, { name: 'Atención', cap: c * mu },
    { name: 'Pago', cap: pay }, { name: 'Entrega', cap: deliv },
  ].map((s) => ({ ...s, util: lam / s.cap }));
  let b = 0;
  stations.forEach((s, i) => { if (s.util > stations[b].util) b = i; });
  return { stations, bottleneck: stations[b].name, bottleneckIdx: b, flow: Math.min(lam, stations[b].cap) };
}

/** Jornada simulada por eventos discretos (minutos). */
export function simulateDay({ lam, mu, c }, seed) {
  const rng = mulberry32(seed);
  const free = Array(c).fill(0);
  const customers = [];
  let tArr = 0;
  for (;;) {
    tArr += exponential(rng, lam) * 60;
    const svc = exponential(rng, mu) * 60;
    if (tArr > DAY) break;
    let k = 0;
    for (let i = 1; i < c; i++) if (free[i] < free[k]) k = i;
    const start = Math.max(tArr, free[k]);
    const end = start + svc;
    free[k] = end;
    customers.push({ arr: tArr, start, end, server: k });
  }
  const samples = [];
  for (let s = 0; s <= DAY; s += SAMPLE) {
    let n = 0, q = 0;
    for (const x of customers) {
      if (x.arr <= s && x.end > s) { n++; if (x.start > s) q++; }
    }
    samples.push({ time: s, n, q });
  }
  return { customers, samples };
}

/** Indicadores simulados hasta el minuto m. */
export function statsAt(day, c, m) {
  const smp = day.samples.filter((s) => s.time <= m);
  const started = day.customers.filter((x) => x.start <= m);
  const done = day.customers.filter((x) => x.end <= m);
  const busy = day.customers.reduce((a, x) => a + Math.max(0, Math.min(x.end, m) - Math.min(x.start, m)), 0);
  return {
    L: mean(smp.map((s) => s.n)), Lq: mean(smp.map((s) => s.q)),
    Wq: started.length ? mean(started.map((x) => x.start - x.arr)) / 60 : NaN,
    W: done.length ? mean(done.map((x) => x.end - x.arr)) / 60 : NaN,
    Pw: started.length ? started.filter((x) => x.start - x.arr > 1e-9).length / started.length : NaN,
    util: m > 0 ? busy / (c * m) : NaN,
    arrived: day.customers.filter((x) => x.arr <= m).length, served: done.length,
  };
}

export function simulate(p, { seed = meta.defaultSeed } = {}) {
  const theory = mmc(p.lam, p.mu, p.c);
  const line = serviceLine(p);
  const day = simulateDay(p, seed);
  return { p, seed, horizon: STEPS, theory, line, day };
}

const minutes = (h) => (Number.isFinite(h) ? num(h * 60, 1) + ' min' : num(h));
const clockText = (m) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')} h`;

export function summarize(r, t) {
  const m = t * PER;
  const th = r.theory;
  const sim = statsAt(r.day, r.p.c, m);
  const has = t > 0;
  const now = r.day.customers.filter((x) => x.arr <= m && x.end > m);
  const busy = Array(r.p.c).fill(false);
  now.forEach((x) => { if (x.start <= m) busy[x.server] = true; });
  const queue = now.filter((x) => x.start > m).length;
  const smp = r.day.samples.filter((s) => s.time <= m);
  const yMax = Math.max(...r.day.samples.map((s) => s.n), th.stable ? th.L : 0, 4) * 1.1;
  const blocks = [];
  if (!th.stable) {
    blocks.push({ type: 'alert', id: 'inestable', text: `Sistema inestable: llegan más clientes de los que se pueden atender (ρ = ${num(th.rho, 2)} ≥ 1). La cola crece sin límite.` });
  }
  const s = (v, f) => (has && Number.isFinite(v) ? f(v) : '—');
  blocks.push({
    type: 'compare', id: 'teoria', caption: `Teoría M/M/${r.p.c} contra la jornada simulada hasta el minuto ${m}`,
    columns: ['Indicador', 'Fórmula', 'Simulado'],
    rows: [
      { label: 'Utilización ρ', cells: [pct(th.rho, 1), s(sim.util, (v) => pct(v, 1))], best: null },
      { label: 'Clientes en el sistema L', cells: [num(th.L, 2), s(sim.L, (v) => num(v, 2))], best: null },
      { label: 'Clientes en la fila Lq', cells: [num(th.Lq, 2), s(sim.Lq, (v) => num(v, 2))], best: null },
      { label: 'Tiempo en el sistema W', cells: [minutes(th.W), s(sim.W, minutes)], best: null },
      { label: 'Espera en la fila Wq', cells: [minutes(th.Wq), s(sim.Wq, minutes)], best: null },
      { label: 'Probabilidad de esperar', cells: [pct(th.Pw, 1), s(sim.Pw, (v) => pct(v, 1))], best: null },
    ],
  });
  blocks.push({
    type: 'counter', id: 'mostrador', title: 'El mostrador ahora', servers: busy, queue,
    text: `${clockText(m)}: ${busy.filter(Boolean).length} de ${r.p.c} servidores ocupados y ${queue} ${queue === 1 ? 'cliente' : 'clientes'} en la fila. Llegaron ${sim.arrived} y salieron ${sim.served}.`,
  });
  blocks.push({
    type: 'chart', id: 'sistema', title: 'Clientes en el sistema durante la jornada', height: 240,
    legend: [{ label: 'Simulado', color: 'accent' }, ...(th.stable ? [{ label: 'L teórico', color: 'accent-2', dash: 'dashed' }] : [])],
    alt: has
      ? `Hasta las ${clockText(m)} hubo en promedio ${num(sim.L, 2)} clientes en el sistema; la teoría predice ${num(th.L, 2)}. Ahora hay ${now.length}.`
      : 'Inicia la simulación para ver la jornada.',
    x: { min: 0, max: 8, label: 'Hora de la jornada', fmt: (v) => num(v) + ' h' },
    y: { min: 0, max: yMax, label: 'Clientes' },
    series: [{ color: 'accent', step: true, points: smp.map((x) => [x.time / 60, x.n]) }],
    hlines: th.stable ? [{ y: th.L, color: 'accent-2', dash: 'dashed', label: 'L' }] : [],
    vlines: has ? [{ x: m / 60, color: 'muted', dash: 'dotted' }] : [],
    table: {
      summary: 'Ver datos de la simulación en tabla', caption: `Clientes en el sistema cada 10 minutos hasta el minuto ${m}`,
      columns: ['Minuto', 'En el sistema', 'En la fila'],
      rows: smp.filter((x) => x.time % 10 === 0).map((x) => [String(x.time), String(x.n), String(x.q)]),
    },
  });
  const ln = r.line;
  blocks.push({
    type: 'bars', id: 'linea', title: 'Línea de servicio: ¿dónde está el cuello de botella?',
    note: `Flujo máximo: ${num(ln.flow, 1)} clientes/h (limitado por ${ln.bottleneck}).`,
    items: ln.stations.map((st, i) => ({
      label: `${st.name} · ${num(st.cap, 1)}/h`, value: Math.min(st.util, 1), max: 1,
      text: pct(st.util, 0) + (i === ln.bottleneckIdx ? ' · cuello' : ''),
      color: st.util >= 1 ? 'danger' : i === ln.bottleneckIdx ? 'accent-2' : 'accent', strong: i === ln.bottleneckIdx,
    })),
    alt: `Utilizaciones: ${ln.stations.map((st) => `${st.name} ${pct(st.util, 0)}`).join(', ')}. El cuello de botella es ${ln.bottleneck}.`,
  });
  return {
    kpis: [
      { label: 'Utilización ρ', value: pct(th.rho, 1), note: th.stable ? 'estable' : 'inestable', tone: th.stable ? undefined : 'danger' },
      { label: 'Clientes en el sistema L', value: num(th.L, 2), note: has ? `simulado ${num(sim.L, 2)}` : 'teórico' },
      { label: 'Espera en fila Wq', value: minutes(th.Wq), note: has && Number.isFinite(sim.Wq) ? `simulado ${minutes(sim.Wq)}` : 'teórico' },
      { label: 'Cuello de botella', value: ln.bottleneck, note: `flujo máx. ${num(ln.flow, 1)}/h` },
    ],
    blocks,
  };
}

export const explain = {
  what: 'Llegadas de Poisson (tiempos entre llegadas exponenciales) y tiempos de servicio exponenciales, una sola fila y c servidores en orden de llegada. La simulación genera una jornada concreta; las fórmulas dan el promedio a largo plazo.',
  formulas: ['ρ = λ / (c·μ)', 'M/M/1: L = ρ/(1 − ρ), W = 1/(μ − λ)', 'Lq = λ·Wq, L = Lq + λ/μ (Little)'],
  paramsExtra: ['Semilla: fija la jornada aleatoria para poder repetirla.', 'Recepción tiene una capacidad fija de 12 clientes/h.'],
  effects: [
    'La espera no crece en línea recta: de 80 % a 90 % de utilización, la fila promedio se duplica.',
    'Juntar dos servidores en una sola fila espera menos que dos filas separadas.',
    'Mejorar una estación que no es el cuello de botella no aumenta el flujo.',
    'Una jornada simulada puede alejarse bastante del promedio teórico.',
  ],
  business: [
    'Dimensionar cajas, ventanillas, centros de llamadas o muelles de carga.',
    'Equilibrar el costo de un servidor más contra el costo de la espera del cliente.',
    'Priorizar inversiones en la restricción del proceso (teoría de restricciones).',
  ],
};
