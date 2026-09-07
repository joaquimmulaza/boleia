import React from 'react';
import { Phone, Lock } from 'lucide-react';

/**
 * Contactos do acordo — só visíveis após em_custodia (payload do RPC).
 *
 * @param {{
 *   contactos: {
 *     bloqueado?: boolean,
 *     motivo?: string | null,
 *     motorista?: { nome_completo?: string, telefone?: string | null } | null,
 *     passageiros?: Array<{ passenger_id?: string, nome_completo?: string, telefone?: string | null }>,
 *   } | null,
 *   loading?: boolean,
 * }} props
 */
function AcordoContactosPanel({ contactos, loading = false }) {
  if (loading) {
    return (
      <p className="text-sm text-slate-500" data-testid="contactos-loading">
        A carregar contactos…
      </p>
    );
  }

  if (!contactos) {
    return null;
  }

  if (contactos.bloqueado) {
    return (
      <section
        className="rounded-xl border border-amber-200/80 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 space-y-2"
        data-testid="contactos-bloqueados"
      >
        <div className="flex items-start gap-2">
          <Lock size={18} className="text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Contactos bloqueados</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 text-pretty">
              {contactos.motivo || 'Disponíveis após pagamento em custódia.'}
            </p>
            <p
              className="text-xs font-medium text-amber-800 dark:text-amber-200 text-pretty"
              data-testid="contactos-proximo-passo"
            >
              Próximo passo: envia o comprovativo de transferência na secção Pagamento mensal abaixo.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const motoristaTel = contactos.motorista?.telefone;
  const passageirosComTel = (contactos.passageiros || []).filter((p) => p.telefone);

  return (
    <section
      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-3"
      data-testid="contactos-desbloqueados"
    >
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Contactos</h3>

      {motoristaTel ? (
        <div className="flex items-center gap-2 text-sm">
          <Phone size={16} className="text-primary shrink-0" aria-hidden="true" />
          <span>
            Motorista ({contactos.motorista?.nome_completo || '—'}):{' '}
            <a href={`tel:${motoristaTel}`} className="font-semibold text-primary">
              {motoristaTel}
            </a>
          </span>
        </div>
      ) : null}

      {passageirosComTel.map((p) => (
        <div key={p.passenger_id || p.nome_completo} className="flex items-center gap-2 text-sm">
          <Phone size={16} className="text-primary shrink-0" aria-hidden="true" />
          <span>
            {p.nome_completo || 'Passageiro'}:{' '}
            <a href={`tel:${p.telefone}`} className="font-semibold text-primary">
              {p.telefone}
            </a>
          </span>
        </div>
      ))}

      {!motoristaTel && passageirosComTel.length === 0 ? (
        <p className="text-xs text-slate-500">Sem contactos disponíveis neste momento.</p>
      ) : null}
    </section>
  );
}

export default AcordoContactosPanel;
