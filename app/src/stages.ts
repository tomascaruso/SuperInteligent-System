// ---------- Etapas del flujo (H1) ----------
//
// Las 5 etapas que muestra el Orquestador de Inicio son una DERIVACIÓN
// de datos reales, no un motor nuevo: se calculan desde los pasos
// persistidos de la ejecución, la oportunidad, su borrador vigente y
// su tarea abierta. Nada de lo que devuelve este módulo se guarda en
// base: es cálculo puro sobre lo que ya existe, así que es testeable
// sin base de datos.
//
// Mapeo etapa → pasos/agente (el pipeline real es opportunity.intake
// v1, 6 pasos; ver docs/WORKFLOWS.md):
//   Recepción  = normalize, dedup, upsert (agente Captación)
//   Análisis   = classify (agente Calificación)
//   Validación = chequeos deterministas de QA y políticas calculados
//                sobre la oportunidad y el borrador reales (agente
//                QA y políticas, que revisa sin tener paso propio)
//   Aprobación = estado del borrador vigente (decisión humana: sin
//                agente, se indica "Aprobación humana")
//   Resultado  = oportunidad en seguimiento tras aprobar + tarea
//                abierta (agente Seguimiento)
//
// Reglas de estado:
//   - Una etapa está hecha cuando todos sus pasos están hechos (o
//     todos sus chequeos pasan, o el borrador fue aprobado, o la
//     oportunidad está en seguimiento, según la etapa).
//   - La "etapa actual" es la primera etapa no hecha; si están todas
//     hechas, es Resultado.
//   - Si la corrida falló y ninguna etapa quedó marcada como fallida,
//     rechazada o pausada, la etapa actual se marca fallida con el
//     error de la ejecución (el fallo ocurrió en ese punto del
//     flujo, p. ej. límite diario tras normalizar y deduplicar).
//   - La validación se calcula sobre los datos ACTUALES (no sobre
//     una foto histórica): un borrador que vence después de la
//     corrida muestra la validación fallida hoy, porque hoy ya no
//     es aprobable. Se documenta en el informe H1.
//   - Los nombres técnicos de pasos nunca salen tal cual: se mapean
//     a etiquetas legibles (Normalizar, Deduplicar, Guardar,
//     Clasificar, Próxima acción, Borrador).

export type StageStatus = 'pending' | 'done' | 'failed' | 'rejected' | 'paused';

export type StageId = 'recepcion' | 'analisis' | 'validacion' | 'aprobacion' | 'resultado';

export interface PipelineStepState {
  step: string;
  label: string;
  status: 'done' | 'failed' | 'pending';
}

export interface StageCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface StageAgent {
  id: string;
  name: string;
}

export interface Stage {
  id: StageId;
  name: string;
  status: StageStatus;
  agent: StageAgent | null;
  agentLabel: string;
  detail: string;
  steps: PipelineStepState[];
  checks: StageCheck[];
}

export interface StageOpportunity {
  status: string;
  contact_name: string;
  contact_email: string;
  company: string;
  message: string;
  category: string;
  priority: string;
}

export interface StageDraft {
  status: string;
  source_message: string | null;
  created_at: string;
}

export interface DeriveStagesInput {
  steps: Array<{ step: string; status: string }>;
  runStatus: string;
  executionError: string | null;
  opportunity: StageOpportunity | null;
  draft: StageDraft | null;
  openTaskTitle: string | null;
  expiryMs: number;
  // Nombres del catálogo de agentes (C4); si no se pasan, se usan los
  // del catálogo conocido. Sirve para que los tests no dependan de la
  // base y para que un cambio de nombre en el catálogo se refleje.
  agentNames?: Partial<Record<string, string>>;
}

export interface StageDerivation {
  stages: Stage[];
  currentStageId: StageId;
}

const STEP_LABELS: Record<string, string> = {
  normalize: 'Normalizar',
  dedup: 'Deduplicar',
  classify: 'Clasificar',
  upsert: 'Guardar',
  next_action: 'Próxima acción',
  draft: 'Borrador',
  intake: 'Ingreso',
};

const DEFAULT_AGENT_NAMES: Record<string, string> = {
  intake: 'Captación',
  qualification: 'Calificación',
  qa_policy: 'QA y políticas',
  follow_up: 'Seguimiento',
};

const CATEGORIES = new Set(['marketing', 'desarrollo', 'automatización', 'consultoría', 'diseño', 'general']);
const PRIORITIES = new Set(['high', 'medium', 'low']);

function stepState(steps: Array<{ step: string; status: string }>, name: string): PipelineStepState {
  const found = steps.filter((s) => s.step === name);
  const status: PipelineStepState['status'] = found.some((s) => s.status === 'failed')
    ? 'failed'
    : found.some((s) => s.status === 'done')
      ? 'done'
      : 'pending';
  return { step: name, label: STEP_LABELS[name] ?? name, status };
}

