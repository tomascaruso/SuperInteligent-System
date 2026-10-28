# SECURITY — Modelo de amenazas y controles

## Principios

- Autenticación y autorización siempre del lado del servidor; nunca confiar
  en el cliente.
- Aislamiento multiempresa comprobable, no asumido.
- Correos, documentos, formularios y contenido externo son DATOS no
  confiables: nunca se ejecutan como instrucciones ni superan a las políticas.
- Secretos fuera del código, fuera de los logs y fuera de los informes.
- Envíos externos solo tras aprobación humana y por canales conectados
  (F1 Gmail, F2 WhatsApp, decisión 28-oct-2026): aprobar con canal elegido
  envía el borrador aprobado a cargo del agente Respuesta y propuesta, con
  entrega única por borrador, registro en auditoría y reintento solo admin
  con tope. WhatsApp solo envía texto libre dentro de la ventana de 24
  horas de Meta; fuera de ella el envío falla como `window_closed` y no
  se reenvía por otro canal (UNIQUE(draft_id) lo impide).
  Sin canal elegido no se envía nada. Nunca hay envíos autónomos sin
  aprobación previa.

## Amenazas y controles

| Amenaza | Control |
|---|---|
| Acceso entre organizaciones (IDOR, token manipulado) | `org_id` del token en cada consulta + RLS + test de escape |
| Acción no autorizada (rol insuficiente) | Policy Engine: rol por organización, permisos por acción |
| Webhook falsificado | Firma HMAC con secreto por canal; rechazo sin firma válida; timestamp anti-replay |
| Webhook de WhatsApp falsificado (Fase A, endpoint público) | Sin JWT por necesidad (Meta no inicia sesión): verificación por token en el GET y firma HMAC-SHA256 `X-Hub-Signature-256` en el POST con el secreto de la app de Meta; firma inválida o ausente → se descarta sin guardar nada; el POST siempre responde 200 vacío (sin filtrar si algo falló); sin secretos de operador, endpoint cerrado (fail-closed); contenido de mensajes nunca en logs; dedup por `wamid` por org; enrutado solo por `phone_number_id` con conexión en la org (sin coincidencia → 200 sin guardar); ninguna respuesta automática |
| Prompt injection / contenido externo malicioso | Entradas tratadas como datos; plantillas fijas; la IA (Fase 2) nunca recibe permisos de escritura directa; salida validada por esquema |
| Agente que amplía sus permisos | Tool Registry cerrado; el planificador no modifica políticas ni su propio registro |
| Abuso de coste / bucles | Presupuesto por ejecución y por organización; tope de pasos y reintentos; alertas |
| Fuga de secretos | Variables de entorno; logs sin secretos; revisión de diff antes de commit |
| Pérdida de datos | Backups del proveedor de base de datos (a verificar al crear el proyecto); exportación de auditoría |
| Borrado destructivo | Sin borrado físico en MVP (baja lógica); borrados reales solo con autorización explícita |

## Datos

- Datos personales mínimos: nombre, correo, empresa, contenido de la
  oportunidad y teléfono opcional (F0, solo si el interesado lo deja).
  Sin contraseñas de terceros, sin datos bancarios, sin datos
  de salud. Las credenciales de conexión (tokens OAuth) viven cifradas
  (AES-256-GCM) en la base y ningún endpoint las devuelve.
- Retención: definir al inicio del piloto (propuesta: auditoría 12 meses,
  oportunidades según contrato del piloto). Eliminación a pedido del cliente
  piloto, documentada.
- El log de auditoría registra quién, qué, cuándo y con qué resultado;
  nunca cuerpos con secretos ni claves.

## Acciones que requieren autorización explícita (además de la directiva)

Merge a rama principal, despliegue a producción, gastos, creación de
cuentas/proyectos en proveedores, carga de claves reales, envíos a terceros,
cambios de permisos/roles, borrado de datos o repositorios.

## Pruebas de seguridad obligatorias (MVP)

Escape multiempresa, rol sin permiso, webhook sin firma, reintento que
duplica una acción externa (debe bloquearse), inyección de instrucciones en
el texto de una oportunidad (debe tratarse como dato). Ver `docs/TESTING.md`.
