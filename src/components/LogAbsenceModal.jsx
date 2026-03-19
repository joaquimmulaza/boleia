import React, { useState } from 'react';

const LogAbsenceModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    dataFalta: '',
    tipo: 'Motorista',
    observacao: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div data-testid="modal-registar-falta" className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex flex-col justify-end z-[9999] font-display antialiased">
      <div className="bg-white dark:bg-slate-900 rounded-t-xl overflow-hidden shadow-2xl max-w-md mx-auto w-full">
        
        {/* Handle */}
        <div className="flex h-6 w-full items-center justify-center">
          <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>

        <div className="px-6 pt-2 pb-8">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Registar Falta</h3>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Date Input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="dataFalta" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Data</label>
              <div className="relative flex items-center">
                {/* Poka-yoke: Input type date invoca calendário nativo do mobile */}
                <input 
                  id="dataFalta"
                  type="date"
                  className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary focus:border-primary text-base px-4 pr-12 dark:text-white outline-none"
                  value={formData.dataFalta}
                  onChange={(e) => setFormData({...formData, dataFalta: e.target.value})}
                  required
                />
              </div>
            </div>

            {/* Type Selector */}
            <div className="flex flex-col gap-2">
              <label htmlFor="tipoFalta" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tipo</label>
              <div className="relative">
                {/* Poka-yoke: Select nativo do mobile em vez de dropdown custom */}
                <select 
                  id="tipoFalta"
                  className="w-full h-14 appearance-none bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary focus:border-primary text-base px-4 dark:text-white outline-none"
                  value={formData.tipo}
                  onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                >
                  <option value="Motorista">Motorista</option>
                  <option value="Passageiro">Passageiro</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-4 pointer-events-none text-slate-400">expand_more</span>
              </div>
            </div>

            {/* Observation */}
            <div className="flex flex-col gap-2">
              <label htmlFor="observacao" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Observação (opcional)</label>
              <textarea 
                id="observacao"
                className="w-full min-h-[120px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary focus:border-primary text-base p-4 resize-none dark:text-white outline-none"
                placeholder="Adicionar notas sobre a ausência..."
                value={formData.observacao}
                onChange={(e) => setFormData({...formData, observacao: e.target.value})}
              ></textarea>
            </div>

            {/* Summary Info */}
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-3">
              <span className="material-symbols-outlined text-primary shrink-0">info</span>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                O desconto será calculado automaticamente com base no seu percurso habitual em <span className="font-bold">Luanda</span>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 h-14 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                title="Cancelar"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex-1 h-14 font-semibold bg-primary text-white hover:bg-primary/90 rounded-xl transition-colors shadow-lg shadow-primary/20"
                title="Guardar"
              >
                Guardar
              </button>
            </div>
            
          </form>
        </div>
        
        {/* Safe Area Bottom Spacing */}
        <div className="h-6 bg-white dark:bg-slate-900"></div>
      </div>
    </div>
  );
};

export default LogAbsenceModal;
