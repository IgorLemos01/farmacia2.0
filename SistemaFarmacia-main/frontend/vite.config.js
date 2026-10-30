import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  // Caminhos relativos: o site funciona na raiz do domínio ou em uma subpasta
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),       // Landing page
        login: resolve(__dirname, 'login.html'),      // Entrada: fica entre a landing e o sistema
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
