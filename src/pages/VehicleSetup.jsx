import React, { useState, useEffect } from 'react';
import { Armchair, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { markPermissionsEligible } from '../utils/permissionsPrompt';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';

/**
 * Capacidade do veículo: total inclui motorista; vagas passageiros = total − 1.
 * Nunca usado como divisor de preço.
 */
const VehicleSetup = () => {
  const [marcaModelo, setMarcaModelo] = useState('');
  const [matricula, setMatricula] = useState('');
  const [capacidadeTotal, setCapacidadeTotal] = useState('');
  const [feedbackVeiculo, setFeedbackVeiculo] = useState({ type: '', message: '' });
  const [isLoadingVeiculo, setIsLoadingVeiculo] = useState(false);
  const navigate = useNavigate();

  const vagasPassageiros =
    capacidadeTotal !== '' && Number.isInteger(Number(capacidadeTotal))
      ? Math.max(0, Number(capacidadeTotal) - 1)
      : null;

  useEffect(() => {
    const carregarDados = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('marca_modelo, matricula, capacidade_total, vagas_passageiros')
        .eq('id_motorista', user.id);

      if (veiculosData && veiculosData.length > 0) {
        const v = veiculosData[0];
        setMarcaModelo(v.marca_modelo ?? '');
        setMatricula(v.matricula ?? '');
        setCapacidadeTotal(String(v.capacidade_total ?? ''));
      }
    };

    carregarDados();
  }, []);

  const handleGuardarVeiculo = async (e) => {
    e.preventDefault();
    setFeedbackVeiculo({ type: '', message: '' });
    setIsLoadingVeiculo(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const capacidade = parseInt(capacidadeTotal, 10);
    if (!Number.isInteger(capacidade) || capacidade < 2) {
      setFeedbackVeiculo({
        type: 'error',
        message: 'A capacidade total deve ser pelo menos 2 (motorista + 1 passageiro).',
      });
      setIsLoadingVeiculo(false);
      return;
    }

    const payload = {
      id_motorista: user.id,
      marca_modelo: marcaModelo,
      matricula,
      capacidade_total: capacidade,
      vagas_passageiros: capacidade - 1,
    };

    const { error } = await supabase
      .from('veiculos')
      .upsert(payload, { onConflict: 'id_motorista' });

    setIsLoadingVeiculo(false);

    if (error) {
      setFeedbackVeiculo({ type: 'error', message: getFriendlyErrorMessage(error) });
    } else {
      markPermissionsEligible();
      setFeedbackVeiculo({ type: 'success', message: 'Veículo guardado com sucesso!' });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="O Meu Veículo"
        subtitle="Mantém os dados do teu veículo actualizados para as tuas boleias."
        onBack={() => navigate('/motorista')}
      />

      <form
        onSubmit={handleGuardarVeiculo}
        className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm space-y-5 border border-primary/5"
      >
        <div className="space-y-1.5">
          <label htmlFor="marcaModelo" className="text-charcoal dark:text-slate-300 text-sm font-semibold px-1">
            Marca/Modelo
          </label>
          <input
            id="marcaModelo"
            type="text"
            value={marcaModelo}
            onChange={(e) => setMarcaModelo(e.target.value)}
            className="w-full bg-light-gray dark:bg-slate-800 border-none rounded-lg h-12 px-4 text-charcoal dark:text-slate-100 focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-cool-gray outline-none"
            placeholder="Ex: Toyota Fortuner"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="matricula" className="text-charcoal dark:text-slate-300 text-sm font-semibold px-1">
            Matrícula
          </label>
          <input
            id="matricula"
            type="text"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            className="w-full bg-light-gray dark:bg-slate-800 border-none rounded-lg h-12 px-4 text-charcoal dark:text-slate-100 focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-cool-gray outline-none uppercase"
            placeholder="Ex: LD-00-00-AA"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="capacidadeTotal" className="text-charcoal dark:text-slate-300 text-sm font-semibold px-1">
            Capacidade do veículo
          </label>
          <div className="relative">
            <input
              id="capacidadeTotal"
              type="number"
              min="2"
              value={capacidadeTotal}
              onChange={(e) => setCapacidadeTotal(e.target.value)}
              className="w-full bg-light-gray dark:bg-slate-800 border-none rounded-lg h-12 px-4 pr-10 text-charcoal dark:text-slate-100 focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-cool-gray outline-none tabular-nums"
              placeholder="5"
              required
            />
            <Armchair
              className="absolute right-4 top-1/2 -translate-y-1/2 text-cool-gray pointer-events-none size-5"
              aria-hidden="true"
            />
          </div>
          <p className="text-xs text-cool-gray dark:text-slate-500 px-1 text-pretty">
            Inclui o teu lugar. {vagasPassageiros != null
              ? `${vagasPassageiros} ${vagasPassageiros === 1 ? 'lugar disponível' : 'lugares disponíveis'} para passageiros.`
              : 'Os lugares para passageiros são o total menos o teu lugar.'}
          </p>
        </div>

        {feedbackVeiculo.message && (
          <div
            role="alert"
            className={`rounded-lg px-4 py-3 text-sm font-medium text-center ${
              feedbackVeiculo.type === 'error'
                ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
            }`}
          >
            {feedbackVeiculo.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoadingVeiculo}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg transition-all active:scale-[0.98] mt-4 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoadingVeiculo ? 'A guardar...' : 'Guardar Veículo'}
        </button>
      </form>

      <div className="flex items-center justify-center gap-2 text-cool-gray dark:text-slate-500 py-4">
        <ShieldCheck className="size-4" aria-hidden="true" />
        <p className="text-[11px] font-medium uppercase">Dados seguros em Luanda</p>
      </div>
    </PageShell>
  );
};

export default VehicleSetup;
