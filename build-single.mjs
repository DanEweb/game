// Vite dist → 단일 HTML (카톡 공유용). 먼저 `npm run build` 실행 필요.
import fs from 'fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const out = html
  .replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/, (m, p) =>
    '<script>\n' + fs.readFileSync('dist/' + p, 'utf8') + '\n</script>')
  .replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/, (m, p) =>
    '<style>\n' + fs.readFileSync('dist/' + p, 'utf8') + '\n</style>')
  .replace(/<link rel="modulepreload"[^>]*>/g, '');

fs.writeFileSync('dist/gray_survivor_single.html', out, 'utf8');
console.log('built dist/gray_survivor_single.html', out.length, 'bytes');
