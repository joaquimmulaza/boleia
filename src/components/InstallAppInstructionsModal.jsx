import React from 'react';
import { Share, PlusSquare, CheckCircle2, Smartphone } from 'lucide-react';
import ModalPortal from './ModalPortal';

/**
 * @typedef {import('../utils/pwaInstall').InstallPlatform} InstallPlatform
 */

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   platform?: InstallPlatform,
 *   isInAppBrowser?: boolean,
 * }} props
 */
const InstallAppInstructionsModal = ({
  isOpen,
  onClose,
  platform = 'ios',
  isInAppBrowser = false,
}) => {
  if (!isOpen) return null;

  const isIos = platform === 'ios';

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar ao ecrã — instruções"
        className="fixed inset-0 z-modal flex items-end justify-center sm:items-center px-3 pb-[var(--sheet-bottom-inset)] sm:p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        onClick={onClose}
      >
        <div
          role="document"
          className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-white dark:bg-zinc-900 px-6 pb-8 pb-safe shadow-2xl rounded-[34px] border border-gray-200 dark:border-zinc-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" aria-hidden="true" />
          </div>

          <div className="flex justify-center mt-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Smartphone className="text-primary" size={28} aria-hidden="true" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mt-4">
            Adicionar ao ecrã
          </h2>

          {isInAppBrowser ? (
            <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3 mt-4 text-center">
              Abre esta página no Safari ou Chrome para adicionares a app ao ecrã inicial.
            </p>
          ) : null}

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-3">
            {isIos
              ? 'No iPhone, segue estes passos no Safari:'
              : 'No teu browser, procura a opção para adicionar ao ecrã inicial ou instalar a app.'}
          </p>

          <ol className="mt-6 space-y-4">
            {isIos ? (
              <>
                <li className="flex gap-3 items-start">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Share size={18} className="text-primary" aria-hidden="true" />
                      Toca em Partilhar
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Ícone na barra inferior do Safari.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
                    2
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <PlusSquare size={18} className="text-primary" aria-hidden="true" />
                      Adicionar ao ecrã inicial
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Desliza a lista de opções se necessário.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
                    3
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-primary" aria-hidden="true" />
                      Confirma Adicionar
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      O ícone da Boleia Certa fica no teu ecrã inicial.
                    </p>
                  </div>
                </li>
              </>
            ) : (
              <li className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4">
                Abre o menu do browser (⋮ ou …) e procura «Instalar app» ou «Adicionar ao ecrã inicial».
              </li>
            )}
          </ol>

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-6 bg-primary hover:bg-primary/90 text-white font-semibold py-3.5 px-4 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};

export default InstallAppInstructionsModal;
