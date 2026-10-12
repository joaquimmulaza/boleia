import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Profile from '../pages/Profile';
import DevPerfilPushPreview from '../pages/DevPerfilPushPreview';
import DevPerfilCaptureShell from '../pages/DevPerfilCapture';
import DevAcordosChipCapture from '../pages/DevAcordosChipCapture';
import DevNotifCards269Capture from '../pages/DevNotifCards269Capture';

/**
 * Rotas relativas a `/__dev/*` (lazy + `<Route path="/__dev/*" />` em App.jsx).
 */
export default function DevAppRoutes() {
  return (
    <Routes>
      <Route path="perfil-push" element={<DevPerfilPushPreview />} />
      <Route path="perfil" element={<DevPerfilCaptureShell />}>
        <Route index element={<Profile />} />
      </Route>
      <Route path="acordos-chips" element={<DevAcordosChipCapture />} />
      <Route path="notif-cards-269" element={<DevNotifCards269Capture />} />
    </Routes>
  );
}
