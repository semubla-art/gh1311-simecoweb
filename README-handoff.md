# SimEco Web: handoff de diseño a implementación

Aplicación web gratuita y responsiva con 8 simulaciones dinámicas de conceptos económicos y de operaciones. Este documento es el contrato entre el diseño (mockups en Claude Design) y la implementación (Claude Code Web). Si algo de aquí contradice un mockup, **manda este documento**.

- Mockups interactivos: lienzo «SimEco Web» en Claude Design (11 mesas de trabajo). Hay copia de cada pantalla en `design/mockups/*.dc.html` (formato de Claude Design; sirven de referencia visual y de lógica, **no** se copian tal cual a producción).
- Implementación de referencia de los modelos estocásticos: `design/reference/sim-reference.mjs`. Las cifras de prueba de la sección 4 salen de ese archivo.

---

## 1. Restricciones del stack

| Capa | Tecnología | Versión | Motivo |
|---|---|---|---|
| Estructura / UI | HTML5 semántico | Estándar vivo | Es lo que genera Claude Design; no requiere compilación. |
| Estilos | CSS nativo (variables CSS, nesting, container queries, `clamp()`) | CSS actual (navegadores modernos) | Diseño responsivo sin Tailwind (que en producción sí requiere compilar). Los tokens de Claude Design pasan directo a variables CSS. |
| Lógica de simulación | JavaScript ES2022 con módulos ES (`<script type="module">`) | ES2022 | Cada simulación es un módulo puro (entradas → salidas), fácil de probar. El navegador lo ejecuta sin bundler. |
| Runtime de despliegue | Node.js (solo en el entorno de build de Cloudflare) | 24 LTS (archivo `.node-version`) | Solo lo usa `npx wrangler deploy` para subir archivos. No compila nada de la app. |

Reglas obligatorias:

1. **Sin compilación.** Nada de bundlers, transpiladores, TypeScript, Sass, PostCSS ni Tailwind. Lo que está en `public/` es exactamente lo que se sirve.
2. **Sin frameworks SPA.** Nada de React, Vue, Svelte, Angular, Lit, Alpine ni htmx. DOM nativo con `document.createElement`, `<template>` y delegación de eventos.
3. **Sin dependencias en tiempo de ejecución.** Las gráficas son SVG generado a mano (`js/ui/chart.js`). Sin CDN de scripts. Las fuentes (Inter y Space Grotesk) se cargan desde Google Fonts con `display=swap`, y la pila de respaldo es `system-ui`.
4. **Rutas por hash.** `#/`, `#/oferta-demanda`, `#/interes-compuesto`, `#/eoq`, `#/punto-reorden`, `#/revision`, `#/bullwhip`, `#/beer-game`, `#/colas`. Una ruta desconocida redirige a `#/`. El servidor solo sirve `index.html` y archivos estáticos.
5. **Módulos puros.** `js/sims/*.js` no tocan el DOM, no usan `Math.random()` y no leen el reloj. Toda aleatoriedad pasa por `js/lib/rng.js` con semilla.
6. Navegadores objetivo: las dos últimas versiones de Chrome, Edge, Firefox y Safari (incluido iOS Safari).

### Estructura de archivos

```
/
├─ .node-version            # contenido: 24
├─ wrangler.jsonc
├─ README-handoff.md
├─ design/                  # referencia, NO se despliega
│  ├─ mockups/*.dc.html
│  └─ reference/sim-reference.mjs
├─ tests/
│  ├─ sims.test.mjs         # node --test tests/   (solo local/CI)
│  └─ index.html            # mismo set de pruebas ejecutable en el navegador
└─ public/                  # ← único directorio que se sube
   ├─ index.html
   ├─ css/
   │  ├─ tokens.css         # variables (sección 5)
   │  ├─ base.css           # reset, tipografía, foco
   │  └─ components.css     # tarjetas, slider, toolbar, KPI, tabla, acordeón
   └─ js/
      ├─ app.js             # router por hash + montaje de pantallas
      ├─ lib/
      │  ├─ rng.js          # mulberry32 + normal (Box–Muller)
      │  ├─ stats.js        # mean, variance (muestral n−1), zFromServiceLevel
      │  └─ format.js       # Intl.NumberFormat('es-MX')
      ├─ ui/
      │  ├─ sim-page.js     # plantilla de pantalla de simulación
      │  ├─ controls.js     # barra Iniciar/Pausar/Paso/Reiniciar + semilla + velocidad
      │  ├─ runner.js       # reloj de simulación (estados de la sección 5)
      │  ├─ slider.js       # deslizador con label, output, rango y valor por defecto
      │  ├─ kpi.js          # tarjeta de indicador
      │  ├─ chart.js        # líneas, barras horizontales, marcadores (SVG)
      │  ├─ data-table.js   # tabla alternativa de la gráfica (<details>)
      │  └─ explain.js      # 4 tarjetas: Qué simula / Parámetros / Efectos / Utilidad
      └─ sims/
         ├─ oferta-demanda.js
         ├─ interes-compuesto.js
         ├─ eoq.js
         ├─ punto-reorden.js
         ├─ revision.js
         ├─ bullwhip.js
         ├─ beer-game.js
         └─ colas.js
```

