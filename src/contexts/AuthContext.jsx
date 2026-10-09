import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { PERFIL_COLUNAS_AUTH_CONTEXT_SELECT } from '../utils/perfisGrants.js';
import {
  isAnonOrAuthPrivilegeError,
  isLiveAuthSession,
  isAccessTokenExpiredOrNearExpiry,
  profileFetchSessionKey,
} from '../utils/authProfileFetch.js';
import {
  readPasswordRecoveryPending,
  markPasswordRecoveryPending,
  clearPasswordRecoveryStorage,
} from '../utils/passwordRecovery';
import { clearSwRuntimeCache } from '../utils/swRuntimeCache';

/** Cooldown mínimo entre `refreshSession` por utilizador (evita loop 401/TOKEN_REFRESHED). */
const AUTH_REFRESH_COOLDOWN_MS = 60_000;

const AuthContext = createContext(undefined);

/**
 * Normaliza o tipo de perfil para valores canónicos do projecto.
 * @param {string | null | undefined} value
 * @returns {'Passageiro' | 'Motorista' | null}
 */
const normalizeTipoPerfil = (value) => {
  if (!value) return null;
  const lower = String(value).toLowerCase();
  if (lower === 'motorista') return 'Motorista';
  if (lower === 'passageiro') return 'Passageiro';
  return null;
};

/**
 * @param {{ children: React.ReactNode }} props
 */
