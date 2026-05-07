import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages project site base path MUST match repo name.
  base: '/Marshmallow-Tower/',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
})

