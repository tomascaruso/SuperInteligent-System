import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DetailPanel } from '../../components/ui/detail-panel';
import { Dialog } from '../../components/ui/dialog';
import { FilterBar } from '../../components/ui/filter-bar';
import { Pagination } from '../../components/ui/pagination';
import { Table } from '../../components/ui/table';
import type { HomeOutletContext } from '../inicio/HomeView';
import {
  ApiError,
  getAgents,
  getAudit,
  getExecutionsFull,
  getExecutionSteps,
  getMe,
  getOpportunities,
  getOpportunityAudit,
  getPolicies,
  getProcesses,
  getWorkflows,
  retryExecution,
  type AgentStatus,
  type AuditEntry,
  type ExecutionFull,
  type ExecutionStep,
  type OpportunityDetail,
  type ProcessSummary,
  type WorkflowDef,
} from '../../lib/api';
import { auditActionLabel, formatDateTime, localDate } from '../../lib/format';

// R4 — Actividad y ejecuciones (vista real, reemplaza el aviso de
// migración de la Fase 3). Sigue el patrón de Tareas/Aprobaciones:
// filtros en una sola fila, paginación en cliente, tabla 12 px,
// panel derecho fijo wide (480 px, igual que Revisión), filas
// clicables con teclado. Todo sale de endpoints reales
// (ejecuciones, pasos, agentes, workflows, procesos, oportunidades,
// auditoría, políticas); nada se inventa (ver
// docs/R4-ACTIVIDAD-REPORTE.md para el mapeo referencia → real y
// todo lo omitido).

const PAGE_SIZE = 20;

function shortId(id: string): string {
  return id.slice(0, 8);
}

function statusBadge(s: string): { variant: 'success' | 'danger' | 'info' | 'neutral'; label: string } {
  if (s === 'done') return { variant: 'success', label: 'Completada' };
  if (s === 'failed') return { variant: 'danger', label: 'Fallida' };
  if (s === 'running') return { variant: 'info', label: 'Activa' };
  return { variant: 'neutral', label: s };
}

