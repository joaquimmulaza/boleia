import React from 'react';
import { Route } from 'react-router-dom';
import Profile from '../pages/Profile';
import DevPerfilPushPreview from '../pages/DevPerfilPushPreview';
import DevPerfilCaptureShell from '../pages/DevPerfilCapture';

/**
 * Rotas públicas DEV (`/__dev/*`) — import dinâmico só quando `import.meta.env.DEV`.
 */
export default function DevAppRoutes() {
  return (
    <>
      <Route path="/__dev/perfil-push" element={<DevPerfilPushPreview />} />
      <Route path="/__dev/perfil" element={<DevPerfilCaptureShell />}>
        <Route index element={<Profile />} />
      </Route>
    </>
  );
}
