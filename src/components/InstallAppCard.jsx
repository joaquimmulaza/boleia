import React, { useState } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import InstallAppInstructionsModal from './InstallAppInstructionsModal';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  PROFILE_APP_INSTALL_CTA,
  PROFILE_APP_IPHONE_HINT,
  PROFILE_APP_OPEN_IN_SAFARI,
  PROFILE_APP_SECTION_DESC,
  PROFILE_APP_SECTION_TITLE,
} from '../utils/profileCopy';

/**
 * Secção «App no telemóvel» em /perfil.
 */
const InstallAppCard = () => {
  const {
    canInstallNative,
    isInstalled,
    platform,
    isInApp,
    isIosSafari,
    promptInstall,
  } = usePwaInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isInstalled) {
    return null;
  }

  const isIos = platform === 'ios';
  const showIosSafariHint = isIos && isIosSafari && !canInstallNative;
  const showIosNonSafariHints = isIos && !isIosSafari && !canInstallNative;
  const showInstallButton = !showIosSafariHint && !showIosNonSafariHints;

  const handlePrimaryClick = async () => {
    if (canInstallNative) {
      setBusy(true);
      try {
        await promptInstall();
      } finally {
        setBusy(false);
      }
      return;
    }
    setInstructionsOpen(true);
  };

  const modalPlatform = platform === 'ios' ? 'ios' : 'android';

  return (
    <>
      <section className="space-y-2" aria-labelledby="profile-app-heading">
        <h2 id="profile-app-heading" className="sr-only">
          {PROFILE_APP_SECTION_TITLE}
        </h2>
        <Card data-testid="install-app-card">
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-semibold text-foreground">{PROFILE_APP_SECTION_TITLE}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{PROFILE_APP_SECTION_DESC}</p>
            </div>
            {showIosSafariHint ? (
              <p className="text-sm text-foreground leading-relaxed" data-testid="install-ios-safari-hint">
                {PROFILE_APP_IPHONE_HINT}
              </p>
            ) : null}
            {showIosNonSafariHints ? (
              <div className="space-y-2" data-testid="install-ios-non-safari-hints">
                <p className="text-sm text-foreground leading-relaxed">{PROFILE_APP_OPEN_IN_SAFARI}</p>
                <p className="text-sm text-foreground leading-relaxed">{PROFILE_APP_IPHONE_HINT}</p>
              </div>
            ) : null}
            {showInstallButton ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full font-semibold"
                onClick={handlePrimaryClick}
                disabled={busy}
              >
                {busy ? 'A processar…' : PROFILE_APP_INSTALL_CTA}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <InstallAppInstructionsModal
        isOpen={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        platform={modalPlatform}
        isInAppBrowser={isInApp}
      />
    </>
  );
};

export default InstallAppCard;