### Interfaz común de cada módulo `js/sims/*.js`

```js
export const meta = { id: 'eoq', title: 'Cantidad económica de pedido (EOQ)', category: 'Inventarios',
                      horizon: 73, stepLabel: '+5 días', stochastic: false };
export const params = [ { key: 'D', label: 'Demanda anual (D)', min: 100, max: 10000, step: 100,
                          default: 1200, unit: 'u/año', meaning: '…' }, /* … */ ];
export function simulate(p, { seed } = {}) { /* puro: devuelve la trayectoria completa del horizonte */ }
export function summarize(result, t) { /* puro: KPIs y texto alternativo al periodo t */ }
export const explain = { what: '…', formulas: ['…'], effects: ['…'], business: ['…'] };
```

`simulate` calcula todo el horizonte una vez por cambio de parámetros. El `runner` solo mueve el índice `t` que se muestra. Así, pausar o retroceder no recalcula nada y las pruebas no dependen del tiempo real.

---

## 2. Mapa de pantallas → módulos

| Ruta | Mockup | Módulo | Componentes visuales |
|---|---|---|---|
| `#/` | `Main.dc.html` | `app.js` (sin sim) | cabecera, héroe, rejilla de 8 tarjetas enlazadas, «Cómo usarla», pie |
| `#/oferta-demanda` | `Oferta-demanda.dc.html` | `sims/oferta-demanda.js` | controls, slider ×7, kpi ×5, chart (líneas P–Q + punto de equilibrio + línea de precio actual), chart (trayectoria del precio), data-table, explain |
| `#/interes-compuesto` | `Interes-compuesto.dc.html` | `sims/interes-compuesto.js` | controls (sin semilla), slider ×7, kpi ×5, chart (4 líneas + cursor de año), data-table, explain |
| `#/eoq` | `EOQ.dc.html` | `sims/eoq.js` | controls + botón «Usar Q*», slider ×6, kpi ×5, chart (3 curvas de costo + marcadores Q* y Q), chart (diente de sierra doble), data-table, explain |
| `#/punto-reorden` | `Punto-reorden.dc.html` | `sims/punto-reorden.js` | controls + semilla, slider ×5, kpi ×6, chart (inventario + líneas ROP/SS + marcas de faltante y pedido), data-table, explain |
| `#/revision` | `Revision.dc.html` | `sims/revision.js` | controls + semilla, slider ×6, tabla comparativa (negrita = mejor), chart (2 líneas + días de revisión), explain |
| `#/bullwhip` | `Bullwhip.dc.html` | `sims/bullwhip.js` | controls + semilla, slider ×4, checkbox «devoluciones», barras horizontales de amplificación ×5, chart (5 líneas), explain |
| `#/beer-game` | `Beer-game.dc.html` | `sims/beer-game.js` | controls + semilla + selector de modo (radiogroup), panel «Tu turno» (stepper numérico), 4 tarjetas de rol, kpi ×4, chart (5 líneas), data-table, explain |
| `#/colas` | `Colas.dc.html` | `sims/colas.js` | controls + semilla, slider ×5, alerta de inestabilidad, tabla teoría vs. simulado, vista «mostrador ahora» (fila + servidores), chart (clientes en sistema + L teórico), barras de utilización por estación, explain |
| (todas, móvil) | `Movil.dc.html` | `ui/sim-page.js` | orden móvil: control → KPIs → gráfica → parámetros (acordeón abierto) → explicación (acordeones) |
| — | `Sistema.dc.html` | `css/tokens.css` | tokens, breakpoints y estados |

Anatomía de toda pantalla de simulación (`ui/sim-page.js`), de arriba abajo: migas → `h1` → párrafo introductorio → barra de control → [panel de parámetros | resultados (KPIs, gráficas, tabla)] → «Entender la simulación» (4 tarjetas).

---

## 3. Contrato de cada simulación

Convenciones: todos los rangos son inclusivos. «Semilla» es un entero de 1 a 9999. El generador es **mulberry32** y la normal estándar es **Box–Muller** con `u1 = max(rng(), 1e-12)`, `z = sqrt(−2 ln u1) · cos(2π u2)` (consume 2 números por normal). La varianza es muestral (n − 1). `z(nivel)` usa Abramowitz–Stegun 26.2.23: `t = √(−2 ln(1−p))`, `z = t − (2.515517 + 0.802853t + 0.010328t²)/(1 + 1.432788t + 0.189269t² + 0.001308t³)`.

### 3.1 Oferta y demanda (`oferta-demanda.js`)

