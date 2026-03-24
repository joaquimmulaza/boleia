import React, { useState } from 'react';
import { Clock, CreditCard, User, Route, CheckCircle, XCircle } from 'lucide-react';
import EstadoBadge from './EstadoBadge';
import AcordoKebabMenu from './AcordoKebabMenu';

const formatKz = (value) => {
  const num = Number(value);
  if (isNaN(num)) return `${value} Kz/mês`;
  return `${num.toLocaleString('pt-PT')} Kz/mês`;
};

const AcordoCardMotorista = ({ acordo, onAccept, onReject, onShowDetails, onReport, onCancel }) => {
  const isPendente = acordo.estado?.toLowerCase() === 'pendente';
  const isAtivo = acordo.estado?.toLowerCase() === 'ativo';
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    await onAccept(acordo.id);
    setIsLoading(false);
  };

  const handleReject = async () => {
    setIsLoading(true);
    await onReject(acordo.id);
    setIsLoading(false);
  };

  return (
    <div data-testid="agreement-card" className="bg-white dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAtivo ? 'bg-emerald/20 text-emerald' : 'bg-amber/20 text-amber'}`}>
            <User size={24} className="shrink-0" />
          </div>
          <div>
            <p className="font-bold text-charcoal dark:text-slate-100">Passageiro</p>
            <EstadoBadge estado={acordo.estado} />
          </div>
        </div>
        {isAtivo && (
          <AcordoKebabMenu
            onReportar={() => onReport?.(acordo)}
            onCancelar={() => onCancel?.(acordo)}
          />
        )}
      </div>
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Route size={18} className={`shrink-0 ${isAtivo ? 'text-primary' : 'text-amber'}`} />
          <p className="text-sm font-medium">{acordo.routes?.origin_name} → {acordo.routes?.destination_name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Clock size={18} className="shrink-0" />
            <p className="text-sm">{acordo.routes?.departure_time}</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <CreditCard size={18} className="shrink-0" />
            <p className="text-sm">{formatKz(acordo.routes?.monthly_price_per_seat)}</p>
          </div>
        </div>
      </div>

      {isPendente && (
        <div className="flex gap-2">
           <button
             onClick={handleAccept}
             disabled={isLoading}
             className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white rounded-lg font-semibold text-sm transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5"
           >
             <CheckCircle size={16} /> Aceitar
           </button>
           <button
             onClick={handleReject}
             disabled={isLoading}
             className="flex-1 py-2.5 bg-coral/10 hover:bg-coral/20 text-coral disabled:opacity-60 rounded-lg font-semibold text-sm transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5"
           >
             <XCircle size={16} /> Rejeitar
           </button>
        </div>
      )}
      {isAtivo && (
        <button
          onClick={() => onShowDetails?.(acordo)}
          className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm transition-colors active:scale-95 hover:bg-primary/90"
        >
          Ver Detalhes
        </button>
      )}
    </div>
  );
};

export default AcordoCardMotorista;
