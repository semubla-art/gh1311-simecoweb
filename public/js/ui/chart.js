// Gráficas SVG generadas a mano: líneas, guías, marcadores y barras horizontales.
// Los colores son variables CSS (var(--accent), …), así respetan el tema claro/oscuro.
import { h, esc, nextId, setText, cssColor, DASH } from './dom.js';
import { numTrim } from '../lib/format.js';
import { createDataTable } from './data-table.js';

const SVGNS = 'http://www.w3.org/2000/svg';

/** Marcas «bonitas» entre min y max. */
export function niceTicks(min, max, count = 5) {
  if (!(max > min)) return { ticks: [min], step: 1 };
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { ticks, step };
}

const decFor = (step) => (step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step))));

/** Muestra de leyenda (HTML con un pequeño SVG decorativo). */
export function legendItem(item) {
  const color = cssColor(item.color);
  let mark;
  if (item.shape === 'bar') mark = `<rect x="10" y="0" width="5" height="12" style="fill:${color}"/>`;
  else if (item.shape === 'triangle') mark = `<polygon points="14,1 20,11 8,11" style="fill:${color}"/>`;
  else mark = `<line x1="0" y1="6" x2="28" y2="6" stroke-width="3" stroke-linecap="round" style="stroke:${color}" ${DASH[item.dash || 'solid'] ? `stroke-dasharray="${DASH[item.dash]}"` : ''}/>`;
  return h('li', { html: `<svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true" focusable="false">${mark}</svg>` }, item.label);
}

function drawSvg(spec, width) {
  const H = Math.round(Math.max(190, Math.min(spec.height || 300, width * 0.62)));
  const { x, y } = spec;
  const yt = niceTicks(y.min, y.max, H < 240 ? 4 : 5);
  const xt = niceTicks(x.min, x.max, width < 420 ? 4 : 6);
  const yFmt = y.fmt || ((v) => numTrim(v, decFor(yt.step)));
  const xFmt = x.fmt || ((v) => numTrim(v, decFor(xt.step)));
  const yLabels = yt.ticks.map(yFmt);
  const left = Math.min(90, 14 + Math.max(...yLabels.map((s) => s.length)) * 7);
  const m = { l: left, r: 16, t: 26, b: 42 };
  const pw = Math.max(10, width - m.l - m.r), ph = H - m.t - m.b;
  const sx = (v) => m.l + ((v - x.min) / (x.max - x.min || 1)) * pw;
  const sy = (v) => m.t + ph - ((v - y.min) / (y.max - y.min || 1)) * ph;
  const f = (v) => v.toFixed(1);
  const clipId = nextId('clip');
  const out = [];
  out.push(`<defs><clipPath id="${clipId}"><rect x="${m.l - 4}" y="${m.t - 4}" width="${pw + 8}" height="${ph + 8}"/></clipPath></defs>`);
  // rejilla y ejes
  out.push('<g aria-hidden="true">');
  yt.ticks.forEach((v, i) => {
    const yy = f(sy(v));
    out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${yy}" y2="${yy}" style="stroke:var(--line)" stroke-width="1"/>`);
    out.push(`<text x="${m.l - 8}" y="${yy}" text-anchor="end" dominant-baseline="middle">${esc(yLabels[i])}</text>`);
  });
  xt.ticks.forEach((v) => {
    const xx = f(sx(v));
    out.push(`<line x1="${xx}" x2="${xx}" y1="${m.t + ph}" y2="${m.t + ph + 5}" style="stroke:var(--line-strong)"/>`);
    out.push(`<text x="${xx}" y="${m.t + ph + 18}" text-anchor="middle">${esc(xFmt(v))}</text>`);
  });
  out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}" style="stroke:var(--line-strong)"/>`);
  out.push(`<line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${m.t + ph}" style="stroke:var(--line-strong)"/>`);
  if (x.label) out.push(`<text x="${m.l + pw}" y="${H - 4}" text-anchor="end">${esc(x.label)}</text>`);
  if (y.label) out.push(`<text x="${m.l}" y="12" text-anchor="start">${esc(y.label)}</text>`);
  out.push('</g>');

  const inX = (v) => v >= x.min - 1e-9 && v <= x.max + 1e-9;
  out.push(`<g clip-path="url(#${clipId})" aria-hidden="true">`);
  for (const vl of spec.vlines || []) {
    if (!inX(vl.x)) continue;
    const xx = f(sx(vl.x));
    out.push(`<line x1="${xx}" x2="${xx}" y1="${m.t}" y2="${m.t + ph}" stroke-width="${vl.width || 1.5}" style="stroke:${cssColor(vl.color || 'muted')}" ${DASH[vl.dash || 'solid'] ? `stroke-dasharray="${DASH[vl.dash]}"` : ''}/>`);
  }
  for (const hl of spec.hlines || []) {
    if (hl.y < y.min || hl.y > y.max) continue;
    const yy = f(sy(hl.y));
    out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${yy}" y2="${yy}" stroke-width="${hl.width || 2}" style="stroke:${cssColor(hl.color || 'muted')}" ${DASH[hl.dash || 'solid'] ? `stroke-dasharray="${DASH[hl.dash]}"` : ''}/>`);
  }
  for (const s of spec.series || []) {
    if (!s.points.length) continue;
    let d = '';
    s.points.forEach(([px, py], i) => {
      const X = f(sx(px)), Y = f(sy(py));
      if (i === 0) d += `M${X} ${Y}`;
      else if (s.step) d += `H${X}V${Y}`;
      else d += `L${X} ${Y}`;
    });
    const dash = DASH[s.dash || 'solid'];
    out.push(`<path d="${d}" fill="none" stroke-width="${s.width || 2.25}" stroke-linejoin="round" stroke-linecap="${dash === DASH.dotted ? 'round' : 'butt'}" style="stroke:${cssColor(s.color)}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`);
    if (s.dots) for (const [px, py] of s.points) out.push(`<circle cx="${f(sx(px))}" cy="${f(sy(py))}" r="3" style="fill:${cssColor(s.color)}"/>`);
  }
  out.push('</g><g aria-hidden="true">');
  for (const mk of spec.markers || []) {
    if (!inX(mk.x) || mk.y < y.min - 1e-9 || mk.y > y.max + 1e-9) continue;
    const X = sx(mk.x), Y = sy(mk.y), c = cssColor(mk.color || 'ink');
    if (mk.shape === 'bar') out.push(`<rect x="${f(X - 1.5)}" y="${f(m.t + ph - 12)}" width="3" height="12" style="fill:${c}"/>`);
    else if (mk.shape === 'triangle') out.push(`<polygon points="${f(X)},${f(Y - 13)} ${f(X + 6)},${f(Y - 3)} ${f(X - 6)},${f(Y - 3)}" style="fill:${c}"/>`);
    else if (mk.shape === 'diamond') out.push(`<polygon points="${f(X)},${f(Y - 7)} ${f(X + 7)},${f(Y)} ${f(X)},${f(Y + 7)} ${f(X - 7)},${f(Y)}" style="fill:${c};stroke:var(--surface)" stroke-width="2"/>`);
    else out.push(`<circle cx="${f(X)}" cy="${f(Y)}" r="6" style="fill:${c};stroke:var(--surface)" stroke-width="2"/>`);
    if (mk.label) {
      const right = X < m.l + pw - 90;
      out.push(`<text class="lbl" x="${f(right ? X + 10 : X - 10)}" y="${f(Y - 10)}" text-anchor="${right ? 'start' : 'end'}" style="fill:${c}">${esc(mk.label)}</text>`);
    }
  }
  for (const hl of spec.hlines || []) {
    if (!hl.label || hl.y < y.min || hl.y > y.max) continue;
    out.push(`<text class="lbl" x="${m.l + pw - 4}" y="${f(sy(hl.y) - 6)}" text-anchor="end" style="fill:${cssColor(hl.color || 'muted')}">${esc(hl.label)}</text>`);
  }
  for (const vl of spec.vlines || []) {
    if (!vl.label || !inX(vl.x)) continue;
    const X = sx(vl.x), right = X < m.l + pw - 80;
    out.push(`<text class="lbl" x="${f(right ? X + 6 : X - 6)}" y="${m.t + 12}" text-anchor="${right ? 'start' : 'end'}" style="fill:${cssColor(vl.color || 'muted')}">${esc(vl.label)}</text>`);
  }
  out.push('</g>');
  return { inner: out.join(''), H };
}

