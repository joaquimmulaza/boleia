import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import Layout from './layouts/Layout';
import PassengerDashboard from './pages/PassengerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import AbsenceTracker from './pages/AbsenceTracker';
import ProtectedRoute from './components/ProtectedRoute';
import PublishRoute from './pages/PublishRoute';
import MyAgreements from './pages/MyAgreements';
import VehicleSetup from './pages/VehicleSetup';
import Profile from './pages/Profile';
import { ThemeProvider } from './contexts/ThemeContext';

const RootRedirect = () => {
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (isMounted) setRedirectPath('/auth');
      } else {
        const perf = user.user_metadata?.tipo_perfil;
        if (perf === 'Motorista') {
          if (isMounted) setRedirectPath('/motorista');
        } else {
          if (isMounted) setRedirectPath('/passageiro');
        }
      }
      if (isMounted) setLoading(false);
    };
    checkSession();
    return () => { isMounted = false; };
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">A carregar...</div>;
  if (redirectPath) return <Navigate to={redirectPath} replace />;
  return null;
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/auth" element={<Auth />} />

          {/* Rotas protegidas envolvidas pelo Layout global (com BottomBar) */}
          <Route element={<Layout />}>
            {/* Rotas exclusivas do Passageiro */}
            <Route element={<ProtectedRoute allowedRole="Passageiro" />}>
              <Route path="/passageiro" element={<PassengerDashboard />} />
            </Route>

            {/* Rotas exclusivas do Motorista */}
            <Route element={<ProtectedRoute allowedRole="Motorista" />}>
              <Route path="/motorista" element={<DriverDashboard />} />
              <Route path="/veiculo" element={<VehicleSetup />} />
              <Route path="/publicar-trajeto" element={<PublishRoute />} />
            </Route>

            {/* Rotas partilhadas (qualquer utilizador autenticado) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/acordos" element={<MyAgreements />} />
              <Route path="/faltas" element={<AbsenceTracker />} />
              <Route path="/faltas/:acordoId" element={<AbsenceTracker />} />
              <Route path="/perfil" element={<Profile />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
