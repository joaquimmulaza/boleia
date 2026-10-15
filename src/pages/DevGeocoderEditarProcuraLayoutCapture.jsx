import React from 'react';
import { Route, Routes } from 'react-router-dom';
import DevAuthProvider from '../dev/DevAuthProvider';
import { DEV_PERFIL_CAPTURE_AUTH } from '../dev/devPerfilCaptureAuth';
import Layout from '../layouts/Layout';
import PassengerDashboard from './PassengerDashboard';

/**
 * Captura DEV — Editar procura dentro do Layout autenticado (header + bottom nav).
 * Usa o BrowserRouter global de App.jsx (sem router aninhado).
 */
export default function DevGeocoderEditarProcuraLayoutCapture() {
  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <DevAuthProvider value={DEV_PERFIL_CAPTURE_AUTH}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<PassengerDashboard />} />
          </Route>
        </Routes>
      </DevAuthProvider>
    </div>
  );
}
