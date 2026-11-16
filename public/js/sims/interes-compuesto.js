// 3.2 Interés compuesto y decisiones financieras.
import { num, money, pct } from '../lib/format.js';

export const N_VALUES = [1, 2, 4, 12, 365];
const N_LABELS = ['Anual (1)', 'Semestral (2)', 'Trimestral (4)', 'Mensual (12)', 'Diaria (365)'];

export const meta = {
  id: 'interes-compuesto', title: 'Interés compuesto y decisiones financieras', short: 'Interés compuesto', category: 'Finanzas',
  horizon: 20, stepLabel: 'Año +1', stochastic: false, tickMs: 400,
  clock: (t, r) => `Año ${t} de ${r ? r.horizon : 20}`,
  intro: 'Compara dos alternativas de inversión año con año: un capital inicial, aportes mensuales y la frecuencia con que se capitalizan los intereses. La inflación te muestra cuánto vale de verdad el resultado.',
  card: 'Compara alternativas de inversión con aportes, capitalización e inflación.',
};

export const params = [
  { key: 'c0', label: 'Capital inicial (C₀)', min: 0, max: 100000, step: 500, default: 10000, unit: '$',
    format: (v) => money(v, 0), meaning: 'dinero que se invierte el día 0.' },
  { key: 'ap', label: 'Aporte mensual (A)', min: 0, max: 2000, step: 50, default: 200, unit: '$/mes',
    format: (v) => money(v, 0) + '/mes', meaning: 'monto que se agrega al final de cada mes.' },
  { key: 'ra', label: 'Tasa anual alternativa A (r)', min: 0, max: 20, step: 0.25, default: 8, unit: '%',
    meaning: 'tasa nominal anual de la opción A (por ejemplo, un fondo de inversión).' },
  { key: 'rb', label: 'Tasa anual alternativa B', min: 0, max: 20, step: 0.25, default: 5, unit: '%',
    meaning: 'tasa nominal anual de la opción B (por ejemplo, un depósito a plazo).' },
  { key: 'nIdx', label: 'Capitalización (n)', min: 0, max: 4, step: 1, default: 3, unit: 'veces/año',
    format: (v) => N_LABELS[v], meaning: 'cuántas veces al año los intereses se suman al saldo.' },
  { key: 'yrs', label: 'Plazo (t)', min: 1, max: 40, step: 1, default: 20, unit: 'años', resetOnChange: true,
    meaning: 'horizonte de la decisión; cambiarlo reinicia la simulación.' },
  { key: 'inf', label: 'Inflación anual (π)', min: 0, max: 12, step: 0.25, default: 4, unit: '%',
    meaning: 'pérdida anual de poder de compra del dinero.' },
];

/** Valor futuro con aportes vencidos mensuales. r en tanto por uno. */
export function futureValue({ c0, ap, r, n, years }) {
  const i = (1 + r / n) ** (n / 12) - 1;
  const lump = c0 * (1 + r / n) ** (n * years);
  const annuity = i === 0 ? ap * 12 * years : ap * ((1 + i) ** (12 * years) - 1) / i;
  return lump + annuity;
}

export const effectiveRate = (r, n) => (1 + r / n) ** n - 1;

export function simulate(p) {
  const n = N_VALUES[p.nIdx];
  const ra = p.ra / 100, rb = p.rb / 100, inf = p.inf / 100;
  const years = [], A = [], B = [], real = [], paid = [];
  for (let y = 0; y <= p.yrs; y++) {
    years.push(y);
    A.push(futureValue({ c0: p.c0, ap: p.ap, r: ra, n, years: y }));
    B.push(futureValue({ c0: p.c0, ap: p.ap, r: rb, n, years: y }));
    real.push(A[y] / (1 + inf) ** y);
    paid.push(p.c0 + 12 * p.ap * y);
  }
  const teaA = effectiveRate(ra, n), teaB = effectiveRate(rb, n);
  const double = teaA > 0 ? Math.log(2) / Math.log(1 + teaA) : Infinity;
  return { p, n, horizon: p.yrs, years, A, B, real, paid, teaA, teaB, double };
}

