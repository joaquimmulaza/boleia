import React, { useState, useEffect } from 'react';
import { User, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile, getVehicle, updateVehicle } from '../services/ProfileService';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import LoadingSkeleton from '../components/LoadingSkeleton';

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [profileData, setProfileData] = useState({
    nome_completo: '',
    telefone: '',
    tipo_perfil: 'Passageiro',
    avatar_url: '',
    iban: '',
    iban_titular: '',
  });
  const [vehicleData, setVehicleData] = useState({
    id: null,
    marca_modelo: '',
    matricula: '',
    capacidade_total: ''
  });
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);
        setEmail(user.email);

        const perfil = await getProfile(user.id);
        if (perfil) {
          setProfileData({
            nome_completo: perfil.nome_completo || '',
            telefone: perfil.telefone || '',
            tipo_perfil: perfil.tipo_perfil || 'Passageiro',
            avatar_url: perfil.avatar_url || '',
            iban: perfil.iban || '',
            iban_titular: perfil.iban_titular || '',
          });

          if (perfil.tipo_perfil === 'Motorista') {
            const veiculo = await getVehicle(user.id);
            if (veiculo) {
              setVehicleData({
                id: veiculo.id,
                marca_modelo: veiculo.marca_modelo || '',
                matricula: veiculo.matricula || '',
                capacidade_total: veiculo.capacidade_total || ''
              });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, []);

  const handleChangeProfile = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handleChangeVehicle = (e) => {
    setVehicleData({ ...vehicleData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      /** @type {Record<string, string>} */
      const updates = {
        nome_completo: profileData.nome_completo,
        telefone: profileData.telefone,
      };
      if (profileData.tipo_perfil === 'Motorista') {
        updates.iban = profileData.iban.trim();
        updates.iban_titular = profileData.iban_titular.trim();
      }
      await updateProfile(userId, updates);

      if (profileData.tipo_perfil === 'Motorista') {
        await updateVehicle(userId, vehicleData.id, {
          marca_modelo: vehicleData.marca_modelo,
          matricula: vehicleData.matricula,
          capacidade_total: parseInt(vehicleData.capacidade_total, 10),
          vagas_passageiros: parseInt(vehicleData.capacidade_total, 10) - 1,
        });
      }

      setFeedback({ type: 'success', text: 'Perfil actualizado com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      setFeedback({ type: 'error', text: 'Erro ao guardar alterações.' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingSkeleton variant="profile" />
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-32">
      <PageHeader title="O Meu Perfil" subtitle={`Conta de ${profileData.tipo_perfil}`} />

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="flex flex-col items-center justify-center">
          <div className="relative">
            <div className="size-24 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-white dark:border-background-dark shadow-md flex items-center justify-center overflow-hidden">
              {profileData.avatar_url ? (
                <img src={profileData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-slate-400" aria-hidden="true" />
              )}
            </div>
          </div>
          <p className="mt-4 font-bold text-lg">{profileData.nome_completo || 'Utilizador'}</p>
        </div>

        {feedback && (
          <div
            role="alert"
            className={`p-4 rounded-xl text-sm font-semibold text-center ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400'}`}
          >
            {feedback.text}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase px-1">Dados Pessoais</h3>
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-50 dark:border-slate-700/50 flex flex-col gap-1">
              <label htmlFor="nome_completo" className="text-xs font-semibold text-slate-500 block">Nome Completo</label>
              <input
                id="nome_completo"
                type="text"
                name="nome_completo"
                value={profileData.nome_completo}
                onChange={handleChangeProfile}
                className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-0 p-0"
                placeholder="O teu nome"
                required
              />
            </div>
            <div className="p-4 border-b border-slate-50 dark:border-slate-700/50 flex flex-col gap-1">
              <label htmlFor="telefone" className="text-xs font-semibold text-slate-500 block">Telefone</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-900 dark:text-slate-100 font-medium">+244</span>
                <input
                  id="telefone"
                  type="tel"
                  name="telefone"
                  value={profileData.telefone.replace('+244', '')}
                  onChange={(e) => handleChangeProfile({ target: { name: 'telefone', value: `+244${e.target.value}` } })}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-0 p-0"
                  placeholder="9XX XXX XXX"
                  required
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col gap-1">
              <label htmlFor="email" className="text-xs font-semibold text-slate-500 block">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                readOnly
                disabled
                className="w-full bg-transparent border-none text-slate-400 font-medium focus:outline-none focus:ring-0 p-0 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {profileData.tipo_perfil === 'Motorista' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase px-1">Dados bancários</h3>
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-50 dark:border-slate-700/50 flex flex-col gap-1">
                <label htmlFor="iban_titular" className="text-xs font-semibold text-slate-500 block">
                  Titular da conta
                </label>
                <input
                  id="iban_titular"
                  type="text"
                  name="iban_titular"
                  value={profileData.iban_titular}
                  onChange={handleChangeProfile}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-0 p-0"
                  placeholder="Nome completo do titular"
                />
              </div>
              <div className="p-4 flex flex-col gap-1">
                <label htmlFor="iban" className="text-xs font-semibold text-slate-500 block">IBAN</label>
                <input
                  id="iban"
                  type="text"
                  name="iban"
                  value={profileData.iban}
                  onChange={handleChangeProfile}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-0 p-0 font-mono uppercase"
                  placeholder="AO06…"
                />
              </div>
            </div>
          </div>
        )}

        {profileData.tipo_perfil === 'Motorista' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase px-1">Dados do Veículo</h3>
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-50 dark:border-slate-700/50 flex flex-col gap-1">
                <label htmlFor="marca_modelo" className="text-xs font-semibold text-slate-500 block">Marca/Modelo</label>
                <input
                  id="marca_modelo"
                  type="text"
                  name="marca_modelo"
                  value={vehicleData.marca_modelo}
                  onChange={handleChangeVehicle}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-0 p-0"
                  placeholder="Ex: Toyota Hiace"
                  required
                />
              </div>
              <div className="p-4 border-b border-slate-50 dark:border-slate-700/50 flex flex-col gap-1">
                <label htmlFor="matricula" className="text-xs font-semibold text-slate-500 block">Matrícula</label>
                <input
                  id="matricula"
                  type="text"
                  name="matricula"
                  value={vehicleData.matricula}
                  onChange={handleChangeVehicle}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-0 p-0 uppercase"
                  placeholder="LD-00-00-AA"
                  required
                />
              </div>
              <div className="p-4 flex flex-col gap-1">
                <label htmlFor="capacidade_total" className="text-xs font-semibold text-slate-500 block">Capacidade do veículo</label>
                <input
                  id="capacidade_total"
                  type="number"
                  name="capacidade_total"
                  value={vehicleData.capacidade_total}
                  onChange={handleChangeVehicle}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-0 p-0 tabular-nums"
                  placeholder="Ex: 5"
                  min="2"
                  required
                />
              </div>
            </div>
          </div>
        )}

        <div className="fixed bottom-24 left-0 right-0 px-6 flex justify-center z-header pointer-events-none">
          <div className="w-full max-w-md mx-auto pointer-events-auto">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all duration-200 active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {saving ? (
                <>
                  <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                  A guardar...
                </>
              ) : (
                'Guardar Alterações'
              )}
            </button>
          </div>
        </div>
      </form>
    </PageShell>
  );
};

export default Profile;
