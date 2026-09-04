import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
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
import { AuthProvider, useAuth } from './contexts/AuthContext';
import UpdatePrompt from './components/UpdatePrompt';

const RootRoute = () => {
  const { session, loading, tipoPerfil } = useAuth();

  if (loading) return <div className="flex h-dvh items-center justify-center text-gray-500">A carregar...</div>;
  if (session) {
    if (tipoPerfil === 'Motorista') return <Navigate to="/motorista" replace />;
    return <Navigate to="/passageiro" replace />;
  }

  return <LandingPage />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/" element={<RootRoute />} />
            <Route path="/auth" element={<Auth />} />

            {/* Rotas protegidas envolvidas pelo Layout global (com BottomBar) */}
            <Route element={<Layout />}>
              {/* Rotas exclusivas do Passageiros */}
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
          <UpdatePrompt />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
