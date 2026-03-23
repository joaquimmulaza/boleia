import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { validateTelefone } from '../utils/validation';

export const useAuthForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialMode = searchParams.get('mode');
  const initialRole = searchParams.get('role');

  const [isLogin, setIsLogin] = useState(initialMode !== 'register');
  const [profileType, setProfileType] = useState(initialRole === 'driver' ? 'Motorista' : 'Passageiro');

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const currentMode = searchParams.get('mode');
    const currentRole = searchParams.get('role');

    if (currentMode === 'register') setIsLogin(false);
    if (currentRole === 'driver') setProfileType('Motorista');
    if (currentRole === 'passenger') setProfileType('Passageiro');
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setErrors({});
    setIsLoading(true);

    if (!isLogin && !validateTelefone(telefone)) {
      setErrors((prev) => ({
        ...prev,
        telefone: 'Número de telefone inválido. Use o formato: +244 9XXXXXXXX'
      }));
      setIsLoading(false);
      return;
    }

    let error;
    let sessionUser = null;

    if (isLogin) {
      const result = await supabase.auth.signInWithPassword({ email, password });
      error = result.error;
      sessionUser = result.data?.user;
    } else {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            tipo_perfil: profileType,
            nome_completo: nome,
            telefone: telefone,
          },
        },
      });
      error = result.error;
      sessionUser = result.data?.user;
    }

    setIsLoading(false);

    if (error) {
      setFeedback({ type: 'error', message: error.message });
    } else if (!isLogin) {
      setFeedback({ type: 'success', message: 'Registo efetuado! Verifique o seu email para confirmar a conta.' });

      const tipoPerfil = sessionUser?.user_metadata?.tipo_perfil || profileType;
      setTimeout(() => {
        if (tipoPerfil === 'Motorista') {
          navigate('/motorista');
        } else {
          navigate('/passageiro');
        }
      }, 1000);
    } else {
      setFeedback({ type: 'success', message: 'Bem-vindo de volta!' });

      const tipoPerfil = sessionUser?.user_metadata?.tipo_perfil || 'Passageiro';
      setTimeout(() => {
        if (tipoPerfil === 'Motorista') {
          navigate('/motorista');
        } else {
          navigate('/passageiro');
        }
      }, 1000);
    }
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setFeedback({ type: '', message: '' });
    setErrors({});
    setNome('');
    setTelefone('');
    setPassword('');
    setProfileType('Passageiro');
  };

  return {
    isLogin,
    profileType,
    showPassword,
    email,
    password,
    nome,
    telefone,
    feedback,
    errors,
    isLoading,
    setEmail,
    setPassword,
    setNome,
    setTelefone,
    setProfileType,
    setShowPassword,
    setErrors,
    handleSubmit,
    handleToggleMode,
  };
};
