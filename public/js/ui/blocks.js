// Bloques de resultados devueltos por summarize(): cada tipo sabe crearse y actualizarse.
import { h, nextId, setText, cssColor } from './dom.js';
import { createChart, createBars } from './chart.js';
import { createDataTable } from './data-table.js';

function compare(spec) {
  const capId = nextId('cmp');
  const caption = h('caption', { id: capId });
  const thead = h('thead');
  const tbody = h('tbody');
  const el = h('div', { class: 'card compare' },
    h('div', { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-labelledby': capId }, h('table', { class: 'tbl' }, caption, thead, tbody)));
  function update(s) {
    setText(caption, s.caption);
    thead.replaceChildren(h('tr', {}, s.columns.map((c) => h('th', { scope: 'col' }, c))));
    tbody.replaceChildren(...s.rows.map((r) => h('tr', {},
      h('th', { scope: 'row' }, r.label),
      r.cells.map((c, i) => h('td', { class: r.best === i ? 'best' : null }, c, r.best === i ? h('span', { class: 'sr-only' }, ' (mejor)') : null)))));
  }
  update(spec);
  return { el, update };
}

function alertBlock(spec) {
  const el = h('div', { class: 'alert', role: 'alert' }, spec.text);
  return { el, update: (s) => setText(el, s.text) };
}

function note(spec) {
  const el = h('p', { class: 'note-box' }, spec.text);
  return { el, update: (s) => setText(el, s.text) };
}

function table(spec) {
  const t = createDataTable(spec);
  return { el: t.el, update: t.update };
}

function roles(spec) {
  const el = h('div', { class: 'roles', role: 'list', 'aria-label': 'Estado de cada rol' });
  function update(s) {
    el.replaceChildren(...s.roles.map((r) => h('section', { class: 'card role', role: 'listitem', style: { '--rc': cssColor(r.color) } },
      h('div', { class: 'role-head' }, h('h3', {}, r.name), h('span', { class: 'role-who' }, r.who)),
      h('dl', {}, r.rows.map((x) => [h('dt', {}, x.label), h('dd', { class: x.danger ? 'danger' : null }, x.value)])))));
  }
  update(spec);
  return { el, update };
}

function counter(spec) {
  const hid = nextId('ctr');
  const title = h('h3', { id: hid }, spec.title);
  const servers = h('div', { class: 'servers', 'aria-hidden': 'true' });
  const queue = h('div', { class: 'queue', 'aria-hidden': 'true' });
  const text = h('p', { class: 'chart-alt' });
  const el = h('section', { class: 'card', 'aria-labelledby': hid }, title,
    h('div', { class: 'counter-view' }, servers, h('div', {}, h('div', { class: 'queue-label' }, 'Fila'), queue)), text);
  function update(s) {
    servers.replaceChildren(...s.servers.map((b, i) => h('div', { class: 'server' + (b ? ' busy' : '') }, `S${i + 1}`, h('br'), b ? 'ocupado' : 'libre')));
    const shown = Math.min(s.queue, 24);
    queue.replaceChildren(...[...Array.from({ length: shown }, () => h('span', { class: 'queue-dot' })),
      s.queue > shown && h('span', { class: 'queue-more' }, `+${s.queue - shown}`),
      s.queue === 0 && h('span', { class: 'queue-label' }, 'vacía')].filter(Boolean));
    setText(text, s.text);
  }
  update(spec);
  return { el, update };
}

/** Panel «Tu turno» del Beer Game (modo jugar). ctx.onSubmit(pedido). */
function turn(spec, ctx) {
  const hid = nextId('turn');
  const inputId = nextId('order');
  const title = h('h2', { id: hid, style: { fontSize: '20px' } });
  const info = h('div', { class: 'turn-info' });
  const input = h('input', { id: inputId, type: 'number', min: 0, max: 99, step: 1, value: 4, inputmode: 'numeric' });
  const clamp = () => { const v = Math.max(0, Math.min(99, Math.round(Number(input.value) || 0))); input.value = String(v); return v; };
  const dec = h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Pedir una caja menos', onclick: () => { input.value = String(Math.max(0, clamp() - 1)); } }, '−');
  const inc = h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Pedir una caja más', onclick: () => { input.value = String(Math.min(99, clamp() + 1)); } }, '+');
  const send = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Enviar pedido');
  const form = h('form', { class: 'turn-form', onsubmit: (e) => { e.preventDefault(); ctx.onSubmit(clamp()); } },
    h('div', { class: 'stepper' }, h('label', { for: inputId }, 'Tu pedido al mayorista (cajas)'), h('div', { class: 'stepper-row' }, dec, input, inc)), send);
  const doneMsg = h('p', {}, 'Terminaste las 36 semanas. Revisa el costo de la cadena y la amplificación; pulsa «Reiniciar» para jugar de nuevo.');
  const el = h('section', { class: 'card turn', 'aria-labelledby': hid }, title, info, form, doneMsg);
  function update(s) {
    setText(title, s.done ? 'Partida terminada' : `Tu turno · semana ${s.week}`);
    info.replaceChildren(
      ...(s.done ? [] : [h('span', {}, 'El cliente pide ', h('strong', {}, String(s.demand)), ' cajas')]),
      h('span', {}, 'Inventario: ', h('strong', {}, String(s.inv))),
      h('span', {}, 'Pendiente: ', h('strong', { style: { color: s.back > 0 ? 'var(--danger)' : '' } }, String(s.back))),
      h('span', {}, 'En camino: ', h('strong', {}, String(s.sl))));
    form.hidden = s.done;
    doneMsg.hidden = !s.done;
  }
  update(spec);
  return { el, update, focus: () => input.focus() };
}

const FACTORIES = {
  chart: (s) => createChart(s), bars: (s) => createBars(s), compare, alert: alertBlock, note, table, roles, counter, turn,
};

/** Reconciliador por id: conserva los nodos (y el estado abierto de los <details>) entre periodos. */
export function createBlockList(ctx) {
  const el = h('div', { class: 'results-blocks' });
  const live = new Map();
  return {
    el,
    get: (id) => live.get(id),
    update(blocks) {
      const seen = new Set();
      let prev = null;
      for (const b of blocks) {
        const key = b.type + ':' + b.id;
        seen.add(key);
        let item = live.get(key);
        if (!item) {
          item = FACTORIES[b.type](b, ctx);
          live.set(key, item);
        } else {
          item.update(b);
        }
        const expectedNext = prev ? prev.nextSibling : el.firstChild;
        if (expectedNext !== item.el) el.insertBefore(item.el, expectedNext);
        prev = item.el;
      }
      for (const [key, item] of live) {
        if (!seen.has(key)) { item.destroy?.(); item.el.remove(); live.delete(key); }
      }
    },
    destroy() { for (const item of live.values()) item.destroy?.(); },
  };
}
