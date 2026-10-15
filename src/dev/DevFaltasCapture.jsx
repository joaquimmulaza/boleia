import React from 'react';
import DevAuthProvider from './DevAuthProvider';
import AbsenceTracker from '../pages/AbsenceTracker';
import { resolveFaltasCaptureAuthFromPath } from './faltasCaptureFixtures';

/**
 * Captura DEV — AbsenceTracker real (rota `/__dev/faltas-capture/:acordoId`).
 * Mocks via `getFaltasCaptureDevBridge()` (pathname DEV).
 */
export default function DevFaltasCapture() {
  const auth = resolveFaltasCaptureAuthFromPath();
  return (
    <DevAuthProvider value={auth}>
      <AbsenceTracker />
    </DevAuthProvider>
  );
}
