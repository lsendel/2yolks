import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@2yolks/contracts': path.resolve(__dirname, '../contracts/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
