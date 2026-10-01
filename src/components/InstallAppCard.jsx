import React, { useState } from 'react';
import { Smartphone, Bell, Wifi, CheckCircle2 } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import InstallAppInstructionsModal from './InstallAppInstructionsModal';

const BENEFITS = [
  { icon: Bell, text: 'Alertas de propostas e acordos' },
  { icon: Wifi, text: 'Acesso offline aos teus dados' },
  { icon: Smartphone, text: 'Ícone no ecrã inicial' },
];

/**
 * Secção Perfil — instalar PWA / instruções manuais.
 */
const InstallAppCard = () => {
  const {
    canInstallNative,
    isInstalled,
    platform,
    isInApp,
    needsInstructions,
    promptInstall,
  } = usePwaInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isInstalled) {
    return (
      <div className="space-y-4" data-testid="install-app-installed">
        <h3 className="text-sm font-bold text-slate-400 uppercase px-1">App no telemóvel</h3>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 px-5 py-5 flex gap-3 items-start">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={22} aria-hidden="true" />
          <div>
            <p className="font-bold text-emerald-800 dark:text-emerald-200">App no ecrã</p>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
              Estás a usar a Boleia Certa em modo app. Abre a partir do ícone no teu telemóvel.
            </p>
          </div>
        </div>
      </div>
    );
  }

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

  const primaryLabel = canInstallNative ? 'Adicionar ao ecrã' : 'Ver como adicionar';

  return (
    <>
      <div className="space-y-4" data-testid="install-app-card">
        <h3 className="text-sm font-bold text-slate-400 uppercase px-1">App no telemóvel</h3>
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 px-5 py-5">
          <div className="flex gap-3 items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Smartphone className="text-primary" size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Abrir como app no telemóvel</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Acede mais rápido aos acordos, propostas e alertas — mesmo com internet instável.
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Icon size={16} className="text-primary shrink-0" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>

          {isInApp ? (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-4">
              Abre no Safari ou Chrome para adicionares ao ecrã.
            </p>
          ) : null}

          <button
            type="button"
            onClick={handlePrimaryClick}
            disabled={busy}
            className="w-full mt-5 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {busy ? 'A processar…' : primaryLabel}
          </button>

          {needsInstructions && !canInstallNative ? (
            <p className="text-xs text-slate-400 text-center mt-3">
              {platform === 'ios'
                ? 'No iPhone, usa Partilhar → Adicionar ao ecrã inicial.'
                : 'Instruções para o teu browser.'}
            </p>
          ) : null}
        </div>
      </div>

      <InstallAppInstructionsModal
        isOpen={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        platform={platform}
        isInAppBrowser={isInApp}
      />
    </>
  );
};

export default InstallAppCard;
