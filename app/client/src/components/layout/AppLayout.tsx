import { LogOut } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { logout, type MeResponse } from '../../lib/api';
import sisMark from '../../assets/sis-mark.png';

// Layout principal del cliente React (Fase 3): barra lateral con
// las 6 secciones REALES de la app vanilla, en el mismo orden y
// con los mismos nombres, cabecera con el chip de usuario real y
// la píldora de estado con la MISMA regla honesta del vanilla:
// arranca «Conectando…», «Sistema operativo» solo si la última
// carga de la API tuvo éxito, «Sin conexión» si falló. Responsive
// con el mismo criterio del vanilla: navegación completa en
// escritorio (≥1024 px) y tira con scroll en angosto, sin ocultar
// secciones.

export type SystemStatus = 'connecting' | 'ok' | 'down';

const NAV = [
  { to: '/inicio', label: 'Inicio' },
  { to: '/oportunidades', label: 'Oportunidades' },
  { to: '/tareas', label: 'Tareas y seguimientos' },
  { to: '/aprobaciones', label: 'Aprobaciones' },
  { to: '/actividad', label: 'Actividad y ejecuciones' },
  { to: '/agentes', label: 'Agentes' },
];

const STATUS_TEXT: Record<SystemStatus, string> = {
  connecting: 'Conectando…',
  ok: 'Sistema operativo',
  down: 'Sin conexión',
};

const STATUS_DOT: Record<SystemStatus, string> = {
  connecting: 'bg-muted',
  ok: 'bg-success',
  down: 'bg-danger',
};

export function AppLayout({
  me,
  status,
  onLoggedOut,
  children,
}: {
  me: MeResponse;
  status: SystemStatus;
  onLoggedOut: () => void;
  children: ReactNode;
}) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  async function onLogout() {
    setError('');
    setLeaving(true);
    try {
      await logout();
      onLoggedOut();
    } catch {
      setError('No se pudo cerrar la sesión. Probá de nuevo más tarde.');
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="m-0 flex items-center gap-2">
            <img src={sisMark} alt="" aria-hidden="true" width={25} height={32} className="h-8 w-auto" />
            <span className="text-xl font-semibold text-primary">SIS</span>{' '}
            <span className="text-sm font-semibold">SuperInteligent System</span>{' '}
            <span className="text-xs text-muted">by PENSIA</span>
          </p>
          <span className="flex-1" aria-hidden="true" />
          <span aria-live="polite" className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-control bg-surface">
            <span aria-hidden="true" className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_TEXT[status]}
          </span>
          <span className="inline-flex items-center px-3 py-1.5 text-sm border border-border rounded-control bg-primary-subtle text-primary font-medium">
            {me.user.name} · {me.user.role}
          </span>
          <Button type="button" variant="ghost" disabled={leaving} onClick={onLogout} className="min-h-[44px]">
            <LogOut size={16} aria-hidden="true" /> {leaving ? 'Saliendo…' : 'Salir'}
          </Button>
        </div>
        <div className="max-w-[1440px] mx-auto px-4 pb-2">
          <Alert variant="error">{error}</Alert>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-4 py-4 lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-6">
        <nav aria-label="Navegación principal" className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible mb-4 lg:mb-0">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center min-h-[44px] px-3 rounded-control text-sm font-medium whitespace-nowrap ${
                  isActive ? 'bg-primary-subtle text-primary' : 'text-secondary hover:bg-primary-subtle hover:text-ink'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
