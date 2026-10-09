import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  buildAuthUrlWithOpenAcordo,
  parseOpenAcordoIdFromSearch,
} from '../utils/authOpenAcordoRedirect.js';
import { useAuth } from '../contexts/AuthContext';
import { needsProfileSetup } from '../utils/oauth';
import ProfileLoadGate from './ProfileLoadGate';

/**
 * ProtectedRoute – Auth Guard com suporte a RBAC.
 *
 * @param {{ allowedRole?: 'Passageiro' | 'Motorista' }} props
 *   - allowedRole: se fornecido, o utilizador deve ter este tipo_perfil.
 *     Se omitido, qualquer utilizador autenticado pode aceder.
 */
const ProtectedRoute = ({ allowedRole }) => {
  const location = useLocation();
  const {
    session,
    loading,
    profileLoading,
    profileLoadTimedOut,
    profile,
    tipoPerfil,
    passwordRecoveryPending,
    sessionEndedForAuthRedirect,
  } = useAuth();

  if (loading || (session && profileLoading) || profileLoadTimedOut) {
    return <ProfileLoadGate />;
  }

  // 1. Sem sessão → login com openAcordoId validado (UUID), nunca path completo
  if (!session) {
    const openAcordoId = parseOpenAcordoIdFromSearch(location.search);
    return (
      <Navigate
        to={buildAuthUrlWithOpenAcordo({
          openAcordoId,
          sessionEnded: sessionEndedForAuthRedirect,
        })}
        replace
      />
    );
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
