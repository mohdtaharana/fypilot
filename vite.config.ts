import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    build({
      entry: 'src/index.tsx',
    }),
    devServer({
      adapter: () => adapter({ proxy: { configPath: 'wrangler.jsonc', persist: { path: '.wrangler/state/v3' } } }),
      entry: 'src/index.tsx',
    }),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
  },
}))
