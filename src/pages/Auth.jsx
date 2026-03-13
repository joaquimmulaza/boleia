import React, { useState } from 'react';
import { Car, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [profileType, setProfileType] = useState('passageiro');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setIsLoading(true);

    let error;

    if (isLogin) {
      const result = await supabase.auth.signInWithPassword({ email, password });
      error = result.error;
    } else {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { user_type: profileType } },
      });
      error = result.error;
    }

    setIsLoading(false);

    if (error) {
      setFeedback({ type: 'error', message: error.message });
    } else if (!isLogin) {
      setFeedback({ type: 'success', message: 'Registo efetuado! Verifique o seu email para confirmar a conta.' });
    } else {
      setFeedback({ type: 'success', message: 'Bem-vindo de volta!' });
    }
  };

  return (
    <div className="font-[Plus Jakarta Sans,sans-serif] min-h-screen bg-white text-gray-800 antialiased flex flex-col items-center justify-center p-0 sm:p-4">
      <div className="relative flex min-h-screen sm:min-h-[812px] max-w-[400px] w-full flex-col bg-white overflow-hidden shadow-none sm:shadow-xl sm:rounded-3xl border-0 sm:border border-gray-100">
        
        {/* Header Section */}
        <div className="flex flex-col items-center pt-16 pb-8 px-8 text-center">
          <div className="text-emerald-500 mb-6 bg-emerald-50 p-4 rounded-full">
            <Car size={40} className="text-emerald-500" />
          </div>
          <h1 className="text-gray-800 text-3xl font-bold tracking-tight mb-2">Boleia Certa</h1>
          <p className="text-gray-500 text-[15px] leading-relaxed max-w-[260px]">
            Mobilidade urbana limpa e partilhada.
          </p>
        </div>

        {/* Profile Toggle */}
        <div className="px-8 mb-8">
          <div className="flex relative h-14 w-full items-center justify-center rounded-full bg-gray-50 p-1.5 border border-gray-200 shadow-inner">
            <label className={`flex h-full grow cursor-pointer items-center justify-center rounded-full px-4 transition-all duration-300 ${profileType === 'passageiro' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>
              <span className="truncate text-sm font-semibold z-10">Sou Passageiro</span>
              <input 
                checked={profileType === 'passageiro'} 
                onChange={() => setProfileType('passageiro')}
                className="sr-only" 
                name="user-type" 
                type="radio" 
                value="passageiro"
                aria-label="Sou Passageiro"
              />
            </label>
            <label className={`flex h-full grow cursor-pointer items-center justify-center rounded-full px-4 transition-all duration-300 ${profileType === 'motorista' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>
              <span className="truncate text-sm font-semibold z-10">Sou Motorista</span>
              <input 
                checked={profileType === 'motorista'} 
                onChange={() => setProfileType('motorista')}
                className="sr-only" 
                name="user-type" 
                type="radio" 
                value="motorista"
                aria-label="Sou Motorista"
              />
            </label>
          </div>
        </div>

        {/* Form elements */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-8 flex-grow">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-gray-500 text-sm font-medium ml-1">Email</label>
            <input 
              id="email"
              className="flex w-full rounded-2xl border border-gray-200 bg-gray-50 text-gray-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 h-14 p-4 text-base outline-none transition-all placeholder:text-gray-400" 
              placeholder="nome@email.com" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center ml-1">
              <label htmlFor="password" className="text-gray-500 text-sm font-medium">Password</label>
            </div>
            <div className="relative flex items-center">
              <input 
                id="password"
                className="flex w-full rounded-2xl border border-gray-200 bg-gray-50 text-gray-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 h-14 p-4 pr-12 text-base outline-none transition-all placeholder:text-gray-400" 
                placeholder="••••••••" 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {isLogin && (
              <div className="flex justify-end mt-1">
                <button type="button" className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                  Esqueceu a palavra-passe?
                </button>
              </div>
            )}
          </div>

          {/* Feedback Message */}
          {feedback.message && (
            <div
              role="alert"
              className={`rounded-xl px-4 py-3 text-sm font-medium text-center transition-all ${
                feedback.type === 'error'
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {feedback.message}
            </div>
          )}
          
          <div className="mt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] active:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'A processar...' : isLogin ? 'Entrar' : 'Registar'}
            </button>
          </div>
        </form>

        {/* Footer Toggle Section */}
        <div className="mt-auto px-8 py-10 pb-12">
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => { setIsLogin(!isLogin); setFeedback({ type: '', message: '' }); }}
              className="text-gray-500 font-medium text-sm hover:text-emerald-600 transition-colors"
            >
              {isLogin ? 'Não tem conta? Criar Conta' : 'Já tem conta? Entrar na minha conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
