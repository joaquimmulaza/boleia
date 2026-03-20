// src/services/GoogleMapsService.js

let googleMapsScriptLoadingPromise = null;

export const loadGoogleMapsScript = () => {
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (googleMapsScriptLoadingPromise) {
    return googleMapsScriptLoadingPromise;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Chave de API do Google Maps não configurada.'));
  }

  googleMapsScriptLoadingPromise = new Promise((resolve, reject) => {
    // Check if script is already injected but not loaded yet
    if (document.querySelector('script[src^="https://maps.googleapis.com/maps/api/js"]')) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleMapsScriptLoadingPromise = null;
      reject(new Error('Erro ao carregar o Google Maps script.'));
    };
    document.head.appendChild(script);
  });

  return googleMapsScriptLoadingPromise;
};

// Humble object for Google Maps interaction
export const getPlacePredictions = async (input, sessionToken) => {
  if (!input) return [];

  await loadGoogleMapsScript();

  return new Promise(async (resolve, reject) => {
    try {
      const token = sessionToken || new window.google.maps.places.AutocompleteSessionToken();
      // Using the new AutocompleteSuggestion API instead of AutocompleteService
      const request = {
        input,
        includedRegionCodes: ['AO'],
        sessionToken: token
      };

      const response = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      
      const mappedPredictions = (response.suggestions || []).map(suggestion => {
         if (suggestion.placePrediction) {
            return {
               description: suggestion.placePrediction.text?.text || suggestion.placePrediction.text || '',
               place_id: suggestion.placePrediction.placeId || suggestion.placePrediction.place_id
            };
         }
         return null;
      }).filter(Boolean);

      resolve(mappedPredictions);
    } catch (error) {
       console.error('Google Maps API Erro:', error);
       reject(error);
    }
  });
};

export const getPlaceDetails = async (placeId, sessionToken) => {
  if (!placeId) return null;

  await loadGoogleMapsScript();

  try {
    const place = new window.google.maps.places.Place({ id: placeId });
    await place.fetchFields({ fields: ['location'] });

    if (place.location) {
      return {
        lat: typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat,
        lng: typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng,
      };
    } else {
      throw new Error('Coordenadas não encontradas para o local.');
    }
  } catch (error) {
    console.error('Google Maps API Erro:', error);
    throw error;
  }
};
