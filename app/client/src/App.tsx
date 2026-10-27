import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Alert } from './components/ui/alert';
import { LoginScreen } from './features/auth/LoginScreen';
import { SessionHome } from './features/auth/SessionHome';
import { ApiError, getMe, type MeResponse } from './lib/api';

// Fase 2: HashRouter (sin cambios en el servidor: toda la ruta
// vive después de #). La única ruta es el acceso: si hay sesión,
// muestra el puente a la app vanilla; si no, el login.
function AccessGate() {
  const [state, setState] = useState<'loading' | 'session' | 'login'>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((data) => {
        setMe(data);
        setState('session');
      })
      .catch((e: unknown) => {
        // 401 = sin sesión: se muestra el login (el error real
        // aparecerá al intentar entrar). Otro fallo se muestra.
        if (e instanceof ApiError && e.status === 401) {
          setState('login');
        } else {
          setError(e instanceof ApiError ? e.message : 'No se pudo contactar al servidor.');
          setState('login');
        }
      });
  }, []);

  if (state === 'loading') {
    return <p className="text-secondary">Cargando…</p>;
  }
  if (state === 'session' && me) {
    return <SessionHome me={me} onLoggedOut={() => setState('login')} />;
  }
  return (
    <>
      <Alert variant="error">{error}</Alert>
      <div className="mt-4">
        <LoginScreen />
      </div>
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AccessGate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
