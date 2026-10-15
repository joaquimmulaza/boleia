import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runAcordoDetalheLoad } from '../utils/runAcordoDetalheLoad.js';

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
  const openAcordoIdRef = useRef(/** @type {string | null} */ (null));
  const acordoLatestRef = useRef(acordo);

  useEffect(() => {
    acordoLatestRef.current = acordo;
    openAcordoIdRef.current = acordo?.id ?? null;
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

  const setters = useMemo(
    () => ({
      setPagamentosAcordo,
      setPagamento,
      setObrigacaoPagamento,
      setMotoristaPagamentos,
      setContactos,
      setAvaliacoesAcordo,
      setHistoricoPreco,
      setMotoristaPagamentosLoading,
      setPassageiroPagamentoLoading,
      setContactosLoading,
      setAvaliacoesLoading,
      setHistoricoLoading,
      setPagamentosAcordoLoading,
      clearForegroundSections: () => {
        setMotoristaPagamentos([]);
        setPagamentosAcordo([]);
        setPagamento(null);
        setObrigacaoPagamento(null);
        setContactos(null);
        setAvaliacoesAcordo([]);
        setHistoricoPreco([]);
      },
      startForegroundLoading: (podeContactos) => {
        setPagamentosAcordoLoading(true);
        if (tipoPerfil === 'Motorista') setMotoristaPagamentosLoading(true);
        if (tipoPerfil === 'Passageiro') setPassageiroPagamentoLoading(true);
        if (podeContactos) setContactosLoading(true);
        setAvaliacoesLoading(true);
        setHistoricoLoading(true);
      },
    }),
    [tipoPerfil],
  );

  const carregarDetalhe = useCallback(
    (acordoRow, options = {}) => {
      runAcordoDetalheLoad(acordoRow, {
        ...options,
        tipoPerfil,
        userId,
        openAcordoIdRef,
        loadGenerationRef,
        setters,
      });
    },
    [tipoPerfil, userId, setters],
  );

  const revalidateSilencioso = useCallback(
    (acordoRow) => carregarDetalhe(acordoRow ?? acordoLatestRef.current, { background: true }),
    [carregarDetalhe],
  );

  useEffect(() => {
    const row = acordoLatestRef.current;
    if (!syncKey || !row?.id) {
      loadGenerationRef.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional ao fechar detalhe
      resetDetalhe();
      return;
    }
    carregarDetalhe(row, { background: false });
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
