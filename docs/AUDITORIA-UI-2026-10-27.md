# Auditoría UI — App React (/v2/) — 27-oct-2026

**Alcance:** app React en `/v2/` sobre main `e94768ab` (H1), demo pública
https://superinteligent-system-demo-9e49.onrender.com.
**Método:** inspección de código (`app/client/src`) + recorrido en vivo de
solo lectura el 27-oct-2026 13:51–13:53 (sesión Martín Demo · admin, ventana
~1920 px). **No se corrigió nada ni se creó ningún dato**: la auditoría es
de solo lectura, como pide el playbook. La pantalla de acceso no se visitó
en vivo (la sesión ya estaba iniciada y no se cerró para no alterarla); se
auditó por código.

**Resultado general:** sin hallazgos P0 (nada bloquea completar una tarea ni
arriesga datos). 3 hallazgos P1, 1 P2 y varios P3. Lo más importante: un
campo que se muestra sin dato (Puntaje) y dos problemas de contraste
medidos, no estimados.

## Cobertura por dimensión

- **Accesibilidad:** parcial. Foco con Tab probado en vivo (Inicio y diálogo
  Nueva oportunidad: anillo visible, orden lógico, trampa de foco correcta).
  Contraste calculado con luminancia real (no por nombre de token). Sin
  lector de pantalla, sin anchos móviles, sin prueba táctil.
- **Performance:** solo a nivel de código (sin profiler ni red medida).
- **Temas y sistema:** tokens centralizados en `index.css`, un solo tema
  claro (no se exige tema oscuro: el producto no lo soporta).
- **Responsive:** solo escritorio ancho (~1920 px). Móvil/tablet NO
  verificados: el navegador en vivo no redimensiona y ese chequeo queda
  pendiente (el usuario lo hace a mano).
- **Integridad de implementación:** código + vivo. 2 vistas reales con
  datos (Inicio, Oportunidades); 4 secciones honestas en aviso de
  migración (Tareas, Aprobaciones, Actividad, Agentes) con enlace a la app
  actual — eso es alcance pendiente (R2–R5), no un defecto: el aviso no
  finge datos.

## Hallazgos P1

### P1-1. El campo "Puntaje" del panel de Oportunidades se muestra vacío
- **Dónde:** Oportunidades → panel de detalle → Resumen, campo "Puntaje"
  (también en la pestaña de detalle que lo repite). Visto en vivo en la
  ficha de Fernando y confirmado en código.
- **Evidencia:** el cliente declara `score: number`
  (`client/src/lib/api.ts:289`) y el panel renderiza `{selected.score}`
  (`features/oportunidades/OpportunitiesView.tsx:537,573`), pero el
  servidor nunca devuelve `score`: no hay columna en la tabla
  `opportunities` (`app/src/db.ts`) ni `score` en `routes.ts`. El puntaje
  sí existe como cálculo: el clasificador lo computa
  (`app/src/domain.ts:118-126`: urgencia +2, presupuesto +1, empresa +1,
  dominio corporativo +1, categoría no general +1) y de él deriva la
  prioridad. El panel incluso explica debajo cómo se calcula, pero el
  número no aparece.
- **Impacto:** campo con etiqueta y explicación pero sin valor: parece un
  error o un dato engañoso.
- **Corrección mínima (para una fase de arreglo, no hecha acá):** persistir
  el puntaje en el alta (columna nueva + devolverlo en la API) o, si se
  prefiere no exponerlo, quitar el campo del panel hasta que exista.

### P1-2. Texto secundario sobre la fila seleccionada: 3,49:1 (falla AA)
- **Dónde:** Oportunidades → tabla, fila seleccionada (fondo índigo claro
  `bg-primary/20`, ≈ `#DBDAF9`). Los subtextos en `text-secondary`
  (empresa, categoría, "Sin pendiente") quedan en 3,49:1, por debajo del
  4,5:1 de WCAG AA para texto normal. El texto principal en tinta sobre
  ese fondo da 11,94:1 (correcto).
- **Corrección mínima:** en la fila seleccionada, que los subtextos usen
  tinta (o un gris más oscuro) en vez de secundario.

### P1-3. Texto informativo en `text-muted`: 2,56:1 (falla AA)
- **Dónde:** pantalla de acceso (`features/auth/LoginScreen.tsx`), textos
  en `text-muted` (`#94A3B8` sobre blanco = 2,56:1): la explicación de la
  invitación, la línea de la cuenta de demostración, "¿No tenés una
  cuenta?" y la introducción del formulario de contacto. Son textos
  informativos reales, no decorativos (la línea de la demo incluye las
  credenciales de prueba).
- **Corrección mínima:** usar `text-secondary` (4,76:1 sobre blanco) para
  los textos informativos y reservar `text-muted` solo para lo puramente
  decorativo ("by PENSIA").

