import React, { useState, useEffect, useCallback } from 'react';
import { Car, MapPin, Clock, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { approveAgreement, rejectAgreement } from '../services/AgreementsService';

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Formata um valor numérico em Kwanzas.
 * ex: 25000 → "25 000 Kz/mês"
 */
const formatKz = (value) => {
  const num = Number(value);
  if (isNaN(num)) return `${value} Kz/mês`;
  return `${num.toLocaleString('pt-PT')} Kz/mês`;
};

/**
 * Devolve as classes CSS Tailwind para o badge de estado.
 * Pendente → amarelo, Ativo → verde, Cancelado → vermelho
 */
const getBadgeClasses = (estado) => {
  switch (estado?.toLowerCase()) {
    case 'ativo':
      return 'bg-green-100 text-green-800';
    case 'pendente':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelado':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

/**
 * Badge de estado do acordo.
 */
const EstadoBadge = ({ estado }) => (
  <span
    data-testid="badge-estado"
    className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${getBadgeClasses(estado)}`}
  >
    {estado}
  </span>
);

/**
 * Cartão de um acordo — vista do Passageiro (só leitura).
 */
const AcordoCardPassageiro = ({ acordo }) => (
  <article
    data-testid="agreement-card"
    className="bg-white rounded-2xl p-4 space-y-3 shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all hover:shadow-lg"
  >
    {/* Rota + badge */}
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 text-gray-800 text-sm font-semibold">
        <MapPin size={15} className="text-emerald-500 shrink-0" />
        <span>
          {acordo.routes?.origin_name} → {acordo.routes?.destination_name}
        </span>
      </div>
      <EstadoBadge estado={acordo.estado} />
    </div>

    {/* Hora e valor */}
    <div className="flex items-center gap-4 text-gray-500 text-sm">
      <div className="flex items-center gap-1.5">
        <Clock size={14} className="shrink-0" />
        <span>{acordo.routes?.departure_time}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <CreditCard size={14} className="shrink-0" />
        <span className="text-gray-800 font-semibold">
          {formatKz(acordo.routes?.monthly_price_per_seat)}
        </span>
      </div>
    </div>
  </article>
);

/**
 * Cartão de um acordo — vista do Motorista, com botões de ação para pendentes.
 */
const AcordoCardMotorista = ({ acordo, onAccept, onReject }) => {
  const isPendente = acordo.estado?.toLowerCase() === 'pendente';
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    await onAccept(acordo.id);
    setIsLoading(false);
  };

  const handleReject = async () => {
    setIsLoading(true);
    await onReject(acordo.id);
    setIsLoading(false);
  };

  return (
    <article
      data-testid="agreement-card"
      className="bg-white rounded-2xl p-4 space-y-3 shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all hover:shadow-lg"
    >
      {/* Rota + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-gray-800 text-sm font-semibold">
          <MapPin size={15} className="text-emerald-500 shrink-0" />
          <span>
            {acordo.routes?.origin_name} → {acordo.routes?.destination_name}
          </span>
        </div>
        <EstadoBadge estado={acordo.estado} />
      </div>

      {/* Hora e valor */}
      <div className="flex items-center gap-4 text-gray-500 text-sm">
        <div className="flex items-center gap-1.5">
          <Clock size={14} className="shrink-0" />
          <span>{acordo.routes?.departure_time}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CreditCard size={14} className="shrink-0" />
          <span className="text-gray-800 font-semibold">
            {formatKz(acordo.routes?.monthly_price_per_seat)}
          </span>
        </div>
      </div>

      {/* Botões de ação — apenas para acordos PENDENTES */}
      {isPendente && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAccept}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-[0.98]"
          >
            <CheckCircle size={15} />
            Aceitar
          </button>
          <button
            onClick={handleReject}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-100 hover:bg-red-200 disabled:opacity-60 text-red-700 text-sm font-bold py-2.5 rounded-xl transition-all active:scale-[0.98]"
          >
            <XCircle size={15} />
            Rejeitar
          </button>
        </div>
      )}
    </article>
  );
};

/**
 * Estado vazio.
 */
const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-4">
    <div className="bg-emerald-50 rounded-full p-6">
      <Car size={48} className="text-emerald-400" aria-hidden="true" />
    </div>
    <p className="text-gray-500 text-sm max-w-xs leading-relaxed">{message}</p>
  </div>
);

/**
 * Skeleton de loading.
 */
const LoadingSkeleton = () => (
  <div className="space-y-3" aria-busy="true" aria-label="A carregar acordos">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="bg-white rounded-2xl p-4 h-28 animate-pulse shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
      />
    ))}
  </div>
);

// ─── Página principal ─────────────────────────────────────────────────────────

/**
 * @typedef {Readonly<{}>} MyAgreementsProps
 *
 * Página "Meus Acordos" partilhada entre Motoristas e Passageiros.
 * - Passageiro: vê as suas boleias com badges de estado (Pendente / Ativo).
 * - Motorista:  vê os pedidos dos passageiros e pode Aceitar ou Rejeitar os PENDENTES.
 */
const MyAgreements = () => {
  const [acordos, setAcordos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null); // 'Motorista' | 'Passageiro'
  const [userId, setUserId] = useState(null);

  // ─── Carrega acordos conforme o papel do utilizador ─────────────────────────
  const carregarAcordos = useCallback(async (uid, role) => {
    setIsLoading(true);

    let query = supabase
      .from('acordos')
      .select('id, passenger_id, route_id, estado, routes(origin_name, destination_name, departure_time, monthly_price_per_seat)');

    if (role === 'Motorista') {
      // Motorista vê os acordos dos passageiros nas suas rotas
      query = query.eq('driver_id', uid);
    } else {
      // Passageiro vê os seus próprios acordos
      query = query.eq('passenger_id', uid);
    }

    const { data, error } = await query;

    if (!error && data) {
      setAcordos(data);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setIsLoading(false);
        return;
      }

      const role = user.user_metadata?.tipo_perfil;
      setUserRole(role);
      setUserId(user.id);
      await carregarAcordos(user.id, role);
    };

    init();
  }, [carregarAcordos]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleAccept = async (acordoId) => {
    await approveAgreement(acordoId);
    // Refresh: marca o acordo como ativo localmente
    setAcordos((prev) =>
      prev.map((a) => (a.id === acordoId ? { ...a, estado: 'ativo' } : a))
    );
  };

  const handleReject = async (acordoId) => {
    await rejectAgreement(acordoId);
    // Refresh: remove o acordo da lista local
    setAcordos((prev) => prev.filter((a) => a.id !== acordoId));
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const isMotorista = userRole === 'Motorista';
  const titulo = isMotorista ? 'Pedidos de Passageiros' : 'Meus Acordos';
  const subtitulo = isMotorista
    ? 'Gere os pedidos das tuas rotas'
    : 'As tuas boleias do mês';
  const emptyMessage = isMotorista
    ? 'Ainda não tens pedidos de passageiros nas tuas rotas.'
    : 'Ainda não tens acordos. Pede a tua primeira boleia!';

  return (
    <div className="font-[Plus_Jakarta_Sans,sans-serif] min-h-screen bg-gray-50 text-gray-800 antialiased">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-white/80 backdrop-blur-md px-4 py-3 border-b border-emerald-500/10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/10 p-2 rounded-lg">
            <Car size={22} className="text-emerald-500" aria-hidden="true" />
          </div>
          <span className="text-gray-900 text-lg font-bold tracking-tight">
            Boleia Certa
          </span>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-gray-400 text-xs font-medium">{userRole ?? '...'}</p>
          <p className="text-gray-900 text-sm font-bold">Luanda, AO</p>
        </div>
      </header>

      {/* ── Conteúdo principal ── */}
      <main role="main" className="px-4 py-6 pb-24 space-y-5">
        {/* Título */}
        <div className="space-y-0.5">
          <h1 className="text-gray-900 text-3xl font-bold tracking-tight">{titulo}</h1>
          <p className="text-gray-500 text-sm">{subtitulo}</p>
        </div>

        {/* Loading */}
        {isLoading && <LoadingSkeleton />}

        {/* Estado vazio */}
        {!isLoading && acordos.length === 0 && (
          <EmptyState message={emptyMessage} />
        )}

        {/* Lista de acordos */}
        {!isLoading && acordos.length > 0 && (
          <section className="space-y-3" aria-label="Lista de acordos">
            {acordos.map((acordo) =>
              isMotorista ? (
                <AcordoCardMotorista
                  key={acordo.id}
                  acordo={acordo}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ) : (
                <AcordoCardPassageiro key={acordo.id} acordo={acordo} />
              )
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default MyAgreements;
