import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import MainLayout from './layouts/MainLayout';
import PassengerDashboard from './pages/PassengerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import ProtectedRoute from './components/ProtectedRoute';

const RootRedirect = () => {
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (isMounted) setRedirectPath('/auth');
      } else {
        const perf = session.user?.user_metadata?.tipo_perfil;
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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth" element={<Auth />} />

        {/* Rotas Protegidas envolvidas pelo MainLayout + ProtectedRoute (RBAC) */}
        <Route element={<MainLayout />}>
          <Route element={<ProtectedRoute allowedRole="Passageiro" />}>
            <Route path="/passageiro" element={<PassengerDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRole="Motorista" />}>
            <Route path="/motorista" element={<DriverDashboard />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/perfil" element={<div className="p-4 text-center mt-10 text-gray-500 font-semibold">Perfil (Em construção)</div>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
