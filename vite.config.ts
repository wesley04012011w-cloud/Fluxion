import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: ['logo.png', 'robots.txt'],
        devOptions: {
          enabled: true,
        },
        manifest: {
          name: "Fluxion AI Studio",
          short_name: "Fluxion",
          description: "Ambiente de desenvolvimento inteligente para Scripts Luau (Roblox)",
          theme_color: "#0F111A",
          background_color: "#0F111A",
          display: "standalone",
          orientation: "any",
          id: "/",
          start_url: "/",
          categories: ["productivity", "utilities", "developer"],
          shortcuts: [
            {
              name: "Novo Script",
              short_name: "Novo",
              url: "/?action=new",
              icons: [{ src: "/logo.png", sizes: "192x192" }]
            }
          ],
          icons: [
            {
              src: '/logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
