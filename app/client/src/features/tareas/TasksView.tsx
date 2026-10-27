import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { CheckCircle2, ClipboardList, Clock } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DetailPanel } from '../../components/ui/detail-panel';
import { Dialog } from '../../components/ui/dialog';
import { FilterBar } from '../../components/ui/filter-bar';
import { Pagination } from '../../components/ui/pagination';
import { Table } from '../../components/ui/table';
import { Tabs } from '../../components/ui/tabs';
import type { HomeOutletContext } from '../inicio/HomeView';
import {
  ApiError,
  getAllTasks,
  getOpportunityAudit,
  getOpportunityList,
  updateTask,
  type AuditEntry,
  type OpportunityDetail,
  type TaskFull,
} from '../../lib/api';
import {
  auditActionLabel,
  categoryLabel,
  formatDate,
  formatDateTime,
  localDate,
  priorityLabel,
} from '../../lib/format';

// R2 — Tareas y seguimientos (vista real, reemplaza el aviso de
// migración de la Fase 3). Sigue el patrón de Oportunidades (R1):
// filtros en una sola fila, paginación en cliente, tabla 12 px,
// panel derecho fijo, filas clicables con teclado. Todo lo que se
// muestra sale de GET /api/tasks + GET /api/opportunities; nada
// se inventa (ver docs/R2-TAREAS-REPORTE.md para el mapeo
// referencia → real y todo lo omitido).

const PAGE_SIZE = 20;

type TaskState = 'pending' | 'overdue' | 'done';

// Vencida = abierta con vencimiento anterior a hoy (fecha local,
// misma regla que el resto de la app: localDate compara en la
// zona del navegador, no en UTC).
function taskState(t: TaskFull): TaskState {
  if (t.status === 'done') return 'done';
  return localDate(t.due_at) < localDate(new Date().toISOString()) ? 'overdue' : 'pending';
}

function stateBadge(s: TaskState): { variant: 'success' | 'danger' | 'neutral'; label: string } {
  if (s === 'done') return { variant: 'success', label: 'Completada' };
  if (s === 'overdue') return { variant: 'danger', label: 'Vencida' };
  return { variant: 'neutral', label: 'Pendiente' };
}

function priorityVariant(p: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (p === 'high') return 'danger';
  if (p === 'medium') return 'warning';
  if (p === 'low') return 'info';
  return 'neutral';
}

interface TasksData {
  tasks: TaskFull[];
  opportunities: OpportunityDetail[];
}

