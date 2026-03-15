import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar, Info, Plus, ChevronDown } from 'lucide-react';

const AbsenceTracker = () => {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  
  const [faltas, setFaltas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for modal
  const [formData, setFormData] = useState({
    dataFalta: '',
    tipo: 'Motorista',
    observacao: ''
  });

  useEffect(() => {
    let isMounted = true;
    const fetchFaltas = async () => {
      try {
        const { data, error } = await supabase
          .from('faltas')
          .select('*')
          .eq('id_acordo', acordoId);
        
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

  const formatCurrency = (value) => {
    return Number(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('pt-AO');
  };

  return (
    <div className="font-[Plus_Jakarta_Sans,sans-serif] bg-[#f6f8f6] text-slate-900 min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f6f8f6]/80 backdrop-blur-md px-4 py-4 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-emerald-500/10 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="text-slate-900" size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Registo de Faltas</h1>
      </header>

      <main className="flex-1 px-4 pb-32">
        {/* Summary Card */}
        <div className="mt-4 p-6 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">Total a Descontar</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-bold text-slate-900">{formatCurrency(totalDesconto)} <span className="text-lg font-semibold text-slate-600">Kz</span></span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Info size={16} />
            <span>Calculado com base nos acordos ativos</span>
          </div>
        </div>

        {/* Section Title */}
        <div className="mt-8 mb-4 flex justify-between items-center">
          <h2 className="text-lg font-bold">Histórico de Ausências</h2>
          <span className="text-sm text-emerald-500 font-medium">Este mês</span>
        </div>

        {/* Absence List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-10 text-slate-500">A carregar...</div>
          ) : faltas.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center space-y-3">
              <div className="bg-emerald-50 text-emerald-400 p-4 rounded-full">
                <Calendar size={48} strokeWidth={1.5} />
              </div>
              <p className="text-slate-500 font-medium">Não há faltas</p>
            </div>
          ) : (
            faltas.map((falta) => (
              <div 
                key={falta.id} 
                data-testid="absence-card"
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">{formatDate(falta.data_falta)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      falta.tipo_falta === 'Motorista' 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {falta.tipo_falta}
                    </span>
                  </div>
                  {falta.observacao && (
                    <p className="text-sm text-slate-500">{falta.observacao}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-red-500">
                    -{formatCurrency(falta.desconto_kz)} Kz
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-4 z-20">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-emerald-500/30 font-bold transition-all active:scale-95"
          aria-label="Registar Falta"
        >
          <Plus size={24} />
          <span>Registar Falta</span>
        </button>
      </div>

      {/* Register Absence Modal */}
      {isModalOpen && (
        <div data-testid="modal-registar-falta" className="fixed inset-0 bg-slate-900/60 flex flex-col justify-end z-50">
          <div className="bg-white rounded-t-xl overflow-hidden shadow-2xl max-w-md mx-auto w-full">
            {/* Handle */}
            <div className="flex h-6 w-full items-center justify-center">
              <div className="h-1.5 w-12 rounded-full bg-slate-200"></div>
            </div>
            
            <div className="px-6 pt-2 pb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Registar Falta</h3>
              
              <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); }}>
                {/* Date Input */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="dataFalta" className="text-sm font-semibold text-slate-700">Data</label>
                  <div className="relative flex items-center">
                    <input 
                      id="dataFalta"
                      type="date" 
                      className="w-full h-14 bg-slate-50 border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-base px-4 pr-12"
                      value={formData.dataFalta}
                      onChange={(e) => setFormData({...formData, dataFalta: e.target.value})}
                      required
                    />
                  </div>
                </div>

                {/* Type Selector */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="tipoFalta" className="text-sm font-semibold text-slate-700">Tipo</label>
                  <div className="relative">
                    <select 
                      id="tipoFalta"
                      className="w-full h-14 appearance-none bg-slate-50 border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-base px-4"
                      value={formData.tipo}
                      onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                    >
                      <option value="Motorista">Motorista</option>
                      <option value="Passageiro">Passageiro</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-4 pointer-events-none text-slate-400" size={24} />
                  </div>
                </div>

                {/* Observation */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="observacao" className="text-sm font-semibold text-slate-700">Observação (opcional)</label>
                  <textarea 
                    id="observacao"
                    className="w-full min-h-[120px] bg-slate-50 border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-base p-4 resize-none" 
                    placeholder="Adicionar notas sobre a ausência..."
                    value={formData.observacao}
                    onChange={(e) => setFormData({...formData, observacao: e.target.value})}
                  ></textarea>
                </div>

                {/* Summary Info */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-3">
                  <Info className="text-emerald-500" size={24} />
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O desconto será calculado automaticamente com base no seu percurso habitual em <span className="font-bold">Luanda</span>.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-14 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 h-14 font-semibold bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
            {/* Safe Area Bottom Spacing */}
            <div className="h-6 bg-white"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbsenceTracker;
