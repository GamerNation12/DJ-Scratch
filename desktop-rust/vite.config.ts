import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../src-tauri/build',
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
