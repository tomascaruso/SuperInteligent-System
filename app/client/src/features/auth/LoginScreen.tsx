import { ChartColumn, Eye, EyeOff, Settings, ShieldCheck, Users, Zap } from 'lucide-react';
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

// Pantalla de acceso en React (Fase 2, puente actualizado en la
// Fase 3): misma composición y mismos flujos que la pantalla
// vanilla actual (dos paneles, marca SIS tipográfica, beneficios,
// mini-dashboard estático de venta, login, invitación, contacto,
// cuenta demo visible). Sin botón Google, sin recuperación y sin
// «Recordarme»: no existen en el backend. Tras un login o una
// invitación exitosa, se avisa al padre con onAuthenticated (la
// App se queda en /v2/, ruta /#/inicio); sin ese callback, se
// mantiene el puente original a / (la app vanilla).

const BENEFITS = [
  { icon: Users, title: 'Agentes especializados', text: 'Cada tarea, el agente ideal.' },
  { icon: Zap, title: 'Procesos automatizados', text: 'Menos tareas manuales, más resultados.' },
  { icon: ShieldCheck, title: 'Control y trazabilidad', text: 'Visibilidad total en cada paso.' },
  { icon: Settings, title: 'Adaptable a tu negocio', text: 'Configura, integra y escala.' },
];

