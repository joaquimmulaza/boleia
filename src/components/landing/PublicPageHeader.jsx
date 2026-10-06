import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/explorar', label: 'Explorar' },
  { href: '#o-que-muda', label: 'O que muda' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#perguntas', label: 'Perguntas' },
];

/**
 * Cabeçalho público em pill glass — landing (nav + auth) ou legal (logo + tema).
 * @param {{ variant?: 'landing' | 'legal' }} props
 */
export default function PublicPageHeader({ variant = 'landing' }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelId = useId();
  const isLanding = variant === 'landing';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    isLanding && typeof document !== 'undefined' && menuOpen
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
              className="fixed top-0 right-0 z-[70] flex h-dvh w-[min(100%,20rem)] flex-col gap-4 border-l border-border bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] shadow-xl md:hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Menu</span>
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-lg hover:bg-accent"
                  aria-label="Fechar menu"
                  onClick={closeMenu}
                >
                  <X size={22} aria-hidden="true" />
                </button>
              </div>

              <nav className="flex flex-col gap-2" aria-label="Secções">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-accent"
                    onClick={closeMenu}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  className="w-full rounded-xl border border-border py-3 text-sm font-bold text-foreground"
                  onClick={() => goAuth('/auth')}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
                  onClick={() => goAuth('/auth?mode=register&role=passenger')}
                >
                  Sou Passageiro
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-primary/40 py-3 text-sm font-bold text-foreground"
                  onClick={() => goAuth('/auth?mode=register&role=driver')}
                >
                  Sou Motorista
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <header className="public-header-shell" data-testid="public-page-header">
      <div
        className={cn('public-header-pill', scrolled && 'is-scrolled')}
        data-variant={variant}
      >
        <a
          href="/"
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          aria-label="Boleia Certa"
        >
          <img src="/boleia-logo.png" alt="" className="size-6 object-contain" aria-hidden="true" />
        </a>

        {isLanding ? (
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="Navegação principal">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : (
          <span className="flex-1" aria-hidden="true" />
        )}

        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          {isLanding ? (
            <>
              <a
                href="/auth"
                className="hidden text-sm font-bold text-foreground transition-colors hover:text-primary md:inline-flex"
              >
                Entrar
              </a>
              <Button
                type="button"
                className="hidden rounded-full md:inline-flex"
                onClick={() => navigate('/auth?mode=register')}
              >
                Criar conta
              </Button>
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-accent md:hidden"
                aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={menuOpen}
                aria-controls={panelId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {menuPortal}
    </header>
  );
}
