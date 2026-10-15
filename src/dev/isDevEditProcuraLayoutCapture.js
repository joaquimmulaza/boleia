import { isDevCaptureRoutesEnabled } from '../utils/devCaptureAccess';

/**
 * Captura DEV com Layout real (header + bottom nav) para Editar procura.
 * @returns {boolean}
 */
export function isDevEditProcuraLayoutCapture() {
  if (!isDevCaptureRoutesEnabled()) {
    return false;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.pathname.includes('geocoder-editar-procura-layout');
}
