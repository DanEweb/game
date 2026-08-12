// dist/gray_survivor_single.html → dist/qa.html — QA용 rAF 심 주입
// ⚠ 배경(숨김) 탭에서는 setTimeout이 1초로 클램프되어 게임 심이 사실상 멈춘다 (0킬·보스 타이머 정지처럼 보임 — 코드 버그 아님)
//    → 타이머가 아닌 MessageChannel 펌프로 rAF를 구동해 스로틀링을 우회한다
import fs from 'fs';
const shim = `<script>(function(){
var ch=new MessageChannel(), last=0, q=[];
ch.port1.onmessage=function(){
  var now=performance.now();
  if (now-last>=16){ last=now; var cbs=q; q=[]; for (var i=0;i<cbs.length;i++){ try{ cbs[i](now); }catch(e){} } }
  ch.port2.postMessage(0);
};
window.requestAnimationFrame=function(cb){ q.push(cb); return q.length; };
window.cancelAnimationFrame=function(){};
ch.port2.postMessage(0);
})();<\/script>`;
const html = fs.readFileSync('dist/gray_survivor_single.html','utf8').replace('<head>', '<head>'+shim);
fs.writeFileSync('dist/qa.html', html);
console.log('dist/qa.html written (MessageChannel pump shim)');
