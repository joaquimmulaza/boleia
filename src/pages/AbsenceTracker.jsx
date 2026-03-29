import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAbsences } from '../services/AbsenceService';
import LogAbsenceModal from '../components/LogAbsenceModal';
import { ArrowLeft, Info, Plus } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils/formatters';

const AbsenceTracker = () => {
  const { acordoId } = useParams();
  const navigate = useNavigate();

  const [faltas, setFaltas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchFaltas = async () => {
      try {
        const { data, error } = await getAbsences(acordoId);
        if (error) throw error;
        if (isMounted) {
          setFaltas(data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar faltas:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchFaltas();
    return () => { isMounted = false; };
  }, [acordoId]);

  const totalDesconto = faltas.reduce((acc, falta) => acc + (Number(falta.desconto_kz) || 0), 0);

  const handleLogAbsence = (formData) => {
      // Logic handled in Modal parent component/service if needed, currently just closes
      setIsModalOpen(false);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-['Plus_Jakarta_Sans',_sans-serif] antialiased">
      <main className="flex-1 px-4 pt-4 pb-32 max-w-md mx-auto w-full">
        {/* Title & Back Button */}
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800"
            aria-label="Voltar"
          >
            <span className="material-symbols-outlined text-slate-900 dark:text-slate-100">arrow_back</span>
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Registo de Faltas</h1>
        </div>
        {/* Summary Card */}
        <div className="mt-4 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl border border-primary/20">
          <p className="text-primary font-semibold text-sm uppercase tracking-wider">Total a Descontar</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-50">{formatCurrency(totalDesconto)}</span>
            <span className="text-lg font-semibold text-slate-600 dark:text-slate-400">Kz</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>Calculado com base nos acordos ativos</span>
          </div>
        </div>

        {/* Section Title */}
        <div className="mt-8 mb-4 flex justify-between items-center">
          <h2 className="text-lg font-bold">Histórico de Ausências</h2>
          <span className="text-sm text-primary font-medium">Este mês</span>
        </div>

        {/* Absence List */}
        <div className="space-y-3">
          {loading ? (
             <div className="text-center py-10 text-slate-500 flex flex-col items-center justify-center">A carregar...</div>
          ) : faltas.length === 0 ? (
             <div className="text-center py-12 flex flex-col items-center justify-center space-y-3">
               <p className="text-slate-500 font-medium">Não há faltas</p>
             </div>
          ) : (
            faltas.map((falta) => (
              <div key={falta.id} data-testid="absence-card" className="bg-white dark:bg-slate-900/50 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">{formatDate(falta.data_falta) || falta.data_falta}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${falta.tipo_falta?.toLowerCase() === 'motorista' ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-600'}`}>
                      {falta.tipo_falta}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{falta.observacao || '-'}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-red-500">-{formatCurrency(falta.desconto_kz)} Kz</p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-24 right-4 z-20">
        <button 
           onClick={() => setIsModalOpen(true)}
           className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-primary/30 font-bold transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          <span>Registar Falta</span>
        </button>
      </div>

      <LogAbsenceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleLogAbsence} />

      {/* Safe Area bottom space for navigation (nav is normally in Layout, keeping space here) */}
      <div className="h-24"></div>
    </div>
  );
};

export default AbsenceTracker;
