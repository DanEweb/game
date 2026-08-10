// index.html + style.css + game.js → 단일 HTML (카톡 공유용)
import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('game.js', 'utf8');

const out = html
  .replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
  .replace('<script src="game.js"></script>', '<script>\n' + js + '\n</script>');

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/gray_survivor_single.html', out, 'utf8');
console.log('built dist/gray_survivor_single.html', out.length, 'bytes');
