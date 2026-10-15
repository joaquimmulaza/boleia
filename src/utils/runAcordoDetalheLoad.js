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
} from './acordoContactosGate.js';

/**
 * @typedef {{
 *   setPagamentosAcordo: (v: object[]) => void,
 *   setPagamento: (v: object | null) => void,
 *   setObrigacaoPagamento: (v: object | null) => void,
 *   setMotoristaPagamentos: (v: object[]) => void,
 *   setContactos: (v: object | null) => void,
 *   setAvaliacoesAcordo: (v: object[]) => void,
 *   setHistoricoPreco: (v: object[]) => void,
 *   setMotoristaPagamentosLoading: (v: boolean) => void,
 *   setPassageiroPagamentoLoading: (v: boolean) => void,
 *   setContactosLoading: (v: boolean) => void,
 *   setAvaliacoesLoading: (v: boolean) => void,
 *   setHistoricoLoading: (v: boolean) => void,
 *   setPagamentosAcordoLoading: (v: boolean) => void,
 *   clearForegroundSections: () => void,
 *   startForegroundLoading: (podeContactos: boolean) => void,
 * }} AcordoDetalheLoadSetters
 */

/**
 * @param {object} acordoRow
 * @param {{
 *   background?: boolean,
 *   tipoPerfil?: string,
 *   userId?: string,
 *   openAcordoIdRef: { current: string | null },
 *   loadGenerationRef: { current: number },
 *   setters: AcordoDetalheLoadSetters,
 * }} ctx
 */
export function runAcordoDetalheLoad(acordoRow, ctx) {
  const {
    background = false,
    tipoPerfil,
    userId,
    openAcordoIdRef,
    loadGenerationRef,
    setters,
  } = ctx;

  if (!acordoRow?.id || !userId) return;

  const targetAcordoId = acordoRow.id;
  const minhaLinhaAcordo = (acordoRow.acordos_passageiros || []).find(
    (p) => p.passenger_id === userId,
  );
  const podeContactos = deveChamarGetAcordoContactos({
    acordoEstado: acordoRow.estado,
    tipoPerfil,
    minhaLinhaEstado: minhaLinhaAcordo?.estado,
  });

  let generation = loadGenerationRef.current;
  if (!background) {
    generation = ++loadGenerationRef.current;
  }

  const shouldApply = () => {
    if (background) {
      return targetAcordoId === openAcordoIdRef.current;
    }
    return generation === loadGenerationRef.current;
  };

  const mesAtual = getMesReferenciaAtual();

  if (!background) {
    setters.clearForegroundSections();
    setters.startForegroundLoading(podeContactos);
  }

  const linhaPassageiro =
    tipoPerfil === 'Passageiro'
      ? (acordoRow.acordos_passageiros || []).find((p) => p.passenger_id === userId)
      : null;

  void listPagamentosByAcordo(targetAcordoId)
    .then((rows) => {
      if (!shouldApply()) return;
      setters.setPagamentosAcordo(Array.isArray(rows) ? rows : []);
    })
    .catch((err) => {
      if (shouldApply()) console.error('Erro ao carregar pagamentos do acordo:', err);
    })
    .finally(() => {
      if (shouldApply()) setters.setPagamentosAcordoLoading(false);
    });

  if (tipoPerfil === 'Motorista') {
    void listPagamentosPendentesMotoristaAcordo(targetAcordoId)
      .then((rows) => {
        if (!shouldApply()) return;
        setters.setMotoristaPagamentos(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!shouldApply()) return;
        console.error('Erro ao listar pagamentos motorista:', err);
        setters.setMotoristaPagamentos([]);
      })
      .finally(() => {
        if (shouldApply()) setters.setMotoristaPagamentosLoading(false);
      });
  }

  if (tipoPerfil === 'Passageiro') {
    if (linhaPassageiro?.id) {
      void getObrigacaoPagamentoPassageiro(linhaPassageiro.id)
        .then((payload) => {
          if (!shouldApply()) return;
          setters.setPagamento(payload?.pagamento ?? null);
          setters.setObrigacaoPagamento(payload?.obrigacao ?? null);
        })
        .catch(async (err) => {
          if (!shouldApply()) return;
          console.error('Erro ao carregar obrigação:', err);
          try {
            const pagamentos = await listPagamentosByAcordo(targetAcordoId);
            const row =
              pagamentos.find(
                (p) =>
                  p.passenger_id === userId
                  && String(p.mes_referencia || '').slice(0, 10) === mesAtual,
              ) ?? (await getPagamentoForPassageiro(targetAcordoId, userId, mesAtual));
            if (shouldApply()) {
              setters.setPagamento(row);
              setters.setObrigacaoPagamento(null);
            }
          } catch {
            if (shouldApply()) {
              setters.setPagamento(null);
              setters.setObrigacaoPagamento(null);
            }
          }
        })
        .finally(() => {
          if (shouldApply()) setters.setPassageiroPagamentoLoading(false);
        });
    } else if (shouldApply()) {
      setters.setPagamento(null);
      setters.setObrigacaoPagamento(null);
      setters.setPassageiroPagamentoLoading(false);
    }
  }

  if (podeContactos) {
    void getAcordoContactos(targetAcordoId)
      .then((payload) => {
        if (!shouldApply()) return;
        setters.setContactos(payload);
      })
      .catch((err) => {
        if (!shouldApply()) return;
        if (err?.code !== 'P0001') {
          console.error('Erro ao carregar contactos:', err);
        }
        setters.setContactos(contactosBloqueadosFallback());
      })
      .finally(() => {
        if (shouldApply()) setters.setContactosLoading(false);
      });
  } else if (shouldApply()) {
    setters.setContactos(null);
    setters.setContactosLoading(false);
  }

  void listMinhasAvaliacoesAcordo(targetAcordoId)
    .then((avs) => {
      if (!shouldApply()) return;
      setters.setAvaliacoesAcordo(Array.isArray(avs) ? avs : []);
    })
    .catch((err) => {
      if (shouldApply()) console.error('Erro ao carregar avaliações:', err);
    })
    .finally(() => {
      if (shouldApply()) setters.setAvaliacoesLoading(false);
    });

  void listAdendaHistorico(targetAcordoId)
    .then((historico) => {
      if (!shouldApply()) return;
      setters.setHistoricoPreco(Array.isArray(historico) ? historico : []);
    })
    .catch((err) => {
      if (shouldApply()) console.error('Erro ao carregar histórico de preço:', err);
    })
    .finally(() => {
      if (shouldApply()) setters.setHistoricoLoading(false);
    });
}
