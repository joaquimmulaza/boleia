import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 md:p-6 pb-safe">
      <div className="bg-white dark:bg-zinc-900 rounded-t-[24px] md:rounded-b-[24px] shadow-2xl border border-gray-200 dark:border-zinc-800 animate-slide-up w-full max-w-md mx-auto">
        {/* Handle visual */}
        <div className="w-full flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
        
        <div className="px-6 pb-6 pt-4 md:pt-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
            Atualização disponível
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
            Foi lançada uma nova versão com melhorias. Atualiza para continuares a usar a app sem interrupções.
          </p>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={() => updateServiceWorker(true)}
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-medium py-3.5 px-4 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:ring-offset-2 active:scale-[0.98]"
            >
              Atualizar agora
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
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

export default UpdatePrompt;
