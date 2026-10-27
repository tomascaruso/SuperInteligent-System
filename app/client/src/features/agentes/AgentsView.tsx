// R5 — Agentes (vista real, reemplaza el aviso de migración de la
// Fase 3; con esto quedan las 6 secciones reales implementadas).
// Sigue el patrón de Tareas/Aprobaciones/Actividad: tarjetas con
// iconos, filtros en una sola fila, lista de tarjetas clicables y
// panel derecho wide 480 px. La referencia de diseño es solo eso:
// diseño. Cada dato que se muestra es real o una derivación
// documentada acá y en docs/R5-AGENTES-REPORTE.md.
//
// DEFINICIONES (las mismas en tarjetas, filtros y detalle):
// - Disponibles = agentes no pausados (de los 5; la coordinación
//   no se cuenta como agente).
// - Activos = agentes con tareas abiertas (criterio H1: busy).
// - Con incidencias = agentes con pasos fallidos en los últimos
//   7 días. La atribución paso → agente sale de los steps de cada
//   agente (GET /api/agents); el paso sintético 'intake' no es de
//   ningún agente y sus fallos cuentan para la coordinación.
// - Última actividad = el más reciente entre: último paso del
//   agente, última tarea del agente y último evento de auditoría
//   sobre el agente; si no hay ninguno, «Sin actividad registrada».
// - Mini gráfico = pasos ejecutados por día, últimos 7 días (serie
//   real agregada en cliente; la coordinación usa ejecuciones por
//   día). Las tarjetas de estadísticas no llevan gráfico: no hay
//   serie diaria real para esos conteos y no se finge ninguna.
// - Orquestador Central: NO es un sexto agente. Es la coordinación
//   del flujo real (GET /api/workflows + GET /api/processes +
//   GET /api/executions). Su distintivo Master significa «coordina
//   a los demás», y no se puede pausar (esa capacidad no existe).
// - Lo que la referencia mostraba y NO existe no se finge:
//   sin salidas en PDF/xlsx/txt (la sección es «Resultados
//   recientes» con borradores, tareas y oportunidades reales),
//   sin límites por agente inventados (la sección muestra las
//   políticas globales reales de GET /api/policies),
//   sin porcentajes de progreso (no existen).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import {
  CheckCircle2,
  ClipboardList,
  Crown,
  Filter,
  Inbox,
  Network,
  PenLine,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DetailPanel } from '../../components/ui/detail-panel';
import { Dialog } from '../../components/ui/dialog';
import { FilterBar } from '../../components/ui/filter-bar';
import type { HomeOutletContext } from '../inicio/HomeView';
import {
  ApiError,
  getAgents,
  getAllTasks,
  getAudit,
  getDraftsDetail,
  getExecutionsFull,
  getExecutionSteps,
  getMe,
  getOpportunityList,
  getPolicies,
  getProcesses,
  getWorkflows,
  setAgentPaused,
  type AgentStatus,
  type AuditEntry,
  type DraftFull,
  type ExecutionFull,
  type ExecutionStep,
  type OpportunityDetail,
  type PolicyEntry,
  type ProcessSummary,
  type TaskFull,
  type WorkflowDef,
} from '../../lib/api';
import {
  auditActionLabel,
  categoryLabel,
  draftStatusLabel,
  formatDate,
  formatDateTime,
  formatRelative,
  localDate,
  priorityLabel,
} from '../../lib/format';

