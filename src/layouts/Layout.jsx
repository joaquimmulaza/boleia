import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, CarFront, Car, User, HandshakeIcon, CalendarX2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../contexts/AuthContext';

/**
 * Layout global que envolve todas as páginas autenticadas.
 * Inclui o cabeçalho com logout e a BottomBar de navegação inferior.
 * A navegação é condicional pelo papel (Motorista / Passageiro).
 */
const Layout = () => {
  const navigate = useNavigate();
  const { tipoPerfil } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const isMotorista = tipoPerfil === 'Motorista';

  /** Classe CSS partilhada para cada item de nav */
  const navItemClass = ({ isActive }) =>
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
      isActive ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
    }`;

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Barra de topo Global com Z-Index elevado (z-[100]) */}
      <header className="sticky top-0 z-[100] flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 max-w-md mx-auto w-full transition-colors shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/10 dark:bg-emerald-500/20 p-1.5 rounded-lg flex items-center justify-center">
            <Car size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">Boleia Certa</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationBell />
          <ThemeToggle />
          <button
            onClick={handleLogout}
            aria-label="Terminar sessão"
            className="flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 ml-1"
            title="Sair"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Área de Conteúdo */}
      <main className="flex-1 overflow-y-auto pb-16 bg-white dark:bg-gray-900 sm:pb-20 transition-colors">
        <div className="w-full h-full min-h-full max-w-md mx-auto relative flex flex-col">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom Navigation ─────────────────────────────────────────── */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 w-full bg-gray-50 dark:bg-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-gray-100 dark:border-gray-700 pb-safe z-50 transition-colors"
      >
        <div className="flex justify-around items-center h-16 sm:h-20 max-w-md mx-auto px-2">
          {isMotorista ? (
            // ── Navegação do Motorista ──────────────────────────────────
            <>
              <NavLink to="/motorista" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <Home size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Início</span>
                  </>
                )}
              </NavLink>

              <NavLink to="/veiculo" className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <CarFront size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] sm:text-xs font-semibold">Veículo</span>
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
                    <Home size={24} strokeWidth={isActive ? 2.5 : 2} />
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
