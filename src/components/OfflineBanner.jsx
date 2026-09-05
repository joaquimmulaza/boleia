/**
 * Banner de aviso quando o dispositivo está offline (Luanda / conectividade volátil).
 * @param {{ isOffline?: boolean }} props
 */
export default function OfflineBanner({ isOffline = false }) {
  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-header w-full border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-50"
    >
      Sem ligação à Internet. Algumas funcionalidades podem estar limitadas, mas os teus
      acordos ativos foram carregados a partir da cache.
    </div>
  );
}
