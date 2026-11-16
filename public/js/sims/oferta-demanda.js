// 3.1 Oferta y demanda: mercado lineal con ajuste walrasiano del precio.
import { num, money } from '../lib/format.js';

const T = 30;

export const meta = {
  id: 'oferta-demanda', title: 'Oferta y demanda', short: 'Oferta y demanda', category: 'Mercados',
  horizon: T, stepLabel: 'Paso +1', stochastic: false, tickMs: 450,
  clock: (t) => `Periodo ${t} de ${T}`,
  intro: 'Un mercado con demanda y oferta lineales. Si hay exceso de demanda el precio sube; si hay exceso de oferta, baja. Observa cómo converge al equilibrio y cómo lo mueve un impuesto.',
  card: 'Desplaza las curvas, aplica un impuesto y observa cómo el precio converge al equilibrio.',
};

export const params = [
  { key: 'a', label: 'Demanda máxima (a)', min: 50, max: 200, step: 1, default: 120, unit: 'u',
    meaning: 'cantidad que se pediría a precio cero; sube con el ingreso o la popularidad del producto.' },
  { key: 'b', label: 'Sensibilidad de la demanda (b)', min: 0.5, max: 5, step: 0.1, default: 2, unit: 'u por $',
    meaning: 'unidades que se dejan de comprar por cada $1 de aumento de precio.' },
  { key: 'c', label: 'Oferta base (c)', min: 0, max: 80, step: 1, default: 20, unit: 'u',
    meaning: 'cantidad ofrecida aun a precio cero; refleja capacidad instalada.' },
  { key: 'd', label: 'Sensibilidad de la oferta (d)', min: 0.5, max: 5, step: 0.1, default: 1.5, unit: 'u por $',
    meaning: 'unidades adicionales que producen los vendedores por cada $1 más de precio.' },
  { key: 'tax', label: 'Impuesto por unidad (t)', min: 0, max: 20, step: 0.5, default: 0, unit: '$/u',
    meaning: 'monto que el vendedor entrega al fisco por unidad vendida.' },
  { key: 'k', label: 'Velocidad de ajuste (k)', min: 0.05, max: 1.9, step: 0.05, default: 0.3, unit: '',
    meaning: 'qué tan rápido reacciona el precio al desequilibrio.' },
  { key: 'p0', label: 'Precio inicial (P₀)', min: 0, max: 80, step: 1, default: 50, unit: '$',
    meaning: 'precio con el que arranca el mercado en el periodo 0.' },
];

export function equilibrium({ a, b, c, d, tax = 0 }) {
  const pStar = (a - c + d * tax) / (b + d);
  const qStar = Math.max(0, a - b * pStar);
  return { pStar, qStar, ps: pStar - tax };
}

export function simulate(p) {
  const { a, b, c, d, tax, k, p0 } = p;
  const qd = (P) => Math.max(0, a - b * P);
  const qs = (P) => Math.max(0, c + d * (P - tax));
  const { pStar, qStar, ps } = equilibrium(p);
  const q0Star = equilibrium({ a, b, c, d, tax: 0 }).qStar;
  const cs = 0.5 * qStar * (a / b - pStar);
  const ep = qStar * ps - (qStar > c ? (qStar - c) ** 2 / (2 * d) : 0);
  const revenue = tax * qStar;
  const dwl = 0.5 * tax * (q0Star - qStar);
  const prices = [p0];
  for (let i = 0; i < T; i++) {
    const P = prices[i];
    prices.push(Math.max(0, P + k * (qd(P) - qs(P)) / (b + d)));
  }
  return {
    p, horizon: T, pStar, qStar, ps, q0Star, cs, ep, revenue, dwl, prices,
    qd: prices.map(qd), qs: prices.map(qs),
  };
}

