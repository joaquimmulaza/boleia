import React, { useId } from 'react';
import PageShell from '../components/PageShell';
import BoleiaSwitch from '../components/ui/BoleiaSwitch';
import {
  PUSH_PROFILE_HELP,
  PUSH_PROFILE_LABEL,
  PUSH_PROFILE_STATE_OFF,
  PUSH_PROFILE_STATE_ON,
} from '../utils/pushProfileCopy';

/**
 * Cartão push (mesma shell que /perfil) para capturas DEV do switch.
 * @param {{ checked: boolean; statusLine: string }} props
 */
function PushTogglePreviewCard({ checked, statusLine }) {
  const labelId = useId();
  const helpId = useId();
  const statusId = useId();

  return (
    <div
      className="space-y-4 max-w-[390px] w-full mx-auto"
      data-testid={checked ? 'push-preview-on' : 'push-preview-off'}
    >
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
            checked={checked}
            disabled
            aria-labelledby={labelId}
            aria-describedby={[helpId, statusId].join(' ')}
          />
        </div>
        <p
          id={statusId}
          className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400"
          data-testid="push-profile-status-line"
        >
          {statusLine}
        </p>
      </div>
    </div>
  );
}

/**
 * Pré-visualização DEV da secção push em /perfil — só registada com import.meta.env.DEV.
 * @typedef {Readonly<{}>} DevPerfilPushPreviewProps
 */
export default function DevPerfilPushPreview() {
  return (
    <PageShell className="pb-24 space-y-10">
      <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Push · capturas DEV</h1>
      <PushTogglePreviewCard checked={false} statusLine={PUSH_PROFILE_STATE_OFF} />
      <PushTogglePreviewCard checked statusLine={PUSH_PROFILE_STATE_ON} />
    </PageShell>
  );
}
