import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { needsProfileSetup } from '../utils/oauth';

/**
 * ProtectedRoute – Auth Guard com suporte a RBAC.
 *
 * @param {{ allowedRole?: 'Passageiro' | 'Motorista' }} props
 *   - allowedRole: se fornecido, o utilizador deve ter este tipo_perfil.
 *     Se omitido, qualquer utilizador autenticado pode aceder.
 */
const ProtectedRoute = ({ allowedRole }) => {
  const { session, loading, profileLoading, profile, tipoPerfil, passwordRecoveryPending } = useAuth();

  if (loading || (session && profileLoading)) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-500">
        {loading ? 'A verificar sessão...' : 'A carregar perfil...'}
      </div>
    );
  }

  // 1. Sem sessão → redireciona para login
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // 1b. Sessão de recovery → obrigar a definir nova palavra-passe
  if (passwordRecoveryPending) {
    return <Navigate to="/auth?mode=update-password" replace />;
  }

  if (needsProfileSetup(profile)) {
    return <Navigate to="/auth?mode=completar-perfil" replace />;
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
