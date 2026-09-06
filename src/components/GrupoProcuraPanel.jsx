import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, MapPin } from 'lucide-react';
import AddressInput from './AddressInput';
import {
  createGrupo,
  addMembroGrupo,
  getGrupoByProcura,
  listMembrosGrupo,
  listPedidosPendentes,
  aprovarEntrada,
  rejeitarEntrada,
  sairDoGrupo,
} from '../services/GrupoService';
import { findPassageiroByTelefone } from '../services/ProfileService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const CAPACIDADES = [2, 3, 4, 5, 6, 7, 8];

/**
 * Painel para criar/gerir o grupo ligado a uma procura.
 * Copy humana: «Grupo · N de M» — nunca jargon de domínio.
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
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [nMaximo, setNMaximo] = useState(4);
  const [telefone, setTelefone] = useState('');
  const [telefoneFallbackOpen, setTelefoneFallbackOpen] = useState(false);
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
        const [lista, pendentes] = await Promise.all([
          listMembrosGrupo(g.id),
          listPedidosPendentes(g.id),
        ]);
        setMembros(lista);
        setPedidos(pendentes);
      } else {
        setMembros([]);
        setPedidos([]);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [procura?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const labelTamanho = (n, max) => {
    if (!grupo && n <= 1) return 'Individual';
    if (max != null) return `Grupo · ${n} de ${max}`;
    if (n <= 1) return 'Grupo · 1 pessoa';
    return `Grupo · ${n} pessoas`;
  };

  const handleCriarGrupo = async () => {
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      const criado = await createGrupo(procura.id, 'O meu grupo', nMaximo);
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
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
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
      const cleanPickupName = pickup.pickup_name?.trim() || null;
      const cleanPickupLat =
        cleanPickupName &&
        pickup.pickup_lat != null &&
        pickup.pickup_lat !== '' &&
        Number.isFinite(Number(pickup.pickup_lat))
          ? Number(pickup.pickup_lat)
          : null;
      const cleanPickupLng =
        cleanPickupName &&
        pickup.pickup_lng != null &&
        pickup.pickup_lng !== '' &&
        Number.isFinite(Number(pickup.pickup_lng))
          ? Number(pickup.pickup_lng)
          : null;

      await addMembroGrupo(grupo.id, {
        passenger_id: perfil.id,
        pickup_name: cleanPickupName,
        pickup_lat: cleanPickupLat,
        pickup_lng: cleanPickupLng,
        ordem_insercao: membros.length,
      });
      setTelefone('');
      setPickup({ pickup_name: '', pickup_lat: null, pickup_lng: null });
      setFeedback({
        type: 'success',
        text:
          `${perfil.nome_completo || 'Colega'} adicionado ao grupo. ` +
          'Propostas já enviadas mantêm o tamanho anterior — para o novo tamanho, cria uma nova proposta.',
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

  const handleAprovar = async (membroId) => {
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      await aprovarEntrada(membroId);
      setFeedback({
        type: 'success',
        text:
          'Pedido aceite. O grupo cresceu. Propostas já enviadas mantêm o tamanho anterior — ' +
          'para o novo tamanho, cria uma nova proposta.',
      });
      await carregar();
      onGrupoChange?.();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleRejeitar = async (membroId) => {
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      await rejeitarEntrada(membroId);
      setFeedback({ type: 'success', text: 'Pedido recusado.' });
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleSair = async () => {
    if (!grupo) return;
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      await sairDoGrupo(grupo.id, userId);
      setFeedback({
        type: 'success',
        text: 'Saíste do grupo. Propostas abertas mantêm o tamanho com que foram enviadas.',
      });
      await carregar();
      onGrupoChange?.();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const handlePickupChange = (e) => {
    const val = e.target.value;
    setPickup((prev) => ({
      ...prev,
      pickup_name: val,
      ...(!val || !val.trim() ? { pickup_lat: null, pickup_lng: null } : {}),
    }));
  };

  if (loading) {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm">
        <p className="text-sm text-slate-500">A carregar grupo…</p>
      </section>
    );
  }

  const tamanho = membros.length > 0 ? membros.length : procura.n_candidato ?? 1;
  const max = grupo?.n_maximo ?? null;
  const cheio = max != null && tamanho >= max;
  const incompleto = grupo && max != null && tamanho < max;
  const podeSair = membros.length > 1 && membros.some((m) => m.passenger_id === userId);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <Users size={18} className="text-primary" aria-hidden="true" />
          <span className="text-balance">Grupo de viagem</span>
        </div>
        <span className="text-sm font-semibold text-slate-500 tabular-nums">
          {labelTamanho(tamanho, max)}
        </span>
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Até quantas pessoas?
            </legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Capacidade pretendida">
              {CAPACIDADES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNMaximo(n)}
                  className={`size-10 rounded-lg text-sm font-bold tabular-nums ${
                    nMaximo === n
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
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
          {incompleto ? (
            <p className="text-sm text-slate-500 text-pretty">
              Ainda há vagas. Podes propor ou negociar com o tamanho actual — não é preciso
              encher o grupo.
            </p>
          ) : null}

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

          {podeSair ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleSair}
              className="text-sm font-semibold text-slate-600 dark:text-slate-300 underline-offset-2 hover:underline disabled:opacity-60"
            >
              Sair do grupo
            </button>
          ) : null}

          {pedidos.length > 0 ? (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Pedidos de entrada
              </p>
              <ul className="space-y-2" aria-label="Pedidos de entrada">
                {pedidos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2.5"
                  >
                    <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-800 shrink-0">
                      {(p.perfis?.nome_completo || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold flex-1 min-w-0 truncate">
                      {p.perfis?.nome_completo || 'Passageiro'}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAprovar(p.id)}
                        className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
                      >
                        Aceitar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRejeitar(p.id)}
                        className="text-xs font-bold border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-60"
                      >
                        Recusar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {cheio ? (
            <p className="text-sm text-slate-500 text-pretty">Este grupo já está completo.</p>
          ) : (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <button
                type="button"
                aria-expanded={telefoneFallbackOpen}
                onClick={() => setTelefoneFallbackOpen((open) => !open)}
                className="w-full min-h-12 flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                <span>Fallback: Convidar por telefone</span>
                <span className="text-xs font-normal text-slate-500" aria-hidden="true">
                  {telefoneFallbackOpen ? '−' : '+'}
                </span>
              </button>

              {telefoneFallbackOpen ? (
                <form onSubmit={handleAdicionarMembro} className="space-y-3">
                  <p className="text-xs text-slate-500 text-pretty">
                    Usa só se o colega ainda não aparecer na descoberta pública. Preferimos
                    convites dentro da app.
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
                    required={false}
                    value={pickup.pickup_name}
                    onChange={handlePickupChange}
                    onSelectCoordinates={(c) =>
                      setPickup((prev) => ({
                        ...prev,
                        pickup_lat: c?.lat != null ? Number(c.lat) : null,
                        pickup_lng: c?.lng != null ? Number(c.lng) : null,
                      }))
                    }
                  />
                  <button
                    type="submit"
                    disabled={busy || !telefone.trim()}
                    className="w-full min-h-12 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60"
                  >
                    Adicionar ao grupo
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      'Junta-te ao meu grupo na Boleia Certa para partilharmos a boleia diária em Luanda.',
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  >
                    Partilhar convite via WhatsApp
                  </a>
                </form>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default GrupoProcuraPanel;
