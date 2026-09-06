import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const DISMISS_STORAGE_KEY = 'pwa-update-dismissed';

/**
 * @returns {string | null}
 */
function getDismissedUpdateVersion() {
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string} version
 */
function setDismissedUpdateVersion(version) {
  if (!version) return;
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, version);
  } catch {
    // incognito / quota
  }
}

function clearDismissedUpdateVersion() {
  try {
    localStorage.removeItem(DISMISS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * @param {ServiceWorkerRegistration | null | undefined} registration
 * @returns {string | null}
 */
function getWaitingUpdateVersion(registration) {
  return registration?.waiting?.scriptURL ?? null;
}

const UpdatePrompt = () => {
  const [pendingVersion, setPendingVersion] = useState(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
      void applyPendingVersion(r, setPendingVersion, setNeedRefresh);
    },
    onNeedRefresh() {
      void refreshPendingVersion(setNeedRefresh, setPendingVersion);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      void refreshPendingVersion(setNeedRefresh, setPendingVersion);
    }
  }, [needRefresh, setNeedRefresh]);

  const dismissed =
    pendingVersion != null && getDismissedUpdateVersion() === pendingVersion;
  const showPrompt = needRefresh && pendingVersion != null && !dismissed;

  if (!showPrompt) {
    return null;
  }

  const handleDismiss = () => {
    if (pendingVersion) {
      setDismissedUpdateVersion(pendingVersion);
    }
    setNeedRefresh(false);
  };

  const handleUpdate = () => {
    clearDismissedUpdateVersion();
    updateServiceWorker(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-overlay md:p-6 pb-safe">
      <div className="bg-white dark:bg-zinc-900 rounded-t-[24px] md:rounded-b-[24px] shadow-2xl border border-gray-200 dark:border-zinc-800 animate-slide-up w-full max-w-md mx-auto">
        <div className="w-full flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>

        <div className="px-6 pb-6 pt-4 md:pt-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
            Atualização disponível
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
            Foi lançada uma nova versão com melhorias. Atualiza para continuares a usar a app sem
            interrupções.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleUpdate}
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-medium py-3.5 px-4 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:ring-offset-2 active:scale-[0.98]"
            >
              Atualizar agora
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full bg-transparent hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300 font-medium py-3.5 px-4 rounded-full transition-colors focus:outline-none active:scale-[0.98]"
            >
              Mais tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @param {ServiceWorkerRegistration | null | undefined} registration
 * @param {React.Dispatch<React.SetStateAction<string | null>>} setPendingVersion
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setNeedRefresh
 */
async function applyPendingVersion(registration, setPendingVersion, setNeedRefresh) {
  const version = getWaitingUpdateVersion(registration);
  if (!version) return;
  setPendingVersion(version);
  if (getDismissedUpdateVersion() === version) {
    setNeedRefresh(false);
  }
}

/**
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setNeedRefresh
 * @param {React.Dispatch<React.SetStateAction<string | null>>} setPendingVersion
 */
async function refreshPendingVersion(setNeedRefresh, setPendingVersion) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await applyPendingVersion(registration, setPendingVersion, setNeedRefresh);
  } catch {
    // SW indisponível em testes ou contextos restritos
  }
}

export default UpdatePrompt;
