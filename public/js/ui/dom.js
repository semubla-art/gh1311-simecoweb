// Utilidades mínimas de DOM nativo.

/** Crea un elemento: h('div', { class: 'x', onclick: fn }, 'texto', otroNodo). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

let uid = 0;
export const nextId = (prefix = 'id') => `${prefix}-${++uid}`;

/** Asigna textContent solo si cambió (evita trabajo y anuncios innecesarios). */
export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export const cssColor = (name) => `var(--${name})`;
export const DASH = { solid: '', dashed: '8 6', dotted: '2 4' };
