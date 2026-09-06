import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Rota reservada a administradores da plataforma (`perfis.is_admin`).
 */
const AdminRoute = () => {
  const { session, loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-500">
        A verificar sessão...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile?.is_admin) {
    return <Navigate to="/acordos" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