| Parámetro | Clave | Rango | Paso | Defecto | Unidad |
|---|---|---|---|---|---|
| Demanda máxima | `a` | 50–200 | 1 | 120 | u |
| Sensibilidad de la demanda | `b` | 0.5–5 | 0.1 | 2 | u por $ |
| Oferta base | `c` | 0–80 | 1 | 20 | u |
| Sensibilidad de la oferta | `d` | 0.5–5 | 0.1 | 1.5 | u por $ |
| Impuesto por unidad | `tax` | 0–20 | 0.5 | 0 | $/u |
| Velocidad de ajuste | `k` | 0.05–1.9 | 0.05 | 0.3 | — |
| Precio inicial | `p0` | 0–80 | 1 | 50 | $ |

Modelo (horizonte 30 periodos):
- `Qd(P) = max(0, a − b·P)`, `Qs(P) = max(0, c + d·(P − tax))`
- `P* = (a − c + d·tax)/(b + d)`, `Q* = a − b·P*`, precio recibido por el vendedor `Ps = P* − tax`
- Dinámica: `P(t+1) = max(0, P(t) + k·(Qd − Qs)/(b + d))` (el error se multiplica por (1 − k) en cada periodo)
- Excedente del consumidor `EC = ½·Q*·(a/b − P*)`; excedente del productor `EP = Q*·Ps − (Q* − c)²/(2d)` si `Q* > c`
- Recaudación `tax·Q*`; pérdida irrecuperable `½·tax·(Q*₀ − Q*)`, con `Q*₀` = equilibrio sin impuesto

Salidas → gráficas: curvas de demanda, oferta y oferta con impuesto + punto (Q*, P*) + línea horizontal del precio en t → «Curvas»; `P(0..t)` y línea de `P*` → «Trayectoria»; KPIs: P*, Q*, P(t), EC + EP, recaudación y pérdida irrecuperable.

### 3.2 Interés compuesto y decisiones financieras (`interes-compuesto.js`)

| Parámetro | Clave | Rango | Paso | Defecto | Unidad |
|---|---|---|---|---|---|
| Capital inicial C₀ | `c0` | 0–100 000 | 500 | 10 000 | $ |
| Aporte mensual A | `ap` | 0–2 000 | 50 | 200 | $/mes |
| Tasa alternativa A | `ra` | 0–20 | 0.25 | 8 | % anual nominal |
| Tasa alternativa B | `rb` | 0–20 | 0.25 | 5 | % anual nominal |
| Capitalización n | `nIdx` | 0–4 → [1, 2, 4, 12, 365] | 1 | 3 (mensual) | veces/año |
| Plazo t | `yrs` | 1–40 | 1 | 20 | años (= horizonte) |
| Inflación π | `inf` | 0–12 | 0.25 | 4 | % anual |

Modelo (aportes vencidos, al final de cada mes):
- `i = (1 + r/n)^(n/12) − 1` (tasa mensual equivalente)
- `VF(y) = C₀·(1 + r/n)^(n·y) + A·[(1 + i)^(12y) − 1]/i` (si `i = 0`: `C₀ + A·12y`)
- `Aportado(y) = C₀ + 12·A·y`; `Real(y) = VF_A(y)/(1 + π)^y`
- `TEA = (1 + r/n)^n − 1`; años para duplicar `= ln 2 / ln(1 + TEA)`

Salidas → gráfica de líneas (VF_A, VF_B, Real_A, Aportado) con cursor en el año t; KPIs: saldo A, saldo B, ventaja A − B, A en pesos de hoy, TEA A + años para duplicar; tabla por año.

### 3.3 Cantidad económica de pedido (`eoq.js`)

| Parámetro | Clave | Rango | Paso | Defecto | Unidad |
|---|---|---|---|---|---|
| Demanda anual | `D` | 100–10 000 | 100 | 1 200 | u/año |
| Costo por pedido | `S` | 5–500 | 5 | 50 | $/pedido |
| Costo de mantener | `H` | 0.5–20 | 0.5 | 2 | $/u·año |
| Costo unitario | `c` | 1–100 | 1 | 10 | $/u |
| Tiempo de entrega | `L` | 0–30 | 1 | 5 | días |
| Tu tamaño de pedido | `Q` | 20–1 500 | 5 | 400 | u |

Modelo: `Q* = √(2DS/H)`; `CT(Q) = D·S/Q + H·Q/2` (la gráfica excluye `D·c`, que es constante; se informa aparte); pedidos/año `= D/Q*`; ciclo `= 365·Q*/D` días; `ROP = (D/365)·L`; penalización `= CT(Q)/CT(Q*) − 1`. Horizonte animado: 365 días en pasos de 5 (73 pasos). Diente de sierra: el inventario arranca en Q, baja a razón `D/365` por día y se repone a Q al llegar a 0.

Salidas → curvas de costo de pedir, mantener y total vs. Q, con marcadores en Q* y en Q; diente de sierra con Q* y con Q hasta el día t; tabla de costos para Q*·{0.5, 0.75, 1, 1.25, 1.5, 2}. El botón «Usar Q*» fija `Q = round(Q*/5)·5`.

### 3.4 Punto de reorden con demanda variable (`punto-reorden.js`)

