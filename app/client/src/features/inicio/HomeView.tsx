import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Link, useOutletContext } from 'react-router';
import {
  Activity,
  ArrowRight,
  Check,
  Clock,
  FileText,
  Inbox,
  ListChecks,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  UserPlus,
  X,
} from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { Table } from '../../components/ui/table';
import type { SystemStatus } from '../../components/layout/AppLayout';
import {
  ApiError,
  getAgents,
  getAudit,
  getMe,
  getOpportunities,
  getProcessDetail,
  getProcesses,
  getStats,
  setAgentPaused,
  type AgentStatus,
  type AuditEntry,
  type MeResponse,
  type OpportunitySummary,
  type ProcessDetail,
  type ProcessSummary,
  type StatsResponse,
} from '../../lib/api';
import {
  agentStatusLabel,
  auditActionLabel,
  auditEntityLabel,
  categoryLabel,
  formatDateTime,
  formatRelative,
  plural,
  priorityLabel,
  processStatusLabel,
  stageStatusLabel,
  statusLabel,
} from '../../lib/format';

// Contexto que provee AccessGate (App.tsx) a las vistas: la
// píldora de estado vive en el layout, y cada vista de la Fase 4
// la actualiza con su propia carga, como el refresh() del
// vanilla. 401 durante la carga = sesión expirada: vuelve a la
// pantalla de acceso, igual que el vanilla.
export interface HomeOutletContext {
  setSystemStatus: (status: SystemStatus) => void;
  onSessionExpired: () => void;
}

interface HomeData {
  stats: StatsResponse;
  me: MeResponse;
  processes: ProcessSummary[];
  details: Record<string, ProcessDetail>;
  agents: AgentStatus[];
  audit: AuditEntry[];
  opportunities: OpportunitySummary[];
}

// H1: vista Inicio rediseñada como el dashboard de referencia, con
// datos reales: 4 tarjetas de procesos/tareas/aprobaciones, tabla
// de Procesos en ejecución, Actividad reciente en línea de tiempo,
// Estado de los agentes (con pausa real solo para admin) y
// Orquestador con el flujo de 5 etapas de la corrida seleccionada.
// La sección "Acciones prioritarias" de la Fase 4 se eliminó por
// pedido del usuario (la vista pedida es la de la referencia; las
// tareas siguen viviendo en la vista Tareas). Todo número visible
// sale de la API real; si alguna carga falla, no se muestran datos
// con ceros falsos: se muestra el error y se puede reintentar.
// La píldora "Sistema operativo" vive en AppLayout (sin porcentaje,
// porque no existe medición de uptime): acá no se duplica.

// Nombre real del único workflow que existe hoy. Si aparece otro
// workflow, se muestra su código tal cual (sin inventar nombres).
const WORKFLOW_NAMES: Record<string, string> = {
  'opportunity.intake': 'Captación de oportunidad',
};

function workflowName(workflow: string): string {
  return WORKFLOW_NAMES[workflow] ?? workflow;
}

// Avatares de agentes: iniciales + color, nunca fotos de personas
// (los agentes son software). Las iniciales evitan colisiones entre
// Captación (CAP) y Calificación (CAL).
const AGENT_AVATAR: Record<string, { initials: string; classes: string }> = {
  intake: { initials: 'CAP', classes: 'bg-indigo-100 text-indigo-700' },
  qualification: { initials: 'CAL', classes: 'bg-sky-100 text-sky-700' },
  response_proposal: { initials: 'RES', classes: 'bg-emerald-100 text-emerald-700' },
  follow_up: { initials: 'SEG', classes: 'bg-amber-100 text-amber-800' },
  qa_policy: { initials: 'QA', classes: 'bg-violet-100 text-violet-700' },
};

function agentAvatar(agent: AgentStatus): { initials: string; classes: string } {
  return (
    AGENT_AVATAR[agent.id] ?? {
      initials: agent.name.slice(0, 2).toUpperCase(),
      classes: 'bg-slate-200 text-slate-700',
    }
  );
}

const AGENT_DOT: Record<AgentStatus['status'], string> = {
  available: 'bg-success',
  busy: 'bg-warning',
  paused: 'bg-muted',
};

const PROCESS_BADGE: Record<string, 'info' | 'success' | 'danger' | 'neutral'> = {
  running: 'info',
  done: 'success',
  failed: 'danger',
};

const STAGE_BADGE: Record<string, 'info' | 'success' | 'danger' | 'warning' | 'neutral'> = {
  pending: 'neutral',
  done: 'success',
  failed: 'danger',
  rejected: 'danger',
  paused: 'warning',
};

