import { ArrowUpRight, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { logout, type MeResponse } from '../../lib/api';

// Vista de /v2/ cuando ya hay sesión (Fase 2): muestra los datos
// reales de /api/me, enlaza a la app vanilla en / y permite salir
// con el logout real. La shell completa es la Fase 3.
export function SessionHome({ me, onLoggedOut }: { me: MeResponse; onLoggedOut: () => void }) {
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
    <Card>
      <p className="m-0 text-[32px] font-semibold text-primary">SIS</p>
      <p className="mt-1 text-base font-semibold">SuperInteligent System</p>
      <p className="m-0 text-[13px] text-muted">by PENSIA</p>
      <h2 className="text-xl font-semibold mt-4">Hola, {me.user.name}</h2>
      <p className="text-secondary">
        {me.org.name} ({me.user.role})
      </p>
      <p className="text-secondary">
        Ya tenés sesión iniciada. La aplicación completa sigue en la versión actual mientras se migra a React.
      </p>
      {error && (
        <p role="alert" className="px-3 py-2 text-sm border rounded-control bg-danger/10 text-danger border-danger/30">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mt-4">
        <Button type="button" onClick={() => (window.location.href = '/')}>
          Ir a la aplicación <ArrowUpRight size={16} aria-hidden="true" />
        </Button>
        <Button type="button" variant="secondary" disabled={leaving} onClick={onLogout}>
          <LogOut size={16} aria-hidden="true" /> {leaving ? 'Saliendo…' : 'Salir'}
        </Button>
      </div>
    </Card>
  );
}
