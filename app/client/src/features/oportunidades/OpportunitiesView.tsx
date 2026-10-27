import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DetailPanel } from '../../components/ui/detail-panel';
import { FilterBar } from '../../components/ui/filter-bar';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Pagination } from '../../components/ui/pagination';
import { Table } from '../../components/ui/table';
import { Tabs } from '../../components/ui/tabs';
import type { SystemStatus } from '../../components/layout/AppLayout';
import type { HomeOutletContext } from '../inicio/HomeView';
import {
  ApiError,
  createOpportunity,
  getAllTasks,
  getDraftsDetail,
  getOpportunityAudit,
  getOpportunityList,
  type AuditEntry,
  type DraftFull,
  type OpportunityDetail,
  type TaskFull,
} from '../../lib/api';
import {
  auditActionLabel,
  auditEntityLabel,
  categoryLabel,
  channelLabel,
  draftStatusLabel,
  formatDate,
  formatDateTime,
  priorityLabel,
  statusLabel,
} from '../../lib/format';

// Vista Oportunidades real (R1): tabla + panel de detalle
// lateral con la composición de la referencia, pero SOLO con
// datos reales. Columnas reales del vanilla (contacto, empresa,
// categoría, prioridad, estado) + canal y próximo paso derivable
// (título de la tarea abierta más próxima: /api/tasks ya viene
// ordenado por vencimiento). OMITIDAS por criterio aprobado: sin
// «Agente IA Asignado», sin valor estimado/probabilidad/cierre,
// sin «Atención humana» como columna, sin desglose IA. El
// borrador se llama «Borrador», nunca «Borrador IA» (F2-AI
// DISCARD). Paginación en cliente (el servidor devuelve hasta
// 100 filas sin paginar); filtros en cliente.

const PAGE_SIZE = 20;

function priorityVariant(p: string): 'danger' | 'warning' | 'neutral' {
  return p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'neutral';
}

function statusVariant(s: string): 'info' | 'success' | 'neutral' {
  return s === 'proposal_draft' ? 'info' : s === 'in_follow_up' ? 'success' : 'neutral';
}

function draftVariant(s: string): 'warning' | 'success' | 'danger' | 'neutral' {
  return s === 'pending_approval' ? 'warning' : s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'neutral';
}

function taskVariant(s: string): 'warning' | 'success' | 'neutral' {
  return s === 'open' ? 'warning' : s === 'done' ? 'success' : 'neutral';
}

function taskLabel(s: string): string {
  return s === 'open' ? 'Abierta' : s === 'done' ? 'Hecha' : s;
}

interface OppData {
  opportunities: OpportunityDetail[];
  tasks: TaskFull[];
  drafts: DraftFull[];
}

const DETAIL_TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'borrador', label: 'Borrador' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'actividad', label: 'Actividad' },
];

