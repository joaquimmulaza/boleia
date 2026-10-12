import { useState, useCallback, useRef } from 'react';
import { getPlacePredictions, getPlaceDetails } from '../services/LocationService';

export const useAutocomplete = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const requestSeqRef = useRef(0);

  const fetchPredictions = useCallback(async (input) => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!input || input.length < 3) {
      if (requestSeqRef.current === seq) {
        setSuggestions([]);
        setLoading(false);
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const results = await getPlacePredictions(input, { signal: controller.signal });
      if (requestSeqRef.current !== seq) {
        return;
      }
      setSuggestions(results);
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }
      if (requestSeqRef.current === seq) {
        setError(err.message || 'Erro ao obter sugestões.');
        setSuggestions([]);
      }
    } finally {
      if (requestSeqRef.current === seq) {
        setLoading(false);
      }
    }
  }, []);

  const selectPlace = useCallback(async (placeId) => {
    setLoading(true);
    setError(null);

    try {
      const details = await getPlaceDetails(placeId, suggestions);
      setSuggestions([]);
      return details;
    } catch (err) {
      setError(err.message || 'Erro ao obter detalhes do local.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [suggestions]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    loading,
    error,
    fetchPredictions,
    selectPlace,
    clearSuggestions,
  };
};
