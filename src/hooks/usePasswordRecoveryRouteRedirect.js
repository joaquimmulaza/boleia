import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildRecoveryAuthPath,
  shouldRedirectRecoveryToAuth,
} from '../utils/passwordRecoveryRedirect';

/**
 * Redirecciona links de recovery antigos que aterram na raiz com tokens no hash.
 */
export function usePasswordRecoveryRouteRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!shouldRedirectRecoveryToAuth(location)) return;
    navigate(buildRecoveryAuthPath(location), { replace: true });
  }, [location, navigate]);
}
