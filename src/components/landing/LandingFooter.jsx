import { Link } from 'react-router-dom';

const CONTACT_EMAIL = 'joaquimmulazadev@gmail.com';

/**
 * Footer público — Entrar · Contacto · Privacidade · Eliminação (sem Termos).
 * @typedef {Readonly<{}>} LandingFooterProps
 */
export default function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card px-4 py-10 md:px-[7.5rem]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3">
        <nav
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground"
          aria-label="Rodapé"
        >
          <Link className="hover:text-primary" to="/auth">
            Entrar
          </Link>
          <a className="hover:text-primary" href={`mailto:${CONTACT_EMAIL}`}>
            Contacto
          </a>
          <Link className="hover:text-primary" to="/privacidade">
            Privacidade
          </Link>
          <Link className="hover:text-primary" to="/eliminacao-de-dados">
            Eliminação de dados
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Boleia Certa. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
