import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAcordoContactos,
  getMesReferenciaAtual,
  getObrigacaoPagamentoPassageiro,
  getPagamentoForPassageiro,
  listPagamentosByAcordo,
  listPagamentosPendentesMotoristaAcordo,
} from '../services/PaymentService';
import { listMinhasAvaliacoesAcordo } from '../services/RatingService';
import { listAdendaHistorico } from '../services/AgreementService';
import {
  contactosBloqueadosFallback,
  deveChamarGetAcordoContactos,
} from '../utils/acordoContactosGate.js';

/**
 * @param {{
 *   acordo: object | null,
 *   syncKey: string | null,
 *   tipoPerfil?: string,
 *   userId?: string,
 * }} params
 */
export function useAcordoDetalhe({ acordo, syncKey, tipoPerfil, userId }) {
  const [pagamentosAcordo, setPagamentosAcordo] = useState(/** @type {object[]} */ ([]));
  const [pagamento, setPagamento] = useState(/** @type {object | null} */ (null));
  const [obrigacaoPagamento, setObrigacaoPagamento] = useState(/** @type {object | null} */ (null));
  const [motoristaPagamentos, setMotoristaPagamentos] = useState(/** @type {object[]} */ ([]));
  const [contactos, setContactos] = useState(/** @type {object | null} */ (null));
  const [avaliacoesAcordo, setAvaliacoesAcordo] = useState(/** @type {object[]} */ ([]));
  const [historicoPreco, setHistoricoPreco] = useState(/** @type {object[]} */ ([]));

  const [motoristaPagamentosLoading, setMotoristaPagamentosLoading] = useState(false);
  const [passageiroPagamentoLoading, setPassageiroPagamentoLoading] = useState(false);
  const [contactosLoading, setContactosLoading] = useState(false);
  const [avaliacoesLoading, setAvaliacoesLoading] = useState(false);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [pagamentosAcordoLoading, setPagamentosAcordoLoading] = useState(false);

  const loadGenerationRef = useRef(0);
  const acordoLatestRef = useRef(acordo);

  useEffect(() => {
    acordoLatestRef.current = acordo;
  }, [acordo]);

  const resetDetalhe = useCallback(() => {
    setPagamento(null);
    setObrigacaoPagamento(null);
    setMotoristaPagamentos([]);
    setPagamentosAcordo([]);
    setContactos(null);
    setAvaliacoesAcordo([]);
    setHistoricoPreco([]);
    setMotoristaPagamentosLoading(false);
    setPassageiroPagamentoLoading(false);
    setContactosLoading(false);
    setAvaliacoesLoading(false);
    setHistoricoLoading(false);
    setPagamentosAcordoLoading(false);
  }, []);

  /**
   * @param {object} acordoRow
   * @param {{ background?: boolean }} [options]
   */
  const carregarDetalhe = useCallback(
    async (acordoRow, options = {}) => {
      const { background = false } = options;
      if (!acordoRow?.id || !userId) return;

      const minhaLinhaAcordo = (acordoRow.acordos_passageiros || []).find(
        (p) => p.passenger_id === userId,
      );
      const podeContactos = deveChamarGetAcordoContactos({
        acordoEstado: acordoRow.estado,
        tipoPerfil,
        minhaLinhaEstado: minhaLinhaAcordo?.estado,
      });

      const generation = ++loadGenerationRef.current;
      const mesAtual = getMesReferenciaAtual();
      const isStale = () => generation !== loadGenerationRef.current;

      if (!background) {
        setMotoristaPagamentos([]);
        setPagamentosAcordo([]);
        setPagamento(null);
        setObrigacaoPagamento(null);
        setContactos(null);
        setAvaliacoesAcordo([]);
        setHistoricoPreco([]);
      }

      if (!background) {
        setPagamentosAcordoLoading(true);
        if (tipoPerfil === 'Motorista') setMotoristaPagamentosLoading(true);
        if (tipoPerfil === 'Passageiro') setPassageiroPagamentoLoading(true);
        if (podeContactos) setContactosLoading(true);
        setAvaliacoesLoading(true);
        setHistoricoLoading(true);
      }

      const linhaPassageiro =
        tipoPerfil === 'Passageiro'
          ? (acordoRow.acordos_passageiros || []).find((p) => p.passenger_id === userId)
          : null;

      void listPagamentosByAcordo(acordoRow.id)
        .then((rows) => {
          if (isStale()) return;
          setPagamentosAcordo(Array.isArray(rows) ? rows : []);
        })
        .catch((err) => {
          if (!isStale()) console.error('Erro ao carregar pagamentos do acordo:', err);
        })
        .finally(() => {
          if (!isStale()) setPagamentosAcordoLoading(false);
        });

      if (tipoPerfil === 'Motorista') {
        void listPagamentosPendentesMotoristaAcordo(acordoRow.id)
          .then((rows) => {
            if (isStale()) return;
            setMotoristaPagamentos(Array.isArray(rows) ? rows : []);
          })
          .catch((err) => {
            if (!isStale()) {
              console.error('Erro ao listar pagamentos motorista:', err);
              setMotoristaPagamentos([]);
            }
          })
          .finally(() => {
            if (!isStale()) setMotoristaPagamentosLoading(false);
          });
      }

      if (tipoPerfil === 'Passageiro') {
        if (linhaPassageiro?.id) {
          void getObrigacaoPagamentoPassageiro(linhaPassageiro.id)
            .then((payload) => {
              if (isStale()) return;
              setPagamento(payload?.pagamento ?? null);
              setObrigacaoPagamento(payload?.obrigacao ?? null);
            })
            .catch(async (err) => {
              if (isStale()) return;
              console.error('Erro ao carregar obrigação:', err);
              try {
                const pagamentos = await listPagamentosByAcordo(acordoRow.id);
                const row =
                  pagamentos.find(
                    (p) =>
                      p.passenger_id === userId
                      && String(p.mes_referencia || '').slice(0, 10) === mesAtual,
                  ) ?? (await getPagamentoForPassageiro(acordoRow.id, userId, mesAtual));
                if (!isStale()) {
                  setPagamento(row);
                  setObrigacaoPagamento(null);
                }
              } catch {
                if (!isStale()) {
                  setPagamento(null);
                  setObrigacaoPagamento(null);
                }
              }
            })
            .finally(() => {
              if (!isStale()) setPassageiroPagamentoLoading(false);
            });
        } else {
          setPagamento(null);
          setObrigacaoPagamento(null);
          setPassageiroPagamentoLoading(false);
        }
      }

      if (podeContactos) {
        void getAcordoContactos(acordoRow.id)
          .then((payload) => {
            if (isStale()) return;
            setContactos(payload);
          })
          .catch((err) => {
            if (!isStale()) {
              if (err?.code !== 'P0001') {
                console.error('Erro ao carregar contactos:', err);
              }
              setContactos(contactosBloqueadosFallback());
            }
          })
          .finally(() => {
            if (!isStale()) setContactosLoading(false);
          });
      } else {
        setContactos(null);
        setContactosLoading(false);
      }

      void listMinhasAvaliacoesAcordo(acordoRow.id)
        .then((avs) => {
          if (isStale()) return;
          setAvaliacoesAcordo(Array.isArray(avs) ? avs : []);
        })
        .catch((err) => {
          if (!isStale()) console.error('Erro ao carregar avaliações:', err);
        })
        .finally(() => {
          if (!isStale()) setAvaliacoesLoading(false);
        });

      void listAdendaHistorico(acordoRow.id)
        .then((historico) => {
          if (isStale()) return;
          setHistoricoPreco(Array.isArray(historico) ? historico : []);
        })
        .catch((err) => {
          if (!isStale()) console.error('Erro ao carregar histórico de preço:', err);
        })
        .finally(() => {
          if (!isStale()) setHistoricoLoading(false);
        });
    },
    [tipoPerfil, userId],
  );

  const revalidateSilencioso = useCallback(
    (acordoRow) => carregarDetalhe(acordoRow ?? acordoLatestRef.current, { background: true }),
    [carregarDetalhe],
  );

  useEffect(() => {
    const row = acordoLatestRef.current;
    if (!syncKey || !row?.id) {
      loadGenerationRef.current += 1;
      // Limpar secções ao fechar detalhe (syncKey nulo).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional ao desmontar contexto
      resetDetalhe();
      return;
    }
    void carregarDetalhe(row, { background: false });
  }, [syncKey, carregarDetalhe, resetDetalhe]);

  const pagamentoLoading =
    tipoPerfil === 'Motorista'
      ? motoristaPagamentosLoading || pagamentosAcordoLoading
      : passageiroPagamentoLoading || pagamentosAcordoLoading;

  return {
    pagamentosAcordo,
    pagamento,
    obrigacaoPagamento,
    motoristaPagamentos,
    contactos,
    avaliacoesAcordo,
    historicoPreco,
    motoristaPagamentosLoading,
    passageiroPagamentoLoading,
    pagamentosAcordoLoading,
    contactosLoading,
    avaliacoesLoading,
    historicoLoading,
    pagamentoLoading,
    carregarPagamentoContactos: revalidateSilencioso,
    revalidateSilencioso,
  };
}