// Icono de la línea de tiempo por acción de auditoría (Lucide, sin
// fotos). Las acciones desconocidas usan el icono genérico.
const AUDIT_ICONS: Record<string, ComponentType<{ size?: number | string; className?: string }>> = {
  'opportunity.created': Plus,
  'opportunity.updated': RefreshCw,
  'task.created': ListChecks,
  'task.updated': Check,
  'draft.created': FileText,
  'draft.approved': Check,
  'draft.rejected': X,
  'execution.retried': RotateCcw,
  'agent.paused': Pause,
  'agent.resumed': Play,
  'user.created': UserPlus,
  'org.created': Inbox,
};

export function HomeView() {
  const { setSystemStatus, onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [pauseTarget, setPauseTarget] = useState<AgentStatus | null>(null);
  const [pauseWorking, setPauseWorking] = useState(false);
  const [pauseFeedback, setPauseFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [stats, me, { processes }, { agents }, { audit }, { opportunities }] = await Promise.all([
        getStats(),
        getMe(),
        getProcesses(),
        getAgents(),
        getAudit(),
        getOpportunities(),
      ]);
      // La etapa actual y el agente activo de cada fila vienen del
      // detalle real (con pasos, borrador y tarea); solo se cargan
      // los detalles de las filas que se muestran (máx. 8).
      const shown = processes.slice(0, 8);
      const detailList = await Promise.all(shown.map((p) => getProcessDetail(p.id)));
      const details: Record<string, ProcessDetail> = {};
      detailList.forEach((d) => {
        details[d.process.id] = d;
      });
      setData({ stats, me, processes, details, agents, audit, opportunities });
      setSystemStatus('ok');
      setState('ready');
    } catch (e: unknown) {
      // La sesión expirada no se muestra como error de la vista:
      // AccessGate vuelve a la pantalla de acceso con el mensaje.
      if (e instanceof ApiError && e.status === 401) {
        onSessionExpired();
        return;
      }
      setSystemStatus('down');
      setError(
        e instanceof ApiError ? e.message : 'No se pudo contactar al servidor. Revisá tu conexión y reintentá.',
      );
      setState('error');
    }
  }, [onSessionExpired, setSystemStatus]);

  useEffect(() => {
    // load() captura sus propios errores (incluido 401) y deja
    // el estado final en cada caso; nunca rechaza.
    void load();
  }, [load, reloadKey]);

  if (state === 'loading') {
    return <p className="text-secondary">Cargando…</p>;
  }

  if (state === 'error' || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Centro de operaciones</h1>
        <Alert variant="error">{error || 'No se pudo cargar Inicio.'}</Alert>
        <Button type="button" variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  // Actividad reciente: la auditoría completa menos los inicios de
  // sesión (que tapaban todo en el vanilla), primeros 5. El detalle
  // resuelve la oportunidad citada a su contacto, como el vanilla;
  // si no cita oportunidad, muestra categoría y prioridad cuando
  // vienen.
  const oppById = new Map(data.opportunities.map((o) => [o.id, o]));
  function auditDetail(a: AuditEntry): string {
    let detail: { opportunityId?: unknown; category?: unknown; priority?: unknown } = {};
    try {
      detail = JSON.parse(a.detail_json || '{}') as typeof detail;
    } catch {
      detail = {};
    }
    if (typeof detail.opportunityId === 'string') {
      const o = oppById.get(detail.opportunityId);
      return o ? ` · oportunidad: ${o.contact_name}${o.company ? ` (${o.company})` : ''}` : '';
    }
    const parts: string[] = [];
    if (typeof detail.category === 'string') parts.push(`categoría ${categoryLabel(detail.category)}`);
    if (typeof detail.priority === 'string') parts.push(`prioridad ${priorityLabel(detail.priority)}`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }
  const businessAudit = data.audit.filter((a) => a.action !== 'user.login').slice(0, 5);

  const shownProcesses = data.processes.slice(0, 8);
  const effectiveSelectedId = selectedId ?? shownProcesses[0]?.id ?? null;
  const selectedDetail = effectiveSelectedId ? data.details[effectiveSelectedId] : undefined;
  const selectedProcess = shownProcesses.find((p) => p.id === effectiveSelectedId);
  const isAdmin = data.me.user.role === 'admin';

  function openProcess(id: string): void {
    setSelectedId(id);
    setProcessDialogOpen(true);
  }

  function scrollToProcesses(): void {
    document.getElementById('h1-processes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function confirmPause(): Promise<void> {
    if (!pauseTarget) return;
    const next = !pauseTarget.paused;
    setPauseWorking(true);
    try {
      await setAgentPaused(pauseTarget.id, next);
      setPauseFeedback({
        kind: 'success',
        text: next
          ? `El agente ${pauseTarget.name} quedó en pausa: los ingresos nuevos quedan bloqueados hasta reanudarlo.`
          : `El agente ${pauseTarget.name} quedó reanudado: los ingresos vuelven a funcionar.`,
      });
      setPauseTarget(null);
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setPauseFeedback({
        kind: 'error',
        text:
          e instanceof ApiError
            ? e.message
            : 'No se pudo cambiar la pausa del agente. Revisá tu conexión y reintentá.',
      });
    } finally {
      setPauseWorking(false);
    }
  }

  const cardClass =
    'bg-surface border border-border rounded-card p-6 no-underline hover:border-primary text-left w-full';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Centro de operaciones</h1>
          <p className="text-secondary">Supervisa los procesos y agentes de tu organización</p>
        </div>
        <p className="text-sm text-secondary">Organización: {data.me.org.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={scrollToProcesses} className={cardClass}>
          <span className="block text-[32px] font-semibold text-ink">{data.stats.runningProcesses}</span>
          <span className="block text-sm text-secondary">Procesos activos</span>
        </button>
        <Link to="/tareas" className={cardClass}>
          <span className="block text-[32px] font-semibold text-ink">{data.stats.openTasks}</span>
          <span className="block text-sm text-secondary">Tareas pendientes</span>
        </Link>
        <Link to="/aprobaciones" className={cardClass}>
          <span className="block text-[32px] font-semibold text-ink">{data.stats.pendingDrafts}</span>
          <span className="block text-sm text-secondary">Aprobaciones pendientes</span>
        </Link>
        <button type="button" onClick={scrollToProcesses} className={cardClass}>
          <span className="block text-[32px] font-semibold text-ink">{data.stats.doneProcesses}</span>
          <span className="block text-sm text-secondary">Procesos completados</span>
        </button>
      </div>

      <Card compact pad="p-3" id="h1-processes">
        <h2 className="text-base font-semibold px-1 py-1">Procesos en ejecución</h2>
        <Table
          scrollable={false}
          textSize="text-xs"
          headers={['Proceso', 'Cliente', 'Estado', 'Agente activo', 'Etapa actual', 'Última actualización']}
          empty={shownProcesses.length === 0}
          emptyText="Todavía no hay procesos. Se crean solos cuando ingresa una oportunidad."
        >
          {shownProcesses.map((p) => {
            const detail = data.details[p.id];
            const current = detail?.stages.find((s) => s.id === detail.currentStageId);
            const isSelected = p.id === effectiveSelectedId;
            return (
              <tr
                key={p.id}
                tabIndex={0}
                onClick={() => openProcess(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openProcess(p.id);
                  }
                }}
                className={isSelected ? 'bg-primary/20 cursor-pointer' : 'cursor-pointer'}
              >
                <td className="px-1 py-1.5 break-words">
                  {workflowName(p.workflow)}{' '}
                  <span className="text-muted">#{p.id.slice(0, 8)}</span>
                </td>
                <td className="px-1 py-1.5 break-words">
                  {p.opportunity ? p.opportunity.company || p.opportunity.contact_name : '—'}
                </td>
                <td className="px-1 py-1.5 break-words">
                  <Badge variant={PROCESS_BADGE[p.status] ?? 'neutral'}>{processStatusLabel(p.status)}</Badge>
                </td>
                <td className="px-1 py-1.5 break-words">{current ? current.agentLabel : '—'}</td>
                <td className="px-1 py-1.5 break-words">{current ? current.name : '—'}</td>
                <td className="px-1 py-1.5 break-words">{formatRelative(p.updated_at)}</td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card>
          <h2 className="text-base font-semibold">Actividad reciente</h2>
          {businessAudit.length > 0 ? (
            <ol className="mt-3 space-y-4">
              {businessAudit.map((a, i) => {
                const Icon = AUDIT_ICONS[a.action] ?? Activity;
                return (
                  <li key={`${a.created_at}-${a.actor}-${a.action}-${i}`} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-muted">{formatDateTime(a.created_at)}</span>
                      <span className="block text-sm">
                        {a.actor}: {auditActionLabel(a.action)} ({auditEntityLabel(a.entity)}){auditDetail(a)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-2 text-secondary">Sin actividad comercial todavía.</p>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Estado de los agentes</h2>
          {pauseFeedback && (
            <div className="mt-2">
              <Alert variant={pauseFeedback.kind === 'success' ? 'success' : 'error'}>{pauseFeedback.text}</Alert>
            </div>
          )}
          <ul className="mt-3 space-y-4">
            {data.agents.map((a) => {
              const avatar = agentAvatar(a);
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatar.classes}`}
                  >
                    {avatar.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      <span className={`size-2 rounded-full ${AGENT_DOT[a.status]}`} />
                      <span className="text-sm text-secondary">{agentStatusLabel(a.status)}</span>
                    </span>
                    <span className="block text-sm text-secondary">{a.description}</span>
                    <span className="block text-xs text-muted">
                      {plural(a.openTasks, 'tarea abierta', 'tareas abiertas')}
                    </span>
                  </span>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPauseTarget(a)}
                      className="shrink-0"
                    >
                      {a.paused ? 'Reanudar' : 'Pausar'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Pausar un agente bloquea los ingresos nuevos (manual y webhook) hasta reanudarlo; no
            afecta a las corridas ya terminadas.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Orquestador</h2>
        {selectedDetail && selectedProcess ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-secondary">
              Proceso: {workflowName(selectedProcess.workflow)} #{selectedProcess.id.slice(0, 8)}
              {selectedDetail.opportunity
                ? ` · ${selectedDetail.opportunity.company || selectedDetail.opportunity.contact_name}`
                : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {selectedDetail.stages.map((s, i) => {
                const isCurrent = s.id === selectedDetail.currentStageId;
                return (
                  <span key={s.id} className="flex items-center gap-2">
                    {i > 0 && <ArrowRight size={16} className="text-muted" />}
                    <span
                      className={`inline-flex flex-col rounded-card border px-3 py-2 ${
                        isCurrent ? 'border-primary bg-primary-subtle' : 'border-border bg-surface'
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {s.name} · {stageStatusLabel(s.status)}
                      </span>
                      <span className="text-xs text-secondary">{s.agentLabel}</span>
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-secondary">
                Etapa actual:{' '}
                {selectedDetail.stages.find((s) => s.id === selectedDetail.currentStageId)?.name ?? '—'}
              </p>
              <Button type="button" variant="primary" onClick={() => setProcessDialogOpen(true)}>
                Ver proceso
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-secondary">Sin proceso seleccionado todavía.</p>
        )}
      </Card>

      <Dialog
        open={processDialogOpen && !!selectedDetail && !!selectedProcess}
        title={
          selectedProcess ? `Proceso: ${workflowName(selectedProcess.workflow)}` : 'Proceso'
        }
        onClose={() => setProcessDialogOpen(false)}
      >
        {selectedDetail && selectedProcess && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              Estado: {processStatusLabel(selectedProcess.status)}
              {selectedDetail.opportunity
                ? ` · ${selectedDetail.opportunity.contact_name}${selectedDetail.opportunity.company ? ` (${selectedDetail.opportunity.company})` : ''} · ${statusLabel(selectedDetail.opportunity.status)}`
                : ' · sin oportunidad vinculada'}
            </p>
            {selectedDetail.stages.map((s) => (
              <div key={s.id} className="space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant={STAGE_BADGE[s.status] ?? 'neutral'}>{stageStatusLabel(s.status)}</Badge>
                  <span className="text-sm text-secondary">{s.agentLabel}</span>
                </p>
                <p className="text-sm text-secondary">{s.detail}</p>
                {s.steps.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {s.steps.map((step) => (
                      <li key={step.step} className="flex items-center gap-2">
                        {step.status === 'done' ? (
                          <Check size={14} className="text-success" />
                        ) : step.status === 'failed' ? (
                          <X size={14} className="text-danger" />
                        ) : (
                          <Clock size={14} className="text-muted" />
                        )}
                        {step.label}
                      </li>
                    ))}
                  </ul>
                )}
                {s.checks.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {s.checks.map((c) => (
                      <li key={c.id} className="flex items-start gap-2">
                        {c.pass ? (
                          <Check size={14} className="mt-0.5 text-success" />
                        ) : (
                          <X size={14} className="mt-0.5 text-danger" />
                        )}
                        <span>
                          {c.label} — {c.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setProcessDialogOpen(false)}>
              Cerrar
            </Button>
          </div>
        )}
      </Dialog>

      <Dialog
        open={pauseTarget !== null}
        title={pauseTarget ? `${pauseTarget.paused ? 'Reanudar' : 'Pausar'} agente: ${pauseTarget.name}` : 'Agente'}
        onClose={() => {
          if (!pauseWorking) setPauseTarget(null);
        }}
      >
        {pauseTarget && (
          <div className="space-y-3">
            <p className="text-sm text-secondary">
              {pauseTarget.paused
                ? 'Al reanudar, los ingresos nuevos vuelven a funcionar de inmediato.'
                : 'Al pausar, los ingresos nuevos (manual y webhook) quedan bloqueados con un error que nombra a este agente, hasta que se reanude. Las corridas ya terminadas no se afectan.'}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="primary" disabled={pauseWorking} onClick={() => void confirmPause()}>
                {pauseTarget.paused ? 'Reanudar' : 'Pausar'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pauseWorking}
                onClick={() => setPauseTarget(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
