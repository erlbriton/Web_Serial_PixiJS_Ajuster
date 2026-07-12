import { defineConfig } from 'vite';

export default defineConfig({
  // Указываем базовый путь для корректной работы путей на GitHub Pages
  base: './', 
  
  // Корень проекта
  root: './',
  
  server: {
    port: 5173,
    strictPort: true,
  },
  
  build: {
    target: 'esnext',
    // Выходная папка по умолчанию — 'dist'
    outDir: 'dist',
  }
});