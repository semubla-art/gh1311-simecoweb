# SimulacionEcoWeb

Aplicación web gratuita y responsiva con **8 simulaciones dinámicas** de economía y operaciones:

| # | Ruta | Simulación |
|---|---|---|
| 01 | `#/oferta-demanda` | Oferta y demanda (equilibrio, impuesto, ajuste walrasiano) |
| 02 | `#/interes-compuesto` | Interés compuesto y decisiones financieras |
| 03 | `#/eoq` | Cantidad económica de pedido (EOQ) |
| 04 | `#/punto-reorden` | Punto de reorden con demanda variable |
| 05 | `#/revision` | Revisión continua (Q, R) vs. periódica (T, S) |
| 06 | `#/bullwhip` | Efecto látigo |
| 07 | `#/beer-game` | Beer Game simplificado (automático o jugando como minorista) |
| 08 | `#/colas` | Teoría de colas M/M/c y cuellos de botella |

Hecha con HTML, CSS y JavaScript (módulos ES) **sin compilación, sin frameworks y sin dependencias**.
La especificación completa está en [`README-handoff.md`](README-handoff.md).

## Estructura

- `public/` — lo único que se publica (`index.html`, `css/`, `js/`).
  - `js/sims/*.js` — modelos puros (`meta`, `params`, `simulate`, `summarize`, `explain`).
  - `js/ui/*.js` — plantilla de pantalla, controles, deslizadores, gráficas SVG y tablas.
  - `js/lib/*.js` — generador con semilla (mulberry32 + Box–Muller), estadística y formato `es-MX`.
- `tests/` — casos T1–T26 del handoff.
- `design/` — mockups y modelo de referencia (no se despliega).

## Ejecutar en local

Cualquier servidor estático sirve; por ejemplo:

```bash
npx serve public
```

## Pruebas

```bash
node --test tests/
```

También se pueden ver en el navegador sirviendo la raíz del repositorio y abriendo `/tests/`.

## Despliegue (Cloudflare Workers, plan gratuito)

Worker de solo assets estáticos (`wrangler.jsonc` → `./public`). Con Workers Builds: comando de build vacío y
comando de despliegue `npx wrangler deploy`. Manualmente:

```bash
npx wrangler deploy
```
