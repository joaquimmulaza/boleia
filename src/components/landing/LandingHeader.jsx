import PublicPageHeader from './PublicPageHeader';

/**
 * Header da landing pública — reutiliza PublicPageHeader (variant landing).
 * @typedef {Readonly<{}>} LandingHeaderProps
 */
export default function LandingHeader() {
  return <PublicPageHeader variant="landing" />;
}
