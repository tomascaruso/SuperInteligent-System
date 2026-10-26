# WORKFLOWS — Primer flujo de negocio: oportunidad comercial

> Nota de estado (26-oct-2026, C1): este documento describe el flujo
> objetivo. Lo implementado hoy: un solo workflow (`opportunity.intake`
> v1); estados reales de oportunidad `new`, `proposal_draft`,
> `in_follow_up` (los demás estados del diagrama son objetivo, no código);
> sin endpoint para editar borradores (solo aprobar/rechazar); sin
> expiración de aprobaciones; los 5 «agentes» de abajo son mapeos
> conceptuales sobre pasos del pipeline, no entidades implementadas. Ver
> `docs/DIAGNOSTICO-ALINEACION-PENSIA.md`.

## Workflow: `opportunity.intake` (v1)

```text
received → validated → deduped → classified → action_pending
  → approved → executed → done
  → rejected (borrador rechazado; vuelve a action_pending con nota)
  → failed (error recuperable agotado o no recuperable; con causa)
```

Estados de oportunidad (dominio): `new`, `qualified`, `nurturing`,
`proposal_draft`, `waiting_approval`, `in_follow_up`, `won`, `lost`,
`duplicate_of` (apunta al original). La clasificación asigna prioridad
(`high`/`medium`/`low`) y siguiente acción sugerida; el humano puede
corregirla y esa corrección queda auditada.

## Pasos (cada paso: id, estado, entrada, salida, coste, error)

1. **Ingest:** recibe evento (webhook firmado o alta manual). Valida esquema.
   Sin `Idempotency-Key` válido o sin firma → rechazo con 401/400, sin
   efectos. Duplicado exacto → por webhook devuelve la respuesta
   almacenada (idempotencia); por alta manual re-ejecuta y devuelve
   `duplicate: true` con una ejecución nueva (no la original).
2. **Normalize:** limpia y normaliza (correo en minúsculas, espacios
   colapsados, empresa sin espacios extra). No hay campo teléfono en el
   MVP ni capitalización del nombre.
   Entrada inválida → `failed` con causa `validation_error`, sin persistir
   oportunidad parcial.
3. **Dedup:** calcula `dedup_key`. Coincidencia → actualiza la oportunidad
   existente (sin duplicar) y registra el evento en su historial.
4. **Upsert:** crea o actualiza la oportunidad con `source`, `status=new`.
5. **Classify:** reglas explícitas (origen, tamaño declarado, urgencia en el
   texto, dominio conocido). Salida validada por esquema. IA: solo Fase 2 y
   solo si supera a las reglas en la evaluación.
6. **Next action:** determina tarea (llamar, enviar borrador, pedir datos) con
   responsable y vencimiento.
7. **Draft:** genera borrador de respuesta/propuesta (plantilla en MVP;
   generación con IA solo en Fase 2) en estado `pending_approval`.
8. **Approval:** el humano aprueba o rechaza (no hay edición de
   borradores en el MVP). Sin aprobación no hay acción externa. La
   aprobación expira (propuesta: 7 días) y queda auditada — la expiración
   es propuesta, NO implementada: hoy las aprobaciones pendientes no
   expiran.
9. **Execute (solo si aprobado y dentro de límites):** ejecuta la acción
   autorizada con su propia clave de idempotencia. En el MVP, la «ejecución»
   puede ser solo el registro de la acción a realizar fuera del sistema
   (el envío real es Fase 3, con autorización y pruebas propias).
10. **Close:** registra resultado, actualiza la oportunidad y cierra la
    ejecución con métricas (latencia, pasos, coste, intervenciones humanas).

## Agentes (solo con responsabilidad y evaluación)

- **Intake Agent:** pasos 2–3 (normalización y dedup). Determinista en MVP.
- **Qualification Agent:** paso 5 (reglas en MVP; IA evaluada en Fase 2).
- **Response & Proposal Agent:** paso 7 (plantillas en MVP).
- **Follow-up Agent:** recomienda y programa seguimientos (paso 6/9).
- **QA & Policy Agent:** revisa estructura, consistencia y políticas antes
  de la aprobación (paso 8, lado del sistema, sin poder aprobar solo).

Cada agente: entrada/salida con esquema, herramientas autorizadas, límites
de tiempo/coste, errores tipados y registro de ejecución.

## Reintentos y recuperación

- Errores transitorios (base de datos, red): reintento con backoff
  exponencial, máximo 3, solo en pasos sin efecto externo.
- Errores de validación o política: sin reintento; `failed` con causa.
- Una ejecución `failed` puede reanudarse desde el último paso exitoso
  (nunca desde cero si ya hubo efectos), con intervención humana.
- El worker outbox reprocesa eventos no confirmados; la idempotencia evita
  efectos duplicados.
