import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import MarketplaceExplore from './pages/MarketplaceExplore';
import PublicLegalPage from './pages/PublicLegalPage';
import Layout from './layouts/Layout';
import PassengerDashboard from './pages/PassengerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import AbsenceTracker from './pages/AbsenceTracker';
import ProtectedRoute from './components/ProtectedRoute';
import PublishRoute from './pages/PublishRoute';
import MyAgreements from './pages/MyAgreements';
import AvaliarMotorista from './pages/AvaliarMotorista';
import AvaliarPassageirosLista from './pages/AvaliarPassageirosLista';
import AvaliarPassageiro from './pages/AvaliarPassageiro';
import AvaliarSucesso from './pages/AvaliarSucesso';
import AvaliarExpirado from './pages/AvaliarExpirado';
import AvaliarSaidaPrompt from './pages/AvaliarSaidaPrompt';
import AcordoPrecoNovo from './pages/AcordoPrecoNovo';
import AcordoPrecoProposta from './pages/AcordoPrecoProposta';
import AcordoPrecoContraPropor from './pages/AcordoPrecoContraPropor';
import AcordoPrecoHistorico from './pages/AcordoPrecoHistorico';
import AcordoRenovar from './pages/AcordoRenovar';
import AcordoNaoRenovar from './pages/AcordoNaoRenovar';
import VehicleSetup from './pages/VehicleSetup';
import Profile from './pages/Profile';
import AdminPagamentos from './pages/AdminPagamentos';
import AdminRoute from './components/AdminRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import UpdatePrompt from './components/UpdatePrompt';
import OfflineBanner from './components/OfflineBanner';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePasswordRecoveryRouteRedirect } from './hooks/usePasswordRecoveryRouteRedirect';
import { needsProfileSetup } from './utils/oauth';

const LazyDevRoutes = import.meta.env.DEV
  ? lazy(() => import('./dev/LazyDevRoutes.jsx'))
  : null;

const RootRoute = () => {
  const { session, loading, profileLoading, profile, tipoPerfil, passwordRecoveryPending } = useAuth();

  if (loading || (session && profileLoading)) {
    return <div className="flex h-dvh items-center justify-center text-gray-500">A carregar...</div>;
  }
  if (session && passwordRecoveryPending) {
    return <Navigate to="/auth?mode=update-password" replace />;
  }
  if (session && needsProfileSetup(profile)) {
    return <Navigate to="/auth?mode=completar-perfil" replace />;
  }
  if (session) {
    if (tipoPerfil === 'Motorista') return <Navigate to="/motorista" replace />;
    return <Navigate to="/passageiro" replace />;
  }

  return <LandingPage />;
};

function AppShell() {
  usePasswordRecoveryRouteRedirect();
  const { isOffline } = useNetworkStatus();
  const { pathname } = useLocation();
  const isDevPublicRoute = import.meta.env.DEV && pathname.startsWith('/__dev/');

  const isPublicRoute = pathname === '/'
    || pathname === '/auth'
    || pathname === '/explorar'
    || pathname === '/privacidade'
    || pathname === '/eliminacao-de-dados'
    || isDevPublicRoute;

  const routes = (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/" element={<RootRoute />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/explorar" element={<MarketplaceExplore />} />
      <Route path="/privacidade" element={<PublicLegalPage page="privacidade" />} />
      <Route path="/eliminacao-de-dados" element={<PublicLegalPage page="eliminacao" />} />
      {import.meta.env.DEV && LazyDevRoutes ? (
        <Route
          path="/__dev/*"
          element={(
            <Suspense fallback={null}>
              <LazyDevRoutes />
            </Suspense>
          )}
        />
      ) : null}

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
          <Route path="/acordos/:acordoId/avaliar" element={<AvaliarMotorista />} />
          <Route path="/acordos/:acordoId/avaliar-passageiros" element={<AvaliarPassageirosLista />} />
          <Route path="/acordos/:acordoId/avaliar-passageiro/:passageiroId" element={<AvaliarPassageiro />} />
          <Route path="/acordos/:acordoId/avaliar/sucesso" element={<AvaliarSucesso />} />
          <Route path="/acordos/:acordoId/avaliar/expirado" element={<AvaliarExpirado />} />
          <Route path="/acordos/:acordoId/sair/avaliar" element={<AvaliarSaidaPrompt />} />
          <Route path="/acordos/:acordoId/preco/novo" element={<AcordoPrecoNovo />} />
          <Route path="/acordos/:acordoId/preco/proposta" element={<AcordoPrecoProposta />} />
          <Route path="/acordos/:acordoId/preco/contra-propor" element={<AcordoPrecoContraPropor />} />
          <Route path="/acordos/:acordoId/preco/historico" element={<AcordoPrecoHistorico />} />
          <Route path="/acordos/:acordoId/renovar" element={<AcordoRenovar />} />
          <Route path="/acordos/:acordoId/nao-renovar" element={<AcordoNaoRenovar />} />
          <Route path="/faltas" element={<AbsenceTracker />} />
          <Route path="/faltas/:acordoId" element={<AbsenceTracker />} />
          <Route path="/perfil" element={<Profile />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin/pagamentos" element={<AdminPagamentos />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  if (isPublicRoute) {
    return (
      <>
        {routes}
        <UpdatePrompt />
      </>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <OfflineBanner isOffline={isOffline} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {routes}
      </div>
      <UpdatePrompt />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export { AppShell };

export default App;