// Duración real: updated_at − created_at, solo para ejecuciones
// terminadas (el servidor no guarda duración; para running no es
// fiable). Formato como la referencia: "2m 15s".
function durationMs(e: ExecutionFull): number | null {
  if (e.status === 'running') return null;
  const ms = new Date(e.updated_at).getTime() - new Date(e.created_at).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return ms;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'En curso';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

// Etiquetas de presentación para los pasos reales del pipeline
// (traducción, no datos nuevos: el nombre guardado es el inglés).
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

function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

// Máscara de presentación (decisión de la referencia, no dato
// nuevo): solo se enmascaran los valores de los campos personales
// de la entrada (nombre, correo, empresa, mensaje). El resto de
// las claves se muestra tal cual. El servidor guarda el texto
// completo; la máscara vive solo en esta vista.
function maskName(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w.slice(0, 1)}***`)
    .join(' ');
}

function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at <= 0) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

function maskJsonValue(key: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => maskJsonValue(key, v));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = maskJsonValue(k, v);
    return out;
  }
  if (typeof value !== 'string') return value;
  if (key === 'contactEmail') return maskEmail(value);
  if (key === 'contactName' || key === 'company') return maskName(value);
  if (key === 'message') return value.length > 15 ? `${value.slice(0, 15)}… (enmascarado)` : '*** (enmascarado)';
  return value;
}

function maskJson(text: string | null): string {
  const parsed = parseJson(text);
  if (parsed === null) return '—';
  return JSON.stringify(maskJsonValue('', parsed), null, 2);
}

interface ActivityData {
  executions: ExecutionFull[];
  agents: AgentStatus[];
  processes: ProcessSummary[];
  opportunities: OpportunityDetail[];
  workflows: WorkflowDef[];
  isAdmin: boolean;
  maxAttempts: number;
}

export function ActivityView() {
  const { setSystemStatus, onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<ActivityData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('7d');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [stepsByExec, setStepsByExec] = useState<Record<string, ExecutionStep[]>>({});
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState('');
  const [auditByOpp, setAuditByOpp] = useState<Record<string, AuditEntry[]>>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditAll, setAuditAll] = useState<AuditEntry[] | null>(null);

  const [retryOpen, setRetryOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [viewFeedback, setViewFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [{ executions }, { agents }, { processes }, { opportunities }, { workflows }, { policies }, me] =
        await Promise.all([
          getExecutionsFull(),
          getAgents(),
          getProcesses(),
          getOpportunities(),
          getWorkflows(),
          getPolicies(),
          getMe(),
        ]);
      // Tope de reintentos real (C6); si la política falta, el
      // servidor usa 3 y la vista refleja ese mismo default.
      const maxRaw = Number(policies.find((p) => p.key === 'retry.max_attempts')?.value ?? 3);
      const maxAttempts = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : 3;
      setData({
        executions,
        agents,
        processes,
        opportunities,
        workflows,
        isAdmin: me.user.role === 'admin',
        maxAttempts,
      });
      setSystemStatus('ok');
      setState('ready');
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        onSessionExpired();
        return;
      }
      setSystemStatus('down');
      setError(e instanceof ApiError ? e.message : 'No se pudo contactar al servidor. Revisá tu conexión y reintentá.');
      setState('error');
    }
  }, [onSessionExpired, setSystemStatus]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const agentByStep = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data?.agents ?? []) {
      for (const s of a.steps) {
        if (!m.has(s)) m.set(s, a.name);
      }
    }
    return m;
  }, [data]);

  // Agente principal: el agente dueño del PRIMER paso del flujo
  // (registry de workflows + catálogo de agentes). Hoy el único
  // flujo es opportunity.intake y su primer paso es normalize, de
  // Captación; la columna sigue siendo correcta si aparece otro
  // flujo. El paso sintético "intake" (fallo previo) no pertenece
  // a ningún agente y da "—".
  const primaryAgent = useCallback(
    (e: ExecutionFull): string => {
      const def = data?.workflows.find((w) => w.workflow === e.workflow);
      const first = def?.steps[0];
      if (!first) return '—';
      return agentByStep.get(first) ?? '—';
    },
    [data, agentByStep],
  );

  const oppByExecution = useMemo(() => {
    const m = new Map<string, { id: string | null; contact_name: string; company: string }>();
    for (const p of data?.processes ?? []) {
      if (p.execution && p.opportunity) {
        m.set(p.execution.id, {
          id: null,
          contact_name: p.opportunity.contact_name ?? '',
          company: p.opportunity.company ?? '',
        });
      }
    }
    // Respaldo: result_json.opportunity trae la oportunidad
    // completa (id incluido) en las ejecuciones exitosas.
    for (const e of data?.executions ?? []) {
      const parsed = parseJson(e.result_json) as { opportunity?: { id?: unknown; contact_name?: unknown; company?: unknown } } | null;
      const opp = parsed?.opportunity;
      if (opp && typeof opp.id === 'string') {
        const prev = m.get(e.id);
        m.set(e.id, {
          id: opp.id,
          contact_name: typeof opp.contact_name === 'string' ? opp.contact_name : (prev?.contact_name ?? ''),
          company: typeof opp.company === 'string' ? opp.company : (prev?.company ?? ''),
        });
      }
    }
    return m;
  }, [data]);

  const oppIdByExecution = useCallback(
    (e: ExecutionFull): string | null => {
      const parsed = parseJson(e.result_json) as { opportunity?: { id?: unknown } } | null;
      const id = parsed?.opportunity?.id;
      if (typeof id === 'string') return id;
      // Sin id en result_json, la corrida no expone opportunity_id
      // en su resumen: se busca por contacto + empresa exactos.
      const linked = oppByExecution.get(e.id);
      if (!linked || !linked.contact_name) return null;
      const match = (data?.opportunities ?? []).find(
        (o) => o.contact_name === linked.contact_name && o.company === linked.company,
      );
      return match?.id ?? null;
    },
    [data, oppByExecution],
  );

  const oppLabel = useCallback(
    (e: ExecutionFull): string => {
      const linked = oppByExecution.get(e.id);
      if (!linked) return '—';
      return linked.company ? `${linked.contact_name} · ${linked.company}` : linked.contact_name;
    },
    [oppByExecution],
  );

  // Cadena de reintentos real (retry_of): la raíz se alcanza
  // subiendo por retry_of; los reintentos son hijos directos de
  // la raíz (así los cuenta el servidor para el tope).
  const retryChain = useCallback(
    (e: ExecutionFull): ExecutionFull[] => {
      const byId = new Map((data?.executions ?? []).map((x) => [x.id, x]));
      let root = e;
      const guard = new Set<string>();
      while (root.retry_of && byId.get(root.retry_of) && !guard.has(root.id)) {
        guard.add(root.id);
        root = byId.get(root.retry_of) as ExecutionFull;
      }
      const children = (data?.executions ?? [])
        .filter((x) => x.retry_of === root.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return [root, ...children];
    },
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = localDate(new Date().toISOString());
    const now = Date.now();
    return (data?.executions ?? []).filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (agentFilter !== 'all' && primaryAgent(e) !== agentFilter) return false;
      if (dateFilter === 'today' && localDate(e.created_at) !== today) return false;
      if (dateFilter === '7d' && now - new Date(e.created_at).getTime() > 7 * 24 * 60 * 60 * 1000) return false;
      if (dateFilter === '30d' && now - new Date(e.created_at).getTime() > 30 * 24 * 60 * 60 * 1000) return false;
      if (!q) return true;
      return e.id.toLowerCase().includes(q) || oppLabel(e).toLowerCase().includes(q);
    });
  }, [data, search, statusFilter, agentFilter, dateFilter, primaryAgent, oppLabel]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);

  const effectiveSelectedId = selectedId && filtered.some((e) => e.id === selectedId)
    ? selectedId
    : (filtered[0]?.id ?? null);
  const selected = filtered.find((e) => e.id === effectiveSelectedId) ?? null;
  const selectedOppId = selected ? oppIdByExecution(selected) : null;

  // Pasos de la ejecución seleccionada (perezosos, con caché).
  useEffect(() => {
    if (!selected || stepsByExec[selected.id]) return;
    let cancelled = false;
    setStepsLoading(true);
    setStepsError('');
    getExecutionSteps(selected.id)
      .then(({ steps }) => {
        if (!cancelled) setStepsByExec((prev) => ({ ...prev, [selected.id]: steps }));
      })
      .catch(() => {
        if (!cancelled) setStepsError('No se pudieron cargar los pasos de esta ejecución.');
      })
      .finally(() => {
        if (!cancelled) setStepsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, stepsByExec]);

  // Decisiones de la oportunidad vinculada (perezosas, con caché)
  // y eventos de auditoría que citan a la ejecución.
  useEffect(() => {
    if (!selectedOppId || auditByOpp[selectedOppId]) return;
    let cancelled = false;
    setAuditLoading(true);
    setAuditError('');
    getOpportunityAudit(selectedOppId)
      .then(({ audit }) => {
        if (!cancelled) setAuditByOpp((prev) => ({ ...prev, [selectedOppId]: audit }));
      })
      .catch(() => {
        if (!cancelled) setAuditError('No se pudo cargar la actividad de la oportunidad vinculada.');
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOppId, auditByOpp]);

  useEffect(() => {
    if (!selected || auditAll !== null) return;
    let cancelled = false;
    getAudit()
      .then(({ audit }) => {
        if (!cancelled) setAuditAll(audit);
      })
      .catch(() => {
        if (!cancelled) setAuditAll([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, auditAll]);

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setAgentFilter('all');
    setDateFilter('7d');
    setPage(0);
  }, []);

  const confirmRetry = useCallback(async () => {
    if (!selected) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const result = await retryExecution(selected.id);
      setViewFeedback('Ejecución reintentada: se creó una ejecución nueva.');
      setRetryOpen(false);
      setSelectedId(result.executionId);
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setRetryError(e instanceof ApiError ? e.message : 'No se pudo reintentar la ejecución.');
    } finally {
      setRetrying(false);
    }
  }, [selected]);

  if (state === 'loading') {
    return <p className="text-ink">Cargando…</p>;
  }

  if (state === 'error' || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Actividad y ejecuciones</h1>
        <Alert variant="error">{error || 'No se pudo cargar Actividad.'}</Alert>
        <Button type="button" variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  const selectedSteps = selected ? stepsByExec[selected.id] : undefined;
  const selectedDecisions = selectedOppId ? (auditByOpp[selectedOppId] ?? []).filter((a) => ['draft.approved', 'draft.rejected', 'draft.edited'].includes(a.action)) : [];
  const selectedAuditRefs = selected && auditAll ? auditAll.filter((a) => a.entity_id === selected.id) : [];
  const chain = selected ? retryChain(selected) : [];
  const attemptsUsed = selected ? chain.length - 1 : 0;
  const attemptsLeft = Math.max(0, data.maxAttempts - attemptsUsed);
  const stepErrors = (selectedSteps ?? []).filter((s) => s.error);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Actividad y ejecuciones</h1>
        <p className="text-sm text-secondary">Consulta el historial de operaciones, decisiones y resultados</p>
      </div>

      <Card compact pad="p-3">
        <FilterBar
          layout="single"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(0); }}
          searchPlaceholder="Buscar por ID u oportunidad…"
          selects={[
            {
              id: 'filter-estado',
              label: 'Estado',
              value: statusFilter,
              options: [
                { value: 'all', label: 'Todos' },
                { value: 'done', label: 'Completadas' },
                { value: 'failed', label: 'Fallidas' },
                { value: 'running', label: 'Activas' },
              ],
              onChange: (v) => { setStatusFilter(v); setPage(0); },
            },
            {
              id: 'filter-agente',
              label: 'Agente',
              value: agentFilter,
              options: [
                { value: 'all', label: 'Todos' },
                ...data.agents.map((a) => ({ value: a.name, label: a.name })),
              ],
              onChange: (v) => { setAgentFilter(v); setPage(0); },
            },
            {
              id: 'filter-fecha',
              label: 'Fecha',
              value: dateFilter,
              options: [
                { value: 'today', label: 'Hoy' },
                { value: '7d', label: 'Últimos 7 días' },
                { value: '30d', label: 'Últimos 30 días' },
                { value: 'all', label: 'Todas' },
              ],
              onChange: (v) => { setDateFilter(v); setPage(0); },
            },
          ]}
          onClear={clearFilters}
        />
        <p className="mt-2 text-xs text-secondary">
          Sin filtro de proceso: hoy existe un único flujo (opportunity.intake).
        </p>
      </Card>

      {viewFeedback && <Alert variant="success">{viewFeedback}</Alert>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] items-start">
        <Card compact pad="p-3">
          <div>
            <Table
              scrollable={false}
              textSize="text-xs"
              headers={['Ejecución', 'Flujo', 'Agente principal', 'Oportunidad', 'Inicio', 'Duración', 'Estado']}
              empty={pageItems.length === 0}
              emptyText={
                filtered.length === 0 && data.executions.length === 0
                  ? 'Todavía no hay ejecuciones. Se crean solas cuando ingresa una oportunidad.'
                  : 'Sin resultados para los filtros actuales.'
              }
            >
              {pageItems.map((e) => {
                const badge = statusBadge(e.status);
                const isSelected = e.id === effectiveSelectedId;
                return (
                  <tr
                    key={e.id}
                    tabIndex={0}
                    onClick={() => openDetail(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        openDetail(e.id);
                      }
                    }}
                    className={`group cursor-pointer hover:bg-primary-subtle ${isSelected ? 'bg-primary/20' : ''}`}
                  >
                    <td className="px-1 py-1.5 break-words">
                      <div className="font-mono font-semibold" title={e.id}>{shortId(e.id)}</div>
                      <div className={`text-xs ${isSelected ? 'text-ink' : 'text-secondary'} group-hover:text-ink`}>
                        {e.retry_of ? `Reintento de ${shortId(e.retry_of)}` : 'Ejecución original'}
                      </div>
                    </td>
                    <td className="px-1 py-1.5 break-words">{e.workflow}</td>
                    <td className="px-1 py-1.5 break-words">{primaryAgent(e)}</td>
                    <td className="px-1 py-1.5 break-words">{oppLabel(e)}</td>
                    <td className="px-1 py-1.5 break-words">{formatDateTime(e.created_at)}</td>
                    <td className="px-1 py-1.5 break-words">{formatDuration(durationMs(e))}</td>
                    <td className="px-1 py-1.5 break-words">
                      <Badge variant={badge.variant} className="whitespace-nowrap">
                        {badge.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
          <div className="mt-3">
            <Pagination page={safePage} pageCount={pageCount} total={filtered.length} from={from} to={to} onPage={setPage} />
          </div>
        </Card>

        {selected && (
          <DetailPanel
            variant="inline"
            wide
            title={`Inspector de ejecución: ${shortId(selected.id)}`}
            subtitle={`${selected.workflow} · ${statusBadge(selected.status).label}`}
            footer={
              selected.status === 'failed' && data.isAdmin ? (
                <Button type="button" variant="primary" onClick={() => { setRetryError(null); setRetryOpen(true); }}>
                  <span className="flex items-center gap-2">
                    <RotateCcw size={16} aria-hidden="true" />
                    Reintentar ejecución
                  </span>
                </Button>
              ) : selected.status === 'failed' ? (
                <p className="text-xs text-secondary">Solo un admin puede reintentar ejecuciones fallidas.</p>
              ) : undefined
            }
          >
            <div>
              <h3 className="text-sm font-semibold">Metadata de la ejecución</h3>
              <dl className="mt-2 divide-y divide-border text-sm">
                <div className="py-2 first:pt-0">
                  <dt className="text-xs text-secondary">Flujo</dt>
                  <dd className="font-medium">{selected.workflow} · v{selected.workflow_version}</dd>
                </div>
                <div className="py-2">
                  <dt className="text-xs text-secondary">Agente principal</dt>
                  <dd className="font-medium">{primaryAgent(selected)}</dd>
                </div>
                <div className="py-2">
                  <dt className="text-xs text-secondary">Inicio</dt>
                  <dd className="font-medium">{formatDateTime(selected.created_at)}</dd>
                </div>
                <div className="py-2">
                  <dt className="text-xs text-secondary">Fin</dt>
                  <dd className="font-medium">{selected.status === 'running' ? 'En curso' : formatDateTime(selected.updated_at)}</dd>
                </div>
                <div className="py-2">
                  <dt className="text-xs text-secondary">Duración</dt>
                  <dd className="font-medium">{formatDuration(durationMs(selected))}</dd>
                </div>
                <div className="py-2">
                  <dt className="text-xs text-secondary">Oportunidad vinculada</dt>
                  <dd className="font-medium">{oppLabel(selected)}</dd>
                </div>
                <div className="py-2">
                  <dt className="text-xs text-secondary">ID completo</dt>
                  <dd className="font-mono text-xs break-all">{selected.id}</dd>
                </div>
                <div className="py-2">
                  <dt className="text-xs text-secondary">Reintento de</dt>
                  <dd className="font-medium">{selected.retry_of ? shortId(selected.retry_of) : '—'}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Datos de entrada</h3>
              <p className="mt-1 text-xs text-secondary">
                Entrada real de la ejecución; los datos personales van enmascarados por protección.
              </p>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-control border border-border bg-surface p-3 text-xs">{maskJson(selected.input_json)}</pre>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Cronología de pasos</h3>
              {stepsLoading && !selectedSteps && <p className="mt-2 text-secondary">Cargando pasos…</p>}
              {stepsError && <Alert variant="error">{stepsError}</Alert>}
              {selectedSteps && selectedSteps.length === 0 && (
                <p className="mt-2 text-sm text-secondary">Sin pasos registrados para esta ejecución.</p>
              )}
              {selectedSteps && selectedSteps.length > 0 && (
                <ul className="mt-2 space-y-3">
                  {selectedSteps.map((s) => (
                    <li key={s.id} className="text-sm">
                      <div className="flex items-start gap-2">
                        {s.status === 'done' ? (
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                        ) : s.status === 'failed' ? (
                          <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
                        ) : (
                          <Clock size={16} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium">{stepLabel(s.step)}</div>
                          <div className="text-xs text-secondary">
                            {agentByStep.get(s.step) ?? '—'} · {formatDateTime(s.created_at)}
                          </div>
                          {s.error && <p className="mt-1 break-words text-danger">{s.error}</p>}
                          {s.output_json && (
                            <pre className="mt-1 whitespace-pre-wrap break-words rounded-control border border-border bg-surface p-2 text-xs">{maskJson(s.output_json)}</pre>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold">Decisiones vinculadas</h3>
              {auditLoading && !selectedOppId && <p className="mt-2 text-secondary">Cargando decisiones…</p>}
              {auditError && <Alert variant="error">{auditError}</Alert>}
              {!selectedOppId && (
                <p className="mt-2 text-sm text-secondary">
                  Sin decisiones vinculadas: esta ejecución no creó una oportunidad.
                </p>
              )}
              {selectedOppId && selectedDecisions.length === 0 && (
                <p className="mt-2 text-sm text-secondary">Sin decisiones vinculadas para esta oportunidad.</p>
              )}
              {selectedOppId && selectedDecisions.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {selectedDecisions.map((a, i) => (
                    <li key={`${a.created_at}-${a.action}-${i}`} className="text-sm">
                      <div className="font-medium">{auditActionLabel(a.action)}</div>
                      <div className="text-xs text-secondary">
                        {formatDateTime(a.created_at)} · {a.actor}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected.status === 'failed' && (
              <div>
                <h3 className="text-sm font-semibold">Diagnóstico de error</h3>
                <Alert variant="error">
                  <span className="break-words">{selected.error ?? 'Sin mensaje de error guardado.'}</span>
                  {stepErrors.length > 0 && (
                    <span className="mt-2 block">
                      {stepErrors.map((s) => (
                        <span key={s.id} className="block break-words">
                          {stepLabel(s.step)}: {s.error}
                        </span>
                      ))}
                    </span>
                  )}
                </Alert>
                <p className="mt-2 text-xs text-secondary">
                  Reintentos usados en esta cadena: {attemptsUsed} de {data.maxAttempts} ({attemptsLeft} restantes).
                </p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold">Reintentos</h3>
              {chain.length <= 1 ? (
                <p className="mt-2 text-sm text-secondary">Sin reintentos para esta ejecución.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {chain.map((c) => (
                    <li key={c.id} className="text-sm">
                      <div className="font-medium">
                        {c.id === selected.id ? 'Esta ejecución' : c.retry_of === null ? 'Ejecución original' : 'Reintento'} · {shortId(c.id)}
                      </div>
                      <div className="text-xs text-secondary">
                        {statusBadge(c.status).label} · {formatDateTime(c.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold">Referencias de auditoría</h3>
              {selectedAuditRefs.length === 0 ? (
                <p className="mt-2 text-sm text-secondary">Sin eventos de auditoría vinculados a esta ejecución.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedAuditRefs.map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="font-medium">{auditActionLabel(a.action)}</div>
                      <div className="font-mono text-xs text-secondary break-all">ID {a.id}</div>
                      <div className="text-xs text-secondary">
                        {formatDateTime(a.created_at)} · {a.actor}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DetailPanel>
        )}
      </div>

      <Dialog
        open={retryOpen}
        onClose={() => { if (!retrying) setRetryOpen(false); }}
        title="Reintentar ejecución"
      >
        <p>
          ¿Reintentar la ejecución completa «{selected ? shortId(selected.id) : ''}»? Se vuelve a correr el ingreso
          entero (no un paso aislado) y se crea una ejecución nueva.
        </p>
        <p className="text-sm text-secondary">
          Reintentos usados en esta cadena: {attemptsUsed} de {data.maxAttempts} ({attemptsLeft} restantes).
        </p>
        {retryError && <Alert variant="error">{retryError}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant="primary" disabled={retrying} onClick={() => void confirmRetry()}>
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </Button>
          <Button type="button" variant="secondary" disabled={retrying} onClick={() => setRetryOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
