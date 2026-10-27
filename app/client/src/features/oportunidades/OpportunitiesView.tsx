import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DetailPanel } from '../../components/ui/detail-panel';
import { Dialog } from '../../components/ui/dialog';
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

// Vista Oportunidades real (R1) + ajuste visual R1b: encabezado
// y panel derecho fijo como la referencia de Oportunidades, pero
// SOLO con datos reales. Columnas en el orden de la referencia:
// Oportunidad, Estado, Prioridad, Fuente, Agente, Atención
// humana, Próximo paso. Dos derivaciones honestas, calculadas
// solo con las listas ya cargadas (sin endpoints nuevos):
// - Agente: agent_name o assigned_to de la tarea abierta más
//   próxima de la oportunidad (las tareas vienen ordenadas por
//   vencimiento ascendente); «—» si no hay tarea abierta. No
//   es «Agente IA Asignado»: los agentes son los deterministas
//   reales (Captación, Calificación, Respuesta y propuesta,
//   Seguimiento, QA y políticas).
// - Atención humana: el borrador vigente (el primero por
//   creación DESC) está en pending_approval → «Atención humana
//   requerida»; si no, «Sin pendiente». Un borrador vencido o
//   desactualizado sigue en pending_approval hasta que se
//   decida, así que también marca atención requerida.
// La categoría no se pierde: va en la tercera línea de la
// celda Oportunidad y como filtro real siempre visible en la
// fila única de filtros (R1d; el «Más filtros» de R1b se eliminó).
// OMITIDO de la referencia por falta de fuente real: «Agente
// IA Asignado» (Agente X-1/X-2/X-3), valor estimado,
// probabilidad, fecha de cierre, «Borrador IA», desglose IA con
// gráfico, Interaction Log con correos/notas inventadas, y la
// navegación Dashboard/Contactos/Empresas/Proyectos/Reportes/
// Ajustes (se mantienen las 6 secciones reales). El borrador se
// llama «Borrador», nunca «Borrador IA» (F2-AI DISCARD).
// Paginación en cliente (el servidor devuelve hasta 100 filas
// sin paginar); filtros en cliente.
// R1c (pulido visual, misma funcionalidad): densidad compacta
// en esta vista, sin barras de desplazamiento internas (tabla
// sin scroll horizontal, panel sin scroll propio: la única
// barra es la de la página), diálogo modal para «Nueva
// oportunidad» (componente Dialog compartido, con trampa de
// foco) y panel derecho con diseño de tarjeta/secciones, sin
// cambiar ningún dato.

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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState('resumen');
  const [auditById, setAuditById] = useState<Record<string, AuditEntry[]>>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createCompany, setCreateCompany] = useState('');
  const [createMessage, setCreateMessage] = useState('');
  const [creating, setCreating] = useState(false);
  // R1c: el éxito se muestra en la vista (encima de la tabla)
  // una vez cerrado el diálogo; el error se muestra dentro del
  // diálogo y el diálogo queda abierto.
  const [viewFeedback, setViewFeedback] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

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

  // Lista filtrada y selección efectiva (R1b): se calculan
  // antes de los retornos de carga/error para que el efecto de
  // actividad pueda usar la selección efectiva. Si la selección
  // explícita ya no está en la lista filtrada (o no hay ninguna),
  // la selección efectiva es la primera fila de la lista
  // filtrada, como en la referencia; si la lista está vacía,
  // no hay selección.
  const q = search.trim().toLowerCase();
  const filtered = (data?.opportunities ?? []).filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;
    if (sourceFilter !== 'all' && o.source !== sourceFilter) return false;
    if (categoryFilter !== 'all' && o.category !== categoryFilter) return false;
    if (q) {
      const hay = `${o.contact_name} ${o.company} ${o.message}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const effectiveSelectedId =
    selectedId && filtered.some((o) => o.id === selectedId) ? selectedId : (filtered[0]?.id ?? null);

  // Actividad de la oportunidad seleccionada: se carga al abrir
  // el panel (una sola vez por oportunidad) desde
  // /api/audit?opportunityId=, que ya devuelve los eventos
  // directos y los relacionados.
  useEffect(() => {
    if (!effectiveSelectedId || auditById[effectiveSelectedId]) return;
    setAuditLoading(true);
    setAuditError('');
    getOpportunityAudit(effectiveSelectedId)
      .then(({ audit }) => {
        setAuditById((prev) => ({ ...prev, [effectiveSelectedId]: audit }));
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          onSessionExpired();
          return;
        }
        setAuditError(e instanceof ApiError ? e.message : 'No se pudo cargar la actividad.');
      })
      .finally(() => setAuditLoading(false));
  }, [effectiveSelectedId, auditById, onSessionExpired]);

  function openDetail(id: string) {
    setSelectedId(id);
    setTab('resumen');
  }

  // R1f: estables (useCallback) para que el onClose del diálogo
  // no cambie de identidad en cada render y no re-corra su
  // efecto de foco en cada pulsación. Solo usan setters, así
  // que no hay estado capturado que quede desactualizado.
  const clearCreateForm = useCallback(() => {
    setCreateName('');
    setCreateEmail('');
    setCreateCompany('');
    setCreateMessage('');
    setDialogError(null);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    clearCreateForm();
  }, [clearCreateForm]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setDialogError(null);
    setCreating(true);
    try {
      const result = await createOpportunity({
        contactName: createName,
        contactEmail: createEmail,
        company: createCompany,
        message: createMessage,
      });
      clearCreateForm();
      setDialogOpen(false);
      setViewFeedback(result.duplicate ? 'La oportunidad ya estaba registrada.' : 'Oportunidad creada.');
      setPage(0);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setDialogError(err instanceof ApiError ? err.message : 'No se pudo crear la oportunidad.');
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
        <h1 className="text-lg font-semibold">Oportunidades</h1>
        <Alert variant="error">{error || 'No se pudo cargar Oportunidades.'}</Alert>
        <Button type="button" variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);

  // Próximo paso: la tarea abierta más próxima (el servidor ya
  // ordena /api/tasks por vencimiento ascendente). De esa misma
  // tarea sale la columna «Agente» (R1b).
  const nextStepByOpp = new Map<string, TaskFull>();
  for (const t of data.tasks) {
    if (t.status === 'open' && !nextStepByOpp.has(t.opportunity_id)) {
      nextStepByOpp.set(t.opportunity_id, t);
    }
  }

  // Borrador vigente por oportunidad (R1b, columna «Atención
  // humana»): los borradores vienen ordenados por creación
  // DESC, así que el primero de cada oportunidad es el vigente.
  const draftByOpp = new Map<string, DraftFull>();
  for (const d of data.drafts) {
    if (!draftByOpp.has(d.opportunity_id)) {
      draftByOpp.set(d.opportunity_id, d);
    }
  }

  const sources = Array.from(new Set(data.opportunities.map((o) => o.source)));
  const categories = Array.from(new Set(data.opportunities.map((o) => o.category)));

  const selected = effectiveSelectedId ? data.opportunities.find((o) => o.id === effectiveSelectedId) ?? null : null;
  const selectedDraft = selected ? draftByOpp.get(selected.id) ?? null : null;
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Oportunidades</h1>
          <p className="text-sm text-secondary">Centraliza, clasifica y supervisa las oportunidades comerciales</p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          Nueva oportunidad
        </Button>
      </div>

      {viewFeedback && <Alert variant="success">{viewFeedback}</Alert>}

      {/* R1d: la fila de filtros vive en su propia tarjeta a ancho
          completo de la sección, encima de la grilla tabla+panel:
          dentro de la tarjeta de la tabla se partía en dos filas
          por el panel derecho. */}
      <Card compact>
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
              {
                id: 'filter-category',
                label: 'Categoría',
                value: categoryFilter,
                options: [
                  { value: 'all', label: 'Todas' },
                  ...categories.map((c) => ({ value: c, label: categoryLabel(c) })),
                ],
                onChange: (v) => {
                  setCategoryFilter(v);
                  setPage(0);
                },
              },
            ]}
            compact
            layout="single"
            onClear={() => {
              setSearch('');
              setStatusFilter('all');
              setPriorityFilter('all');
              setSourceFilter('all');
              setCategoryFilter('all');
              setPage(0);
            }}
        />
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
      <Card compact pad="p-3">
        <div>
          <Table
            scrollable={false}
            textSize="text-[13px]"
            headers={['Oportunidad', 'Estado', 'Prioridad', 'Fuente', 'Agente', 'Atención humana', 'Próximo paso']}
            empty={pageItems.length === 0}
            emptyText={
              filtered.length === 0 && data.opportunities.length === 0
                ? 'Aún no hay oportunidades. Creá la primera con el formulario de alta manual.'
                : 'Sin resultados para los filtros actuales.'
            }
          >
            {pageItems.map((o) => {
              const next = nextStepByOpp.get(o.id);
              const draft = draftByOpp.get(o.id);
              const needsAttention = draft?.status === 'pending_approval';
              const isSelected = o.id === effectiveSelectedId;
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
                  className={`cursor-pointer hover:bg-primary-subtle ${isSelected ? 'bg-primary/20' : ''}`}
                >
                  <td className="px-1 py-1.5 break-words">
                    <div className="font-semibold">{o.contact_name}</div>
                    <div className="text-secondary">{o.company || '—'}</div>
                    <div className="text-xs text-secondary">{categoryLabel(o.category)}</div>
                  </td>
                  <td className="px-1 py-1.5 break-words">
                    <Badge variant={statusVariant(o.status)} className="whitespace-nowrap">
                      {statusLabel(o.status)}
                    </Badge>
                  </td>
                  <td className="px-1 py-1.5 break-words">
                    <Badge variant={priorityVariant(o.priority)} className="whitespace-nowrap">
                      {priorityLabel(o.priority)}
                    </Badge>
                  </td>
                  <td className="px-1 py-1.5 break-words">{channelLabel(o.source)}</td>
                  <td className="px-1 py-1.5 break-words">{next ? next.agent_name || next.assigned_to : '—'}</td>
                  <td className="px-1 py-1.5 break-words">
                    {needsAttention ? (
                      // R1g: la píldora no puede superar 120 px:
                      // su texto envuelve dentro de la píldora
                      // (centrado) en vez de empujar la tabla
                      // fuera de la tarjeta. El texto no se acorta.
                      <Badge variant="warning" className="max-w-[120px] whitespace-normal text-center leading-tight">
                        Atención humana requerida
                      </Badge>
                    ) : (
                      // R1g: vuelve a envolverse en dos líneas
                      // (R1e lo había fijado en una línea); la
                      // fila ya tiene 3 líneas por Oportunidad,
                      // así que no crece en alto.
                      <span className="text-secondary">Sin pendiente</span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 break-words">{next ? next.title : '—'}</td>
                </tr>
              );
            })}
          </Table>
        </div>
        <div className="mt-3">
          <Pagination page={safePage} pageCount={pageCount} total={filtered.length} from={from} to={to} onPage={setPage} />
        </div>
      </Card>

      {selected ? (
        <DetailPanel
          variant="inline"
          title={selected.contact_name}
          subtitle={selected.company || '—'}
          footer={
            selectedDraft && selectedDraft.status === 'pending_approval' ? (
              <Link to="/aprobaciones">Revisar borrador en Aprobaciones</Link>
            ) : undefined
          }
        >
          <div className="space-y-3 text-sm">
            <p>
              <Badge variant={statusVariant(selected.status)}>{statusLabel(selected.status)}</Badge>
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
              <div>
                <dt className="text-xs text-secondary">Categoría</dt>
                <dd className="font-medium">{categoryLabel(selected.category)}</dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Prioridad</dt>
                <dd className="font-medium">{priorityLabel(selected.priority)}</dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Canal</dt>
                <dd className="font-medium">{channelLabel(selected.source)}</dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Puntaje</dt>
                <dd className="font-medium">{selected.score}</dd>
              </div>
            </dl>
          </div>
          <Tabs tabs={DETAIL_TABS} active={tab} onChange={setTab} scrollable={false} />

          {tab === 'resumen' && (
            <dl className="divide-y divide-border text-sm">
              <div className="py-2 first:pt-0">
                <dt className="text-xs text-secondary">Contacto</dt>
                <dd className="mt-0.5">{selected.contact_name}</dd>
              </div>
              <div className="py-2">
                <dt className="text-xs text-secondary">Correo</dt>
                <dd className="mt-0.5 break-words">{selected.contact_email}</dd>
              </div>
              <div className="py-2">
                <dt className="text-xs text-secondary">Empresa</dt>
                <dd className="mt-0.5">{selected.company || '—'}</dd>
              </div>
              <div className="py-2">
                <dt className="text-xs text-secondary">Mensaje</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{selected.message}</dd>
              </div>
              <div className="py-2">
                <dt className="text-xs text-secondary">Canal</dt>
                <dd className="mt-0.5">{channelLabel(selected.source)}</dd>
              </div>
              <div className="py-2">
                <dt className="text-xs text-secondary">Estado</dt>
                <dd className="mt-0.5">
                  <Badge variant={statusVariant(selected.status)}>{statusLabel(selected.status)}</Badge>
                </dd>
              </div>
              <div className="py-2">
                <dt className="text-xs text-secondary">Puntaje</dt>
                <dd className="mt-0.5">{selected.score}</dd>
              </div>
              <div className="py-2">
                <dt className="text-xs text-secondary">Creada</dt>
                <dd className="mt-0.5">{formatDateTime(selected.created_at)}</dd>
              </div>
              <div className="py-2 last:pb-0">
                <dt className="text-xs text-secondary">Actualizada</dt>
                <dd className="mt-0.5">{formatDateTime(selected.updated_at)}</dd>
              </div>
              <p className="pt-2 text-xs text-secondary">
                El puntaje sale de reglas deterministas (urgencia, presupuesto, empresa, dominio y categoría); el
                desglose por oportunidad no queda guardado.
              </p>
            </dl>
          )}

          {tab === 'borrador' && (
            <div className="space-y-3 text-sm">
              {!selectedDraft && <p className="text-secondary">Sin borrador para esta oportunidad.</p>}
              {selectedDraft && (
                <div className="bg-primary-subtle border border-border rounded-card p-4 space-y-3">
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
                  <pre className="whitespace-pre-wrap text-sm bg-surface border border-border rounded-control p-3">
                    {selectedDraft.body}
                  </pre>
                  {selectedDraft.status !== 'pending_approval' && (
                    <p className="text-xs text-secondary">
                      Decidido por {selectedDraft.decided_by ?? '—'} el{' '}
                      {selectedDraft.decided_at ? formatDateTime(selectedDraft.decided_at) : '—'}
                      {selectedDraft.note ? ` · Motivo: ${selectedDraft.note}` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'tareas' && (
            <ul className="divide-y divide-border text-sm">
              {selectedTasks.length === 0 && <li className="text-secondary">Sin tareas para esta oportunidad.</li>}
              {selectedTasks.map((t) => (
                <li key={t.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{t.title}</span>
                    <Badge variant={taskVariant(t.status)}>{taskLabel(t.status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-secondary">
                    Agente: {t.agent_name || t.assigned_to} · vence {formatDate(t.due_at)}
                  </p>
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
                selectedAudit.length > 0 && (
                  <ol className="space-y-4 border-l-2 border-border ml-2 pl-4">
                    {selectedAudit.map((a, i) => (
                      <li key={`${a.created_at}-${a.actor}-${a.action}-${i}`} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute -left-7 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface"
                        />
                        <p className="text-sm font-medium">
                          {auditActionLabel(a.action)} ({auditEntityLabel(a.entity)})
                        </p>
                        <p className="mt-0.5 text-xs text-secondary">
                          {formatDateTime(a.created_at)} · {a.actor}
                          {auditDetail(a)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
            </div>
          )}
        </DetailPanel>
      ) : (
        <aside className="bg-surface border border-border rounded-card shadow-sm p-4">
          <p className="text-sm text-secondary">Seleccioná una oportunidad para ver su detalle.</p>
        </aside>
      )}
      </div>

      <Dialog open={dialogOpen} title="Nueva oportunidad (alta manual)" onClose={closeDialog}>
        {dialogError && (
          <div className="mb-3">
            <Alert variant="error">{dialogError}</Alert>
          </div>
        )}
        <form onSubmit={onCreate} className="space-y-3">
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
          <div>
            <Label htmlFor="opp-message">Mensaje de la oportunidad</Label>
            <textarea
              id="opp-message"
              required
              value={createMessage}
              onChange={(e) => setCreateMessage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface text-ink border border-border rounded-control min-h-[72px]"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear oportunidad'}
            </Button>
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
