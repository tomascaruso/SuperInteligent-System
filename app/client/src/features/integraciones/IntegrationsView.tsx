// R5b — Integraciones (catálogo honesto, 7ª sección del menú).
// Estructura según la referencia de diseño (categorías, tarjetas
// con estado, panel de detalle con salud, capacidades, logs,
// credenciales y permisos). Los DATOS de la referencia NO se
// copian: sus «Conectado hace 2 minutos», «100% Funcionando» y
// tokens son del ejemplo, no del sistema.
//
// ESTADO REAL (verificado en código):
// - La ÚNICA integración en funcionamiento es el webhook de
//   ingesta (POST /api/ingest/:orgId, routes.ts): firma HMAC
//   obligatoria (401 sin firma válida), idempotencia por clave o
//   por hash del cuerpo (una misma entrega no duplica), límite
//   diario de oportunidades (429) y bloqueo si un agente está en
//   pausa (409). Su estado es «Disponible» (nunca «Conectado» con
//   una sinc inventada) y su actividad se deriva de endpoints
//   existentes: oportunidades con source 'webhook' y eventos de
//   auditoría opportunity.created sobre esas oportunidades.
// - Slack, Teams, Gmail, Zoom, Salesforce, HubSpot y Pipedrive NO
//   tienen conexión real y van como «Disponible próximamente»,
//   sin última sinc, sin salud inventada y sin credenciales. La
//   relay de contacto por Apps Script NO es una integración de
//   cliente y no cuenta.
// - NO se muestra ni se revela ningún secreto: la URL de ingesta
//   y el secreto HMAC los gestiona PENSIA como operador y no se
//   exponen en la interfaz (no hay botón Mostrar/Copiar ni
//   endpoint que devuelva secretos).
//
// «SISTEMA PREPARADO» (qué significa en código): el catálogo es
// un registro tipado (INTEGRATIONS abajo). Agregar un proveedor
// futuro = una entrada en el registro + su flujo OAuth y su
// fuente de estado real; la vista, los filtros y el detalle no se
// reescriben. Cuando un proveedor tenga conexión real, su entrada
// pasa a status 'available' y su detalle se alimenta de endpoints
// reales, como hoy hace el webhook. Lo NO construido (a propósito)
// está listado en docs/R5B-INTEGRACIONES-REPORTE.md: OAuth por
// proveedor, almacenamiento cifrado de tokens y sincronizaciones.
//
// Iconos: Lucide genéricos, NUNCA logos de marcas copiados.
//
// PRESENTACIÓN (refinamiento del usuario): además de las pestañas
// de filtro por categoría, las herramientas se presentan AGRUPADAS
// por categoría: un menú/índice por funcionalidad arriba y, debajo,
// cada categoría como sección propia con su título, una línea
// descriptiva de para qué sirve la categoría y sus tarjetas. Las
// descripciones describen la funcionalidad de la categoría; NO
// afirman conexiones existentes (los estados honestos no cambian).
// El subtítulo declara el objetivo de la sección: conectar las
// herramientas de una organización con SIS para ayudar a cumplir
// sus objetivos.
//
// R5c (pedido del usuario): el panel de filtro (campo «Buscar» +
// pestañas «Categoría») se quitó y se reemplazó por un icono de
// búsqueda en el encabezado que despliega el campo (foco
// automático; Escape o X lo cierran y limpian la búsqueda). La
// navegación por categoría sigue siendo el índice por
// funcionalidad (scroll a la sección); las pestañas ya no existen.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import {
  Cloud,
  Layers,
  Mail,
  MessageSquare,
  Search,
  Target,
  Users,
  Video,
  Webhook,
  X,
} from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { DetailPanel } from '../../components/ui/detail-panel';
import { Input } from '../../components/ui/input';
import type { HomeOutletContext } from '../inicio/HomeView';
import {
  ApiError,
  getAudit,
  getOpportunityList,
  type AuditEntry,
  type OpportunityDetail,
} from '../../lib/api';
import { formatDateTime } from '../../lib/format';

type Category = 'Comunicación' | 'CRM y ventas' | 'Gestión de datos' | 'Automatización' | 'API & Webhooks';

const CATEGORIES: Category[] = [
  'Comunicación',
  'CRM y ventas',
  'Gestión de datos',
  'Automatización',
  'API & Webhooks',
];

// Descripción de para qué sirve cada categoría (palabras del
// usuario). No afirma conexiones: solo la funcionalidad.
const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  'Comunicación': 'Herramientas de comunicación.',
  'CRM y ventas': 'Herramientas de gestión de clientes y ventas.',
  'Gestión de datos': 'Herramientas de gestión de datos.',
  'Automatización': 'Herramientas de automatización.',
  'API & Webhooks': 'Herramientas de conexión por API y webhooks.',
};

