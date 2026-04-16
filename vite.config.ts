import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { mkdirSync, copyFileSync, readdirSync, rmSync } from 'fs'

// Phase 4.3 — NOTE: `dist/`, `assets/`, `index.html`, and `404.html`
// are checked into git on purpose. This repo is deployed to GitHub
// Pages from the repo root (not a `gh-pages` branch), so the built
// artifacts must live alongside the source. The `deployToRoot` plugin
// below is what keeps them in sync: on every `vite build` it copies
// the dist output into the repo root so a plain `git push` publishes
// the new build. Do NOT add `dist/` or `assets/` to `.gitignore` or
// remove this plugin without changing the deploy strategy.
//
// The npm `deploy` script used to re-do this copy in bash after the
// build; that was redundant with this plugin and created ordering
// bugs. The script now just runs `vite build` and trusts the plugin.
function deployToRoot() {
  return {
    name: 'deploy-to-root',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      const rootDir = resolve(__dirname)
      const distAssets = resolve(distDir, 'assets')
      const rootAssets = resolve(rootDir, 'assets')

      const htmlFile = resolve(distDir, 'index.html')
      copyFileSync(htmlFile, resolve(rootDir, 'index.html'))
      copyFileSync(htmlFile, resolve(rootDir, '404.html'))

      try {
        for (const f of readdirSync(rootAssets)) {
          if (f.endsWith('.js') || f.endsWith('.css')) rmSync(resolve(rootAssets, f))
        }
      } catch {}
      mkdirSync(rootAssets, { recursive: true })
      for (const f of readdirSync(distAssets)) {
        copyFileSync(resolve(distAssets, f), resolve(rootAssets, f))
      }
    },
  }
}

// Phase 4.4 — single source for the base path. `VITE_BASE_PATH`
// overrides the default if set (e.g. when deploying to a preview
// subdirectory); the client reads the same value at runtime via
// `import.meta.env.BASE_URL` (Vite exposes `base` there automatically).
const BASE_PATH = process.env.VITE_BASE_PATH ?? '/Dashboard-V3/'

export default defineConfig({
  plugins: [react(), tailwindcss(), deployToRoot()],
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
