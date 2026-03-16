import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, Clock, ChevronRight } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';

/**
 * @typedef {Readonly<{}>} PassengerDashboardProps
 * Page component — accepts no external props.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a number as Angolan Kwanza (e.g. 25000 → "25.000 Kz/mês")
 * @param {number} value
 * @returns {string}
 */
const formatKwanza = (value) => {
  return `${Number(value).toLocaleString('pt-PT')} Kz/mês`;
};

// ─────────────────────────────────────────────────────────────────────────────
// RouteCard sub-component
// ─────────────────────────────────────────────────────────────────────────────
const RouteCard = ({ rota }) => (
  <div
    data-testid="route-card"
    className="bg-white rounded-xl overflow-hidden flex items-stretch"
    style={{
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      borderLeft: '4px solid #10B981',
    }}
  >
    {/* Main content */}
    <div className="flex-1 p-4 space-y-2">
      {/* Route origin → destination */}
      <div className="flex items-center gap-2">
        <Navigation size={15} className="text-emerald-500 shrink-0" />
        <p className="text-[#1A202C] font-bold text-sm leading-tight">
          {rota.origin_name}
          <span className="text-[#718096] font-normal mx-1">→</span>
          {rota.destination_name}
        </p>
      </div>

      {/* Pickup and Return time */}
      <div className="flex items-center gap-1.5 focus:outline-none">
        <Clock size={13} className="text-[#718096]" />
        <span className="text-[#718096] text-xs">{rota.departure_time} - {rota.return_time}</span>
      </div>

      {/* Price */}
      <div>
        <p className="text-emerald-500 font-extrabold text-base leading-tight">
          {formatKwanza(rota.monthly_price_per_seat)}
        </p>
        <p className="text-[#718096] text-[11px] mt-0.5">
          por lugar na viatura
        </p>
      </div>
    </div>

    {/* Chevron and Button */}
    <div className="flex flex-col items-end justify-center px-4 py-2 gap-2">
      <button className="bg-emerald-500 text-white font-semibold text-xs rounded-lg px-4 py-2 hover:bg-emerald-600 transition-colors shadow-sm active:scale-95">
        Solicitar Vaga
      </button>
      <ChevronRight size={18} className="text-[#CBD5E0]" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const PassengerDashboard = () => {
  const [pontoPartida, setPontoPartida] = useState('');
  const [pontoChegada, setPontoChegada] = useState('');
  const [rotas, setRotas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pesquisaFeita, setPesquisaFeita] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;
    
    import('maplibre-gl').then((module) => {
      const maplibregl = module.default;
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [13.2343, -8.8368],
        zoom: 12
      });
    }).catch(() => {});
  }, []);

  // ─── Pesquisa no Supabase ──────────────────────────────────────────────────
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
    
    // Add markers to the map if it exists
    if (mapRef.current && filtered.length > 0) {
      import('maplibre-gl').then((module) => {
        const maplibregl = module.default;
        
        filtered.forEach((r, idx) => {
          // Mock coordinates around Luanda
          const lng = 13.2343 + (Math.random() - 0.5) * 0.1;
          const lat = -8.8368 + (Math.random() - 0.5) * 0.1;
          
          new maplibregl.Marker({ color: '#10B981' })
            .setLngLat([lng, lat])
            .addTo(mapRef.current);
        });
      }).catch(() => {});
    }
  };

  return (
    <div
      className="font-[Plus_Jakarta_Sans,sans-serif] min-h-screen bg-[#F7F8FA] text-gray-800 antialiased flex flex-col"
    >
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/10 p-1.5 rounded-lg">
            <Navigation size={20} className="text-emerald-500" />
          </div>
          <h1 className="text-[#1A202C] text-base font-bold tracking-tight">
            Boleia Certa
          </h1>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full">
          <MapPin size={12} className="text-emerald-500" />
          <span className="text-emerald-700 text-xs font-semibold">Luanda, AO</span>
        </div>
      </header>

      {/* ── Map Placeholder ── */}
      <div
        data-testid="map-container"
        ref={mapContainerRef}
        className="relative w-full bg-[#E2E8F0]"
        style={{ minHeight: '45vw', maxHeight: '260px', height: '45vw' }}
        aria-label="Mapa"
      />

      {/* ── Floating Search Card ── */}
      <div className="px-4 -mt-5 z-20 relative">
        <form
          onSubmit={handlePesquisar}
          className="bg-white rounded-2xl p-4 space-y-3"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
        >
          {/* Ponto de Partida */}
          <div className="space-y-1">
            <label
              htmlFor="pontoPartida"
              className="text-[#1A202C] text-xs font-semibold flex items-center gap-1"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Ponto de Partida
            </label>
            <input
              id="pontoPartida"
              type="text"
              className="w-full bg-[#F7F8FA] rounded-xl h-11 px-4 text-[#1A202C] text-sm focus:ring-2 focus:ring-emerald-500/40 transition-all outline-none placeholder-[#A0AEC0] border border-transparent focus:border-emerald-300"
              placeholder="ex: Talatona"
              value={pontoPartida}
              onChange={(e) => setPontoPartida(e.target.value)}
            />
          </div>

          {/* Ponto de Chegada */}
          <div className="space-y-1">
            <label
              htmlFor="pontoChegada"
              className="text-[#1A202C] text-xs font-semibold flex items-center gap-1"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              Ponto de Chegada
            </label>
            <input
              id="pontoChegada"
              type="text"
              className="w-full bg-[#F7F8FA] rounded-xl h-11 px-4 text-[#1A202C] text-sm focus:ring-2 focus:ring-emerald-500/40 transition-all outline-none placeholder-[#A0AEC0] border border-transparent focus:border-emerald-300"
              placeholder="ex: Maianga"
              value={pontoChegada}
              onChange={(e) => setPontoChegada(e.target.value)}
            />
          </div>

          {/* Search button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Search size={16} />
            {isLoading ? 'A procurar...' : 'Procurar Boleia'}
          </button>
        </form>
      </div>

      {/* ── Route Results ── */}
      <main className="flex-1 px-4 pt-5 pb-24 space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[#1A202C] text-sm font-bold">Rotas Disponíveis</h2>
          {pesquisaFeita && (
            <span className="text-[#718096] text-xs">
              {rotas.length} resultado{rotas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Results list */}
        <div data-testid="route-results-list" className="space-y-3">
          {rotas.map((rota) => (
            <RouteCard key={rota.id} rota={rota} />
          ))}

          {/* Empty state - only after a search */}
          {pesquisaFeita && rotas.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="bg-[#E2E8F0] p-4 rounded-full mb-3">
                <MapPin size={28} className="text-[#A0AEC0]" />
              </div>
              <p className="text-[#1A202C] font-semibold text-sm">
                Nenhuma rota encontrada
              </p>
              <p className="text-[#718096] text-xs mt-1">
                Tenta outros pontos de partida ou chegada.
              </p>
            </div>
          )}

          {/* Placeholder cards before search */}
          {!pesquisaFeita && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="bg-emerald-50 p-4 rounded-full mb-3">
                <Search size={28} className="text-emerald-400" />
              </div>
              <p className="text-[#1A202C] font-semibold text-sm">
                Pesquisa uma rota
              </p>
              <p className="text-[#718096] text-xs mt-1">
                Indica o teu ponto de partida e chegada para ver boleias disponíveis.
              </p>
            </div>
          )}
        </div>
      </main>

    </div>
  );
};

export default PassengerDashboard;
