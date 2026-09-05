import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';

const NAV_LINKS = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#vantagens', label: 'Vantagens' },
  { href: '#seguranca', label: 'Segurança' },
];

/**
 * Header da landing pública — nav desktop, menu mobile (portal) e ThemeToggle.
 * @typedef {Readonly<{}>} LandingHeaderProps
 */
export default function LandingHeader() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  /**
   * @param {string} path
   */
  const goAuth = (path) => {
    closeMenu();
    navigate(path);
  };

  const menuPortal =
    typeof document !== 'undefined' && menuOpen
      ? createPortal(
          <>
            <div
              data-testid="landing-menu-overlay"
              className="fixed inset-0 z-[60] bg-black/40 md:hidden"
              onClick={closeMenu}
              aria-hidden="true"
            />
            <div
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegação"
              className="fixed top-0 right-0 z-[70] flex h-dvh w-[min(100%,20rem)] flex-col gap-6 border-l border-primary/10 bg-background-light p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] shadow-xl md:hidden dark:bg-background-dark"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Menu</span>
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-lg hover:bg-primary/10"
                  aria-label="Fechar menu"
                  onClick={closeMenu}
                >
                  <X size={22} aria-hidden="true" />
                </button>
              </div>

              <nav className="flex flex-col gap-4" aria-label="Secções">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-base font-medium text-slate-800 hover:text-primary dark:text-slate-100"
                    onClick={closeMenu}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-3">
                <button
                  type="button"
                  className="w-full rounded-xl border border-primary/30 py-3 text-sm font-bold text-slate-900 dark:text-white"
                  onClick={() => goAuth('/auth')}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-slate-900"
                  onClick={() => goAuth('/auth?mode=register&role=passenger')}
                >
                  Sou Passageiro
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-primary/40 py-3 text-sm font-bold text-slate-900 dark:text-white"
                  onClick={() => goAuth('/auth?mode=register&role=driver')}
                >
                  Sou Motorista
                </button>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-primary/10 bg-background-light p-4 font-display md:px-8 dark:bg-background-dark">
      <a href="/" className="flex items-center" aria-label="Boleia Certa início">
        <img src="/boleia-logo.png" alt="Boleia Certa" className="h-10 w-auto object-contain" />
      </a>

      <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-slate-700 transition-colors hover:text-primary dark:text-slate-200"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <a
          href="/auth"
          className="hidden text-sm font-bold text-slate-900 transition-colors hover:text-primary md:inline-flex dark:text-slate-100"
        >
          Entrar
        </a>
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-lg text-slate-900 hover:bg-primary/10 md:hidden dark:text-slate-100"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls={panelId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>

      {menuPortal}
    </header>
  );
}
