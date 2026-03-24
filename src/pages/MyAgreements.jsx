import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Car, User, Plus, CheckCircle, XCircle, X } from 'lucide-react';

import { approveAgreement, rejectAgreement } from '../services/AgreementsService';
import AcordoCardPassageiro from '../components/AcordoCardPassageiro';
import AcordoCardMotorista from '../components/AcordoCardMotorista';
import EmptyState from '../components/EmptyState';

// ─── Componentes Auxiliares ───────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="space-y-4 animate-pulse pt-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-2xl w-full" />
    ))}
  </div>
);

// ─── Página principal ─────────────────────────────────────────────────────────

const MyAgreements = () => {
  const navigate = useNavigate();
  const [acordos, setAcordos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);

  const carregarAcordos = useCallback(async (uid, role) => {
    if (!uid) return;
    setIsLoading(true);

    try {
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
        // Busca as rotas do motorista
        const { data: rotasMotorista } = await supabase
          .from('routes')
          .select('id')
          .eq('driver_id', uid);
        
        const rotaIds = rotasMotorista?.map(r => r.id) || [];
        
        if (rotaIds.length > 0) {
          query = query.in('route_id', rotaIds);
        } else {
          setAcordos([]);
          setIsLoading(false);
          return;
        }
      } else {
        query = query.eq('passenger_id', uid);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAcordos(data || []);
    } catch (err) {
      console.error('Erro ao carregar acordos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setIsLoading(false);
        return;
      }
      
      const role = user.user_metadata?.tipo_perfil || 'Passageiro';
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

        {/* Loading / Lista / Estado Vazio */}
        <div className="px-4 space-y-4">
          {isLoading ? (
            <LoadingSkeleton />
          ) : acordos.length === 0 ? (
            <EmptyState message={emptyMessage} />
          ) : (
            <section className="space-y-4" aria-label="Lista de acordos">
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
        </div>
      </main>

      {/* Floating Action Button - APENAS para Passageiros */}
      {!isMotorista && (
        <button onClick={() => navigate('/passageiro')} className="fixed bottom-24 right-6 bg-primary hover:bg-primary/90 text-white flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-primary/30 z-40 transition-all active:scale-95">
          <Plus size={20} className="shrink-0" />
          <span className="font-bold text-sm tracking-wide">Pedir Boleia</span>
        </button>
      )}

    </div>
  );
};

export default MyAgreements;
