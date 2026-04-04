import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'

export default defineConfig(config => {
  return {
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      port: 8080,
      allowedHosts: ['.trycloudflare.com'], // add your production domain here
    },
    build: {
      sourcemap: config.mode === 'development',
    },
    plugins: [
      nitroV2Plugin({
        preset: 'node-server',
        compatibilityDate: '2025-10-04',
      }),
      tanstackStart(),
      viteReact({
        // @ts-ignore - babel-plugin-react-compiler is not typed
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
    ],
    optimizeDeps: {
      include: ['@shopify/app-bridge-react'],
      exclude: [
        // Exclude server-only dependencies from pre-bundling
        'drizzle-orm',
        'pg',
        'bullmq',
        'ioredis',
        '@shopify/shopify-api',
      ],
    },
  }
})
