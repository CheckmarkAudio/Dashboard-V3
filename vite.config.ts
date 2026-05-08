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

// Lean 2 — preview-login lockdown (defense layer 3 / 3).
//
// Vercel sets VERCEL_ENV at build time:
//   - 'production' for the production deployment
//   - 'preview'    for branch previews + PR previews
//   - 'development' for local dev / `vercel dev`
//
// When the build is targeting production we statically replace the
// preview-auto-login env vars with `undefined` so they NEVER end up
// in the production JS bundle, even if some future admin accidentally
// pastes them into Vercel's Production scope. This is the strongest
// of the three guards on the auto-login (the other two — hostname
// match + `VITE_PREVIEW_LOGIN_ALLOWED` runtime check — live in
// src/pages/Login.tsx).
const isVercelProductionBuild = process.env.VERCEL_ENV === 'production'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: BASE_PATH,
  root: 'src',
  envDir: resolve(__dirname),
  publicDir: resolve(__dirname, 'public'),
  define: isVercelProductionBuild
    ? {
        'import.meta.env.VITE_PREVIEW_LOGIN_EMAIL': 'undefined',
        'import.meta.env.VITE_PREVIEW_LOGIN_PASSWORD': 'undefined',
        'import.meta.env.VITE_PREVIEW_LOGIN_ALLOWED': 'undefined',
      }
    : undefined,
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
})
