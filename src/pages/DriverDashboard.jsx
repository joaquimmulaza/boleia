import React, { useState, useEffect } from 'react';
import { Car, MapPin, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

/**
 * @typedef {Readonly<{}>} DriverDashboardProps
 * Page component — accepts no external props.
 */

const DriverDashboard = () => {
  const navigate = useNavigate();
  // ─── Veículo state ─────────────────────────────────────────────────────────
  const [hasVehicle, setHasVehicle] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Rotas state ────────────────────────────────────────────────────────────
  const [rotas, setRotas] = useState([]);

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

      // 3. Carrega rotas existentes do motorista
      const { data: rotasData } = await supabase
        .from('routes')
        .select('id, origin_name, destination_name, departure_time, monthly_price_per_seat')
        .eq('driver_id', idMotorista);

      if (rotasData) {
        setRotas(rotasData);
      }
      setIsLoading(false);
    };

    carregarDados();
  }, []);

  return (
    <div className="font-[Plus_Jakarta_Sans,sans-serif] min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-3 border-b border-primary/10 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Car size={22} className="text-primary" />
          </div>
          <h1 className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">Boleia Certa</h1>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Bom dia, Motorista</p>
          <p className="text-slate-900 dark:text-white text-sm font-bold">Luanda, AO</p>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 px-4 py-6 space-y-6 pb-24">

        {/* ── Card 1: Veículo Call To Action ── */}
        {!isLoading && !hasVehicle && (
          <section className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="text-amber-800 dark:text-amber-400 font-bold text-base">Veículo não registado</h3>
                  <p className="text-amber-700 dark:text-amber-500 text-sm">
                    Para começares a publicar rotas e aceitar passageiros, precisas de registar o teu veículo.
                  </p>
                  <button
                    onClick={() => navigate('/veiculo')}
                    className="mt-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-all shadow-md shadow-amber-500/20"
                  >
                    Registar Veículo Agora
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Card 2: As Minhas Rotas Diárias ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <MapPin size={20} className="text-primary" />
            <h2 className="text-slate-900 dark:text-white text-lg font-bold">As Minhas Rotas Diárias</h2>
          </div>

          <div className="space-y-4">
            {rotas.length > 0 ? (
              rotas.map((rota) => (
                <div
                  key={rota.id}
                  className="bg-white dark:bg-slate-900 rounded-xl p-5 space-y-4 border border-primary/5 dark:border-slate-800"
                  style={{ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Origem</p>
                        <p className="text-slate-900 dark:text-white font-bold text-lg">{rota.origin_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Destino</p>
                        <p className="text-slate-900 dark:text-white font-bold text-lg">{rota.destination_name}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Hora de Recolha</p>
                        <p className="text-slate-900 dark:text-white font-bold">{rota.departure_time}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Valor Mensal (Kz)</p>
                        <p className="text-primary font-bold">{rota.monthly_price_per_seat}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 text-center py-6 flex flex-col items-center gap-3 border border-primary/5 dark:border-slate-800" style={{ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <p className="text-gray-500 dark:text-slate-400 text-sm">
                  Ainda não publicaste nenhuma rota diária.
                </p>
                <button
                  onClick={() => navigate('/publicar-trajeto')}
                  className="bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all"
                >
                  Publicar Trajeto
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Action Button (FAB) para Publicar Trajeto */}
      {rotas.length > 0 && (
        <div className="fixed bottom-24 right-4 z-20">
          <button
             onClick={() => navigate('/publicar-trajeto')}
             className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-primary/30 font-bold transition-all active:scale-95"
          >
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

