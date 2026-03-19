import React, { useState, useEffect, useCallback } from 'react';
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
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
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
               <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>account_circle</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">Desconhecido</p>
              <EstadoBadge estado={acordo.estado} />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="material-symbols-outlined text-lg">block</span>
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
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAtivo ? 'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100/50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>account_circle</span>
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{acordo.rotas?.motorista?.nome || 'Motorista'}</p>
            <EstadoBadge estado={acordo.estado} />
          </div>
        </div>
        <button className="text-slate-400">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className={`material-symbols-outlined text-lg ${isAtivo ? 'text-primary' : 'text-amber-500'}`}>route</span>
          <p className="text-sm font-medium">{acordo.rotas?.origin_name} → {acordo.rotas?.destination_name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-lg">schedule</span>
            <p className="text-sm">{acordo.rotas?.departure_time}</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-lg">payments</span>
            <p className="text-sm">{formatKz(acordo.rotas?.monthly_price_per_seat)}</p>
          </div>
        </div>
      </div>

      {isAtivo ? (
         <button className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm">
            Ver Detalhes
         </button>
      ) : isPendente ? (
         <button className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg font-semibold text-sm cursor-default">
            Aguardando Confirmação
         </button>
      ) : null}
    </div>
  );
};

const AcordoCardMotorista = ({ acordo, onUpdate }) => {
  const [loadingAction, setLoadingAction] = useState(false);
  const isPendente = acordo.estado?.toLowerCase() === 'pendente';
  const isAtivo = acordo.estado?.toLowerCase() === 'ativo';

  const handleAction = async (actionFn) => {
    setLoadingAction(true);
    await actionFn(acordo.id);
    onUpdate();
    setLoadingAction(false);
  };

  return (
    <div data-testid="agreement-card" className="bg-white dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAtivo ? 'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100/50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>account_circle</span>
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{acordo.passageiro?.nome || 'Passageiro'}</p>
            <EstadoBadge estado={acordo.estado} />
          </div>
        </div>
        <button className="text-slate-400">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className={`material-symbols-outlined text-lg ${isAtivo ? 'text-primary' : 'text-amber-500'}`}>route</span>
          <p className="text-sm font-medium">{acordo.rotas?.origin_name} → {acordo.rotas?.destination_name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-lg">schedule</span>
            <p className="text-sm">{acordo.rotas?.departure_time}</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-lg">payments</span>
            <p className="text-sm">{formatKz(acordo.rotas?.monthly_price_per_seat)}</p>
          </div>
        </div>
      </div>

      {isPendente && (
        <div className="flex gap-2">
          <button
            onClick={() => handleAction(approveAgreement)}
            disabled={loadingAction}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {loadingAction ? 'Aguarde...' : 'Aceitar'}
          </button>
          <button
            onClick={() => handleAction(rejectAgreement)}
            disabled={loadingAction}
            className="flex-1 py-2.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg font-semibold text-sm flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {loadingAction ? '...' : 'Rejeitar'}
          </button>
        </div>
      )}
       {isAtivo && (
          <button className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm">
            Ver Detalhes
          </button>
       )}
    </div>
  );
};

// ─── Página Principal ─────────────────────────────────────────────────────────

const MyAgreements = () => {
  const [acordos, setAcordos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Usuário não autenticado");
        setLoading(false);
        return;
      }

      // Descobre perfil para definir se é motorista ou passageiro
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfis')
        .select('tipo_perfil')
        .eq('id', user.id)
        .single();

      if (perfilError) throw perfilError;
      setUserRole(perfilData?.tipo_perfil);

      let query = supabase.from('acordos').select(`
        id,
        estado,
        data_inicio,
        data_fim,
        rotas (
          id,
          origin_name,
          destination_name,
          departure_time,
          monthly_price_per_seat,
          motorista:perfis!id_motorista ( nome, avatar_url )
        ),
        passageiro:perfis!id_passageiro ( nome, avatar_url )
      `);

      if (perfilData?.tipo_perfil === 'Motorista') {
        // Busca acordos das rotas do motorista
        const { data: rotasMotorista } = await supabase.from('rotas').select('id').eq('id_motorista', user.id);
        const rotaIds = rotasMotorista?.map(r => r.id) || [];
        if (rotaIds.length > 0) {
            query = query.in('id_rota', rotaIds);
        } else {
            setAcordos([]);
            setLoading(false);
            return;
        }
      } else {
        query = query.eq('id_passageiro', user.id);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      // Ordenar: Pendentes primeiro, depois Ativos, depois o resto
      const sorted = (data || []).sort((a, b) => {
          const rank = { 'pendente': 1, 'ativo': 2, 'cancelado': 3 };
          return (rank[a.estado?.toLowerCase()] || 99) - (rank[b.estado?.toLowerCase()] || 99);
      });

      setAcordos(sorted);
    } catch (err) {
      console.error('Erro ao buscar acordos:', err);
      setError('Não foi possível carregar os acordos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-['Plus_Jakarta_Sans',_sans-serif] antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-primary/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">directions_car</span>
            <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold tracking-tight">Boleia Certa</h1>
          </div>
          <button className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">person</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full pb-32">
        {/* Title Section */}
        <div className="px-5 pt-8 pb-6">
          <h2 className="text-slate-900 dark:text-slate-100 text-3xl font-bold tracking-tight">
             {userRole === 'Motorista' ? 'Pedidos de Passageiros' : 'Meus Acordos'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">As tuas boleias do mês</p>
        </div>

        {/* Agreement List */}
        <div data-testid="agreements-list" className="px-4 space-y-4">
          {loading ? (
             <div className="flex flex-col gap-4">
               <div className="h-40 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-xl"></div>
               <div className="h-40 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-xl"></div>
             </div>
          ) : error ? (
            <div className="text-center py-10 px-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50">
               <span className="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
               <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
               <button onClick={fetchAgreements} className="mt-4 text-sm font-bold text-red-700 dark:text-red-300 underline underline-offset-2">Tentar Novamente</button>
            </div>
          ) : acordos.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
               <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <span className="material-symbols-outlined text-3xl">handshake</span>
               </div>
               <p className="text-slate-600 dark:text-slate-300 font-bold mb-1">Nenhum acordo ainda</p>
               <p className="text-slate-500 text-sm">Quando tiveres acordos de boleia, eles aparecerão aqui.</p>
            </div>
          ) : (
             acordos.map(acordo => (
                 userRole === 'Motorista'
                    ? <AcordoCardMotorista key={acordo.id} acordo={acordo} onUpdate={fetchAgreements} />
                    : <AcordoCardPassageiro key={acordo.id} acordo={acordo} />
             ))
          )}
        </div>
      </main>

      {/* FAB - Pedir Boleia */}
      {userRole !== 'Motorista' && (
        <button className="fixed bottom-24 right-6 bg-primary text-white flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-primary/30 z-40 transition-transform active:scale-95">
          <span className="material-symbols-outlined">add</span>
          <span className="font-bold text-sm tracking-wide">Pedir Boleia</span>
        </button>
      )}

      {/* Spacing for layout nav */}
      <div className="h-24"></div>
    </div>
  );
};

export default MyAgreements;
