import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * ProtectedRoute – Auth Guard com suporte a RBAC.
 *
 * @param {{ allowedRole?: 'Passageiro' | 'Motorista' }} props
 *   - allowedRole: se fornecido, o utilizador deve ter este tipo_perfil.
 *     Se omitido, qualquer utilizador autenticado pode aceder.
 */
const ProtectedRoute = ({ allowedRole }) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'auth' | 'wrong-role' | 'ok'
  const [redirectPath, setRedirectPath] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const checkAccess = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!isMounted) return;

      // 1. Sem sessão → redireciona para login
      if (error || !user) {
        setRedirectPath('/auth');
        setStatus('redirect');
        return;
      }

      // 2. Com sessão mas role inválido → redireciona para o dashboard correto
      if (allowedRole) {
        const tipoPerfil = user.user_metadata?.tipo_perfil;
        if (tipoPerfil !== allowedRole) {
          const correctPath = tipoPerfil === 'Motorista' ? '/motorista' : '/passageiro';
          setRedirectPath(correctPath);
          setStatus('redirect');
          return;
        }
      }

      // 3. Tudo correto → renderiza o conteúdo protegido
      setStatus('ok');
    };

    checkAccess();
    return () => { isMounted = false; };
  }, [allowedRole]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        A verificar sessão...
      </div>
    );
  }

  if (status === 'redirect') {
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
