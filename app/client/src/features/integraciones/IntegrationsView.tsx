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
// automático; Escape o X lo cierran y limpian la búsqueda).
//
// R5d (pedido del usuario, con dos correcciones): el índice por
// funcionalidad FILTRA la vista (vista única: solo la categoría
// elegida; «Todas» vuelve a todo) en lugar de desplazar con
// scroll, y se combina con la búsqueda (AND). El catálogo quedó
// en 4 tarjetas por categoría (20 en total): Comunicación sin
// cambios; CRM y ventas suma Zoho CRM; Gestión de datos suma
// Airtable, Google Sheets, Notion y Google Drive; Automatización
// suma Zapier, Make, n8n y Microsoft Power Automate; API &
// Webhooks suma Postman, Pipedream e Insomnia junto al webhook
// de ingesta, la única real. Las 10 nuevas son 'coming_soon'.
//
// F1 (28-oct-2026): Gmail DEJA de ser solo catálogo: se puede
// conectar de verdad por OAuth desde esta vista (solo envío, y
// solo si el operador configuró Google). Su tarjeta muestra el
// estado REAL de GET /api/connections: sin conexión sigue
// 'coming_soon'; con conexión verificada muestra «Disponible»
// con la cuenta conectada (nunca «Conectado» inventado ni
// secretos). WhatsApp entra como entrada nueva 'coming_soon',
// así que Comunicación pasa a 5 tarjetas y el total a 21,
// rompiendo la regla R5d de 4 por categoría (registrado en
// docs/F0F1-GMAIL-REPORTE.md).
//
// F2 (28-oct-2026): WhatsApp SIGUE el mismo criterio que Gmail:
// se conecta de verdad desde esta vista (número Business + ID de
// número + token de sistema, guardados cifrados, con verificación
// real contra la Graph API de Meta). Sin conexión sigue
// 'coming_soon'; con conexión verificada muestra «Disponible»
// con el número conectado. El token nunca se muestra ni se
// devuelve: el formulario lo pide como contraseña y se limpia
// al conectar.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import {
  Briefcase,
  Cloud,
  Folder,
  Layers,
  Mail,
  MessageSquare,
  Moon,
  Network,
  NotebookPen,
  Plug,
  Repeat,
  Search,
  Send,
  Sheet,
  Table,
  Target,
  Users,
  Video,
  Webhook,
  Workflow,
  X,
  Zap,
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
  getConnections,
  getMe,
  getOpportunityList,
  type AuditEntry,
  type Connection,
  type MeResponse,
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

