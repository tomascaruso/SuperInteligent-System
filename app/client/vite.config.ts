import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Fase 2: el cliente React se sirve en /v2/ (convivencia con el
// vanilla de /). La base /v2/ hace que los assets del build
// salgan como /v2/assets/*, que es lo que sirve routes.ts.
const clientDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: clientDir,
  base: '/v2/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.join(clientDir, 'dist'),
    emptyOutDir: true,
  },
});