| Parámetro | Clave | Rango | Paso | Defecto | Unidad |
|---|---|---|---|---|---|
| Demanda diaria promedio d̄ | `dbar` | 5–100 | 1 | 20 | u/día |
| Variabilidad σ | `sd` | 0–20 | 0.5 | 5 | u/día |
| Tiempo de entrega L | `L` | 1–30 | 1 | 7 | días |
| Nivel de servicio | `sl` | 80–99.9 | 0.1 | 95 | % |
| Tamaño de pedido Q | `Q` | 50–1 000 | 10 | 300 | u |
| Semilla | `seed` | 1–9 999 | 1 | 11 | — |

Modelo (horizonte 180 días, ventas perdidas):
- `z = z(sl/100)`, `SS = z·σ·√L`, `ROP = d̄·L + SS`
- Inventario inicial `I₀ = SS + Q`. Para cada día d = 1..180: (1) llegan los pedidos con `at = d`; (2) demanda `D_d = max(0, round(d̄ + σ·N(0,1)))`; (3) se vende `min(I, D_d)` y lo no surtido se pierde; (4) posición = I + en tránsito; si posición ≤ ROP se pide Q con `at = d + L`.
- KPIs a t: z, SS, ROP, tasa de surtido = vendido/demandado, días con faltante, inventario promedio y pedidos emitidos.

Salidas → línea de inventario día a día, líneas horizontales de ROP y SS, marcas de faltante (rectángulos sobre el eje) y triángulos de pedido; tabla con los últimos 60 días.

### 3.5 Sistemas de revisión: continua vs. periódica (`revision.js`)

Parámetros: `dbar`, `sd`, `L`, `sl`, `Q` y `seed` con los mismos rangos y valores por defecto que 3.4, más `T` (periodo de revisión: 1–60 días, paso 1, defecto 14). Costos fijos: S = $50/pedido, H = $2/u·año y p = $5 por unidad no surtida.

Modelo (horizonte 365 días; **ambas políticas usan la misma serie de demanda**, generada primero con 365 normales):
- `R = d̄·L + z·σ·√L`; `S = d̄·(T + L) + z·σ·√(T + L)`
- Ambas arrancan con `I₀ = R + Q/2`. Para cada día d = 0..364: llegan los pedidos con `at = d`; se surte y se pierde lo no surtido; se acumula el inventario final del día.
  - Continua: si posición ≤ R, pedir Q.
  - Periódica: si `d % T === 0`, pedir `max(0, round(S − posición))` (solo si > 0).
- Costo acumulado = `50·pedidos + 2·inventarioPromedio·(días/365) + 5·unidadesNoSurtidas`.

Salidas → tabla comparativa (R/S, inventario promedio, pedidos, días con faltante, tasa de surtido, costo; en negrita la mejor de cada fila) y gráfica con dos líneas + guías verticales en los días de revisión.

### 3.6 Efecto látigo (`bullwhip.js`)

| Parámetro | Clave | Rango | Paso | Defecto | Unidad |
|---|---|---|---|---|---|
| Demanda media μ | `mu` | 50–200 | 5 | 100 | u/semana |
| Variabilidad σ | `sd` | 0–40 | 1 | 20 | u/semana |
| Tiempo de entrega L | `L` | 0–8 | 1 | 2 | semanas |
| Semanas del pronóstico p | `p` | 1–20 | 1 | 4 | semanas |
| Permitir devoluciones | `neg` | booleano | — | `true` | — |
| Semilla | `seed` | 1–9 999 | 1 | 7 | — |

Modelo (Chen et al., 2000; política de nivel objetivo `S_t = L·MA_p(t)`, sin inventario de seguridad):
- Demanda del consumidor `D_t = μ + σ·N(0,1)`, sin redondear, para t = 0..(W + 104 − 1), con calentamiento W = 40.
- Para cada eslabón k = 1..4 (minorista, mayorista, distribuidor, fábrica), con entrada `x` = pedidos del eslabón anterior (el consumidor para k = 1): `q_t = x_t` si t < p; si no, `q_t = x_t + (L/p)·(x_t − x_{t−p})`. Si `neg = false`, `q_t = max(0, q_t)`.
- Amplificación del eslabón k a la semana t: `Var(q_k[W..W+t))/Var(D[W..W+t))`. Teórico para el minorista: `1 + 2L/p + 2L²/p²`.

Salidas → barras horizontales de amplificación (consumidor = 1×) y líneas de pedidos por eslabón; texto alternativo con las 4 razones.

### 3.7 Beer Game simplificado (`beer-game.js`)

Parámetros fijos del juego: 36 semanas, 4 roles [Minorista, Mayorista, Distribuidor, Fábrica], inventario inicial y objetivo 12, retraso de envío L = 2 (tubería inicial `[4, 4]`, en camino inicial 8), pedidos entrantes iniciales 4, θ = 0.25, α = 0.3, β = 0.5, costo $0.50 por caja en inventario y $1 por caja pendiente por semana. Controles: `seed` (1–9 999, defecto **42**) y `modo` (`auto` | `jugar`). En `jugar`, el pedido del minorista lo escribe la persona (entero de 0 a 99, defecto 4).

