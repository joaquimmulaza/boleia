import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(() => {
  // Verifica se a run atual contém ficheiros .integration.test no processo arguments
  const isIntegrationTest = process.argv.some(arg => arg.includes('integration.test'));
  
  if (isIntegrationTest) {
    // Carrega explicitamente o .env.test.local para o process.env
    const envData = loadEnv('test.local', process.cwd(), '');
    Object.assign(process.env, envData);
  }

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'prompt',
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
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      })
    ],
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: './src/setupTests.js',
      // Stub Supabase para unit tests (CI não precisa de secrets reais)
      env: {
        VITE_SUPABASE_URL: isIntegrationTest
          ? process.env.VITE_SUPABASE_URL
          : 'http://127.0.0.1:54321',
        VITE_SUPABASE_ANON_KEY: isIntegrationTest
          ? process.env.VITE_SUPABASE_ANON_KEY
          : 'test-anon-key-stub-for-vitest',
      },
    }
  }
})
