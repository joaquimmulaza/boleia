import LandingHeader from '../components/landing/LandingHeader';
import LandingHero from '../components/landing/LandingHero';
import LandingHowItWorks from '../components/landing/LandingHowItWorks';
import LandingBenefits from '../components/landing/LandingBenefits';
import LandingSecurity from '../components/landing/LandingSecurity';
import LandingCta from '../components/landing/LandingCta';
import LandingFooter from '../components/landing/LandingFooter';

/**
 * Landing pública — composição das secções marketplace.
 * @typedef {Readonly<{}>} LandingPageProps
 */
export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingHowItWorks />
        <LandingBenefits />
        <LandingSecurity />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
