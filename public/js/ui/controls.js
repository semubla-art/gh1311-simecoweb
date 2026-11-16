// Barra de control: insignia de estado, reloj, Iniciar/Pausar, Paso, Reiniciar, velocidad, semilla y modo.
import { h, nextId, setText } from './dom.js';

const STATE_LABEL = { reset: 'Reiniciada', running: 'En curso', paused: 'En pausa', done: 'Terminada', waiting: 'Esperando tu pedido' };

export function createControls({ meta, speed, seed, mode, onPrimary, onStep, onReset, onSpeed, onSeed, onMode, onAction }) {
  const badge = h('span', { class: 'badge', role: 'status', 'aria-live': 'polite', 'data-state': 'reset' }, STATE_LABEL.reset);
  const clock = h('span', { class: 'clock' });
  const primary = h('button', { type: 'button', class: 'btn btn-primary', onclick: onPrimary }, 'Iniciar');
  const step = h('button', { type: 'button', class: 'btn', onclick: onStep }, meta.stepLabel || 'Paso +1');
  const reset = h('button', { type: 'button', class: 'btn', onclick: onReset }, 'Reiniciar');
  const extra = h('div', { class: 'toolbar-extra' });

  const speedId = nextId('speed');
  const speedSel = h('select', { id: speedId, onchange: (e) => onSpeed(Number(e.target.value)) },
    [[0, 'Paso a paso'], [1, '1×'], [2, '2×'], [4, '4×']].map(([v, l]) => h('option', { value: v, selected: v === speed }, l)));
  const speedField = h('span', { class: 'field-inline' }, h('label', { for: speedId }, 'Velocidad'), speedSel);
  extra.append(speedField);

  let seedInput = null;
  if (meta.stochastic) {
    const sid = nextId('seed');
    seedInput = h('input', { id: sid, type: 'number', min: 1, max: 9999, step: 1, value: seed, inputmode: 'numeric' });
    seedInput.addEventListener('change', () => onSeed(seedInput.value));
    extra.append(h('span', { class: 'field-inline' }, h('label', { for: sid }, 'Semilla'), seedInput));
  }

  let modeGroup = null;
  if (meta.modes) {
    const name = nextId('mode');
    modeGroup = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Modo de juego' },
      meta.modes.map((m) => {
        const input = h('input', { type: 'radio', name, value: m.value, checked: m.value === mode });
        input.addEventListener('change', () => { if (input.checked) onMode(m.value); });
        return h('label', {}, input, m.label);
      }));
    extra.prepend(modeGroup);
  }

  for (const a of meta.actions || []) {
    extra.append(h('button', { type: 'button', class: 'btn', onclick: () => onAction(a) }, a.label));
  }

  const el = h('div', { class: 'toolbar', role: 'group', 'aria-label': 'Control de la simulación' },
    h('div', { class: 'toolbar-status' }, badge, clock),
    h('div', { class: 'toolbar-buttons' }, primary, step, reset),
    extra);

  return {
    el,
    update({ state, label, clockText, primaryLabel, canReset, play }) {
      if (badge.dataset.state !== state) badge.dataset.state = state;
      setText(badge, label || STATE_LABEL[state]);
      setText(clock, clockText);
      setText(primary, primaryLabel);
      reset.disabled = !canReset;
      primary.hidden = !!play;
      step.hidden = !!play;
      speedField.hidden = !!play;
    },
    setSeed(v) { if (seedInput) seedInput.value = v; },
  };
}
