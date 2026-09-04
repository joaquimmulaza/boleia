import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[AuthContext] Erro ao carregar perfil:', error);
      setProfile(null);
      return null;
    }

    setProfile(data);
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) return null;
    return fetchProfile(currentUserId);
  }, [user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;

      setSession(initialSession);
      setUser(initialSession?.user || null);
      setLoading(false);

      if (initialSession?.user?.id) {
        void fetchProfile(initialSession.user.id);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user || null);

        // Evita deadlock com getSession: não usar async/await nem chamadas Supabase directas aqui.
        setTimeout(() => {
          if (!isMounted) return;
          if (nextSession?.user?.id) {
            void fetchProfile(nextSession.user.id);
          } else {
            setProfile(null);
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
    tipoPerfil,
    refreshProfile,
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