Demanda del cliente: `4` en las semanas 0–3; después `max(0, round(8 + 2·N(0,1)))`.

Cada semana t (orden exacto; replicar tal cual para que las pruebas cuadren):
1. `incoming[0] = demanda[t]`.
2. Para cada rol i = 0..3, en orden: `llega = pipe.shift()`; `inv += llega`; `enCamino −= llega`; `debe = incoming[i] + pendiente`; `envía = min(inv, debe)`; `inv −= envía`; `pendiente = debe − envía`; `D̂ = θ·incoming[i] + (1 − θ)·D̂`; `neto = inv − pendiente`; `O = max(0, round(D̂ + α(12 − neto) + α·β(D̂·L − enCamino)))` (en modo jugar, para i = 0 se usa el pedido de la persona); `enCamino += O`; `costo += 0.5·inv + 1·pendiente`.
3. Envíos: el rol i < 3 recibe en su tubería `envía` del rol i + 1; la fábrica recibe su propio pedido (producción con retraso L).
4. `incoming[i] = O_{i−1}` para i = 1..3 (el pedido se ve la semana siguiente).

Salidas → tarjetas por rol (inventario, pendiente, en camino, último pedido, costo, amplificación `Var(pedidos_i)/Var(demanda)`), KPIs (costo de la cadena, amplificación de la fábrica, pedido máximo de la fábrica y demanda máxima), líneas de pedidos y tabla semanal.

### 3.8 Teoría de colas y cuellos de botella (`colas.js`)

| Parámetro | Clave | Rango | Paso | Defecto | Unidad |
|---|---|---|---|---|---|
| Tasa de llegada λ | `lam` | 0.5–20 | 0.5 | 4 | clientes/h |
| Tasa de servicio μ | `mu` | 0.5–20 | 0.5 | 5 | clientes/h por servidor |
| Servidores c | `c` | 1–6 | 1 | 1 | — |
| Capacidad de pago | `pay` | 1–20 | 0.5 | 8 | clientes/h |
| Capacidad de entrega | `deliv` | 1–20 | 0.5 | 10 | clientes/h |
| Semilla | `seed` | 1–9 999 | 1 | 3 | — |

Modelo analítico M/M/c (si `ρ = λ/(cμ) < 1`; si no, «inestable» y L, Lq, W, Wq = ∞):
- `A = λ/μ`; `P0 = [Σ_{n=0}^{c−1} Aⁿ/n! + A^c/(c!(1 − ρ))]⁻¹`
- `P(esperar) = A^c/(c!(1 − ρ))·P0` (Erlang C); `Lq = P0·A^c·ρ/(c!(1 − ρ)²)`
- `Wq = Lq/λ`, `W = Wq + 1/μ`, `L = λ·W` (Little). Con c = 1: `L = ρ/(1 − ρ)`, `W = 1/(μ − λ)`.

Simulación de eventos discretos (jornada de 480 min): entre llegadas `−ln(1 − u)/λ·60` min, servicio `−ln(1 − u)/μ·60` min (en ese orden de consumo del RNG: primero la llegada, luego su servicio, luego la siguiente llegada); FIFO, una fila, el servidor que se libera antes. Clientes en sistema muestreados cada 2 min; L simulado = promedio de las muestras; Wq simulado sobre los clientes que ya iniciaron servicio; W simulado sobre los que ya salieron; utilización = tiempo ocupado/(c·t).

Línea de servicio: estaciones [Recepción 12/h, Atención c·μ, Pago `pay`, Entrega `deliv`]; utilización = λ/capacidad; cuello de botella = la de mayor utilización; flujo máximo = `min(λ, capacidad del cuello)`. Si la utilización es ≥ 1, la barra va en rojo `--danger`.

---

## 4. Casos de prueba con resultado esperado

Tolerancia por defecto: ±0.01 en valores redondeados a 2 decimales, salvo que se indique otra. Implementar en `tests/sims.test.mjs` con `node:test` + `node:assert` importando los mismos módulos de `public/js/sims/`.

