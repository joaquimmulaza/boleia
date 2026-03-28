import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute – Auth Guard com suporte a RBAC.
 *
 * @param {{ allowedRole?: 'Passageiro' | 'Motorista' }} props
 *   - allowedRole: se fornecido, o utilizador deve ter este tipo_perfil.
 *     Se omitido, qualquer utilizador autenticado pode aceder.
 */
const ProtectedRoute = ({ allowedRole }) => {
  const { session, loading, tipoPerfil } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        A verificar sessão...
      </div>
    );
  }

  // 1. Sem sessão → redireciona para login
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // 2. Com sessão mas role inválido → redireciona para o dashboard correto
  if (allowedRole && tipoPerfil !== allowedRole) {
    const correctPath = tipoPerfil === 'Motorista' ? '/motorista' : '/passageiro';
    return <Navigate to={correctPath} replace />;
  }

  // 3. Tudo correto → renderiza o conteúdo protegido
  return <Outlet />;
};

export default ProtectedRoute;
