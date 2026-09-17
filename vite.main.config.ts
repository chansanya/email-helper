import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { isAbsolute } from 'node:path'

const external = (id: string): boolean =>
  !id.startsWith('.') && !id.startsWith('@shared') && !id.startsWith('@main') && !isAbsolute(id)

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@main': fileURLToPath(new URL('./src/main', import.meta.url))
    }
  },
  build: {
    target: 'node18',
    lib: {
      entry: fileURLToPath(new URL('./src/main/index.ts', import.meta.url)),
      formats: ['cjs'],
      fileName: () => 'index.js'
    },
    outDir: 'dist/main',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: { external }
  }
})
