import React, { useState, useEffect, useCallback } from 'react';
import { Car, MapPin, Clock, CreditCard, Info, Plus, User, Route, MoreVertical, Ban, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { approveAgreement, rejectAgreement } from '../services/AgreementsService';

// ─── Utilitários ──────────────────────────────────────────────────────────────

const formatKz = (value) => {
  const num = Number(value);
  if (isNaN(num)) return `${value} Kz/mês`;
  return `${num.toLocaleString('pt-PT')} Kz/mês`;
};

const getBadgeClasses = (estado) => {
  switch (estado?.toLowerCase()) {
    case 'ativo':
      return 'bg-emerald/10 text-emerald';
    case 'pendente':
      return 'bg-amber/10 text-amber';
    case 'cancelado':
      return 'bg-coral/10 text-coral';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

const EstadoBadge = ({ estado }) => (
  <span
    data-testid="badge-estado"
    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getBadgeClasses(estado)}`}
  >
    {estado}
  </span>
);

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const AcordoCardPassageiro = ({ acordo }) => {
  const isPendente = acordo.estado?.toLowerCase() === 'pendente';
  const isCancelado = acordo.estado?.toLowerCase() === 'cancelado';
  const isAtivo = acordo.estado?.toLowerCase() === 'ativo';

  if (isCancelado) {
    return (
      <div data-testid="agreement-card" className="bg-white/60 dark:bg-slate-800/30 rounded-xl p-4 shadow-sm border border-slate-100/50 dark:border-slate-700/50 opacity-60">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
               <User size={24} className="shrink-0" />
            </div>
            <div>
              <p className="font-bold text-charcoal dark:text-slate-100">Desconhecido</p>
              <EstadoBadge estado={acordo.estado} />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Ban size={18} />
            <p className="text-sm font-medium italic">Acordo cancelado este mês</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="agreement-card" className="bg-white dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAtivo ? 'bg-emerald/20 text-emerald' : 'bg-amber/20 text-amber'}`}>
            <User size={24} className="shrink-0" />
          </div>
          <div>
            <p className="font-bold text-charcoal dark:text-slate-100">Motorista</p>
            <EstadoBadge estado={acordo.estado} />
          </div>
        </div>
        <button className="text-slate-400">
          <MoreVertical size={20} className="shrink-0" />
        </button>
      </div>
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Route size={18} className={`shrink-0 ${isAtivo ? 'text-primary' : 'text-amber'}`} />
          <p className="text-sm font-medium">{acordo.routes?.origin_name} → {acordo.routes?.destination_name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Clock size={18} className="shrink-0" />
            <p className="text-sm">{acordo.routes?.departure_time}</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <CreditCard size={18} className="shrink-0" />
            <p className="text-sm">{formatKz(acordo.routes?.monthly_price_per_seat)}</p>
          </div>
        </div>
      </div>
      
      {isPendente && (
        <button className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg font-semibold text-sm transition-colors active:scale-95">
          Aguardando Confirmação
        </button>
      )}
      {isAtivo && (
        <button className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm transition-colors active:scale-95">
          Ver Detalhes
        </button>
      )}
    </div>
  );
};

const AcordoCardMotorista = ({ acordo, onAccept, onReject }) => {
  const isPendente = acordo.estado?.toLowerCase() === 'pendente';
  const isAtivo = acordo.estado?.toLowerCase() === 'ativo';
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
    <div data-testid="agreement-card" className="bg-white dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAtivo ? 'bg-emerald/20 text-emerald' : 'bg-amber/20 text-amber'}`}>
            <User size={24} className="shrink-0" />
          </div>
          <div>
            <p className="font-bold text-charcoal dark:text-slate-100">Passageiro</p>
            <EstadoBadge estado={acordo.estado} />
          </div>
        </div>
        <button className="text-slate-400">
          <MoreVertical size={20} className="shrink-0" />
        </button>
      </div>
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Route size={18} className={`shrink-0 ${isAtivo ? 'text-primary' : 'text-amber'}`} />
          <p className="text-sm font-medium">{acordo.routes?.origin_name} → {acordo.routes?.destination_name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Clock size={18} className="shrink-0" />
            <p className="text-sm">{acordo.routes?.departure_time}</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <CreditCard size={18} className="shrink-0" />
            <p className="text-sm">{formatKz(acordo.routes?.monthly_price_per_seat)}</p>
          </div>
        </div>
      </div>
      
      {isPendente && (
        <div className="flex gap-2">
           <button
             onClick={handleAccept}
             disabled={isLoading}
             className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white rounded-lg font-semibold text-sm transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5"
           >
             <CheckCircle size={16} /> Aceitar
           </button>
           <button
             onClick={handleReject}
             disabled={isLoading}
             className="flex-1 py-2.5 bg-coral/10 hover:bg-coral/20 text-coral disabled:opacity-60 rounded-lg font-semibold text-sm transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5"
           >
             <XCircle size={16} /> Rejeitar
           </button>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-4">
    <div className="bg-primary/10 rounded-full p-6">
      <Car size={48} className="text-primary" aria-hidden="true" />
    </div>
    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed">{message}</p>
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-3" aria-busy="true" aria-label="A carregar acordos">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="bg-white dark:bg-slate-800/50 rounded-xl p-4 h-36 animate-pulse shadow-sm border border-slate-100 dark:border-slate-700"
      />
    ))}
  </div>
);

// ─── Página principal ─────────────────────────────────────────────────────────

const MyAgreements = () => {
  const [acordos, setAcordos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null); 
  const [userId, setUserId] = useState(null);

  const carregarAcordos = useCallback(async (uid, role) => {
    setIsLoading(true);

    let query = supabase
      .from('acordos')
      .select('id, passenger_id, route_id, estado, routes(origin_name, destination_name, departure_time, monthly_price_per_seat)');

    if (role === 'Motorista') {
      query = query.eq('driver_id', uid);
    } else {
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
      const { data: { user }, error } = await supabase.auth.getUser();
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

  const handleAccept = async (acordoId) => {
    await approveAgreement(acordoId);
    setAcordos((prev) =>
      prev.map((a) => (a.id === acordoId ? { ...a, estado: 'ativo' } : a))
    );
  };

  const handleReject = async (acordoId) => {
    await rejectAgreement(acordoId);
    setAcordos((prev) => prev.filter((a) => a.id !== acordoId));
  };

  const isMotorista = userRole === 'Motorista';
  const titulo = isMotorista ? 'Pedidos de Passageiros' : 'Meus Acordos';
  const subtitulo = isMotorista ? 'Gere os pedidos das tuas rotas' : 'As tuas boleias do mês';
  const emptyMessage = isMotorista
    ? 'Ainda não tens pedidos de passageiros nas tuas rotas.'
    : 'Ainda não tens acordos. Pede a tua primeira boleia!';

  return (
    <div className="font-[Plus_Jakarta_Sans,sans-serif] bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col antialiased">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-3 border-b border-primary/10">
        <div className="flex items-center justify-between max-w-md mx-auto w-full">
          <div className="flex items-center gap-2">
            <Car size={24} className="text-primary" aria-hidden="true" />
            <h1 className="text-charcoal dark:text-slate-100 text-lg font-bold tracking-tight">
              Boleia Certa
            </h1>
          </div>
          <button className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary transition-colors hover:bg-primary/20">
            <User size={20} />
          </button>
        </div>
      </header>

      {/* ── Conteúdo principal ── */}
      <main role="main" className="flex-1 max-w-md mx-auto w-full pb-32">
        {/* Título */}
        <div className="px-5 pt-8 pb-6">
          <h2 className="text-charcoal dark:text-slate-100 text-3xl font-bold tracking-tight">{titulo}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{subtitulo}</p>
        </div>

        {/* Loading */}
        <div className="px-4">
          {isLoading && <LoadingSkeleton />}
        </div>

        {/* Estado vazio */}
        {!isLoading && acordos.length === 0 && (
          <EmptyState message={emptyMessage} />
        )}

        {/* Lista de acordos */}
        {!isLoading && acordos.length > 0 && (
          <section className="px-4 space-y-4" aria-label="Lista de acordos">
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

      {/* Floating Action Button - APENAS para Passageiros */}
      {!isMotorista && (
        <button className="fixed bottom-24 right-6 bg-primary hover:bg-primary/90 text-white flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-primary/30 z-40 transition-all active:scale-95">
          <Plus size={20} className="shrink-0" />
          <span className="font-bold text-sm tracking-wide">Pedir Boleia</span>
        </button>  
      )}

    </div>
  );
};

export default MyAgreements;
