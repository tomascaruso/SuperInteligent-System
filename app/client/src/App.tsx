import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router';
import { Alert } from './components/ui/alert';
import { AppLayout, type SystemStatus } from './components/layout/AppLayout';
import { LoginScreen } from './features/auth/LoginScreen';
import { SectionPlaceholder } from './features/sections/SectionPlaceholder';
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

  if (state === 'loading') {
    return <p className="text-secondary">Cargando…</p>;
  }
  if (state === 'login' || !me) {
    return (
      <>
        <Alert variant="error">{error}</Alert>
        <div className="mt-4">
          <LoginScreen onAuthenticated={handleAuthenticated} />
        </div>
      </>
    );
  }
  return (
    <AppLayout me={me} status={status} onLoggedOut={handleLoggedOut}>
      <Outlet />
    </AppLayout>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AccessGate />}>
          <Route path="inicio" element={<SectionPlaceholder title="Inicio" about="Indicadores, acciones prioritarias y actividad reciente." />} />
          <Route path="oportunidades" element={<SectionPlaceholder title="Oportunidades" about="La lista de oportunidades con su empresa, categoría y prioridad." />} />
          <Route path="tareas" element={<SectionPlaceholder title="Tareas y seguimientos" about="Las tareas abiertas con vencimiento y agente a cargo." />} />
          <Route path="aprobaciones" element={<SectionPlaceholder title="Aprobaciones" about="Los borradores pendientes de revisión y decisión." />} />
          <Route path="actividad" element={<SectionPlaceholder title="Actividad y ejecuciones" about="La auditoría completa y las ejecuciones de los procesos." />} />
          <Route path="agentes" element={<SectionPlaceholder title="Agentes" about="Los cinco agentes, su función y su trabajo." />} />
          <Route index element={<Navigate to="inicio" replace />} />
          <Route path="*" element={<Navigate to="inicio" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
