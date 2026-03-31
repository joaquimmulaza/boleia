import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { validateTelefone, validatePassword } from '../utils/validation';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

export const useAuthForm = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialIsLogin = queryParams.get('mode') !== 'register';
  const initialRole = queryParams.get('role') === 'driver' ? 'Motorista' : 'Passageiro';

  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [profileType, setProfileType] = useState(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setErrors({});
    setIsLoading(true);

    if (!isLogin) {
      let hasError = false;
      const newErrors = {};

      if (!validateTelefone(telefone)) {
        newErrors.telefone = 'Número de telefone inválido. Use o formato: +244 9XXXXXXXX';
        hasError = true;
      }

      if (!validatePassword(password)) {
        newErrors.password = 'A palavra-passe deve ter pelo menos 8 caracteres';
        hasError = true;
      }

      if (hasError) {
        setErrors((prev) => ({ ...prev, ...newErrors }));
        setIsLoading(false);
        return;
      }
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
      setFeedback({ type: 'error', message: getFriendlyErrorMessage(error) });
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
