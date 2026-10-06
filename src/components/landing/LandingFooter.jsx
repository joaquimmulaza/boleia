import { Link } from 'react-router-dom';

const CONTACT_EMAIL = 'joaquimmulazadev@gmail.com';

const FOOTER_COLUMNS = [
  {
    title: 'Passageiro',
    links: [
      { label: 'Explorar boleias', href: '/explorar', isRouter: true },
      { label: 'Criar conta', href: '/auth?mode=register', isRouter: true },
      { label: 'Entrar', href: '/auth', isRouter: true },
    ],
  },
  {
    title: 'Motorista',
    links: [
      { label: 'Publicar oferta', href: '/publicar-trajeto', isRouter: true },
      { label: 'Sou Motorista', href: '/auth?mode=register&role=driver', isRouter: true },
    ],
  },
  {
    title: 'Geral',
    links: [
      { label: 'Contacto', href: `mailto:${CONTACT_EMAIL}`, isRouter: false },
      { label: 'Privacidade', href: '/privacidade', isRouter: true },
      { label: 'Eliminação de dados', href: '/eliminacao-de-dados', isRouter: true },
    ],
  },
];

/**
 * Footer público — três colunas (stack em mobile); sem Termos.
 * @typedef {Readonly<{}>} LandingFooterProps
 */
export default function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card px-4 py-10 md:px-[7.5rem]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-foreground">{column.title}</h2>
              <nav className="flex flex-col gap-2" aria-label={column.title}>
                {column.links.map((link) =>
                  link.isRouter ? (
                    <Link
                      key={link.label}
                      to={link.href}
                      className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.label}
                      href={link.href}
                      className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </a>
                  ),
                )}
              </nav>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Boleia Certa. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
