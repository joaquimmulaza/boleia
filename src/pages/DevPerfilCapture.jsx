import React from 'react';
import { DevAuthProvider } from '../contexts/AuthContext';
import Layout from '../layouts/Layout';
import { DEV_PERFIL_CAPTURE_AUTH } from '../dev/devPerfilCaptureAuth';

/**
 * Shell DEV: Layout autenticado com auth injectado (filho = `<Outlet />` → Profile).
 */
export default function DevPerfilCaptureShell() {
  return (
    <DevAuthProvider value={DEV_PERFIL_CAPTURE_AUTH}>
      <Layout />
    </DevAuthProvider>
  );
}
