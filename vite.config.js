import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로 베이스 — GitHub Pages 프로젝트 경로(/game/)에서도 동작
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
