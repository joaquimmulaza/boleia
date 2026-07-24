import { useNavigate } from 'react-router-dom';
import { Menu, Search, Handshake, PiggyBank, Bus, Clock } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
      <header className="flex items-center bg-background-light dark:bg-background-dark p-4 md:px-8 justify-between border-b border-primary/10">
        <div className="flex items-center gap-2">
          <img src="/boleia-logo.png" alt="Boleia Certa" className="h-10 w-auto object-contain" />
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">
            Boleia Certa
          </h2>
        </div>
        <nav className="hidden md:flex gap-6 items-center">
          <a className="text-sm font-medium hover:text-primary transition-colors" href="#">Como funciona</a>
          <a className="text-sm font-medium hover:text-primary transition-colors" href="#">Vantagens</a>
          <a className="text-sm font-medium hover:text-primary transition-colors" href="#">Segurança</a>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="text-slate-900 dark:text-slate-100 flex size-10 items-center justify-center md:hidden">
            <Menu size={24} />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="@container">
          <div className="flex flex-col gap-8 px-4 py-12 @[480px]:px-8 @[864px]:flex-row @[864px]:py-20 max-w-7xl mx-auto">
            <div
              className="w-full bg-center bg-no-repeat aspect-video bg-cover rounded-xl shadow-xl shadow-primary/5 @[480px]:h-auto @[480px]:min-w-[400px] @[864px]:w-1/2 overflow-hidden border-4 border-white dark:border-slate-800"
              style={{
                backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuBjRxDuX8U3mCTz8mhdYPDYtS_fqJ607ZFI4UXGKOFGpes0OsF5uQzsTiHgv0cVKxlQ8FlcOh0dCquc9G71l-LxzUa6qmeJB1tzKGTDnAstdWTHv8Ma1b6Y3Odhk93mfzkxjHN2G95cDij4eT8BUKZGVroobGjwz02HiZIhxs2JcBWZncC1m1XJbDtmWR8t0oXjVV99Axd3h32QN7-Pwzr7eBcXaiIFegxZwXUsL0yqB0k8FB_p1ibG7qClrL-I-zrXFRO7t2d90x9l")`,
              }}
              role="img"
              aria-label="People sharing a car ride comfortably smiling"
            ></div>
            <div className="flex flex-col gap-6 @[480px]:min-w-[400px] @[480px]:gap-8 @[864px]:justify-center @[864px]:w-1/2">
              <div className="flex flex-col gap-4 text-left">
                <h1 className="text-slate-900 dark:text-slate-100 text-4xl font-black leading-tight tracking-tight @[480px]:text-6xl">
                  Sua rota diária, mais simples e barata.
                </h1>
                <h2 className="text-slate-600 dark:text-slate-400 text-lg font-normal leading-relaxed @[480px]:text-xl max-w-lg">
                  Conectamos você a motoristas para trajetos fixos e acordos mensais. Economize tempo e dinheiro todos os dias.
                </h2>
              </div>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => navigate('/auth?mode=register&role=passenger')}
                  className="flex min-w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-6 bg-primary text-slate-900 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                >
                  Sou Passageiro
                </button>
                <button
                  onClick={() => navigate('/auth?mode=register&role=driver')}
                  className="flex min-w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-6 bg-white dark:bg-slate-800 border-2 border-primary/30 text-slate-900 dark:text-white text-base font-bold transition-all hover:border-primary/60 active:scale-95"
                >
                  Sou Motorista
                </button>
              </div>
            </div>
          </div>
        </div>

        <section className="bg-white dark:bg-slate-900/50 py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col items-center mb-12">
              <h4 className="text-primary text-sm font-extrabold uppercase tracking-widest mb-2">Processo Simples</h4>
              <h3 className="text-slate-900 dark:text-white text-3xl font-bold">Como funciona</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col gap-4 rounded-xl border border-primary/10 bg-background-light dark:bg-slate-800/40 p-8 transition-transform hover:-translate-y-1">
                <div className="bg-primary/10 text-primary w-12 h-12 rounded-lg flex items-center justify-center">
                  <Search size={24} />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-slate-900 dark:text-white text-xl font-bold">Encontre seu trajeto</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    Procure por rotas que coincidam com a sua rotina diária de trabalho ou estudo.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 rounded-xl border border-primary/10 bg-background-light dark:bg-slate-800/40 p-8 transition-transform hover:-translate-y-1">
                <div className="bg-primary/10 text-primary w-12 h-12 rounded-lg flex items-center justify-center">
                  <Handshake size={24} />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-slate-900 dark:text-white text-xl font-bold">Combine o valor</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    Faça acordos diretos e transparentes. Pagamentos mensais facilitam a sua vida.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 rounded-xl border border-primary/10 bg-background-light dark:bg-slate-800/40 p-8 transition-transform hover:-translate-y-1">
                <div className="bg-primary/10 text-primary w-12 h-12 rounded-lg flex items-center justify-center">
                  <PiggyBank size={24} />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-slate-900 dark:text-white text-xl font-bold">Economize mensalmente</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    Reduza drasticamente seus custos com transporte fixo e combustível.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 @container max-w-7xl mx-auto">
          <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-4 max-w-[720px]">
              <h2 className="text-slate-900 dark:text-white text-4xl font-black leading-tight @[480px]:text-5xl tracking-tight">
                Vantagens de dividir a rota
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
                Segurança e economia para o seu dia a dia transformando o trânsito em conexões reais.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="group flex flex-1 gap-4 rounded-xl border border-primary/5 bg-white dark:bg-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-primary bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Bus size={28} />
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-slate-900 dark:text-white text-lg font-bold">Conforto</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Viagens em carros selecionados. Esqueça o aperto do transporte público.
                  </p>
                </div>
              </div>
              <div className="group flex flex-1 gap-4 rounded-xl border border-primary/5 bg-white dark:bg-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-primary bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Clock size={28} />
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-slate-900 dark:text-white text-lg font-bold">Pontualidade</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Horários fixos combinados previamente com seu motorista de confiança.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-primary/10 py-16 px-4">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-8">
            <h2 className="text-slate-900 dark:text-white text-3xl font-bold">Pronto para mudar sua rotina?</h2>
            <p className="text-slate-700 dark:text-slate-300">
              Junte-se a centenas de pessoas que já economizam tempo e dinheiro todos os meses com o Boleia Certa.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <button
                onClick={() => navigate('/auth')}
                className="bg-primary text-slate-900 px-10 py-4 rounded-xl font-bold text-lg hover:brightness-105 transition-all w-full sm:w-auto cursor-pointer"
              >
                Começar agora
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-background-light dark:bg-background-dark border-t border-primary/10 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <img src="/boleia-logo.png" alt="Boleia Certa" className="h-8 w-auto object-contain" />
            <span className="text-slate-900 dark:text-slate-100 font-bold">Boleia Certa</span>
          </div>
          <div className="flex gap-8 text-slate-500 text-sm">
            <a className="hover:text-primary" href="#">Termos</a>
            <a className="hover:text-primary" href="#">Privacidade</a>
            <a className="hover:text-primary" href="#">Contato</a>
            <a className="hover:text-primary" href="#">Blog</a>
          </div>
          <div className="text-slate-400 text-xs">
            © {new Date().getFullYear()} Boleia Certa. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
