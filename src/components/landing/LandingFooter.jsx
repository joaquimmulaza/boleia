import { Link } from 'react-router-dom';

/**
 * Footer da landing — sem Blog; links honestos.
 * @typedef {Readonly<{}>} LandingFooterProps
 */
export default function LandingFooter() {
  return (
    <footer className="border-t border-primary/10 bg-background-light px-4 py-12 dark:bg-background-dark">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
        <div className="flex items-center">
          <img src="/boleia-logo.png" alt="Boleia Certa" className="h-8 w-auto object-contain" />
        </div>
        <nav className="flex flex-wrap justify-center gap-6 text-sm text-slate-500" aria-label="Rodapé">
          <Link className="hover:text-primary" to="/auth">
            Entrar
          </Link>
          <a className="hover:text-primary" href="mailto:contacto@boleiacerta.ao">
            Contacto
          </a>
          <a className="hover:text-primary" href="mailto:contacto@boleiacerta.ao?subject=Termos%20de%20uso">
            Termos
          </a>
          <a
            className="hover:text-primary"
            href="mailto:contacto@boleiacerta.ao?subject=Privacidade"
          >
            Privacidade
          </a>
        </nav>
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} Boleia Certa. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
