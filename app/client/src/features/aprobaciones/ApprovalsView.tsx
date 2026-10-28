import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { AlertTriangle, Info, Mail } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DetailPanel } from '../../components/ui/detail-panel';
import { Dialog } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Pagination } from '../../components/ui/pagination';
import type { HomeOutletContext } from '../inicio/HomeView';
import {
  ApiError,
  getDraftsDetail,
  getMe,
  getOpportunityList,
  type DraftFull,
  type MeResponse,
  type OpportunityDetail,
} from '../../lib/api';
import {
  categoryLabel,
  formatDate,
  formatDateTime,
  localDate,
  priorityLabel,
} from '../../lib/format';

// R3 — Aprobaciones (vista real, reemplaza el aviso de migración
// de la Fase 3). Sigue el patrón de Tareas (R2): lista de tarjetas
// a la izquierda, panel derecho fijo, paginación en cliente,
// selección con teclado. Todo sale de GET /api/drafts +
// GET /api/opportunities + GET /api/me; nada se inventa (ver
// docs/R3-APROBACIONES-REPORTE.md para el mapeo referencia →
// real y todo lo omitido).
//
// Decisiones honestas que conviene leer antes de tocar esto:
// - "Solicitar cambios" NO existe en el servidor: el equivalente
//   real es Rechazar con nota (la nota queda guardada y un nuevo
//   ingreso genera un borrador fresco). No hay botón de solicitar
//   cambios ni estado intermedio.
// - Aprobar NO acepta nota en el servidor (decideDraft la ignora
//   para approved): el diálogo de aprobar NO tiene campo de nota,
//   para no prometer algo que no se guarda.
// - Aprobar NO envía ningún mensaje externo: solo mueve la
//   oportunidad a seguimiento (o a nueva, al rechazar).
// - R3b: el borrador se puede EDITAR (PATCH, solo admin, solo
//   pendiente vigente): el panel es ancho (480 px, variante wide
//   del DetailPanel; Oportunidades sigue en 360) y muestra la
//   marca "Editado por un humano" cuando corresponde.

const PAGE_SIZE = 20;

type AgeFilter = 'all' | 'today' | 'week' | 'older';
type StateFilter = 'pending' | 'decided' | 'all';

// Antigüedad derivada de created_at en fecha local (misma regla
// que el resto de la app): hoy = mismo día local; esta semana =
// dentro de los últimos 7 días sin contar hoy; anteriores = resto.
function ageOf(d: DraftFull): 'today' | 'week' | 'older' {
  const created = localDate(d.created_at);
  const now = new Date();
  const today = localDate(now.toISOString());
  if (created === today) return 'today';
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return created >= localDate(weekAgo.toISOString()) ? 'week' : 'older';
}

function draftBadge(d: DraftFull): { variant: 'info' | 'success' | 'neutral' | 'danger' | 'warning'; label: string } {
  if (d.status === 'approved') return { variant: 'success', label: 'Aprobado' };
  if (d.status === 'rejected') return { variant: 'neutral', label: 'Rechazado' };
  if (d.stale) return { variant: 'warning', label: 'Desactualizado' };
  if (d.expired) return { variant: 'danger', label: 'Vencido' };
  return { variant: 'info', label: 'Pendiente' };
}

function priorityVariant(p: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (p === 'high') return 'danger';
  if (p === 'medium') return 'warning';
  if (p === 'low') return 'info';
  return 'neutral';
}

// Control segmentado local (píldoras): la FilterBar compartida
// solo ofrece selects + buscador y la referencia pide segmentos.
// Botones con aria-pressed, sin estado inventado.
function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-secondary mb-1">{label}</span>
      <div role="group" aria-label={label} className="inline-flex border border-border rounded-control overflow-hidden bg-surface">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-sm whitespace-nowrap ${
              value === o.value ? 'bg-primary text-white' : 'text-secondary hover:bg-primary-subtle hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ApprovalsData {
  drafts: DraftFull[];
  opportunities: OpportunityDetail[];
  me: MeResponse;
}

