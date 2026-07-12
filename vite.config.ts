import { defineConfig } from 'vite';

export default defineConfig({
  // Указываем, что корень проекта — это текущая папка
  root: './',
  server: {
    // Явно разрешаем Vite обрабатывать файлы
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'esnext'
  }
});