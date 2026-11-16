// Reference implementations used to derive handoff test values.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(rng) {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const variance = a => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };

// Beer game
export function beerGame({ seed = 42, weeks = 36, L = 2, alpha = 0.3, beta = 0.5, theta = 0.25, target = 12 } = {}) {
  const rng = mulberry32(seed);
  const demand = [];
  for (let t = 0; t < weeks; t++) demand.push(t < 4 ? 4 : Math.max(0, Math.round(8 + 2 * normal(rng))));
  const st = [0, 1, 2, 3].map(() => ({ inv: 12, back: 0, pipe: Array(L).fill(4), exp: 4, sl: 4 * L, orders: [], cost: 0 }));
  const incoming = [4, 4, 4, 4]; // orders arriving to each role this week
  for (let t = 0; t < weeks; t++) {
    incoming[0] = demand[t];
    const placed = [];
    for (let i = 0; i < 4; i++) {
      const s = st[i];
      const arrived = s.pipe.shift();
      s.inv += arrived; s.sl -= arrived;
      const due = incoming[i] + s.back;
      const ship = Math.min(s.inv, due);
      s.inv -= ship; s.back = due - ship;
      s.shipped = ship;
      s.exp = theta * incoming[i] + (1 - theta) * s.exp;
      const net = s.inv - s.back;
      const o = Math.max(0, Math.round(s.exp + alpha * (target - net) + alpha * beta * (s.exp * L - s.sl)));
      s.orders.push(o); placed.push(o); s.sl += o;
      s.cost += 0.5 * s.inv + 1 * s.back;
    }
    for (let i = 0; i < 4; i++) {
      // shipment from upstream (factory: production of its own order)
      const supply = i < 3 ? st[i + 1].shipped : placed[3];
      st[i].pipe.push(supply);
    }
    // NOTE: role i+1 shipped this week against incoming[i+1] (last week's order of role i)
    for (let i = 1; i < 4; i++) incoming[i] = placed[i - 1];
  }
  const vd = variance(demand);
  return { demand, orders: st.map(s => s.orders), ratio: st.map(s => variance(s.orders) / vd), cost: st.map(s => s.cost), total: st.reduce((a, s) => a + s.cost, 0) };
}

// Bullwhip: order-up-to S_t = L·MA_p (Chen et al. 2000), exact form of README §3.6.
// Returns ratios [consumer, retailer, wholesaler, distributor, factory]. T21: seed 7, t = 104.
export function bullwhip({ seed = 7, mu = 100, sd = 20, L = 2, p = 4, neg = true, t = 104, W = 40 } = {}) {
  const rng = mulberry32(seed);
  const N = W + 104, D = [];
  for (let i = 0; i < N; i++) D.push(mu + sd * normal(rng));
  const series = [D];
  for (let k = 0; k < 4; k++) {
    const x = series[k], q = [];
    for (let i = 0; i < N; i++) { const v = i < p ? x[i] : x[i] + (L / p) * (x[i] - x[i - p]); q.push(neg ? v : Math.max(0, v)); }
    series.push(q);
  }
  const vD = variance(D.slice(W, W + t));
  return { ratios: series.map(s => variance(s.slice(W, W + t)) / vD), formula: 1 + 2 * L / p + 2 * L * L / (p * p) };
}

// z from service level (Abramowitz–Stegun 26.2.23), README §3.
export function zFromServiceLevel(p) {
  const t = Math.sqrt(-2 * Math.log(1 - p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t ** 3);
}

// M/M/c analytic (Erlang C), README §3.8. T5: (4,5,1) → L = 4. T6: (4,3,2) → Lq ≈ 1.067.
export function mmc(lam, mu, c) {
  const A = lam / mu, rho = A / c;
  if (rho >= 1) return { rho, stable: false, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity };
  let s = 0, f = 1;
  for (let n = 0; n < c; n++) { if (n > 0) f *= n; s += A ** n / f; }
  let cf = 1; for (let k = 2; k <= c; k++) cf *= k;
  const top = A ** c / (cf * (1 - rho)), P0 = 1 / (s + top);
  const Lq = P0 * A ** c * rho / (cf * (1 - rho) ** 2), Wq = Lq / lam, W = Wq + 1 / mu;
  return { rho, stable: true, P0, Pw: top * P0, Lq, Wq, W, L: lam * W };
}

// Run: node design/reference/sim-reference.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const b = beerGame({ seed: 42 });
  console.log('T23 beer seed 42 ratios', b.ratio.map(r => r.toFixed(2)), 'cost', b.total.toFixed(2));
  console.log('T21 bullwhip', bullwhip().ratios.map(r => r.toFixed(2)));
  console.log('T19 revision', JSON.stringify(inventory()));
  console.log('T5', mmc(4, 5, 1), 'T6', mmc(4, 3, 2));
  console.log('T16 z95', zFromServiceLevel(0.95).toFixed(4));
}

// ROP / continuous vs periodic
export function inventory({ seed = 11, days = 365, dbar = 20, sd = 5, L = 7, z = 1.645, Q = 300, T = 14 } = {}) {
  const rng = mulberry32(seed);
  const dem = []; for (let t = 0; t < days; t++) dem.push(Math.max(0, Math.round(dbar + sd * normal(rng))));
  const ss = z * sd * Math.sqrt(L); const rop = dbar * L + ss;
  const run = (policy) => {
    let inv = rop + Q / 2, pipe = []; let stockDays = 0, short = 0, orders = 0, sum = 0, served = 0;
    const Ssup = dbar * (T + L) + z * sd * Math.sqrt(T + L);
    for (let t = 0; t < days; t++) {
      pipe = pipe.filter(o => { if (o.at === t) { inv += o.q; return false; } return true; });
      const sh = Math.min(inv, dem[t]); served += sh; if (sh < dem[t]) { stockDays++; short += dem[t] - sh; }
      inv -= sh; sum += inv;
      const pos = inv + pipe.reduce((s, o) => s + o.q, 0);
      if (policy === 'Q' && pos <= rop) { pipe.push({ at: t + L, q: Q }); orders++; }
      if (policy === 'P' && t % T === 0) { const q = Math.max(0, Math.round(Ssup - pos)); if (q > 0) { pipe.push({ at: t + L, q }); orders++; } }
    }
    return { avgInv: sum / days, stockDays, fillRate: served / mean(dem) / days, orders };
  };
  return { ss, rop, Q: run('Q'), P: run('P'), Ssup: dbar * (T + L) + z * sd * Math.sqrt(T + L) };
}
