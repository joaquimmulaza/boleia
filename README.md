# 🚌 Boleia Certa

Aplicação mobile-first para gestão de boleias, desenvolvida com React + Vite e autenticação via Supabase.

## 🛠️ Stack Tecnológica

| Tecnologia | Utilização |
|---|---|
| [React 19](https://react.dev/) | UI |
| [Vite 8](https://vite.dev/) | Build & Dev Server |
| [React Router 7](https://reactrouter.com/) | Navegação |
| [Supabase](https://supabase.com/) | Autenticação & Base de Dados |
| [Lucide React](https://lucide.dev/) | Ícones |
| [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) | Testes |
| [Tailwind CSS 4](https://tailwindcss.com/) | Estilos |

---

## ⚙️ Instalação e Configuração

### 1. Clonar o repositório

```bash
git clone https://github.com/teu-usuario/boleia-certa.git
cd boleia-certa
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edita o ficheiro `.env.local` com as tuas credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Como obter as credenciais:** Acede ao teu projeto em [supabase.com](https://supabase.com) → *Project Settings* → *API*.

---

## 🚀 Comandos Disponíveis

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Correr os testes
npm test

# Build para produção
npm run build

# Pré-visualizar o build de produção
npm run preview

# Verificar erros de linting
npm run lint
```

---

## 📁 Estrutura do Projeto

```
boleia-certa/
├── public/              # Ficheiros estáticos
├── src/
│   ├── assets/          # Imagens e recursos
│   ├── layouts/         # Layouts partilhados (MainLayout, etc.)
│   ├── lib/             # Configurações de libs (ex: supabase.js)
│   ├── pages/           # Páginas da aplicação
│   ├── App.jsx          # Componente raiz & routing
│   ├── main.jsx         # Ponto de entrada
│   └── setupTests.js    # Configuração global dos testes
├── .env.example         # Template das variáveis de ambiente
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## 🔐 Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública anónima do Supabase |

> ⚠️ **Nunca** comites o ficheiro `.env.local`. Está incluído no `.gitignore`.

---

## 📄 Licença

Privado — todos os direitos reservados.
