import { Eye, EyeOff, Settings, ShieldCheck, Users, Workflow } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  ApiError,
  acceptInvitation,
  getContactStatus,
  login,
  sendContact,
} from '../../lib/api';
import sisLogo from '../../assets/sis-logo.png';
import sisMark from '../../assets/sis-mark.png';

// Pantalla de acceso en React, rediseño LOGIN-V2 (dos paneles, sin
// scroll): misma composición de la referencia aprobada por Tomás
// (panel izquierdo de presentación + panel derecho de acceso
// centralizado), con los 4 ajustes honestos aprobados:
// 1. Logo SIS aprobado (remolino), no la marca órbita de la
//    referencia.
// 2. Sin «Recordarme» y sin «¿Olvidaste tu contraseña?» como
//    operativos: no existen en el backend (la sesión es por cookie
//    httpOnly del servidor; no hay recuperación). En su lugar, el
//    texto honesto de la referencia, que abre el contacto real.
// 3. Funciones reales como secundarias: invitación (C8), cuenta
//    demo visible y contacto fail-closed con honeypot.
// 4. Gráfico izquierdo como ILUSTRACIÓN ABSTRACTA en SVG puro,
//    sin números, sin nombres inventados y sin métricas: reemplaza
//    al MiniDashboard anterior (que tenía números y nombres de
//    ejemplo). La vanilla no se toca.
// Sin scroll: el shell ocupa 100dvh; en escritorio (≥1024 px) los
// dos paneles entran completos sin scroll de página (el panel
// derecho desplaza internamente solo si se expanden los
// formularios secundarios); en móvil (<1024 px) el panel izquierdo
// se oculta por diseño (form-first) y solo se muestra el acceso.
// Ajustes LOGIN-V2-AJUSTES (feedback de Tomás con captura en
// incógnito; solo panel izquierdo, el derecho no se toca):
// logo con su proporción natural 560×266 y más chico (la versión
// anterior le imponía 1137/1040 y lo estiraba en vertical),
// 4 rubros en una sola fila, y la ilustración ocupando el espacio
// liberado. Contacto (corrección 27-oct ~20:04, el bug NO era en
// invitación): un solo condicional, un solo montaje y alternancia
// ya verificados; se agregó aria-expanded al disparador de ayuda
// y un botón «Cerrar» explícito dentro del formulario, para que
// el segundo toque nunca pueda percibirse como otro formulario.
// La invitación se verificó igual (un solo condicional y
// alternancia) y NO se tocó. Sin botón Google. Tras un login o una invitación exitosa, se
// avisa al padre con onAuthenticated (la App se queda en /v2/,
// ruta /#/inicio); sin ese callback, se mantiene el puente
// original a / (la app vanilla).

const BENEFITS = [
  { icon: Users, title: 'Agentes especializados', text: 'Cada tarea, el agente ideal.' },
  { icon: Workflow, title: 'Procesos coordinados', text: 'Flujos claros de principio a fin.' },
  { icon: ShieldCheck, title: 'Control y trazabilidad', text: 'Visibilidad total en cada paso.' },
  { icon: Settings, title: 'Adaptación a tu negocio', text: 'Configura, integra y escala.' },
];