export function summarize(r, t) {
  const yMax = Math.max(...r.A, ...r.B, ...r.paid, 1) * 1.05;
  const pts = (arr) => arr.slice(0, t + 1).map((v, i) => [i, v]);
  const adv = r.A[t] - r.B[t];
  const rows = r.years.slice(0, t + 1).map((y) => [String(y), money(r.paid[y], 0), money(r.A[y], 0), money(r.B[y], 0), money(r.real[y], 0)]);
  const lossReal = r.real[t] < r.real[Math.max(0, t - 1)];
  return {
    kpis: [
      { label: 'Saldo alternativa A', value: money(r.A[t], 0), note: `año ${t} · aportado ${money(r.paid[t], 0)}` },
      { label: 'Saldo alternativa B', value: money(r.B[t], 0), note: `TEA B ${pct(r.teaB, 2)}` },
      { label: 'Ventaja A − B', value: money(adv, 0), note: adv >= 0 ? 'a favor de A' : 'a favor de B' },
      { label: 'A en pesos de hoy', value: money(r.real[t], 0), note: `descontando ${num(r.p.inf, 2)} % de inflación` },
      { label: 'Tasa efectiva anual A', value: pct(r.teaA, 2), note: Number.isFinite(r.double) ? `se duplica en ${num(r.double, 1)} años` : 'no crece sin tasa' },
    ],
    blocks: [{
      type: 'chart', id: 'saldo', title: 'Saldo acumulado por año',
      legend: [
        { label: 'Alternativa A', color: 'accent' },
        { label: 'Alternativa B', color: 'accent-2', dash: 'dashed' },
        { label: 'A en pesos de hoy', color: 'series-3', dash: 'dotted' },
        { label: 'Total aportado', color: 'muted', dash: 'dashed' },
      ],
      alt: `Al año ${t}, A acumula ${money(r.A[t], 0)} y B ${money(r.B[t], 0)} con ${money(r.paid[t], 0)} aportados; en pesos de hoy A vale ${money(r.real[t], 0)}${lossReal ? ' y está perdiendo poder de compra' : ''}.`,
      x: { min: 0, max: r.horizon, label: 'Años' },
      y: { min: 0, max: yMax, label: 'Saldo ($)', fmt: (v) => money(v, 0) },
      series: [
        { color: 'accent', points: pts(r.A) },
        { color: 'accent-2', dash: 'dashed', points: pts(r.B) },
        { color: 'series-3', dash: 'dotted', points: pts(r.real) },
        { color: 'muted', dash: 'dashed', width: 1.5, points: pts(r.paid) },
      ],
      vlines: [{ x: t, color: 'muted', dash: 'dotted', label: `año ${t}` }],
      table: { summary: 'Ver datos de la simulación en tabla', caption: `Saldos por año hasta el año ${t}`, columns: ['Año', 'Aportado', 'Saldo A', 'Saldo B', 'A real'], rows },
    }],
  };
}

export const explain = {
  what: 'El crecimiento de un saldo cuando los intereses generan a su vez intereses. Cada mes se suma un aporte fijo al final del mes. La línea punteada descuenta la inflación para expresar el saldo en poder de compra de hoy.',
  formulas: ['VF = C₀(1 + r/n)^(n·t) + A·[(1 + i)^(12t) − 1] / i', 'i = (1 + r/n)^(n/12) − 1', 'TEA = (1 + r/n)^n − 1'],
  effects: [
    'Las curvas se abren con el tiempo: unos puntos de tasa valen poco a 3 años y muchísimo a 30.',
    'Capitalizar más seguido sube la tasa efectiva, pero el efecto es pequeño frente a la tasa y el plazo.',
    'Si la tasa es menor que la inflación, el saldo crece en pesos pero pierde poder de compra.',
    'Regla del 72: el capital se duplica en unos 72 / r años.',
  ],
  business: [
    'Elegir entre alternativas de inversión o de financiamiento con el mismo horizonte.',
    'Comparar créditos con distinta frecuencia de capitalización usando la tasa efectiva anual.',
    'Planear fondos de reposición de equipo, jubilación o expansión con aportes periódicos.',
  ],
};