| # | Módulo | Entrada | Resultado esperado |
|---|---|---|---|
| T1 | eoq | D = 1 200, S = 50, H = 2 | Q* ≈ **244.95**, pedidos/año ≈ 4.90, ciclo ≈ 74.5 días, CT(Q*) ≈ **489.90** |
| T2 | eoq | igual + Q = 400 | CT(400) = 550.00, penalización ≈ 12.27 % |
| T3 | eoq | D = 4 800 (resto igual que T1) | Q* ≈ 489.90 (= 2 × T1: crece con la raíz) |
| T4 | eoq | D = 1 200, L = 5 | ROP ≈ 16.44 u |
| T5 | colas | λ = 4, μ = 5, c = 1 | ρ = **0.8**, **L = 4**, Lq = 3.2, W = 1 h, Wq = 0.8 h, P(esperar) = 0.8 |
| T6 | colas | λ = 4, μ = 3, c = 2 | ρ ≈ 0.667, P0 = 0.2, Lq ≈ 1.067, L = 2.4, W = 0.6 h, P(esperar) ≈ 0.533 |
| T7 | colas | λ = 5, μ = 5, c = 1 | estado «inestable», L = ∞ |
| T8 | colas | λ = 4, c·μ = 5, pay = 8, deliv = 10 | cuello = «Atención» (80 %), flujo = 4/h. Con pay = 3: cuello = «Pago», flujo = 3/h |
| T9 | oferta-demanda | a = 120, b = 2, c = 20, d = 1.5, tax = 0 | P* ≈ 28.57, Q* ≈ 62.86 |
| T10 | oferta-demanda | igual con tax = 5 | P* ≈ 30.71, Q* ≈ 58.57, recaudación ≈ 292.86, pérdida irrecuperable ≈ 10.71 |
| T11 | oferta-demanda | k = 0.3, p0 = 50 | \|P(30) − P*\| < 0.01 (converge sin oscilar); con k = 1.5 los signos de P(t) − P* alternan |
| T12 | interes-compuesto | C₀ = 1 000, r = 10 %, n = 1, t = 2, A = 0 | VF = **1 210.00** |
| T13 | interes-compuesto | C₀ = 10 000, r = 8 %, n = 12, t = 10, A = 0 | VF ≈ 22 196.40 |
| T14 | interes-compuesto | C₀ = 0, A = 100, r = 12 %, n = 12, t = 1 | VF ≈ 1 268.25 |
| T15 | interes-compuesto | valores por defecto (10 000; 200; 8 %; mensual; 20 años) | VF_A ≈ 167 072.11; TEA ≈ 8.30 % |
| T16 | stats.z | 0.90 / 0.95 / 0.99 | 1.2817 / **1.6452** / 2.3268 (±0.001 contra los valores exactos 1.2816 / 1.6449 / 2.3263) |
| T17 | punto-reorden | d̄ = 20, σ = 5, L = 7, 95 % | SS ≈ **21.76**, ROP ≈ **161.76** |
| T18 | punto-reorden | σ = 0 | SS = 0 y ROP = d̄·L; con cualquier semilla, 0 días con faltante si Q ≥ d̄·L |
| T19 | revision | semilla 11, valores por defecto, t = 365 | Continua: inv. promedio ≈ 173.26, 25 pedidos, 1 día con faltante, surtido ≈ 99.94 %. Periódica: inv. promedio ≈ 185.87, 27 pedidos, 1 día con faltante, surtido ≈ 99.81 %. S ≈ 457.69 |
| T20 | bullwhip | L = 2, p = 4 | teórico del minorista = **2.50** |
| T21 | bullwhip | semilla 7, valores por defecto, t = 104 | razones ≈ [1.00, 2.50, 7.18, 22.64, 76.07] (±0.05); estrictamente crecientes |
| T22 | bullwhip | L = 0 | las 5 razones = 1.00 |
| T23 | beer-game | **semilla 42**, modo auto, 36 semanas | demanda = `4,4,4,4,6,7,4,6,7,10,7,4,7,1,9,10,11,9,10,10,9,5,13,6,6,7,9,9,7,6,7,9,7,8,12,5`; amplificación (Var pedidos / Var demanda) ≈ [0.76, 1.24, **2.62**, **4.40**]; la fábrica pide hasta 19 cajas contra un máximo de 13 del cliente; costo total ≈ 934.00 |
| T24 | beer-game | semilla 42 | **amplificación medible**: razón de la fábrica ≥ 2 y estrictamente creciente de mayorista a fábrica |
| T25 | rng | mulberry32(42), 3 primeros valores | 0.6011037519, 0.4482905590, 0.8524657935 |
| T26 | todas las estocásticas | misma semilla dos veces | resultados idénticos (determinismo); semilla distinta → serie de demanda distinta |

---

## 5. Tokens de diseño, breakpoints y estados de UI

### `public/css/tokens.css`

```css
:root {
  /* color */
  --bg: #F6F7F9; --surface: #FFFFFF; --surface-2: #EEF1F5; --line: #DCE1E8;
  --ink: #12151B;        /* 18.3:1 sobre blanco */
  --muted: #4F5866;      /*  7.2:1 */
  --accent: #1D5BD8;     /*  5.9:1  acción, enlaces, serie 1 */
  --accent-soft: #E6EEFC;
  --accent-2: #B4500B;   /*  5.1:1  serie 2 */
  --accent-2-soft: #FCEEE3;
  --series-3: #0F7C80;   /*  5.0:1 */
  --series-4: #6B3FC4;   /*  6.7:1 */
  --ok: #1A7A4C;         /*  5.3:1 */
  --warn: #9A4409;       /*  6.6:1 */
  --danger: #B3261E;     /*  6.5:1 */
  /* tipografía */
  --font-head: 'Space Grotesk', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --fs-display: clamp(30px, 4vw, 44px); --fs-hero: clamp(36px, 5vw, 60px);
  --fs-h2: 26px; --fs-h3: 18px; --fs-kpi: 24px; --fs-body: 16px; --fs-small: 13px;
  /* espacio y forma */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px; --sp-7: 48px;
  --r-sm: 8px; --r-md: 12px; --r-lg: 14px; --r-pill: 999px;
  --tap: 44px; --container: 1280px;
}
```

