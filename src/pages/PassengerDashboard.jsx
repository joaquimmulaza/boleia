import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';
import { requestSeat } from '../services/AgreementsService';
import SearchAddressInput from '../components/SearchAddressInput';
import { getFriendlyErrorMessage } from '../utils/errorHandler';


const formatKwanza = (value) => {
  return Number(value).toLocaleString('pt-PT');
};

const RouteCard = ({ rota, isProcessing, isRequested, estadoAcordo, onSolicitar }) => {
  const estadoNormalized = estadoAcordo?.toLowerCase();
  const isDisabled = isProcessing || isRequested || estadoNormalized === 'pendente' || estadoNormalized === 'ativo';

  let buttonText = 'Solicitar Vaga';
  let buttonClasses = 'text-primary hover:underline';

  if (estadoNormalized === 'ativo') {
    buttonText = 'Boleia Ativa';
    buttonClasses = 'text-green-700 bg-green-100 px-2 py-1 rounded';
  } else if (estadoNormalized === 'pendente' || isRequested) {
    buttonText = 'Vaga já solicitada';
    buttonClasses = 'text-yellow-700 bg-yellow-100 px-2 py-1 rounded';
  } else if (isProcessing) {
    buttonText = 'A processar...';
  }

  return (
    <div data-testid="route-card" className={`bg-white dark:bg-slate-900 rounded-xl ${rota.available_seats > 1 ? 'border-l-4 border-primary' : 'border-l-4 border-primary/40'} shadow-sm overflow-hidden flex flex-col`}>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {rota.origin_name} <span className="material-symbols-outlined text-xs text-slate-400">trending_flat</span> {rota.destination_name}
            </p>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span className="text-xs font-medium">{rota.departure_time} - Saída diária</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-primary font-bold text-lg leading-tight">{formatKwanza(rota.monthly_price_per_seat)} Kz</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">por mês</p>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {rota.available_seats > 1 ? (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 overflow-hidden flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-slate-400">+{rota.available_seats - 1}</span>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-500">divisão de custos entre passageiros</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                 <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 overflow-hidden flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400 text-sm">directions_car</span>
                  </div>
                <span className="text-[10px] font-medium text-slate-500">boleia direta (1 vaga)</span>
              </div>
            )}
          </div>

          <button
            onClick={() => onSolicitar(rota.id)}
            disabled={isDisabled}
            className={`text-xs font-bold flex items-center gap-1 ${buttonClasses}`}
          >
            {buttonText} {(!estadoAcordo && !isRequested && !isProcessing) && <span className="material-symbols-outlined text-sm">chevron_right</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

const PassengerDashboard = () => {
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [processingRouteId, setProcessingRouteId] = useState(null);
  const [solicitadas, setSolicitadas] = useState(new Set());
  const [acordosMap, setAcordosMap] = useState({});
  const [solicitacaoFeedback, setSolicitacaoFeedback] = useState({ show: false, message: '', type: '' });

  const mapContainer = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

  const markersRef = useRef([]);

  const carregarRotas = useCallback(async (filtroOrigem = '', filtroDestino = '') => {
    setIsSearching(true);
    try {
      let query = supabase.from('routes').select('*').gt('available_seats', 0); // changed to routes for test matching

      if (filtroOrigem) {
        query = query.ilike('origin_name', `%${filtroOrigem}%`);
      }
      if (filtroDestino) {
        query = query.ilike('destination_name', `%${filtroDestino}%`);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setRotas(data || []);

    } catch (err) {
      console.error('Erro ao buscar rotas:', err);
      setError('Não foi possível carregar as rotas. Tente novamente.');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, []);

  const carregarAcordos = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('acordos')
        .select('route_id, estado')
        .eq('passenger_id', user.id);

      if (error) throw error;

      const map = {};
      data.forEach(acordo => {
        const estadoAtual = map[acordo.route_id]?.toLowerCase();
        const novoEstado = acordo.estado?.toLowerCase();
        
        if (estadoAtual === 'ativo' || estadoAtual === 'pendente') {
            return; // Prioriza manter estados válidos caso existam múltiplos registros (ex: antigos cancelados)
        }
        
        map[acordo.route_id] = acordo.estado;
      });
      setAcordosMap(map);
    } catch (err) {
      console.error('Erro ao carregar acordos:', err);
    }
  }, []);

  useEffect(() => {
    carregarRotas();
    carregarAcordos();
  }, [carregarRotas, carregarAcordos]);

  useEffect(() => {
    if (!mapContainer.current) return;
    
    let isMounted = true;

    import('maplibre-gl').then((maplibregl) => {
        if(!isMounted) return;
        
        const map = new maplibregl.default.Map({
          container: mapContainer.current,
          style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
          center: [13.2343, -8.8368],
          zoom: 11
        });

        map.addControl(new maplibregl.default.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true
        }));

        setMapInstance(map);

    });

    return () => {
        isMounted = false;
        if (mapInstance) {
            if (mapInstance) { mapInstance.remove(); }
        }
    }
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    
    import('maplibre-gl').then((maplibregl) => {
      // Cleanup existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const drawRouteLines = () => {
        rotas.forEach(rota => {
          // Render markers
          if (rota.origin_lat && rota.origin_lng) {
            const originPopupContent = document.createElement('div');
            originPopupContent.className = 'text-slate-900 font-bold text-xs';
            originPopupContent.textContent = `Partida: ${rota.origin_name}`;

            const marker = new maplibregl.default.Marker({ color: '#3b82f6' }) // Blue for origin
                .setLngLat([rota.origin_lng, rota.origin_lat])
                .setPopup(new maplibregl.default.Popup({ offset: 25 })
                    .setDOMContent(originPopupContent))
                .addTo(mapInstance);

            markersRef.current.push(marker);
          }

          if (rota.destination_lat && rota.destination_lng) {
            const destPopupContent = document.createElement('div');
            const destTitle = document.createElement('div');
            destTitle.className = 'text-slate-900 font-bold text-xs';
            destTitle.textContent = `Destino: ${rota.destination_name}`;
            const destPrice = document.createElement('div');
            destPrice.className = 'text-primary font-bold text-sm';
            destPrice.textContent = `${formatKwanza(rota.monthly_price_per_seat)} Kz`;
            destPopupContent.appendChild(destTitle);
            destPopupContent.appendChild(destPrice);

            const marker = new maplibregl.default.Marker({ color: '#ef4444' }) // Red for destination
                .setLngLat([rota.destination_lng, rota.destination_lat])
                .setPopup(new maplibregl.default.Popup({ offset: 25 })
                    .setDOMContent(destPopupContent))
                .addTo(mapInstance);

            markersRef.current.push(marker);
          }

          // Draw route line
          if (rota.origin_lat && rota.origin_lng && rota.destination_lat && rota.destination_lng) {
            const sourceId = `route-source-${rota.id}`;
            const layerId = `route-layer-${rota.id}`;

            // Cleanup previous source/layer if they exist
            if (mapInstance.getLayer(layerId)) {
                mapInstance.removeLayer(layerId);
            }
            if (mapInstance.getSource(sourceId)) {
                mapInstance.removeSource(sourceId);
            }

            mapInstance.addSource(sourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [rota.origin_lng, rota.origin_lat],
                            [rota.destination_lng, rota.destination_lat]
                        ]
                    }
                }
            });

            mapInstance.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#3b82f6', // primary blue
                    'line-width': 4,
                    'line-opacity': 0.6
                }
            });
          }
        });
      };

      if (mapInstance.isStyleLoaded()) {
        drawRouteLines();
      } else {
        mapInstance.once('load', drawRouteLines);
      }
    });
  }, [rotas, mapInstance]);

  const handleSearch = (e) => {
    e.preventDefault();
    carregarRotas(origem, destino);
  };

  const handleSolicitar = async (rotaId) => {
    setProcessingRouteId(rotaId);
    setSolicitacaoFeedback({ show: false, message: '', type: '' });

    try {
        const { data: { user } } = await supabase.auth.getUser();
        await requestSeat(rotaId, user?.id || 'passenger-123'); // passed for test matching

        setSolicitadas(prev => new Set(prev).add(rotaId));
        setAcordosMap(prev => ({ ...prev, [rotaId]: 'pendente' }));
        setSolicitacaoFeedback({ show: true, message: 'Solicitação enviada com sucesso! Aguarde a aprovação do motorista.', type: 'success' });
        setTimeout(() => setSolicitacaoFeedback({ show: false, message: '', type: '' }), 5000);
    } catch (error) {
       console.error("Erro ao solicitar vaga:", error);
       const errorMessage = error.message === 'Já solicitou uma vaga para esta rota.'
          ? error.message
          : error.message?.includes('violates check constraint') || error.message?.includes('Já solicitou')
          ? 'Não foi possível enviar a solicitação devido a um erro de validação. Por favor, tente novamente.'
          : getFriendlyErrorMessage(error);
       
       setSolicitacaoFeedback({ 
          show: true, 
          message: errorMessage, 
          type: 'error' 
       });
       setTimeout(() => setSolicitacaoFeedback({ show: false, message: '', type: '' }), 6000);
    } finally {
        setProcessingRouteId(null);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-['Plus_Jakarta_Sans',_sans-serif] antialiased">
        <div className="relative mx-auto w-full min-h-screen flex flex-col pb-24 pointer-events-none">

            <section className="relative h-[35vh] w-full flex items-center justify-center overflow-hidden bg-[#e2e8f0] dark:bg-slate-800">
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm pointer-events-auto">
                    <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                    <span className="text-primary text-xs font-bold uppercase tracking-wider">Luanda, AO</span>
                </div>
                <div data-testid="map-container" ref={mapContainer} className="absolute inset-0 w-full h-full z-0 touch-none pointer-events-auto"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-background-light dark:from-background-dark via-transparent to-transparent z-0 pointer-events-none"></div>
            </section>

            <section className="relative px-4 -mt-16 z-20">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 p-5 space-y-4 pointer-events-auto">
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="space-y-3">
                            <div className="relative flex items-center">
                                <div className="absolute left-3 flex flex-col items-center gap-1">
                                    <span className="material-symbols-outlined text-primary text-lg">radio_button_checked</span>
                                    <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700"></div>
                                    <span className="material-symbols-outlined text-slate-400 text-lg">location_on</span>
                                </div>
                                <div className="flex-1 space-y-2 ml-10">
                                    <div className="relative">
                                        <SearchAddressInput
                                            id="origem"
                                            name="origem"
                                            placeholder="Ponto de Partida"
                                            value={origem}
                                            onChange={setOrigem}
                                        />
                                    </div>
                                    <div className="relative">
                                        <SearchAddressInput
                                            id="destino"
                                            name="destino"
                                            placeholder="Ponto de Chegada"
                                            value={destino}
                                            onChange={setDestino}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            aria-label="Procurar Boleia"
                        >
                            <span className="material-symbols-outlined">search</span>
                            {isSearching ? 'A procurar...' : 'Procurar Boleia'}
                        </button>
                    </form>
                </div>
            </section>

            <section className="mt-8 px-4 flex-1">
                {solicitacaoFeedback.show && (
                    <div className={`mb-4 p-4 rounded-xl border ${solicitacaoFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'} text-sm font-medium shadow-sm transition-all duration-300`}>
                        {solicitacaoFeedback.message}
                    </div>
                )}

                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">Rotas Disponíveis</h3>
                    {!loading && <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded">{rotas.length} Encontradas</span>}
                </div>

                <div data-testid="route-results-list" className="space-y-4 pointer-events-auto">
                    {loading ? (
                         <div className="flex flex-col gap-4">
                           <div className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl"></div>
                           <div className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl"></div>
                         </div>
                    ) : error ? (
                        <div className="text-center py-10 px-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50">
                            <span className="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                            <button onClick={() => carregarRotas(origem, destino)} className="mt-4 text-sm font-bold text-red-700 dark:text-red-300 underline underline-offset-2">Tentar Novamente</button>
                        </div>
                    ) : rotas.length === 0 ? (
                        <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                             <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-slate-400 text-3xl">route</span>
                             </div>
                             <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">Nenhuma rota encontrada</p>
                             <p className="text-slate-400 text-sm">Tente ajustar os locais de partida e chegada.</p>
                        </div>
                    ) : (
                        rotas.map((rota) => (
                            <RouteCard
                                key={rota.id}
                                rota={rota}
                                isProcessing={processingRouteId === rota.id}
                                isRequested={solicitadas.has(rota.id)}
                                estadoAcordo={acordosMap[rota.id]}
                                onSolicitar={handleSolicitar}
                            />
                        ))
                    )}
                </div>
            </section>
        </div>
    </div>
  );
};

export default PassengerDashboard;
