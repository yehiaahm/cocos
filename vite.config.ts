/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    cssMinify: true,
    // Original photos stay in public/images; only optimised WebP is referenced by the UI.
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Framework code changes rarely; a separate chunk stays cached across site updates.
        manualChunks: (id) => (/node_modules[\\/](react|react-dom|react-router|scheduler|zustand)[\\/]/.test(id) ? 'vendor' : undefined),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
});