function errorLabel(error: string | null): string {
  if (!error) return 'La corrida falló.';
  if (error.includes('limit_exceeded')) return 'La corrida falló: se alcanzó el límite diario de oportunidades.';
  return `La corrida falló: ${error}`;
}

/** Extrae el agente pausado del error de una corrida bloqueada por H1. */
function pausedAgentId(error: string | null): string | null {
  if (!error) return null;
  const match = /agent_paused:([a-z_]+)/.exec(error);
  return match ? match[1] : null;
}

export function deriveStages(input: DeriveStagesInput): StageDerivation {
  const { steps, runStatus, executionError, opportunity, draft, openTaskTitle, expiryMs } = input;
  const names = { ...DEFAULT_AGENT_NAMES, ...(input.agentNames ?? {}) };
  const agent = (id: string): StageAgent => ({ id, name: names[id] ?? id });
  const pausedId = pausedAgentId(executionError);
  const pausedName = pausedId ? (names[pausedId] ?? pausedId) : null;

  // Recepción: normalize + dedup + upsert (Captación).
  const receptionSteps = ['normalize', 'dedup', 'upsert'].map((s) => stepState(steps, s));
  let receptionStatus: StageStatus;
  let receptionDetail: string;
  if (pausedId && pausedName) {
    receptionStatus = 'paused';
    receptionDetail = `El ingreso quedó bloqueado porque el agente ${pausedName} está en pausa.`;
  } else if (receptionSteps.some((s) => s.status === 'failed')) {
    receptionStatus = 'failed';
    receptionDetail = 'Uno de los pasos de recepción falló.';
  } else if (receptionSteps.every((s) => s.status === 'done')) {
    receptionStatus = 'done';
    receptionDetail = 'La oportunidad ingresó, se deduplicó y se guardó.';
  } else {
    receptionStatus = 'pending';
    const done = receptionSteps.filter((s) => s.status === 'done').map((s) => s.label);
    receptionDetail = done.length ? `Pasos hechos: ${done.join(', ')}.` : 'Todavía no empezó la recepción.';
  }

  // Análisis: classify (Calificación).
  const classify = stepState(steps, 'classify');
  const analysisStatus: StageStatus =
    classify.status === 'failed' ? 'failed' : classify.status === 'done' ? 'done' : 'pending';
  const analysisDetail =
    analysisStatus === 'done'
      ? 'La oportunidad se clasificó por reglas: categoría y prioridad.'
      : analysisStatus === 'failed'
        ? 'La clasificación falló.'
        : 'Todavía no se clasificó la oportunidad.';

  // Validación: chequeos deterministas sobre oportunidad y borrador.
  let validationStatus: StageStatus;
  let validationDetail: string;
  let checks: StageCheck[] = [];
  if (!opportunity) {
    validationStatus = 'pending';
    validationDetail = 'Todavía no hay oportunidad para validar.';
  } else {
    const hasContact =
      opportunity.contact_name.trim() !== '' &&
      opportunity.contact_email.includes('@') &&
      opportunity.message.trim() !== '';
    checks = [
      {
        id: 'datos',
        label: 'Datos de contacto y mensaje',
        pass: hasContact,
        detail: hasContact ? 'Contacto, correo y mensaje presentes.' : 'Faltan datos de contacto o el mensaje está vacío.',
      },
      {
        id: 'borrador-existe',
        label: 'Borrador generado',
        pass: draft !== null,
        detail: draft ? 'El borrador existe.' : 'Todavía no se generó un borrador.',
      },
      {
        id: 'borrador-actual',
        label: 'Borrador actualizado',
        pass:
          draft === null
            ? false
            : draft.source_message === null || draft.source_message === opportunity.message,
        detail:
          draft === null
            ? 'Sin borrador para comparar.'
            : draft.source_message === null
              ? 'Sin foto previa para comparar (borrador anterior al registro del mensaje).'
              : draft.source_message === opportunity.message
                ? 'El mensaje no cambió desde que se creó el borrador.'
                : 'El mensaje cambió desde que se creó el borrador.',
      },
      {
        id: 'borrador-vigente',
        label: 'Borrador vigente',
        pass:
          draft === null
            ? false
            : draft.status !== 'pending_approval' || Date.now() - Date.parse(draft.created_at) <= expiryMs,
        detail:
          draft === null
            ? 'Sin borrador para verificar vigencia.'
            : draft.status !== 'pending_approval'
              ? 'El borrador ya fue decidido.'
              : Date.now() - Date.parse(draft.created_at) <= expiryMs
                ? 'Dentro de los 7 días de vigencia.'
                : 'El borrador venció (más de 7 días).',
      },
      {
        id: 'clasificacion',
        label: 'Categoría y prioridad válidas',
        pass: CATEGORIES.has(opportunity.category) && PRIORITIES.has(opportunity.priority),
        detail:
          CATEGORIES.has(opportunity.category) && PRIORITIES.has(opportunity.priority)
            ? 'Categoría y prioridad dentro de los valores del sistema.'
            : 'Categoría o prioridad fuera de los valores del sistema.',
      },
    ];
    validationStatus = checks.every((c) => c.pass) ? 'done' : 'failed';
    validationDetail =
      validationStatus === 'done'
        ? 'Todos los chequeos de QA y políticas pasaron.'
        : 'Uno o más chequeos de QA y políticas fallaron.';
  }

  // Aprobación: estado del borrador vigente (decisión humana).
  let approvalStatus: StageStatus;
  let approvalDetail: string;
  if (!draft) {
    approvalStatus = 'pending';
    approvalDetail = 'Todavía no hay borrador para aprobar.';
  } else if (draft.status === 'pending_approval') {
    approvalStatus = 'pending';
    approvalDetail = 'El borrador espera decisión humana.';
  } else if (draft.status === 'approved') {
    approvalStatus = 'done';
    approvalDetail = 'El borrador fue aprobado.';
  } else {
    approvalStatus = 'rejected';
    approvalDetail = 'El borrador fue rechazado.';
  }

  // Resultado: oportunidad en seguimiento tras aprobar + tarea abierta.
  let resultStatus: StageStatus;
  let resultDetail: string;
  if (draft?.status === 'rejected') {
    resultStatus = 'rejected';
    resultDetail = 'La propuesta fue rechazada y la oportunidad volvió a nueva.';
  } else if (opportunity?.status === 'in_follow_up') {
    resultStatus = 'done';
    resultDetail = openTaskTitle
      ? `Propuesta aprobada y tarea abierta: ${openTaskTitle}.`
      : 'Propuesta aprobada; la oportunidad está en seguimiento.';
  } else if (runStatus === 'failed') {
    resultStatus = 'failed';
    resultDetail = errorLabel(executionError);
  } else {
    resultStatus = 'pending';
    resultDetail = 'La oportunidad todavía no está en seguimiento.';
  }

  const stages: Stage[] = [
    {
      id: 'recepcion',
      name: 'Recepción',
      status: receptionStatus,
      agent: agent('intake'),
      agentLabel: names['intake'] ?? 'intake',
      detail: receptionDetail,
      steps: receptionSteps,
      checks: [],
    },
    {
      id: 'analisis',
      name: 'Análisis',
      status: analysisStatus,
      agent: agent('qualification'),
      agentLabel: names['qualification'] ?? 'qualification',
      detail: analysisDetail,
      steps: [classify],
      checks: [],
    },
    {
      id: 'validacion',
      name: 'Validación',
      status: validationStatus,
      agent: agent('qa_policy'),
      agentLabel: names['qa_policy'] ?? 'qa_policy',
      detail: validationDetail,
      steps: [],
      checks,
    },
    {
      id: 'aprobacion',
      name: 'Aprobación',
      status: approvalStatus,
      agent: null,
      agentLabel: 'Aprobación humana',
      detail: approvalDetail,
      steps: [],
      checks: [],
    },
    {
      id: 'resultado',
      name: 'Resultado',
      status: resultStatus,
      agent: agent('follow_up'),
      agentLabel: names['follow_up'] ?? 'follow_up',
      detail: resultDetail,
      steps: [],
      checks: [],
    },
  ];

  // Si la corrida falló, el punto del fallo es la primera etapa no
  // hecha entre Recepción y Aprobación (Resultado es consecuencia,
  // no punto de fallo: una corrida fallida por límite diario no debe
  // mostrar Recepción en pendiente y Resultado fallido). Si alguna
  // de esas etapas ya está marcada (fallida, rechazada o pausada),
  // ese ya es el punto y no se toca nada.
  if (runStatus === 'failed') {
    const early = stages.slice(0, 4);
    if (!early.some((s) => s.status === 'failed' || s.status === 'rejected' || s.status === 'paused')) {
      const current = early.find((s) => s.status !== 'done');
      if (current) {
        current.status = 'failed';
        current.detail = errorLabel(executionError);
      }
    }
  }

  // Etapa actual: si hay una etapa fallida, rechazada o pausada, esa
  // es el punto donde se detuvo el flujo; si no, la primera
  // pendiente; si están todas hechas, Resultado.
  const blocking = stages.find((s) => s.status === 'failed' || s.status === 'rejected' || s.status === 'paused');
  const currentStageId = (blocking ?? stages.find((s) => s.status !== 'done') ?? stages[stages.length - 1]).id;
  return { stages, currentStageId };
}
