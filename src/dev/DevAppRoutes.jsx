import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Profile from '../pages/Profile';
import DevPerfilPushPreview from '../pages/DevPerfilPushPreview';
import DevPerfilCaptureShell from '../pages/DevPerfilCapture';
import DevAcordosChipCapture from '../pages/DevAcordosChipCapture';
import DevNotifCards269Capture from '../pages/DevNotifCards269Capture';

/**
 * Rotas relativas a `/__dev/*` (lazy + `<Route path="/__dev/*" />` em App.jsx).
 *
 * Só montadas quando `import.meta.env.DEV` (vite dev local). Builds de produção
 * e **Vercel Preview** (`vite build`) têm DEV=false — `/__dev/*` cai no fallback
 * `Navigate /`; Critiquito QA nas previews Vercel **não** acede a estas capturas
 * (usar `npm run dev` localmente).
 */
export default function DevAppRoutes() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

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
