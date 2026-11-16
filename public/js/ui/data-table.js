// Tabla alternativa de una gráfica dentro de <details>. Solo se redibuja cuando está abierta.
import { h, esc, nextId } from './dom.js';

export function createDataTable(spec) {
  const id = nextId('tbl');
  const summary = h('summary', {}, spec.summary || 'Ver datos en tabla');
  const caption = h('caption');
  const thead = h('thead');
  const tbody = h('tbody');
  const scroll = h('div', { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-labelledby': id + '-cap' },
    h('table', { class: 'tbl' }, caption, thead, tbody));
  caption.id = id + '-cap';
  const el = h('details', { class: 'data-table' }, summary, scroll);
  let current = spec, dirty = true, headKey = '';

  function draw() {
    const s = current;
    caption.textContent = s.caption || '';
    const key = s.columns.join('|');
    if (key !== headKey) {
      thead.innerHTML = '<tr>' + s.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('') + '</tr>';
      headKey = key;
    }
    tbody.innerHTML = s.rows.length
      ? s.rows.map((r) => '<tr>' + r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('') + '</tr>').join('')
      : `<tr><td colspan="${s.columns.length}">Sin datos todavía: inicia la simulación.</td></tr>`;
    dirty = false;
  }

  el.addEventListener('toggle', () => { if (el.open && dirty) draw(); });

  return {
    el,
    update(spec2) {
      current = spec2;
      summary.textContent = spec2.summary || 'Ver datos en tabla';
      dirty = true;
      if (el.open) draw();
    },
  };
}