function AuthProviderLive({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  /** true enquanto há sessão e o perfil ainda não foi resolvido (sucesso ou falha). */
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(() =>
    readPasswordRecoveryPending()
  );

  /** Máx. um refresh-retry por par user.id + access_token. */
  const profileRefreshAttemptedRef = useRef(/** @type {Set<string>} */ (new Set()));
  /** Timestamp do último refreshSession por user.id. */
  const authRetryAtRef = useRef(/** @type {Record<string, number>} */ ({}));
  /** Invalida conclusões de `fetchProfile` mais antigas (troca de user / fetch concorrente). */
  const fetchSeqRef = useRef(0);

  const clearPasswordRecovery = useCallback(() => {
    clearPasswordRecoveryStorage();
    setPasswordRecoveryPending(false);
  }, []);

  const fetchProfile = useCallback(async () => {
    const seq = ++fetchSeqRef.current;

    const isCurrentFetch = () => seq === fetchSeqRef.current;

    const setLoadingIfCurrent = (value) => {
      if (isCurrentFetch()) {
        setProfileLoading(value);
      }
    };

    const { data: { session: liveSession }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !isLiveAuthSession(liveSession)) {
      if (isCurrentFetch()) {
        setProfile(null);
        setProfileLoading(false);
      }
      return null;
    }

    const userId = liveSession.user.id;
    const sessionKey = profileFetchSessionKey(liveSession);
    setLoadingIfCurrent(true);

    const loadProfile = async () => {
      const [perfisResult, contactoResult] = await Promise.all([
        supabase
          .from('perfis')
          .select(PERFIL_COLUNAS_AUTH_CONTEXT_SELECT)
          .eq('id', userId)
          .single(),
        supabase.rpc('get_own_perfil_contacto'),
      ]);
      return { perfisResult, contactoResult };
    };

    try {
      let { perfisResult, contactoResult } = await loadProfile();
      if (!isCurrentFetch()) {
        return null;
      }

      let perfisError = perfisResult.error;
      let contactoError = contactoResult.error;

      const privilegeError =
        isAnonOrAuthPrivilegeError(perfisError) || isAnonOrAuthPrivilegeError(contactoError);

      const lastRetryAt = authRetryAtRef.current[userId] ?? 0;
      const cooldownElapsed = Date.now() - lastRetryAt >= AUTH_REFRESH_COOLDOWN_MS;

      if (
        privilegeError
        && cooldownElapsed
        && !profileRefreshAttemptedRef.current.has(sessionKey)
        && isAccessTokenExpiredOrNearExpiry(liveSession)
      ) {
        profileRefreshAttemptedRef.current.add(sessionKey);
        authRetryAtRef.current[userId] = Date.now();
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (
          !refreshError
          && isLiveAuthSession(refreshed?.session)
          && refreshed.session.user.id === userId
        ) {
          ({ perfisResult, contactoResult } = await loadProfile());
          perfisError = perfisResult.error;
          contactoError = contactoResult.error;
        }
      }

      if (!isCurrentFetch()) {
        return null;
      }

      const { data: { session: afterSession } } = await supabase.auth.getSession();
      if (!isLiveAuthSession(afterSession) || afterSession.user.id !== userId) {
        if (isCurrentFetch()) {
          setProfile(null);
        }
        return null;
      }

      if (perfisError || contactoError) {
        if (isLiveAuthSession(afterSession)) {
          console.warn('[AuthContext] Erro ao carregar perfil:', perfisError || contactoError);
        }
        if (isCurrentFetch()) {
          setProfile(null);
        }
        return null;
      }

      const { is_admin: _isAdmin, ...resto } = perfisResult.data;
      const profileData = {
        ...resto,
        telefone: contactoResult.data?.telefone ?? null,
        iban: contactoResult.data?.iban ?? null,
      };
      if (isCurrentFetch()) {
        setProfile(profileData);
      }
      return profileData;
    } finally {
      setLoadingIfCurrent(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return null;
    return fetchProfile();
  }, [user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;
    const lastUserIdRef = { current: null };

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return;

      setSession(initialSession);
      setUser(initialSession?.user || null);

      if (isLiveAuthSession(initialSession)) {
        lastUserIdRef.current = initialSession.user.id;
        setProfileLoading(true);
        setLoading(false);
        await fetchProfile();
      } else {
        setProfile(null);
        setProfileLoading(false);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setLoading(false);
        setProfileLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        const nextUserId = nextSession?.user?.id ?? null;

        setSession(nextSession);
        setUser(nextSession?.user || null);

        if (event === 'PASSWORD_RECOVERY') {
          markPasswordRecoveryPending();
          setPasswordRecoveryPending(true);
        }

        if (event === 'SIGNED_OUT' || !nextSession) {
          clearPasswordRecoveryStorage();
          setPasswordRecoveryPending(false);
          void clearSwRuntimeCache();
          lastUserIdRef.current = null;
          profileRefreshAttemptedRef.current.clear();
          authRetryAtRef.current = {};
          fetchSeqRef.current += 1;
        } else if (lastUserIdRef.current && nextUserId && lastUserIdRef.current !== nextUserId) {
          fetchSeqRef.current += 1;
          void clearSwRuntimeCache();
        }

        if (nextUserId) {
          lastUserIdRef.current = nextUserId;
        }

        // Evita deadlock com getSession: não usar async/await nem chamadas Supabase directas aqui.
        setTimeout(() => {
          if (!isMounted) return;
          if (event === 'TOKEN_REFRESHED') {
            return;
          }
          if (isLiveAuthSession(nextSession)) {
            void fetchProfile();
          } else {
            setProfile(null);
            setProfileLoading(false);
          }
        }, 0);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const tipoPerfil =
    normalizeTipoPerfil(profile?.tipo_perfil) ||
    normalizeTipoPerfil(user?.user_metadata?.tipo_perfil);

  const value = {
    session,
    user,
    profile,
    loading,
    profileLoading,
    tipoPerfil,
    refreshProfile,
    passwordRecoveryPending,
    clearPasswordRecovery,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * @param {{ children: React.ReactNode; devValue?: Record<string, unknown> }} props
 * `devValue` — apenas DEV: injecta valor AuthContext (capturas `/__dev/*`).
 */
export function AuthProvider({ children, devValue }) {
  if (import.meta.env.DEV && devValue !== undefined) {
    return <AuthContext.Provider value={devValue}>{children}</AuthContext.Provider>;
  }
  return <AuthProviderLive>{children}</AuthProviderLive>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

/**
 * @internal DEV — export raw só para `DevAuthProvider` / capturas em `src/dev/`.
 * Produção: preferir `AuthProvider`, `useAuth` e `devValue` (DEV).
 */
export { AuthContext };
