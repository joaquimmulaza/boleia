import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getOAuthRedirectUrl } from '../utils/appOrigin';
import {
  OAUTH_MESSAGE_KEY,
  OAUTH_PENDING_KEY,
  OAUTH_PROVIDER_KEY,
  getProviderLabel,
  mapOAuthError,
  needsProfileSetup,
  parseOAuthCallback,
  startOAuthSignIn,
} from '../utils/oauth';

/**
 * Arranque OAuth, erros de callback e destino depois da sessão.
 * @param {{ enabled?: boolean }} [options]
 */
export function useSocialAuth({ enabled = true } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    session,
    profile,
    loading,
    profileLoading,
    tipoPerfil,
    passwordRecoveryPending,
  } = useAuth();
  const [pendingProvider, setPendingProvider] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const handledError = useRef(false);
  const pendingLock = useRef(false);

  const params = new URLSearchParams(location.search);
  const parsedCallback = enabled ? parseOAuthCallback(params) : null;
  const providerId = typeof sessionStorage !== 'undefined'
    ? sessionStorage.getItem(OAUTH_PROVIDER_KEY)
    : null;
  const urlMessage = parsedCallback
    ? mapOAuthError({
      error: parsedCallback.error,
      errorCode: parsedCallback.description,
      providerLabel: getProviderLabel(providerId),
    })
    : '';
  const storedMessage = typeof sessionStorage !== 'undefined'
    ? sessionStorage.getItem(OAUTH_MESSAGE_KEY) || ''
    : '';
  const callbackMessage = actionMessage || urlMessage || storedMessage;

  useEffect(() => {
    if (!enabled) return undefined;
    const current = new URLSearchParams(location.search);
    const parsed = parseOAuthCallback(current);
    if (!parsed || handledError.current) return undefined;
    handledError.current = true;
    const label = getProviderLabel(sessionStorage.getItem(OAUTH_PROVIDER_KEY));
    const message = mapOAuthError({
      error: parsed.error,
      errorCode: parsed.description,
      providerLabel: label,
    });
    console.error('[oauth] callback', parsed.error, parsed.description);
    sessionStorage.setItem(OAUTH_MESSAGE_KEY, message);
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
    pendingLock.current = false;
    current.delete('error');
    current.delete('error_description');
    current.delete('error_code');
    const next = current.toString();
    navigate(next ? `/auth?${next}` : '/auth', { replace: true });
    return undefined;
  }, [enabled, location.search, navigate]);

  useEffect(() => {
    if (!enabled || loading || profileLoading || passwordRecoveryPending) return;
    if (!session) return;
    const params = new URLSearchParams(location.search);
    if (params.get('error')) return;
    const pending = sessionStorage.getItem(OAUTH_PENDING_KEY) === '1';
    const hasCode = Boolean(params.get('code'));
    if (!pending && !hasCode) return;

    if (needsProfileSetup(profile)) {
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      if (!location.search.includes('mode=completar-perfil')) {
        navigate('/auth?mode=completar-perfil', { replace: true });
      }
      return;
    }

    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
    const destino = tipoPerfil === 'Motorista' ? '/motorista' : '/passageiro';
    navigate(destino, { replace: true });
  }, [
    enabled,
    session,
    profile,
    loading,
    profileLoading,
    tipoPerfil,
    passwordRecoveryPending,
    location.search,
    navigate,
  ]);

  /**
   * @param {string} provider
   * @param {{ tipoPerfil?: string }} [options]
   */
  const start = async (provider, { tipoPerfil: role } = {}) => {
    if (pendingLock.current) return;
    pendingLock.current = true;
    setPendingProvider(provider);
    sessionStorage.removeItem(OAUTH_MESSAGE_KEY);
    setActionMessage('');
    const { error } = await startOAuthSignIn(supabase, provider, {
      tipoPerfil: role,
      redirectTo: getOAuthRedirectUrl(),
    });
    if (error) {
      console.error('[oauth] start', provider, error);
      setActionMessage(mapOAuthError({
        error: error.message,
        providerLabel: getProviderLabel(provider),
      }));
      setPendingProvider(null);
      pendingLock.current = false;
    }
  };

  return { pendingProvider, callbackMessage, start };
}