export function OpportunitiesView() {
  const { setSystemStatus, onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<OppData | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState('resumen');
  const [auditById, setAuditById] = useState<Record<string, AuditEntry[]>>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createCompany, setCreateCompany] = useState('');
  const [createMessage, setCreateMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [{ opportunities }, { tasks }, { drafts }] = await Promise.all([
        getOpportunityList(),
        getAllTasks(),
        getDraftsDetail(),
      ]);
      setData({ opportunities, tasks, drafts });
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

  // Actividad de la oportunidad seleccionada: se carga al abrir
  // el panel (una sola vez por oportunidad) desde
  // /api/audit?opportunityId=, que ya devuelve los eventos
  // directos y los relacionados.
  useEffect(() => {
    if (!selectedId || auditById[selectedId]) return;
    setAuditLoading(true);
    setAuditError('');
    getOpportunityAudit(selectedId)
      .then(({ audit }) => {
        setAuditById((prev) => ({ ...prev, [selectedId]: audit }));
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          onSessionExpired();
          return;
        }
        setAuditError(e instanceof ApiError ? e.message : 'No se pudo cargar la actividad.');
      })
      .finally(() => setAuditLoading(false));
  }, [selectedId, auditById, onSessionExpired]);

  function openDetail(id: string) {
    setSelectedId(id);
    setTab('resumen');
  }

  function closeDetail() {
    setSelectedId(null);
    setTab('resumen');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateFeedback(null);
    setCreating(true);
    try {
      const result = await createOpportunity({
        contactName: createName,
        contactEmail: createEmail,
        company: createCompany,
        message: createMessage,
      });
      setCreateName('');
      setCreateEmail('');
      setCreateCompany('');
      setCreateMessage('');
      setCreateFeedback({
        kind: 'success',
        text: result.duplicate ? 'La oportunidad ya estaba registrada.' : 'Oportunidad creada.',
      });
      setPage(0);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setCreateFeedback({
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'No se pudo crear la oportunidad.',
      });
    } finally {
      setCreating(false);
    }
  }

  if (state === 'loading') {
    return <p className="text-secondary">Cargando…</p>;
  }

  if (state === 'error' || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Oportunidades</h1>
        <Alert variant="error">{error || 'No se pudo cargar Oportunidades.'}</Alert>
        <Button type="button" variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = data.opportunities.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;
    if (sourceFilter !== 'all' && o.source !== sourceFilter) return false;
    if (q) {
      const hay = `${o.contact_name} ${o.company} ${o.message}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);

  // Próximo paso: la tarea abierta más próxima (el servidor ya
  // ordena /api/tasks por vencimiento ascendente).
  const nextStepByOpp = new Map<string, TaskFull>();
  for (const t of data.tasks) {
    if (t.status === 'open' && !nextStepByOpp.has(t.opportunity_id)) {
      nextStepByOpp.set(t.opportunity_id, t);
    }
  }

  const sources = Array.from(new Set(data.opportunities.map((o) => o.source)));

  const selected = selectedId ? data.opportunities.find((o) => o.id === selectedId) ?? null : null;
  // Los borradores vienen ordenados por creación DESC: el primero
  // de la oportunidad es el vigente.
  const selectedDraft = selected ? data.drafts.find((d) => d.opportunity_id === selected.id) ?? null : null;
  const selectedTasks = selected ? data.tasks.filter((t) => t.opportunity_id === selected.id) : [];
  const selectedAudit = selected ? (auditById[selected.id] ?? null) : null;

  function auditDetail(a: AuditEntry): string {
    let detail: { category?: unknown; priority?: unknown } = {};
    try {
      detail = JSON.parse(a.detail_json || '{}') as typeof detail;
    } catch {
      detail = {};
    }
    const parts: string[] = [];
    if (typeof detail.category === 'string') parts.push(`categoría ${categoryLabel(detail.category)}`);
    if (typeof detail.priority === 'string') parts.push(`prioridad ${priorityLabel(detail.priority)}`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Oportunidades</h1>
        <p className="text-secondary">Oportunidades comerciales y alta manual.</p>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Nueva oportunidad (alta manual)</h2>
        {createFeedback && (
          <div className="mt-3">
            <Alert variant={createFeedback.kind === 'success' ? 'success' : 'error'}>{createFeedback.text}</Alert>
          </div>
        )}
        <form onSubmit={onCreate} className="mt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="opp-name">Nombre de contacto</Label>
              <Input id="opp-name" required value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="opp-email">Correo de contacto</Label>
              <Input
                id="opp-email"
                type="email"
                required
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="opp-company">Empresa (opcional)</Label>
              <Input id="opp-company" value={createCompany} onChange={(e) => setCreateCompany(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="opp-message">Mensaje de la oportunidad</Label>
              <textarea
                id="opp-message"
                required
                value={createMessage}
                onChange={(e) => setCreateMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface text-ink border border-border rounded-control min-h-[72px]"
              />
            </div>
          </div>
          <div className="mt-3">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear oportunidad'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Oportunidades</h2>
        <div className="mt-3">
          <FilterBar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            searchPlaceholder="Buscar por contacto, empresa o mensaje…"
            selects={[
              {
                id: 'filter-status',
                label: 'Estado',
                value: statusFilter,
                options: [
                  { value: 'all', label: 'Todos' },
                  { value: 'new', label: statusLabel('new') },
                  { value: 'proposal_draft', label: statusLabel('proposal_draft') },
                  { value: 'in_follow_up', label: statusLabel('in_follow_up') },
                ],
                onChange: (v) => {
                  setStatusFilter(v);
                  setPage(0);
                },
              },
              {
                id: 'filter-priority',
                label: 'Prioridad',
                value: priorityFilter,
                options: [
                  { value: 'all', label: 'Todas' },
                  { value: 'high', label: priorityLabel('high') },
                  { value: 'medium', label: priorityLabel('medium') },
                  { value: 'low', label: priorityLabel('low') },
                ],
                onChange: (v) => {
                  setPriorityFilter(v);
                  setPage(0);
                },
              },
              {
                id: 'filter-source',
                label: 'Fuente',
                value: sourceFilter,
                options: [
                  { value: 'all', label: 'Todas' },
                  ...sources.map((s) => ({ value: s, label: channelLabel(s) })),
                ],
                onChange: (v) => {
                  setSourceFilter(v);
                  setPage(0);
                },
              },
            ]}
            onClear={() => {
              setSearch('');
              setStatusFilter('all');
              setPriorityFilter('all');
              setSourceFilter('all');
              setPage(0);
            }}
          />
        </div>
        <div className="mt-4">
          <Table
            headers={['Contacto', 'Empresa', 'Categoría', 'Prioridad', 'Estado', 'Canal', 'Próximo paso']}
            empty={pageItems.length === 0}
            emptyText={
              filtered.length === 0 && data.opportunities.length === 0
                ? 'Aún no hay oportunidades. Creá la primera con el formulario de alta manual.'
                : 'Sin resultados para los filtros actuales.'
            }
          >
            {pageItems.map((o) => {
              const next = nextStepByOpp.get(o.id);
              const isSelected = o.id === selectedId;
              return (
                <tr
                  key={o.id}
                  tabIndex={0}
                  onClick={() => openDetail(o.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDetail(o.id);
                    }
                  }}
                  className={`cursor-pointer hover:bg-primary-subtle ${isSelected ? 'bg-primary-subtle' : ''}`}
                >
                  <td className="px-3 py-2">{o.contact_name}</td>
                  <td className="px-3 py-2">{o.company || '—'}</td>
                  <td className="px-3 py-2">{categoryLabel(o.category)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={priorityVariant(o.priority)}>{priorityLabel(o.priority)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(o.status)}>{statusLabel(o.status)}</Badge>
                  </td>
                  <td className="px-3 py-2">{channelLabel(o.source)}</td>
                  <td className="px-3 py-2">{next ? next.title : '—'}</td>
                </tr>
              );
            })}
          </Table>
        </div>
        <div className="mt-4">
          <Pagination page={safePage} pageCount={pageCount} total={filtered.length} from={from} to={to} onPage={setPage} />
        </div>
      </Card>

      {selected && (
        <DetailPanel
          title={`${selected.contact_name}${selected.company ? ` (${selected.company})` : ''}`}
          subtitle={`Categoría ${categoryLabel(selected.category)} · Prioridad ${priorityLabel(selected.priority)}`}
          onClose={closeDetail}
          footer={
            selectedDraft && selectedDraft.status === 'pending_approval' ? (
              <Link to="/aprobaciones">Revisar borrador en Aprobaciones</Link>
            ) : undefined
          }
        >
          <Tabs tabs={DETAIL_TABS} active={tab} onChange={setTab} />

          {tab === 'resumen' && (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-secondary">Contacto</dt>
                <dd>{selected.contact_name}</dd>
              </div>
              <div>
                <dt className="text-secondary">Correo</dt>
                <dd>{selected.contact_email}</dd>
              </div>
              <div>
                <dt className="text-secondary">Empresa</dt>
                <dd>{selected.company || '—'}</dd>
              </div>
              <div>
                <dt className="text-secondary">Mensaje</dt>
                <dd className="whitespace-pre-wrap">{selected.message}</dd>
              </div>
              <div>
                <dt className="text-secondary">Canal</dt>
                <dd>{channelLabel(selected.source)}</dd>
              </div>
              <div>
                <dt className="text-secondary">Estado</dt>
                <dd>
                  <Badge variant={statusVariant(selected.status)}>{statusLabel(selected.status)}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-secondary">Puntaje</dt>
                <dd>{selected.score}</dd>
              </div>
              <div>
                <dt className="text-secondary">Creada</dt>
                <dd>{formatDateTime(selected.created_at)}</dd>
              </div>
              <div>
                <dt className="text-secondary">Actualizada</dt>
                <dd>{formatDateTime(selected.updated_at)}</dd>
              </div>
              <p className="text-secondary">
                El puntaje sale de reglas deterministas (urgencia, presupuesto, empresa, dominio y categoría); el
                desglose por oportunidad no queda guardado.
              </p>
            </dl>
          )}

          {tab === 'borrador' && (
            <div className="space-y-3 text-sm">
              {!selectedDraft && <p className="text-secondary">Sin borrador para esta oportunidad.</p>}
              {selectedDraft && (
                <>
                  <p>
                    <Badge variant={draftVariant(selectedDraft.status)}>{draftStatusLabel(selectedDraft.status)}</Badge>{' '}
                    {selectedDraft.expired && <Badge variant="danger">Vencido</Badge>}{' '}
                    {selectedDraft.stale && <Badge variant="danger">Desactualizado</Badge>}
                  </p>
                  {selectedDraft.expired && (
                    <p className="text-secondary">
                      Este borrador venció: pasaron más de 7 días desde que se creó y ya no se puede aprobar. Podés
                      rechazarlo y generar uno nuevo.
                    </p>
                  )}
                  {selectedDraft.stale && (
                    <p className="text-secondary">
                      Este borrador quedó desactualizado: el mensaje de la oportunidad cambió desde que se creó y ya no
                      se puede aprobar. Podés rechazarlo y generar uno nuevo.
                    </p>
                  )}
                  <pre className="whitespace-pre-wrap text-sm bg-canvas border border-border rounded-control p-3">
                    {selectedDraft.body}
                  </pre>
                  {selectedDraft.status !== 'pending_approval' && (
                    <p className="text-secondary">
                      Decidido por {selectedDraft.decided_by ?? '—'} el{' '}
                      {selectedDraft.decided_at ? formatDateTime(selectedDraft.decided_at) : '—'}
                      {selectedDraft.note ? ` · Motivo: ${selectedDraft.note}` : ''}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'tareas' && (
            <ul className="space-y-2 text-sm">
              {selectedTasks.length === 0 && <li className="text-secondary">Sin tareas para esta oportunidad.</li>}
              {selectedTasks.map((t) => (
                <li key={t.id}>
                  {t.title} — <Badge variant={taskVariant(t.status)}>{taskLabel(t.status)}</Badge> — Agente:{' '}
                  {t.agent_name || t.assigned_to} — vence {formatDate(t.due_at)}
                </li>
              ))}
            </ul>
          )}

          {tab === 'actividad' && (
            <div className="space-y-2 text-sm">
              {auditLoading && <p className="text-secondary">Cargando actividad…</p>}
              {auditError && (
                <>
                  <Alert variant="error">{auditError}</Alert>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setAuditById((prev) => {
                        const next = { ...prev };
                        delete next[selected.id];
                        return next;
                      });
                    }}
                  >
                    Reintentar
                  </Button>
                </>
              )}
              {!auditLoading && !auditError && selectedAudit && selectedAudit.length === 0 && (
                <p className="text-secondary">Sin actividad registrada para esta oportunidad.</p>
              )}
              {!auditLoading &&
                !auditError &&
                selectedAudit &&
                selectedAudit.map((a, i) => (
                  <p key={`${a.created_at}-${a.actor}-${a.action}-${i}`}>
                    {formatDateTime(a.created_at)} — {a.actor}: {auditActionLabel(a.action)} (
                    {auditEntityLabel(a.entity)}){auditDetail(a)}
                  </p>
                ))}
            </div>
          )}
        </DetailPanel>
      )}
    </div>
  );
}
