import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Profile from '../pages/Profile';
import DevPerfilPushPreview from '../pages/DevPerfilPushPreview';
import DevPerfilCaptureShell from '../pages/DevPerfilCapture';
import DevPerfilCaptureMotoristaShell from '../pages/DevPerfilCaptureMotorista';
import DevPagamentoPanelCapture from '../pages/DevPagamentoPanelCapture';
import DevAcordosChipCapture from '../pages/DevAcordosChipCapture';
<<<<<<< HEAD
import DevMotoristaJustaCausaCapture from '../pages/DevMotoristaJustaCausaCapture';
=======
import DevNotifCards269Capture from '../pages/DevNotifCards269Capture';
import { isDevCaptureRoutesEnabled } from '../utils/devCaptureAccess';
>>>>>>> origin/main

/**
 * Rotas relativas a `/__dev/*` (lazy + `<Route path="/__dev/*" />` em App.jsx).
 *
 * `vite dev`, `localhost` / `127.0.0.1`, ou preview
 * `boleia-<9 alnum>-joaquim-mulazas-projects.vercel.app`. Ver `devCaptureAccess.js`.
 */
export default function DevAppRoutes() {
  if (!isDevCaptureRoutesEnabled()) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="pagamento-panel" element={<DevPagamentoPanelCapture />} />
      <Route path="perfil-push" element={<DevPerfilPushPreview />} />
      <Route path="perfil" element={<DevPerfilCaptureShell />}>
        <Route index element={<Profile />} />
      </Route>
      <Route path="perfil-motorista" element={<DevPerfilCaptureMotoristaShell />}>
        <Route index element={<Profile />} />
      </Route>
      <Route path="acordos-chips" element={<DevAcordosChipCapture />} />
<<<<<<< HEAD
      <Route path="motorista-jc-passageiro" element={<DevMotoristaJustaCausaCapture />} />
=======
      <Route path="notif-cards-269" element={<DevNotifCards269Capture />} />
>>>>>>> origin/main
    </Routes>
  );
}