// R5d (pedido del usuario): el índice por funcionalidad ya NO
// desplaza por scroll: FILTRA la vista. Al elegir una categoría
// solo se muestra esa sección (vista única); «Todas» vuelve a la
// vista completa agrupada. Se combina con la búsqueda por icono
// (AND): con una categoría seleccionada, la búsqueda filtra
// dentro de ella.

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
    summary: 'Correo del equipo. Se conecta por OAuth desde esta vista (solo envío).',
    capabilities: [
      'Enviar el borrador aprobado por Gmail cuando el admin elige ese canal',
    ],
    oauthNote:
      'OAuth de Google con alcance mínimo solo gmail.send; las credenciales se guardan cifradas y ningún endpoint las devuelve.',
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
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'Comunicación',
    icon: Send,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Mensajería instantánea. Se conecta desde esta vista (solo envío).',
    capabilities: [
      'Enviar mensajes por WhatsApp Business desde SIS',
      'Enviar el borrador aprobado por el canal elegido',
    ],
    oauthNote:
      'Número de WhatsApp Business + ID de número + token de sistema por cuenta; se guardan cifrados y ningún endpoint los devuelve. La conexión solo queda verificada si Meta responde bien a la lectura del número.',
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
  // R5d: 4 tarjetas por categoría (20 en total). Las 10 entradas
  // nuevas son todas 'coming_soon': sin conexión real, sin última
  // sinc, sin salud inventada y sin fecha de disponibilidad.
  {
    id: 'zoho-crm',
    name: 'Zoho CRM',
    category: 'CRM y ventas',
    icon: Briefcase,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'CRM de ventas. Conexión real aún no disponible.',
    capabilities: [
      'Sincronizar contactos y negocios',
      'Actualizar etapas del pipeline',
    ],
    oauthNote: 'Requerirá OAuth de Zoho cuando se construya.',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    category: 'Gestión de datos',
    icon: Table,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Bases de datos flexibles. Conexión real aún no disponible.',
    capabilities: [
      'Leer y escribir registros en bases',
      'Sincronizar campos con la oportunidad',
    ],
    oauthNote: 'Requerirá OAuth de Airtable cuando se construya.',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    category: 'Gestión de datos',
    icon: Sheet,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Hojas de cálculo. Conexión real aún no disponible.',
    capabilities: [
      'Exportar oportunidades a hojas',
      'Leer filas como fuente de datos',
    ],
    oauthNote: 'Requerirá OAuth de Google cuando se construya.',
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Gestión de datos',
    icon: NotebookPen,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Notas y bases de conocimiento. Conexión real aún no disponible.',
    capabilities: [
      'Crear páginas desde oportunidades',
      'Consultar bases de conocimiento',
    ],
    oauthNote: 'Requerirá OAuth de Notion cuando se construya.',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'Gestión de datos',
    icon: Folder,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Archivos en la nube. Conexión real aún no disponible.',
    capabilities: [
      'Adjuntar archivos a la oportunidad',
      'Guardar documentos generados',
    ],
    oauthNote: 'Requerirá OAuth de Google cuando se construya.',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'Automatización',
    icon: Zap,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Automatización entre aplicaciones. Conexión real aún no disponible.',
    capabilities: [
      'Disparar flujos cuando cambia una oportunidad',
      'Crear oportunidades desde otras aplicaciones',
    ],
    oauthNote: 'Requerirá OAuth de Zapier cuando se construya.',
  },
  {
    id: 'make',
    name: 'Make',
    category: 'Automatización',
    icon: Workflow,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Automatización visual de flujos. Conexión real aún no disponible.',
    capabilities: [
      'Armar escenarios con datos de SIS',
      'Sincronizar oportunidades entre sistemas',
    ],
    oauthNote: 'Requerirá OAuth de Make cuando se construya.',
  },
  {
    id: 'n8n',
    name: 'n8n',
    category: 'Automatización',
    icon: Network,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Automatización de flujos. Conexión real aún no disponible.',
    capabilities: [
      'Crear flujos con nodos de SIS',
      'Recibir eventos de SIS en flujos propios',
    ],
    oauthNote: 'Requerirá OAuth de n8n cuando se construya.',
  },
  {
    id: 'power-automate',
    name: 'Microsoft Power Automate',
    category: 'Automatización',
    icon: Repeat,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Automatización de Microsoft. Conexión real aún no disponible.',
    capabilities: [
      'Crear flujos con datos de SIS',
      'Automatizar aprobaciones y avisos',
    ],
    oauthNote: 'Requerirá OAuth de Microsoft cuando se construya.',
  },
  {
    id: 'postman',
    name: 'Postman',
    category: 'API & Webhooks',
    icon: Send,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Exploración y prueba de APIs. Conexión real aún no disponible.',
    capabilities: [
      'Probar los endpoints de SIS',
      'Documentar llamadas de ejemplo',
    ],
    oauthNote: 'Requerirá una colección oficial de SIS cuando se construya.',
  },
  {
    id: 'pipedream',
    name: 'Pipedream',
    category: 'API & Webhooks',
    icon: Plug,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Flujos sobre APIs y eventos. Conexión real aún no disponible.',
    capabilities: [
      'Recibir eventos de SIS en flujos',
      'Llamar a la API de SIS desde flujos',
    ],
    oauthNote: 'Requerirá OAuth de Pipedream cuando se construya.',
  },
  {
    id: 'insomnia',
    name: 'Insomnia',
    category: 'API & Webhooks',
    icon: Moon,
    pill: 'bg-slate-100 text-slate-700',
    status: 'coming_soon',
    summary: 'Cliente de APIs. Conexión real aún no disponible.',
    capabilities: [
      'Probar los endpoints de SIS',
      'Guardar entornos de trabajo',
    ],
    oauthNote: 'Requerirá una colección oficial de SIS cuando se construya.',
  },
];

