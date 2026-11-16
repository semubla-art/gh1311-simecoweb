// Casos T1–T26 de README-handoff.md §4. Se ejecutan en Node (sims.test.mjs) y en el navegador (index.html).
import { mulberry32 } from '../public/js/lib/rng.js';
import { zFromServiceLevel } from '../public/js/lib/stats.js';
import * as od from '../public/js/sims/oferta-demanda.js';
import * as ic from '../public/js/sims/interes-compuesto.js';
import * as eoq from '../public/js/sims/eoq.js';
import * as rop from '../public/js/sims/punto-reorden.js';
import * as rev from '../public/js/sims/revision.js';
import * as bw from '../public/js/sims/bullwhip.js';
import * as beer from '../public/js/sims/beer-game.js';
import * as colas from '../public/js/sims/colas.js';

const defaults = (mod, over = {}) => ({ ...Object.fromEntries(mod.params.map((p) => [p.key, p.default])), ...over });

function close(actual, expected, tol = 0.01, msg = '') {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${msg} esperado ${expected} ± ${tol}, obtenido ${actual}`);
  }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'condición falsa'); }
function eq(a, b, msg = '') { if (a !== b) throw new Error(`${msg} esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); }

export const cases = [
  ['T1 EOQ: Q*, pedidos, ciclo y CT(Q*)', () => {
    const r = eoq.simulate(defaults(eoq));
    close(r.qStar, 244.95, 0.01, 'Q*'); close(r.ordersPerYear, 4.90, 0.01, 'pedidos');
    close(r.cycleDays, 74.5, 0.05, 'ciclo'); close(r.tcStar, 489.90, 0.01, 'CT');
  }],
  ['T2 EOQ: CT(400) y penalización', () => {
    const r = eoq.simulate(defaults(eoq, { Q: 400 }));
    close(r.tcQ, 550, 0.01, 'CT(400)'); close(r.penalty * 100, 12.27, 0.01, 'penalización %');
  }],
  ['T3 EOQ: D × 4 → Q* × 2', () => {
    const r = eoq.simulate(defaults(eoq, { D: 4800 }));
    close(r.qStar, 489.90, 0.01, 'Q*');
  }],
  ['T4 EOQ: ROP', () => { close(eoq.simulate(defaults(eoq, { L: 5 })).rop, 16.44, 0.01, 'ROP'); }],
  ['T5 Colas M/M/1 (4, 5)', () => {
    const m = colas.mmc(4, 5, 1);
    close(m.rho, 0.8, 1e-9); close(m.L, 4); close(m.Lq, 3.2); close(m.W, 1); close(m.Wq, 0.8); close(m.Pw, 0.8);
  }],
  ['T6 Colas M/M/2 (4, 3)', () => {
    const m = colas.mmc(4, 3, 2);
    close(m.rho, 0.667, 0.001); close(m.P0, 0.2); close(m.Lq, 1.067, 0.001); close(m.L, 2.4); close(m.W, 0.6); close(m.Pw, 0.533, 0.001);
  }],
  ['T7 Colas inestable', () => {
    const m = colas.mmc(5, 5, 1);
    eq(m.stable, false, 'estable'); eq(m.L, Infinity, 'L');
    const r = colas.simulate(defaults(colas, { lam: 5, mu: 5 }));
    ok(r.theory.stable === false && colas.summarize(r, 0).blocks.some((b) => b.type === 'alert'), 'falta la alerta');
  }],
  ['T8 Colas cuello de botella', () => {
    let l = colas.serviceLine({ lam: 4, mu: 5, c: 1, pay: 8, deliv: 10 });
    eq(l.bottleneck, 'Atención'); close(l.stations[1].util, 0.8); close(l.flow, 4);
    l = colas.serviceLine({ lam: 4, mu: 5, c: 1, pay: 3, deliv: 10 });
    eq(l.bottleneck, 'Pago'); close(l.flow, 3);
  }],
  ['T9 Oferta y demanda sin impuesto', () => {
    const r = od.simulate(defaults(od));
    close(r.pStar, 28.57); close(r.qStar, 62.86);
  }],
  ['T10 Oferta y demanda con impuesto 5', () => {
    const r = od.simulate(defaults(od, { tax: 5 }));
    close(r.pStar, 30.71); close(r.qStar, 58.57); close(r.revenue, 292.86); close(r.dwl, 10.71);
  }],
  ['T11 Oferta y demanda: convergencia y oscilación', () => {
    const r = od.simulate(defaults(od, { k: 0.3, p0: 50 }));
    ok(Math.abs(r.prices[30] - r.pStar) < 0.01, 'no converge');
    for (let i = 1; i <= 30; i++) ok(Math.sign(r.prices[i] - r.pStar) !== -Math.sign(r.prices[i - 1] - r.pStar) || Math.abs(r.prices[i] - r.pStar) < 1e-9, 'oscila con k = 0.3');
    const o = od.simulate(defaults(od, { k: 1.5, p0: 50 }));
    for (let i = 1; i <= 10; i++) ok(Math.sign(o.prices[i] - o.pStar) === -Math.sign(o.prices[i - 1] - o.pStar), `no alterna en t = ${i}`);
  }],
  ['T12 Interés compuesto: 1 000 al 10 % anual, 2 años', () => {
    close(ic.futureValue({ c0: 1000, ap: 0, r: 0.10, n: 1, years: 2 }), 1210.00);
    const r = ic.simulate(defaults(ic, { c0: 1000, ap: 0, ra: 10, nIdx: 0, yrs: 2 }));
    close(r.A[2], 1210.00);
  }],
  ['T13 Interés compuesto: 10 000 al 8 % mensual, 10 años', () => {
    close(ic.futureValue({ c0: 10000, ap: 0, r: 0.08, n: 12, years: 10 }), 22196.40);
  }],
  ['T14 Interés compuesto: aportes de 100 al 12 %', () => {
    close(ic.futureValue({ c0: 0, ap: 100, r: 0.12, n: 12, years: 1 }), 1268.25);
  }],
  ['T15 Interés compuesto: valores por defecto', () => {
    const r = ic.simulate(defaults(ic));
    close(r.A[20], 167072.11); close(r.teaA * 100, 8.30, 0.005);
  }],
  ['T16 z por nivel de servicio', () => {
    close(zFromServiceLevel(0.90), 1.2816, 0.001); close(zFromServiceLevel(0.95), 1.6449, 0.001); close(zFromServiceLevel(0.99), 2.3263, 0.001);
    close(zFromServiceLevel(0.95), 1.6452, 0.0001);
  }],
  ['T17 Punto de reorden: SS y ROP', () => {
    const r = rop.simulate(defaults(rop));
    close(r.ss, 21.76); close(r.rop, 161.76);
  }],
  ['T18 Punto de reorden con σ = 0', () => {
    for (const seed of [1, 11, 500, 9999]) {
      for (const Q of [140, 300, 1000]) {
        const r = rop.simulate(defaults(rop, { sd: 0, Q }), { seed });
        eq(r.ss, 0, 'SS'); eq(r.rop, 140, 'ROP');
        eq(r.cum[180].shortDays, 0, `faltantes (semilla ${seed}, Q ${Q})`);
      }
    }
  }],
  ['T19 Revisión continua vs. periódica (semilla 11)', () => {
    const r = rev.simulate(defaults(rev), { seed: 11 });
    const a = rev.policyStats(r.continua, 365), b = rev.policyStats(r.periodica, 365);
    close(a.avgInv, 173.26, 0.05, 'inv. continua'); eq(a.orders, 25, 'pedidos continua'); eq(a.shortDays, 1, 'faltantes continua'); close(a.fillRate * 100, 99.94, 0.01);
    close(b.avgInv, 185.87, 0.05, 'inv. periódica'); eq(b.orders, 27, 'pedidos periódica'); eq(b.shortDays, 1, 'faltantes periódica'); close(b.fillRate * 100, 99.81, 0.01);
    close(r.S, 457.69, 0.02, 'S');
    eq(rev.meta.dayAt(r.horizon), 365, 'horizonte');
  }],
  ['T20 Bullwhip teórico', () => { close(bw.theoretical(2, 4), 2.5, 1e-9); close(bw.simulate(defaults(bw)).theory, 2.5, 1e-9); }],
  ['T21 Bullwhip semilla 7', () => {
    const r = bw.simulate(defaults(bw), { seed: 7 });
    const ratios = bw.ratiosAt(r, 104);
    [1.00, 2.50, 7.18, 22.64, 76.07].forEach((v, i) => close(ratios[i], v, 0.05, `eslabón ${i}`));
    for (let i = 1; i < 5; i++) ok(ratios[i] > ratios[i - 1], 'no es estrictamente creciente');
  }],
  ['T22 Bullwhip L = 0', () => {
    const r = bw.simulate(defaults(bw, { L: 0 }), { seed: 7 });
    bw.ratiosAt(r, 104).forEach((v) => close(v, 1, 1e-9));
  }],
  ['T23 Beer Game semilla 42', () => {
    const r = beer.simulate({ mode: 'auto' }, { seed: 42 });
    eq(r.demand.join(','), '4,4,4,4,6,7,4,6,7,10,7,4,7,1,9,10,11,9,10,10,9,5,13,6,6,7,9,9,7,6,7,9,7,8,12,5', 'demanda');
    const ratios = beer.ratiosAt(r, 36);
    [0.76, 1.24, 2.62, 4.40].forEach((v, i) => close(ratios[i], v, 0.01, ` ${beer.ROLES[i]}`));
    eq(Math.max(...r.orders[3]), 19, 'pedido máx. fábrica'); eq(Math.max(...r.demand), 13, 'demanda máx.');
    close(r.snaps[36].reduce((s, x) => s + x.cost, 0), 934.00, 0.01, 'costo');
  }],
  ['T24 Beer Game: amplificación medible', () => {
    const ratios = beer.ratiosAt(beer.simulate({ mode: 'auto' }, { seed: 42 }), 36);
    ok(ratios[3] >= 2, 'fábrica < 2');
    ok(ratios[1] < ratios[2] && ratios[2] < ratios[3], 'no crece de mayorista a fábrica');
  }],
  ['T25 mulberry32(42)', () => {
    const g = mulberry32(42);
    [0.6011037519, 0.4482905590, 0.8524657935].forEach((v) => close(g(), v, 1e-9));
  }],
  ['T26 Determinismo de las simulaciones estocásticas', () => {
    const cfgs = [
      [rop, (r) => r.days.map((d) => d.demand)], [rev, (r) => r.demand], [bw, (r) => r.series[0]],
      [beer, (r) => r.demand], [colas, (r) => r.day.customers.map((c) => c.arr)],
    ];
    for (const [mod, pick] of cfgs) {
      const p = mod === beer ? { mode: 'auto' } : defaults(mod);
      const a = JSON.stringify(mod.simulate(p, { seed: 123 }));
      const b = JSON.stringify(mod.simulate(p, { seed: 123 }));
      eq(a === b, true, `${mod.meta.id} no es determinista`);
      const s1 = JSON.stringify(pick(mod.simulate(p, { seed: 123 })));
      const s2 = JSON.stringify(pick(mod.simulate(p, { seed: 124 })));
      ok(s1 !== s2, `${mod.meta.id}: otra semilla da la misma serie`);
    }
  }],
];

// Comprobación adicional: summarize funciona en todos los periodos de todas las simulaciones.
export const smoke = [
  ['summarize en todo el horizonte (8 simulaciones)', () => {
    for (const mod of [od, ic, eoq, rop, rev, bw, beer, colas]) {
      const p = mod === beer ? { mode: 'auto' } : defaults(mod);
      const r = mod.simulate(p, { seed: mod.meta.defaultSeed });
      for (let t = 0; t <= r.horizon; t++) {
        const s = mod.summarize(r, t);
        ok(Array.isArray(s.kpis) && Array.isArray(s.blocks), `${mod.meta.id} t = ${t}`);
      }
    }
  }],
];
