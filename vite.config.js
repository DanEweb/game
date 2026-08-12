import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로 베이스 — GitHub Pages 프로젝트 경로(/game/)에서도 동작
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    // 파일명 해시 제거 — 배포 CDN 전파 중 index↔에셋 불일치(빈 화면)의 근본 차단.
    // 구 index가 남아도 같은 이름의 에셋을 찾으므로 404가 나지 않는다.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/c-[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
