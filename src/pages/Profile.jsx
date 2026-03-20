import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile, getVehicle, updateVehicle } from '../services/ProfileService';

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [profileData, setProfileData] = useState({
    nome_completo: '',
    telefone: '',
    tipo_perfil: 'Passageiro',
    avatar_url: ''
  });
  const [vehicleData, setVehicleData] = useState({
    id: null,
    marca_modelo: '',
    matricula: '',
    lugares_disponiveis: ''
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
            avatar_url: perfil.avatar_url || ''
          });

          if (perfil.tipo_perfil === 'Motorista') {
            const veiculo = await getVehicle(user.id);
            if (veiculo) {
              setVehicleData({
                id: veiculo.id,
                marca_modelo: veiculo.marca_modelo || '',
                matricula: veiculo.matricula || '',
                lugares_disponiveis: veiculo.lugares_disponiveis || ''
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
      await updateProfile(userId, {
        nome_completo: profileData.nome_completo,
        telefone: profileData.telefone
      });

      if (profileData.tipo_perfil === 'Motorista') {
        await updateVehicle(userId, vehicleData.id, {
          marca_modelo: vehicleData.marca_modelo,
          matricula: vehicleData.matricula,
          lugares_disponiveis: parseInt(vehicleData.lugares_disponiveis, 10)
        });
      }

      setFeedback({ type: 'success', text: 'Perfil atualizado com sucesso!' });
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
      <div className="flex h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="font-['Plus_Jakarta_Sans',_sans-serif] bg-background-light dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen flex flex-col antialiased pb-24 relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-primary/10 px-4 py-3">
        <div className="flex items-center justify-center max-w-md mx-auto relative">
          <h1 className="text-lg font-bold tracking-tight">Meu Perfil</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full pt-8 px-5">
        <form onSubmit={handleSubmit} className="space-y-8 pb-32">

          {/* Avatar Section */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-md flex items-center justify-center overflow-hidden">
                {profileData.avatar_url ? (
                  <img src={profileData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-5xl text-slate-400">person</span>
                )}
              </div>
              <button
                type="button"
                className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg hover:bg-primary/90 transition-transform active:scale-95"
                aria-label="Alterar foto de perfil"
              >
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              </button>
            </div>
            <p className="mt-4 font-bold text-lg">{profileData.nome_completo || 'Utilizador'}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full mt-2">
              Conta de {profileData.tipo_perfil}
            </p>
          </div>

          {feedback && (
            <div className={`p-4 rounded-xl text-sm font-semibold text-center ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {feedback.text}
            </div>
          )}

          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">Dados Pessoais</h3>

            <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">

              <div className="p-4 border-b border-slate-50 dark:border-slate-700/50 flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 block">Nome Completo</label>
                <input
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
                <label className="text-xs font-semibold text-slate-500 block">Telefone</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 dark:text-slate-100 font-medium">+244</span>
                  <input
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
                <label className="text-xs font-semibold text-slate-500 block">Email</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="w-full bg-transparent border-none text-slate-400 font-medium focus:outline-none focus:ring-0 p-0 cursor-not-allowed"
                />
              </div>

            </div>
          </div>

          {/* Dados do Veículo (Apenas Motorista) */}
          {profileData.tipo_perfil === 'Motorista' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">Dados do Veículo</h3>

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
                  <label htmlFor="lugares_disponiveis" className="text-xs font-semibold text-slate-500 block">Nº de Lugares Disponíveis</label>
                  <input
                    id="lugares_disponiveis"
                    type="number"
                    name="lugares_disponiveis"
                    value={vehicleData.lugares_disponiveis}
                    onChange={handleChangeVehicle}
                    className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-0 p-0"
                    placeholder="Ex: 4"
                    min="1"
                    required
                  />
                </div>

              </div>
            </div>
          )}

          <div className="fixed bottom-24 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
            <div className="w-full max-w-[480px] mx-auto pointer-events-auto">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-primary hover:bg-primary/90 active:bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all duration-200 active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                    A guardar...
                  </>
                ) : (
                  'Guardar Alterações'
                )}
              </button>
            </div>
          </div>

        </form>
      </main>
    </div>
  );
};

export default Profile;
