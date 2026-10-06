import PublicPageHeader from '../components/landing/PublicPageHeader';
import LandingFooter from '../components/landing/LandingFooter';

const PAGES = {
  privacidade: {
    title: 'Política de privacidade',
    paragraphs: [
      'No início de sessão com conta social, a Boleia Certa guarda o teu nome, o email e a foto de perfil.',
      'Os provedores de início de sessão são Google, Facebook e LinkedIn.',
    ],
  },
  eliminacao: {
    title: 'Eliminação de dados',
    paragraphs: [
      'Podes pedir a eliminação da tua conta e dos dados associados.',
    ],
  },
};

/**
 * Página pública de texto legal. Fora da navegação autenticada.
 * @param {{ page: 'privacidade' | 'eliminacao' }} props
 */
export default function PublicLegalPage({ page }) {
  const content = PAGES[page];

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background-light font-display text-foreground dark:bg-background-dark">
      <PublicPageHeader variant="legal" />
      <main className="public-page-main-offset flex-1 bg-card">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-12 md:px-[7.5rem] md:py-12">
          <div className="max-w-[700px] space-y-5">
            <h1 className="text-4xl font-bold leading-tight">{content.title}</h1>
            {content.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-base leading-6 text-foreground">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
