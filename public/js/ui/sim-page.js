// Plantilla de pantalla de simulación: migas → h1 → intro → barra de control →
// [parámetros | resultados] → «Entender la simulación».
import { h, nextId } from './dom.js';
import { cleanSeed } from '../lib/rng.js';
import { Runner } from './runner.js';
import { createControls } from './controls.js';
import { createSlider, createCheckbox } from './slider.js';
import { createKpis } from './kpi.js';
import { createBlockList } from './blocks.js';
import { createExplain } from './explain.js';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountSimPage(root, mod) {
  const { meta, params } = mod;
  const p = Object.fromEntries(params.map((x) => [x.key, x.default]));
  let seed = meta.defaultSeed || 1;
  let mode = meta.modes ? meta.modes[0].value : undefined;
  let user = [];
  const compute = () => mod.simulate({ ...p, mode, user }, { seed });
  let result = compute();
  let frame = 0;

  const runner = new Runner({
    horizon: result.horizon, tickMs: meta.tickMs, speed: reducedMotion() ? 0 : 1,
    onChange: ({ stateChanged }) => (stateChanged ? renderNow() : schedule()),
  });

  const recompute = (now = false) => {
    result = compute();
    runner.setHorizon(result.horizon);
    if (now) renderNow(); else schedule();
  };

  const play = () => mode === 'jugar';

  const controls = createControls({
    meta, speed: runner.speed, seed, mode,
    onPrimary: () => runner.primary(),
    onStep: () => runner.step(),
    onReset: () => runner.reset(),
    onSpeed: (s) => runner.setSpeed(s),
    onSeed: (v) => {
      seed = cleanSeed(v, seed);
      controls.setSeed(seed);
      user = [];
      runner.reset();
      recompute(true);
    },
    onMode: (m) => { mode = m; user = []; runner.reset(); recompute(true); },
    onAction: (a) => {
      const patch = a.apply({ ...p }, result);
      for (const [k, v] of Object.entries(patch)) { p[k] = v; inputs[k]?.set(v); }
      recompute(true);
    },
  });

  // Parámetros
  const inputs = {};
  const paramsHid = nextId('params');
  const list = h('div', { class: 'params-list' });
  for (const prm of params) {
    const onValue = (v) => {
      p[prm.key] = v;
      if (prm.resetOnChange) runner.reset();
      recompute();
    };
    const c = prm.type === 'checkbox' ? createCheckbox(prm, p[prm.key], onValue) : createSlider(prm, p[prm.key], onValue);
    inputs[prm.key] = c;
    list.append(c.el);
  }
  const paramsSection = params.length
    ? h('section', { class: 'panel params', 'aria-labelledby': paramsHid },
      h('details', { class: 'params-details', open: true }, h('summary', {}, h('h2', { id: paramsHid }, 'Parámetros')), list))
    : null;

  // Resultados
  const resultsHid = nextId('results');
  const kpis = createKpis();
  const blocks = createBlockList({
    onSubmit: (order) => {
      if (runner.t >= result.horizon) return;
      user = user.slice(0, runner.t);
      user[runner.t] = order;
      result = compute();
      runner.step();
      renderNow();
      requestAnimationFrame(() => blocks.get('turn:turno')?.focus?.());
    },
  });
  const results = h('section', { class: 'results', 'aria-labelledby': resultsHid },
    h('h2', { id: resultsHid, class: 'sr-only' }, 'Resultados'), kpis.el, blocks.el);

  const h1 = h('h1', { tabindex: '-1' }, meta.title);
  const page = h('article', { class: 'sim-page' },
    h('div', { class: 'sim-head' },
      h('nav', { class: 'crumbs', 'aria-label': 'Ruta de navegación' },
        h('ol', {}, h('li', {}, h('a', { href: '#/' }, 'Inicio')), h('li', {}, meta.category))),
      h1,
      h('p', { class: 'lead' }, meta.intro)),
    controls.el,
    h('div', { class: 'sim-layout' },
      h('div', { class: 'sim-grid' + (paramsSection ? '' : ' results-only') }, paramsSection, results)),
    createExplain(mod));
  root.replaceChildren(page);

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(render);
  }

  function renderNow() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    render();
  }

  function render() {
    frame = 0;
    const t = runner.t;
    const s = mod.summarize(result, t);
    kpis.update(s.kpis);
    blocks.update(s.blocks);
    let state = runner.state;
    if (play() && state !== 'done' && t > 0) state = 'waiting';
    controls.update({
      state,
      clockText: meta.clock(t, result),
      primaryLabel: runner.primaryLabel,
      canReset: runner.state !== 'reset' || t > 0,
      play: play(),
    });
  }
  render();

  return {
    h1,
    title: meta.short,
    destroy() {
      runner.destroy();
      if (frame) cancelAnimationFrame(frame);
      blocks.destroy();
    },
  };
}
