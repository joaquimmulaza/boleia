import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
} from '../services/AgreementService';
import { listPagamentosByAcordo } from '../services/PaymentService';
import { listMinhasAvaliacoesAcordo } from '../services/RatingService';
import { labelRotaOferta } from '../utils/ofertaLabels';

/**
 * @param {string | undefined} acordoId
 * @returns {{
 *   loading: boolean,
 *   error: string,
 *   acordo: object | null,
 *   pagamentos: object[],
 *   avaliacoes: object[],
 *   reload: () => Promise<void>,
 *   minhaLinha: object | null,
 *   rotaLabel: string,
 *   driverNome: string,
 * }}
 */
export function useAcordoRatingContext(acordoId) {
  const { user, tipoPerfil } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acordo, setAcordo] = useState(/** @type {object | null} */ (null));
  const [pagamentos, setPagamentos] = useState(/** @type {object[]} */ ([]));
  const [avaliacoes, setAvaliacoes] = useState(/** @type {object[]} */ ([]));

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
      const [pags, avs] = await Promise.all([
        listPagamentosByAcordo(acordoId),
        listMinhasAvaliacoesAcordo(acordoId),
      ]);
      setAcordo(found);
      setPagamentos(pags || []);
      setAvaliacoes(avs || []);
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

  const linhas = acordo?.acordos_passageiros || [];
  const minhaLinha = linhas.find((p) => p.passenger_id === user?.id) || null;
  const oferta = acordo?.ofertas_capacidade || {};
  const rota = labelRotaOferta(oferta);
  const rotaLabel = `${rota.origem} → ${rota.destino}`;
  const driverNome =
    acordo?.perfis?.nome_completo
    || acordo?.motorista?.nome_completo
    || 'Motorista';

  return {
    loading,
    error,
    acordo,
    pagamentos,
    avaliacoes,
    reload,
    minhaLinha,
    rotaLabel,
    driverNome,
  };
}

/**
 * @param {string | null | undefined} nome
 * @returns {string}
 */
export function iniciaisNome(nome) {
  const parts = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
