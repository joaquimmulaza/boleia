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

  return new Promise((resolve, reject) => {
    const service = new window.google.maps.places.AutocompleteService();
    // Using passed session token or creating a new one if not available
    const token = sessionToken || new window.google.maps.places.AutocompleteSessionToken();

    service.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'ao' },
        sessionToken: token
      },
      (response, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(response?.predictions || []);
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          console.error('Google Maps API Erro:', status);
          reject(new Error(`Google Maps API Erro: ${status}`));
        }
      }
    );
  });
};

export const getPlaceDetails = async (placeId, sessionToken) => {
  if (!placeId) return null;

  await loadGoogleMapsScript();

  return new Promise((resolve, reject) => {
    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
    const token = sessionToken || new window.google.maps.places.AutocompleteSessionToken();

    service.getDetails(
      {
        placeId,
        fields: ['geometry'],
        sessionToken: token
      },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          const location = place?.geometry?.location;
          if (location) {
            resolve({
              lat: typeof location.lat === 'function' ? location.lat() : location.lat,
              lng: typeof location.lng === 'function' ? location.lng() : location.lng,
            });
          } else {
            reject(new Error('Coordenadas não encontradas para o local.'));
          }
        } else {
          console.error('Google Maps API Erro:', status);
          reject(new Error(`Google Maps API Erro: ${status}`));
        }
      }
    );
  });
};
