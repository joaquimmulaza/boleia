import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PERFIL_COLUNAS_SELECT } from '../services/ProfileService';
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
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(() =>
    readPasswordRecoveryPending()
  );

  const clearPasswordRecovery = useCallback(() => {
    clearPasswordRecoveryStorage();
    setPasswordRecoveryPending(false);
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }

    setProfileLoading(true);
    try {
      const [{ data, error }, contactoResult] = await Promise.all([
        supabase.from('perfis').select(PERFIL_COLUNAS_SELECT).eq('id', userId).single(),
        supabase.rpc('get_own_perfil_contacto'),
      ]);

      if (error || contactoResult.error) {
        console.warn('[AuthContext] Erro ao carregar perfil:', error || contactoResult.error);
        setProfile(null);
        return null;
      }

      const { is_admin: _isAdmin, ...resto } = data;
      const profile = {
        ...resto,
        telefone: contactoResult.data?.telefone ?? null,
        iban: contactoResult.data?.iban ?? null,
      };
      setProfile(profile);
      return profile;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) return null;
    return fetchProfile(currentUserId);
  }, [user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;
    const lastUserIdRef = { current: null };

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return;

      setSession(initialSession);
      setUser(initialSession?.user || null);

      if (initialSession?.user?.id) {
        lastUserIdRef.current = initialSession.user.id;
        // Marcar perfil a carregar ANTES de libertar loading da sessão
        // (evita AdminRoute ver session ok + profile null + profileLoading false).
        setProfileLoading(true);
        setLoading(false);
        await fetchProfile(initialSession.user.id);
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
        } else if (lastUserIdRef.current && nextUserId && lastUserIdRef.current !== nextUserId) {
          void clearSwRuntimeCache();
        }

        if (nextUserId) {
          lastUserIdRef.current = nextUserId;
        }

        // Evita deadlock com getSession: não usar async/await nem chamadas Supabase directas aqui.
        setTimeout(() => {
          if (!isMounted) return;
          if (nextSession?.user?.id) {
            void fetchProfile(nextSession.user.id);
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
