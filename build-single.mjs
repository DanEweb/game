// Vite dist → 단일 HTML (카톡 공유용). 먼저 `npm run build` 실행 필요.
import fs from 'fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const out = html
  // type="module" 유지 — 번들 안의 import.meta(Pixi 지연 로딩)가 일반 스크립트에선 파싱 에러로 전체 게임을 죽인다
  // (모듈로 인라인하면 파싱 OK, Pixi 동적 임포트는 실패해도 fx.js가 조용히 Canvas2D 폴백)
  .replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/, (m, p) =>
    '<script type="module">\n' + fs.readFileSync('dist/' + p, 'utf8') + '\n</script>')
  .replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/, (m, p) =>
    '<style>\n' + fs.readFileSync('dist/' + p, 'utf8') + '\n</style>')
  .replace(/<link rel="modulepreload"[^>]*>/g, '');

fs.writeFileSync('dist/gray_survivor_single.html', out, 'utf8');
console.log('built dist/gray_survivor_single.html', out.length, 'bytes');
