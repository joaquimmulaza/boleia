import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { needsProfileSetup } from '../utils/oauth';
import ProfileLoadGate from './ProfileLoadGate';

/**
 * Rota reservada a administradores da plataforma.
 * O boolean vem de `is_platform_admin()` — a coluna `is_admin` não entra no perfil.
 * Espera o perfil carregar — senão `profile=null` redireccionava admins para `/acordos`.
 */
const AdminRoute = () => {
  const {
    session,
    loading,
    profileLoading,
    profileLoadTimedOut,
    profile,
    passwordRecoveryPending,
  } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(null);

  const profileGateActive = loading || (session && profileLoading) || profileLoadTimedOut;
  const profileReady = !profileGateActive;
  const mustCheckAdmin = Boolean(session)
    && profileReady
    && !passwordRecoveryPending
    && !needsProfileSetup(profile);
  const adminUserId = mustCheckAdmin ? session.user.id : null;
  const adminPending = adminUserId !== null && resolvedUserId !== adminUserId;

  useEffect(() => {
    if (!adminUserId) return undefined;

    let cancelled = false;
    supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (cancelled) return;
      setIsAdmin(!error && data === true);
      setResolvedUserId(adminUserId);
    });

    return () => {
      cancelled = true;
    };
  }, [adminUserId]);

  if (profileGateActive) {
    return <ProfileLoadGate />;
  }

  if (adminPending) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        A carregar perfil...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (passwordRecoveryPending) {
    return <Navigate to="/auth?mode=update-password" replace />;
  }

  if (needsProfileSetup(profile)) {
    return <Navigate to="/auth?mode=completar-perfil" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/acordos" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
