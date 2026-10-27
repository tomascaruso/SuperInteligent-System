import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router';
import { AppLayout, type SystemStatus } from './components/layout/AppLayout';
import { LoginScreen } from './features/auth/LoginScreen';
import { HomeView } from './features/inicio/HomeView';
import { OpportunitiesView } from './features/oportunidades/OpportunitiesView';
import { TasksView } from './features/tareas/TasksView';
import { ApprovalsView } from './features/aprobaciones/ApprovalsView';
import { ActivityView } from './features/actividad/ActivityView';
import { AgentsView } from './features/agentes/AgentsView';
import { IntegrationsView } from './features/integraciones/IntegrationsView';
import { ApiError, getMe, type MeResponse } from './lib/api';

// Fase 3: HashRouter (sin cambios en el servidor: toda la ruta
// vive después de #). El acceso sigue siendo la pantalla de la
// Fase 2; con sesión, se muestra el layout principal con las 6
// secciones reales (cuyas vistas con datos son la Fase 4). Tras
// un login o una invitación exitosa ya NO se redirige a /: se
// queda en /v2/ (ruta /#/inicio). 401 = sin sesión: pantalla de
// acceso, igual que el vanilla.
function AccessGate() {
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'session' | 'login'>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<SystemStatus>('connecting');
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((data) => {
        setMe(data);
        setStatus('ok');
        setState('session');
      })
      .catch((e: unknown) => {
        // La píldora arranca «Conectando…» y solo dice «Sistema
        // operativo» si la carga tuvo éxito: acá falló.
        setStatus('down');
        if (!(e instanceof ApiError && e.status === 401)) {
          setError(e instanceof ApiError ? e.message : 'No se pudo contactar al servidor.');
        }
        setState('login');
      });
  }, []);

  async function handleAuthenticated() {
    try {
      const data = await getMe();
      setMe(data);
      setStatus('ok');
      setState('session');
      navigate('/inicio', { replace: true });
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'No se pudo contactar al servidor.');
      setState('login');
    }
  }

  function handleLoggedOut() {
    setMe(null);
    setState('login');
    navigate('/', { replace: true });
  }

  // 401 durante la carga de una vista (Fase 4): como el vanilla,
  // la sesión expirada vuelve a la pantalla de acceso con el
  // mensaje, en vez de dejar la app visible con datos viejos.
  // useCallback para que la identidad estable no re-ejecute la
  // carga de la vista en bucle.
  const handleSessionExpired = useCallback(() => {
    setMe(null);
    setError('La sesión expiró. Volvé a entrar.');
    setState('login');
    navigate('/', { replace: true });
  }, [navigate]);

  if (state === 'loading') {
    return <p className="text-secondary">Cargando…</p>;
  }
  if (state === 'login' || !me) {
    // LOGIN-V2: sin envoltorio con margen (rompería el ajuste a
    // 100dvh de la pantalla de acceso); el mensaje del padre
    // (sesión expirada / servidor caído) se muestra dentro de la
    // tarjeta de acceso. Alert ya no se usa en esta rama.
    return <LoginScreen onAuthenticated={handleAuthenticated} accessError={error} />;
  }
  return (
    <AppLayout me={me} status={status} onLoggedOut={handleLoggedOut}>
      <Outlet context={{ setSystemStatus: setStatus, onSessionExpired: handleSessionExpired }} />
    </AppLayout>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AccessGate />}>
          <Route path="inicio" element={<HomeView />} />
          <Route path="oportunidades" element={<OpportunitiesView />} />
          <Route path="tareas" element={<TasksView />} />
          <Route path="aprobaciones" element={<ApprovalsView />} />
          <Route path="actividad" element={<ActivityView />} />
          <Route path="agentes" element={<AgentsView />} />
          <Route path="integraciones" element={<IntegrationsView />} />
          <Route index element={<Navigate to="inicio" replace />} />
          <Route path="*" element={<Navigate to="inicio" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
