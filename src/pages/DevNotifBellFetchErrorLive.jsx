import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';

/** @type {import('../contexts/AuthContext').AuthContextValue} */
const DEV_AUTH = {
  session: { user: { id: 'dev-notif-fetch-error' } },
  user: { id: 'dev-notif-fetch-error' },
  loading: false,
  tipoPerfil: 'Passageiro',
  profile: null,
  refreshProfile: async () => {},
  passwordRecoveryPending: false,
  clearPasswordRecovery: () => {},
};

/**
 * QA preview — sino real com fetch forçado a falhar (`notificationsDevFetch.js`).
 *
 * @typedef {Readonly<{}>} DevNotifBellFetchErrorLiveProps
 */
export default function DevNotifBellFetchErrorLive() {
  return (
    <AuthProvider devValue={DEV_AUTH}>
      <div
        className="min-h-dvh bg-background-light dark:bg-background-dark px-4 pt-6"
        data-testid="dev-notif-bell-fetch-error-live"
      >
        <p className="mx-auto max-w-[390px] text-sm text-muted-foreground mb-4">
          Abre o sino — cada abertura refaz o fetch (falha forçada). Com lista em cache deve aparecer a faixa de erro.
        </p>
        <div className="mx-auto max-w-[390px] flex justify-end">
          <NotificationBell />
        </div>
      </div>
    </AuthProvider>
  );
}
