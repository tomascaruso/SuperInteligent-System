# Estados de componentes

- **Button:** normal, hover (fondo), active (brillo 0,94), disabled
  (opacidad 0,55, cursor no permitido), `.is-loading` (opacidad 0,7, sin
  eventos) mientras la operación está en curso. El envío deshabilita el
  botón: no hay dobles envíos en crear, completar, confirmar, entrar,
  aceptar ni actualizar.
- **TextField:** normal, `:focus-visible` (borde primario + anillo),
  disabled (opacidad 0,6).
- **Badge:** un estado por valor real; los valores sin mapear caen a
  neutral y se muestran tal cual (nunca se inventa una etiqueta).
- **Alert:** vacío oculto; con mensaje muestra color + texto. El global
  tiene `role="alert"`; los de sección, `aria-live="polite"`.
- **Card / DataTable:** normal; tabla a tarjetas en ≤767 px; scroll
  horizontal interno como resguardo (nunca global).
- **Dialog:** abierto/cerrado; foco inicial en Cancelar; Escape y clic
  fuera lo cierran; trampa de foco con Tab; al cerrar, el foco vuelve
  al botón que lo abrió.
- **Listas:** carga (`Cargando…`), vacío (texto + siguiente paso),
  error (mensaje en la sección, sin borrar los datos visibles).
- **Navegación:** activa con fondo suave + `aria-current="page"`.
