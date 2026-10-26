# Bases visuales

- **Fondo general** (`--color-canvas` `#F7F8FC`) con superficies blancas
  (`--color-surface`) en tarjetas. El contenido centra a 1200 px máximo.
- **Tipografía:** stack de sistema (opción prevista por la especificación
  ante la falta de pipeline de fuentes externas). Escala: 32/28/20/16/14/
  16/13/12 px con pesos 600/600/600/600/400/400/500/400. Alturas de línea
  1,25 (títulos), 1,5 (cuerpo), 1,4 (etiquetas).
- **Espaciado:** escala base 4 px (4–48). Sin valores arbitrarios
  repetidos fuera de los tokens.
- **Radios:** controles 8 px, tarjetas 12 px, diálogos 16 px (el diálogo
  usa 12 px en la práctica: ver `DECISIONS.md`), píldoras 999 px.
- **Sombras:** suaves, solo para separar elementos (diálogo y tarjetas
  en hover no usan sombra; el diálogo se separa con fondo oscuro).
