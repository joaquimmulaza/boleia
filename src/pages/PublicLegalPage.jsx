import { Link } from 'react-router-dom';
import BrandLockup from '../components/BrandLockup';
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
    <div className="relative flex min-h-dvh w-full flex-col bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <header className="border-b border-[#e2e8e5] bg-white dark:border-slate-800 dark:bg-background-dark">
        <Link to="/" className="flex h-[52px] w-full items-center gap-2 px-4">
          <BrandLockup withName />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 space-y-3 p-4">
        <h1 className="text-[22px] font-bold leading-[30px]">{content.title}</h1>
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-[15px] leading-[22px]">
            {paragraph}
          </p>
        ))}
      </main>
      <LandingFooter />
    </div>
  );
}
