// «Entender la simulación»: 4 tarjetas (acordeones en móvil).
import { h, nextId } from './dom.js';

function card(title, body, open) {
  const d = h('details', { class: 'explain-card' }, h('summary', {}, h('h3', {}, title)), h('div', { class: 'explain-body' }, body));
  d.open = open;
  return d;
}

export function createExplain(mod) {
  const { explain: ex, params } = mod;
  const open = !window.matchMedia('(max-width: 639.98px)').matches;
  const hid = nextId('explain');
  const paramItems = [
    ...params.map((p) => h('li', {}, h('strong', {}, p.label), ': ', p.meaning)),
    ...(mod.meta.stochastic && !(ex.paramsExtra || []).some((s) => s.startsWith('Semilla'))
      ? [h('li', {}, h('strong', {}, 'Semilla'), ': número (1–9 999) que fija la serie aleatoria; la misma semilla repite exactamente la corrida.')] : []),
    ...(ex.paramsExtra || []).map((s) => h('li', {}, s)),
  ];
  return h('section', { class: 'explain', 'aria-labelledby': hid },
    h('h2', { id: hid }, 'Entender la simulación'),
    h('div', { class: 'explain-grid' },
      card('Qué simula', [h('p', {}, ex.what), h('div', { class: 'formulas', 'aria-label': 'Fórmulas' }, ex.formulas.map((f) => h('code', {}, f)))], open),
      card('Qué significa cada parámetro', h('ul', {}, paramItems), open),
      card('Efectos que vas a observar', h('ul', {}, ex.effects.map((s) => h('li', {}, s))), open),
      card('Utilidad en los negocios', h('ul', {}, ex.business.map((s) => h('li', {}, s))), open)));
}
