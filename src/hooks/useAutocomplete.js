import { useState, useCallback } from 'react';
import { getPlacePredictions, getPlaceDetails } from '../services/LocationService';

export const useAutocomplete = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPredictions = useCallback(async (input) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    // getPlacePredictions nunca lança excepção — retorna [] em caso de erro
    const results = await getPlacePredictions(input);
    setSuggestions(results);
    setLoading(false);
  }, []);

  const selectPlace = useCallback(async (placeId) => {
    setLoading(true);
    setError(null);

    try {
      // Passa as sugestões actuais como cache; sem chamada extra de rede
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
