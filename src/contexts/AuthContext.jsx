import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { PERFIL_COLUNAS_AUTH_CONTEXT_SELECT } from '../utils/perfisGrants.js';
import {
  isAnonOrAuthPrivilegeError,
  isLiveAuthSession,
  isAccessTokenExpiredOrNearExpiry,
} from '../utils/authProfileFetch.js';
import {
  refreshSessionOnceIfAllowed,
  resetAuthSessionRefreshState,
} from '../utils/authSessionRefresh.js';
import { PROFILE_LOAD_TIMEOUT_MS } from '../utils/profileLoadTimeout.js';
import {
  readPasswordRecoveryPending,
  markPasswordRecoveryPending,
  clearPasswordRecoveryStorage,
} from '../utils/passwordRecovery';
import { clearSwRuntimeCache } from '../utils/swRuntimeCache';

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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  /** true enquanto há sessão e o perfil ainda não foi resolvido (sucesso ou falha). */
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadTimedOut, setProfileLoadTimedOut] = useState(false);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(() =>
    readPasswordRecoveryPending()
  );

  /** Invalida conclusões de `fetchProfile` mais antigas (troca de user / fetch concorrente). */
  const fetchSeqRef = useRef(0);
  const profileLoadTimeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

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

    const { data: { session: initialSession }, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError || !isLiveAuthSession(initialSession)) {
      if (isCurrentFetch()) {
        setProfile(null);
        setProfileLoading(false);
        setProfileLoadTimedOut(false);
      }
      return null;
    }

    let didRefresh = false;
    let liveSession = initialSession;
    if (isAccessTokenExpiredOrNearExpiry(liveSession)) {
      const refreshed = await refreshSessionOnceIfAllowed(supabase, liveSession);
      didRefresh = Boolean(refreshed);
      if (refreshed) {
        liveSession = refreshed;
      }
    }

    const userId = liveSession.user.id;
    if (isCurrentFetch()) {
      setProfileLoadTimedOut(false);
    }
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

      if (privilegeError) {
        if (!didRefresh) {
          const { data: { session: beforeRefresh } } = await supabase.auth.getSession();
          const refreshed = isLiveAuthSession(beforeRefresh)
            ? await refreshSessionOnceIfAllowed(supabase, beforeRefresh)
            : null;
          didRefresh = Boolean(refreshed);
        }
        if (didRefresh) {
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

  const retryProfileLoad = useCallback(async () => {
    setProfileLoadTimedOut(false);
    const { data: { session: current } } = await supabase.auth.getSession();
    if (!isLiveAuthSession(current)) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
      return null;
    }
    return fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profileLoadTimeoutRef.current) {
      clearTimeout(profileLoadTimeoutRef.current);
      profileLoadTimeoutRef.current = null;
    }

    if (!session || !profileLoading || profileLoadTimedOut) {
      return undefined;
    }

    profileLoadTimeoutRef.current = setTimeout(async () => {
      profileLoadTimeoutRef.current = null;
      fetchSeqRef.current += 1;
      setProfileLoading(false);
      setProfileLoadTimedOut(true);
      const { data: { session: current } } = await supabase.auth.getSession();
      if (!isLiveAuthSession(current)) {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    }, PROFILE_LOAD_TIMEOUT_MS);

    return () => {
      if (profileLoadTimeoutRef.current) {
        clearTimeout(profileLoadTimeoutRef.current);
        profileLoadTimeoutRef.current = null;
      }
    };
  }, [session, profileLoading, profileLoadTimedOut]);

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
          resetAuthSessionRefreshState();
          setProfileLoadTimedOut(false);
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
    profileLoadTimedOut,
    retryProfileLoad,
    tipoPerfil,
    refreshProfile,
    passwordRecoveryPending,
    clearPasswordRecovery,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
