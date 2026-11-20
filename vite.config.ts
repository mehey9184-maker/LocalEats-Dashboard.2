import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {assertMerchantStagingBuild} from './scripts/merchant-staging-guard.mjs';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Only the dedicated staging build mode applies strict isolation; ordinary
  // Production/Preview source and original UI remain unchanged.
  // Never fall back to the bundled Production Firebase project when the
  // dedicated staging Vercel project accidentally uses the default build.
  if (mode === 'merchant-staging' ||
      env.LOCALEATS_STAGING_ONLY === 'true' ||
      env.VITE_MERCHANT_STAGING_ONLY === 'true') {
    assertMerchantStagingBuild(mode, env, process.env);
  }
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        manifest: {
          short_name: "LocalEats Shop",
          name: "LocalEats Merchant Dashboard",
          icons: [
            {
              src: "/pwa-icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/pwa-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            }
          ],
          start_url: "/",
          background_color: "#faf9f8",
          display: "standalone",
          theme_color: "#FF5A36",
          description: "LocalEats Merchant Dashboard for managing your shop, menu and pickup preparation."
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        }
      })
    ],
    build: {
      chunkSizeWarningLimit: 1000,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
