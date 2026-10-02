import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import ModalPortal from './ModalPortal';
import SheetDragHandle from './SheetDragHandle';
import { useSheetDrag } from '../hooks/useSheetDrag';
import { useAuth } from '../contexts/AuthContext';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { getInstallDismissed, setInstallDismissed } from '../utils/pwaInstall';
import {
  ONBOARDING_PERMISSIONS_CLOSED_EVENT,
  shouldSkipOnboardingPermissions,
} from '../utils/permissionsPrompt';
import InstallAppInstructionsModal from './InstallAppInstructionsModal';

const SHOW_DELAY_MS = 2000;

/**
 * Bottom sheet contextual — convite único para adicionar PWA ao ecrã.
 */
const InstallAppPrompt = () => {
  const { profile } = useAuth();
  const {
    canInstallNative,
    isInstalled,
    platform,
    isInApp,
    promptInstall,
  } = usePwaInstall();

  const [visible, setVisible] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const shouldOfferInstall = useCallback(() => {
    if (isInstalled || getInstallDismissed()) return false;
    return true;
  }, [isInstalled]);

  const scheduleShow = useCallback(() => {
    if (!shouldOfferInstall()) return;

    const timer = window.setTimeout(() => {
      if (!shouldOfferInstall()) return;
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [shouldOfferInstall]);

  useEffect(() => {
    if (!shouldOfferInstall()) return undefined;

    let cancelled = false;
    /** @type {(() => void) | undefined} */
    let clearTimer;

    const trySchedule = async () => {
      const skipOnboarding = await shouldSkipOnboardingPermissions(profile);
      if (cancelled || !shouldOfferInstall()) return;
      if (skipOnboarding) {
        clearTimer = scheduleShow();
      }
    };

    void trySchedule();

    const onOnboardingClosed = () => {
      clearTimer?.();
      clearTimer = scheduleShow();
    };
    window.addEventListener(ONBOARDING_PERMISSIONS_CLOSED_EVENT, onOnboardingClosed);

    return () => {
      cancelled = true;
      clearTimer?.();
      window.removeEventListener(ONBOARDING_PERMISSIONS_CLOSED_EVENT, onOnboardingClosed);
    };
  }, [profile, scheduleShow, shouldOfferInstall]);

  const handleDismiss = () => {
    setInstallDismissed();
    setVisible(false);
  };

  const { panelRef } = useSheetDrag({ enabled: visible, onDismiss: handleDismiss });

  const handlePrimary = async () => {
    if (canInstallNative) {
      setBusy(true);
      try {
        const outcome = await promptInstall();
        if (outcome === 'accepted') {
          handleDismiss();
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    setInstructionsOpen(true);
  };

  const primaryLabel = canInstallNative ? 'Adicionar ao ecrã' : 'Ver como adicionar';

  if (!visible) {
    return (
      <InstallAppInstructionsModal
        isOpen={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        platform={platform}
        isInAppBrowser={isInApp}
      />
    );
  }

  return (
    <>
      <ModalPortal>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tens a app no ecrã?"
          className="fixed inset-x-0 bottom-0 z-overlay px-3 pb-[var(--sheet-bottom-inset)] md:p-6"
        >
          <div
            ref={panelRef}
            data-testid="install-prompt-panel"
            className="bg-white dark:bg-zinc-900 rounded-[34px] shadow-2xl border border-gray-200 dark:border-zinc-800 w-full max-w-md mx-auto overflow-hidden"
          >
            <SheetDragHandle />

            <div className="px-6 pb-sheet pt-2 md:pt-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Smartphone className="text-primary" size={28} aria-hidden="true" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Tens a app no ecrã?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Adiciona a Boleia Certa ao telemóvel para receberes alertas mais rápido e acederes
                offline aos teus acordos.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handlePrimary}
                  disabled={busy}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3.5 px-4 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-[0.98] disabled:opacity-70"
                >
                  {busy ? 'A processar…' : primaryLabel}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full bg-transparent hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300 font-medium py-3.5 px-4 rounded-full transition-colors focus:outline-none active:scale-[0.98]"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

      <InstallAppInstructionsModal
        isOpen={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        platform={platform}
        isInAppBrowser={isInApp}
      />
    </>
  );
};

export default InstallAppPrompt;
