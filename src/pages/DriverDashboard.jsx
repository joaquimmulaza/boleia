import React, { useState, useEffect } from 'react';
import { Car, MapPin, Truck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

/**
 * @typedef {Readonly<{}>} DriverDashboardProps
 * Page component — accepts no external props.
 */

const DriverDashboard = () => {
  const navigate = useNavigate();
  // ─── Veículo state ─────────────────────────────────────────────────────────
  const [hasVehicle, setHasVehicle] = useState(true); // Assume true initially to avoid flicker, or false and handle loading state
  const [isLoading, setIsLoading] = useState(true);

  // ─── Rota state ────────────────────────────────────────────────────────────
  const [pontoPartida, setPontoPartida] = useState('');
  const [pontoChegada, setPontoChegada] = useState('');
  const [horaRecolha, setHoraRecolha] = useState('');
  const [valorMensal, setValorMensal] = useState('');

  // ─── Carrega dados existentes ao montar o componente ───────────────────────
  useEffect(() => {
    const carregarDados = async () => {
      setIsLoading(true);
      // 1. Verifica o utilizador autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setIsLoading(false);
        return;
      }

      const idMotorista = user.id;

      // 2. Carrega veículo existente (se houver)
      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('id')
        .eq('id_motorista', idMotorista);

      if (veiculosData && veiculosData.length > 0) {
        setHasVehicle(true);
      } else {
        setHasVehicle(false);
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
      setIsLoading(false);
    };

    carregarDados();
  }, []);

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

        {/* ── Card 1: Veículo Call To Action ── */}
        {!isLoading && !hasVehicle && (
          <section className="space-y-3">
            <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="text-amber-800 font-bold text-base">Veículo não registado</h3>
                  <p className="text-amber-700 text-sm">
                    Para começares a publicar rotas e aceitar passageiros, precisas de registar o teu veículo.
                  </p>
                  <button
                    onClick={() => navigate('/vehicle-setup')}
                    className="mt-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-all shadow-md shadow-amber-500/20"
                  >
                    Registar Veículo Agora
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

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
              <div className="text-center py-6 flex flex-col items-center gap-3">
                <p className="text-gray-500 text-sm">
                  Ainda não publicaste nenhuma rota diária.
                </p>
                <button
                  onClick={() => navigate('/publicar-trajeto')}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all"
                >
                  Publicar Trajeto
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Action Button (FAB) para Publicar Trajeto */}
      {pontoPartida && (
        <div className="fixed bottom-24 right-4 z-20">
          <button
             onClick={() => navigate('/publicar-trajeto')}
             className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-emerald-500/30 font-bold transition-all active:scale-95"
          >
            {/* fallback since material-symbols-outlined may not exist, maybe lucide MapPin */}
            <MapPin size={20} />
            <span>Nova Rota</span>
          </button>
        </div>
      )}

      {/* Safe Area bottom space for navigation (nav is normally in Layout, keeping space here) */}
      <div className="h-24"></div>
    </div>
  );
};

export default DriverDashboard;
