// Pixi WebGL 이펙트 레이어 — Canvas2D 월드 위에 겹쳐지는 가산 합성 파티클
// 1단계 도입: 폭발/처치/보스 연출을 WebGL 파티클로. (월드 렌더러 이관은 다음 단계)
// v6.232: BLEND_MODES는 pixi 8에 없는 export인데 import만 하고 안 썼다(블렌드는 문자열 'add' 사용).
// 프로덕션 번들은 통과하지만 vite dev의 실 ESM 로드는 여기서 죽어 npm run dev가 안 떴다.
import { Application, Container, Sprite, Texture } from 'pixi.js';

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

// ---------- v6.239 Pixi 3단계: 몹 본체 WebGL 레이어 ----------
// 게임 캔버스(지면·장판·투사체) 위, 오버레이 캔버스(보스·플레이어·이펙트) 아래에 끼는 두 번째 WebGL 캔버스.
// 몹 본체는 이미 dotPush 스프라이트 캐시(키 있는 베이크 캔버스)로 그려지므로,
// 그 캔버스를 텍스처로 한 번만 올리고 프레임마다 스프라이트 배치만 바꾼다 — 본체 blit이 GPU 배치 렌더가 된다.
// ⚠ 도트 격자 보존: resolution=DPR + scaleMode 'nearest' (CSS 확대는 linear라 도트가 뭉개진다)
let wApp = null, wLayer = null, wReady = false, wFailed = false;
let wVS = 1, wCamX = 0, wCamY = 0, wW = 940, wH = 588;
const wTex = new Map();            // key → Texture (SPR 키와 동일 — 키가 내용을 완전 결정하므로 재베이크돼도 같은 그림)
const W_TEX_MAX = 500;
const wSprites = [];               // 스프라이트 풀
let wCount = 0;                    // 이번 프레임 사용 수

export const WORLD = {
  async init(hostEl){
    if (wReady || wFailed) return;
    try {
      wApp = new Application();
      await wApp.init({ width:wW, height:wH, backgroundAlpha:0, antialias:false, autoStart:false, preference:'webgl', resolution:Math.min(window.devicePixelRatio||1,2), autoDensity:true });
      wApp.canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1;';
      hostEl.appendChild(wApp.canvas);
      wLayer = new Container();
      wLayer.scale.set(wVS);           // init 이전에 setScale이 이미 지나갔을 수 있다
      wApp.stage.addChild(wLayer);
      wReady = true;
      window.__WDBG = { get mobs(){ return wCount; }, get textures(){ return wTex.size; } };
    } catch(e){ wFailed = true; console.warn('[WORLD] WebGL mob layer disabled:', e); }
  },
  resize(w, h){
    wW = w; wH = h;
    if (wReady) wApp.renderer.resize(w, h);
  },
  setScale(sc){ wVS = sc || 1; if (wLayer) wLayer.scale.set(wVS); },
  // 프레임 시작 — tx/ty: 게임 캔버스 카메라 translate와 **같은 값**(정수 반올림·흔들림 포함).
  // 층간 서브픽셀 어긋남이 없도록 계산식을 공유한다.
  begin(tx, ty){
    if (!wReady) return;
    wCamX = tx; wCamY = ty;
    wCount = 0;
  },
  // 몹 본체 하나 — cv: dotPush 캐시 캔버스(px×px), key: 캐시 키, 배치는 월드 좌표·포즈 스케일
  mob(key, cv, x, y, sx, sy, ppu){
    if (!wReady) return false;
    let tex = wTex.get(key);
    if (!tex){
      if (wTex.size >= W_TEX_MAX){ const k0 = wTex.keys().next().value; const t0 = wTex.get(k0); wTex.delete(k0); try{ t0.destroy(true); }catch(e){} }
      tex = Texture.from(cv);
      tex.source.scaleMode = 'nearest';
      wTex.set(key, tex);
    } else { wTex.delete(key); wTex.set(key, tex); } // LRU 갱신
    let s = wSprites[wCount];
    if (!s){ s = new Sprite(); s.anchor.set(0.5); wLayer.addChild(s); wSprites.push(s); }
    s.visible = true;
    s.texture = tex;
    s.x = x + wCamX;
    s.y = y + wCamY;
    s.scale.set(sx/ppu, sy/ppu);
    wCount++;
    return true;
  },
  end(){
    if (!wReady) return;
    for (let i=wCount; i<wSprites.length; i++) wSprites[i].visible = false;
    wApp.render();
  },
  clearTex(){ for (const t of wTex.values()){ try{ t.destroy(true); }catch(e){} } wTex.clear(); },
  get enabled(){ return wReady; }
};
