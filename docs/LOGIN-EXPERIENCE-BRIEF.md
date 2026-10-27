# SIS — Login Experience Implementation Brief

**Guardado:** 26-oct-2026 (noche, ART), por instrucción de Tomás.
**Imagen de referencia:** `~/workspace/user/media_library/image/66/66c7e826e471aecd8fdfb9eda553cdffdd656a588ec3c96809e8c9b616427d36.png`
(PNG 1536×1024; NO copiada al repo, igual que la referencia del
dashboard). La imagen es referencia visual complementaria al
UI/UX System OS, no especificación literal.
**Estado:** GUARDADO. Sin implementación, sin cambios de código,
sin merges ni despliegues. La implementación espera autorización
de Tomás por paso, y la precede un diagnóstico específico de la
pantalla de acceso (mecánica real de autenticación vs. brief).

## 1. Objetivo

Implementar o adaptar la pantalla inicial de acceso de
SuperInteligent System (SIS, por PENSIA) tomando la imagen como
referencia visual y respetando íntegramente el UI/UX System OS.
Experiencia profesional, moderna, clara y confiable, coherente
con una plataforma B2B SaaS de orquestación y supervisión de
agentes inteligentes. Principio rector: conservar las reglas del
sistema de diseño existente y usar la referencia para concretar
la composición visual de esta pantalla.

## 2. Dirección visual

- Dos paneles en escritorio: izquierdo para presentar SIS
  (propuesta de valor + representación visual de la plataforma),
  derecho para el formulario de autenticación.
- Fondo claro, superficies blancas, espacios generosos, jerarquía
  tipográfica definida, acentos índigo/violeta de los tokens del
  System OS, bordes sutiles, campos claros, botones destacados,
  iconografía coherente.
- Sin paleta, tipografía ni sistema de componentes paralelo:
  reutilizar las decisiones y componentes existentes.
- Identidad consistente entre SIS y PENSIA.

## 3. Panel izquierdo: identidad y propuesta de valor

- Marca SIS, nombre completo SuperInteligent System, firma
  by PENSIA.
- Mensaje principal: «Inteligencia artificial que trabaja para
  tu negocio».
- Descripción: «Orquesta agentes, automatiza procesos y toma el
  control de tus operaciones con una plataforma diseñada para
  empresas que quieren avanzar».
- Cuatro beneficios: (1) Agentes especializados: cada tarea, el
  agente ideal. (2) Procesos automatizados: menos tareas
  manuales, más resultados. (3) Control y trazabilidad:
  visibilidad de cada paso. (4) Adaptable a tu negocio:
  configura, integra y escala.
- La redacción puede ajustarse, pero se conserva el
  posicionamiento: orquestación y supervisión de agentes, no CRM.
- Representación visual del producto: usar una captura auténtica
  de la aplicación o una representación claramente identificada
  como ilustrativa. NO fabricar capturas que aparenten
  funcionalidades no implementadas; si el dashboard no tiene
  suficiente desarrollo visual, usar una composición provisional
  honesta y sustituible.
- Cierre de marca: «Tecnología sofisticada explicada con
  simplicidad empresarial» y «Menos tareas. Más sistema.»

## 4. Panel derecho: formulario de acceso

- Encabezado: marca SIS, SuperInteligent System, by PENSIA,
  título «Bienvenido», texto «Iniciá sesión para acceder a tu
  sistema de agentes inteligentes».
- Campos: correo electrónico, contraseña, control
  mostrar/ocultar contraseña si es compatible con los
  componentes existentes.
- «Recordarme» SOLO si tiene un comportamiento definido y
  seguro. «¿Olvidaste tu contraseña?» SOLO si existe un flujo
  funcional de recuperación.
- Acción principal: botón destacado «Iniciar sesión», con
  estados de envío, éxito y error; sin envíos duplicados durante
  el proceso.
- «Continuar con Google» es una opción visual, NO una
  funcionalidad obligatoria: antes de implementarlo, verificar
  si existe OAuth con Google configurado. Si no existe, no
  simular el acceso ni presentarlo como operativo; omitirlo o
  dejarlo fuera de esta fase.
