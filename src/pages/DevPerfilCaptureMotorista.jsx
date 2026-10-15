import React from 'react';
import DevAuthProvider from '../dev/DevAuthProvider';
import Layout from '../layouts/Layout';
import { DEV_PERFIL_CAPTURE_AUTH_MOTORISTA } from '../dev/devPerfilCaptureAuth';

/**
 * Shell DEV motorista para capturas `/__dev/perfil-motorista`.
 */
export default function DevPerfilCaptureMotoristaShell() {
  return (
    <DevAuthProvider value={DEV_PERFIL_CAPTURE_AUTH_MOTORISTA}>
      <Layout />
    </DevAuthProvider>
  );
}
