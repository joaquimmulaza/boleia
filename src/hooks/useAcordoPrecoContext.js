import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  listAdendaHistorico,
} from '../services/AgreementService';
import { getAcordoContactos } from '../services/PaymentService';
import { labelRotaOferta } from '../utils/ofertaLabels';
import { resolveNegociacaoPrecoAtiva } from '../utils/adendaNegociacao.js';
import { isJanelaPropostaPrecoAberta, labelMesActualPt } from '../utils/precoProximoMes.js';
import { firstDayNextMonthLuanda } from '../utils/adendaEffectiveFrom.js';

/**
 * Contexto partilhado dos ecrãs ENG#35 (preço próximo mês).
 * @param {string | undefined} acordoId
 */
export function useAcordoPrecoContext(acordoId) {
  const { user, tipoPerfil } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acordo, setAcordo] = useState(/** @type {object | null} */ (null));
  const [historico, setHistorico] = useState(/** @type {object[]} */ ([]));
  const [contactos, setContactos] = useState(/** @type {object | null} */ (null));

  const reload = useCallback(async () => {
    if (!acordoId || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const list =
        tipoPerfil === 'Motorista'
          ? await getAgreementsForDriver(user.id)
          : await getAgreementsForPassenger(user.id);
      const found = (list || []).find((a) => a.id === acordoId);
      if (!found) {
        setError('Acordo não encontrado.');
        setAcordo(null);
        return;
      }
      const [rows, cts] = await Promise.all([
        listAdendaHistorico(acordoId),
        getAcordoContactos(acordoId).catch(() => null),
      ]);
      setAcordo(found);
      setHistorico(rows || []);
      setContactos(cts);
    } catch (err) {
      setError(err?.message || 'Erro ao carregar acordo.');
      setAcordo(null);
    } finally {
      setLoading(false);
    }
  }, [acordoId, user?.id, tipoPerfil]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isMotorista = tipoPerfil === 'Motorista';
  const isPassageiro = tipoPerfil === 'Passageiro';
  const linhas = acordo?.acordos_passageiros || [];
  const minhaLinha = linhas.find((p) => p.passenger_id === user?.id) || null;
  const oferta = acordo?.ofertas_capacidade || {};
  const rota = labelRotaOferta(oferta);
  const negociacao = resolveNegociacaoPrecoAtiva(acordo?.acordos_adendas)
    || acordo?.adenda_pendente
    || null;
  const janelaAberta = isJanelaPropostaPrecoAberta();
  const mesActualLabel = labelMesActualPt();
  const effectiveFrom = negociacao?.effective_from || firstDayNextMonthLuanda();
  const precoActual = acordo?.valor_mensal_por_passageiro_kz
    ?? minhaLinha?.quota_mensal_kz
    ?? 0;

  const contraparteLabel = (() => {
    if (isMotorista) {
      const pax = contactos?.passageiros?.[0];
      return pax?.nome_completo || 'Passageiro';
    }
    return contactos?.motorista?.nome_completo || 'Motorista';
  })();

  return {
    loading,
    error,
    acordo,
    historico,
    contactos,
    reload,
    user,
    isMotorista,
    isPassageiro,
    minhaLinha,
    rotaLabel: `${rota.origem} → ${rota.destino}`,
    negociacao,
    janelaAberta,
    mesActualLabel,
    effectiveFrom,
    precoActual,
    contraparteLabel,
  };
}
