import { useState, useCallback, useRef } from 'react';
import { getPlacePredictions, getPlaceDetails } from '../services/LocationService';

export const useAutocomplete = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  /** @type {'network' | null} */
  const [errorKind, setErrorKind] = useState(null);
  const abortRef = useRef(null);
  const requestSeqRef = useRef(0);
  const lastInputRef = useRef('');
  const [resolvedInput, setResolvedInput] = useState(null);

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
        setError(null);
        setErrorKind(null);
        setResolvedInput(null);
      }
      return;
    }

    lastInputRef.current = input;
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setErrorKind(null);
    setResolvedInput(null);

    try {
      const results = await getPlacePredictions(input, { signal: controller.signal });
      if (requestSeqRef.current !== seq) {
        return;
      }
      setSuggestions(results);
      setResolvedInput(input);
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }
      if (requestSeqRef.current === seq) {
        setError(err.message || 'Erro ao obter sugestões.');
        setErrorKind('network');
        setSuggestions([]);
        setResolvedInput(input);
      }
    } finally {
      if (requestSeqRef.current === seq) {
        setLoading(false);
      }
    }
  }, []);

  const retryLastFetch = useCallback(() => {
    const input = lastInputRef.current;
    if (input && input.length >= 3) {
      void fetchPredictions(input);
    }
  }, [fetchPredictions]);

  const selectPlace = useCallback(async (placeId) => {
    setLoading(true);
    setError(null);
    setErrorKind(null);

    try {
      const details = await getPlaceDetails(placeId, suggestions);
      setSuggestions([]);
      return details;
    } catch (err) {
      setError(err.message || 'Erro ao obter detalhes do local.');
      setErrorKind('network');
      return null;
    } finally {
      setLoading(false);
    }
  }, [suggestions]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
    setErrorKind(null);
    setResolvedInput(null);
  }, []);

  return {
    suggestions,
    loading,
    error,
    errorKind,
    resolvedInput,
    fetchPredictions,
    retryLastFetch,
    selectPlace,
    clearSuggestions,
  };
};
