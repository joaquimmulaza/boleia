import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Car, User, Plus } from 'lucide-react';

import { approveAgreement, rejectAgreement, cancelAgreement, getAgreementsForUser, hideAgreement } from '../services/AgreementsService';
import AcordoCardPassageiro from '../components/AcordoCardPassageiro';
import AcordoCardMotorista from '../components/AcordoCardMotorista';
import EmptyState from '../components/EmptyState';
import AcordoDetailsModal from '../components/AcordoDetailsModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNotifications } from '../hooks/useNotifications';

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
  const location = useLocation();
  const { addNotification } = useNotifications();
  const success = (msg) => addNotification(msg, 'success');
  const showError = (msg) => addNotification(msg, 'error');
  const [acordos, setAcordos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);

  // Modal state
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedAcordo, setSelectedAcordo] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [acordoToCancel, setAcordoToCancel] = useState(null);

  const carregarAcordos = useCallback(async (uid, role) => {
    if (!uid) return;
    setIsLoading(true);

    try {
      const acordosData = await getAgreementsForUser(uid, role);
      setAcordos((acordosData || []).filter(a => !a.is_hidden_by_user));
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

  // Deep Linking: Auto-open the details modal based on URL query parameter or Router State
  useEffect(() => {
    if (!isLoading && acordos.length > 0) {
      const params = new URLSearchParams(location.search);
      const openAcordoId = params.get('openAcordoId') || location.state?.openAcordoId;

      if (openAcordoId) {
        const acordoToOpen = acordos.find(a => a.id === openAcordoId);
        if (acordoToOpen) {
          handleShowDetails(acordoToOpen);

          // Optional: Clean up the URL to avoid re-triggering on refresh
          navigate(location.pathname, { replace: true, state: {} });
        }
      }
    }
  }, [isLoading, acordos, location.search, location.state, navigate, location.pathname]);

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

  const handleShowDetails = (acordo) => {
    setSelectedAcordo(acordo);
    setIsDetailsOpen(true);
  };

  const handleReport = (acordo) => {
    window.location.href = `mailto:joaquimmulazadev@gmail.com?subject=${encodeURIComponent(`Reportar Problema - Acordo ${acordo.id}`)}`;
  };

  const handleCancel = (acordo) => {
    setAcordoToCancel(acordo);
    setIsCancelModalOpen(true);
  };


  const handleRemover = async (acordo) => {
    try {
      await hideAgreement(acordo.id);
      setAcordos((prev) => prev.filter((a) => a.id !== acordo.id));
      success('Acordo removido da lista.');
    } catch (err) {
      console.error('Erro ao remover acordo:', err);
      showError('Não foi possível remover o acordo.');
    }
  };

  const confirmCancel = async () => {
    if (!acordoToCancel) return;
    try {
      await cancelAgreement(acordoToCancel.id, acordoToCancel.route_id);
      setAcordos((prev) =>
        prev.map((a) => (a.id === acordoToCancel.id ? { ...a, estado: 'Cancelado' } : a))
      );
      success('Boleia cancelada com sucesso.');
    } catch (err) {
      console.error('Erro ao cancelar acordo:', err);
      showError('Não foi possível cancelar a boleia.');
    } finally {
      setIsCancelModalOpen(false);
      setAcordoToCancel(null);
    }
  };

  const isMotorista = userRole === 'Motorista';
  const titulo = isMotorista ? 'Pedidos de Passageiros' : 'Meus Acordos';
  const subtitulo = isMotorista ? 'Gere os pedidos das tuas rotas' : 'As tuas boleias do mês';
  const emptyMessage = isMotorista
    ? 'Ainda não tens pedidos de passageiros nas tuas rotas.'
    : 'Ainda não tens acordos. Pede a tua primeira boleia!';

  return (
    <div className="font-[Plus_Jakarta_Sans,sans-serif] bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col antialiased">
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
                    onShowDetails={handleShowDetails}
                    onReport={handleReport}
                    onCancel={handleCancel}
                    onRemover={handleRemover}
                  />
                ) : (
                  <AcordoCardPassageiro
                    key={acordo.id}
                    acordo={acordo}
                    onShowDetails={handleShowDetails}
                    onReport={handleReport}
                    onCancel={handleCancel}
                    onRemover={handleRemover}
                  />
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

      {/* Modal de Detalhes */}
            <AcordoDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        acordo={selectedAcordo}
        userRole={userRole}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      <ConfirmationModal
        isOpen={isCancelModalOpen}
        title="Cancelar Boleia"
        message="Tens a certeza que pretendes cancelar esta boleia? Esta ação não pode ser desfeita."
        onConfirm={confirmCancel}
        onCancel={() => {
          setIsCancelModalOpen(false);
          setAcordoToCancel(null);
        }}
        confirmText="Sim, Cancelar"
      />
    </div>
  );
};

export default MyAgreements;
