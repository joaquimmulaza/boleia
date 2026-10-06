import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '../ui/button';
import AutocompleteDropdown from '../AutocompleteDropdown';
import { useAutocomplete } from '../../hooks/useAutocomplete';
import { buildExploreSearchQuery } from '../../utils/exploreSearchParams';

/**
 * @param {{
 *   initialOrigem?: string,
 *   initialDestino?: string,
 *   initialOriginCoords?: { lat: number, lng: number } | null,
 *   initialDestinationCoords?: { lat: number, lng: number } | null,
 * }} props
 */
export default function LandingHeroSearchCard({
  initialOrigem = '',
  initialDestino = '',
  initialOriginCoords = null,
  initialDestinationCoords = null,
}) {
  const navigate = useNavigate();
  const originAuto = useAutocomplete();
  const destAuto = useAutocomplete();

  const [origem, setOrigem] = useState(initialOrigem);
  const [destino, setDestino] = useState(initialDestino);
  const [originCoords, setOriginCoords] = useState(initialOriginCoords);
  const [destCoords, setDestCoords] = useState(initialDestinationCoords);
  const [originError, setOriginError] = useState('');
  const [destError, setDestError] = useState('');
  const [activeField, setActiveField] = useState(null);

  const originRef = useRef(null);
  const destRef = useRef(null);
  const originDebounceRef = useRef(null);
  const destDebounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        originRef.current?.contains(event.target)
        || destRef.current?.contains(event.target)
      ) {
        return;
      }
      setActiveField(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => {
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
  }, []);

  const handleOriginChange = (value) => {
    setOrigem(value);
    setOriginCoords(null);
    setOriginError('');
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    if (value.length > 2) {
      setActiveField('origin');
      originDebounceRef.current = setTimeout(() => {
        void originAuto.fetchPredictions(value);
      }, 300);
    } else {
      originAuto.clearSuggestions();
      setActiveField(null);
    }
  };

  const handleDestChange = (value) => {
    setDestino(value);
    setDestCoords(null);
    setDestError('');
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    if (value.length > 2) {
      setActiveField('dest');
      destDebounceRef.current = setTimeout(() => {
        void destAuto.fetchPredictions(value);
      }, 300);
    } else {
      destAuto.clearSuggestions();
      setActiveField(null);
    }
  };

  const selectOrigin = async (suggestion) => {
    setOrigem(suggestion.description);
    setOriginError('');
    setActiveField(null);
    const details = await originAuto.selectPlace(suggestion.place_id);
    if (details?.lat != null && details?.lng != null) {
      setOriginCoords({ lat: details.lat, lng: details.lng });
    }
  };

  const selectDest = async (suggestion) => {
    setDestino(suggestion.description);
    setDestError('');
    setActiveField(null);
    const details = await destAuto.selectPlace(suggestion.place_id);
    if (details?.lat != null && details?.lng != null) {
      setDestCoords({ lat: details.lat, lng: details.lng });
    }
  };

  const swapOd = () => {
    setOrigem(destino);
    setDestino(origem);
    setOriginCoords(destCoords);
    setDestCoords(originCoords);
    setOriginError('');
    setDestError('');
    originAuto.clearSuggestions();
    destAuto.clearSuggestions();
    setActiveField(null);
  };

  const handleSubmit = useCallback(() => {
    let hasError = false;
    if (!origem.trim() || !originCoords) {
      setOriginError('Indica de onde sais.');
      hasError = true;
    }
    if (!destino.trim() || !destCoords) {
      setDestError('Indica para onde vais.');
      hasError = true;
    }
    if (hasError) return;

    const query = buildExploreSearchQuery({
      origem: origem.trim(),
      destino: destino.trim(),
      origin_lat: originCoords.lat,
      origin_lng: originCoords.lng,
      destination_lat: destCoords.lat,
      destination_lng: destCoords.lng,
    });
    navigate(`/explorar?${query}`);
  }, [origem, destino, originCoords, destCoords, navigate]);

  const showOriginDropdown = activeField === 'origin';
  const showDestDropdown = activeField === 'dest';

  return (
    <div
      className="w-full min-w-0 max-w-[440px] rounded-2xl border border-border bg-card p-5 shadow-sm lg:ml-auto"
      data-testid="hero-search-card"
    >
      <p className="mb-3 text-sm font-semibold text-muted-foreground">Procura uma boleia</p>

      <div className="relative mb-3">
        <div ref={originRef} className="relative">
          <label className="sr-only" htmlFor="hero-origem">De onde sais?</label>
          <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border bg-card pl-3.5 pr-14">
            <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <input
              id="hero-origem"
              type="text"
              value={origem}
              placeholder="De onde sais?"
              onChange={(e) => handleOriginChange(e.target.value)}
              onFocus={() => {
                if (origem.length > 2) setActiveField('origin');
              }}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>
          {originError ? (
            <p className="mt-1 text-xs font-medium text-red-600" role="alert">{originError}</p>
          ) : null}
          {showOriginDropdown ? (
            <AutocompleteDropdown
              suggestions={originAuto.suggestions}
              loading={originAuto.loading}
              error={originAuto.error}
              onSelect={selectOrigin}
              title="Locais sugeridos"
              emptyMessage="Nenhum local encontrado."
            />
          ) : null}
        </div>

        <div ref={destRef} className="relative mt-2">
          <label className="sr-only" htmlFor="hero-destino">Para onde vais?</label>
          <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border bg-card pl-3.5 pr-14">
            <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <input
              id="hero-destino"
              type="text"
              value={destino}
              placeholder="Para onde vais?"
              onChange={(e) => handleDestChange(e.target.value)}
              onFocus={() => {
                if (destino.length > 2) setActiveField('dest');
              }}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>
          {destError ? (
            <p className="mt-1 text-xs font-medium text-red-600" role="alert">{destError}</p>
          ) : null}
          {showDestDropdown ? (
            <AutocompleteDropdown
              suggestions={destAuto.suggestions}
              loading={destAuto.loading}
              error={destAuto.error}
              onSelect={selectDest}
              title="Locais sugeridos"
              emptyMessage="Nenhum local encontrado."
            />
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Trocar origem e destino"
          onClick={swapOd}
          className="absolute right-0 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-sm"
        >
          <ArrowUpDown className="size-4 text-foreground" aria-hidden="true" />
        </button>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full rounded-full font-bold"
        onClick={handleSubmit}
      >
        Ver boleias
      </Button>
    </div>
  );
}