Modo oscuro: `@media (prefers-color-scheme: dark)` con `--bg #0F1115`, `--surface #171A21`, `--surface-2 #20242D`, `--line #2C313C`, `--ink #ECEEF2`, `--muted #A9B1BE`, `--accent #7EA6F5`, `--accent-2 #F0A060`, `--series-3 #5CC3C7`, `--series-4 #B49CF0`, `--ok #5BC08C`, `--danger #F2847C`. Hay que verificar 4.5:1 en texto y 3:1 en trazos de gráfica.

Las gráficas leen los colores de `getComputedStyle(document.documentElement)` para respetar el tema. Cada serie también se distingue por trazo: continuo, discontinuo `8 6` o punteado `2 4`.

### Breakpoints

| Nombre | Ancho | Disposición |
|---|---|---|
| Móvil | < 640 px | Una columna, margen 16 px. Navegación de simulaciones con `<select>`. KPIs en 2 columnas. Parámetros en `<details open>`. Explicación en 4 acordeones. Barra de control con 3 botones a ancho igual. |
| Tableta | 640–1023 px | Margen 24 px. Navegación horizontal con `overflow-x: auto`. Parámetros arriba en 2 columnas y resultados debajo; desde 900 px, lado a lado. |
| Escritorio | ≥ 1024 px | Panel de parámetros de 300–360 px y resultados flexibles. Contenedor máximo de 1280 px. Explicación en 4 tarjetas (`repeat(auto-fit, minmax(280px, 1fr))`). |

Usar container queries en `.sim-layout` (`container-type: inline-size`) para el cambio parámetros/resultados, y media queries solo para la cabecera. Sin scroll horizontal de página a 320 px; las tablas anchas se desplazan dentro de su caja.

### Estados de UI (`ui/runner.js`)

| Estado | Insignia | Botón principal | Reglas |
|---|---|---|---|
| `reset` (Reiniciada) | gris `--surface-2`/`--muted` | «Iniciar» | t = 0; series vacías; los KPIs analíticos sí se muestran; «Reiniciar» desactivado |
| `running` (En curso) | verde `#E3F3EA`/`--ok` | «Pausar» | avanza con `setInterval` (velocidad 1×, 2× o 4×); los deslizadores recalculan `simulate()` y conservan t |
| `paused` (En pausa) | naranja `--accent-2-soft`/`--warn` | «Continuar» | «Paso +1» avanza un periodo; la tabla de datos refleja hasta t |
| `done` (Terminada) | azul `--accent-soft`/`--accent` | «Repetir» | t = horizonte; «Repetir» vuelve a t = 0 y pasa a `running` |

Transiciones: reset → running (Iniciar), running ⇄ paused (Pausar/Continuar), paused → paused (Paso), running/paused → done (al llegar al horizonte), cualquiera → reset (Reiniciar, cambio de semilla o de modo en Beer Game). Cambiar de ruta detiene el reloj (`clearInterval`). Con `prefers-reduced-motion: reduce`, la velocidad por defecto es «Paso a paso»: no hay autoavance y «Iniciar» se comporta como «Paso +1».

---

## 6. Accesibilidad

- **Deslizadores:** `<label for>` visible + `<input type="range">` con `min`, `max`, `step` y `value`, `aria-valuetext` con valor y unidad («1 200 u/año»), `aria-describedby` hacia la línea «Rango … · por defecto …» y `<output for>` con el valor actual. Las flechas cambian un `step` y RePág/AvPág diez. Área táctil ≥ 44 px de alto.
- **Barra de control:** botones `<button type="button">` reales. La insignia de estado lleva `role="status"` + `aria-live="polite"` y anuncia solo cambios de estado, no cada periodo. Los botones de solo icono llevan `aria-label` («Pedir una caja más»).
- **Gráficas:** cada `<svg>` tiene `role="img"` y `aria-label` con una frase que resume lo importante en t (texto generado por `summarize()`), y la misma frase visible bajo la gráfica. Debajo hay un `<details><summary>Ver datos … en tabla</summary>` con una `<table>` con `<caption>` o encabezados `scope`. Las leyendas son HTML, no texto dentro del SVG. Los elementos decorativos llevan `aria-hidden="true"`.
- **Contraste:** texto ≥ 4.5:1 (los tokens ya cumplen sobre `--surface` y `--bg`) y trazos de gráfica y bordes de controles ≥ 3:1. El color nunca es la única señal: hay trazos distintos, la palabra «cuello» en la estación limitante y negritas en la mejor política.
- **Foco:** `:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px }` en enlaces, botones, inputs, selects y `summary`. Orden de tabulación = orden visual.
- **Estructura:** `lang="es"`, un `h1` por pantalla, `nav aria-label="Simulaciones"` con `aria-current="page"`, `main`, `section` con `aria-labelledby`. Al cambiar de ruta, se mueve el foco al `h1` y se actualiza `document.title` («SimEco · EOQ»).
- **Movimiento:** se respeta `prefers-reduced-motion` (ver sección 5).
- **Formato numérico:** `Intl.NumberFormat('es-MX')` (punto decimal, separador de miles con coma o espacio fino de forma consistente).

