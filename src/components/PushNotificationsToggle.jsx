import React, { useId, useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePwaInstall } from '../hooks/usePwaInstall';
import {
  PUSH_PROFILE_BLOCKED_HELP,
  PUSH_PROFILE_ERROR,
  PUSH_PROFILE_ERROR_DISABLE,
  PUSH_PROFILE_HELP,
  PUSH_PROFILE_IPHONE_HELPER,
  PUSH_PROFILE_LABEL,
  PUSH_PROFILE_STATE_ACTIVATING,
  PUSH_PROFILE_STATE_BLOCKED,
  PUSH_PROFILE_STATE_OFF,
  PUSH_PROFILE_STATE_ON,
  PUSH_PROFILE_UNSUPPORTED,
} from '../utils/pushProfileCopy';
import {
  resolvePushProfileCapability,
  resolvePushProfileUiState,
} from '../utils/pushProfileState';
import BoleiaSwitch from './ui/BoleiaSwitch';

const STATUS_PANEL_NEUTRAL =
  'flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300';

/**
 * Interruptor de notificações push em /perfil (6 estados Figma).
 */
export default function PushNotificationsToggle() {
  const labelId = useId();
  const helpId = useId();
  const statusId = useId();
  const switchId = useId();
  const { user } = useAuth();
  const { platform, isInstalled } = usePwaInstall();
  const {
    isSupported,
    permission,
    isSubscribed,
    initialLoading: hookInitialLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  /** @type {['enable' | 'disable' | null, React.Dispatch<React.SetStateAction<'enable' | 'disable' | null>>]} */
  const [pendingAction, setPendingAction] = useState(null);
  /** @type {['enable' | 'disable' | null, React.Dispatch<React.SetStateAction<'enable' | 'disable' | null>>]} */
  const [actionError, setActionError] = useState(null);

  const isPending = pendingAction !== null;

  const uiState = useMemo(
    () =>
      resolvePushProfileUiState({
        isSupported,
        permission,
        isSubscribed,
        initialLoading: hookInitialLoading,
        activating: isPending,
        activationError: actionError !== null,
        isInstalled,
        platform,
      }),
    [
      isSupported,
      permission,
      isSubscribed,
      hookInitialLoading,
      isPending,
      actionError,
      isInstalled,
      platform,
    ],
  );

  const { showIphoneHelper } = resolvePushProfileCapability({
    isSupported,
    isInstalled,
    platform,
  });

  const switchLoading = uiState === 'activating';
  const permissionGranted = String(permission).toLowerCase() === 'granted';
  const switchChecked = switchLoading
    ? pendingAction === 'disable'
    : isSubscribed && permissionGranted;
  const switchDisabled =
    uiState === 'bloqueado' || uiState === 'sem_suporte' || switchLoading || hookInitialLoading;

  const handleToggle = async (next) => {
    if (!user?.id || switchDisabled) return;

    setActionError(null);

    if (next) {
      setPendingAction('enable');
      const result = await subscribe(user.id);
      setPendingAction(null);
      if (result?.error) {
        setActionError('enable');
      }
      return;
    }

    setPendingAction('disable');
    const result = await unsubscribe(user.id);
    setPendingAction(null);
    if (result?.error) {
      setActionError('disable');
    }
  };

  let statusLine = null;
  let statusPanel = null;

  if (uiState === 'activado') {
    statusLine = PUSH_PROFILE_STATE_ON;
  } else if (uiState === 'desactivado') {
    statusLine = PUSH_PROFILE_STATE_OFF;
  } else if (uiState === 'activating' && pendingAction === 'enable') {
    statusLine = PUSH_PROFILE_STATE_ACTIVATING;
  } else if (uiState === 'bloqueado') {
    statusPanel = (
      <div className={STATUS_PANEL_NEUTRAL} data-testid="push-profile-status-bloqueado">
        <Info className="size-6 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-slate-800 dark:text-slate-100">{PUSH_PROFILE_STATE_BLOCKED}</p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{PUSH_PROFILE_BLOCKED_HELP}</p>
        </div>
      </div>
    );
  } else if (uiState === 'erro') {
    statusPanel = (
      <div
        className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50"
        role="alert"
        data-testid="push-profile-status-erro"
      >
        <AlertTriangle className="size-6 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <p className="leading-relaxed">
          {actionError === 'disable' ? PUSH_PROFILE_ERROR_DISABLE : PUSH_PROFILE_ERROR}
        </p>
      </div>
    );
  } else if (uiState === 'sem_suporte') {
    statusPanel = (
      <div className={STATUS_PANEL_NEUTRAL} data-testid="push-profile-status-sem-suporte">
        <Info className="size-6 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-slate-800 dark:text-slate-100">{PUSH_PROFILE_UNSUPPORTED}</p>
          {showIphoneHelper ? (
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{PUSH_PROFILE_IPHONE_HELPER}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[390px] w-full mx-auto" data-testid="push-notifications-toggle">
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p id={labelId} className="font-semibold text-[15px] text-slate-900 dark:text-slate-100">
              {PUSH_PROFILE_LABEL}
            </p>
            <p id={helpId} className="mt-0.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              {PUSH_PROFILE_HELP}
            </p>
          </div>
          <BoleiaSwitch
            id={switchId}
            checked={switchChecked}
            disabled={switchDisabled}
            loading={switchLoading}
            onCheckedChange={handleToggle}
            aria-labelledby={labelId}
            aria-describedby={[helpId, statusId].filter(Boolean).join(' ') || undefined}
          />
        </div>

        {statusLine ? (
          <p
            id={statusId}
            className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400"
            aria-live="polite"
            data-testid="push-profile-status-line"
          >
            {statusLine}
          </p>
        ) : null}

        {statusPanel ? (
          <div id={statusLine ? undefined : statusId} aria-live="polite">
            {statusPanel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
