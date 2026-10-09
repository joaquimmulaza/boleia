import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  buildAuthUrlWithOpenAcordo,
  parseOpenAcordoIdFromSearch,
} from '../utils/authOpenAcordoRedirect.js';
import { Button } from './ui/button';
import { PROFILE_LOAD_TIMEOUT_MS } from '../utils/profileLoadTimeout.js';

export { PROFILE_LOAD_TIMEOUT_MS };

/**
 * Gate partilhado: loading de sessão/perfil com timeout e retry.
 * @param {{ loadingLabel?: string, profileLoadingLabel?: string }} props
 */
export default function ProfileLoadGate({
  loadingLabel = 'A verificar sessão...',
  profileLoadingLabel = 'A carregar perfil...',
}) {
  const location = useLocation();
  const {
    session,
    loading,
    profileLoading,
    profileLoadTimedOut,
    retryProfileLoad,
  } = useAuth();

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        {loadingLabel}
      </div>
    );
  }

  if (session && profileLoading && !profileLoadTimedOut) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        {profileLoadingLabel}
      </div>
    );
  }

  if (profileLoadTimedOut && !session) {
    const openAcordoId = parseOpenAcordoIdFromSearch(location.search);
    const authUrl = buildAuthUrlWithOpenAcordo({ openAcordoId, sessionEnded: true });
    return <Navigate to={authUrl} replace />;
  }

  if (profileLoadTimedOut) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar a tua conta. Tenta outra vez.
        </p>
        <Button type="button" onClick={() => retryProfileLoad()}>
          Tentar outra vez
        </Button>
      </div>
    );
  }

  return null;
}