export function summarize(r, t) {
  const { a, b, c, d, tax } = r.p;
  const P = r.prices[t];
  const ex = r.qd[t] - r.qs[t];
  const pMax = Math.max(a / b, 10) * 1.05;
  const qMax = a;
  const sample = (f) => {
    const pts = [];
    for (let j = 0; j <= 60; j++) {
      const pp = (pMax * j) / 60;
      const q = f(pp);
      if (q <= qMax) pts.push([q, pp]);
    }
    return pts;
  };
  const series = [
    { color: 'accent', points: [[a, 0], [Math.max(0, a - b * pMax), Math.min(pMax, a / b)]] },
    { color: 'accent-2', points: sample((pp) => Math.max(0, c + d * pp)) },
  ];
  const legend = [
    { label: 'Demanda', color: 'accent' },
    { label: 'Oferta', color: 'accent-2' },
  ];
  if (tax > 0) {
    series.push({ color: 'accent-2', dash: 'dashed', points: sample((pp) => Math.max(0, c + d * (pp - tax))) });
    legend.push({ label: 'Oferta con impuesto', color: 'accent-2', dash: 'dashed' });
  }
  legend.push({ label: 'Precio actual', color: 'series-3', dash: 'dotted' });
  const exText = Math.abs(ex) < 0.05
    ? 'el mercado está en equilibrio'
    : ex > 0 ? `hay exceso de demanda de ${num(ex, 1)} u y el precio subirá` : `hay exceso de oferta de ${num(-ex, 1)} u y el precio bajará`;
  const alt = `Equilibrio en Q* = ${num(r.qStar, 1)} u y P* = ${money(r.pStar)}. En el periodo ${t} el precio es ${money(P)}: ${exText}.`;
  const trajMax = Math.max(...r.prices, r.pStar, 1) * 1.1;
  const rows = [];
  for (let i = 0; i <= t; i++) {
    rows.push([String(i), money(r.prices[i]), num(r.qd[i], 1), num(r.qs[i], 1), num(r.qd[i] - r.qs[i], 1)]);
  }
  const dev = P - r.pStar;
  return {
    kpis: [
      { label: 'Precio de equilibrio P*', value: money(r.pStar), note: tax > 0 ? `el vendedor recibe ${money(r.ps)}` : 'sin impuesto' },
      { label: 'Cantidad de equilibrio Q*', value: num(r.qStar, 1) + ' u', note: tax > 0 ? `sin impuesto: ${num(r.q0Star, 1)} u` : 'Qd = Qs' },
      { label: 'Precio actual P(t)', value: money(P), note: `periodo ${t} · ${dev >= 0 ? '+' : '−'}${money(Math.abs(dev))} vs. P*` },
      { label: 'Excedente total', value: money(r.cs + r.ep, 1), note: `consumidor ${money(r.cs, 1)} · productor ${money(r.ep, 1)}` },
      { label: 'Recaudación', value: money(r.revenue, 1), note: `pérdida irrecuperable ${money(r.dwl, 1)}` },
    ],
    blocks: [
      {
        type: 'chart', id: 'curvas', title: 'Curvas de oferta y demanda', legend, alt,
        x: { min: 0, max: qMax, label: 'Cantidad (u)' },
        y: { min: 0, max: pMax, label: 'Precio ($/u)' },
        series,
        hlines: [{ y: Math.min(P, pMax), color: 'series-3', dash: 'dotted', label: `P(${t})` }],
        markers: [{ x: r.qStar, y: r.pStar, shape: 'circle', color: 'ink', label: 'Equilibrio' }],
      },
      {
        type: 'chart', id: 'trayectoria', title: 'Trayectoria del precio por periodo', height: 220,
        legend: [{ label: 'Precio P(t)', color: 'accent' }, { label: 'Equilibrio P*', color: 'muted', dash: 'dashed' }],
        alt: `Del periodo 0 al ${t} el precio pasó de ${money(r.prices[0])} a ${money(P)}; el equilibrio es ${money(r.pStar)}.`,
        x: { min: 0, max: T, label: 'Periodo' },
        y: { min: 0, max: trajMax, label: 'Precio ($)' },
        series: [{ color: 'accent', points: r.prices.slice(0, t + 1).map((v, i) => [i, v]), dots: t < 40 }],
        hlines: [{ y: r.pStar, color: 'muted', dash: 'dashed', label: 'P*' }],
        table: {
          summary: 'Ver datos de la simulación en tabla', caption: `Precio y cantidades del periodo 0 al ${t}`,
          columns: ['Periodo', 'Precio', 'Qd', 'Qs', 'Exceso de demanda'], rows,
        },
      },
    ],
  };
}

export const explain = {
  what: 'La demanda Qd = a − b·P cae cuando sube el precio; la oferta Qs = c + d·(P − t) crece con él. En cada periodo el precio se corrige en proporción al exceso de demanda (ajuste walrasiano) hasta que ambas cantidades coinciden.',
  formulas: ['P* = (a − c + d·t) / (b + d)', 'P(t+1) = P(t) + k·(Qd − Qs) / (b + d)', 'EC = ½·Q*·(a/b − P*)'],
  effects: [
    'Subir «a» desplaza la demanda: suben precio y cantidad de equilibrio.',
    'Un impuesto sube el precio al comprador, baja el que recibe el vendedor y crea una pérdida irrecuperable.',
    'Con k cerca de 1 el precio llega rápido; por encima de 1 oscila; cerca de 2 casi no converge.',
    'Cuanto más inclinadas (inelásticas) las curvas, mayor parte del impuesto absorbe ese lado.',
  ],
  business: [
    'Fijar precios y anticipar cómo responde el volumen de ventas.',
    'Estimar quién paga un impuesto o arancel nuevo y cuánto cae el mercado.',
    'Entender por qué un precio fijado lejos del equilibrio deja faltantes o excedentes de inventario.',
  ],
};