// Ilustración ABSTRACTA (LOGIN-V2): panel de operaciones, tarjetas
// de flujo y diagrama de nodos, solo formas, sin texto, sin
// números y sin datos de nadie. Es decorativa (aria-hidden).
function AbstractIllustration() {
  return (
    <svg
      viewBox="0 0 560 220"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className="h-full w-full"
    >
      {/* Panel de operaciones */}
      <g>
        <rect x="8" y="20" width="170" height="180" rx="12" fill="#ffffff" stroke="#e2e8f0" />
        <circle cx="30" cy="44" r="7" fill="#eef2ff" stroke="#4f46e5" strokeWidth="1.5" />
        <rect x="46" y="40" width="70" height="8" rx="4" fill="#e2e8f0" />
        <rect x="24" y="64" width="110" height="8" rx="4" fill="#e2e8f0" />
        <rect x="24" y="80" width="80" height="8" rx="4" fill="#e2e8f0" />
        <polyline
          points="24,170 54,140 84,150 114,115 144,125 164,100"
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polyline
          points="24,182 54,162 84,170 114,148 144,156 164,138"
          fill="none"
          stroke="#a5b4fc"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="24" y="100" width="52" height="26" rx="6" fill="#eef2ff" />
        <rect x="86" y="100" width="52" height="26" rx="6" fill="#f7f8fc" stroke="#e2e8f0" />
      </g>
      {/* Tarjetas de flujo */}
      <g>
        <rect x="208" y="28" width="130" height="34" rx="8" fill="#ffffff" stroke="#e2e8f0" />
        <rect x="220" y="41" width="56" height="8" rx="4" fill="#e2e8f0" />
        <rect x="220" y="52" width="34" height="5" rx="2.5" fill="#e2e8f0" />
        <rect x="208" y="92" width="130" height="34" rx="8" fill="#4f46e5" />
        <rect x="220" y="105" width="56" height="8" rx="4" fill="#ffffff" opacity="0.9" />
        <rect x="220" y="116" width="34" height="5" rx="2.5" fill="#ffffff" opacity="0.6" />
        <circle cx="322" cy="109" r="8" fill="#ffffff" />
        <polyline points="318,109 321,112 326,106" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
        <rect x="208" y="156" width="130" height="34" rx="8" fill="#ffffff" stroke="#e2e8f0" />
        <rect x="220" y="169" width="56" height="8" rx="4" fill="#e2e8f0" />
        <rect x="220" y="180" width="34" height="5" rx="2.5" fill="#e2e8f0" />
        <path d="M 273 62 L 273 92" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
        <path d="M 273 126 L 273 156" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
        <path d="M 178 110 L 208 110" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
        <path d="M 338 109 L 386 109" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      </g>
      {/* Diagrama de nodos */}
      <g>
        <rect x="412" y="86" width="52" height="52" rx="12" fill="#ffffff" stroke="#4f46e5" strokeWidth="1.5" />
        <circle cx="438" cy="112" r="14" fill="none" stroke="#4f46e5" strokeWidth="2" />
        <circle cx="438" cy="112" r="5" fill="#4f46e5" />
        <circle cx="386" cy="60" r="5" fill="#94a3b8" />
        <circle cx="490" cy="60" r="5" fill="#94a3b8" />
        <circle cx="386" cy="164" r="5" fill="#94a3b8" />
        <circle cx="490" cy="164" r="5" fill="#94a3b8" />
        <circle cx="438" cy="34" r="4" fill="#c7d2fe" />
        <circle cx="438" cy="190" r="4" fill="#c7d2fe" />
        <path d="M 390 64 L 414 90" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
        <path d="M 486 64 L 462 90" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
        <path d="M 390 160 L 414 134" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
        <path d="M 486 160 L 462 134" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
        <path d="M 438 38 L 438 86" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
        <path d="M 438 138 L 438 186" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
      </g>
    </svg>
  );
}

function messageOf(e: unknown): string {
  return e instanceof ApiError ? e.message : 'No se pudo completar la acción. Probá de nuevo más tarde.';
}

