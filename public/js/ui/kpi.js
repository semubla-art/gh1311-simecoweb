// Tarjetas de indicadores (KPI).
import { h, setText } from './dom.js';

export function createKpis() {
  const el = h('div', { class: 'kpis', role: 'list', 'aria-label': 'Indicadores' });
  const items = [];
  return {
    el,
    update(list) {
      while (items.length < list.length) {
        const label = h('p', { class: 'kpi-label' });
        const value = h('p', { class: 'kpi-value' });
        const note = h('p', { class: 'kpi-note' });
        const card = h('div', { class: 'kpi', role: 'listitem' }, label, value, note);
        el.append(card);
        items.push({ card, label, value, note });
      }
      while (items.length > list.length) items.pop().card.remove();
      list.forEach((k, i) => {
        const it = items[i];
        setText(it.label, k.label);
        setText(it.value, k.value);
        setText(it.note, k.note || '');
        if (k.tone) it.card.dataset.tone = k.tone; else delete it.card.dataset.tone;
      });
    },
  };
}
