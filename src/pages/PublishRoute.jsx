import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const PublishRoute = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    origin_name: '',
    destination_name: '',
    departure_time: '',
    return_time: '',
    available_seats: '',
    monthly_price_per_seat: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        setMessage({ type: 'error', text: 'Você precisa estar logado para publicar uma rota.' });
        setLoading(false);
        return;
      }

      const { data: routeData, error: routeError } = await supabase
        .from('rotas')
        .insert([
          {
            id_motorista: user.id,
            origin_name: formData.origin_name,
            destination_name: formData.destination_name,
            departure_time: formData.departure_time,
            return_time: formData.return_time,
            available_seats: parseInt(formData.available_seats, 10),
            monthly_price_per_seat: parseFloat(formData.monthly_price_per_seat),
          },
        ])
        .select();

      if (routeError) throw routeError;

      setMessage({ type: 'success', text: 'Trajeto publicado com sucesso!' });
      setTimeout(() => {
        navigate('/motorista/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Erro ao publicar trajeto:', error);
      setMessage({ type: 'error', text: 'Erro ao publicar trajeto. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 overflow-x-hidden antialiased">
      {/* Top App Bar */}
      <div className="sticky top-0 z-10 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-4 justify-between border-b border-primary/10">
        <div 
          onClick={() => navigate(-1)}
          className="text-near-black dark:text-slate-100 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </div>
        <h2 className="text-near-black dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">
          Publicar Trajeto
        </h2>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-6 p-4 pb-32 max-w-[480px] mx-auto w-full">
        {message.text && (
          <div className={`p-4 mb-2 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
          {/* Route Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-primary text-sm font-bold uppercase tracking-wider px-1">Percurso</h3>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col w-full" htmlFor="origin_name">
                <span className="text-near-black dark:text-slate-200 text-sm font-semibold mb-2 ml-1">Local de Partida</span>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-primary" aria-hidden="true">location_on</span>
                  <input 
                    id="origin_name"
                    type="text"
                    name="origin_name"
                    required
                    value={formData.origin_name}
                    onChange={handleChange}
                    className="form-input w-full pl-12 pr-4 h-14 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-primary/20 transition-all placeholder:text-slate-400 outline-none"
                    placeholder="Ex: Viana, Luanda" 
                  />
                </div>
              </label>
              
              <label className="flex flex-col w-full" htmlFor="destination_name">
                <span className="text-near-black dark:text-slate-200 text-sm font-semibold mb-2 ml-1">Local de Chegada</span>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-primary" aria-hidden="true">flag</span>
                  <input 
                    id="destination_name"
                    type="text"
                    name="destination_name"
                    required
                    value={formData.destination_name}
                    onChange={handleChange}
                    className="form-input w-full pl-12 pr-4 h-14 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-primary/20 transition-all placeholder:text-slate-400 outline-none"
                    placeholder="Ex: Talatona, Luanda" 
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-primary text-sm font-bold uppercase tracking-wider px-1">Horário</h3>
            <div className="flex gap-4">
              <label className="flex flex-col flex-1" htmlFor="departure_time">
                <span className="text-near-black dark:text-slate-200 text-sm font-semibold mb-2 ml-1">Ida</span>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-primary text-xl" aria-hidden="true">schedule</span>
                  <input 
                    id="departure_time"
                    type="time"
                    name="departure_time"
                    required
                    value={formData.departure_time}
                    onChange={handleChange}
                    className="form-input w-full pl-12 pr-4 h-14 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
              </label>
              <label className="flex flex-col flex-1" htmlFor="return_time">
                <span className="text-near-black dark:text-slate-200 text-sm font-semibold mb-2 ml-1">Volta</span>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-primary text-xl" aria-hidden="true">history</span>
                  <input 
                    id="return_time"
                    type="time"
                    name="return_time"
                    required
                    value={formData.return_time}
                    onChange={handleChange}
                    className="form-input w-full pl-12 pr-4 h-14 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Capacity and Price Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-primary text-sm font-bold uppercase tracking-wider px-1">Vagas e Custo</h3>
            <div className="flex gap-4">
              <label className="flex flex-col flex-1" htmlFor="available_seats">
                <span className="text-near-black dark:text-slate-200 text-sm font-semibold mb-2 ml-1">Nº Vagas</span>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-primary" aria-hidden="true">group</span>
                  <input 
                    id="available_seats"
                    type="number"
                    name="available_seats"
                    required
                    min="1"
                    max="4"
                    value={formData.available_seats}
                    onChange={handleChange}
                    className="form-input w-full pl-12 pr-4 h-14 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-primary/20 transition-all outline-none"
                    placeholder="4" 
                  />
                </div>
              </label>
              <label className="flex flex-col flex-1" htmlFor="monthly_price_per_seat">
                <span className="text-near-black dark:text-slate-200 text-sm font-semibold mb-2 ml-1">Valor Mensal</span>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-primary" aria-hidden="true">payments</span>
                  <input 
                    id="monthly_price_per_seat"
                    type="number"
                    name="monthly_price_per_seat"
                    required
                    min="0"
                    step="100"
                    value={formData.monthly_price_per_seat}
                    onChange={handleChange}
                    className="form-input w-full pl-12 pr-12 h-14 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-primary/20 transition-all outline-none"
                    placeholder="25.000" 
                  />
                  <span className="absolute right-4 text-slate-400 font-bold text-xs">Kz</span>
                </div>
              </label>
            </div>
          </div>

          {/* Additional Options (Subtle) */}
          <div className="flex items-center gap-2 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <span className="material-symbols-outlined text-primary">info</span>
            <p className="text-xs text-slate-600 dark:text-slate-400">Ao publicar, você concorda em seguir as diretrizes de segurança da comunidade Boleia Certa.</p>
          </div>

          {/* Footer Button - Fixed to bottom */}
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/95 dark:via-background-dark/95 to-transparent flex justify-center z-40 translate-y-[-env(safe-area-inset-bottom,0px)]">
            <div className="w-full max-w-[480px] mx-auto relative">
              <button 
                aria-label="Publicar Trajeto"
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-white font-bold text-lg py-4 px-8 rounded-full w-full shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">publish</span>
                {loading ? 'A publicar...' : 'Publicar Trajeto'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default PublishRoute;
