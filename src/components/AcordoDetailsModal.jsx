import React from 'react';
import { X, Phone, Route, CreditCard, Car } from 'lucide-react';

const formatKz = (value) => {
  const num = Number(value);
  if (isNaN(num)) return `${value} Kz/mês`;
  return `${num.toLocaleString('pt-PT')} Kz/mês`;
};

const AcordoDetailsModal = ({ isOpen, onClose, acordo, userRole }) => {
  if (!isOpen || !acordo) return null;

  const isMotorista = userRole === 'Motorista';
  const personName = isMotorista ? 'Passageiro' : 'Motorista';
  const phoneNumber = '+244 923 456 789'; // Mock para agora, idealmente vem da base de dados

  // Evita propagação de cliques do modal para o overlay
  const handleModalClick = (e) => e.stopPropagation();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-2xl shadow-xl transform transition-transform translate-y-0"
        onClick={handleModalClick}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-charcoal dark:text-slate-100">Detalhes do Acordo</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Perfil */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <span className="text-xl font-bold">{personName.charAt(0)}</span>
              </div>
              <div>
                <p className="font-bold text-charcoal dark:text-slate-100 text-lg">{personName}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{phoneNumber}</p>
              </div>
            </div>
            <a href={`tel:${phoneNumber}`} className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
              <Phone size={20} />
            </a>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Rota */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Itinerário</h4>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div className="w-0.5 h-8 bg-slate-200 dark:bg-slate-700 my-1" />
                <div className="w-3 h-3 rounded-full border-2 border-primary bg-white dark:bg-slate-900" />
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-charcoal dark:text-slate-100">{acordo.routes?.origin_name || 'Origem'}</p>
                  <p className="text-xs text-slate-500">Partida</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal dark:text-slate-100">{acordo.routes?.destination_name || 'Destino'}</p>
                  <p className="text-xs text-slate-500">Chegada</p>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Valor */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <CreditCard size={20} className="text-primary" />
              <span className="font-medium">Valor Mensal</span>
            </div>
            <p className="font-bold text-charcoal dark:text-slate-100">
              {formatKz(acordo.routes?.monthly_price_per_seat)}
            </p>
          </div>

          {/* Veículo (apenas para passageiro) */}
          {!isMotorista && (
            <>
              <hr className="border-slate-100 dark:border-slate-800" />
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Veículo</h4>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                    <Car size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-charcoal dark:text-slate-100">Toyota Hilux 2022</p>
                    <p className="text-xs text-slate-500">LD-12-34-AB</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="pt-2 pb-4">
            <button onClick={onClose} className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-charcoal dark:text-slate-100 font-bold rounded-xl transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcordoDetailsModal;
