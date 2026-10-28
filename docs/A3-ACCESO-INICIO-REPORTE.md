# A3 — Contraste del acceso + humanización de Procesos de Inicio

## Estado general
COMPLETO EN LOCAL. Solo los 2 puntos pedidos, nada más. Sin merge, sin despliegue,
sin git, sin tocar la demo pública ni la base real local.

## Objetivo
1. Cerrar el contraste 4,48:1 del panel izquierdo del acceso, pendiente fuera del
   alcance de A2.
2. Quitar de la tabla de Procesos de Inicio el sufijo técnico tipo `#5df8ccaf`,
   que un usuario sin conocimientos técnicos no entiende, sin perder el ID para
   soporte.

## Acciones

### 1. Contraste del panel izquierdo del acceso — HECHO (4,48:1 → 15,33:1)
Los tres textos usaban `text-secondary` (#64748B) directo sobre el fondo claro del
panel (`bg-canvas`, #F7F8FC): 4,48:1, por debajo del mínimo 4,5:1. Ahora usan
`text-ink` (#172033), la misma técnica de A1/A2, sin tocar el token global:

| Texto | Antes | Después |
|---|---|---|
| Subtítulo («Coordina procesos, supervisa agentes especializados…») | 4,48:1 | 15,33:1 |
| Descriptores de los 4 rubros | 4,48:1 | 15,33:1 |
| Primera línea del pie («Tecnología sofisticada explicada con simplicidad empresarial.») | 4,48:1 | 15,33:1 |

Límites respetados: panel DERECHO sin tocar (sigue como el usuario lo aprobó),
logo, fila de iconos e ilustración sin tocar, y los demás textos del izquierdo
(título, nombres de rubros, «Menos tareas. Más sistema.») sin tocar porque ya
estaban bien. Sin cambios de layout: el no-scroll del acceso no se ve afectado
(solo cambió el color de tres textos).

### 2. Procesos de Inicio sin sufijo técnico — HECHO
- Fila de la tabla: queda solo el nombre legible del proceso
  («Captación de oportunidad»), más oportunidad, estado, agente activo, etapa
  actual y última actualización, como antes. Sin cambios de orden, filtros ni
  comportamiento de la tabla.
- Tarjeta «Orquestador» (detalle del proceso seleccionado): también sin sufijo.
- Diálogo «Ver proceso» (el detalle que abre la fila): suma el ID completo
  rotulado «ID técnico (uso interno)», siguiendo el precedente R4b. El ID no se
  pierde para soporte; simplemente ya no ensucia la vista principal.
- Ningún dato nuevo, ningún proceso renombrado: solo se quitó el fragmento de
  la vista principal y se mostró el ID completo donde corresponde.

## Archivos
- `app/client/src/features/auth/LoginScreen.tsx` (3 textos del panel izquierdo:
  subtítulo, descriptores de rubros, primera línea del pie).
- `app/client/src/features/inicio/HomeView.tsx` (fila de la tabla, tarjeta
  Orquestador, diálogo con el ID técnico).
- No se modificó ningún test existente ni hizo falta agregar uno: ambos cambios
  son de presentación y no alteran comportamiento, contratos ni datos.

## Pruebas
- Suite: **158/158 en 11 archivos** (sin cambios).
- Build limpio; `tsc -p client/tsconfig.json --noEmit` limpio;
  `node --check public/app.js` OK.
- Vanilla intacta: `app/public/app.js` MD5 `44ef9ae6daf62c3b9c335f6f2501256a`.
- DB real local intacta: MD5 `af175edc7673befe9b9f3ace3c556c12`.
- Smoke en copia de DB (puerto 3497): health OK, login demo OK, procesos OK,
  `/` 200, y la cadena «ID técnico (uso interno)» presente en el JS construido.
  Ningún proceso node quedó en pie.
- Contrastes verificados por cálculo de luminancia (en esta VM no hay
  Chromium/Playwright): la confirmación visual queda para la verificación
  post-merge.

## Evidencia
- Contraste antes: secundario #64748B sobre fondo #F7F8FC = 4,48:1.
- Contraste después: tinta #172033 sobre fondo #F7F8FC = 15,33:1.
- Grep de control: ningún `slice(0, 8)` de ID queda en HomeView (los dos
  restantes son el límite «primeros 8 procesos» de la tabla, no IDs); ningún
  `text-secondary` queda en el panel izquierdo del acceso.

## Decisiones
- Ninguna nueva: se aplicó la técnica ya aprobada en A1/A2 y el precedente R4b
  para el ID técnico.

## Riesgos
- Ninguno conocido. El cambio de contraste es solo color de texto; el cambio de
  la tabla es solo presentación (el ID completo sigue disponible en el diálogo).

## Próximo paso
Ofrecer subir y mergear A3 con el procedimiento habitual (snapshot de texto +
verificación de PNG conservados + PR + merge + verificación en vivo solo
lectura; la pantalla de acceso nueva queda para captura del usuario en
incógnito, como siempre).
