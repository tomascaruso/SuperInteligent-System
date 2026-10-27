# LOGIN-V2-AJUSTES — Panel izquierdo del inicio de sesión + bug del contacto

## Estado general

- **Estado:** COMPLETO EN LOCAL (sin merge, sin despliegue).
- **Fecha:** 27-oct-2026.
- **Alcance:** solo `app/client/src/features/auth/LoginScreen.tsx`. No se tocó `App.tsx`, no se tocó la app vanilla, no hay cambios de servidor. El panel derecho no se tocó salvo el punto del contacto (ver abajo): ni su estructura, ni sus textos, ni sus espaciados, ni la tarjeta, ni los secundarios.

## Objetivo

Corregir los 3 problemas del panel izquierdo señalados por Tomás con su captura en incógnito (27-oct ~20:02), sin cambiar los textos aprobados, y corregir el bug de duplicación del formulario de contacto (ubicación corregida por Tomás ~20:04: era contacto, no invitación), manteniendo la restricción sin scroll.

## Acciones

### 1. Logo distorsionado y muy grande — causa y corrección

- **Causa real:** el código le imponía al logo una proporción casi cuadrada (`aspectRatio: '1137 / 1040'`) con alto fijo, pero el asset real `sis-logo.png` es apaisado: **560×266** (verificado en disco). Eso lo estiraba en vertical y lo agrandaba.
- **Corrección:** se quitó el `aspectRatio` en línea y los atributos viejos (280×256). Ahora solo ancho (`w-[220px]`, referencia aprobada) con alto automático, y atributos intrínsecos correctos (560×266). Nunca se fijan ancho y alto a la vez.
- **Efecto:** el logo pasa de ~192 px de alto distorsionado a ~105 px con su proporción natural, liberando ~87 px de altura.

### 2. Iconos en una sola fila

- **Antes:** grilla 2×2 (`grid-cols-2`).
- **Ahora:** grilla de 4 columnas en escritorio (`grid-cols-4`), con cada rubro en vertical compacto (icono 24 px arriba, título 14 px, descriptor 12 px, `min-w-0` para no desbordar). Los 4 rubros y sus descriptores no cambiaron.

### 3. Gráfico chico y poco visible

- **Antes:** tira pequeña, porque el logo gigante y la grilla 2×2 le comían la altura.
- **Ahora:** ocupa el espacio liberado (logo más chico + fila única liberan ~130 px en total) con contenedor flexible (`flex-1`, `min-h-0`, centrado). Sigue siendo la misma ilustración **abstracta** en SVG puro: sin números, sin nombres, sin métricas, sin datos inventados.

### 4. Bug del formulario de contacto — ubicación correcta e investigación

- **Ubicación correcta (corrección de Tomás ~20:04):** el bug NO era en «Tengo una invitación» sino en «Contacta con el administrador» (texto de ayuda del panel derecho).
- **Investigación (causa real):** se revisó el disparador de ayuda, el renderizado del formulario, el montaje y las primitivas. Hallazgo: el código **ya tenía** una sola instancia del formulario (un único `{showContact && ...}`, un solo montaje de `LoginScreen` en `App.tsx`, `Card` renderiza sus hijos una sola vez, `Button` es un `<button>` simple) y el disparador **ya alternaba** (`setShowContact((v) => !v)`). Es decir, el estado no puede producir dos formularios en el DOM. El defecto real era de interacción: el disparador quedaba activo e idéntico con el formulario abierto lejos abajo (tras el botón de invitación y la demo), sin forma explícita de cerrarlo, lo que invitaba al re-toque confuso.
- **Corrección (sin cambiar la estructura):** se agregó `aria-expanded={showContact}` al disparador de ayuda y un botón secundario «Cerrar» dentro del formulario de contacto (cierra con `setShowContact(false)`). El segundo toque alterna/cierra; nunca duplica. La instancia sigue siendo única (verificado en fuente y en bundle: «Quiero una demo para mi empresa» ×1).
- **Invitación verificada y NO tocada:** un solo condicional `{showInvitation && ...}` y alternancia correcta; su comportamiento aprobado quedó intacto.

## Sin scroll

El shell sigue en `100dvh` y los 3 ajustes se compensan entre sí (logo más chico + fila única liberan la altura que gana el gráfico), así que la vista principal (ambos paneles en escritorio ≥1024; solo el formulario en móvil) sigue entrando completa sin scroll de página. Los formularios secundarios expandidos siguen siendo la única excepción admitida.

## Pruebas

- Suite: **150/150 en 10 archivos** (sin cambio de servidor no hay tests nuevos de servidor; el cliente no tiene runner de tests en este repo).
- Build limpio; `tsc -p client/tsconfig.json --noEmit` limpio; `node --check public/app.js` OK.
- Vanilla intacta (MD5 `44ef9ae6daf62c3b9c335f6f2501256a`); DB real local intacta (MD5 `af175edc7673befe9b9f3ace3c556c12`); ningún proceso en pie.
- Smoke en copia de DB (puerto 3485, matado por PID exacto): health OK, login demo OK, `GET /api/opportunities` OK.
- Grep en fuente: 1 `showContact &&`, 1 `showInvitation &&`, 1 `aria-expanded={showContact}`, 0 referencias a la proporción vieja `1137 / 1040` y 0 `grid-cols-2` en `LoginScreen.tsx`.
- Grep en JS construido: presentes «Menos tareas. Más sistema.» (×1) y «Contacta con el administrador» (×2: texto del botón + texto plano de respaldo, ambos ya estaban en el código); «Quiero una demo para mi empresa» ×1 (una sola instancia del formulario); «Tengo una invitación» ×1; **ausentes** «Recordarme» (×0) y «¿Olvidaste tu contraseña?» (×0).

## Evidencia

- Código cambiado: `app/client/src/features/auth/LoginScreen.tsx` (panel izquierdo + disparador/formulario de contacto).
- Este informe: `docs/LOGIN-V2-AJUSTES-REPORTE.md`.

## Decisiones

- No se cambió ningún texto aprobado del panel izquierdo ni del derecho.
- No se tocó el comportamiento de «Tengo una invitación» (verificado correcto).
- El botón «Cerrar» es solo una vía explícita de cierre; no cambia campos, textos ni el envío del contacto.

## Riesgos

- Ninguno de servidor ni de datos. Solo presentación y un control de cierre.

## Próximo paso

Ofrecer subir y mergear con el procedimiento habitual (snapshot de texto + verificación de PNG conservados + PR + merge + verificación en vivo solo lectura).

## Pendiente de verificación visual (no verificable en esta VM)

En esta VM no hay Chromium/Playwright, así que NO se pudo verificar visualmente la proporción del logo, la fila única de iconos ni el tamaño del gráfico. La verificación en vivo post-merge (captura de Tomás en incógnito, ya que el navegador no puede abrir ventana privada sin cerrar la sesión principal) debe confirmar esos 3 puntos + el no-scroll + que el segundo toque en «Contacta con el administrador» no duplica el formulario.
