import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Verifica se a run atual contém ficheiros .integration.test no processo arguments
  const isIntegrationTest = process.argv.some(arg => arg.includes('integration.test'));
  
  if (isIntegrationTest) {
    // Carrega explicitamente o .env.test.local para o process.env
    const envData = loadEnv('test.local', process.cwd(), '');
    Object.assign(process.env, envData);
  }

  return {
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'autoUpdate',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        },
        includeAssets: ['pwa-512x512.png'],
        manifest: {
          name: 'Boleia Certa',
          short_name: 'Boleia',
          description: 'A tua aplicação de boleias partilhadas em Luanda.',
          theme_color: '#10b981',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: './src/setupTests.js',
      // Passar as variáveis relevantes explicitamente para o ambiente de testes
      env: isIntegrationTest ? {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
      } : {}
    }
  }
})
