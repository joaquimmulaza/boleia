import { useState, useCallback, useRef } from 'react';
import { getPlacePredictions, getPlaceDetails } from '../services/GoogleMapsService';
import { v4 as uuidv4 } from 'uuid';

export const useAutocomplete = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const sessionTokenRef = useRef(null);

  const fetchPredictions = useCallback(async (input) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = uuidv4();
    }

    setLoading(true);
    setError(null);

    try {
      const results = await getPlacePredictions(input, sessionTokenRef.current);
      setSuggestions(results);
    } catch (err) {
      setError(err.message || 'Erro ao carregar sugestões.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectPlace = useCallback(async (placeId) => {
    if (!sessionTokenRef.current) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const details = await getPlaceDetails(placeId, sessionTokenRef.current);
      // Reset session token after a selection (Google Maps best practice)
      sessionTokenRef.current = null;
      setSuggestions([]);
      return details;
    } catch (err) {
      setError(err.message || 'Erro ao obter detalhes do local.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

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
