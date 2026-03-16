import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const PublishRoute = () => {
  const [formData, setFormData] = useState({
    origin_name: '',
    destination_name: '',
    departure_time: '',
    return_time: '',
    available_seats: 1,
    monthly_price_per_seat: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const routeData = {
        driver_id: user.id,
        origin_name: formData.origin_name,
        destination_name: formData.destination_name,
        departure_time: formData.departure_time,
        return_time: formData.return_time,
        available_seats: parseInt(formData.available_seats, 10),
        monthly_price_per_seat: parseFloat(formData.monthly_price_per_seat)
      };

      const { error } = await supabase.from('routes').insert([routeData]);
      
      if (error) throw error;

      setMessage({ type: 'success', text: 'Trajeto publicado com sucesso!' });
      // Reset form or navigate
      setFormData({
        origin_name: '',
        destination_name: '',
        departure_time: '',
        return_time: '',
        available_seats: 1,
        monthly_price_per_seat: ''
      });
      setTimeout(() => navigate('/motorista'), 2000);
    } catch (error) {
      console.error('Erro ao publicar trajeto:', error);
      setMessage({ type: 'error', text: 'Erro ao publicar trajeto. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md mt-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Publicar Trajeto</h1>
      
      {message.text && (
        <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="origin_name" className="block text-sm font-medium text-gray-700">Local de Partida</label>
          <input
            type="text"
            id="origin_name"
            name="origin_name"
            required
            value={formData.origin_name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            placeholder="Ex: Luanda"
          />
        </div>

        <div>
          <label htmlFor="destination_name" className="block text-sm font-medium text-gray-700">Destino</label>
          <input
            type="text"
            id="destination_name"
            name="destination_name"
            required
            value={formData.destination_name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            placeholder="Ex: Benguela"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="departure_time" className="block text-sm font-medium text-gray-700">Hora de Partida</label>
            <input
              type="time"
              id="departure_time"
              name="departure_time"
              required
              value={formData.departure_time}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <label htmlFor="return_time" className="block text-sm font-medium text-gray-700">Hora de Regresso</label>
            <input
              type="time"
              id="return_time"
              name="return_time"
              required
              value={formData.return_time}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="available_seats" className="block text-sm font-medium text-gray-700">Vagas (1-4)</label>
            <input
              type="number"
              id="available_seats"
              name="available_seats"
              required
              min="1"
              max="4"
              value={formData.available_seats}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <label htmlFor="monthly_price_per_seat" className="block text-sm font-medium text-gray-700">Valor Mensal (Kz)</label>
            <input
              type="number"
              id="monthly_price_per_seat"
              name="monthly_price_per_seat"
              required
              min="0"
              step="100"
              value={formData.monthly_price_per_seat}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              placeholder="Ex: 15000"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          {loading ? 'A publicar...' : 'Publicar Trajeto'}
        </button>
      </form>
    </div>
  );
};

export default PublishRoute;