// Etiquetas de presentación para los pasos reales del pipeline
// (misma traducción que Actividad: el nombre guardado es inglés).
function stepLabel(step: string): string {
  return (
    {
      normalize: 'Normalización',
      dedup: 'Control de duplicados',
      classify: 'Clasificación',
      upsert: 'Registro',
      next_action: 'Próximo paso',
      draft: 'Borrador',
      intake: 'Ingreso',
    }[step] ?? step
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;

// Icono + pastilla tintada por agente (mismo patrón que las
// tarjetas de Tareas: pastilla de color, icono Lucide).
function agentIcon(id: string): { icon: typeof Inbox; pill: string } {
  switch (id) {
    case 'orchestrator':
      return { icon: Network, pill: 'bg-indigo-100 text-indigo-800' };
    case 'intake':
      return { icon: Inbox, pill: 'bg-indigo-100 text-indigo-800' };
    case 'qualification':
      return { icon: Filter, pill: 'bg-sky-100 text-sky-800' };
    case 'response_proposal':
      return { icon: PenLine, pill: 'bg-violet-100 text-violet-800' };
    case 'follow_up':
      return { icon: ClipboardList, pill: 'bg-amber-100 text-amber-800' };
    case 'qa_policy':
      return { icon: ShieldCheck, pill: 'bg-emerald-100 text-emerald-800' };
    default:
      return { icon: Inbox, pill: 'bg-slate-100 text-slate-700' };
  }
}

function statusBadge(
  s: 'available' | 'busy' | 'paused' | 'active' | 'idle',
): { variant: 'success' | 'warning' | 'neutral' | 'info'; label: string } {
  switch (s) {
    case 'busy':
    case 'active':
      return { variant: 'success', label: 'Activo' };
    case 'paused':
      return { variant: 'warning', label: 'En pausa' };
    case 'idle':
      return { variant: 'neutral', label: 'Sin actividad reciente' };
    default:
      return { variant: 'neutral', label: 'Disponible' };
  }
}

// Mini gráfico SVG puro (sin librería): serie diaria real de 7
// valores. Sin datos inventados: si todo es cero, la línea queda
// plana en la base, que es lo que los datos dicen.
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 96;
  const h = 28;
  const max = Math.max(...values, 1);
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <span className="block" role="img" aria-label={label}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-primary" aria-hidden="true">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

interface AgentsData {
  agents: AgentStatus[];
  workflows: WorkflowDef[];
  policies: PolicyEntry[];
  tasks: TaskFull[];
  drafts: DraftFull[];
  opportunities: OpportunityDetail[];
  executions: ExecutionFull[];
  processes: ProcessSummary[];
  audit: AuditEntry[];
  isAdmin: boolean;
  // Pasos de las ejecuciones de los últimos 7 días, con su ejecución.
  recentSteps: { execution: ExecutionFull; steps: ExecutionStep[] }[];
}

type Entry = {
  kind: 'orchestrator' | 'agent';
  id: string;
  name: string;
  functionLabel: string;
  description: string;
  steps: string[];
  paused: boolean;
  openTasks: number;
  // Estado base H1 (available/busy/paused) o, para la coordinación,
  // active/idle según haya ejecuciones en los últimos 7 días.
  statusKey: 'available' | 'busy' | 'paused' | 'active' | 'idle';
  incidents: number;
  lastActivity: string | null;
  spark: number[];
};

function last7DayKeys(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    out.push(localDate(new Date(now.getTime() - i * DAY_MS).toISOString()));
  }
  return out;
}

export function AgentsView() {
  const { onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AgentsData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [functionFilter, setFunctionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pauseTarget, setPauseTarget] = useState<Entry | null>(null);
  const [pauseWorking, setPauseWorking] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [viewFeedback, setViewFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError(null);
    (async () => {
      try {
        const [agentsRes, workflowsRes, policiesRes, tasksRes, draftsRes, oppsRes, execsRes, procsRes, auditRes, meRes] =
          await Promise.all([
            getAgents(),
            getWorkflows(),
            getPolicies(),
            getAllTasks(),
            getDraftsDetail(),
            getOpportunityList(),
            getExecutionsFull(),
            getProcesses(),
            getAudit(),
            getMe(),
          ]);
        const now = Date.now();
        const recentExecutions = execsRes.executions.filter(
          (e) => now - new Date(e.created_at).getTime() <= SEVEN_DAYS_MS,
        );
        // Pasos solo de ejecuciones recientes (la API lista 100 como
        // máximo; en la práctica son pocas). Un fallo al traer los
        // pasos de una ejecución deja esa ejecución sin pasos, no
        // tumba la vista.
        const recentSteps = await Promise.all(
          recentExecutions.map(async (e) => {
            try {
              const r = await getExecutionSteps(e.id);
              return { execution: e, steps: r.steps };
            } catch {
              return { execution: e, steps: [] as ExecutionStep[] };
            }
          }),
        );
        if (!cancelled) {
          setData({
            agents: agentsRes.agents,
            workflows: workflowsRes.workflows,
            policies: policiesRes.policies,
            tasks: tasksRes.tasks,
            drafts: draftsRes.drafts,
            opportunities: oppsRes.opportunities,
            executions: execsRes.executions,
            processes: procsRes.processes,
            audit: auditRes.audit,
            isAdmin: meRes.user.role === 'admin',
            recentSteps,
          });
          setState('ready');
        }
      } catch (e: unknown) {
        if (e instanceof ApiError && e.status === 401) {
          onSessionExpired();
          return;
        }
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'No se pudo cargar Agentes.');
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, onSessionExpired]);

  const entries: Entry[] = useMemo(() => {
    if (!data) return [];
    const dayKeys = last7DayKeys();
    // Paso → agente dueño, desde los steps reales de cada agente.
    const stepOwner = new Map<string, string>();
    for (const a of data.agents) {
      for (const s of a.steps) stepOwner.set(s, a.id);
    }
    const stepsByAgent = new Map<string, ExecutionStep[]>();
    const failedByAgent = new Map<string, number>();
    let orchFailedExecutions = 0;
    const orchSpark = new Array<number>(7).fill(0);
    for (const { execution, steps } of data.recentSteps) {
      const dayIdx = dayKeys.indexOf(localDate(execution.created_at));
      if (dayIdx >= 0) orchSpark[dayIdx] += 1;
      if (execution.status === 'failed') orchFailedExecutions += 1;
      for (const s of steps) {
        const owner = stepOwner.get(s.step);
        if (!owner) continue; // 'intake': no es de ningún agente.
        const list = stepsByAgent.get(owner) ?? [];
        list.push(s);
        stepsByAgent.set(owner, list);
        if (s.status === 'failed') failedByAgent.set(owner, (failedByAgent.get(owner) ?? 0) + 1);
      }
    }
    const tasksByAgent = new Map<string, TaskFull[]>();
    for (const t of data.tasks) {
      const list = tasksByAgent.get(t.agent_id) ?? [];
      list.push(t);
      tasksByAgent.set(t.agent_id, list);
    }
    const auditByAgent = new Map<string, AuditEntry[]>();
    for (const a of data.audit) {
      if (a.entity !== 'agent') continue;
      const list = auditByAgent.get(a.entity_id) ?? [];
      list.push(a);
      auditByAgent.set(a.entity_id, list);
    }

    const agentEntries: Entry[] = data.agents.map((a) => {
      const steps = stepsByAgent.get(a.id) ?? [];
      const spark = dayKeys.map((d) => steps.filter((s) => localDate(s.created_at) === d).length);
      const candidates = [
        ...steps.map((s) => s.created_at),
        ...(tasksByAgent.get(a.id) ?? []).flatMap((t) => [t.created_at, t.updated_at]),
        ...(auditByAgent.get(a.id) ?? []).map((e) => e.created_at),
      ];
      const last = candidates.length > 0 ? candidates.sort().at(-1)! : null;
      return {
        kind: 'agent',
        id: a.id,
        name: a.name,
        functionLabel: a.name,
        description: a.description,
        steps: a.steps,
        paused: a.paused,
        openTasks: a.openTasks,
        statusKey: a.paused ? 'paused' : a.openTasks > 0 ? 'busy' : 'available',
        incidents: failedByAgent.get(a.id) ?? 0,
        lastActivity: last,
        spark,
      };
    });

    const flow = data.workflows.find((w) => w.workflow === 'opportunity.intake') ?? data.workflows[0];
    const runningProcesses = data.processes.filter((p) => p.status === 'running');
    const recentExecutions = data.recentSteps.map((r) => r.execution);
    const lastExec = data.executions.length > 0 ? data.executions[0].created_at : null;
    const orchestrator: Entry = {
      kind: 'orchestrator',
      id: 'orchestrator',
      name: 'Orquestador Central',
      functionLabel: 'Orquestación',
      // Texto descriptivo (no es un campo del sistema: la
      // coordinación no tiene descripción almacenada).
      description:
        'Coordina el flujo Captación de oportunidad de principio a fin: recibe cada oportunidad y la pasa por Captación, Calificación, Seguimiento y Respuesta y propuesta, con revisión de QA y políticas antes de la aprobación humana.',
      steps: flow ? flow.steps : [],
      paused: false,
      openTasks: runningProcesses.length,
      statusKey: recentExecutions.length > 0 ? 'active' : 'idle',
      incidents: orchFailedExecutions,
      lastActivity: lastExec,
      spark: orchSpark,
    };
    return [orchestrator, ...agentEntries];
  }, [data]);

  const counts = useMemo(() => {
    if (!data) return { available: 0, busy: 0, incidents: 0 };
    const agents = entries.filter((e) => e.kind === 'agent');
    return {
      available: agents.filter((e) => !e.paused).length,
      busy: agents.filter((e) => e.openTasks > 0).length,
      incidents: agents.filter((e) => e.incidents > 0).length,
    };
  }, [data, entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (functionFilter !== 'all' && e.id !== functionFilter) return false;
      if (statusFilter === 'available' && e.paused) return false;
      if (statusFilter === 'busy' && e.openTasks === 0) return false;
      if (statusFilter === 'incidents' && e.incidents === 0) return false;
      if (statusFilter === 'paused' && !e.paused) return false;
      if (q && !`${e.name} ${e.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, functionFilter, statusFilter, search]);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setFunctionFilter('all');
    setStatusFilter('all');
  }, []);

  const confirmPause = useCallback(async () => {
    if (!pauseTarget || pauseTarget.kind !== 'agent') return;
    setPauseWorking(true);
    setPauseError(null);
    try {
      await setAgentPaused(pauseTarget.id, !pauseTarget.paused);
      setPauseTarget(null);
      setViewFeedback(pauseTarget.paused ? 'Agente reanudado.' : 'Agente pausado.');
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setPauseError(e instanceof ApiError ? e.message : 'No se pudo cambiar la pausa del agente.');
    } finally {
      setPauseWorking(false);
    }
  }, [pauseTarget]);

  if (state === 'loading') {
    return <p className="text-ink">Cargando…</p>;
  }

  if (state === 'error' || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Agentes</h1>
        <Alert variant="error">{error || 'No se pudo cargar Agentes.'}</Alert>
        <Button type="button" variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  const cardClass = 'bg-surface border border-border rounded-card p-6 text-left w-full hover:border-primary';
  const statValue = 'block text-[32px] font-semibold text-ink';
  const statLabel = 'block text-sm text-secondary';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Agentes</h1>
        <p className="text-sm text-secondary">Supervisa las capacidades y la actividad de tus agentes especializados</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button type="button" className={cardClass} onClick={() => setStatusFilter('available')}>
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-indigo-100 text-indigo-800" aria-hidden="true">
              <Network size={20} />
            </span>
            <span>
              <span className={statValue}>{counts.available}</span>
              <span className={statLabel}>Agentes disponibles</span>
            </span>
          </span>
        </button>
        <button type="button" className={cardClass} onClick={() => setStatusFilter('busy')}>
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-emerald-100 text-emerald-700" aria-hidden="true">
              <CheckCircle2 size={20} />
            </span>
            <span>
              <span className={statValue}>{counts.busy}</span>
              <span className={statLabel}>Activos</span>
            </span>
          </span>
        </button>
        <button type="button" className={cardClass} onClick={() => setStatusFilter('incidents')}>
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-red-100 text-red-700" aria-hidden="true">
              <XCircle size={20} />
            </span>
            <span>
              <span className={statValue}>{counts.incidents}</span>
              <span className={statLabel}>Con incidencias</span>
            </span>
          </span>
        </button>
      </div>
      <p className="text-xs text-muted">
        Los conteos cubren los 5 agentes (Disponibles = no pausados, Activos = con tareas abiertas,
        Con incidencias = con pasos fallidos en los últimos 7 días). La coordinación no se cuenta
        como agente. Las tarjetas no llevan gráfico: no hay serie diaria real para estos conteos.
      </p>

      <Card compact pad="p-3">
        <FilterBar
          layout="single"
          searchValue={search}
          onSearchChange={(v) => setSearch(v)}
          searchPlaceholder="Buscar agente…"
          selects={[
            {
              id: 'filter-funcion',
              label: 'Función',
              value: functionFilter,
              options: [
                { value: 'all', label: 'Todas' },
                { value: 'orchestrator', label: 'Orquestación' },
                ...data.agents.map((a) => ({ value: a.id, label: a.name })),
              ],
              onChange: (v) => setFunctionFilter(v),
            },
            {
              id: 'filter-estado',
              label: 'Estado',
              value: statusFilter,
              options: [
                { value: 'all', label: 'Todos' },
                { value: 'available', label: 'Disponible' },
                { value: 'busy', label: 'Activo' },
                { value: 'incidents', label: 'Con incidencias' },
                { value: 'paused', label: 'En pausa' },
              ],
              onChange: (v) => setStatusFilter(v),
            },
          ]}
        />
        {(search || functionFilter !== 'all' || statusFilter !== 'all') && (
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
          </div>
        )}
      </Card>

      {viewFeedback && <Alert variant="success">{viewFeedback}</Alert>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] items-start">
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-sm text-secondary">Sin resultados para los filtros actuales.</p>
          )}
          {filtered.map((e) => {
            const { icon: Icon, pill } = agentIcon(e.id);
            const badge = statusBadge(e.statusKey);
            const isSelected = e.id === selectedId;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => openDetail(e.id)}
                className={`w-full text-left bg-surface border rounded-card p-4 hover:border-primary ${isSelected ? 'border-primary' : 'border-border'}`}
              >
                <span className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control ${pill}`} aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{e.name}</span>
                      {e.kind === 'orchestrator' && (
                        <Badge variant="info" compact>
                          <span className="inline-flex items-center gap-1">
                            <Crown size={12} aria-hidden="true" /> Master
                          </span>
                        </Badge>
                      )}
                      <Badge variant={badge.variant} compact>
                        {badge.label}
                      </Badge>
                      {e.incidents > 0 && (
                        <Badge variant="danger" compact>
                          {e.incidents} {e.incidents === 1 ? 'incidencia' : 'incidencias'}
                        </Badge>
                      )}
                    </span>
                    <span className="block text-sm text-secondary">{e.functionLabel}</span>
                    <span className="mt-1 block text-sm">
                      {e.kind === 'orchestrator'
                        ? `Procesos en curso: ${e.openTasks}`
                        : `Tareas abiertas: ${e.openTasks}`}
                      {' · '}
                      {e.lastActivity ? formatRelative(e.lastActivity) : 'Sin actividad registrada'}
                    </span>
                    <span className="mt-2 block">
                      <Sparkline
                        values={e.spark}
                        label={
                          e.kind === 'orchestrator'
                            ? 'Ejecuciones por día, últimos 7 días'
                            : 'Pasos ejecutados por día, últimos 7 días'
                        }
                      />
                      <span className="text-xs text-muted">
                        {e.kind === 'orchestrator'
                          ? 'Ejecuciones por día, últimos 7 días'
                          : 'Pasos ejecutados por día, últimos 7 días'}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {selected && <AgentDetail entry={selected} data={data} onPause={setPauseTarget} />}
      </div>

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
            {pauseError && <Alert variant="error">{pauseError}</Alert>}
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

// Panel de detalle del agente seleccionado (variante wide 480 px,
// igual que Revisión en Aprobaciones). Las secciones se separan
// con la misma regla visual que la corrección de Actividad: borde
// superior en el token de borde + aire, para que se distinga qué
// pertenece a qué.
function AgentDetail({
  entry,
  data,
  onPause,
}: {
  entry: Entry;
  data: AgentsData;
  onPause: (e: Entry) => void;
}) {
  const detail = useMemo(() => {
    const stepOwner = new Map<string, string>();
    for (const a of data.agents) {
      for (const s of a.steps) stepOwner.set(s, a.id);
    }
    const mySteps = data.recentSteps
      .flatMap((r) => r.steps.map((s) => ({ ...s, executionId: r.execution.id })))
      .filter((s) => stepOwner.get(s.step) === entry.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const myAudit = data.audit
      .filter((e) => e.entity === 'agent' && e.entity_id === entry.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const myOpenTasks = data.tasks
      .filter((t) => t.agent_id === entry.id && t.status === 'open')
      .sort((a, b) => (a.due_at < b.due_at ? -1 : 1));
    const oppsById = new Map(data.opportunities.map((o) => [o.id, o]));
    const sortedOpps = [...data.opportunities].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const sortedDrafts = [...data.drafts].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const sortedTasks = [...data.tasks].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const runningProcesses = data.processes.filter((p) => p.status === 'running');
    const procByExecution = new Map(
      data.processes.filter((p) => p.execution).map((p) => [p.execution!.id, p]),
    );
    return { mySteps, myAudit, myOpenTasks, oppsById, sortedOpps, sortedDrafts, sortedTasks, runningProcesses, procByExecution };
  }, [entry, data]);

  const badge = statusBadge(entry.statusKey);
  // Fallback honesto: si el registry no trae el flujo, «—» (no se
  // inventa el nombre).
  const flowName =
    data.workflows.find((w) => w.workflow === 'opportunity.intake')?.name ?? '—';
  const oppLabel = (o: { contact_name: string | null; company: string | null } | undefined) =>
    o ? [o.contact_name, o.company].filter(Boolean).join(' · ') || '—' : '—';

  // Resultados recientes: atribución honesta por agente (ver el
  // encabezado del archivo). QA no genera salidas propias.
  let results: { title: string; sub: string }[] = [];
  let resultsEmpty: string | null = null;
  if (entry.id === 'orchestrator') {
    results = [...data.executions]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 3)
      .map((e) => ({
        title: `Proceso ${e.status === 'done' ? 'completado' : e.status === 'failed' ? 'fallido' : 'en curso'}: ${oppLabel(detail.procByExecution.get(e.id)?.opportunity)}`,
        sub: formatDateTime(e.created_at),
      }));
  } else if (entry.id === 'intake') {
    results = detail.sortedOpps.slice(0, 3).map((o) => ({
      title: `Oportunidad registrada: ${[o.contact_name, o.company].filter(Boolean).join(' · ')}`,
      sub: formatDateTime(o.created_at),
    }));
  } else if (entry.id === 'qualification') {
    results = detail.sortedOpps.slice(0, 3).map((o) => ({
      title: `Clasificada: ${o.contact_name} · ${categoryLabel(o.category)}, prioridad ${priorityLabel(o.priority)} (puntaje ${o.score})`,
      sub: formatDateTime(o.created_at),
    }));
  } else if (entry.id === 'response_proposal') {
    results = detail.sortedDrafts.slice(0, 3).map((d) => {
      const o = detail.oppsById.get(d.opportunity_id);
      return {
        title: `Borrador para ${o ? o.contact_name : '—'} · ${draftStatusLabel(d.status)}`,
        sub: formatDateTime(d.created_at),
      };
    });
  } else if (entry.id === 'follow_up') {
    results = detail.sortedTasks
      .filter((t) => t.agent_id === entry.id)
      .slice(0, 3)
      .map((t) => ({
        title: `Tarea: ${t.title} · ${t.contact_name}`,
        sub: `${t.status === 'done' ? 'Completada' : 'Pendiente'} · ${formatDateTime(t.created_at)}`,
      }));
  } else {
    resultsEmpty =
      'QA y políticas no genera salidas propias: revisa estructura, consistencia y políticas antes de la aprobación humana, sin dejar un paso propio en el pipeline.';
  }

  const sectionClass = 'mt-6 border-t border-border pt-5';

  return (
    <DetailPanel
      variant="inline"
      wide
      title={`Detalle del agente: ${entry.name}`}
      subtitle={`${entry.functionLabel} · ${badge.label}`}
    >
      <div>
        <div className="flex flex-wrap gap-2">
          {entry.kind === 'orchestrator' && (
            <Badge variant="info" compact>
              <span className="inline-flex items-center gap-1">
                <Crown size={12} aria-hidden="true" /> Master
              </span>
            </Badge>
          )}
          <Badge variant={badge.variant} compact>
            {badge.label}
          </Badge>
          {entry.incidents > 0 && (
            <Badge variant="danger" compact>
              {entry.incidents} {entry.incidents === 1 ? 'incidencia' : 'incidencias'} en los últimos 7 días
            </Badge>
          )}
        </div>
        <h3 className="mt-4 text-sm font-semibold">Objetivo</h3>
        <p className="mt-1 text-sm text-secondary">{entry.description}</p>
        {entry.kind === 'orchestrator' && (
          <p className="mt-1 text-xs text-muted">
            Master significa que coordina a los demás agentes; no es un agente más y no se puede
            pausar.
          </p>
        )}
      </div>

      <div className={sectionClass}>
        <h3 className="text-sm font-semibold">Capacidades</h3>
        {entry.steps.length === 0 ? (
          <p className="mt-1 text-sm text-secondary">
            Sin pasos propios en el pipeline actual: revisa estructura, consistencia y políticas
            antes de la aprobación humana.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {entry.steps.map((s) => (
              <li key={s}>{stepLabel(s)}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={sectionClass}>
        <h3 className="text-sm font-semibold">Capacidades y Herramientas Autorizadas</h3>
        <p className="mt-1 text-sm text-secondary">
          El sistema no usa herramientas externas: las herramientas reales son los pasos del
          pipeline, cada uno de un agente.
        </p>
        {entry.steps.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {entry.steps.map((s) => (
              <li key={s}>{stepLabel(s)}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={sectionClass}>
        <h3 className="text-sm font-semibold">Logs de Ejecución</h3>
        {entry.kind === 'orchestrator' ? (
          <>
            {[...data.executions]
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
              .slice(0, 5)
              .map((e) => (
                <p key={e.id} className="mt-2 text-sm">
                  {formatDateTime(e.created_at)} — Ejecución {flowName} ·{' '}
                  {e.status === 'done' ? 'Completada' : e.status === 'failed' ? 'Fallida' : 'En curso'}
                </p>
              ))}
            {data.executions.length === 0 && (
              <p className="mt-1 text-sm text-secondary">Sin ejecuciones registradas.</p>
            )}
          </>
        ) : (
          <>
            {detail.mySteps.slice(0, 5).map((s) => (
              <p key={s.id} className="mt-2 text-sm">
                {formatDateTime(s.created_at)} — {stepLabel(s.step)} ·{' '}
                {s.status === 'done' ? 'Completado' : s.status === 'failed' ? 'Fallido' : 'En curso'}
                {s.status === 'failed' && s.error ? ` · ${s.error}` : ''}
              </p>
            ))}
            {detail.myAudit.slice(0, 3).map((e) => (
              <p key={e.id} className="mt-2 text-sm">
                {formatDateTime(e.created_at)} — {auditActionLabel(e.action)}
              </p>
            ))}
            {detail.mySteps.length === 0 && detail.myAudit.length === 0 && (
              <p className="mt-1 text-sm text-secondary">Sin registros recientes para este agente.</p>
            )}
          </>
        )}
      </div>

      <div className={sectionClass}>
        <h3 className="text-sm font-semibold">Procesos Activos</h3>
        {entry.kind === 'orchestrator' ? (
          <>
            {detail.runningProcesses.length === 0 && (
              <p className="mt-1 text-sm text-secondary">Sin procesos en curso.</p>
            )}
            {detail.runningProcesses.map((p) => (
              <p key={p.id} className="mt-2 text-sm">
                {oppLabel(p.opportunity)} · {flowName} · Iniciado {formatDateTime(p.created_at)}
              </p>
            ))}
          </>
        ) : (
          <>
            {detail.myOpenTasks.length === 0 && (
              <p className="mt-1 text-sm text-secondary">Sin tareas abiertas para este agente.</p>
            )}
            {detail.myOpenTasks.map((t) => (
              <p key={t.id} className="mt-2 text-sm">
                {t.title} · {t.contact_name} · Vence {formatDate(t.due_at)}
              </p>
            ))}
          </>
        )}
      </div>

      <div className={sectionClass}>
        <h3 className="text-sm font-semibold">Permisos y Límites</h3>
        <p className="mt-1 text-xs text-muted">
          Políticas del sistema (aplican a todos los agentes; no hay límites por agente).
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {data.policies.map((p) => (
            <li key={p.key}>
              {p.description} —{' '}
              {p.value === 'true' ? 'Sí' : p.value === 'false' ? 'No' : p.value}
            </li>
          ))}
        </ul>
      </div>

      <div className={sectionClass}>
        <h3 className="text-sm font-semibold">Resultados recientes</h3>
        {resultsEmpty ? (
          <p className="mt-1 text-sm text-secondary">{resultsEmpty}</p>
        ) : results.length === 0 ? (
          <p className="mt-1 text-sm text-secondary">Sin resultados recientes.</p>
        ) : (
          results.map((r, i) => (
            <p key={i} className="mt-2 text-sm">
              {r.title}
              <span className="block text-xs text-secondary">{r.sub}</span>
            </p>
          ))
        )}
        <p className="mt-2 text-xs text-muted">
          El sistema no genera archivos de salida (sin PDF, planillas ni informes descargables):
          los resultados reales son borradores, tareas y oportunidades.
        </p>
      </div>

      {entry.kind === 'agent' && (
        <div className={sectionClass}>
          {data.isAdmin ? (
            <Button type="button" variant="secondary" onClick={() => onPause(entry)}>
              {entry.paused ? 'Reanudar agente' : 'Pausar agente'}
            </Button>
          ) : (
            <p className="text-sm text-secondary">Solo un admin puede pausar o reanudar agentes.</p>
          )}
        </div>
      )}
      {entry.kind === 'orchestrator' && (
        <div className={sectionClass}>
          <p className="text-sm text-secondary">
            La coordinación no se pausa: la pausa es por agente, desde su tarjeta o su detalle.
          </p>
        </div>
      )}
    </DetailPanel>
  );
}
