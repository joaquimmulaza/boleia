import { useEffect, useRef, useState } from 'react';

const RECOLHA_COLOR = '#10b748';
const DESEMBARQUE_COLOR = '#64748b';

/**
 * Chave estável por conteúdo — evita remount MapLibre quando o array é recriado.
 * @param {Array<{ id?: string, lat: number, lng: number, kind: string, memberIndex?: number }>} points
 * @returns {string}
 */
function buildPointsKey(points) {
  return points
    .map((p) => `${p.id ?? ''}:${p.kind}:${p.lat}:${p.lng}:${p.memberIndex ?? ''}`)
    .join('|');
}

/**
 * @param {{
 *   label: string,
 *   kind: 'recolha' | 'desembarque',
 *   memberIndex?: number,
 * }} point
 * @returns {HTMLDivElement}
 */
function createMarkerElement(point) {
  const index = point.memberIndex ?? 1;
  const color = point.kind === 'desembarque' ? DESEMBARQUE_COLOR : RECOLHA_COLOR;
  const el = document.createElement('div');
  el.textContent = String(index);
  el.title = `${index} · ${point.label}`;
  el.setAttribute('aria-label', `${index} · ${point.label}`);
  el.style.width = '22px';
  el.style.height = '22px';
  el.style.borderRadius = '9999px';
  el.style.backgroundColor = color;
  el.style.border = '2px solid #ffffff';
  el.style.boxShadow = '0 1px 2px rgb(0 0 0 / 0.25)';
  el.style.color = '#ffffff';
  el.style.fontSize = '11px';
  el.style.fontWeight = '700';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.fontVariantNumeric = 'tabular-nums';
  return el;
}

/**
 * Mapa MapLibre dos pontos preferenciais (recolha / desembarque).
 * Import dinâmico de maplibre-gl — sem init em loading ou lista vazia.
 *
 * @param {{
 *   points: Array<{
 *     id: string,
 *     label: string,
 *     kind: 'recolha' | 'desembarque',
 *     lat: number,
 *     lng: number,
 *     memberIndex?: number,
 *   }>,
 *   loading?: boolean,
 * }} props
 */
export default function PreferentialPointsMap({ points = [], loading = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const pointsKey = buildPointsKey(points);

  const [mapError, setMapError] = useState(false);
  const [booting, setBooting] = useState(() => !loading && points.length > 0);

  useEffect(() => {
    const currentPoints = pointsRef.current;

    if (loading || !currentPoints.length) {
      setMapError(false);
      setBooting(false);
      return undefined;
    }

    let cancelled = false;
    setMapError(false);
    setBooting(true);

    const clearMarkers = () => {
      markersRef.current.forEach((marker) => {
        try {
          marker.remove();
        } catch {
          /* ignore */
        }
      });
      markersRef.current = [];
    };

    const destroyMap = () => {
      clearMarkers();
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
      }
    };

    async function initMap() {
      const [{ default: maplibregl }] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]);

      if (cancelled || !containerRef.current) {
        return;
      }

      destroyMap();

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
            },
          ],
        },
        center: [currentPoints[0].lng, currentPoints[0].lat],
        zoom: 14,
        attributionControl: true,
      });

      if (cancelled) {
        try {
          map.remove();
        } catch {
          /* ignore */
        }
        return;
      }

      mapRef.current = map;

      currentPoints.forEach((point) => {
        const el = createMarkerElement(point);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([point.lng, point.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });

      if (currentPoints.length === 1) {
        map.setCenter([currentPoints[0].lng, currentPoints[0].lat]);
        map.setZoom(14);
      } else {
        const bounds = new maplibregl.LngLatBounds();
        currentPoints.forEach((point) => {
          bounds.extend([point.lng, point.lat]);
        });
        map.fitBounds(bounds, { padding: 40, maxZoom: 16 });
      }

      if (!cancelled) {
        setBooting(false);
      }
    }

    initMap().catch((err) => {
      console.error('Erro ao inicializar mapa de pontos preferenciais:', err);
      if (!cancelled) {
        destroyMap();
        setMapError(true);
        setBooting(false);
      }
    });

    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [loading, pointsKey]);

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="A carregar mapa dos pontos preferenciais"
        className="h-[190px] w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800/50"
      />
    );
  }

  if (!points.length) {
    return (
      <p className="text-sm text-pretty text-slate-600 dark:text-slate-400">
        Pontos de recolha sem localização no mapa
      </p>
    );
  }

  if (mapError) {
    return (
      <p className="text-sm text-pretty text-slate-600 dark:text-slate-400" role="alert">
        Não foi possível carregar o mapa.
      </p>
    );
  }

  return (
    <div className="relative">
      {booting ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="A carregar mapa dos pontos preferenciais"
          className="absolute inset-0 z-10 h-[190px] w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800/50"
        />
      ) : null}
      <div
        ref={containerRef}
        role="region"
        aria-label="Mapa dos pontos preferenciais"
        className="h-[190px] w-full overflow-hidden rounded-xl"
      />
    </div>
  );
}
