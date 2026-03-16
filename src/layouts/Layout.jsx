import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Search, CarFront, User, HandshakeIcon, CalendarX2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Layout global que envolve todas as páginas autenticadas.
 * Inclui o cabeçalho com logout e a BottomBar de navegação inferior.
 * A navegação é condicional pelo papel (Motorista / Passageiro).
 */
const Layout = () => {
  const navigate = useNavigate();
  const [tipoPerfil, setTipoPerfil] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted && session) {
        setTipoPerfil(session.user?.user_metadata?.tipo_perfil ?? null);
      }
    };
    loadSession();
    return () => { isMounted = false; };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const isMotorista = tipoPerfil === 'Motorista';

  /** Classe CSS partilhada para cada item de nav */
  const navItemClass = ({ isActive }) =>
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
      isActive ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-800'
    }`;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Barra de topo com botão de Logout */}
      <header className="flex items-center justify-end px-4 pt-3 pb-1 bg-white border-b border-gray-100 max-w-md mx-auto w-full">
        <button
          onClick={handleLogout}
          aria-label="Terminar sessão"
          className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors text-xs font-semibold py-1.5 px-3 rounded-full hover:bg-red-50"
        >
          <LogOut size={15} strokeWidth={2} />
          <span>Sair</span>
        </button>
      </header>

      {/* Área de Conteúdo */}
      <main className="flex-1 overflow-y-auto pb-16 bg-white sm:pb-20">
        <div className="w-full h-full min-h-full max-w-md mx-auto relative flex flex-col">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom Navigation ─────────────────────────────────────────── */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 w-full bg-gray-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-gray-100 pb-safe z-50"
      >
        <div className="flex justify-around items-center h-16 sm:h-20 max-w-md mx-auto px-2">
          {isMotorista ? (
            // ── Navegação do Motorista ──────────────────────────────────
            <>
              <NavLink to="/motorista" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <CarFront size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Início</span>
                  </>
                )}
              </NavLink>

              <NavLink to="/acordos" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <HandshakeIcon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Acordos</span>
                  </>
                )}
              </NavLink>

              <NavLink to="/faltas" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <CalendarX2 size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Faltas</span>
                  </>
                )}
              </NavLink>

              <NavLink to="/perfil" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <User size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Perfil</span>
                  </>
                )}
              </NavLink>
            </>
          ) : (
            // ── Navegação do Passageiro ─────────────────────────────────
            <>
              <NavLink to="/passageiro" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <Search size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Início</span>
                  </>
                )}
              </NavLink>

              <NavLink to="/acordos" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <HandshakeIcon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Acordos</span>
                  </>
                )}
              </NavLink>

              <NavLink to="/faltas" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <CalendarX2 size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Faltas</span>
                  </>
                )}
              </NavLink>

              <NavLink to="/perfil" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <User size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Perfil</span>
                  </>
                )}
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
