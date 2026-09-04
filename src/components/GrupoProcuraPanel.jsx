import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, MapPin } from 'lucide-react';
import AddressInput from './AddressInput';
import {
  createGrupo,
  addMembroGrupo,
  getGrupoByProcura,
  listMembrosGrupo,
} from '../services/GrupoService';
import { findPassageiroByTelefone } from '../services/ProfileService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

/**
 * Painel para criar/gerir o grupo ligado a uma procura.
 * Copy humana: «Grupo · N pessoas» — nunca jargon de domínio.
 *
 * @param {{
 *   procura: {
 *     id: string,
 *     n_candidato?: number,
 *     origin_name?: string | null,
 *     origin_lat?: number | null,
 *     origin_lng?: number | null,
 *     destination_name?: string | null,
 *     destination_lat?: number | null,
 *     destination_lng?: number | null,
 *   },
 *   userId: string,
 *   onGrupoChange?: () => void,
 * }} props
 */
const GrupoProcuraPanel = ({ procura, userId, onGrupoChange }) => {
  const [grupo, setGrupo] = useState(null);
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [telefone, setTelefone] = useState('');
  const [pickup, setPickup] = useState({
    pickup_name: '',
    pickup_lat: null,
    pickup_lng: null,
  });

  const carregar = useCallback(async () => {
    if (!procura?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const g = await getGrupoByProcura(procura.id);
      setGrupo(g);
      if (g) {
        const lista = await listMembrosGrupo(g.id);
        setMembros(lista);
      } else {
        setMembros([]);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [procura?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const labelTamanho = (n) => {
    if (n <= 1) return n === 1 && grupo ? 'Grupo · 1 pessoa' : 'Individual';
    return `Grupo · ${n} pessoas`;
  };

  const handleCriarGrupo = async () => {
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      const criado = await createGrupo(procura.id, 'O meu grupo');
      await addMembroGrupo(criado.id, {
        passenger_id: userId,
        pickup_name: procura.origin_name ?? null,
        pickup_lat: procura.origin_lat ?? null,
        pickup_lng: procura.origin_lng ?? null,
        dropoff_name: procura.destination_name ?? null,
        dropoff_lat: procura.destination_lat ?? null,
        dropoff_lng: procura.destination_lng ?? null,
        ordem_insercao: 0,
      });
      setFeedback({ type: 'success', text: 'Grupo criado. Já estás incluído.' });
      await carregar();
      onGrupoChange?.();
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleAdicionarMembro = async (e) => {
    e.preventDefault();
    if (!grupo) return;
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      const perfil = await findPassageiroByTelefone(telefone);
      if (perfil.id === userId) {
        throw new Error('Já estás no grupo.');
      }
      if (membros.some((m) => m.passenger_id === perfil.id)) {
        throw new Error('Este colega já está no grupo.');
      }
      await addMembroGrupo(grupo.id, {
        passenger_id: perfil.id,
        pickup_name: pickup.pickup_name || null,
        pickup_lat: pickup.pickup_lat,
        pickup_lng: pickup.pickup_lng,
        ordem_insercao: membros.length,
      });
      setTelefone('');
      setPickup({ pickup_name: '', pickup_lat: null, pickup_lng: null });
      setFeedback({
        type: 'success',
        text: `${perfil.nome_completo || 'Colega'} adicionado ao grupo.`,
      });
      await carregar();
      onGrupoChange?.();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || getFriendlyErrorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePickupChange = (e) => {
    setPickup((prev) => ({ ...prev, pickup_name: e.target.value }));
  };

  if (loading) {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm">
        <p className="text-sm text-slate-500">A carregar grupo…</p>
      </section>
    );
  }

  const tamanho = membros.length > 0 ? membros.length : procura.n_candidato ?? 1;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <Users size={18} className="text-primary" aria-hidden="true" />
          <span>Grupo de viagem</span>
        </div>
        <span className="text-sm font-semibold text-slate-500">{labelTamanho(tamanho)}</span>
      </div>

      {feedback.text ? (
        <div
          role="alert"
          className={`rounded-xl px-3 py-2 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {!grupo ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 text-pretty">
            Viajas sozinho por agora. Cria um grupo para incluir colegas — podes propor
            acordo assim que houver quem queira viajar, mesmo sem o grupo cheio.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleCriarGrupo}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            <UserPlus size={18} aria-hidden="true" />
            Criar grupo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2" aria-label="Membros do grupo">
            {membros.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5"
              >
                <div className="mt-0.5 size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(m.perfis?.nome_completo || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {m.perfis?.nome_completo || 'Passageiro'}
                    {m.passenger_id === userId ? ' (tu)' : ''}
                  </p>
                  {m.pickup_name ? (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={12} aria-hidden="true" />
                      {m.pickup_name}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAdicionarMembro} className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Adicionar colega
            </p>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Telefone do colega
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="9XXXXXXXX"
                required
                className="h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3 font-normal"
              />
            </label>
            <AddressInput
              name="pickup_name"
              label="Ponto de recolha (opcional)"
              value={pickup.pickup_name}
              onChange={handlePickupChange}
              onSelectCoordinates={(c) =>
                setPickup((prev) => ({
                  ...prev,
                  pickup_lat: c.lat,
                  pickup_lng: c.lng,
                }))
              }
            />
            <button
              type="submit"
              disabled={busy || !telefone.trim()}
              className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60"
            >
              Adicionar ao grupo
            </button>
          </form>
        </div>
      )}
    </section>
  );
};

export default GrupoProcuraPanel;