export function TasksView() {
  const { setSystemStatus, onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<TasksData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [auditByOpp, setAuditByOpp] = useState<Record<string, AuditEntry[]>>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [tab, setTab] = useState<'resumen' | 'actividad'>('resumen');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [viewFeedback, setViewFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [{ tasks }, { opportunities }] = await Promise.all([getAllTasks(), getOpportunityList()]);
      setData({ tasks, opportunities });
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

  const oppById = useMemo(() => {
    const m = new Map<string, OpportunityDetail>();
    for (const o of data?.opportunities ?? []) m.set(o.id, o);
    return m;
  }, [data]);

  const counts = useMemo(() => {
    let pending = 0;
    let overdue = 0;
    let done = 0;
    for (const t of data?.tasks ?? []) {
      const s = taskState(t);
      if (s === 'pending') pending += 1;
      else if (s === 'overdue') overdue += 1;
      else done += 1;
    }
    return { pending, overdue, done };
  }, [data]);

  const agentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of data?.tasks ?? []) seen.set(t.agent_id, t.agent_name || t.assigned_to);
    return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.tasks ?? []).filter((t) => {
      const s = taskState(t);
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      if (agentFilter !== 'all' && t.agent_id !== agentFilter) return false;
      const opp = oppById.get(t.opportunity_id);
      if (priorityFilter !== 'all' && opp?.priority !== priorityFilter) return false;
      if (priorityFilter !== 'all' && !opp) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.contact_name.toLowerCase().includes(q) ||
        t.company.toLowerCase().includes(q)
      );
    });
  }, [data, search, statusFilter, agentFilter, priorityFilter, oppById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);

  // Selección efectiva: la explícita si sigue en la lista
  // filtrada, si no la primera (mismo patrón que Oportunidades).
  const effectiveSelectedId = selectedId && filtered.some((t) => t.id === selectedId)
    ? selectedId
    : (filtered[0]?.id ?? null);
  const selected = filtered.find((t) => t.id === effectiveSelectedId) ?? null;
  const selectedOpp = selected ? oppById.get(selected.opportunity_id) : undefined;
  const selectedState = selected ? taskState(selected) : null;

  // Actividad de la oportunidad seleccionada (perezosa, con
  // caché por oportunidad): incluye la creación de la tarea, la
  // del borrador y los eventos de la oportunidad. El evento de
  // completar (task.updated) no cita a la oportunidad en el
  // servidor, así que no aparece en esta línea de tiempo; la
  // fecha de actualización se muestra en Resumen (ver informe).
  useEffect(() => {
    if (!selected || auditByOpp[selected.opportunity_id]) return;
    let cancelled = false;
    setAuditLoading(true);
    setAuditError('');
    getOpportunityAudit(selected.opportunity_id)
      .then(({ audit }) => {
        if (!cancelled) setAuditByOpp((prev) => ({ ...prev, [selected.opportunity_id]: audit }));
      })
      .catch(() => {
        if (!cancelled) setAuditError('No se pudo cargar la actividad de esta oportunidad.');
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, auditByOpp]);

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setTab('resumen');
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setAgentFilter('all');
    setPriorityFilter('all');
    setPage(0);
  }, []);

  const confirmComplete = useCallback(async () => {
    if (!selected) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      await updateTask(selected.id, 'done');
      setViewFeedback('Tarea completada.');
      setConfirmOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setCompleteError(e instanceof ApiError ? e.message : 'No se pudo completar la tarea.');
    } finally {
      setCompleting(false);
    }
  }, [selected]);

  if (state === 'loading') {
    return <p className="text-ink">Cargando…</p>;
  }

  if (state === 'error' || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Tareas y seguimientos</h1>
        <Alert variant="error">{error || 'No se pudo cargar Tareas.'}</Alert>
        <Button type="button" variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  const selectedAudit = selected ? auditByOpp[selected.opportunity_id] : undefined;
  const cardClass =
    'bg-surface border border-border rounded-card p-6 text-left w-full hover:border-primary';
  const statValue = 'block text-[32px] font-semibold text-ink';
  const statLabel = 'block text-sm text-secondary';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Tareas y seguimientos</h1>
        <p className="text-sm text-secondary">Controla las próximas acciones y los compromisos pendientes</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button type="button" className={cardClass} onClick={() => { setStatusFilter('pending'); setPage(0); }}>
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-amber-100 text-amber-800" aria-hidden="true">
              <ClipboardList size={20} />
            </span>
            <span>
              <span className={statValue}>{counts.pending}</span>
              <span className={statLabel}>Pendientes</span>
            </span>
          </span>
        </button>
        <button type="button" className={cardClass} onClick={() => { setStatusFilter('overdue'); setPage(0); }}>
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-red-100 text-red-700" aria-hidden="true">
              <Clock size={20} />
            </span>
            <span>
              <span className={statValue}>{counts.overdue}</span>
              <span className={statLabel}>Vencidas</span>
            </span>
          </span>
        </button>
        <button type="button" className={cardClass} onClick={() => { setStatusFilter('done'); setPage(0); }}>
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-emerald-100 text-emerald-700" aria-hidden="true">
              <CheckCircle2 size={20} />
            </span>
            <span>
              <span className={statValue}>{counts.done}</span>
              <span className={statLabel}>Completadas</span>
            </span>
          </span>
        </button>
      </div>

      <Card compact pad="p-3">
        <FilterBar
          layout="single"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(0); }}
          searchPlaceholder="Buscar tarea, contacto o empresa…"
          selects={[
            {
              id: 'filter-estado',
              label: 'Estado',
              value: statusFilter,
              options: [
                { value: 'all', label: 'Todos' },
                { value: 'pending', label: 'Pendientes' },
                { value: 'overdue', label: 'Vencidas' },
                { value: 'done', label: 'Completadas' },
              ],
              onChange: (v) => { setStatusFilter(v); setPage(0); },
            },
            {
              id: 'filter-agente',
              label: 'Agente',
              value: agentFilter,
              options: [{ value: 'all', label: 'Todos' }, ...agentOptions],
              onChange: (v) => { setAgentFilter(v); setPage(0); },
            },
            {
              id: 'filter-prioridad',
              label: 'Prioridad',
              value: priorityFilter,
              options: [
                { value: 'all', label: 'Todas' },
                { value: 'high', label: 'Alta' },
                { value: 'medium', label: 'Media' },
                { value: 'low', label: 'Baja' },
              ],
              onChange: (v) => { setPriorityFilter(v); setPage(0); },
            },
          ]}
          onClear={clearFilters}
        />
      </Card>

      {viewFeedback && <Alert variant="success">{viewFeedback}</Alert>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <Card compact pad="p-3">
          <div>
            <Table
              scrollable={false}
              textSize="text-xs"
              headers={['Tarea', 'Oportunidad', 'Cliente', 'Agente', 'Prioridad', 'Vencimiento', 'Estado']}
              empty={pageItems.length === 0}
              emptyText={
                filtered.length === 0 && data.tasks.length === 0
                  ? 'Todavía no hay tareas. Se crean solas cuando ingresa una oportunidad.'
                  : 'Sin resultados para los filtros actuales.'
              }
            >
              {pageItems.map((t) => {
                const s = taskState(t);
                const badge = stateBadge(s);
                const opp = oppById.get(t.opportunity_id);
                const isSelected = t.id === effectiveSelectedId;
                return (
                  <tr
                    key={t.id}
                    tabIndex={0}
                    onClick={() => openDetail(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(t.id);
                      }
                    }}
                    className={`group cursor-pointer hover:bg-primary-subtle ${isSelected ? 'bg-primary/20' : ''}`}
                  >
                    <td className="px-1 py-1.5 break-words">
                      <div className="font-semibold">{t.title}</div>
                      <div className={`text-xs ${isSelected ? 'text-ink' : 'text-secondary'} group-hover:text-ink`}>
                        Creada {formatDate(t.created_at)}
                      </div>
                    </td>
                    <td className="px-1 py-1.5 break-words">{t.contact_name}</td>
                    <td className="px-1 py-1.5 break-words">{t.company || '—'}</td>
                    <td className="px-1 py-1.5 break-words">{t.agent_name || t.assigned_to}</td>
                    <td className="px-1 py-1.5 break-words">
                      {opp ? (
                        <Badge variant={priorityVariant(opp.priority)} className="whitespace-nowrap">
                          {priorityLabel(opp.priority)}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-1 py-1.5 break-words">{formatDate(t.due_at)}</td>
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

        {selected && selectedState && (
          <DetailPanel
            variant="inline"
            title={selected.title}
            subtitle={`Tarea de ${selected.contact_name}${selected.company ? ` · ${selected.company}` : ''}`}
          >
            <p>
              <Badge variant={stateBadge(selectedState).variant}>{stateBadge(selectedState).label}</Badge>
            </p>
            <Tabs
              tabs={[
                { id: 'resumen', label: 'Resumen' },
                { id: 'actividad', label: 'Actividad' },
              ]}
              active={tab}
              onChange={(id) => setTab(id as 'resumen' | 'actividad')}
              idPrefix="task-detail"
            />
            {tab === 'resumen' && (
              <div role="tabpanel" id="task-detail-panel-resumen" aria-labelledby="task-detail-tab-resumen">
                <dl className="divide-y divide-border text-sm">
                  <div className="py-2 first:pt-0">
                    <dt className="text-xs text-secondary">Oportunidad</dt>
                    <dd className="font-medium">{selected.contact_name}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-xs text-secondary">Cliente</dt>
                    <dd className="font-medium">{selected.company || '—'}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-xs text-secondary">Agente</dt>
                    <dd className="font-medium">{selected.agent_name || selected.assigned_to}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-xs text-secondary">Vencimiento</dt>
                    <dd className="font-medium">{formatDate(selected.due_at)}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-xs text-secondary">Prioridad</dt>
                    <dd className="font-medium">{selectedOpp ? priorityLabel(selectedOpp.priority) : '—'}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-xs text-secondary">Categoría</dt>
                    <dd className="font-medium">{selectedOpp ? categoryLabel(selectedOpp.category) : '—'}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-xs text-secondary">Creada</dt>
                    <dd className="font-medium">{formatDateTime(selected.created_at)}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-xs text-secondary">Actualizada</dt>
                    <dd className="font-medium">{formatDateTime(selected.updated_at)}</dd>
                  </div>
                </dl>
                <p className="pt-2 text-xs text-secondary">
                  El mensaje de la oportunidad es el contexto de esta tarea (no una descripción propia de la tarea):
                </p>
                <p className="whitespace-pre-wrap break-words">{selectedOpp ? selectedOpp.message : '—'}</p>
              </div>
            )}
            {tab === 'actividad' && (
              <div role="tabpanel" id="task-detail-panel-actividad" aria-labelledby="task-detail-tab-actividad">
                <p className="text-xs text-secondary">
                  Actividad de la oportunidad vinculada (creación de la tarea, del borrador y eventos de la oportunidad).
                </p>
                {auditLoading && !selectedAudit && <p className="mt-2 text-secondary">Cargando actividad…</p>}
                {auditError && <Alert variant="error">{auditError}</Alert>}
                {selectedAudit && selectedAudit.length === 0 && (
                  <p className="mt-2 text-secondary">Sin actividad registrada para esta oportunidad.</p>
                )}
                {selectedAudit && selectedAudit.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {selectedAudit.map((a, i) => (
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
            )}
            {selectedState !== 'done' && (
              <div className="pt-1">
                <Button type="button" variant="primary" onClick={() => { setCompleteError(null); setConfirmOpen(true); }}>
                  Completar tarea
                </Button>
              </div>
            )}
          </DetailPanel>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => { if (!completing) setConfirmOpen(false); }}
        title="Completar tarea"
      >
        <p>
          ¿Completar la tarea «{selected?.title}» de {selected?.contact_name}?
        </p>
        {completeError && <Alert variant="error">{completeError}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant="primary" disabled={completing} onClick={() => void confirmComplete()}>
            {completing ? 'Completando…' : 'Completar'}
          </Button>
          <Button type="button" variant="secondary" disabled={completing} onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