## Hallazgo P2

### P2-1. Las pestañas del panel de Oportunidades se parten en dos líneas
- **Dónde:** panel de detalle → "Resumen / Borrador / Tareas / Actividad":
  a 1920 px "Actividad" cae a una segunda línea. Legible, pero irregular.
  El componente `Tabs` ya tiene prop `scrollable` y Oportunidades lo usa
  en `false` con `flex-wrap`.
- **Corrección mínima:** usar pestañas con desplazamiento horizontal en
  el panel de detalle en vez de envolverlas.

## Hallazgos P3 (menores)

- **P3-1. Fila seleccionada, resto:** el mismo 3,49:1 no afecta a badges
  (blanco sobre color sólido: 5,02–6,70:1, correctos) ni al texto
  principal. Solo subtextos secundarios (ya cubierto en P1-2).
- **P3-2. Secundario sobre fondo de página (4,48:1):** `text-secondary`
  directo sobre el fondo `#F7F8FC` (p. ej. el "Cargando…") queda apenas
  por debajo de 4,5:1. Marginal; se corrige junto con P1-2 si se oscurece
  el secundario o se evita sobre fondo.
- **P3-3. Botón X de diálogo (~32 px):** por debajo de la recomendación
  táctil de 44 px, pero por encima del mínimo WCAG 2.2 de 24 px. La
  navegación principal sí tiene 44 px de alto.
- **P3-4. Semántica menor:** `th` sin `scope` en `Table`; pestañas con
  `role="tab"` y `aria-selected` pero sin `aria-controls`/paneles
  `tabpanel`; las vistas en aviso de migración usan `h2` sin `h1`.
- **P3-5. Título de pestaña del navegador:** `/v2/` dice "… — Acceso" aun
  con sesión iniciada (conocido desde R1c).
- **P3-6. Peso de assets (sospecha, sin medición):** el logo se muestra a
  280 px pero pesa 187 KB y la marca a ~25 px pesa 73 KB. No se midió
  impacto real; solo se anota para una pasada de optimización.
- **P3-7. Píldora de atención ajustada:** en vivo se ve en 2 líneas y
  entra (R1i aprobado), pero queda justa verticalmente. Sin acción
  propuesta salvo que el usuario la marque de nuevo.
- **Observación (no es hallazgo):** "Próximo paso" envuelve su texto en 2
  líneas dentro de la celda, visible y sin recorte: es el comportamiento
  diseñado, no un defecto.

## Lo que está bien (vale preservarlo)

- Foco visible global (`:focus-visible` con anillo índigo) y trampa de
  foco del diálogo verificadas en vivo con Tab.
- Etiquetas en todos los formularios (acceso, invitación, contacto, alta
  de oportunidad) y nombres accesibles en botones de icono.
- Estados reales cubiertos: carga, error con Reintentar (Inicio),
  vacíos honestos ("Sin tareas…", "Sin borrador…", "—" sin vínculo).
- Sin datos inventados en Inicio ni Oportunidades (salvo el campo
  Puntaje, P1-1): números reales, organización marcada "(demo)".
- Reglas React aplicables de Vercel cumplidas: fetches independientes
  en `Promise.all` (Inicio y Oportunidades), imports directos sin
  barrels, sin componentes definidos dentro de otros, `useCallback`
  donde el efecto depende de la identidad (diálogo, R1f). Las reglas de
  Next.js/servidor no aplican a esta app (Vite + Fastify) y no se
  evaluaron como defectos.
- Sin animaciones: no hay nada que adaptar a `prefers-reduced-motion`.
- Nota de performance (sin medición): Inicio hace `Promise.all` de
  detalles de hasta 8 procesos (N+1); aceptable a esta escala, no es un
  hallazgo sin evidencia de lentitud.

## No verificado (queda explícito, no es un "pasa")

- Anchos móviles/tablet y reflow angosto; entrada táctil real; lector
  de pantalla y anuncios de estado; pantalla de acceso en vivo; destino
  del botón "Ir a la aplicación actual" (no se pulsó a propósito); el
  campo Puntaje en fichas distintas de Fernando (el código muestra que
  falta en todas, porque la API no lo devuelve); métricas de profiler o
  red.

## Próximos pasos propuestos (en orden, solo si el usuario los autoriza)

1. P1-1 (Puntaje: persistir y devolver, o quitar el campo).
2. P1-2 + P3-2 (contraste de secundarios: fila seleccionada y fondo).
3. P1-3 (muted → secondary en textos informativos del acceso).
4. P2-1 (pestañas del panel con scroll).
5. P3-3 a P3-6 en una pasada de pulido, con re-auditoría después.
