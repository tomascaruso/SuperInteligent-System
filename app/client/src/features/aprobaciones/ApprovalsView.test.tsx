// @vitest-environment jsdom
// Regresión del error React #310 de la Fase A (28-oct-2026): el
// efecto de la ventana de WhatsApp quedó DESPUÉS de los retornos
// tempranos ("Cargando…"/error), así que el render con datos
// ejecutaba un hook más que el render de carga y la página de
// Aprobaciones quedaba en blanco en la demo. Este test monta la
// vista real con un borrador pendiente (el caso que rompía) y
// exige que el detalle se renderice tras la carga.
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Referencias estables: si el contexto devolviera funciones nuevas
// en cada render, el efecto de carga (que depende de ellas) entraría
// en bucle y el test colgaría.
const ctx = vi.hoisted(() => ({ setSystemStatus: () => {}, onSessionExpired: () => {} }));

vi.mock('react-router', () => ({
  useOutletContext: () => ctx,
}));

const data = vi.hoisted(() => ({
  drafts: [
    {
      id: 'draft-tomas',
      opportunity_id: 'opp-tomas',
      body: 'Hola Tomas, te proponemos…',
      source_message: 'Quiero automatizar mi negocio',
      status: 'pending_approval',
      note: null,
      decided_by: null,
      decided_at: null,
      created_at: new Date().toISOString(),
      edited: false,
      edited_at: null,
      contact_name: 'Tomas',
      company: 'Ponsia',
      opportunity_message: 'Quiero automatizar mi negocio',
      opportunity_source: 'manual',
      expired: false,
      stale: false,
      delivery: null,
    },
  ],
  opportunities: [
    {
      id: 'opp-tomas',
      contact_name: 'Tomas',
      contact_email: 'tomas@ponsia.test',
      company: 'Ponsia',
      message: 'Quiero automatizar mi negocio',
      source: 'manual',
      status: 'proposal_draft',
      category: 'automatización',
      priority: 'high',
      score: 6,
      contact_phone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  me: {
    user: { id: 'u1', name: 'Martín Demo', email: 'demo@agenciamartin.demo', role: 'admin' },
    org: { id: 'o1', name: 'Agencia Martín' },
  },
}));

vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  getDraftsDetail: vi.fn(async () => ({ drafts: data.drafts })),
  getOpportunityList: vi.fn(async () => ({ opportunities: data.opportunities })),
  getMe: vi.fn(async () => data.me),
  getConnections: vi.fn(async () => ({ connections: [] })),
  getWhatsappWindow: vi.fn(async () => ({ windowOpen: false, lastInboundAt: null })),
  retryDelivery: vi.fn(),
}));

import { ApprovalsView } from './ApprovalsView';

describe('ApprovalsView (regresión React #310)', () => {
  it('renderiza el borrador pendiente tras la carga, sin cambiar la cantidad de hooks', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ApprovalsView />);
    });
    // Vaciar las promesas de la carga (load() es async).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(container.textContent).toContain('Aprobaciones');
    expect(container.textContent).toContain('Revisión: propuesta para Tomas');
    expect(container.textContent).toContain('Ponsia');
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
