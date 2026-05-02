import { defineConfig } from 'vite'

// Use relative URLs so GitHub Pages project sites work (e.g. /repo-name/ not site root).
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
})

