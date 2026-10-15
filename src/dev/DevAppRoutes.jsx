import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isDevCaptureRoutesEnabled } from '../utils/devCaptureAccess';
import Profile from '../pages/Profile';
import DevPerfilPushPreview from '../pages/DevPerfilPushPreview';
import DevPerfilCaptureShell from '../pages/DevPerfilCapture';
import DevPerfilCaptureMotoristaShell from '../pages/DevPerfilCaptureMotorista';
import DevPagamentoPanelCapture from '../pages/DevPagamentoPanelCapture';
import DevAcordosChipCapture from '../pages/DevAcordosChipCapture';
import DevMotoristaJustaCausaCapture from '../pages/DevMotoristaJustaCausaCapture';
import DevJustaCausaConfirmCapture from '../pages/DevJustaCausaConfirmCapture';
import DevHotfixProdQaCapture from '../pages/DevHotfixProdQaCapture';
import DevNotifCards269Capture from '../pages/DevNotifCards269Capture';
import DevNotifV112Capture from '../pages/DevNotifV112Capture';
import DevGeocoderEditarProcuraCapture from '../pages/DevGeocoderEditarProcuraCapture';
import DevGeocoderEditarProcuraLayoutCapture from '../pages/DevGeocoderEditarProcuraLayoutCapture';
import DevGeocoderEditarGrupoCapture from '../pages/DevGeocoderEditarGrupoCapture';
import DevFaltasCapture from './DevFaltasCapture';

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
      <Route path="acordos-chip-capture" element={<DevAcordosChipCapture />} />
      <Route path="motorista-jc-passageiro" element={<DevMotoristaJustaCausaCapture />} />
      <Route path="justa-causa-confirm" element={<DevJustaCausaConfirmCapture />} />
      <Route path="hotfix-prod-qa-acordos" element={<DevHotfixProdQaCapture />} />
      <Route path="notif-cards-269" element={<DevNotifCards269Capture />} />
      <Route path="notif-v112" element={<DevNotifV112Capture />} />
      <Route path="geocoder-editar-procura" element={<DevGeocoderEditarProcuraCapture />} />
      <Route
        path="geocoder-editar-procura-layout"
        element={<DevGeocoderEditarProcuraLayoutCapture />}
      />
      <Route path="geocoder-editar-grupo" element={<DevGeocoderEditarGrupoCapture />} />
      <Route path="faltas-capture/:acordoId" element={<DevFaltasCapture />} />
      <Route path="faltas-capture-liquidado/:acordoId" element={<DevFaltasCapture />} />
      <Route path="faltas-capture-motorista/:acordoId" element={<DevFaltasCapture />} />
      <Route path="faltas-capture-motorista-1pax/:acordoId" element={<DevFaltasCapture />} />
    </Routes>
  );
}
