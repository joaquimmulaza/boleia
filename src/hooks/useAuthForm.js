import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export const useAuthForm = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [profileType, setProfileType] = useState('Passageiro');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setIsLoading(true);

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
    setNome('');
    setTelefone('');
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
    isLoading,
    setEmail,
    setPassword,
    setNome,
    setTelefone,
    setProfileType,
    setShowPassword,
    handleSubmit,
    handleToggleMode,
  };
};
