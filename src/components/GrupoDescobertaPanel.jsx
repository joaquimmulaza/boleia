import React, { useState, useEffect, useCallback } from 'react';
import { Users, ArrowRight, Clock } from 'lucide-react';
import { listGruposAbertos, pedirEntradaGrupo } from '../services/GrupoService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

/**
 * Descoberta de grupos públicos com vagas + pedir entrada.
 *
 * @param {{
 *   userId: string,
 *   excludeGrupoId?: string | null,
 *   onPedidoEnviado?: () => void,
 * }} props
 */
const GrupoDescobertaPanel = ({ userId, excludeGrupoId = null, onPedidoEnviado }) => {
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [enviados, setEnviados] = useState(() => new Set());
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const carregar = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const lista = await listGruposAbertos({
        excludeOwnerId: userId,
        excludeGrupoId: excludeGrupoId || undefined,
      });
      setGrupos(lista);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [userId, excludeGrupoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handlePedir = async (grupoId) => {
    setBusyId(grupoId);
    setFeedback({ type: '', text: '' });
    try {
      await pedirEntradaGrupo(grupoId, { passenger_id: userId });
      setEnviados((prev) => new Set(prev).add(grupoId));
      setFeedback({ type: 'success', text: 'O criador do grupo vai rever o teu pedido.' });
      onPedidoEnviado?.();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || getFriendlyErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3" data-testid="grupo-descoberta-panel">
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide text-balance">
        Grupos abertos
      </h2>

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

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">A procurar grupos…</p>
        </div>
      ) : null}

      {!loading && grupos.length === 0 ? (
        <p className="text-sm text-slate-500 text-pretty">
          Não há grupos abertos nesta altura.
        </p>
      ) : null}

      {!loading &&
        grupos.map((g) => {
          const p = g.procuras || {};
          const n = Number(p.n_candidato) || 0;
          const max = Number(g.n_maximo) || 4;
          const jaPediu = enviados.has(g.id);
          return (
            <article
              key={g.id}
              className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm space-y-3"
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <span>{p.origin_name || 'Origem'}</span>
                <ArrowRight size={14} className="text-slate-400" aria-hidden="true" />
                <span>{p.destination_name || 'Destino'}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                {p.preferred_time ? (
                  <span className="flex items-center gap-1">
                    <Clock size={14} aria-hidden="true" />
                    {String(p.preferred_time).slice(0, 5)}
                  </span>
                ) : null}
                <span className="flex items-center gap-1 tabular-nums">
                  <Users size={14} aria-hidden="true" />
                  Grupo · {n} de {max}
                </span>
              </div>
              {jaPediu ? (
                <p className="text-sm font-medium text-emerald-700">Pedido enviado</p>
              ) : (
                <button
                  type="button"
                  disabled={busyId === g.id}
                  onClick={() => handlePedir(g.id)}
                  className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60"
                >
                  Pedir entrada
                </button>
              )}
            </article>
          );
        })}
    </section>
  );
};

export default GrupoDescobertaPanel;