export function LoginScreen({
  onAuthenticated,
  accessError,
}: {
  onAuthenticated?: () => void;
  // Mensaje del padre (sesión expirada / servidor caído): se muestra
  // dentro de la tarjeta para no romper el ajuste a 100dvh.
  accessError?: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [showInvitation, setShowInvitation] = useState(false);
  const [invToken, setInvToken] = useState('');
  const [invName, setInvName] = useState('');
  const [invPassword, setInvPassword] = useState('');
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');
  const invTokenRef = useRef<HTMLInputElement>(null);

  const [contactEnabled, setContactEnabled] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const contactNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fail-closed: sin relay configurado, no se ofrece el enlace.
    getContactStatus()
      .then((s) => setContactEnabled(s.enabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showInvitation) invTokenRef.current?.focus();
  }, []);

  useEffect(() => {
    if (showContact) contactNameRef.current?.focus();
  }, []);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(email, password);
      // Fase 3: quedarse en /v2/ (el padre navega a /#/inicio).
      if (onAuthenticated) onAuthenticated();
      else window.location.href = '/';
    } catch (err) {
      setLoginError(messageOf(err));
    } finally {
      setLoginLoading(false);
    }
  }

  async function onAcceptInvitation(e: FormEvent) {
    e.preventDefault();
    setInvError('');
    setInvLoading(true);
    try {
      await acceptInvitation(invToken, invName, invPassword);
      if (onAuthenticated) onAuthenticated();
      else window.location.href = '/';
    } catch (err) {
      setInvError(messageOf(err));
    } finally {
      setInvLoading(false);
    }
  }

  async function onContact(e: FormEvent) {
    e.preventDefault();
    setContactFeedback(null);
    setContactLoading(true);
    try {
      await sendContact({
        name: contactName,
        email: contactEmail,
        company: contactCompany,
        message: contactMessage,
        website: contactWebsite,
      });
      setContactName('');
      setContactEmail('');
      setContactCompany('');
      setContactMessage('');
      setContactFeedback({ kind: 'success', text: 'Gracias, recibimos tu mensaje. PENSIA te va a contactar.' });
    } catch (err) {
      setContactFeedback({ kind: 'error', text: messageOf(err) });
    } finally {
      setContactLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* Panel izquierdo: presentación (oculto bajo 1024 px por diseño). */}
      <section
        aria-label="Presentación de SuperInteligent System"
        className="hidden min-h-0 flex-1 flex-col overflow-hidden bg-canvas px-10 py-6 lg:flex xl:px-14"
      >
        {/* Logo con su proporción natural 560×266 (ancho solo,
            alto automático): fijar alto o una proporción distinta
            lo estira en vertical, como pasó en LOGIN-V2. */}
        <img
          src={sisLogo}
          alt="SIS — SuperIntelligent System by PENSIA"
          width={560}
          height={266}
          className="h-auto w-[220px] max-w-full shrink-0"
        />
        <h1 className="mt-4 shrink-0 text-[clamp(1.75rem,2.4vw,2.5rem)] font-semibold leading-tight">
          Inteligencia artificial que trabaja para tu negocio
        </h1>
        <p className="mt-2 shrink-0 text-secondary">
          Coordina procesos, supervisa agentes especializados y transforma tareas operativas en flujos de trabajo
          inteligentes.
        </p>
        <ul className="mt-5 grid shrink-0 grid-cols-4 gap-x-4 list-none p-0">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex min-w-0 flex-col gap-1.5">
              <Icon size={24} className="shrink-0 text-primary" aria-hidden="true" />
              <span>
                <strong className="block text-[14px] leading-snug">{title}</strong>
                <span className="block text-xs leading-snug text-secondary">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex min-h-0 flex-1 items-center">
          <AbstractIllustration />
        </div>
        <p className="mt-3 shrink-0 text-secondary">Tecnología sofisticada explicada con simplicidad empresarial.</p>
        <p className="mt-1 shrink-0 font-medium text-primary">Menos tareas. Más sistema.</p>
      </section>

      {/* Panel derecho: acceso centralizado. Desplaza internamente
          solo si se expanden los formularios secundarios. */}
      <section
        aria-label="Inicio de sesión"
        className="flex flex-1 flex-col items-center justify-center px-4 py-6 lg:overflow-y-auto"
      >
        <div className="w-full max-w-[420px]">
          <div className="mb-5 flex flex-col items-center text-center">
            <img src={sisMark} alt="" aria-hidden="true" width={64} height={56} className="h-11 w-auto" />
            <p className="m-0 mt-2 text-[26px] font-semibold leading-none text-ink">SIS</p>
            <p className="mt-1 text-[15px] font-semibold text-primary">SuperInteligent System</p>
            <p className="m-0 text-[13px] text-muted">by PENSIA</p>
          </div>

          <Card>
            <Alert variant="error">{accessError ?? ''}</Alert>
            <h2 className="mt-1 text-center text-xl font-semibold">Bienvenido</h2>
            <p className="mt-1 text-center text-secondary">Inicia sesión para acceder a tu espacio de trabajo</p>
            <form onSubmit={onLogin} className="mt-4">
              <div className="mb-3">
                <Label htmlFor="v2-email">Correo electrónico</Label>
                <Input
                  id="v2-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="nombre@empresa.com"
                />
              </div>
              <div className="mb-3">
                <Label htmlFor="v2-password">Contraseña</Label>
                <div className="flex gap-2">
                  <Input
                    id="v2-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="flex-1 min-w-0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
              </div>
              <Alert variant="error">{loginError}</Alert>
              <div className="mt-3">
                <Button type="submit" disabled={loginLoading} className="w-full">
                  {loginLoading ? 'Entrando…' : 'Iniciar sesión'}
                </Button>
              </div>
            </form>

            <p className="mt-4 text-center text-[13px] text-secondary">
              ¿Necesitas ayuda para acceder?{' '}
              {contactEnabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={showContact}
                  onClick={() => setShowContact((v) => !v)}
                >
                  Contacta con el administrador de tu organización.
                </Button>
              ) : (
                'Contacta con el administrador de tu organización.'
              )}
            </p>
          </Card>

          <div className="mt-4 flex flex-col items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowInvitation((v) => !v)}>
              Tengo una invitación
            </Button>
            <p className="m-0 text-center text-[13px] text-secondary">
              Cuenta de demostración: <code>demo@agenciamartin.demo</code> / <code>Demo1234!</code>.
            </p>
          </div>

          {showInvitation && (
            <Card className="mt-4">
              <form onSubmit={onAcceptInvitation}>
                <p className="text-secondary">
                  PENSIA da de alta a cada empresa con una invitación: sin invitación no se puede crear una
                  organización. Pegá el código que recibiste para crear la tuya.
                </p>
                <div className="mb-3">
                  <Label htmlFor="v2-inv-token">Código de invitación</Label>
                  <Input
                    id="v2-inv-token"
                    ref={invTokenRef}
                    value={invToken}
                    onChange={(e) => setInvToken(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <Label htmlFor="v2-inv-name">Tu nombre</Label>
                  <Input id="v2-inv-name" value={invName} onChange={(e) => setInvName(e.target.value)} />
                </div>
                <div className="mb-3">
                  <Label htmlFor="v2-inv-password">Contraseña (mín. 8 caracteres)</Label>
                  <Input
                    id="v2-inv-password"
                    type="password"
                    value={invPassword}
                    onChange={(e) => setInvPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <Alert variant="error">{invError}</Alert>
                <div className="mt-3">
                  <Button type="submit" disabled={invLoading}>
                    {invLoading ? 'Creando…' : 'Crear mi organización'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {showContact && (
            <Card className="mt-4">
              <form onSubmit={onContact}>
                <h2 className="text-base font-semibold">Quiero una demo para mi empresa</h2>
                <p className="text-secondary">Contanos quién sos y qué necesitás; PENSIA te responde.</p>
                <div className="mb-3">
                  <Label htmlFor="v2-contact-name">Nombre</Label>
                  <Input
                    id="v2-contact-name"
                    ref={contactNameRef}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <Label htmlFor="v2-contact-email">Correo</Label>
                  <Input
                    id="v2-contact-email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="mb-3">
                  <Label htmlFor="v2-contact-company">Empresa (opcional)</Label>
                  <Input
                    id="v2-contact-company"
                    value={contactCompany}
                    onChange={(e) => setContactCompany(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <Label htmlFor="v2-contact-message">Mensaje</Label>
                  <textarea
                    id="v2-contact-message"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface text-ink border border-border rounded-control min-h-[72px]"
                  />
                </div>
                <div className="hidden">
                  <Label htmlFor="v2-contact-website">Sitio web</Label>
                  <Input
                    id="v2-contact-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={contactWebsite}
                    onChange={(e) => setContactWebsite(e.target.value)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="submit" disabled={contactLoading}>
                    {contactLoading ? 'Enviando…' : 'Enviar mensaje'}
                  </Button>
                  {/* Cierre explícito del formulario de contacto: el
                      disparador de ayuda alterna, pero el formulario
                      quedaba lejos abajo sin forma visible de
                      cerrarlo, lo que invitaba al re-toque confuso. */}
                  <Button type="button" variant="secondary" onClick={() => setShowContact(false)}>
                    Cerrar
                  </Button>
                </div>
                {contactFeedback && (
                  <div className="mt-3">
                    <Alert variant={contactFeedback.kind === 'success' ? 'success' : 'error'}>
                      {contactFeedback.text}
                    </Alert>
                  </div>
                )}
              </form>
            </Card>
          )}

          <p className="mt-5 text-center text-[13px] text-muted">SuperInteligent System · by PENSIA</p>
        </div>
      </section>
    </div>
  );
}
