// Pixi WebGL 이펙트 레이어 — Canvas2D 월드 위에 겹쳐지는 가산 합성 파티클
// 1단계 도입: 폭발/처치/보스 연출을 WebGL 파티클로. (월드 렌더러 이관은 다음 단계)
import { Application, Container, Sprite, Texture, BLEND_MODES } from 'pixi.js';

let app = null, layer = null, ready = false, failed = false;
let camX = 0, camY = 0, viewW = 940, viewH = 588, camS = 1;
function applyCam(){
  if (!layer) return;
  layer.scale.set(camS);
  layer.x = viewW/2;
  layer.y = viewH/2;
}
const pool = [];
const active = [];
const bullets = [];
let bulletList = [];
const zoneSprites = [];
let zoneList = [];

function makeDotTexture(){
  // 부드러운 원형 글로우 텍스처를 런타임 생성
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16,16,0,16,16,16);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(0.35,'rgba(255,255,255,0.55)');
  grad.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0,0,32,32);
  return Texture.from(c);
}
let dotTex = null;

export const FX = {
  async init(hostEl){
    if (ready || failed) return;
    try {
      app = new Application();
      await app.init({
        width: viewW, height: viewH,
        backgroundAlpha: 0,
        antialias: false,
        autoStart: false,           // 게임 루프에서 직접 render
        preference: 'webgl',
      });
      app.canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:3; mix-blend-mode:screen;';
      hostEl.appendChild(app.canvas);
      layer = new Container();
      app.stage.addChild(layer);
      applyCam();
      dotTex = makeDotTexture();
      ready = true;
      // 디버그: 콘솔에서 파티클/탄환 카운트 확인용
      window.__FXDBG = { get particles(){ return active.length; }, get bullets(){ return bulletList.filter(Boolean).length; }, get sprites(){ return layer.children.length; } };
    } catch(e){
      failed = true; // WebGL 불가 환경: 조용히 비활성 (Canvas2D만으로 동작)
      console.warn('[FX] WebGL layer disabled:', e);
    }
  },
  resize(w, h){
    viewW = w; viewH = h;
    if (ready){ app.renderer.resize(w, h); applyCam(); }
  },
  // v6.78 카메라 축소(모바일 시야 보정) — 레이어에 스케일을 걸어 위치·크기를 한 번에 맞춘다
  setScale(sc){ camS = sc || 1; applyCam(); },
  sync(cx, cy){ camX = cx; camY = cy; },
  // 가산 글로우 버스트 — 처치/폭발/보상 연출
  burst(wx, wy, color, n, speed, life){
    if (!ready) return;
    n = Math.min(n||8, 40);
    for (let i=0;i<n;i++){
      let s = pool.pop();
      if (!s){
        s = new Sprite(dotTex);
        s.anchor.set(0.5);
        s.blendMode = 'add';
      }
      const a = Math.random()*Math.PI*2;
      const v = (speed||120) * (0.4+Math.random()*0.8);
      s.__grow = false;
      s.__vx = Math.cos(a)*v; s.__vy = Math.sin(a)*v;
      s.__wx = wx; s.__wy = wy;
      s.__life = s.__maxLife = (life||0.5)*(0.7+Math.random()*0.6);
      s.tint = color;
      s.alpha = 0.9;
      const sc = 0.4+Math.random()*0.7;
      s.scale.set(sc);
      s.__baseScale = sc;
      layer.addChild(s);
      active.push(s);
    }
  },
  // 디졸브 퍼프: 한 장의 광원이 부풀며 사라진다 (처치·소멸 연출)
  puff(wx, wy, color, r){
    if (!ready) return;
    let s = pool.pop();
    if (!s){ s = new Sprite(dotTex); s.anchor.set(0.5); s.blendMode='add'; }
    s.__vx = 0; s.__vy = -14;
    s.__wx = wx; s.__wy = wy;
    s.__life = s.__maxLife = 0.45;
    s.tint = color; s.alpha = 0.6;
    const sc = (r||12)/10;
    s.scale.set(sc);
    s.__baseScale = sc;
    s.__grow = true; // 시간이 지나며 커지는 타입
    layer.addChild(s);
    active.push(s);
  },
  ring(wx, wy, color, n){
    if (!ready) return;
    n = Math.min(n||14, 28);
    for (let i=0;i<n;i++){
      let s = pool.pop();
      if (!s){ s = new Sprite(dotTex); s.anchor.set(0.5); s.blendMode='add'; }
      const a = (Math.PI*2/n)*i;
      const v = 210;
      s.__grow = false;
      s.__vx = Math.cos(a)*v; s.__vy = Math.sin(a)*v;
      s.__wx = wx; s.__wy = wy;
      s.__life = s.__maxLife = 0.45;
      s.tint = color; s.alpha = 1;
      s.scale.set(0.8); s.__baseScale = 0.8;
      layer.addChild(s);
      active.push(s);
    }
  },
  // 2단계: 투사체 렌더 이관 — 매 프레임 목록을 받아 풀 스프라이트로 표시
  drawBullets(list){
    bulletList = list;
  },
  // 3단계: 원소 장판 글로우 — 부드러운 WebGL 광원 디스크
  drawZones(list){
    zoneList = list;
  },
  update(dt){
    if (!ready) return;
    // 장판 글로우 동기화 (맥동하는 광원 디스크)
    const pulse = 1 + Math.sin(performance.now()/240)*0.06;
    while (zoneSprites.length < zoneList.length && zoneSprites.length < 80){
      const s = new Sprite(dotTex);
      s.anchor.set(0.5); s.blendMode = 'add';
      layer.addChildAt(s, 0); // 탄환·파티클보다 아래
      zoneSprites.push(s);
    }
    for (let i=0;i<zoneSprites.length;i++){
      const s = zoneSprites[i];
      const z = zoneList[i];
      if (z){
        s.visible = true;
        s.tint = z.tint;
        s.alpha = z.alpha;
        s.scale.set((z.r*2.6*pulse)/32);
        s.x = z.x - camX;
        s.y = z.y - camY;
      } else s.visible = false;
    }
    // 투사체 스프라이트 동기화 (글로우 코어)
    while (bullets.length < bulletList.length && bullets.length < 600){
      const s = new Sprite(dotTex);
      s.anchor.set(0.5); s.blendMode = 'add';
      layer.addChild(s); bullets.push(s);
    }
    for (let i=0;i<bullets.length;i++){
      const s = bullets[i];
      const b = bulletList[i];
      if (b){
        s.visible = true;
        s.tint = b.tint;
        s.alpha = 0.95;
        s.scale.set((b.r*3.2)/32);
        s.x = b.x - camX;
        s.y = b.y - camY;
      } else s.visible = false;
    }
    for (let i=active.length-1;i>=0;i--){
      const s = active[i];
      s.__life -= dt;
      if (s.__life <= 0){
        layer.removeChild(s);
        active.splice(i,1);
        if (pool.length < 300) pool.push(s);
        continue;
      }
      s.__wx += s.__vx*dt; s.__wy += s.__vy*dt;
      s.__vx *= (1-2.2*dt); s.__vy *= (1-2.2*dt);
      const t = s.__life / s.__maxLife;
      s.alpha = t*0.9;
      s.scale.set(s.__baseScale * (s.__grow ? (2.2 - t*1.4) : (0.5+t*0.8)));
      s.x = s.__wx - camX;
      s.y = s.__wy - camY;
    }
    app.render();
  },
  get enabled(){ return ready; }
};
