import { defineConfig, loadEnv } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function netlifyAuthProxyPlugin(projectId) {
  return {
    name: 'netlify-auth-proxy',
    closeBundle() {
      const lines = [];

      if (projectId) {
        const firebaseHost = `https://${projectId}.firebaseapp.com`;
        lines.push(
          `/__/auth/*  ${firebaseHost}/__/auth/:splat  200!`,
          `/__/firebase/*  ${firebaseHost}/__/firebase/:splat  200!`
        );
      }

      lines.push('/*  /index.html  200');
      writeFileSync(resolve('public/_redirects'), `${lines.join('\n')}\n`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const projectId = env.VITE_FIREBASE_PROJECT_ID;

  return {
    plugins: [
      react(),
      VitePWA({
        injectRegister: false,
        selfDestroying: true,
        includeAssets: [
          'favicon.png',
          'apple-touch-icon.png',
          'apple-touch-icon-180.png',
          'maskable-icon-512.png',
          'splash/*.png',
        ],
        manifest: {
          id: '/',
          name: 'MyWallet',
          short_name: 'MyWallet',
          description: 'Controle financeiro pessoal e gestão de despesas',
          start_url: '/',
          scope: '/',
          lang: 'pt-BR',
          dir: 'ltr',
          display: 'standalone',
          display_override: ['standalone', 'browser'],
          orientation: 'portrait',
          theme_color: '#3e92eb',
          background_color: '#ffffff',
          categories: ['finance', 'productivity'],
          icons: [
            {
              src: 'apple-touch-icon-180.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'favicon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'maskable-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: [],
          navigateFallback: null,
        },
        devOptions: {
          enabled: false,
        },
      }),
      netlifyAuthProxyPlugin(projectId),
    ],
    publicDir: 'static',
    build: {
      outDir: 'public',
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            motion: ['framer-motion'],
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  };
});
