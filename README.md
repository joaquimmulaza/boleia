# 🚌 Boleia Certa

> Plataforma de *matchmaking* para rotas de transporte diário e acordos de pagamento partilhado.

**Boleia Certa** liga passageiros e motoristas que partilham o mesmo trajeto diário casa-trabalho. Em vez de os tratar como viagens a pedido, formaliza **acordos de boleia recorrentes** com controlo de presenças, gestão de faltas e notificações em tempo real.

---

## ✨ Funcionalidades Principais

| Funcionalidade | Descrição |
|---|---|
| **Dual Dashboard** | Interfaces separadas para Passageiro e Motorista com fluxos otimizados |
| **Publicação de ofertas** | Motoristas publicam ofertas de capacidade (fixa ou flexível) com autocomplete de endereços via Photon (OpenStreetMap) |
| **Acordos de Boleia** | Sistema de matching com estados `pendente → ativo → cancelado` |
| **Registo de Faltas** | Passageiros e motoristas registam ausências por acordo |
| **Notificações Push** | Alertas em tempo real via Web Push (PWA) com deep linking |
| **Modo Escuro / Claro** | Tema persistente controlado por `ThemeContext` |
| **PWA** | Instalável no telemóvel com Service Worker e suporte offline |

---

## 🛠️ Stack Tecnológica