async function decideDraft(id: string, decision: 'approve' | 'reject', note: string): Promise<void> {
  const res = await fetch(`/api/drafts/${encodeURIComponent(id)}/${decision}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(decision === 'reject' ? { note } : {}),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = (data ?? {}) as { message?: unknown; error?: unknown };
    const message =
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'string'
          ? body.error
          : `Error ${res.status}`;
    throw new ApiError(message, res.status);
  }
}

export function ApprovalsView() {
  const { setSystemStatus, onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<ApprovalsData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('pending');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [viewFeedback, setViewFeedback] = useState<string | null>(null);

  // R3b: edición humana del borrador (PATCH, solo admin y solo
  // pendiente vigente; el servidor impone ambas cosas).
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [{ drafts }, { opportunities }, me] = await Promise.all([
        getDraftsDetail(),
        getOpportunityList(),
        getMe(),
      ]);
      setData({ drafts, opportunities, me });
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

  const pendingCount = useMemo(
    () => (data?.drafts ?? []).filter((d) => d.status === 'pending_approval').length,
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.drafts ?? []).filter((d) => {
      if (stateFilter === 'pending' && d.status !== 'pending_approval') return false;
      if (stateFilter === 'decided' && d.status === 'pending_approval') return false;
      if (ageFilter !== 'all' && ageOf(d) !== ageFilter) return false;
      const opp = oppById.get(d.opportunity_id);
      if (priorityFilter !== 'all' && opp?.priority !== priorityFilter) return false;
      if (priorityFilter !== 'all' && !opp) return false;
      if (!q) return true;
      return (
        d.contact_name.toLowerCase().includes(q) ||
        d.company.toLowerCase().includes(q) ||
        d.body.toLowerCase().includes(q)
      );
    });
  }, [data, search, stateFilter, ageFilter, priorityFilter, oppById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);

  const effectiveSelectedId = selectedId && filtered.some((d) => d.id === selectedId)
    ? selectedId
    : (filtered[0]?.id ?? null);
  const selected = filtered.find((d) => d.id === effectiveSelectedId) ?? null;
  const selectedOpp = selected ? oppById.get(selected.opportunity_id) : undefined;

  const clearFilters = useCallback(() => {
    setSearch('');
    setStateFilter('pending');
    setAgeFilter('all');
    setPriorityFilter('all');
    setPage(0);
  }, []);

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const decide = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (!selected) return;
      setDeciding(true);
      setDecideError(null);
      try {
        await decideDraft(selected.id, decision, rejectNote);
        setViewFeedback(decision === 'approve' ? 'Borrador aprobado.' : 'Borrador rechazado.');
        setApproveOpen(false);
        setRejectOpen(false);
        setRejectNote('');
        setReloadKey((k) => k + 1);
      } catch (e: unknown) {
        setDecideError(e instanceof ApiError ? e.message : 'No se pudo decidir el borrador.');
      } finally {
        setDeciding(false);
      }
    },
    [selected, rejectNote],
  );

  const saveEdit = useCallback(async () => {
    if (!selected) return;
    const body = editBody.trim();
    if (!body) {
      setEditError('El borrador no puede quedar vacío.');
      return;
    }
    setEditing(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const b = (data ?? {}) as { message?: unknown; error?: unknown };
        throw new ApiError(
          typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : `Error ${res.status}`,
          res.status,
        );
      }
      setViewFeedback('Borrador editado. Sigue pendiente hasta que lo apruebes o rechaces.');
      setEditOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setEditError(e instanceof ApiError ? e.message : 'No se pudo guardar la edición.');
    } finally {
      setEditing(false);
    }
  }, [selected, editBody]);

  if (state === 'loading') {
    return <p className="text-ink">Cargando…</p>;
  }

  if (state === 'error' || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Aprobaciones</h1>
        <Alert variant="error">{error || 'No se pudo cargar Aprobaciones.'}</Alert>
        <Button type="button" variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  const isAdmin = data.me.user.role === 'admin';
  const selectedBadge = selected ? draftBadge(selected) : null;
  const selectedPending = selected?.status === 'pending_approval';
  const selectedBlocked = selectedPending && (selected.expired || selected.stale);
  const selectedBlockedReason = selected?.stale
    ? 'El mensaje de la oportunidad cambió desde que se creó el borrador.'
    : 'Pasaron más de 7 días desde que se creó el borrador.';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">
          Aprobaciones{' '}
          <span className="ml-1 align-middle bg-primary-subtle text-primary rounded-full px-2 py-0.5 text-xs font-medium">
            {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}
          </span>
        </h1>
        {/* A2: subtítulo directo sobre el fondo: secondary 4,48:1, tinta 15,33:1. */}
        <p className="text-sm text-ink">Revisa las acciones que requieren autorización antes de ejecutarse</p>
      </div>

      <Card compact pad="p-3">
        <div className="flex flex-wrap items-end gap-4">
          <Segmented
            label="Estado"
            value={stateFilter}
            onChange={(v) => { setStateFilter(v as StateFilter); setPage(0); }}
            options={[
              { value: 'pending', label: 'Pendientes' },
              { value: 'decided', label: 'Decididas' },
              { value: 'all', label: 'Todas' },
            ]}
          />
          <Segmented
            label="Antigüedad"
            value={ageFilter}
            onChange={(v) => { setAgeFilter(v as AgeFilter); setPage(0); }}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'today', label: 'Hoy' },
              { value: 'week', label: 'Esta semana' },
              { value: 'older', label: 'Anteriores' },
            ]}
          />
          <Segmented
            label="Prioridad"
            value={priorityFilter}
            onChange={(v) => { setPriorityFilter(v); setPage(0); }}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'high', label: 'Alta' },
              { value: 'medium', label: 'Media' },
              { value: 'low', label: 'Baja' },
            ]}
          />
          <div className="flex-1 min-w-48">
            <Label htmlFor="filter-search">Buscar</Label>
            <input
              id="filter-search"
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar contacto, empresa o texto del borrador…"
              className="w-full px-3 py-2 text-sm bg-surface text-ink border border-border rounded-control"
            />
          </div>
          <Button type="button" variant="secondary" onClick={clearFilters}>
            Limpiar
          </Button>
        </div>
      </Card>

      {viewFeedback && <Alert variant="success">{viewFeedback}</Alert>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] items-start">
        <div className="space-y-3">
          {pageItems.length === 0 && (
            <Card compact pad="p-3">
              <p className="text-secondary">
                {filtered.length === 0 && data.drafts.length === 0
                  ? 'Todavía no hay borradores. Se crean solos cuando ingresa una oportunidad.'
                  : 'Sin resultados para los filtros actuales.'}
              </p>
            </Card>
          )}
          {pageItems.map((d) => {
            const badge = draftBadge(d);
            const opp = oppById.get(d.opportunity_id);
            const isSelected = d.id === effectiveSelectedId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => openDetail(d.id)}
                className={`w-full text-left bg-surface border border-border rounded-card p-4 hover:border-primary ${
                  isSelected ? 'bg-primary/20' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-indigo-100 text-indigo-700" aria-hidden="true">
                    <Mail size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold break-words">Propuesta para {d.contact_name}</div>
                    <div className={`text-sm ${isSelected ? 'text-ink' : 'text-secondary'}`}>
                      Agente: Respuesta y propuesta
                    </div>
                    <div className={`text-sm ${isSelected ? 'text-ink' : 'text-secondary'}`}>
                      Cliente: {d.company || '—'}
                    </div>
                    <div className={`text-sm ${isSelected ? 'text-ink' : 'text-secondary'}`}>
                      Creada: {formatDateTime(d.created_at)}
                    </div>
                    <div className={`text-sm ${isSelected ? 'text-ink' : 'text-secondary'}`}>
                      Motivo: {opp ? `${categoryLabel(opp.category)} · ${priorityLabel(opp.priority)}` : '—'}
                    </div>
                    <div className="mt-2">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          <Pagination page={safePage} pageCount={pageCount} total={filtered.length} from={from} to={to} onPage={setPage} />
        </div>

        {selected && selectedBadge && (
          <DetailPanel
            variant="inline"
            wide
            title={`Revisión: propuesta para ${selected.contact_name}`}
            subtitle={`${selected.company || 'Sin empresa'} · Creada ${formatDateTime(selected.created_at)}`}
            footer={
              selectedPending && isAdmin ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={selectedBlocked}
                    onClick={() => { setEditError(null); setEditBody(selected.body); setEditOpen(true); }}
                  >
                    Editar borrador
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={selectedBlocked}
                    onClick={() => { setDecideError(null); setRejectNote(''); setRejectOpen(true); }}
                  >
                    Rechazar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={selectedBlocked}
                    onClick={() => { setDecideError(null); setApproveOpen(true); }}
                  >
                    Aprobar
                  </Button>
                </>
              ) : undefined
            }
          >
            <p>
              <Badge variant={selectedBadge.variant}>{selectedBadge.label}</Badge>
            </p>

            <div>
              <h3 className="text-sm font-semibold">Contenido exacto del borrador</h3>
              {selected.edited && (
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="info">Editado por un humano</Badge>
                  {selected.edited_at && (
                    <span className="text-xs text-secondary">{formatDateTime(selected.edited_at)}</span>
                  )}
                </p>
              )}
              <p className="mt-2 border border-border rounded-control p-3 bg-canvas whitespace-pre-wrap break-words text-sm">
                {selected.body}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Datos contextuales</h3>
              {/* R4: dos columnas (pedido del usuario), mismos campos
                  y mismo contenido que la lista vertical anterior. */}
              <dl className="mt-2 grid grid-cols-2 gap-x-4 text-sm">
                <div className="border-b border-border py-2">
                  <dt className="text-xs text-secondary">Cliente</dt>
                  <dd className="font-medium break-words">{selected.company || '—'}</dd>
                </div>
                <div className="border-b border-border py-2">
                  <dt className="text-xs text-secondary">Contacto</dt>
                  <dd className="font-medium break-words">{selected.contact_name}</dd>
                </div>
                <div className="border-b border-border py-2">
                  <dt className="text-xs text-secondary">Correo</dt>
                  <dd className="font-medium break-words">{selectedOpp ? selectedOpp.contact_email : '—'}</dd>
                </div>
                <div className="border-b border-border py-2">
                  <dt className="text-xs text-secondary">Categoría</dt>
                  <dd className="font-medium break-words">{selectedOpp ? categoryLabel(selectedOpp.category) : '—'}</dd>
                </div>
                <div className="border-b border-border py-2">
                  <dt className="text-xs text-secondary">Prioridad</dt>
                  <dd className="font-medium break-words">{selectedOpp ? priorityLabel(selectedOpp.priority) : '—'}</dd>
                </div>
                <div className="border-b border-border py-2">
                  <dt className="text-xs text-secondary">Puntaje</dt>
                  <dd className="font-medium break-words">{selectedOpp ? selectedOpp.score : '—'}</dd>
                </div>
                <div className="border-b border-border py-2">
                  <dt className="text-xs text-secondary">Canal</dt>
                  <dd className="font-medium break-words">{selected.opportunity_source === 'manual' ? 'Alta manual' : selected.opportunity_source === 'webhook' ? 'Entrada externa' : selected.opportunity_source}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Riesgos y Advertencias</h3>
              {!selected.expired && !selected.stale && selectedPending && (
                <p className="mt-2 text-sm text-secondary">Sin advertencias: el borrador está vigente.</p>
              )}
              {selected.expired && (
                <p className="mt-2 flex gap-2 text-sm">
                  <AlertTriangle size={16} className="shrink-0 text-danger" aria-hidden="true" />
                  <span>Vencido: pasaron más de 7 días desde que se creó y ya no se puede decidir.</span>
                </p>
              )}
              {selected.stale && (
                <p className="mt-2 flex gap-2 text-sm">
                  <AlertTriangle size={16} className="shrink-0 text-warning" aria-hidden="true" />
                  <span>Desactualizado: el mensaje de la oportunidad cambió desde que se creó el borrador.</span>
                </p>
              )}
              {!selectedPending && (
                <p className="mt-2 text-sm text-secondary">
                  Decidido por {selected.decided_by ?? '—'} el {selected.decided_at ? formatDateTime(selected.decided_at) : '—'}
                  {selected.note ? ` · Nota: ${selected.note}` : ''}.
                </p>
              )}
              <p className="mt-2 flex gap-2 text-sm text-secondary">
                <Info size={16} className="shrink-0" aria-hidden="true" />
                <span>Aprobar no envía ningún mensaje externo: la oportunidad pasa a seguimiento (al rechazar, vuelve a nueva).</span>
              </p>
            </div>

            {selectedPending && !isAdmin && (
              <Alert variant="error">Solo un admin puede decidir sobre este borrador.</Alert>
            )}
            {selectedPending && isAdmin && selectedBlocked && (
              <p className="text-sm text-secondary">
                Las decisiones y la edición están deshabilitadas: {selectedBlockedReason} El servidor las rechazaría de todos modos.
              </p>
            )}
          </DetailPanel>
        )}
      </div>

      <Dialog
        open={approveOpen}
        onClose={() => { if (!deciding) setApproveOpen(false); }}
        title="Aprobar borrador"
      >
        <p>
          ¿Aprobar la propuesta para {selected?.contact_name}? La oportunidad pasará a seguimiento.
        </p>
        <p className="text-sm text-secondary">Aprobar no envía ningún mensaje externo.</p>
        {decideError && <Alert variant="error">{decideError}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant="primary" disabled={deciding} onClick={() => void decide('approve')}>
            {deciding ? 'Aprobando…' : 'Aprobar'}
          </Button>
          <Button type="button" variant="secondary" disabled={deciding} onClick={() => setApproveOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onClose={() => { if (!deciding) setRejectOpen(false); }}
        title="Rechazar borrador"
      >
        <p>
          ¿Rechazar la propuesta para {selected?.contact_name}? La oportunidad volverá a nueva y, con un nuevo
          ingreso, se generará un borrador fresco.
        </p>
        <div>
          <Label htmlFor="reject-note">Nota (opcional, máx. 1000 caracteres)</Label>
          <textarea
            id="reject-note"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value.slice(0, 1000))}
            rows={4}
            placeholder="Qué debe cambiar en la propuesta…"
            className="w-full px-3 py-2 text-sm bg-surface text-ink border border-border rounded-control"
          />
        </div>
        {decideError && <Alert variant="error">{decideError}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant="danger" disabled={deciding} onClick={() => void decide('reject')}>
            {deciding ? 'Rechazando…' : 'Rechazar'}
          </Button>
          <Button type="button" variant="secondary" disabled={deciding} onClick={() => setRejectOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => { if (!editing) setEditOpen(false); }}
        title="Editar borrador"
      >
        <p>
          Cambiá el texto de la propuesta para {selected?.contact_name}. El borrador sigue pendiente
          hasta que lo apruebes o rechaces, y quedará marcado como editado por un humano.
        </p>
        <div>
          <Label htmlFor="edit-body">Texto del borrador (máx. 5000 caracteres)</Label>
          <textarea
            id="edit-body"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value.slice(0, 5000))}
            rows={10}
            className="w-full px-3 py-2 text-sm bg-surface text-ink border border-border rounded-control whitespace-pre-wrap"
          />
          <p className="mt-1 text-xs text-secondary">{editBody.length} / 5000 caracteres</p>
        </div>
        {editError && <Alert variant="error">{editError}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant="primary" disabled={editing || editBody.trim().length === 0} onClick={() => void saveEdit()}>
            {editing ? 'Guardando…' : 'Guardar edición'}
          </Button>
          <Button type="button" variant="secondary" disabled={editing} onClick={() => setEditOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
