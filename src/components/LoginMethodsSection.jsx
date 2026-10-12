import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getOAuthRedirectUrl } from '../utils/appOrigin';
import {
  OAUTH_PROVIDERS,
  canUnlinkIdentity,
  isOAuthProvider,
  isProviderLinked,
  mapOAuthError,
} from '../utils/oauth';
import { Card, CardContent } from './ui/card';
import { PROFILE_LOGIN_METHODS_TITLE } from '../utils/profileCopy';

/**
 * Métodos de início de sessão ligados à conta Supabase (`auth.identities`).
 * @param {{ layout?: 'legacy' | 'profileV2' }} props
 */
const LoginMethodsSection = ({ layout = 'legacy' }) => {
  const [identities, setIdentities] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      console.error('[oauth] identidades', error);
      setMessage({ type: 'error', text: mapOAuthError({ error: error.message }) });
      return;
    }
    setIdentities(data?.identities || []);
  };

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUserIdentities().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error('[oauth] identidades', error);
        setMessage({ type: 'error', text: mapOAuthError({ error: error.message }) });
        return;
      }
      setIdentities(data?.identities || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLink = async (providerId) => {
    if (busy || !isOAuthProvider(providerId)) return;
    setBusy(providerId);
    setMessage(null);
    const { error } = await supabase.auth.linkIdentity({
      provider: providerId,
      options: { redirectTo: getOAuthRedirectUrl() },
    });
    setBusy('');
    if (error) {
      console.error('[oauth] linkIdentity', providerId, error);
      setMessage({ type: 'error', text: mapOAuthError({ error: error.message, providerLabel: OAUTH_PROVIDERS.find((item) => item.id === providerId)?.label }) });
    }
  };

  const handleUnlink = async (providerId) => {
    if (busy) return;
    const identity = identities.find((item) => item.provider === providerId);
    if (!canUnlinkIdentity(identities, identity)) return;
    setBusy(providerId);
    setMessage(null);
    const { error } = await supabase.auth.unlinkIdentity(identity);
    setBusy('');
    if (error) {
      console.error('[oauth] unlinkIdentity', providerId, error);
      setMessage({ type: 'error', text: mapOAuthError({ error: error.message }) });
      return;
    }
    setMessage({ type: 'success', text: 'Método desassociado.' });
    await load();
  };

  const hasEmail = isProviderLinked(identities, 'email');
  const isV2 = layout === 'profileV2';
  const rowClass = isV2
    ? 'p-4 border-b border-border last:border-b-0 flex items-center justify-between gap-3'
    : 'p-4 border-b border-slate-50 dark:border-slate-700/50 last:border-b-0 flex items-center justify-between gap-3';
  const labelClass = isV2
    ? 'text-sm font-medium text-foreground'
    : 'text-sm font-medium text-slate-800 dark:text-slate-100';

  const listBody = (
    <>
      {hasEmail && (
        <div className={rowClass}>
          <span className={labelClass}>Email e palavra-passe</span>
          <span className="text-xs font-semibold text-emerald-600">Ligado</span>
        </div>
      )}
      {OAUTH_PROVIDERS.map((provider) => {
          const linked = isProviderLinked(identities, provider.id);
          const identity = identities.find((item) => item.provider === provider.id);
          const allowUnlink = canUnlinkIdentity(identities, identity);
          return (
            <div key={provider.id} className={rowClass}>
              <span className={labelClass}>{provider.label}</span>
              {linked ? (
                allowUnlink ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => handleUnlink(provider.id)}
                    className="text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-60"
                  >
                    {busy === provider.id ? 'A actualizar...' : 'Desassociar'}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600">Ligado</span>
                )
              ) : (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => handleLink(provider.id)}
                  className="text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-60"
                >
                  {busy === provider.id ? 'A ligar...' : 'Associar'}
                </button>
              )}
            </div>
          );
        })}
    </>
  );

  if (isV2) {
    return (
      <section className="space-y-2" aria-label={PROFILE_LOGIN_METHODS_TITLE}>
        <h3 className="text-xs text-muted-foreground px-1">{PROFILE_LOGIN_METHODS_TITLE}</h3>
        <Card>
          <CardContent className="p-0">{listBody}</CardContent>
        </Card>
        {message ? (
          <p
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`text-sm font-medium px-1 ${message.type === 'error' ? 'text-destructive' : 'text-emerald-600'}`}
          >
            {message.text}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="Métodos de início de sessão">
      <h3 className="text-sm font-bold text-slate-400 uppercase px-1">Métodos de início de sessão</h3>
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
        {listBody}
      </div>
      {message && (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`text-sm font-medium px-1 ${message.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
};

export default LoginMethodsSection;
