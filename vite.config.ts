import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Base path for the built app.
//
//  - Vercel (primary host) serves from the domain root, so the default
//    is '/'.
//  - The legacy GitHub Pages workflow still overrides this during the
//    transition by setting VITE_BASE_PATH=/Dashboard-V3/ before
//    `npm run build`. Once Vercel is the single source of truth, the
//    override and the workflow can both be removed.
//
// Note: the old `deployToRoot` plugin that copied `dist/` into the repo
// root has been removed. It existed only for the GitHub Pages
// "serve from branch root" setup, and it's the mechanism that caused
// local `npm run build` to silently ship to production. Vercel builds
// from source on push, so no copy step is needed.
const BASE_PATH = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: BASE_PATH,
  root: 'src',
  envDir: resolve(__dirname),
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
})
