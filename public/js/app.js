// SimulacionEcoWeb: router por hash y montaje de pantallas.
import { h } from './ui/dom.js';
import { mountSimPage } from './ui/sim-page.js';
import * as ofertaDemanda from './sims/oferta-demanda.js';
import * as interesCompuesto from './sims/interes-compuesto.js';
import * as eoq from './sims/eoq.js';
import * as puntoReorden from './sims/punto-reorden.js';
import * as revision from './sims/revision.js';
import * as bullwhip from './sims/bullwhip.js';
import * as beerGame from './sims/beer-game.js';
import * as colas from './sims/colas.js';

const APP = 'SimulacionEcoWeb';
const SIMS = [ofertaDemanda, interesCompuesto, eoq, puntoReorden, revision, bullwhip, beerGame, colas];
const ROUTES = new Map(SIMS.map((m) => [m.meta.id, m]));

const main = document.getElementById('main');
const navList = document.getElementById('nav-list');
const navSelect = document.getElementById('nav-select');
let current = null;

const tagClass = (cat) => 'tag tag-' + cat.split(' ')[0];

function buildNav() {
  navList.replaceChildren(...SIMS.map((m) => h('li', {}, h('a', { href: '#/' + m.meta.id, 'data-id': m.meta.id }, m.meta.short))));
  navSelect.replaceChildren(
    h('option', { value: '' }, 'Inicio · todas las simulaciones'),
    ...SIMS.map((m, i) => h('option', { value: m.meta.id }, `${String(i + 1).padStart(2, '0')} · ${m.meta.short}`)));
  navSelect.addEventListener('change', () => { location.hash = '#/' + navSelect.value; });
}

function markNav(id) {
  for (const a of navList.querySelectorAll('a')) {
    if (a.dataset.id === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  navSelect.value = id || '';
  navList.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function renderHome() {
  const h1 = h('h1', { tabindex: '-1' }, 'Mueve los parámetros y mira cómo responde el negocio.');
  const home = h('div', { class: 'home' },
    h('section', { class: 'hero', 'aria-labelledby': 'hero-h' },
      h('div', { class: 'hero-text' },
        h('p', { class: 'eyebrow' }, 'Laboratorio virtual de economía y operaciones'),
        Object.assign(h1, { id: 'hero-h' }),
        h('p', { class: 'hero-lead' }, 'Ocho simulaciones dinámicas de mercados, finanzas, inventarios, cadena de suministro y colas de servicio. Cada una explica qué modela, qué significa cada parámetro y para qué sirve en una empresa real.'),
        h('div', { class: 'hero-actions' },
          h('a', { class: 'btn btn-primary', href: '#/oferta-demanda' }, 'Empezar por oferta y demanda'),
          h('a', { class: 'btn', href: '#simulaciones', onclick: (e) => { e.preventDefault(); document.getElementById('simulaciones').scrollIntoView(); document.getElementById('sims-h').focus(); } }, 'Ver las 8 simulaciones')),
        h('p', { class: 'small-muted' }, 'Gratis, sin registro y sin instalar nada. Funciona en el móvil.')),
      h('figure', {
        class: 'hero-figure',
        html: `<figcaption>Vista previa · inventario en diente de sierra (EOQ)</figcaption>
<svg viewBox="0 0 400 200" role="img" aria-label="Inventario que baja en línea recta desde 245 unidades hasta cero y se repone de golpe, cinco veces al año.">
<line x1="30" y1="170" x2="390" y2="170" style="stroke:var(--line-strong)"/><line x1="30" y1="20" x2="30" y2="170" style="stroke:var(--line-strong)"/>
<polyline points="30,30 100,170 100,30 170,170 170,30 240,170 240,30 310,170 310,30 380,170" fill="none" style="stroke:var(--accent)" stroke-width="3" stroke-linejoin="round"/>
<line x1="30" y1="100" x2="390" y2="100" style="stroke:var(--accent-2)" stroke-width="2" stroke-dasharray="6 5"/>
<text x="388" y="92" text-anchor="end" font-size="12" style="fill:var(--accent-2)" font-family="Inter, system-ui, sans-serif">Inventario promedio Q*/2</text></svg>`,
      })),
    h('section', { id: 'simulaciones', class: 'home-section', 'aria-labelledby': 'sims-h' },
      h('div', { class: 'section-head' }, h('h2', { id: 'sims-h', tabindex: '-1' }, 'Simulaciones'), h('p', { class: 'small-muted' }, 'Ordenadas de lo más simple a lo más sistémico')),
      h('ul', { class: 'sim-cards' }, SIMS.map((m, i) => h('li', {},
        h('a', { class: 'sim-card', href: '#/' + m.meta.id },
          h('div', { class: 'sim-card-top' }, h('span', { class: 'sim-num' }, String(i + 1).padStart(2, '0')), h('span', { class: tagClass(m.meta.category) }, m.meta.category)),
          h('h3', {}, m.meta.title),
          h('p', {}, m.meta.card),
          h('span', { class: 'sim-card-cta', 'aria-hidden': 'true' }, 'Abrir simulación →')))))),
    h('section', { id: 'como', class: 'home-section', 'aria-labelledby': 'como-h' },
      h('div', { class: 'section-head' }, h('h2', { id: 'como-h' }, 'Cómo usarla')),
      h('ol', { class: 'steps' },
        [['Lee qué simula', 'Cada pantalla abre con el problema de negocio y el modelo que lo representa.'],
          ['Ajusta los parámetros', 'Los deslizadores muestran unidad, rango y valor por defecto. Los resultados se recalculan al instante.'],
          ['Corre, pausa y compara', 'Inicia la simulación en el tiempo, páusala para leer los indicadores y reiníciala con otra semilla.']]
          .map(([t, d], i) => h('li', {}, h('span', { class: 'step-num', 'aria-hidden': 'true' }, String(i + 1)), h('strong', {}, t), h('span', {}, d))))));
  main.replaceChildren(home);
  return { h1, title: 'Inicio', destroy() {} };
}

function route(initial = false) {
  const hash = location.hash || '#/';
  if (hash === '#simulaciones' || hash === '#como') return; // anclas internas del inicio
  const id = hash.replace(/^#\/?/, '');
  if (id && !ROUTES.has(id)) { location.replace('#/'); return; }
  current?.destroy();
  current = id ? mountSimPage(main, ROUTES.get(id)) : renderHome();
  document.title = `${APP} · ${current.title}`;
  markNav(id);
  if (!initial) {
    window.scrollTo(0, 0);
    current.h1.focus({ preventScroll: true });
  }
}

buildNav();
window.addEventListener('hashchange', () => route(false));
route(true);
