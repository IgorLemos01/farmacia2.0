import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),       // Landing page
        sistema: resolve(__dirname, 'sistema.html'),  // Área interna (sistema de gestão)
      }
    }
  },
  server: {
    port: 5173
  },
  test: {
    environment: 'jsdom'
  }
});