---

## 7. Despliegue en Cloudflare (gratuito)

Se publica como **Worker de solo assets estáticos** en el plan gratuito de Workers: no hay código de servidor y las solicitudes a assets estáticos no consumen invocaciones del Worker.

### `wrangler.jsonc`

```jsonc
{
  // SimEco Web: sitio estático, sin código de servidor
  "name": "simeco-web",
  "compatibility_date": "2026-06-01",
  "assets": {
    "directory": "./public"
  }
}
```

No se necesita `main` (no hay script de Worker) ni `not_found_handling`, porque las rutas viven en el hash y el servidor solo recibe `/`.

### `.node-version`

```
24
```

### Workers Builds (Cloudflare Dashboard → Workers & Pages → Create → Import a repository)

| Campo | Valor |
|---|---|
| Repositorio / rama de producción | `semubla-art/gh1311-simecoweb` / `main` |
| Build command | *(vacío)* |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` (opcional, para vistas previas) |
| Root directory | `/` |
| Variables de entorno | ninguna (Node lo fija `.node-version`) |

Despliegue manual desde una máquina local (alternativa):

```bash
npx wrangler login
```

```bash
npx wrangler deploy
```

La URL queda en `https://simeco-web.<subdominio>.workers.dev`. Un dominio propio se puede agregar después en *Settings → Domains & Routes*.

---

## 8. Criterios de aceptación por sección

Generales (aplican a todas las rutas):
- [ ] `public/` se sirve tal cual: sin paso de build y sin `package.json` requerido para ejecutar la app.
- [ ] Ninguna importación de framework o CDN de scripts; `grep -R "Math.random" public/js/sims` no devuelve nada.
- [ ] `node --test tests/` pasa los casos T1–T26.
- [ ] A 320, 390, 768, 1024 y 1440 px no hay scroll horizontal de página y nada queda recortado.
- [ ] Lighthouse (móvil) Accesibilidad ≥ 95 y Rendimiento ≥ 90; axe sin violaciones serias.
- [ ] Recorrer la pantalla solo con teclado permite cambiar cada parámetro, iniciar, pausar, avanzar y reiniciar.
- [ ] Los cuatro estados de la sección 5 se ven y se anuncian, y cambiar de ruta detiene el reloj.
- [ ] Cada pantalla muestra las 4 tarjetas: Qué simula, Qué significa cada parámetro (generada desde `params[].meaning`), Efectos y Utilidad en los negocios.

Por sección:
- **Inicio:** 8 tarjetas con número, categoría, título y descripción, cada una enlazada a su ruta; los enlaces funcionan con teclado.
- **Oferta y demanda:** al mover `a`, `b`, `c`, `d` o `tax`, el punto de equilibrio se mueve en el mismo cuadro; con `tax > 0` aparece la oferta con impuesto en trazo discontinuo y los KPIs de recaudación y pérdida irrecuperable; T9–T11 pasan.
- **Interés compuesto:** las líneas crecen año por año al correr; cambiar el plazo reinicia la simulación; con tasa < inflación la línea real decrece; T12–T15 pasan.
- **EOQ:** el mínimo de la curva total coincide con Q* y ahí se cruzan las curvas de pedir y mantener; «Usar Q*» lleva la penalización a ≈ 0 %; el diente de sierra se anima hasta el día 365; T1–T4 pasan.
- **Punto de reorden:** las líneas ROP y SS se mueven al cambiar σ, L o el nivel de servicio; los faltantes y los pedidos se marcan en la gráfica; la misma semilla reproduce la misma corrida; T16–T18 pasan.
- **Revisión:** ambas políticas usan la misma serie de demanda; la tabla resalta en negrita la mejor de cada fila; las guías verticales caen cada T días; T19 pasa.
- **Efecto látigo:** las barras crecen de consumidor a fábrica con los valores por defecto; L = 0 las iguala a 1×; desactivar devoluciones elimina pedidos negativos; T20–T22 pasan.
- **Beer Game:** el modo automático corre las 36 semanas; el modo «Jugar como minorista» espera el pedido de la persona cada semana («Esperando tu pedido») y solo avanza al enviarlo; los pendientes > 0 se muestran en `--danger`; T23–T24 pasan.
- **Colas:** con ρ ≥ 1 aparece la alerta `role="alert"` y la tabla muestra ∞; la vista «mostrador ahora» coincide con la gráfica en t; la estación de mayor utilización dice «cuello»; T5–T8 pasan.
- **Despliegue:** `npx wrangler deploy` sin build publica el sitio; `https://simeco-web.<subdominio>.workers.dev/#/eoq` abre directamente la pantalla EOQ.
