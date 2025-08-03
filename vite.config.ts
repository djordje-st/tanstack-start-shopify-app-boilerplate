import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 8080,
    allowedHosts: true,
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({ customViteReactPlugin: true }),
    viteReact(),
  ],
  optimizeDeps: {
    include: ['@shopify/app-bridge-react', '@shopify/shopify-api'],
  },
  ssr: {
    noExternal: ['@shopify/shopify-api'],
  },
})