/** Tarjeta con gráfica de líneas + leyenda HTML + frase alternativa + tabla opcional. */
export function createChart(spec) {
  const hid = nextId('chart');
  const title = h('h3', { id: hid }, spec.title);
  const legend = h('ul', { class: 'legend', 'aria-label': 'Leyenda' });
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('focusable', 'false');
  const box = h('div', { class: 'chart-box' });
  box.append(svg);
  const alt = h('p', { class: 'chart-alt' });
  const el = h('section', { class: 'card chart-card', 'aria-labelledby': hid }, h('div', { class: 'card-head' }, title, legend), box, alt);
  let table = null, current = spec, legendKey = '', lastW = 0;

  function paint() {
    const w = Math.round(box.clientWidth) || 640;
    lastW = w;
    const { inner, H } = drawSvg(current, w);
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', H);
    svg.innerHTML = inner;
  }

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => { if (Math.abs((Math.round(box.clientWidth) || 0) - lastW) > 2) paint(); })
    : null;
  ro?.observe(box);

  function update(s) {
    current = s;
    setText(title, s.title);
    const lk = JSON.stringify(s.legend || []);
    if (lk !== legendKey) {
      legend.replaceChildren(...(s.legend || []).map(legendItem));
      legendKey = lk;
    }
    svg.setAttribute('aria-label', s.alt || s.title);
    setText(alt, s.alt || '');
    if (s.table) {
      if (!table) { table = createDataTable(s.table); el.append(table.el); }
      table.update(s.table);
    }
    paint();
  }
  update(spec);
  return { el, update, destroy: () => ro?.disconnect() };
}

/** Barras horizontales en HTML (amplificación, utilización). */
export function createBars(spec) {
  const hid = nextId('bars');
  const title = h('h3', { id: hid });
  const list = h('ul', { class: 'hbars' });
  const note = h('p', { class: 'card-note' });
  const alt = h('p', { class: 'sr-only' });
  const el = h('section', { class: 'card', 'aria-labelledby': hid }, title, list, note, alt);
  function update(s) {
    setText(title, s.title);
    list.replaceChildren(...s.items.map((it) => {
      const w = Number.isFinite(it.value) ? Math.max(0, Math.min(1, it.value / (it.max || 1))) * 100 : 0;
      return h('li', { class: 'hbar' + (it.strong ? ' strong' : '') },
        h('span', { class: 'hbar-label' }, it.label),
        h('span', { class: 'hbar-track', 'aria-hidden': 'true' },
          h('span', { class: 'hbar-fill', style: { width: w.toFixed(1) + '%', background: cssColor(it.color || 'accent') } })),
        h('span', { class: 'hbar-value' }, it.text));
    }));
    setText(note, s.note || '');
    note.hidden = !s.note;
    setText(alt, s.alt || '');
  }
  update(spec);
  return { el, update };
}
