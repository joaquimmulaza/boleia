import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

/**
 * Estado do veículo do motorista autenticado.
 * @param {string | undefined} userId
 * @returns {{
 *   hasVehicle: boolean | null,
 *   loading: boolean,
 *   error: string | null,
 *   retry: () => void,
 * }}
 */
export function useHasVehicle(userId) {
  const [hasVehicle, setHasVehicle] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setHasVehicle(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('veiculos')
          .select('id')
          .eq('id_motorista', userId);

        if (cancelled) return;
        if (queryError) throw queryError;
        setHasVehicle(Boolean(data?.length));
      } catch (err) {
        if (!cancelled) {
          setHasVehicle(null);
          setError(getFriendlyErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, retryCount]);

  return { hasVehicle, loading, error, retry };
}
