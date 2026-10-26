# Comportamiento responsive

Referencias de la especificación: móvil <640, tablet 640–1023,
escritorio 1024–1439, ancho ≥1440. Reglas reales en `layout.css` y
`base.css`:

| Ancho | Comportamiento |
|---|---|
| ≤1023 px | Layout de una columna; navegación lateral pasa a horizontal superior con scroll interno; indicadores en 2 columnas. |
| ≤767 px | Tablas se convierten en tarjetas con etiqueta por celda (`data-label`); la fila de vacío vuelve a bloque. |
| ≤640 px | Indicadores en 1 columna; botones de tareas a ancho completo; padding y título reducidos. |
| ≥1024 px | Layout de 2 columnas (220 px + contenido); tablas completas. |
| ≥1440 px | Sin regla distinta: el contenido centra a 1200 px máximo. |

- **Sin scroll horizontal global:** contenido con `min-width: 0`,
  rejilla con `minmax(0, 1fr)`, filas con `flex-wrap`, tarjetas con
  scroll interno como resguardo, campos con base flexible y mínimo de
  200 px, diálogo con ancho 100% y máximo 520 px.
- **Pendiente (no afirmar como hecho):** matriz real de viewports
  (375/640/768/1024/1440) en navegador: no hay navegador automatizado
  en el entorno de desarrollo y el navegador en vivo no abre localhost.
  La verificación post-despliegue en la demo cubre el viewport de
  escritorio; la matriz completa queda como prueba manual pendiente.
