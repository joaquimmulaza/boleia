import { isDevCaptureRoutesEnabled } from '../utils/devCaptureAccess';
import {
  faltasCaptureGetAbsences,
  faltasCaptureGetAgreementsForPassenger,
  faltasCaptureListPagamentos,
} from './faltasCaptureFixtures';

const CAPTURE_PATH = '/__dev/faltas-capture/';

/** @returns {boolean} */
function isFaltasCaptureUrl() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes(CAPTURE_PATH);
}

/**
 * @returns {{
 *   getAbsences?: (acordoId: string) => Promise<object[]>,
 *   listPagamentosByAcordo?: (acordoId: string) => Promise<object[]>,
 *   getAgreementsForPassenger?: (passengerId: string) => Promise<object[]>,
 * } | null}
 */
export function getFaltasCaptureDevBridge() {
  if (!import.meta.env.DEV || !isDevCaptureRoutesEnabled()) return null;
  if (!isFaltasCaptureUrl()) return null;
  return {
    getAbsences: faltasCaptureGetAbsences,
    listPagamentosByAcordo: faltasCaptureListPagamentos,
    getAgreementsForPassenger: faltasCaptureGetAgreementsForPassenger,
  };
}
