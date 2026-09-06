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
  adminLiquidatePayment,
  adminLiquidatePeriod,
  getComprovativoSignedUrl,
  listPagamentosPendentesValidacao,
  listPagamentosEmCustodia,
  listRepassesMotorista,
} from '../services/PaymentService';
import { computeRepasseLiquidoKz } from '../utils/paymentStatus';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const AdminPagamentos = () => {
  const [rows, setRows] = useState([]);
  const [custodiaRows, setCustodiaRows] = useState([]);
  const [repasses, setRepasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));
  const [feedback, setFeedback] = useState(/** @type {{ type: 'success' | 'error', text: string } | null} */ (null));
  const [previewUrls, setPreviewUrls] = useState(/** @type {Record<string, string>} */ ({}));
  const [previewLoading, setPreviewLoading] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [rejeicaoTarget, setRejeicaoTarget] = useState(/** @type {string | null} */ (null));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendentes, custodia, repasseRows] = await Promise.all([
        listPagamentosPendentesValidacao(),
        listPagamentosEmCustodia(),
        listRepassesMotorista(),
      ]);
      setRows(pendentes);
      setCustodiaRows(custodia);
      setRepasses(repasseRows);
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

  const handleLiquidatePeriod = async () => {
    const now = new Date();
    const mesReferencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    setPeriodBusy(true);
    setFeedback(null);
    try {
      const result = await adminLiquidatePeriod(mesReferencia);
      const count = result?.pagamentos_liquidados ?? 0;
      setFeedback({
        type: 'success',
        text: count > 0
          ? `Período liquidado — ${count} pagamento(s), ${result?.repasses?.length ?? 0} repasse(s).`
          : 'Nenhum pagamento em custódia para liquidar neste período.',
      });
      await load();
    } catch (error) {
      console.error('Erro na liquidação do período:', error);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(error) });
    } finally {
      setPeriodBusy(false);
    }
  };

  const handleLiquidate = async (pagamentoId) => {
    setBusyId(pagamentoId);
    setFeedback(null);
    try {
      await adminLiquidatePayment(pagamentoId);
      setFeedback({ type: 'success', text: 'Pagamento liquidado — repasse registado.' });
      await load();
    } catch (error) {
      console.error('Erro na liquidação:', error);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Validar pagamentos"
        subtitle="Comprovativos pendentes e liquidação em custódia"
      />

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

      <h2 className="mt-10 mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Liquidação do período
      </h2>
      <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-slate-900 p-4 space-y-3">
        <p className="text-xs text-slate-500 text-pretty">
          Liquida todos os pagamentos em custódia do mês corrente e regista repasse por motorista
          (take-rate ~10%, menos faltas on-platform). Requer IBAN no perfil de cada motorista.
        </p>
        <button
          type="button"
          disabled={periodBusy || Boolean(busyId)}
          onClick={() => void handleLiquidatePeriod()}
          className="w-full min-h-11 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-60"
          data-testid="liquidar-periodo"
        >
          Liquidar período (mês corrente)
        </button>
      </div>

      <h2 className="mt-10 mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Em custódia — liquidar
      </h2>

      {loading ? null : custodiaRows.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="admin-custodia-vazia">
          Nenhum pagamento em custódia.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="admin-fila-custodia">
          {custodiaRows.map((row) => {
            const passageiro = row.perfis?.nome_completo || 'Passageiro';
            const repasseEstimado = computeRepasseLiquidoKz(
              row.valor_payout_liquido_kz,
              row.desconto_faltas_kz || 0,
            );

            return (
              <li
                key={row.id}
                className="rounded-xl border border-sky-100 dark:border-sky-900/40 bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{passageiro}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      Payout {formatKwanza(row.valor_payout_liquido_kz)} Kz
                      {row.desconto_faltas_kz
                        ? ` · faltas −${formatKwanza(row.desconto_faltas_kz)} Kz`
                        : ''}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 tabular-nums">
                      Repasse estimado: {formatKwanza(repasseEstimado)} Kz
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-sky-100 text-sky-900">
                    Em custódia
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => handleLiquidate(row.id)}
                  className="w-full min-h-11 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60"
                  data-testid={`liquidar-${row.id}`}
                >
                  Liquidar repasse
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-10 mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Repasses registados
      </h2>

      {loading ? null : repasses.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="admin-repasses-vazio">
          Nenhum repasse registado.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="admin-repasses-lista">
          {repasses.map((rep) => {
            const motorista = rep.perfis?.nome_completo || 'Motorista';
            return (
              <li
                key={rep.id}
                className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-slate-900 p-4 space-y-1"
              >
                <p className="font-semibold text-slate-900 dark:text-white">{motorista}</p>
                <p className="text-xs text-slate-500 tabular-nums">
                  GMV {formatKwanza(rep.gmv_kz)} Kz · plataforma −{formatKwanza(rep.valor_plataforma_kz)} Kz
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 tabular-nums">
                  Repasse líquido: {formatKwanza(rep.valor_repasse_liquido_kz)} Kz
                  {rep.desconto_faltas_kz ? ` (faltas −${formatKwanza(rep.desconto_faltas_kz)} Kz)` : ''}
                </p>
                <p className="text-xs font-mono text-slate-500 truncate" title={rep.iban_destino}>
                  IBAN: {rep.iban_destino}
                </p>
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
