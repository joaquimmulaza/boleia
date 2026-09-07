import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Rota reservada a administradores da plataforma (`perfis.is_admin`).
 * Espera o perfil carregar — senão `profile=null` redireccionava admins para `/acordos`.
 */
const AdminRoute = () => {
  const { session, loading, profileLoading, profile } = useAuth();

  if (loading || (session && profileLoading)) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-500">
        {loading ? 'A verificar sessão...' : 'A carregar perfil...'}
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Perfil falhou ou ainda null após fetch — sem admin
  if (!profile?.is_admin) {
    return <Navigate to="/acordos" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