// IDs estables para el índice (el ancla # no se usa: HashRouter
// la interpretaría como ruta; el índice desplaza por scroll).
const CATEGORY_IDS: Record<Category, string> = {
  'Comunicación': 'cat-comunicacion',
  'CRM y ventas': 'cat-crm-y-ventas',
  'Gestión de datos': 'cat-gestion-de-datos',
  'Automatización': 'cat-automatizacion',
  'API & Webhooks': 'cat-api-webhooks',
};

// Una entrada del catálogo. `capabilities` son REALES solo cuando
// status es 'available'; cuando es 'coming_soon' son PREVISTAS y
// el detalle lo rotula así, sin presentarlas como existentes.
// `oauthNote` documenta qué faltaría para conectar de verdad.
interface IntegrationDef {
  id: string;
  name: string;
  category: Category;
  icon: typeof Mail;
  pill: string;
  status: 'available' | 'coming_soon';
  summary: string;
  capabilities: string[];
  oauthNote: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'webhook',
    name: 'Webhook de ingesta',
    category: 'API & Webhooks',
    icon: Webhook,
    pill: 'bg-indigo-100 text-indigo-800',
    status: 'available',
    summary:
      'Recibe oportunidades desde formularios y sistemas externos. Es la única integración en funcionamiento.',
    capabilities: [
      'Recepción de oportunidades desde sistemas externos',
      'Firma HMAC obligatoria: sin firma válida la recepción se rechaza',
      'Idempotencia: una misma entrega no crea oportunidades duplicadas',
      'Límite diario de oportunidades por organización',
    ],
    oauthNote: 'No usa OAuth: la autenticación es por firma HMAC entre el sistema externo y SIS.',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Comunicación',
    icon: MessageSquare,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Mensajería del equipo. Conexión real aún no disponible.',
    capabilities: [
      'Enviar notificaciones a canales',
      'Enviar mensajes directos',
      'Actualizar estados desde SIS',
    ],
    oauthNote: 'Requerirá OAuth de Slack y permisos de canales cuando se construya.',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    category: 'Comunicación',
    icon: Users,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Mensajería del equipo. Conexión real aún no disponible.',
    capabilities: [
      'Enviar notificaciones a canales y chats',
      'Publicar resúmenes de actividad',
    ],
    oauthNote: 'Requerirá OAuth de Microsoft y permisos de equipos cuando se construya.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Comunicación',
    icon: Mail,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Correo del equipo. Conexión real aún no disponible.',
    capabilities: [
      'Enviar correos desde SIS',
      'Registrar respuestas en la oportunidad',
    ],
    oauthNote: 'Requerirá OAuth de Google y permisos de correo cuando se construya.',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'Comunicación',
    icon: Video,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Videollamadas. Conexión real aún no disponible.',
    capabilities: [
      'Crear reuniones desde la oportunidad',
      'Adjuntar el enlace a la tarea',
    ],
    oauthNote: 'Requerirá OAuth de Zoom cuando se construya.',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'CRM y ventas',
    icon: Cloud,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'CRM de ventas. Conexión real aún no disponible.',
    capabilities: [
      'Sincronizar oportunidades con objetos de Salesforce',
      'Actualizar etapas desde SIS',
    ],
    oauthNote: 'Requerirá OAuth de Salesforce cuando se construya.',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM y ventas',
    icon: Target,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'CRM y marketing. Conexión real aún no disponible.',
    capabilities: [
      'Sincronizar contactos y negocios',
      'Registrar actividad en la ficha del contacto',
    ],
    oauthNote: 'Requerirá OAuth de HubSpot cuando se construya.',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    category: 'CRM y ventas',
    icon: Layers,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'CRM de ventas. Conexión real aún no disponible.',
    capabilities: [
      'Sincronizar negocios y personas',
      'Actualizar etapas del pipeline',
    ],
    oauthNote: 'Requerirá OAuth de Pipedrive cuando se construya.',
  },
];