// Mini-dashboard ESTÁTICO de venta (ya aprobado): composición fija,
// sin enlaces, sin llamadas a API y sin leyenda visible, igual que
// en la pantalla vanilla. No son datos de nadie.
function MiniDashboard() {
  return (
    <div className="border border-border rounded-card p-4 bg-canvas">
      <div aria-hidden="true">
        <div className="flex justify-between items-center mb-3 text-[13px]">
          <span className="font-medium text-primary">SIS</span>
          <span>Bienvenido, Juan</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            ['24', 'Oportunidades activas'],
            ['18', 'Tareas en curso'],
            ['6', 'Aprobaciones pendientes'],
            ['12', 'Procesos completados hoy'],
          ].map(([value, label]) => (
            <div key={label} className="bg-surface border border-border rounded-control p-2 text-center">
              <strong className="block text-base">{value}</strong>
              <span className="text-xs text-muted">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-3">
          <svg viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true" className="flex-1 min-w-0 h-20">
            <polyline points="0,60 40,45 80,50 120,30 160,35 200,15" fill="none" stroke="#4f46e5" strokeWidth="2" />
            <polyline points="0,68 40,58 80,62 120,48 160,52 200,38" fill="none" stroke="#a5b4fc" strokeWidth="2" />
          </svg>
          <svg viewBox="0 0 80 80" aria-hidden="true" className="w-20 h-20 shrink-0">
            <circle cx="40" cy="40" r="26" fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle cx="40" cy="40" r="26" fill="none" stroke="#4f46e5" strokeWidth="10" strokeDasharray="60 103" transform="rotate(-90 40 40)" />
            <circle cx="40" cy="40" r="26" fill="none" stroke="#22c55e" strokeWidth="10" strokeDasharray="35 128" strokeDashoffset="-60" transform="rotate(-90 40 40)" />
          </svg>
        </div>
        <div className="mt-3 text-xs">
          <div className="flex justify-between py-1 border-t border-border">
            <span>Proceso / Cliente</span><span>Estado</span>
          </div>
          {[
            ['Oportunidad comercial · TechSolutions', 'En proceso'],
            ['Seguimiento de cliente · Global Services', 'En proceso'],
            ['Consulta de soporte · Industrias del Sur', 'En proceso'],
          ].map(([process, state]) => (
            <div key={process} className="flex justify-between gap-2 py-1 border-t border-border">
              <span>{process}</span><span>{state}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function messageOf(e: unknown): string {
  return e instanceof ApiError ? e.message : 'No se pudo completar la acción. Probá de nuevo más tarde.';
}

export function LoginScreen({ onAuthenticated }: { onAuthenticated?: () => void }) {
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
  }, [showInvitation]);

  useEffect(() => {
    if (showContact) contactNameRef.current?.focus();
  }, [showContact]);

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
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
      <Card>
        <img
          src={sisLogo}
          alt="SIS — SuperIntelligent System by PENSIA"
          width={280}
          height={256}
          className="w-[280px] max-w-full h-auto"
          style={{ aspectRatio: '1137 / 1040' }}
        />
        <h2 className="text-xl font-semibold mt-4">Inteligencia artificial que trabaja para tu negocio</h2>
        <p className="text-secondary">
          Orquesta agentes, automatiza procesos y toma el control de tus operaciones con una plataforma diseñada para
          empresas que quieren avanzar.
        </p>
        <ul className="hidden lg:grid lg:grid-cols-2 gap-4 list-none p-0 my-4">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={20} className="text-primary" aria-hidden="true" />
              <strong className="block mt-1">{title}</strong>
              <span className="block text-[13px] text-secondary">{text}</span>
            </li>
          ))}
        </ul>
        <div className="hidden lg:block">
          <MiniDashboard />
        </div>
        <p className="hidden lg:block mt-4 text-secondary">Tecnología sofisticada explicada con simplicidad empresarial.</p>
        <p className="hidden lg:block mt-1 font-medium text-primary">Menos tareas. Más sistema.</p>
      </Card>

      <Card className="order-first lg:order-none">
        <p className="m-0 text-[32px] font-semibold text-primary">SIS</p>
        <p className="mt-1 text-base font-semibold">SuperInteligent System</p>
        <p className="m-0 text-[13px] text-muted">by PENSIA</p>
        <h2 className="text-xl font-semibold mt-4">Bienvenido</h2>
        <p className="text-secondary">Iniciá sesión para acceder a tu sistema de agentes inteligentes.</p>
        <form onSubmit={onLogin}>
          <div className="mb-3">
            <Label htmlFor="v2-email">Correo electrónico</Label>
            <Input
              id="v2-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
          <div className="flex flex-wrap gap-2 mt-3">
            <Button type="submit" disabled={loginLoading}>
              {loginLoading ? 'Entrando…' : 'Iniciar sesión'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowInvitation((v) => !v)}>
              Tengo una invitación
            </Button>
          </div>
        </form>

        {showInvitation && (
          <form onSubmit={onAcceptInvitation} className="mt-4">
            <p className="text-muted">
              PENSIA da de alta a cada empresa con una invitación: sin invitación no se puede crear una organización.
              Pegá el código que recibiste para crear la tuya.
            </p>
            <div className="mb-3">
              <Label htmlFor="v2-inv-token">Código de invitación</Label>
              <Input id="v2-inv-token" ref={invTokenRef} value={invToken} onChange={(e) => setInvToken(e.target.value)} />
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
        )}

        <p className="text-muted mt-4">
          Cuenta de demostración: <code>demo@agenciamartin.demo</code> / <code>Demo1234!</code>.
        </p>

        {contactEnabled && !showContact && (
          <p className="text-muted">
            ¿No tenés una cuenta?{' '}
            <Button type="button" variant="ghost" onClick={() => setShowContact(true)}>
              Contactanos
            </Button>
          </p>
        )}

        {showContact && (
          <form onSubmit={onContact} className="mt-4">
            <h2 className="text-base font-semibold">Quiero una demo para mi empresa</h2>
            <p className="text-muted">Contanos quién sos y qué necesitás; PENSIA te responde.</p>
            <div className="mb-3">
              <Label htmlFor="v2-contact-name">Nombre</Label>
              <Input id="v2-contact-name" ref={contactNameRef} value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="mb-3">
              <Label htmlFor="v2-contact-email">Correo</Label>
              <Input id="v2-contact-email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="mb-3">
              <Label htmlFor="v2-contact-company">Empresa (opcional)</Label>
              <Input id="v2-contact-company" value={contactCompany} onChange={(e) => setContactCompany(e.target.value)} />
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
            <div className="mt-3">
              <Button type="submit" disabled={contactLoading}>
                {contactLoading ? 'Enviando…' : 'Enviar mensaje'}
              </Button>
            </div>
            {contactFeedback && (
              <div className="mt-3">
                <Alert variant={contactFeedback.kind === 'success' ? 'success' : 'error'}>{contactFeedback.text}</Alert>
              </div>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
