import React from 'react';
import DevAuthProvider from './DevAuthProvider';
import AbsenceTracker from '../pages/AbsenceTracker';
import { FALTAS_CAPTURE_AUTH } from './faltasCaptureFixtures';

/**
 * Captura DEV — AbsenceTracker real (rota `/__dev/faltas-capture/:acordoId`).
 * Mocks via `getFaltasCaptureDevBridge()` (pathname DEV).
 */
export default function DevFaltasCapture() {
  return (
    <DevAuthProvider value={FALTAS_CAPTURE_AUTH}>
      <AbsenceTracker />
    </DevAuthProvider>
  );
}
