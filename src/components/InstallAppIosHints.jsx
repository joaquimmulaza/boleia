import React, { useState } from 'react';
import { Button } from './ui/button';
import FeedbackAlert from './FeedbackAlert';
import { iosInstallInstructionCopy } from '../utils/iosInstallInstruction';
import {
  PROFILE_APP_COPY_LINK,
  PROFILE_APP_LINK_COPIED,
} from '../utils/profileCopy';

/**
 * @param {{ instruction: import('../utils/iosInstallInstruction').IosInstallInstruction }} props
 */
export default function InstallAppIosHints({ instruction }) {
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 3000);
    } catch (error) {
      console.warn('[InstallAppIosHints] Falha ao copiar link:', error);
    }
  };

  const testId =
    instruction.mode === 'safari'
      ? 'install-ios-safari-hint'
      : 'install-ios-non-safari-hints';

  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground leading-relaxed" data-testid={testId}>
        {iosInstallInstructionCopy(instruction)}
      </p>
      {instruction.showCopyLink ? (
        <Button
          type="button"
          variant="secondary"
          className="rounded-full font-semibold"
          onClick={handleCopyLink}
        >
          {PROFILE_APP_COPY_LINK}
        </Button>
      ) : null}
      {linkCopied ? (
        <FeedbackAlert
          type="success"
          text={PROFILE_APP_LINK_COPIED}
          data-testid="install-link-copied-toast"
        />
      ) : null}
    </div>
  );
}
