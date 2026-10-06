import { useNavigate } from 'react-router-dom';
import { buildExploreSearchQuery } from '../utils/exploreSearchParams';

/**
 * @param {{
 *   search: { origem: string, destino: string, origin_lat?: number | null, origin_lng?: number | null, destination_lat?: number | null, destination_lng?: number | null },
 *   title: string,
 * }} props
 */
export default function ExploreFilteredHeader({ search, title }) {
  const navigate = useNavigate();

  const editHref = () => {
    if (
      search.origin_lat != null
      && search.origin_lng != null
      && search.destination_lat != null
      && search.destination_lng != null
    ) {
      navigate(`/?${buildExploreSearchQuery({
        origem: search.origem,
        destino: search.destino,
        origin_lat: search.origin_lat,
        origin_lng: search.origin_lng,
        destination_lat: search.destination_lat,
        destination_lng: search.destination_lng,
      })}`);
      return;
    }
    navigate(`/?origem=${encodeURIComponent(search.origem)}&destino=${encodeURIComponent(search.destino)}`);
  };

  return (
    <div className="space-y-4" data-testid="explore-filtered-header">
      <h1 className="text-2xl font-bold text-balance text-foreground">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
          {search.origem} → {search.destino}
        </span>
        <button
          type="button"
          onClick={editHref}
          className="rounded-full px-4 py-2 text-sm font-bold text-foreground"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => navigate('/explorar')}
          className="rounded-full px-4 py-2 text-sm font-bold text-foreground"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
