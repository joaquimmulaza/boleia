import React from 'react';
import { Clock, CreditCard, User, Route, Ban } from 'lucide-react';
import EstadoBadge from './EstadoBadge';
import AcordoKebabMenu from './AcordoKebabMenu';

const formatKz = (value) => {
  const num = Number(value);
  if (isNaN(num)) return `${value} Kz/mês`;
  return `${num.toLocaleString('pt-PT')} Kz/mês`;
};

const AcordoCardPassageiro = ({ acordo, onShowDetails, onReport, onCancel, onRemover }) => {
  const isPendente = acordo.estado?.toLowerCase() === 'pendente';
  const isCancelado = acordo.estado?.toLowerCase() === 'cancelado';
  const isAtivo = acordo.estado?.toLowerCase() === 'ativo';

  const motoristaName = acordo.contraparte?.nome_completo || 'Motorista';

  if (isCancelado) {
    return (
      <div data-testid="agreement-card" className="bg-white/60 dark:bg-slate-800/30 rounded-xl p-4 shadow-sm border border-slate-100/50 dark:border-slate-700/50 opacity-60">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
               <User size={24} className="shrink-0" />
            </div>
            <div>
              <p className="font-bold text-charcoal dark:text-slate-100">{motoristaName}</p>
              <EstadoBadge estado={acordo.estado} />
            </div>
          </div>
          <AcordoKebabMenu onRemover={() => onRemover?.(acordo)} />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Ban size={18} />
            <p className="text-sm font-medium italic">Acordo cancelado este mês</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="agreement-card" className="bg-white dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAtivo ? 'bg-emerald/20 text-emerald' : 'bg-amber/20 text-amber'}`}>
            <User size={24} className="shrink-0" />
          </div>
          <div>
            <p className="font-bold text-charcoal dark:text-slate-100">{motoristaName}</p>
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
        <button className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg font-semibold text-sm transition-colors active:scale-95">
          Aguardando Confirmação
        </button>
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

export default AcordoCardPassageiro;
