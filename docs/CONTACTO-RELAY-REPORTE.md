# Contacto por relay (Apps Script) — informe

## Estado general

**IN_PROGRESS (en local, pendiente de subir y mergear).** El formulario
de contacto deja de enviar por SMTP y pasa a enviar por un relay HTTPS
propio en Apps Script, con el mismo patrón que el script de captación
del ebook.

## Objetivo

Que el mensaje de contacto llegue al operador. El SMTP quedó descartado
por evidencia, no por preferencia.

## Por qué no SMTP

- Prueba 1 (puerto 587): la conexión ni siquiera se establece
  (`CONNECT_TIMEOUT` / `ETIMEDOUT` en el log de Render, req-5j).
- Prueba 2 (puerto 465): también falla (confirmado por el operador).
- Los valores estaban correctos (smtp.gmail.com, puertos correctos):
  la autenticación nunca llega a ocurrir. La red gratuita de Render
  bloquea la salida SMTP. Seguir cambiando puertos no resuelve nada.

## Diseño

- **App** (`app/src/contact.ts`): `POST /api/contact` ya no discar por
  SMTP; POSTea `{ name, email, company, message, token }` por HTTPS a
  `CONTACT_RELAY_URL` con `CONTACT_RELAY_TOKEN` en el cuerpo (nunca en
  la URL). Timeout de 15 s. Las redirecciones se siguen a mano
  reenviando el POST, porque Apps Script responde al POST con una
  redirección a su dominio de contenido y un fetch automático la
  convertiría en GET y perdería el cuerpo. Apps Script siempre responde
  200 con el resultado en el cuerpo (`{ ok: true/false }`); cualquier
  otra cosa es 502.
- **Script** (`~/workspace/superinteligent-system-relay/contacto-pensia.gs`,
  fuera del repo): proyecto nuevo y separado del de captación, para no
  tocar el flujo del ebook. Corre como el operador y envía a su propia
  cuenta (`Session.getActiveUser()`): el destino no está en ningún
  código ni en el repo. Verifica el token contra una propiedad del
  script, valida largo y formato, y no guarda nada: solo envía.
- **Sin cambios para el visitante**: mismo formulario, misma validación,
  mismo límite (5/hora/IP) y honeypot, mismo fail-closed (sin relay
  configurado, el formulario no se muestra y el envío responde 503).
- **Variables nuevas en `render.yaml`**: `CONTACT_RELAY_URL` y
  `CONTACT_RELAY_TOKEN` (`sync: false`, sin valores). Las viejas
  `CONTACT_SMTP_*` ya no se leen: hay que borrarlas del dashboard.
- **Dependencias**: `nodemailer` y `@types/nodemailer` eliminados de
  `package.json` y del lockfile (nada más los usaba).

## Pasos del operador (a mano, después del merge)

1. Crear el proyecto en script.google.com y pegar
   `contacto-pensia.gs` (instrucciones completas en
   `~/workspace/superinteligent-system-relay/README.md`).
2. Guardar `CONTACT_RELAY_TOKEN` en Propiedades del script (valor
   inventado, nunca en un chat).
3. Desplegar como aplicación web: "Ejecutar como: Yo",
   "Quién tiene acceso: Cualquiera".
4. En Render, cargar `CONTACT_RELAY_URL` (la URL del despliegue) y
   `CONTACT_RELAY_TOKEN` (el mismo valor), y borrar las `CONTACT_SMTP_*`.
5. Render redespliega solo. El formulario aparece únicamente con el
   relay configurado.

## Pruebas

- Typecheck y build limpios; `node --check public/app.js` OK.
- **85/85 tests** (12 viejos de contacto reemplazados por 13 nuevos:
  configuración por URL+token, envío con token en el cuerpo, seguimiento
  de redirección reenviando el POST, rechazo de `{ ok: false }` y de
  fallo de red, endpoints con relay OK/502, y que ninguna respuesta
  exponga la URL ni el token).
- Simulación de instalación de producción (`npm ci --omit=dev` + build)
  OK, sin nodemailer.
- Smoke con servidor real: `/api/contact/status` → `{ enabled: true }`
  con relay configurado; POST a un relay inalcanzable → 502
  `send_failed` (fallo visible, sin colgarse).

## Primer reintento con relay: fallo por la redirección (26-oct-2026)

El reintento del 26-oct ~17:39 ART (20:39 UTC) volvió a fallar en
pantalla, pero esta vez la evidencia es completa y señala al código de
la app, no al script:

- Apps Script → Ejecuciones: un `doPost` de aplicación web a las
  17:39:53, 0,425 s, **Completada**. El pedido SÍ llegó al script.
- Log de Render (req-6g, 20:39:54 UTC): `SyntaxError: Unexpected
  token '<', "<!DOCTYPE "... is not valid JSON` al parsear la
  respuesta. La app recibió HTML, no el JSON del script.
- El correo NO llegó.

Diagnóstico: la app seguía las redirecciones a mano reenviando el POST
a la URL de contenido de Google, y esa URL devuelve una página HTML en
vez del JSON del doPost. El flujo correcto es el estándar del fetch
(seguir la redirección): Apps Script sirve el resultado del doPost en
el pedido siguiente, y es el mismo flujo que usa el formulario de
captación del ebook, que funciona.

Corrección (commit local pendiente de subir y mergear):

- `sendContactViaRelay` ya no sigue redirecciones a mano: usa el fetch
  con su comportamiento estándar.
- El código de error del relay se conserva en la excepción
  (`relay_failed:forbidden|invalid|failed|unknown`) para que el próximo
  log diga la causa sin adivinar: si el reintento vuelve a fallar, el
  código dirá si es token distinto, datos inválidos o fallo del script.
- Test de redirección manual reemplazado por tests del código de error.

## Pendiente (NO verificado)

El envío real de punta a punta: falta subir y mergear esta corrección,
y reintentar el mensaje de prueba ("Prueba Loki") para confirmar que
llega al correo del operador. Si el reintento da
`relay_failed:forbidden`, el token del script y el de Render no
coinciden y hay que igualarlos (sin pegarlos en ningún chat).
