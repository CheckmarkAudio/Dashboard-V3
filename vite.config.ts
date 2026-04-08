import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { mkdirSync, copyFileSync, readdirSync, rmSync } from 'fs'

function deployToRoot() {
  return {
    name: 'deploy-to-root',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      const rootDir = resolve(__dirname)
      const distAssets = resolve(distDir, 'assets')
      const rootAssets = resolve(rootDir, 'assets')

      const htmlFile = resolve(distDir, 'entry.html')
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

export default defineConfig({
  plugins: [react(), tailwindcss(), deployToRoot()],
  base: '/Intern-Dashboard/',
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/entry.html'),
    },
  },
})
