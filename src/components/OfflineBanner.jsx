import FeedbackAlert from './FeedbackAlert';

/**
 * Banner sticky quando o dispositivo está offline (Luanda / conectividade volátil).
 * @param {{ isOffline?: boolean }} props
 */
export default function OfflineBanner({ isOffline = false }) {
  if (!isOffline) return null;

  return (
    <FeedbackAlert
      type="offline"
      data-testid="offline-banner"
      className="shrink-0 z-header mb-0 w-full rounded-none border-x-0 border-t-0 px-3 py-2.5 shadow-none"
      text="Sem ligação à Internet. Algumas funcionalidades podem estar limitadas, mas os teus acordos ativos foram carregados a partir da cache."
    />
  );
}
