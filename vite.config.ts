import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { nitro } from 'nitro/vite'

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
      tanstackStart(),
      nitro(),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    optimizeDeps: {
      exclude: [
        // Exclude server-only dependencies from pre-bundling
        'drizzle-orm',
        'pg',
        '@shopify/shopify-api',
      ],
    },
  }
})
