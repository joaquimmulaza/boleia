import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';
import { requestSeat } from '../services/AgreementsService';

/**
 * Formats a number as Angolan Kwanza (e.g. 25000 → "25.000")
 */
const formatKwanza = (value) => {
  return Number(value).toLocaleString('pt-PT');
};

const RouteCard = ({ rota, isProcessing, isRequested, onSolicitar }) => (
  <div data-testid="route-card" className="bg-white dark:bg-slate-900 rounded-xl border-l-4 border-primary shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col transition-all">
    <div className="p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {rota.origin_name} <span className="material-symbols-outlined text-xs text-cool-gray">trending_flat</span> {rota.destination_name}
          </p>
          <div className="flex items-center gap-2 text-cool-gray dark:text-slate-400">
            <span className="material-symbols-outlined text-sm">schedule</span>
            <span className="text-xs font-medium">{rota.departure_time} - Saída diária</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-primary font-bold text-lg leading-tight">{formatKwanza(rota.monthly_price_per_seat)} Kz</p>
          <p className="text-[10px] text-cool-gray font-bold uppercase tracking-tighter">por mês</p>
        </div>
      </div>
      <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          {rota.available_seats > 1 ? (
            <>
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 overflow-hidden">
                  <span className="material-symbols-outlined text-slate-400 text-sm leading-6 flex justify-center">person</span>
                </div>
                <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-slate-400">+{rota.available_seats - 1}</span>
                </div>
              </div>
              <span className="text-[10px] font-medium text-cool-gray">divisão de custos entre passageiros</span>
            </>
          ) : (
            <>
              <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 overflow-hidden flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400 text-sm">directions_car</span>
              </div>
              <span className="text-[10px] font-medium text-cool-gray">boleia direta (1 vaga)</span>
            </>
          )}
        </div>
        
        <button
          onClick={() => onSolicitar(rota)}
          disabled={isProcessing || isRequested}
          className={`text-xs font-bold rounded-lg px-4 py-2 flex items-center justify-center gap-1.5 transition-all shadow-sm ${
            isRequested 
              ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed opacity-90'
              : 'bg-primary text-white hover:bg-primary/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed'
          }`}
        >
          {isRequested ? (
            <>
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              Aguardando Confirmação
            </>
          ) : isProcessing ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
              A processar...
            </>
          ) : (
            <>
              Solicitar Vaga
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

const PassengerDashboard = () => {
  const [pontoPartida, setPontoPartida] = useState('');
  const [pontoChegada, setPontoChegada] = useState('');
  const [rotas, setRotas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pesquisaFeita, setPesquisaFeita] = useState(false);
  const [processingRouteIds, setProcessingRouteIds] = useState(new Set());
  const [requestedRouteIds, setRequestedRouteIds] = useState(new Set());
  const [toastMessage, setToastMessage] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (mapRef.current) return;
    
    import('maplibre-gl').then((module) => {
      const maplibregl = module.default;
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [13.2343, -8.8368], // Luanda
        zoom: 12
      });
    }).catch((err) => {
      console.error('Error initializing map:', err);
    });
  }, []);

  const handlePesquisar = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setPesquisaFeita(false);

    let query = supabase
      .from('routes')
      .select('id, origin_name, destination_name, departure_time, return_time, available_seats, monthly_price_per_seat')
      .gt('available_seats', 0);
      
    if (pontoPartida) {
      query = query.ilike('origin_name', `%${pontoPartida}%`);
    }
    if (pontoChegada) {
      query = query.ilike('destination_name', `%${pontoChegada}%`);
    }

    const { data, error } = await query;
    const filtered = error || !data ? [] : data;

    setIsLoading(false);
    setPesquisaFeita(true);
    setRotas(filtered);
    
    if (mapRef.current && filtered.length > 0) {
      import('maplibre-gl').then((module) => {
        const maplibregl = module.default;
        
        filtered.forEach((r) => {
          const lng = 13.2343 + (Math.random() - 0.5) * 0.1;
          const lat = -8.8368 + (Math.random() - 0.5) * 0.1;
          
          new maplibregl.Marker({ color: '#22C55E' }) // Primary
            .setLngLat([lng, lat])
            .addTo(mapRef.current);
        });
      }).catch((err) => {
        console.error('Error loading markers:', err);
      });
    }
  };

  const handleSolicitarVaga = useCallback(async (rota) => {
    setProcessingRouteIds((prev) => new Set(prev).add(rota.id));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await requestSeat(rota.id, user.id);

      setRequestedRouteIds((prev) => new Set(prev).add(rota.id));
    } catch (_err) {
      setToastMessage('Erro ao solicitar vaga. Tenta novamente.');
    } finally {
      setProcessingRouteIds((prev) => {
        const next = new Set(prev);
        next.delete(rota.id);
        return next;
      });
    }
  }, []);

  return (
    <>
      <div className="relative mx-auto max-w-md min-h-screen bg-background-light dark:bg-background-dark flex flex-col font-sans text-dark-charcoal dark:text-slate-100 antialiased overflow-x-hidden">
        
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-primary/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">directions_car</span>
            </div>
            <h1 className="text-dark-charcoal dark:text-white font-bold text-lg tracking-tight">Boleia Certa</h1>
          </div>
          <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
            <span className="material-symbols-outlined text-primary text-sm">location_on</span>
            <span className="text-primary text-xs font-bold uppercase tracking-wider">Luanda, AO</span>
          </div>
        </header>

        {/* Map Header / Hero */}
        <section 
          className="relative h-[30vh] md:h-[35vh] w-full flex items-center justify-center overflow-hidden bg-slate-200" 
          data-location="Luanda, Angola"
          data-testid="map-container"
          ref={mapContainerRef}
        >
          {/* O maplibregl vai injectar o mapa no ref acima. Fica o placeholder vazio visualmente aqui. */}
        </section>

        {/* Floating Search Card */}
        <section className="relative px-4 -mt-16 z-20">
          <form 
            onSubmit={handlePesquisar}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-primary/5 dark:border-slate-800 p-5 space-y-4"
          >
            <div className="space-y-3">
              <div className="relative flex items-center">
                <div className="absolute left-3 flex flex-col items-center gap-1 z-10">
                  <span className="material-symbols-outlined text-primary text-lg">radio_button_checked</span>
                  <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700"></div>
                  <span className="material-symbols-outlined text-slate-400 text-lg">location_on</span>
                </div>
                <div className="flex-1 space-y-2 ml-10 relative">
                  <div>
                    <input 
                      className="w-full bg-light-gray dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none text-dark-charcoal dark:text-slate-100 placeholder-cool-gray" 
                      placeholder="Ponto de Partida" 
                      type="text" 
                      value={pontoPartida}
                      onChange={(e) => setPontoPartida(e.target.value)}
                    />
                  </div>
                  <div>
                    <input 
                      className="w-full bg-light-gray dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none text-dark-charcoal dark:text-slate-100 placeholder-cool-gray" 
                      placeholder="Ponto de Chegada" 
                      type="text" 
                      value={pontoChegada}
                      onChange={(e) => setPontoChegada(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">search</span>
              {isLoading ? 'A procurar...' : 'Procurar Boleia'}
            </button>
          </form>
        </section>

        {/* Route Results */}
        <main className="flex-1 px-4 mt-8 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-dark-charcoal dark:text-white font-bold text-lg">Rotas Disponíveis</h3>
            {pesquisaFeita && (
              <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded">
                {rotas.length} Encontrada{rotas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div data-testid="route-results-list" className="space-y-4">
            {rotas.map((rota) => (
              <RouteCard
                key={rota.id}
                rota={rota}
                isProcessing={processingRouteIds.has(rota.id)}
                isRequested={requestedRouteIds.has(rota.id)}
                onSolicitar={handleSolicitarVaga}
              />
            ))}

            {pesquisaFeita && rotas.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center opacity-80">
                <div className="bg-primary/10 p-4 rounded-full mb-3">
                  <span className="material-symbols-outlined text-3xl text-primary">location_off</span>
                </div>
                <p className="text-dark-charcoal dark:text-white font-semibold text-sm">
                  Nenhuma rota encontrada
                </p>
                <p className="text-cool-gray text-xs mt-1">
                  Tenta outros pontos de partida ou chegada.
                </p>
              </div>
            )}

            {!pesquisaFeita && (
              <div className="flex flex-col items-center py-10 text-center opacity-80">
                <div className="bg-primary/5 p-4 rounded-full mb-3">
                  <span className="material-symbols-outlined text-3xl text-primary/60">search_hands_free</span>
                </div>
                <p className="text-dark-charcoal dark:text-white font-semibold text-sm">
                  Procura a tua boleia
                </p>
                <p className="text-cool-gray text-xs mt-1">
                  Indica a tua origem e destino para ver opções.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {toastMessage && (
        <div
          role="alert"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl animate-[bounce_1s_ease-in-out_infinite]"
          style={{ maxWidth: '90vw' }}
        >
          <span className="material-symbols-outlined text-lg">error</span>
          {toastMessage}
        </div>
      )}
    </>
  );
};

export default PassengerDashboard;