export function IntegrationsView() {
  const { onSessionExpired } = useOutletContext<HomeOutletContext>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityDetail[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  // F1/F2: conexiones reales de envío + quién mira (solo admin
  // conecta/desconecta). Sin conexión, Gmail y WhatsApp siguen
  // coming_soon.
  const [connections, setConnections] = useState<Connection[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [connectionAction, setConnectionAction] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  // F2: formulario de WhatsApp (el token vive solo en este estado
  // local y se limpia al conectar; nunca se muestra en la vista).
  const [waPhoneNumber, setWaPhoneNumber] = useState('');
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
  const [waToken, setWaToken] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | Category>('Todas');
  const [selectedId, setSelectedId] = useState<string>('webhook');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError(null);
    (async () => {
      try {
        const [oppsRes, auditRes, connRes, meRes] = await Promise.all([
          getOpportunityList(),
          getAudit(),
          getConnections(),
          getMe(),
        ]);
        if (!cancelled) {
          setOpportunities(oppsRes.opportunities);
          setAudit(auditRes.audit);
          setConnections(connRes.connections);
          setMe(meRes);
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

  // Filtro combinado (AND): categoría del índice + búsqueda.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return INTEGRATIONS.filter((i) => {
      if (selectedCategory !== 'Todas' && i.category !== selectedCategory) return false;
      if (q && !`${i.name} ${i.category} ${i.summary}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, selectedCategory]);

  // El detalle sigue a lo visible: si la tarjeta seleccionada
  // queda fuera del filtro, se muestra la primera visible.
  const selected =
    filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? INTEGRATIONS[0];

  // F1/F2: estado REAL de Gmail y WhatsApp (las únicas del
  // catálogo con conexión). Sin fila, siguen coming_soon; con fila
  // 'connected' muestran Disponible con la cuenta; con fila
  // 'error', el error.
  const gmailConnection = connections.find((c) => c.provider === 'gmail');
  const gmailConnected = gmailConnection?.status === 'connected';
  const whatsappConnection = connections.find((c) => c.provider === 'whatsapp');
  const whatsappConnected = whatsappConnection?.status === 'connected';
  const isAdmin = me?.user.role === 'admin';

  const connectGmail = useCallback(async () => {
    setConnectionAction(true);
    setConnectionError(null);
    try {
      const res = await fetch('/api/connections/gmail/oauth/start', { method: 'POST' });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const b = (data ?? {}) as { message?: unknown; error?: unknown };
        throw new ApiError(
          typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : `Error ${res.status}`,
          res.status,
        );
      }
      const url = (data as { url?: unknown }).url;
      if (typeof url === 'string') window.location.href = url;
    } catch (e: unknown) {
      setConnectionError(e instanceof ApiError ? e.message : 'No se pudo iniciar la conexión con Gmail.');
    } finally {
      setConnectionAction(false);
    }
  }, []);

  const disconnectGmail = useCallback(async () => {
    if (!gmailConnection) return;
    setConnectionAction(true);
    setConnectionError(null);
    try {
      const res = await fetch(`/api/connections/${encodeURIComponent(gmailConnection.id)}/disconnect`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const b = (data ?? {}) as { message?: unknown; error?: unknown };
        throw new ApiError(
          typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : `Error ${res.status}`,
          res.status,
        );
      }
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setConnectionError(e instanceof ApiError ? e.message : 'No se pudo desconectar Gmail.');
    } finally {
      setConnectionAction(false);
    }
  }, [gmailConnection]);

  // F2: registro de WhatsApp Business. El servidor verifica el
  // número contra Meta: con 200 queda conectada; con 409 la fila
  // quedó en 'error' y se recarga para mostrar el motivo. El token
  // se limpia al conectar; si falla, los campos quedan para
  // corregir sin reescribir el token.
  const connectWhatsApp = useCallback(async () => {
    setConnectionAction(true);
    setConnectionError(null);
    try {
      const res = await fetch('/api/connections/whatsapp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: waPhoneNumber,
          phoneNumberId: waPhoneNumberId,
          token: waToken,
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const b = (data ?? {}) as { message?: unknown; error?: unknown };
        throw new ApiError(
          typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : `Error ${res.status}`,
          res.status,
        );
      }
      setWaPhoneNumber('');
      setWaPhoneNumberId('');
      setWaToken('');
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setConnectionError(e instanceof ApiError ? e.message : 'No se pudo conectar WhatsApp.');
      setReloadKey((k) => k + 1);
    } finally {
      setConnectionAction(false);
    }
  }, [waPhoneNumber, waPhoneNumberId, waToken]);

  const disconnectWhatsApp = useCallback(async () => {
    if (!whatsappConnection) return;
    setConnectionAction(true);
    setConnectionError(null);
    try {
      const res = await fetch(`/api/connections/${encodeURIComponent(whatsappConnection.id)}/disconnect`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const b = (data ?? {}) as { message?: unknown; error?: unknown };
        throw new ApiError(
          typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : `Error ${res.status}`,
          res.status,
        );
      }
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setConnectionError(e instanceof ApiError ? e.message : 'No se pudo desconectar WhatsApp.');
    } finally {
      setConnectionAction(false);
    }
  }, [whatsappConnection]);

  // Cerrar la búsqueda limpia el texto y vuelve a mostrar todo.
  const closeSearch = useCallback(() => {
    setSearch('');
    setSearchOpen(false);
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
          {/* A2: subtítulo directo sobre el fondo: secondary 4,48:1, tinta 15,33:1. */}
          <p className="text-sm text-ink">
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
        La única integración en funcionamiento hoy es el webhook de ingesta. Gmail y WhatsApp se
        pueden conectar de verdad desde esta vista (solo envío de borradores aprobados); el resto
        del catálogo está marcado como disponible próximamente: las conexiones reales llegarán
        proveedor por proveedor, sin estados ni sincronizaciones de ejemplo.
      </p>

      <nav aria-label="Índice por funcionalidad" className="flex flex-wrap gap-2">
        {(['Todas', ...CATEGORIES] as const).map((c) => {
          const active = selectedCategory === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 text-sm rounded-control border bg-surface hover:border-primary hover:text-ink ${active ? 'border-primary text-ink font-semibold' : 'border-border text-secondary'}`}
            >
              {c}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] items-start">
        <div className="space-y-6">
          {(selectedCategory === 'Todas' ? CATEGORIES : [selectedCategory]).map((category) => {
            const cards = filtered.filter((i) => i.category === category);
            // Con filtro o búsqueda activos, una categoría sin
            // tarjetas visibles se oculta (el mensaje global de
            // vacío cubre el caso sin resultados).
            if (cards.length === 0) return null;
            return (
              <div key={category}>
                <h2 className="text-base font-semibold">{category}</h2>
                <p className="mt-1 text-sm text-secondary">{CATEGORY_DESCRIPTIONS[category]}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {cards.map((i) => {
                    const { icon: Icon, pill } = { icon: i.icon, pill: i.pill };
                    const isSelected = i.id === selected.id;
                    // F1/F2: Gmail y WhatsApp muestran su estado real,
                    // no el del catálogo.
                    const cardAvailable =
                      i.status === 'available' ||
                      (i.id === 'gmail' && gmailConnected) ||
                      (i.id === 'whatsapp' && whatsappConnected);
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
                              {cardAvailable ? (
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
                            ) : i.id === 'gmail' && gmailConnected ? (
                              <span className="mt-1 block text-sm">
                                Cuenta conectada: {gmailConnection?.display_account}
                              </span>
                            ) : i.id === 'gmail' && gmailConnection?.status === 'error' ? (
                              <span className="mt-1 block text-sm text-secondary">
                                Conexión con error: {gmailConnection.last_error ?? 'verificá la cuenta'}.
                              </span>
                            ) : i.id === 'whatsapp' && whatsappConnected ? (
                              <span className="mt-1 block text-sm">
                                Número conectado: {whatsappConnection?.display_account}
                              </span>
                            ) : i.id === 'whatsapp' && whatsappConnection?.status === 'error' ? (
                              <span className="mt-1 block text-sm text-secondary">
                                Conexión con error: {whatsappConnection.last_error ?? 'verificá el número'}.
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
          subtitle={`${selected.category} · ${selected.id === 'gmail' && gmailConnected ? 'Disponible' : selected.id === 'whatsapp' && whatsappConnected ? 'Disponible' : selected.status === 'available' ? 'Disponible' : 'Disponible próximamente'}`}
        >
          <div>
            <div className="flex flex-wrap gap-2">
              {selected.status === 'available' ||
              (selected.id === 'gmail' && gmailConnected) ||
              (selected.id === 'whatsapp' && whatsappConnected) ? (
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

          {selected.id === 'gmail' && gmailConnected ? (
            <>
              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Estado</h3>
                <p className="mt-1 text-sm">Cuenta conectada: {gmailConnection?.display_account}</p>
                {gmailConnection?.last_verified_at && (
                  <p className="mt-1 text-sm text-secondary">
                    Verificada: {formatDateTime(gmailConnection.last_verified_at)}
                  </p>
                )}
                <p className="mt-1 text-sm text-secondary">
                  Al aprobar un borrador, el admin puede elegir enviarlo por esta cuenta. Sin canal
                  elegido, aprobar no envía nada.
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
                <h3 className="text-sm font-semibold">Credenciales</h3>
                <p className="mt-1 text-sm text-secondary">
                  Las credenciales OAuth se guardan cifradas y ningún endpoint las devuelve. No hay
                  botones para mostrar ni copiar secretos.
                </p>
              </div>

              <div className={sectionClass}>
                {isAdmin ? (
                  <Button type="button" variant="secondary" disabled={connectionAction} onClick={() => void disconnectGmail()}>
                    {connectionAction ? 'Desconectando…' : 'Desconectar'}
                  </Button>
                ) : (
                  <p className="mt-1 text-sm text-secondary">Solo un admin puede desconectar esta cuenta.</p>
                )}
                {connectionError && <p className="mt-2"><Alert variant="error">{connectionError}</Alert></p>}
              </div>
            </>
          ) : selected.id === 'whatsapp' && whatsappConnected ? (
            <>
              <div className={sectionClass}>
                <h3 className="text-sm font-semibold">Estado</h3>
                <p className="mt-1 text-sm">Número conectado: {whatsappConnection?.display_account}</p>
                {whatsappConnection?.last_verified_at && (
                  <p className="mt-1 text-sm text-secondary">
                    Verificado: {formatDateTime(whatsappConnection.last_verified_at)}
                  </p>
                )}
                <p className="mt-1 text-sm text-secondary">
                  Al aprobar un borrador, el admin puede elegir enviarlo por este número. Sin canal
                  elegido, aprobar no envía nada. Fuera de la ventana de 24 horas de WhatsApp, el
                  texto libre falla y la vista sugiere contactar por Gmail manualmente.
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
                <h3 className="text-sm font-semibold">Credenciales</h3>
                <p className="mt-1 text-sm text-secondary">
                  El número, el ID y el token se guardan cifrados y ningún endpoint los devuelve. No
                  hay botones para mostrar ni copiar secretos.
                </p>
              </div>

              <div className={sectionClass}>
                {isAdmin ? (
                  <Button type="button" variant="secondary" disabled={connectionAction} onClick={() => void disconnectWhatsApp()}>
                    {connectionAction ? 'Desconectando…' : 'Desconectar'}
                  </Button>
                ) : (
                  <p className="mt-1 text-sm text-secondary">Solo un admin puede desconectar esta cuenta.</p>
                )}
                {connectionError && <p className="mt-2"><Alert variant="error">{connectionError}</Alert></p>}
              </div>
            </>
          ) : selected.status === 'available' ? (
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
                {selected.id === 'gmail' ? (
                  <>
                    {isAdmin ? (
                      <Button type="button" variant="primary" disabled={connectionAction} onClick={() => void connectGmail()}>
                        {connectionAction ? 'Conectando…' : 'Conectar con Google'}
                      </Button>
                    ) : (
                      <p className="mt-1 text-sm text-secondary">Solo un admin puede conectar esta cuenta.</p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      Se abre el consentimiento de Google con alcance mínimo solo para enviar
                      correos (gmail.send). Si el operador todavía no configuró Google, el servidor
                      responde que no está disponible: no es un error de la cuenta.
                    </p>
                    {gmailConnection?.status === 'error' && (
                      <p className="mt-1 text-sm text-secondary">
                        Último error: {gmailConnection.last_error ?? 'verificá la cuenta y volvé a conectar.'}
                      </p>
                    )}
                    {connectionError && <p className="mt-2"><Alert variant="error">{connectionError}</Alert></p>}
                  </>
                ) : selected.id === 'whatsapp' ? (
                  <>
                    {isAdmin ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium" htmlFor="wa-phone-number">
                            Número de WhatsApp Business
                          </label>
                          <Input
                            id="wa-phone-number"
                            type="tel"
                            placeholder="+54 11 1234-5678"
                            value={waPhoneNumber}
                            onChange={(e) => setWaPhoneNumber(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium" htmlFor="wa-phone-number-id">
                            ID de número
                          </label>
                          <Input
                            id="wa-phone-number-id"
                            placeholder="ID de número de teléfono de Meta"
                            value={waPhoneNumberId}
                            onChange={(e) => setWaPhoneNumberId(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium" htmlFor="wa-token">
                            Token de sistema
                          </label>
                          <Input
                            id="wa-token"
                            type="password"
                            placeholder="Token de sistema de la cuenta"
                            value={waToken}
                            onChange={(e) => setWaToken(e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          disabled={
                            connectionAction ||
                            waPhoneNumber.trim() === '' ||
                            waPhoneNumberId.trim() === '' ||
                            waToken.trim() === ''
                          }
                          onClick={() => void connectWhatsApp()}
                        >
                          {connectionAction ? 'Conectando…' : 'Conectar WhatsApp'}
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-secondary">Solo un admin puede conectar esta cuenta.</p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      El servidor verifica el número contra la Graph API de Meta: la conexión solo
                      queda verificada si responde bien. Los datos se guardan cifrados y ningún
                      endpoint devuelve el token. Sin clave de cifrado en el servidor, el registro
                      responde que no está disponible: no es un error de la cuenta.
                    </p>
                    {whatsappConnection?.status === 'error' && (
                      <p className="mt-1 text-sm text-secondary">
                        Último error: {whatsappConnection.last_error ?? 'verificá el número y volvé a conectar.'}
                      </p>
                    )}
                    {connectionError && <p className="mt-2"><Alert variant="error">{connectionError}</Alert></p>}
                  </>
                ) : (
                  <>
                    <Button type="button" variant="secondary" disabled>
                      Notificar
                    </Button>
                    <p className="mt-1 text-xs text-muted">
                      El aviso de disponibilidad aún no está disponible.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </DetailPanel>
      </div>
    </div>
  );
}
