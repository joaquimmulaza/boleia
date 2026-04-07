import React from 'react';
import { X, Phone, MapPin, Car } from 'lucide-react';

const formatKz = (value) => {
  const num = Number(value);
  if (isNaN(num)) return `${value}`;
  return `${num.toLocaleString('pt-PT')}`;
};

const AcordoDetailsModal = ({ isOpen, onClose, acordo, userRole, onAccept, onReject }) => {
  if (!isOpen || !acordo) return null;

  const isMotorista = userRole === 'Motorista';
  const personName = acordo.contraparte?.nome_completo || (isMotorista ? 'Passageiro' : 'Motorista');
  const phoneNumber = acordo.contraparte?.telefone || 'N/A';
  const initial = personName.charAt(0).toUpperCase();

  const veiculo = acordo.veiculo;
  const estado = acordo.estado || 'Pendente';
  const isPendente = estado.toLowerCase() === 'pendente';
  const isAtivo = estado.toLowerCase() === 'ativo';
  const formatTime = (t) => t ? t.substring(0, 5) : '';
  const departureTime = formatTime(acordo.routes?.departure_time);
  const returnTime = formatTime(acordo.routes?.return_time);

  const handleModalClick = (e) => e.stopPropagation();

  return (
    <>
      <div 
        className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-[200] transition-opacity duration-300" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <div 
        className="fixed bottom-0 left-0 right-0 z-[210] flex justify-center items-end px-0 md:px-4 md:pb-8"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div 
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-500 ease-out translate-y-0 flex flex-col pt-1"
          onClick={handleModalClick}
        >
          {/* Handle Decorator */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
          </div>
          
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 shrink-0">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-charcoal dark:text-slate-100">
                Detalhes da Boleia
              </h2>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isAtivo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                  isPendente ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                }`}>
                  {estado}
                </span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-95 transition-transform hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Scrollable Content */}
          <div className="px-6 pb-20 md:pb-10 pt-2 space-y-6 overflow-y-auto" style={{ maxHeight: '80vh' }}>
            {/* Profile & Contact Section */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl w-full">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                    <span className="text-xl font-bold">{initial}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {isMotorista ? 'Passageiro' : 'Motorista'}
                  </p>
                  <h3 className="text-lg font-bold text-charcoal dark:text-slate-100">{personName}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{phoneNumber}</p>
                </div>
              </div>
              {phoneNumber !== 'N/A' && (
                <a 
                  href={`tel:${phoneNumber.replace(/[^\d+]/g, '')}`}
                  className="w-12 h-12 flex items-center justify-center bg-primary text-white rounded-full shadow-lg shadow-primary/20 active:scale-90 transition-all hover:bg-primary/90"
                >
                  <Phone size={20} className="fill-current" />
                </a>
              )}
            </div>
            
            {/* Bento Grid: Route & Price */}
            <div className="grid grid-cols-12 gap-4 w-full">
              {/* Route Section */}
              <div className="col-span-12 p-5 bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 relative overflow-hidden">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center py-1">
                    <div className="w-3 h-3 rounded-full border-[3px] border-primary shrink-0"></div>
                    <div className="w-0.5 min-h-[40px] h-full bg-gradient-to-b from-primary to-primary/20 my-1"></div>
                    <MapPin size={16} className="text-primary shrink-0" />
                  </div>
                  <div className="flex flex-col justify-between py-1 flex-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Partida</p>
                        {departureTime && <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">{departureTime}</span>}
                      </div>
                      <p className="text-base font-bold text-charcoal dark:text-slate-100">
                        {acordo.routes?.origin_name || 'Origem'}
                      </p>
                    </div>
                    <div className="pt-4">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Destino</p>
                        {returnTime && <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">{returnTime}</span>}
                      </div>
                      <p className="text-base font-bold text-charcoal dark:text-slate-100">
                        {acordo.routes?.destination_name || 'Destino'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Price Card */}
              <div className="col-span-12 p-5 bg-primary rounded-2xl shadow-xl shadow-primary/10 flex items-center justify-between text-white">
                <div>
                  <p className="text-[10px] font-semibold opacity-90 uppercase tracking-widest">Acordo Mensal</p>
                  <p className="text-2xl font-extrabold flex items-baseline gap-1 mt-1">
                    {formatKz(acordo.routes?.monthly_price_per_seat)}
                    <span className="text-sm font-medium opacity-80 font-normal">Kz/mês</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="font-bold text-xl leading-none">Kz</span>
                </div>
              </div>
              
              {/* Vehicle Info */}
              {!isMotorista && veiculo && (
                <div className="col-span-12 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center gap-4">
                  <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <Car size={28} className="text-slate-400 dark:text-slate-300" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Veículo</p>
                    <h4 className="text-base font-bold text-charcoal dark:text-slate-100 truncate">{veiculo.marca_modelo || 'Não informado'}</h4>
                    <div className="inline-block mt-1 px-3 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-600">
                      <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 tracking-tighter">
                        {veiculo.matricula || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {isMotorista && isPendente ? (
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => { onAccept && onAccept(acordo.id); onClose(); }}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-primary/90"
                  >
                    Aceitar Pedido
                  </button>
                  <button 
                    onClick={() => { onReject && onReject(acordo.id); onClose(); }}
                    className="w-full py-4 bg-transparent text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold rounded-xl active:opacity-70 transition-all flex items-center justify-center gap-2"
                  >
                    Recusar Pedido
                  </button>
                </div>
              ) : (
                <button 
                  onClick={onClose}
                  className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-primary/90"
                >
                  Fechar Detalhes
                </button>
              )}
            </div>
            
          </div>
        </div>
      </div>
    </>
  );
};

export default AcordoDetailsModal;
