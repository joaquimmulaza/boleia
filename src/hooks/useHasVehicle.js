import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Estado do veículo do motorista autenticado.
 * @param {string | undefined} userId
 * @returns {{ hasVehicle: boolean | null, loading: boolean }}
 */
export function useHasVehicle(userId) {
  const [hasVehicle, setHasVehicle] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setHasVehicle(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('veiculos')
          .select('id')
          .eq('id_motorista', userId);

        if (cancelled) return;
        if (error) throw error;
        setHasVehicle(Boolean(data?.length));
      } catch {
        if (!cancelled) setHasVehicle(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { hasVehicle, loading };
}
