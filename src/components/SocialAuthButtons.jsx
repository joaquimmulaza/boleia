import React from 'react';
import { OAUTH_PROVIDERS, getProviderLabel } from '../utils/oauth';

/**
 * Marca decorativa. O nome acessível está no botão.
 * @param {{ id: string }} props
 */
function ProviderMark({ id }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true };
  if (id === 'google') {
    return (
      <svg {...common}>
        <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7C21.6 18.8 23 15.9 23 12.3z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.2-6.9-5.1H1.3v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.1 14.3A7.2 7.2 0 0 1 4.7 12c0-.8.1-1.6.4-2.3V6.6H1.3A12 12 0 0 0 0 12c0 1.9.5 3.8 1.3 5.4l3.8-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.3 0 3.2 2.7 1.3 6.6l3.8 3.1C6.1 7 8.8 4.8 12 4.8z" />
      </svg>
    );
  }
  if (id === 'apple') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-.9-2.5-3.9zM14.5 6.5c.6-.8 1.1-1.9.9-3-1 .1-2.1.6-2.8 1.4-.6.7-1.2 1.8-.9 2.9 1.1.1 2.1-.5 2.8-1.3z" />
      </svg>
    );
  }
  if (id === 'facebook') {
    return (
      <svg {...common} fill="#1877F2">
        <path d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.1 4.4 23.1 10.1 24v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-1.9.9-1.9 1.8v2.2h3.3l-.5 3.5h-2.8V24C19.6 23.1 24 18.1 24 12.1z" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="#0A66C2">
      <path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.5H3.4V9h3.7v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.5C0 23.2.8 24 1.8 24h20.4c1 0 1.8-.8 1.8-1.8V1.7C24 .8 23.2 0 22.2 0z" />
    </svg>
  );
}

/**
 * @param {{ pendingProvider?: string | null, disabled?: boolean, onProvider: (id: string) => void }} props
 */
const SocialAuthButtons = ({ pendingProvider = null, disabled = false, onProvider }) => {
  const locked = disabled || Boolean(pendingProvider);

  return (
    <div className="flex flex-col gap-3">
      {OAUTH_PROVIDERS.map((provider) => {
        const pending = pendingProvider === provider.id;
        const label = pending
          ? `A ligar ao ${provider.label}...`
          : `Continuar com ${provider.label}`;
        return (
          <button
            key={provider.id}
            type="button"
            disabled={locked}
            aria-label={label}
            onClick={() => onProvider(provider.id)}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <ProviderMark id={provider.id} />
            <span>{pending ? label : `Continuar com ${getProviderLabel(provider.id)}`}</span>
          </button>
        );
      })}
    </div>
  );
};

export default SocialAuthButtons;
