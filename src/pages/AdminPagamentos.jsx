import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import FeedbackAlert from '../components/FeedbackAlert';
import { formatKwanza } from '../utils/formatKwanza';
import { adminValidatePayment, listPagamentosPendentesValidacao } from '../services/PaymentService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const AdminPagamentos = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));
  const [feedback, setFeedback] = useState(/** @type {{ type: 'success' | 'error', text: string } | null} */ (null));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPagamentosPendentesValidacao();
      setRows(data);
    } catch (error) {
      console.error('Erro ao listar pagamentos:', error);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleValidate = async (pagamentoId, aprovar) => {
    setBusyId(pagamentoId);
    setFeedback(null);
    try {
      let motivo = null;
      if (!aprovar) {
        motivo = window.prompt('Motivo da rejeição (opcional):') || null;
      }
      await adminValidatePayment(pagamentoId, aprovar, motivo);
      setFeedback({
        type: 'success',
        text: aprovar ? 'Comprovativo aprovado — pagamento em custódia.' : 'Comprovativo rejeitado.',
      });
      await load();
    } catch (error) {
      console.error('Erro na validação:', error);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader title="Validar pagamentos" subtitle="Comprovativos à espera de revisão" />

      {feedback ? <FeedbackAlert type={feedback.type} message={feedback.text} /> : null}

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="animate-spin" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="admin-fila-vazia">
          Nenhum comprovativo pendente.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="admin-fila-pagamentos">
          {rows.map((row) => {
            const passageiro = row.perfis?.nome_completo || 'Passageiro';
            return (
              <li
                key={row.id}
                className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{passageiro}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {formatKwanza(row.valor_kz)} Kz · payout {formatKwanza(row.valor_payout_liquido_kz)} Kz
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-900">
                    Comprovativo enviado
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => handleValidate(row.id, true)}
                    className="flex-1 min-h-11 rounded-xl bg-primary text-white font-semibold disabled:opacity-60"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => handleValidate(row.id, false)}
                    className="flex-1 min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold disabled:opacity-60"
                  >
                    Rejeitar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
};

export default AdminPagamentos;