| Tecnologia | Versão | Utilização |
|---|---|---|
| [React](https://react.dev/) | 19 | UI e componentes |
| [Vite](https://vite.dev/) | 8 | Build & Dev Server |
| [React Router](https://reactrouter.com/) | 7 | Navegação SPA |
| [Tailwind CSS](https://tailwindcss.com/) | 4 | Estilos (mobile-first) |
| [Supabase](https://supabase.com/) | — | Auth, Base de Dados e Edge Functions |
| [Lucide React](https://lucide.dev/) | — | Ícones |
| [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) | — | Testes unitários e de integração |
| [Sentry](https://sentry.io/) | — | Monitorização de erros em produção |
| [Workbox](https://developer.chrome.com/docs/workbox) | 7 | Service Worker (PWA) |
| [Vercel](https://vercel.com/) | — | Alojamento (gratuito) |

---

## ⚙️ Instalação e Configuração

### Pré-requisitos

- [Node.js](https://nodejs.org/) 22 (alinhado com CI)
- [pnpm](https://pnpm.io/) 9 (`packageManager` no `package.json`; Corepack: `corepack enable`)
- Uma conta [Supabase](https://supabase.com/) com projeto criado
- (Opcional) Uma conta [Sentry](https://sentry.io/) para monitorização

### 1. Clonar o repositório

```bash
git clone https://github.com/joaquimmulaza/boleia.git
cd boleia
```

### 2. Instalar dependências

```bash
pnpm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preenche o ficheiro `.env.local` com as tuas credenciais:

```env
# Supabase — Project Settings > API
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here



# Sentry — Settings > Projects > Client Keys (DSN)
VITE_SENTRY_DSN=your-sentry-dsn-here

# Web Push — gerado pelo servidor (VAPID)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key-here
```

> ⚠️ **Nunca** incluas o ficheiro `.env.local` num commit. Está protegido pelo `.gitignore`.

### 4. Iniciar o servidor de desenvolvimento

```bash
pnpm dev
```

A aplicação fica disponível em `http://localhost:5173` (ou no IP da rede local para testes em dispositivos móveis, graças ao flag `--host`).

---

## 🚀 Comandos Disponíveis

```bash
# Servidor de desenvolvimento (acessível na rede local)
pnpm dev

# Correr todos os testes em modo watch
pnpm test

# Correr os testes uma única vez (para CI/CD)
pnpm test:run

# Build de produção
pnpm build

# Pré-visualizar o build de produção
pnpm preview

# Verificar erros de linting
pnpm lint
```

---

## 📁 Estrutura do Projeto

```
boleia/
├── public/                    # Ficheiros estáticos e manifest da PWA
├── src/
│   ├── components/            # Componentes reutilizáveis (+ ui/ primitivos shadcn)
│   │   ├── NotificationBell.jsx     # Central de notificações
│   │   ├── PropostaReviewCard.jsx   # Revisão e aceite de propostas (motorista)
│   │   ├── OpportunityCard.jsx      # Cartões do marketplace /explorar
│   │   ├── ProtectedRoute.jsx       # Guarda de rota com controlo de perfil
│   │   ├── ConfirmationModal.jsx    # Modais de confirmação partilhados
│   │   └── ...
│   ├── contexts/              # Contextos React globais
│   │   ├── AuthContext.jsx    # Sessão, perfil e tipoPerfil
│   │   └── ThemeContext.jsx   # Tema claro/escuro persistente
│   ├── hooks/                 # Custom hooks
│   │   ├── useAutocomplete.js # Autocomplete OD via LocationService (Photon, AO)
│   │   ├── useNotifications.js
│   │   └── usePushNotifications.js
│   ├── layouts/
│   │   └── Layout.jsx         # Shell autenticado + BottomBar
│   ├── lib/
│   │   ├── supabase.js        # Cliente Supabase
│   │   └── utils.js           # cn() e helpers
│   ├── pages/                 # Uma página por rota principal
│   │   ├── LandingPage.jsx
│   │   ├── Auth.jsx
│   │   ├── MarketplaceExplore.jsx   # /explorar (browse público)
│   │   ├── PassengerDashboard.jsx
│   │   ├── DriverDashboard.jsx
│   │   ├── PublishRoute.jsx
│   │   ├── VehicleSetup.jsx
│   │   ├── MyAgreements.jsx         # Gestão de acordos 1:N
│   │   ├── AbsenceTracker.jsx
│   │   ├── Profile.jsx
│   │   └── AdminPagamentos.jsx      # /admin/pagamentos
│   ├── services/              # Supabase / RPC (Oferta, Procura, Agreement, …)
│   ├── utils/                 # pricing, geo, notificationRouter, errorHandler, …
│   ├── sw.js                  # Service Worker (PWA offline)
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   ├── functions/send-push/
│   └── migrations/
├── .env.example
├── .npmrc                     # Hoist Workbox para o SW (pnpm)
├── pnpm-lock.yaml
├── vercel.json                # Headers de segurança + rewrites SPA (sem installCommand)
├── vite.config.js
└── package.json               # packageManager: pnpm@9.15.9
```

---

## 🗺️ Rotas da Aplicação

| Rota | Componente | Acesso |
|---|---|---|
| `/` | `LandingPage` | Público (redireciona se autenticado) |
| `/explorar` | `MarketplaceExplore` | Público (browse); CTAs autenticados |
| `/auth` | `Auth` | Público |
| `/privacidade`, `/eliminacao-de-dados` | `PublicLegalPage` | Público |
| `/passageiro` | `PassengerDashboard` | Perfil: Passageiro |
| `/motorista` | `DriverDashboard` | Perfil: Motorista |
| `/veiculo` | `VehicleSetup` | Perfil: Motorista |
| `/publicar-trajeto` | `PublishRoute` | Perfil: Motorista |
| `/acordos` | `MyAgreements` | Autenticado |
| `/faltas` / `/faltas/:acordoId` | `AbsenceTracker` | Autenticado |
| `/perfil` | `Profile` | Autenticado |
| `/admin/pagamentos` | `AdminPagamentos` | Admin |

---

## 🗄️ Modelo de Dados (Principais Tabelas)

| Tabela | Descrição |
|---|---|
| `perfis` | Dados do utilizador e tipo de perfil (`Passageiro` / `Motorista`) |
| `ofertas_capacidade` | Ofertas do motorista (OD, horário, modo preço, vagas) |
| `procuras` / `grupos` | Procura individual ou em grupo (passageiro) |
| `propostas` / `lista_espera` | Propostas 1:M e waitlist quando N > vagas |
| `acordos` / `acordos_passageiros` | Acordo 1 motorista : N passageiros (preços congelados) |
| `veiculos` | Veículo — `capacidade_total` / `vagas_passageiros` |
| `faltas` | Faltas com desconto por dia útil (quota congelada) |
| `notificacoes` | Notificações in-app com metadata para deep linking |

> **Nota:** Fonte de verdade do domínio = marketplace oferta/procura (não existe tabela `routes`). Geocoding via Photon (OpenStreetMap), filtrado a Angola.

---

## 🔐 Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Chave pública anónima do Supabase |
| `VITE_VAPID_PUBLIC_KEY` | ✅ | Chave pública VAPID para Web Push |
| `VITE_SENTRY_DSN` | ⚠️ Opcional | DSN do Sentry para monitorização de erros |

---

## 🚢 Deploy

O projeto está configurado para deploy automático no **Vercel**. O `vercel.json` define apenas headers de segurança e rewrites SPA — **não** fixa `installCommand`; o Vercel detecta `pnpm-lock.yaml` e usa pnpm (alinhado com CI).

Para fazer deploy manualmente:

```bash
pnpm install --frozen-lockfile
pnpm build
# Faz upload da pasta dist/ ou liga o repositório no Vercel
```

---

## 🧪 Testes

O projeto segue **TDD (Test-Driven Development)** com [Vitest](https://vitest.dev/) e [Testing Library](https://testing-library.com/). Todos os componentes, hooks, services e utilitários têm os respetivos ficheiros de teste co-localizados.

```bash
# Correr os testes em modo watch (desenvolvimento)
pnpm test

# Uma única execução (CI)
pnpm test:run
```