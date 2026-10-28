import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// FLIP: el cliente React es la app principal en /. La base /
// hace que los assets del build salgan como /assets/*, que es
// lo que sirve routes.ts (la vanilla quedó en /vanilla/).
const clientDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: clientDir,
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.join(clientDir, 'dist'),
    emptyOutDir: true,
  },
});
