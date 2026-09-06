import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import FeedbackAlert from '../components/FeedbackAlert';
import RejeicaoComprovativoModal from '../components/RejeicaoComprovativoModal';
import { formatKwanza } from '../utils/formatKwanza';
import { basenameComprovativoPath } from '../utils/comprovativoPath';
import {
  adminValidatePayment,
  getComprovativoSignedUrl,
  listPagamentosPendentesValidacao,
} from '../services/PaymentService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const AdminPagamentos = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));
  const [feedback, setFeedback] = useState(/** @type {{ type: 'success' | 'error', text: string } | null} */ (null));
  const [previewUrls, setPreviewUrls] = useState(/** @type {Record<string, string>} */ ({}));
  const [previewLoading, setPreviewLoading] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [rejeicaoTarget, setRejeicaoTarget] = useState(/** @type {string | null} */ (null));

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

  const handlePreview = async (pagamentoId, storagePath) => {
    if (previewUrls[pagamentoId] || previewLoading[pagamentoId]) return;
    setPreviewLoading((prev) => ({ ...prev, [pagamentoId]: true }));
    try {
      const url = await getComprovativoSignedUrl(storagePath);
      if (url) {
        setPreviewUrls((prev) => ({ ...prev, [pagamentoId]: url }));
      }
    } catch (error) {
      console.error('Erro ao obter preview:', error);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(error) });
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [pagamentoId]: false }));
    }
  };

  const handleValidate = async (pagamentoId, aprovar, motivo = null) => {
    setBusyId(pagamentoId);
    setFeedback(null);
    try {
      await adminValidatePayment(pagamentoId, aprovar, motivo);
      setFeedback({
        type: 'success',
        text: aprovar ? 'Comprovativo aprovado — pagamento em custódia.' : 'Comprovativo rejeitado.',
      });
      setRejeicaoTarget(null);
      await load();
    } catch (error) {
      console.error('Erro na validação:', error);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmRejeicao = (motivo) => {
    if (!rejeicaoTarget) return;
    void handleValidate(rejeicaoTarget, false, motivo);
  };

  return (
    <PageShell>
      <PageHeader title="Validar pagamentos" subtitle="Comprovativos à espera de revisão" />

      {feedback ? <FeedbackAlert type={feedback.type} text={feedback.text} /> : null}

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
            const comprovativoNome = basenameComprovativoPath(row.comprovativo_path);
            const previewUrl = previewUrls[row.id];

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

                {comprovativoNome ? (
                  <div className="space-y-2" data-testid={`comprovativo-admin-${row.id}`}>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <FileText size={14} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{comprovativoNome}</span>
                    </div>
                    {previewUrl ? (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                        Abrir comprovativo
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled={previewLoading[row.id] || busyId === row.id}
                        onClick={() => handlePreview(row.id, row.comprovativo_path)}
                        className="text-xs font-semibold text-primary disabled:opacity-60"
                      >
                        {previewLoading[row.id] ? 'A carregar…' : 'Ver comprovativo'}
                      </button>
                    )}
                    {previewUrl && /\.(jpe?g|png|webp)(\?|$)/i.test(previewUrl) ? (
                      <img
                        src={previewUrl}
                        alt={`Comprovativo de ${passageiro}`}
                        className="max-h-48 rounded-lg border border-slate-100 dark:border-slate-800 object-contain"
                        data-testid={`comprovativo-img-${row.id}`}
                      />
                    ) : null}
                  </div>
                ) : null}

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
                    onClick={() => setRejeicaoTarget(row.id)}
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

      <RejeicaoComprovativoModal
        key={rejeicaoTarget || 'closed'}
        isOpen={Boolean(rejeicaoTarget)}
        busy={Boolean(rejeicaoTarget && busyId === rejeicaoTarget)}
        onConfirm={handleConfirmRejeicao}
        onCancel={() => {
          if (!busyId) setRejeicaoTarget(null);
        }}
      />
    </PageShell>
  );
};

export default AdminPagamentos;
