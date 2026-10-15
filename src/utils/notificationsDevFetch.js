import { isDevCaptureRoutesEnabled } from './devCaptureAccess';

const DEV_SEED_WITH_LIST = [
  {
    id: 'dev-notif-seed-1',
    mensagem: 'Notificação de exemplo (lista em cache)',
    tipo: 'info',
    lida: false,
    created_at: '2026-10-15T09:00:00.000Z',
    metadata: { qa: true },
  },
];

/**
 * QA preview — força falha no fetch do sino e opcionalmente semeia lista em cache.
 *
 * @returns {{ forceFetchError: true, seed: object[] } | null}
 */
export function getNotificationsDevFetchConfig() {
  if (!isDevCaptureRoutesEnabled() || typeof window === 'undefined') {
    return null;
  }
  const path = window.location.pathname;
  if (path.endsWith('/notif-bell-fetch-error-with-list')) {
    return { forceFetchError: true, seed: DEV_SEED_WITH_LIST };
  }
  if (path.endsWith('/notif-bell-fetch-error')) {
    return { forceFetchError: true, seed: [] };
  }
  return null;
}

export { DEV_SEED_WITH_LIST };
