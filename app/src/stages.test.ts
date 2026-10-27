import { describe, expect, it } from 'vitest';
import { deriveStages, type DeriveStagesInput } from './stages.js';

// Derivación de etapas (H1): cálculo puro, sin base. Los pasos son los
// reales del pipeline opportunity.intake v1; el borrador vigente es el
// último por creación; el vencimiento se calcula con 7 días.
function base(overrides: Partial<DeriveStagesInput> = {}): DeriveStagesInput {
  return {
    steps: [
      { step: 'normalize', status: 'done' },
      { step: 'dedup', status: 'done' },
      { step: 'classify', status: 'done' },
      { step: 'upsert', status: 'done' },
      { step: 'next_action', status: 'done' },
      { step: 'draft', status: 'done' },
    ],
    runStatus: 'done',
    executionError: null,
    opportunity: {
      status: 'proposal_draft',
      contact_name: 'Ana',
      contact_email: 'ana@empresa.com',
      company: 'Empresa',
      message: 'Necesitamos automatizar el seguimiento',
      category: 'automatización',
      priority: 'medium',
    },
    draft: { status: 'pending_approval', source_message: 'Necesitamos automatizar el seguimiento', created_at: new Date().toISOString() },
    openTaskTitle: 'Enviar propuesta en 48 h',
    expiryMs: 7 * 24 * 3600_000,
    ...overrides,
  };
}

describe('etapas del flujo (H1)', () => {
  it('corrida hecha con borrador pendiente: validación hecha, aprobación pendiente, resultado pendiente', () => {
    const { stages, currentStageId } = deriveStages(base());
    expect(stages.map((s) => s.id)).toEqual(['recepcion', 'analisis', 'validacion', 'aprobacion', 'resultado']);
    expect(stages.map((s) => s.name)).toEqual(['Recepción', 'Análisis', 'Validación', 'Aprobación', 'Resultado']);
    expect(stages[0].status).toBe('done');
    expect(stages[1].status).toBe('done');
    expect(stages[2].status).toBe('done');
    expect(stages[3].status).toBe('pending');
    expect(stages[3].agent).toBeNull();
    expect(stages[3].agentLabel).toBe('Aprobación humana');
    expect(stages[4].status).toBe('pending');
    expect(currentStageId).toBe('aprobacion');
    // Las etiquetas legibles, nunca los códigos técnicos.
    expect(stages[0].steps.map((s) => s.label)).toEqual(['Normalizar', 'Deduplicar', 'Guardar']);
    expect(stages[1].steps.map((s) => s.label)).toEqual(['Clasificar']);
  });

  it('borrador aprobado + oportunidad en seguimiento: todas las etapas hechas', () => {
    const { stages, currentStageId } = deriveStages(
      base({
        draft: { status: 'approved', source_message: 'Necesitamos automatizar el seguimiento', created_at: new Date().toISOString() },
        opportunity: {
          status: 'in_follow_up',
          contact_name: 'Ana',
          contact_email: 'ana@empresa.com',
          company: 'Empresa',
          message: 'Necesitamos automatizar el seguimiento',
          category: 'automatización',
          priority: 'medium',
        },
      }),
    );
    expect(stages.every((s) => s.status === 'done')).toBe(true);
    expect(currentStageId).toBe('resultado');
    expect(stages[4].detail).toContain('Enviar propuesta en 48 h');
  });

  it('borrador rechazado: aprobación y resultado rechazados, etapa actual aprobación', () => {
    const { stages, currentStageId } = deriveStages(
      base({
        draft: { status: 'rejected', source_message: 'Necesitamos automatizar el seguimiento', created_at: new Date().toISOString() },
        opportunity: {
          status: 'new',
          contact_name: 'Ana',
          contact_email: 'ana@empresa.com',
          company: 'Empresa',
          message: 'Necesitamos automatizar el seguimiento',
          category: 'automatización',
          priority: 'medium',
        },
      }),
    );
    expect(stages[3].status).toBe('rejected');
    expect(stages[4].status).toBe('rejected');
    expect(currentStageId).toBe('aprobacion');
  });

  it('corrida fallida por límite antes del borrador: etapa actual fallida con el error traducido', () => {
    const { stages, currentStageId } = deriveStages(
      base({
        steps: [
          { step: 'normalize', status: 'done' },
          { step: 'dedup', status: 'done' },
        ],
        runStatus: 'failed',
        executionError: 'limit_exceeded',
        opportunity: null,
        draft: null,
        openTaskTitle: null,
      }),
    );
    expect(stages[0].status).toBe('failed');
    expect(stages[0].detail).toContain('límite diario');
    expect(stages[2].status).toBe('pending');
    expect(currentStageId).toBe('recepcion');
  });

  it('corrida bloqueada por pausa: recepción pausada y nombra al agente', () => {
    const { stages, currentStageId } = deriveStages(
      base({
        steps: [],
        runStatus: 'failed',
        executionError: 'El agente Seguimiento está en pausa (agent_paused:follow_up)',
        opportunity: null,
        draft: null,
        openTaskTitle: null,
      }),
    );
    expect(stages[0].status).toBe('paused');
    expect(stages[0].detail).toContain('Seguimiento');
    expect(currentStageId).toBe('recepcion');
  });

  it('validación: borrador desactualizado o vencido la hace fallar', () => {
    const stale = deriveStages(
      base({
        draft: { status: 'pending_approval', source_message: 'Mensaje viejo', created_at: new Date().toISOString() },
      }),
    );
    expect(stale.stages[2].status).toBe('failed');
    expect(stale.stages[2].checks.find((c) => c.id === 'borrador-actual')?.pass).toBe(false);

    const expired = deriveStages(
      base({
        draft: {
          status: 'pending_approval',
          source_message: 'Necesitamos automatizar el seguimiento',
          created_at: new Date(Date.now() - 8 * 24 * 3600_000).toISOString(),
        },
      }),
    );
    expect(expired.stages[2].status).toBe('failed');
    expect(expired.stages[2].checks.find((c) => c.id === 'borrador-vigente')?.pass).toBe(false);
  });

  it('validación: borrador decidido no vence aunque haya pasado el plazo', () => {
    const { stages } = deriveStages(
      base({
        draft: {
          status: 'approved',
          source_message: 'Necesitamos automatizar el seguimiento',
          created_at: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(),
        },
        opportunity: {
          status: 'in_follow_up',
          contact_name: 'Ana',
          contact_email: 'ana@empresa.com',
          company: 'Empresa',
          message: 'Necesitamos automatizar el seguimiento',
          category: 'automatización',
          priority: 'medium',
        },
      }),
    );
    expect(stages[2].checks.find((c) => c.id === 'borrador-vigente')?.pass).toBe(true);
  });
});
