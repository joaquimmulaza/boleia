import React, { useState, useEffect } from 'react';
import { Car, MapPin, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * @typedef {Readonly<{}>} DriverDashboardProps
 * Page component — accepts no external props.
 */

const DriverDashboard = () => {
  // ─── Veículo state ─────────────────────────────────────────────────────────
  const [marcaModelo, setMarcaModelo] = useState('');
  const [matricula, setMatricula] = useState('');
  const [lugaresDisponiveis, setLugaresDisponiveis] = useState('');
  const [feedbackVeiculo, setFeedbackVeiculo] = useState({ type: '', message: '' });
  const [isLoadingVeiculo, setIsLoadingVeiculo] = useState(false);

  // ─── Rota state ────────────────────────────────────────────────────────────
  const [pontoPartida, setPontoPartida] = useState('');
  const [pontoChegada, setPontoChegada] = useState('');
  const [horaRecolha, setHoraRecolha] = useState('');
  const [valorMensal, setValorMensal] = useState('');
  const [feedbackRota, setFeedbackRota] = useState({ type: '', message: '' });
  const [isLoadingRota, setIsLoadingRota] = useState(false);

  // ─── Carrega dados existentes ao montar o componente ───────────────────────
  useEffect(() => {
    const carregarDados = async () => {
      // 1. Verifica o utilizador autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const idMotorista = user.id;

      // 2. Carrega veículo existente (se houver)
      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('marca_modelo, matricula, lugares_disponiveis')
        .eq('id_motorista', idMotorista);

      if (veiculosData && veiculosData.length > 0) {
        const v = veiculosData[0];
        setMarcaModelo(v.marca_modelo ?? '');
        setMatricula(v.matricula ?? '');
        setLugaresDisponiveis(String(v.lugares_disponiveis ?? ''));
      }

      // 3. Carrega rota existente (se houver)
      const { data: rotasData } = await supabase
        .from('routes')
        .select('origin_name, destination_name, departure_time, monthly_price_per_seat')
        .eq('driver_id', idMotorista);

      if (rotasData && rotasData.length > 0) {
        const r = rotasData[0];
        setPontoPartida(r.origin_name ?? '');
        setPontoChegada(r.destination_name ?? '');
        setHoraRecolha(r.departure_time ?? '');
        setValorMensal(String(r.monthly_price_per_seat ?? ''));
      }
    };

    carregarDados();
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────
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
      setFeedbackVeiculo({ type: 'error', message: error.message });
    } else {
      setFeedbackVeiculo({ type: 'success', message: 'Veículo guardado com sucesso!' });
    }
  };

  // A rota é agora read-only (os dados de criação estão no ecrã Publish Route)

  return (
    <div className="font-[Plus_Jakarta_Sans,sans-serif] min-h-screen bg-[#F2F4F7] text-gray-800 antialiased">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-white/80 backdrop-blur-md px-4 py-3 border-b border-emerald-500/10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/10 p-2 rounded-lg">
            <Car size={22} className="text-emerald-500" />
          </div>
          <h1 className="text-[#1A202C] text-lg font-bold tracking-tight">Boleia Certa</h1>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[#718096] text-xs font-medium">Bom dia, Motorista</p>
          <p className="text-[#1A202C] text-sm font-bold">Luanda, AO</p>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 px-4 py-6 space-y-6 pb-24">

        {/* ── Card 1: O Meu Veículo ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Truck size={20} className="text-emerald-500" />
            <h2 className="text-[#1A202C] text-lg font-bold">O Meu Veículo</h2>
          </div>

          <form
            onSubmit={handleGuardarVeiculo}
            className="bg-white rounded-xl p-5 space-y-4 border border-emerald-500/5"
            style={{ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}
          >
            {/* Marca/Modelo */}
            <div className="space-y-1">
              <label
                htmlFor="marcaModelo"
                className="text-[#1A202C] text-sm font-semibold px-1"
              >
                Marca/Modelo
              </label>
              <input
                id="marcaModelo"
                type="text"
                className="w-full bg-[#F7F8FA] border-none rounded-lg h-12 px-4 text-[#1A202C] focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none placeholder-[#718096]"
                placeholder="ex: Toyota Corolla"
                value={marcaModelo}
                onChange={(e) => setMarcaModelo(e.target.value)}
                required
              />
            </div>

            {/* Matrícula */}
            <div className="space-y-1">
              <label
                htmlFor="matricula"
                className="text-[#1A202C] text-sm font-semibold px-1"
              >
                Matrícula
              </label>
              <input
                id="matricula"
                type="text"
                className="w-full bg-[#F7F8FA] border-none rounded-lg h-12 px-4 text-[#1A202C] focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none placeholder-[#718096]"
                placeholder="ex: LD-00-00-AA"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                required
              />
            </div>

            {/* Lugares Disponíveis */}
            <div className="space-y-1">
              <label
                htmlFor="lugaresDisponiveis"
                className="text-[#1A202C] text-sm font-semibold px-1"
              >
                Lugares Disponíveis
              </label>
              <input
                id="lugaresDisponiveis"
                type="number"
                min="1"
                max="9"
                className="w-full bg-[#F7F8FA] border-none rounded-lg h-12 px-4 text-[#1A202C] focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none placeholder-[#718096]"
                placeholder="ex: 3"
                value={lugaresDisponiveis}
                onChange={(e) => setLugaresDisponiveis(e.target.value)}
                required
              />
            </div>

            {/* Feedback Veículo */}
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
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold py-4 rounded-lg transition-all mt-2 shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoadingVeiculo ? 'A guardar...' : 'Guardar Veículo'}
            </button>
          </form>
        </section>

        {/* ── Card 2: A Minha Rota Diária ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <MapPin size={20} className="text-emerald-500" />
            <h2 className="text-[#1A202C] text-lg font-bold">A Minha Rota Diária</h2>
          </div>

          <div
            className="bg-white rounded-xl p-5 space-y-4 border border-emerald-500/5"
            style={{ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}
          >
            {pontoPartida ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Origem</p>
                    <p className="text-[#1A202C] font-bold text-lg">{pontoPartida}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Destino</p>
                    <p className="text-[#1A202C] font-bold text-lg">{pontoChegada}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-[#F7F8FA] p-3 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Hora de Recolha</p>
                    <p className="text-[#1A202C] font-bold">{horaRecolha}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Valor Mensal (Kz)</p>
                    <p className="text-emerald-600 font-bold">{valorMensal}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                Ainda não publicaste nenhuma rota diária.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default DriverDashboard;
