import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Profile from '../pages/Profile';
import DevPerfilPushPreview from '../pages/DevPerfilPushPreview';
import DevPerfilCaptureShell from '../pages/DevPerfilCapture';

/**
 * Rotas relativas a `/__dev/*` (montadas via lazy + `<Route path="/__dev/*" />` em App.jsx).
 * Só entra no bundle de produção se o import dinâmico não for eliminado — guard DEV em App.jsx.
 */
export default function DevAppRoutes() {
  return (
    <Routes>
      <Route path="perfil-push" element={<DevPerfilPushPreview />} />
      <Route path="perfil" element={<DevPerfilCaptureShell />}>
        <Route index element={<Profile />} />
      </Route>
    </Routes>
  );
}