- «¿No tenés una cuenta? Contactanos» SOLO si el modelo de
  acceso lo justifica y el destino es real y definido; no
  inventar páginas ni rutas.
- Pie discreto de PENSIA, subordinado al formulario.

## 5. Comportamiento y seguridad

- Integrar con la autenticación real del repositorio. Antes de
  modificar código: identificar cómo funciona el inicio de
  sesión, rutas, componentes, endpoints y sesión; verificar
  flujos de registro, recuperación y cierre; determinar qué se
  reutiliza; identificar riesgos antes de intervenir.
- Conservar el mecanismo existente salvo razón técnica
  documentada. No debilitar validación, sesión ni autorización.
  No exponer secretos ni tokens. No guardar credenciales en
  texto plano. Validar en cliente y servidor según corresponda.
  Errores comprensibles sin detalles internos sensibles. No
  redirigir a zona protegida sin sesión válida. Conservar
  expiración y cierre de sesión. No agregar proveedores ni
  dependencias sin justificar.
- La autenticación es responsabilidad real del sistema, no
  simulación visual.

## 6. Responsive y accesibilidad

- Escritorio: dos paneles. Tabletas y móviles: priorizar el
  formulario; la sección de marca puede reducirse o
  simplificarse.
- System OS: etiquetas explícitas, teclado completo, foco
  visible, contraste adecuado, errores asociados a sus campos,
  estados de carga perceptibles, objetivos táctiles suficientes,
  lectores de pantalla y movimiento reducido. No depender solo
  del color para errores o estados.

## 7. Restricciones de alcance

- Solo la experiencia de inicio de sesión. NO rediseñar todo el
  dashboard, ni modificar el orquestador, ni crear agentes, ni
  funcionalidades comerciales adicionales.
- No convertir elementos ilustrativos en funciones reales sin
  verificar existencia y necesidad. No introducir datos
  ficticios como reales. No eliminar ni sustituir
  funcionalidades existentes por una maqueta estática.
- No migraciones destructivas, cambios irreversibles, merges ni
  despliegues sin autorización explícita.

## 8. Criterios de aceptación

Coherencia con referencia y System OS; identidad SIS/PENSIA
correcta; formulario conectado a la autenticación real; estados
de carga, validación y error comprensibles; enlaces y controles
visibles que funcionen realmente o se omitan; responsive y
accesible; sin regresiones en la autenticación; funcionalidades
y pruebas verificadas con evidencia, sin declarar resultados no
comprobados.

## 9. Forma de trabajo

Incremental, preservando el código útil. Si la fase de
diagnóstico sigue pendiente, completarla antes de modificar
archivos; si ya está finalizada, usar sus conclusiones. Antes de
cambios importantes, identificar archivos y explicar el enfoque.
Después de implementar, reportar: archivos modificados, cambios,
funcionalidades reutilizadas, pruebas y resultados, limitaciones
pendientes y diferencias con la referencia. No afirmar que está
terminado ni que algo funciona sin verificarlo.

## Estado real de la autenticación (para el diagnóstico previo)

Anotado al guardar el brief, a verificar contra el código antes
de implementar:

- Mecanismo actual: correo + contraseña, sesión por cookie
  httpOnly, cierre de sesión real, rate limit de login, alta por
  invitación de PENSIA (sin registro público).
- NO existe OAuth con Google: el botón «Continuar con Google»
  de la referencia NO se implementa como operativo.
- NO existe flujo de recuperación de contraseña: el enlace
  «¿Olvidaste tu contraseña?» NO se incluye.
- NO existe «Recordarme» con comportamiento definido: no se
  incluye.
- Destino real de contacto: el formulario «Quiero una demo para
  mi empresa» ya existente en la pantalla de acceso (relay por
  Apps Script, verificado). «¿No tenés una cuenta? Contactanos»
  solo tiene sentido apuntando a ese contacto existente, no a
  una página nueva.
- Elementos actuales que la nueva composición debe preservar
  (no sustituir por una maqueta): bloque «Qué hace», acceso con
  la cuenta demo visible, «Tengo una invitación» y el formulario
  de contacto.
