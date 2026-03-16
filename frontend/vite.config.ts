import { defineConfig } from 'vite';
import type { UserConfig as ViteUserConfig } from 'vite';
import type { UserConfig as VitestUserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const config = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['mac'],
  },
  test: {
    environment: 'jsdom',
  },
} satisfies ViteUserConfig & { test: VitestUserConfig['test'] };

export default defineConfig(config);
