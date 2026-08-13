// 죽은 스탯 검출 — 플레이어 속성에 '쓰기만 있고 읽기가 없는' 것을 찾는다.
//  v6.77에서 6종(satDmg·multishotCh·explodeChance/Dmg·hitInvuln·reviveInvuln·weaponCap1)을 이걸로 잡았고,
//  v6.120에서 scytheBoost 회귀도 같은 방식으로 잡혔다. 배포 전 체크리스트.
import fs from 'fs';
const src = fs.readFileSync('src/game.js', 'utf8');

// 쓰기: p.foo= / player.foo= / p.foo+= / p.foo*= ...
const W = /\b(?:p|player)\.([A-Za-z_$][\w$]*)\s*(?:=[^=]|\+=|-=|\*=|\/=|\+\+|--)/g;
// 읽기: player.foo 뒤에 대입이 오지 않는 것 (p.foo는 apply 콜백 내부라 쓰기 위주 → player.만 읽기로 셈)
const R = /\bplayer\.([A-Za-z_$][\w$]*)\s*(?!\s*(?:=[^=]|\+=|-=|\*=|\/=|\+\+|--))/g;

const writes = new Map(), reads = new Map();
let m;
while ((m = W.exec(src))) writes.set(m[1], (writes.get(m[1])||0) + 1);
while ((m = R.exec(src))) reads.set(m[1], (reads.get(m[1])||0) + 1);

// 초기화 리터럴(플레이어 객체 생성부)에서 선언된 것도 '쓰기'로 본다
const initBlock = src.slice(src.indexOf('invuln:0, hitFlash:0'), src.indexOf('invuln:0, hitFlash:0') + 4000);
const initKeys = new Set([...initBlock.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map(x=>x[1]));

// 투사체·파티클 객체도 `p`로 순회해서 이름이 겹친다 — 플레이어 스탯이 아닌 것으로 확인된 목록
const FALSE_POSITIVE = new Set(['life','bounced','damage','spin','phase','age','r','x','y','vx','vy','t','maxT']);

const dead = [];
for (const [k, wc] of writes){
  if (FALSE_POSITIVE.has(k)) continue;
  const rc = reads.get(k) || 0;
  // 읽기가 쓰기 하나(자기 자신 참조: p.foo=(p.foo||1)*x 형태)뿐인 경우도 죽은 것으로 본다
  // ⚠ 자기참조는 **player.** 형태만 센다. `p.foo=(p.foo||1)` 는 특성 적용부(p)라 애초에 읽기로 세지 않았는데
  //   여기서 같이 빼면 읽기가 음수가 되어 멀쩡한 스탯이 전부 죽은 것으로 나온다 (1차 실행에서 69건 오탐)
  const selfRef = new RegExp('\\bplayer\\.'+k+'\\s*=\\s*\\(\\s*player\\.'+k, 'g');
  const selfN = (src.match(selfRef)||[]).length;
  const realReads = rc - selfN;
  if (realReads <= 0) dead.push({ k, writes: wc, reads: rc, selfRef: selfN, inInit: initKeys.has(k) });
}
dead.sort((a,b)=> b.writes - a.writes);

console.log('=== 죽은 스탯 후보 (쓰기만 있고 실질 읽기 없음) ===');
if (!dead.length) console.log('없음');
for (const d of dead){
  console.log(`${d.k.padEnd(22)} 쓰기 ${String(d.writes).padStart(3)} / 읽기 ${String(d.reads).padStart(3)} (자기참조 ${d.selfRef})${d.inInit?' [init에 선언됨]':''}`);
}
console.log('\n총 ' + dead.length + '건');
