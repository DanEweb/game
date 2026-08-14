// 역방향 루프 전수조사 — 루프 도중 배열이 줄어들 수 있는데 인덱스 가드가 없는 곳을 찾는다
import fs from 'fs';
const src = fs.readFileSync('src/game.js', 'utf8').split('\n');
const forPat = /for\s*\(\s*let\s+(i\d*)\s*=\s*(enemies|bosses|hostileShots)\.length\s*-\s*1/;
let total = 0;
const unguarded = [];
for (let n = 0; n < src.length; n++) {
  const m = forPat.exec(src[n]);
  if (!m) continue;
  const v = m[1], arr = m[2];
  const win = src.slice(n, n + 4).join('\n');
  const declPat = new RegExp('const\\s+(\\w+)\\s*=\\s*' + arr + '\\[\\s*' + v + '\\s*\\]');
  const decl = declPat.exec(win);
  if (!decl) continue;            // splice-only 루프는 대상 아님
  total++;
  const name = decl[1];
  const guarded = new RegExp('if\\s*\\(\\s*!' + name + '[\\s)|&]').test(win);
  if (!guarded) unguarded.push(`${n + 1} | ${arr} | ${src[n].trim().slice(0, 95)}`);
}
console.log(`역방향 루프(요소 참조) 총 ${total}개 · 가드 없음 ${unguarded.length}개`);
unguarded.forEach(h => console.log('  ' + h));
