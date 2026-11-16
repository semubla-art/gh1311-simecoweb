// Deslizador accesible: <label for>, <input type="range">, <output for> y línea de rango.
import { h, nextId, setText } from './dom.js';
import { num, decimalsOf } from '../lib/format.js';

export function formatParam(p, v) {
  if (p.format) return p.format(v);
  return num(v, decimalsOf(p.step)) + (p.unit ? ' ' + p.unit : '');
}

export function createSlider(p, value, onInput) {
  const id = nextId('p-' + p.key);
  const hintId = id + '-h';
  const dec = decimalsOf(p.step);
  const input = h('input', {
    type: 'range', id, name: p.key, min: p.min, max: p.max, step: p.step, value,
    'aria-describedby': hintId,
  });
  const output = h('output', { for: id, id: id + '-o' });
  const hint = h('p', { class: 'slider-hint', id: hintId },
    `Rango ${num(p.min, dec)}–${num(p.max, dec)}${p.unit && !p.format ? ' ' + p.unit : ''} · por defecto ${p.format ? p.format(p.default) : num(p.default, dec)}`);
  const el = h('div', { class: 'slider' },
    h('div', { class: 'slider-top' }, h('label', { for: id }, p.label), output), input, hint);

  const show = (v) => {
    const txt = formatParam(p, v);
    setText(output, txt);
    input.setAttribute('aria-valuetext', txt);
  };
  const read = () => Number(input.value);
  input.addEventListener('input', () => { show(read()); onInput(read()); });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    const dir = e.key === 'PageUp' ? 1 : -1;
    const v = Math.min(p.max, Math.max(p.min, read() + dir * 10 * p.step));
    input.value = String(Number(v.toFixed(dec)));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  show(value);
  return {
    el, input,
    set(v) { input.value = String(v); show(Number(input.value)); },
  };
}

export function createCheckbox(p, value, onChange) {
  const id = nextId('p-' + p.key);
  const input = h('input', { type: 'checkbox', id, name: p.key });
  input.checked = !!value;
  input.addEventListener('change', () => onChange(input.checked));
  const el = h('div', { class: 'slider' }, h('label', { class: 'check', for: id }, input, p.label));
  return { el, input, set(v) { input.checked = !!v; } };
}
