import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import type { SystemStatus } from '../../components/layout/AppLayout';
import {
  ApiError,
  getAudit,
  getDrafts,
  getExecutions,
  getOpenTasks,
  getOpportunities,
  getStats,
  type AuditEntry,
  type DraftSummary,
  type ExecutionSummary,
  type OpportunitySummary,
  type StatsResponse,
  type TaskSummary,
} from '../../lib/api';
import {
  auditActionLabel,
  auditEntityLabel,
  categoryLabel,
  formatDate,
  formatDateTime,
  localDate,
  plural,
  priorityLabel,
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
  openTasks: TaskSummary[];
  pendingDrafts: number;
  failedExecutions: number;
  opportunities: OpportunitySummary[];
  audit: AuditEntry[];
}

// Vista Inicio real (Fase 4): misma composición que el vanilla
// (#view-inicio): 4 tarjetas de indicadores, acciones
// prioritarias calculadas con los datos ya cargados y actividad
// reciente con los últimos 5 eventos comerciales. Todo número
// visible sale de la API real; si alguna carga falla, no se
// muestran tarjetas con ceros falsos: se muestra el error y se
// puede reintentar.
export function HomeView() {
  const { setSystemStatus, onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [stats, { tasks }, { drafts }, { executions }, { opportunities }, { audit }] = await Promise.all([
        getStats(),
        getOpenTasks(),
        getDrafts(),
        getExecutions(),
        getOpportunities(),
        getAudit(),
      ]);
      setData({
        stats,
        openTasks: tasks,
        pendingDrafts: drafts.filter((d: DraftSummary) => d.status === 'pending_approval').length,
        failedExecutions: executions.filter((e: ExecutionSummary) => e.status === 'failed').length,
        opportunities,
        audit,
      });
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

  // Acciones prioritarias, misma lógica del vanilla: tareas
  // abiertas vencidas (fecha local anterior a hoy), borradores
  // pendientes y ejecuciones fallidas; sin nada urgente, el
  // texto lo dice.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const priorityItems: Array<{ key: string; node: ReactNode }> = [];
  data.openTasks
    .filter((t) => localDate(t.due_at) < today)
    .forEach((t) => {
      priorityItems.push({
        key: `task-${t.id}`,
        node: (
          <>
            {t.title} — venció {formatDate(t.due_at)} <Link to="/tareas">Ver tareas</Link>
          </>
        ),
      });
    });
  if (data.pendingDrafts > 0) {
    priorityItems.push({
      key: 'drafts',
      node: (
        <>
          {plural(data.pendingDrafts, 'borrador pendiente', 'borradores pendientes')} de aprobación —{' '}
          <Link to="/aprobaciones">Revisar</Link>
        </>
      ),
    });
  }
  if (data.failedExecutions > 0) {
    priorityItems.push({
      key: 'failed',
      node: (
        <>
          {plural(data.failedExecutions, 'ejecución fallida', 'ejecuciones fallidas')} —{' '}
          <Link to="/actividad">Ver actividad</Link>
        </>
      ),
    });
  }

  // Actividad reciente: la auditoría completa menos los inicios
  // de sesión (que tapaban todo en el vanilla), primeros 5. El
  // detalle resuelve la oportunidad citada a su contacto, como
  // el vanilla; si no cita oportunidad, muestra categoría y
  // prioridad cuando vienen.
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

  const statCards = [
    { to: '/oportunidades', value: data.stats.opportunities, label: 'Oportunidades' },
    { to: '/tareas', value: data.stats.openTasks, label: 'Tareas pendientes' },
    { to: '/aprobaciones', value: data.stats.pendingDrafts, label: 'Aprobaciones pendientes' },
    { to: '/actividad', value: data.stats.failedExecutions, label: 'Ejecuciones fallidas' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Centro de operaciones</h1>
        <p className="text-secondary">Qué requiere atención y qué está pasando.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="bg-surface border border-border rounded-card p-6 no-underline hover:border-primary"
          >
            <span className="block text-[32px] font-semibold text-ink">{card.value}</span>
            <span className="block text-sm text-secondary">{card.label}</span>
          </Link>
        ))}
      </div>

      <Card>
        <h2 className="text-base font-semibold">Acciones prioritarias</h2>
        <ul className="mt-2 space-y-1">
          {priorityItems.length > 0 ? (
            priorityItems.map((item) => <li key={item.key}>{item.node}</li>)
          ) : (
            <li>Sin acciones urgentes.</li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Actividad reciente</h2>
        <ul className="mt-2 space-y-1">
          {businessAudit.length > 0 ? (
            businessAudit.map((a, i) => (
              <li key={`${a.created_at}-${a.actor}-${a.action}-${i}`}>
                {formatDateTime(a.created_at)} — {a.actor}: {auditActionLabel(a.action)} (
                {auditEntityLabel(a.entity)}){auditDetail(a)}
              </li>
            ))
          ) : (
            <li className="text-secondary">Sin actividad comercial todavía.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