export function IntegrationsView() {
  const { onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityDetail[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('webhook');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError(null);
    (async () => {
      try {
        const [oppsRes, auditRes] = await Promise.all([getOpportunityList(), getAudit()]);
        if (!cancelled) {
          setOpportunities(oppsRes.opportunities);
          setAudit(auditRes.audit);
          setState('ready');
        }
      } catch (e: unknown) {
        if (e instanceof ApiError && e.status === 401) {
          onSessionExpired();
          return;
        }
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'No se pudo cargar Integraciones.');
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, onSessionExpired]);

  // Actividad REAL del webhook, derivada de endpoints existentes
  // (sin endpoint nuevo): oportunidades con source 'webhook' y
  // sus eventos opportunity.created en auditoría.
  const webhookData = useMemo(() => {
    const webhookOpps = opportunities.filter((o) => o.source === 'webhook');
    const ids = new Set(webhookOpps.map((o) => o.id));
    const byId = new Map(webhookOpps.map((o) => [o.id, o]));
    const events = audit
      .filter((e) => e.action === 'opportunity.created' && ids.has(e.entity_id))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const last = webhookOpps.length > 0 ? webhookOpps.map((o) => o.created_at).sort().at(-1)! : null;
    return { count: webhookOpps.length, last, events, byId };
  }, [opportunities, audit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return INTEGRATIONS.filter((i) => {
      if (q && !`${i.name} ${i.category} ${i.summary}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search]);

  const selected = INTEGRATIONS.find((i) => i.id === selectedId) ?? INTEGRATIONS[0];

  // El índice lista solo secciones que realmente se muestran: con
  // búsqueda activa, una categoría sin coincidencias se oculta
  // (no dice «Aún no hay» cuando sí tiene integraciones que no
  // coinciden); sin búsqueda, las categorías vacías se muestran
  // con su mensaje honesto y también aparecen en el índice.
  const indexCategories = CATEGORIES.filter((c) => {
    if (filtered.some((i) => i.category === c)) return true;
    if (search.trim() === '') return true;
    return false;
  });

  // Cerrar la búsqueda limpia el texto y vuelve a mostrar todo.
  const closeSearch = useCallback(() => {
    setSearch('');
    setSearchOpen(false);
  }, []);

  // Índice por funcionalidad: desplaza a la sección (no usa ancla
  // #: HashRouter la interpretaría como ruta).
  const scrollToCategory = useCallback((category: Category) => {
    document.getElementById(CATEGORY_IDS[category])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (state === 'loading') {
    return <p className="text-ink">Cargando…</p>;
  }

  if (state === 'error') {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Integraciones</h1>
        <Alert variant="error">{error || 'No se pudo cargar Integraciones.'}</Alert>
        <Button type="button" variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  const sectionClass = 'mt-6 border-t border-border pt-5';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Integraciones</h1>
          <p className="text-sm text-secondary">
            Conecta las herramientas de tu organización con SIS para ayudar a cumplir sus objetivos
          </p>
        </div>
        {!searchOpen && (
          <button
            type="button"
            aria-label="Buscar integraciones"
            title="Buscar integraciones"
            onClick={() => setSearchOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-secondary hover:border-primary hover:text-ink"
          >
            <Search size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      {searchOpen && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            type="search"
            aria-label="Buscar integraciones"
            placeholder="Buscar integración…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSearch();
            }}
          />
          <button
            type="button"
            aria-label="Cerrar búsqueda"
            title="Cerrar búsqueda"
            onClick={closeSearch}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-secondary hover:border-primary hover:text-ink"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className="text-xs text-muted">
        La única integración en funcionamiento hoy es el webhook de ingesta. El resto del catálogo
        está marcado como disponible próximamente: las conexiones reales llegarán proveedor por
        proveedor, sin estados ni sincronizaciones de ejemplo.
      </p>

      <nav aria-label="Índice por funcionalidad" className="flex flex-wrap gap-2">
        {indexCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => scrollToCategory(c)}
            className="px-3 py-1.5 text-sm rounded-control border border-border bg-surface text-secondary hover:border-primary hover:text-ink"
          >
            {c}
          </button>
        ))}
      </nav>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] items-start">
        <div className="space-y-6">
          {CATEGORIES.map((category) => {
            const cards = filtered.filter((i) => i.category === category);
            if (cards.length === 0) {
              // Con búsqueda activa, la sección se oculta: decir
              // «Aún no hay» sería falso (las integraciones
              // existen, solo no coinciden con la búsqueda).
              if (search.trim() !== '') return null;
              return (
                <div key={category} id={CATEGORY_IDS[category]} className="scroll-mt-4">
                  <h2 className="text-base font-semibold">{category}</h2>
                  <p className="mt-1 text-sm text-secondary">{CATEGORY_DESCRIPTIONS[category]}</p>
                  <p className="mt-1 text-sm text-secondary">
                    Aún no hay integraciones en esta categoría.
                  </p>
                </div>
              );
            }
            return (
              <div key={category} id={CATEGORY_IDS[category]} className="scroll-mt-4">
                <h2 className="text-base font-semibold">{category}</h2>
                <p className="mt-1 text-sm text-secondary">{CATEGORY_DESCRIPTIONS[category]}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {cards.map((i) => {
                    const { icon: Icon, pill } = { icon: i.icon, pill: i.pill };
                    const isSelected = i.id === selected.id;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => setSelectedId(i.id)}
                        className={`w-full text-left bg-surface border rounded-card p-4 hover:border-primary ${isSelected ? 'border-primary' : 'border-border'}`}
                      >
                        <span className="flex items-start gap-3">
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control ${pill}`}
                            aria-hidden="true"
                          >
                            <Icon size={22} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{i.name}</span>
                              {i.status === 'available' ? (
                                <Badge variant="info" compact>
                                  Disponible
                                </Badge>
                              ) : (
                                <Badge variant="warning" compact>
                                  Disponible próximamente
                                </Badge>
                              )}
                            </span>
                            <span className="mt-1 block text-sm text-secondary">{i.summary}</span>
                            {i.id === 'webhook' ? (
                              <span className="mt-1 block text-sm">
                                Recepciones por webhook: {webhookData.count}
                                {' · '}
                                {webhookData.last
                                  ? `Última recepción: ${formatDateTime(webhookData.last)}`
                                  : 'Sin recepciones todavía'}
                              </span>
                            ) : (
                              <span className="mt-1 block text-sm text-secondary">
                                Conexión real aún no disponible.
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-secondary">Sin resultados para la búsqueda actual.</p>
          )}
        </div>

        <DetailPanel
          variant="inline"
          wide
          title={`Integración: ${selected.name}`}
          subtitle={`${selected.category} · ${selected.status === 'available' ? 'Disponible' : 'Disponible próximamente'}`}
        >
          <div>
            <div className="flex flex-wrap gap-2">
              {selected.status === 'available' ? (
                <Badge variant="info" compact>
                  Disponible
                </Badge>
              ) : (
                <Badge variant="warning" compact>
                  Disponible próximamente
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-secondary">{selected.summary}</p>
          </div>

          {selected.status === 'available' ? (
            <>
              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Salud de la conexión</h3>
                <p className="mt-1 text-sm">
                  Recepciones por webhook: {webhookData.count}
                </p>
                <p className="mt-1 text-sm">
                  {webhookData.last
                    ? `Última recepción: ${formatDateTime(webhookData.last)}`
                    : 'Sin recepciones todavía'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  La salud se mide con recepciones reales; no se muestra un porcentaje porque no
                  hay una medición de disponibilidad.
                </p>
              </div>

              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Capacidades</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {selected.capabilities.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Registros de eventos</h3>
                {webhookData.events.length === 0 ? (
                  <p className="mt-1 text-sm text-secondary">Sin recepciones todavía.</p>
                ) : (
                  webhookData.events.slice(-5).reverse().map((e) => {
                    const o = webhookData.byId.get(e.entity_id);
                    return (
                      <p key={e.id} className="mt-2 text-sm">
                        {formatDateTime(e.created_at)} — Oportunidad recibida por webhook
                        {o ? `: ${[o.contact_name, o.company].filter(Boolean).join(' · ')}` : ''}
                      </p>
                    );
                  })
                )}
              </div>

              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Credenciales</h3>
                <p className="mt-1 text-sm text-secondary">
                  La URL de ingesta y el secreto HMAC los gestiona PENSIA como operador y no se
                  exponen en la interfaz. No hay botones para mostrar ni copiar secretos.
                </p>
              </div>

              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Permisos</h3>
                <p className="mt-1 text-sm text-secondary">{selected.oauthNote}</p>
              </div>
            </>
          ) : (
            <>
              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Estado</h3>
                <p className="mt-1 text-sm text-secondary">
                  Esta integración todavía no tiene conexión real. Las capacidades de abajo son
                  previstas, no funciones existentes.
                </p>
              </div>

              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Capacidades previstas</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {selected.capabilities.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Registros de eventos</h3>
                <p className="mt-1 text-sm text-secondary">
                  Sin registros: la conexión aún no existe.
                </p>
              </div>

              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Credenciales</h3>
                <p className="mt-1 text-sm text-secondary">
                  Sin credenciales: no hay conexión que configurar.
                </p>
              </div>

              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Permisos</h3>
                <p className="mt-1 text-sm text-secondary">{selected.oauthNote}</p>
              </div>

              <div className={sectionClass}>
                <Button type="button" variant="secondary" disabled>
                  Notificar
                </Button>
                <p className="mt-1 text-xs text-muted">
                  El aviso de disponibilidad aún no está disponible.
                </p>
              </div>
            </>
          )}
        </DetailPanel>
      </div>
    </div>
  );
}
