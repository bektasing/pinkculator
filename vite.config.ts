import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { APP_NAME } from './src/app/appInfo.ts';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'app-name-title',
      transformIndexHtml: (html) => html.replace(/<title>.*<\/title>/, `<title>${APP_NAME}</title>`),
    },
  ],
  // Capacitor dosyaları WebView içinden yerel olarak yüklediği için göreli yollar.
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
