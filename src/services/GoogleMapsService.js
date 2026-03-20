// src/services/GoogleMapsService.js

// Humble object for Google Maps interaction
export const getPlacePredictions = async (input, sessionToken) => {
  if (!input) return [];

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Chave de API do Google Maps não configurada.');
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&components=country:ao&sessiontoken=${sessionToken}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return data.predictions || [];
    }

    throw new Error(`Google Maps API Erro: ${data.status}`);
  } catch (error) {
    console.error('Erro em getPlacePredictions:', error);
    throw error;
  }
};

export const getPlaceDetails = async (placeId, sessionToken) => {
  if (!placeId) return null;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Chave de API do Google Maps não configurada.');
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&sessiontoken=${sessionToken}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'OK') {
      const location = data.result?.geometry?.location;
      if (location) {
        return {
          lat: location.lat,
          lng: location.lng,
        };
      }
      throw new Error('Coordenadas não encontradas para o local.');
    }

    throw new Error(`Google Maps API Erro: ${data.status}`);
  } catch (error) {
    console.error('Erro em getPlaceDetails:', error);
    throw error;
  }
};
