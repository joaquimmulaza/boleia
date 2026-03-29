import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const VehicleSetup = () => {
  const [marcaModelo, setMarcaModelo] = useState('');
  const [matricula, setMatricula] = useState('');
  const [lugaresDisponiveis, setLugaresDisponiveis] = useState('');
  const [feedbackVeiculo, setFeedbackVeiculo] = useState({ type: '', message: '' });
  const [isLoadingVeiculo, setIsLoadingVeiculo] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const carregarDados = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('marca_modelo, matricula, lugares_disponiveis')
        .eq('id_motorista', user.id);

      if (veiculosData && veiculosData.length > 0) {
        const v = veiculosData[0];
        setMarcaModelo(v.marca_modelo ?? '');
        setMatricula(v.matricula ?? '');
        setLugaresDisponiveis(String(v.lugares_disponiveis ?? ''));
      }
    };

    carregarDados();
  }, []);

  const handleGuardarVeiculo = async (e) => {
    e.preventDefault();
    setFeedbackVeiculo({ type: '', message: '' });
    setIsLoadingVeiculo(true);

    const { error } = await supabase.from('veiculos').insert([
      {
        marca_modelo: marcaModelo,
        matricula,
        lugares_disponiveis: parseInt(lugaresDisponiveis, 10),
      },
    ]);

    setIsLoadingVeiculo(false);

    if (error) {
      setFeedbackVeiculo({ type: 'error', message: getFriendlyErrorMessage(error) });
    } else {
      setFeedbackVeiculo({ type: 'success', message: 'Veículo guardado com sucesso!' });
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-dark-charcoal min-h-screen antialiased">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">


        <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
          <section className="space-y-6">
            <div className="text-center space-y-2 mb-2">
              <h2 className="text-dark-charcoal dark:text-slate-100 text-2xl font-bold">O Meu Veículo</h2>
              <p className="text-cool-gray dark:text-slate-400 text-sm">Mantenha os dados do seu veículo atualizados para as suas boleias.</p>
            </div>

            <form onSubmit={handleGuardarVeiculo} className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] space-y-5 border border-primary/5">
              
              <div className="space-y-1.5">
                <label htmlFor="marcaModelo" className="text-dark-charcoal dark:text-slate-300 text-sm font-semibold px-1">Marca/Modelo</label>
                <input 
                  id="marcaModelo"
                  type="text"
                  value={marcaModelo}
                  onChange={(e) => setMarcaModelo(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border-none rounded-lg h-12 px-4 text-dark-charcoal dark:text-slate-100 focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-cool-gray outline-none"
                  placeholder="Ex: Toyota Fortuner"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="matricula" className="text-dark-charcoal dark:text-slate-300 text-sm font-semibold px-1">Matrícula</label>
                <input 
                  id="matricula"
                  type="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border-none rounded-lg h-12 px-4 text-dark-charcoal dark:text-slate-100 focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-cool-gray outline-none"
                  placeholder="Ex: LD-00-00-AA"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="lugaresDisponiveis" className="text-dark-charcoal dark:text-slate-300 text-sm font-semibold px-1">Lugares Disponíveis</label>
                <div className="relative">
                  <input 
                    id="lugaresDisponiveis"
                    type="number"
                    min="1"
                    value={lugaresDisponiveis}
                    onChange={(e) => setLugaresDisponiveis(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border-none rounded-lg h-12 px-4 pr-10 text-dark-charcoal dark:text-slate-100 focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-cool-gray outline-none"
                    placeholder="4"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-cool-gray pointer-events-none">event_seat</span>
                </div>
              </div>

              {feedbackVeiculo.message && (
                <div
                  role="alert"
                  className={`rounded-lg px-4 py-3 text-sm font-medium text-center ${
                    feedbackVeiculo.type === 'error'
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {feedbackVeiculo.message}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoadingVeiculo}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg transition-all active:scale-[0.98] mt-4 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoadingVeiculo ? 'A guardar...' : 'Guardar Veículo'}
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 text-cool-gray dark:text-slate-500 py-4">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <p className="text-[11px] font-medium uppercase tracking-wider">Dados seguros em Luanda</p>
            </div>
          </section>
        </main>
        
        {/* Safe Area bottom space for navigation (nav is normally in Layout, keeping space here) */}
        <div className="h-24"></div>
      </div>
    </div>
  );
};

export default VehicleSetup;
