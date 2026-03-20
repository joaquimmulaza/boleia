cat << 'INNER_EOF' > src/pages/MyAgreements.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

import AcordoCardPassageiro from '../components/AcordoCardPassageiro';
import AcordoCardMotorista from '../components/AcordoCardMotorista';

// ─── Página principal ─────────────────────────────────────────────────────────

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

      const uid = user.id;
      // Busca o perfil do usuário para determinar se é Motorista ou Passageiro
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('tipo_perfil')
        .eq('id', uid)
        .single();

      if (perfilError) throw perfilError;

      const role = perfil?.tipo_perfil || user.user_metadata?.tipo_perfil;
      setUserRole(role);

      let query = supabase.from('acordos').select(`
        *,
        routes:route_id (
          origin_name,
          destination_name,
          departure_time,
          monthly_price_per_seat
        )
      `);

      if (role === 'Motorista') {
        // Find driver's routes
        const { data: rotasMotorista } = await supabase.from('routes').select('id').eq('driver_id', uid);
        const rotaIds = rotasMotorista?.map(r => r.id) || [];
        if (rotaIds.length > 0) {
            query = query.in('route_id', rotaIds);
        } else {
            setAcordos([]);
            setLoading(false);
            return;
        }
      } else {
        query = query.eq('passenger_id', uid);
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
               <p className="text-slate-600 dark:text-slate-300 font-bold mb-1">
                 {userRole === 'Motorista' ? 'Ainda não tens pedidos de passageiros nas tuas rotas.' : 'Ainda não tens acordos. Pede a tua primeira boleia!'}
               </p>
               <p className="text-slate-500 text-sm">Quando tiveres acordos de boleia, eles aparecerão aqui.</p>
            </div>
          ) : (
             acordos.map(acordo => (
                 userRole === 'Motorista'
                    ? <AcordoCardMotorista key={acordo.id} acordo={acordo} onAccept={() => {}} onReject={() => {}} onUpdate={fetchAgreements} />
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
INNER_EOF
