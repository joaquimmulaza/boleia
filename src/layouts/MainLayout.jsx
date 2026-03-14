import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Search, CarFront, User } from 'lucide-react';

const MainLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Área de Conteúdo */}
      <main className="flex-1 overflow-y-auto pb-16 bg-white sm:pb-20">
        <div className="w-full h-full min-h-full max-w-md mx-auto relative flex flex-col p-4">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation Fixa */}
      <nav className="fixed bottom-0 w-full bg-gray-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-gray-100 pb-safe z-50">
        <div className="flex justify-around items-center h-16 sm:h-20 max-w-md mx-auto px-2">
          <NavLink
            to="/passageiro"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Search size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] sm:text-xs font-semibold">Procurar</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/motorista"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <CarFront size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] sm:text-xs font-semibold">Viagens</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/perfil"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <User size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] sm:text-xs font-semibold">Perfil</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

export default MainLayout;
