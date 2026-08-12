import { MAPS, MAP_ORDER } from "./data/maps.js";
import { BOSS_TYPES } from "./data/bosses.js";
import { SLOT_NAMES, SLOT_KEYS, NORMAL_SLOTS, HEAVY_OK, RARITY_NAMES, RARITY_PREFIX, SELL_PRICE, UNIQUE_POOL, SET_DEFS } from "./data/equipment.js";
import { EQ_STATS, EQ_AFFIX, EQ_NOUNS, EQ_CURSES, RELICS } from "./data/equipment-stats.js";
import { STAR_BRANCHES, TRANSFORM_KEYS } from "./data/startree.js";
import { FX } from "./fx.js";

  const $ = (id)=> document.getElementById(id);
  const canvas = $('c'), ctx = canvas.getContext('2d');
  const wrap = $('wrap'), overlay = $('overlay');
  const titleText = $('titleText'), subText = $('subText'), bestSub = $('bestSub');
  const btn = $('btn'), btn2 = $('btn2');
  const resultBox = $('result'), finalTime = $('finalTime'), finalKills = $('finalKills');
  const finalLv = $('finalLv'), finalGold = $('finalGold'), newBestRow = $('newBestRow');
  const levelupBox = $('levelupBox'), cardsEl = $('cards'), luHint = $('luHint');
  const rerollBtn = $('rerollBtn'), skipBtn = $('skipBtn');
  const classBox = $('classBox'), classCardsEl = $('classCards');
  const pausedTag = $('pausedTag'), bossBar = $('bossBar'), bossWarn = $('bossWarn');
  const comboTag = $('comboTag'), comboNum = $('comboNum');
  const dashBtn = $('dashBtn'), toastWrap = $('toastWrap');
  const goldRow = $('goldRow'), goldVal = $('goldVal'), goldStatVal = $('goldStatVal');
  const shopBtn = $('shopBtn'), equipBtn = $('equipBtn'), questBtn = $('questBtn');
  const shopBox = $('shopBox'), equipBox = $('equipBox'), questBox = $('questBox');
  const shopList = $('shopList'), slotGrid = $('slotGrid'), invList = $('invList'), questList = $('questList');
  const mapRow = $('mapRow');
  const eventBox = $('eventBox'), eventTitle = $('eventTitle'), eventDesc = $('eventDesc'), eventCards = $('eventCards');
  const muteBtn = $('muteBtn');
  const xpFill = $('xpFill'), hpFill = $('hpFill'), dashFill = $('dashFill');
  const lvVal = $('lvVal'), timeVal = $('timeVal'), killVal = $('killVal');
  const weaponRow = (function(){ const d=document.createElement('div'); d.id='weaponRow'; wrap.appendChild(d); return d; })();
  const treeRow = (function(){ const d=document.createElement('div'); d.id='treeRow'; wrap.appendChild(d); return d; })();

  // ---------- canvas ----------
  let W=0, H=0, DPR=1;
  function resize(){
    const rect = wrap.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio||1, 2);
    // 탭이 숨겨져 크기가 0으로 잡히면 이전 값(또는 기본값)을 유지한다
    W = rect.width || W || 940;
    H = rect.height || H || 588;
    canvas.width = Math.floor(W*DPR);
    canvas.height = Math.floor(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    FX.resize(W, H);
  }
  window.addEventListener('resize', resize);
  resize();
  FX.init(wrap).then(()=>{ FX.resize(W, H); }); // Pixi WebGL 이펙트 레이어 (1단계)

  // ---------- persistence ----------
  const SAVE_KEY = 'gray_survivor_v3';
  let DB = {
    best: {},            // per-map best seconds
    gold: 0,
    meta: { hp:0, dmg:0, spd:0, gold:0, reroll:0, magnet:0, revive:0 },
    unlocked: {},        // classes
    mapCleared: {},      // mapKey -> true (unlocks the next map)
    inv: [],             // equipment inventory
    equipped: {},        // slot -> item id (구버전 공용 — loadouts로 이관)
    loadouts: {},        // classKey -> { slot -> item id } 직업별 장비 세팅
    prog: { kill:0, elite:0, boss:0, survive:0, evolve:0, tier:{} },
    ach: {},
    star: { pts:0, nodes:{} },
    growth: { found:false, lv:1, xp:0 },
    gweps: { bow:{found:false,lv:1,xp:0}, tome:{found:false,lv:1,xp:0}, blade:{found:false,lv:1,xp:0} },
    mats: { shard:0, essence:0, gear:0 },
    consum: { reroll:0, revive:0 },
    peril: 0, perilMax: 0,
    metaRefunded: false,
    egg1: false,
    nextId: 1,
    muted: false,
    epoch: 2,            // 세이브 세대 — 대격변 시 증가, 구세대 세이브는 폐기
    gwq: { stage: 0 },   // 떠돌이 대장장이 영구 퀘스트 (유일무기 제3 루트)
    gateProg: {}         // 관문 레이드 체크포인트 — peril → 돌파한 관문 수 (다음 도전 시 이어서)
  };
  function loadDB(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw){
        const d = JSON.parse(raw);
        // 대격변: 구세대(epoch<2) 세이브 폐기 — 단, 스테이지 진행(맵 클리어·위험도 해금)만 승계
        if (d && typeof d==='object' && (d.epoch||1) < 2){
          DB.mapCleared = d.mapCleared||{};
          DB.perilMax = d.perilMax||0;
          DB.peril = Math.min(d.peril||0, DB.perilMax);
          localStorage.removeItem(SAVE_KEY);
          saveDB();
          setTimeout(()=>{ try{ toast('⚠ 대격변 — 스테이지 진행만 남기고 세계가 재구성되었다. 다시, 처음부터.'); }catch(e){} }, 1500);
          return;
        }
        if (d && typeof d==='object'){
          DB.best = d.best||{}; DB.gold = d.gold||0;
          DB.meta = Object.assign(DB.meta, d.meta||{});
          DB.unlocked = d.unlocked||{};
          DB.mapCleared = d.mapCleared||{};
          DB.inv = Array.isArray(d.inv) ? d.inv : [];
          DB.equipped = d.equipped||{};
          DB.loadouts = d.loadouts||{};
          DB.seenTech = d.seenTech||{};
          DB.prog = Object.assign(DB.prog, d.prog||{});
          DB.prog.tier = DB.prog.tier||{};
          DB.ach = d.ach||{};
          DB.star = Object.assign({pts:0,nodes:{}}, d.star||{});
          DB.star.nodes = DB.star.nodes||{};
          DB.growth = Object.assign({found:false,lv:1,xp:0}, d.growth||{});
          DB.gweps = Object.assign({bow:{found:false,lv:1,xp:0},tome:{found:false,lv:1,xp:0},blade:{found:false,lv:1,xp:0}}, d.gweps||{});
          DB.mats = Object.assign({shard:0,essence:0,gear:0}, d.mats||{});
          DB.consum = Object.assign({reroll:0,revive:0}, d.consum||{});
          DB.peril = d.peril||0;
          DB.perilMax = d.perilMax||0;
          DB.metaRefunded = !!d.metaRefunded;
          DB.egg1 = !!d.egg1;
          DB.epoch = d.epoch||2;
          DB.gwq = Object.assign({stage:0}, d.gwq||{});
          DB.gateProg = d.gateProg||{};
          // 영구 강화 폐지 — 기존 투자 골드 전액 환불 (1회)
          if (!DB.metaRefunded && d.meta){
            let refund = 0;
            const bases = { hp:30, dmg:40, spd:35, gold:35, magnet:30, reroll:60, revive:400 };
            for (const k in bases){
              const lv = d.meta[k]||0;
              for (let i=0;i<lv;i++) refund += Math.round(bases[k]*Math.pow(1.7,i)/5)*5;
            }
            if (refund>0){
              DB.gold += refund;
              setTimeout(()=>toast('영구 강화 폐지 — '+refund+'G 전액 환불!'), 800);
            }
            DB.metaRefunded = true;
          }
          DB.nextId = d.nextId||1;
          DB.muted = !!d.muted;
        }
      }
    }catch(e){}
  }
  function saveDB(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(DB)); }catch(e){} }
  loadDB();
  window.__bootOk = true; // 부팅 신호 — index.html 캐시 복구 타이머 해제
  try{ sessionStorage.removeItem('bootRetry'); }catch(e){}

  function fmtTime(s){
    s = Math.floor(s);
    return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  }

  // ---------- toast ----------
  function toast(msg){
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toastWrap.appendChild(el);
    while (toastWrap.children.length > 4) toastWrap.removeChild(toastWrap.firstChild);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .4s'; }, 2400);
    setTimeout(()=>{ if (el.parentNode) el.parentNode.removeChild(el); }, 2900);
  }

  // ---------- procedural sound ----------
  const SFX = (function(){
    let ac = null, lastShoot = 0;
    function ensure(){
      if (!ac){ try{ ac = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
      if (ac && ac.state==='suspended'){ try{ ac.resume(); }catch(e){} }
      return ac;
    }
    function tone(freq, dur, type, vol, slideTo){
      const a = ensure(); if (!a || DB.muted) return;
      const t0 = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type||'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30,slideTo), t0+dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      o.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0+dur+0.02);
    }
    function noise(dur, vol, low){
      const a = ensure(); if (!a || DB.muted) return;
      const len = Math.max(1, Math.floor(a.sampleRate*dur));
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<len;i++) d[i] = (Math.random()*2-1) * (1-i/len);
      const src = a.createBufferSource(); src.buffer = buf;
      const g = a.createGain(); g.gain.value = vol;
      const f = a.createBiquadFilter();
      f.type = low ? 'lowpass' : 'highpass';
      f.frequency.value = low ? 900 : 1400;
      src.connect(f); f.connect(g); g.connect(a.destination);
      src.start(a.currentTime);
    }
    return {
      unlock(){ ensure(); },
      getCtx(){ return ensure(); },
      play(name){
        if (DB.muted) return;
        const now = performance.now();
        switch(name){
          case 'shoot':
            if (now - lastShoot < 90) return;
            lastShoot = now;
            tone(300+Math.random()*60, 0.05, 'square', 0.015, 180); break;
          case 'hit': noise(0.04, 0.028); break;
          case 'hurt': tone(140, 0.18, 'sawtooth', 0.05, 60); noise(0.1, 0.04, true); break;
          case 'pick': tone(620+Math.random()*120, 0.06, 'sine', 0.028, 900); break;
          case 'coin': tone(880, 0.05, 'square', 0.03, 1400); tone(1320, 0.08, 'square', 0.018); break;
          case 'level': tone(440, 0.09, 'square', 0.045); setTimeout(()=>tone(660, 0.12, 'square', 0.045), 90); break;
          case 'dash': noise(0.12, 0.05); break;
          case 'sweep': noise(0.1, 0.04); tone(220, 0.12, 'sawtooth', 0.02, 90); break;
          case 'boom': noise(0.25, 0.09, true); tone(70, 0.3, 'sine', 0.09, 40); break;
          case 'warn': tone(220, 0.16, 'sawtooth', 0.05); setTimeout(()=>tone(220, 0.16, 'sawtooth', 0.05), 200); break;
          case 'tele': tone(900, 0.12, 'sine', 0.04, 300); break;
          case 'beep': tone(1200, 0.06, 'square', 0.035); break;
          case 'meteor': noise(0.3, 0.06, true); tone(240, 0.35, 'sawtooth', 0.04, 60); break;
          case 'chest': [523,659,784,1047].forEach((f,i)=> setTimeout(()=>tone(f, 0.12, 'triangle', 0.05), i*80)); break;
          case 'equip': [659,880].forEach((f,i)=> setTimeout(()=>tone(f, 0.1, 'triangle', 0.05), i*70)); break;
          case 'quest': [784,988,1175].forEach((f,i)=> setTimeout(()=>tone(f, 0.12, 'triangle', 0.05), i*90)); break;
          case 'evolve': [392,523,659,784,1047,1319].forEach((f,i)=> setTimeout(()=>tone(f, 0.15, 'triangle', 0.055), i*70)); break;
          case 'win': [523,659,784,1047,784,1047].forEach((f,i)=> setTimeout(()=>tone(f, 0.2, 'triangle', 0.06), i*130)); break;
          case 'fever': tone(660, 0.1, 'square', 0.04); setTimeout(()=>tone(880, 0.14, 'square', 0.04), 90); break;
        }
      }
    };
  })();
  // ---------- 절차 생성 BGM ----------
  // 맵별 음계/템포로 미니멀한 배경 음악을 실시간 생성한다.
  // 보스전·피버 시 레이어(아르페지오·하이햇)가 추가되어 긴장감이 올라간다.
  const BGM = (function(){
    let timer = null, step = 0, nextT = 0, bassPat = null, patAge = 0;
    const THEMES = {
      field:   { bpm:108, scale:[220.0, 246.9, 261.6, 329.6, 392.0] },      // A minor pent.
      archive: { bpm:92,  scale:[196.0, 220.0, 233.1, 293.7, 311.1] },      // G dorian-ish
      abyss:   { bpm:122, scale:[174.6, 185.0, 220.0, 233.1, 277.2] },      // F phrygian-ish
    };
    function makePattern(scale){
      const p = [];
      let idx = 0;
      for (let i=0;i<8;i++){
        idx = Math.max(0, Math.min(scale.length-1, idx + ((Math.random()*3)|0) - 1));
        p.push(Math.random()<0.25 ? -1 : idx); // -1 = 쉼표
      }
      return p;
    }
    function tone(ac, t, freq, dur, type, vol, slide){
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,slide), t+dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t+dur+0.02);
    }
    function noiseHit(ac, t, dur, vol){
      const len = Math.max(1, Math.floor(ac.sampleRate*dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<len;i++) d[i] = (Math.random()*2-1)*(1-i/len);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type='highpass'; f.frequency.value=6000;
      const g = ac.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(ac.destination);
      src.start(t);
    }
    function scheduleStep(ac, s, t, theme){
      const inGame = (state==='playing' || state==='levelup' || state==='event' || state==='win');
      if (!inGame || DB.muted) return;
      const bossOn = bosses.length>0;
      const feverOn = feverTimer>0;
      const intensity = 1 + (bossOn?1:0) + (feverOn?1:0);
      // kick
      if (s%4===0) tone(ac, t, 105, 0.22, 'sine', 0.075, 42);
      // hat
      if (intensity>=2 && s%2===1) noiseHit(ac, t, 0.03, 0.022);
      // bass
      if (!bassPat || patAge>=32){ bassPat = makePattern(theme.scale); patAge = 0; }
      const bi = bassPat[s%8];
      if (bi>=0 && s%2===0) tone(ac, t, theme.scale[bi]/2, 0.18, 'triangle', 0.045);
      // pad (2마디마다 은은한 화음)
      if (s%32===0){
        tone(ac, t, theme.scale[0], 2.2, 'sine', 0.018);
        tone(ac, t, theme.scale[2], 2.2, 'sine', 0.014);
      }
      // arp (보스/피버 레이어)
      if (intensity>=2 && s%2===0){
        tone(ac, t, theme.scale[(s/2)%theme.scale.length]*2, 0.07, 'square', 0.013);
      }
      if (bossOn && s%16===8) tone(ac, t, theme.scale[0]*0.5, 0.5, 'sawtooth', 0.02, theme.scale[0]*0.45);
      patAge++;
    }
    return {
      start(){
        const ac = SFX.getCtx();
        if (!ac || timer) return;
        step = 0; nextT = ac.currentTime + 0.1; bassPat = null; patAge = 0;
        timer = setInterval(()=>{
          const theme = THEMES[MAP.key] || THEMES.field;
          const stepDur = 60/theme.bpm/2;
          while (nextT < ac.currentTime + 0.15){
            scheduleStep(ac, step, nextT, theme);
            nextT += stepDur;
            step++;
          }
          if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
        }, 40);
      },
      stop(){ if (timer){ clearInterval(timer); timer = null; } }
    };
  })();

  function refreshMuteBtn(){ muteBtn.textContent = DB.muted ? 'SND OFF' : 'SND ON'; }
  muteBtn.addEventListener('click', (e)=>{ e.stopPropagation(); DB.muted=!DB.muted; saveDB(); refreshMuteBtn(); grabFocus(); });
  refreshMuteBtn();

  // ---------- input ----------
  const keys = new Set();
  function keyToDir(code){
    if (code==='KeyW'||code==='ArrowUp') return 'up';
    if (code==='KeyS'||code==='ArrowDown') return 'down';
    if (code==='KeyA'||code==='ArrowLeft') return 'left';
    if (code==='KeyD'||code==='ArrowRight') return 'right';
    return null;
  }
  function handleKeyDown(e){
    const d = keyToDir(e.code);
    if (d){ keys.add(d); e.preventDefault(); }
    if (e.code==='Space'){
      e.preventDefault();
      if (state==='playing') tryDash();
    }
    if (e.code==='KeyQ' && state==='playing'){
      player.ultFireReq = true; // 전용기 수동 시전
    }
    if (state==='playing' && ['Digit1','Digit2','Digit3','Digit4'].includes(e.code)){
      castSkill(parseInt(e.code.slice(-1),10)); // 스킬 1~4
    }
    if (e.code==='KeyI'){
      if (state==='playing'){ openInv(); }
      else if (state==='inv'){ closeInv(); }
    }
    if (e.code==='KeyK' && state==='playing'){ openSkillBook(); }
    if (e.code==='KeyT' && state==='playing'){ openTechView(); }
    if (e.code==='KeyJ'){
      if (state==='playing') openAsc();
      else if (state==='inv') closeInv();
    }
    if (e.code==='KeyH' && state==='playing'){ keyHintUntil = elapsed + 12; }
    if (state==='levelup'){
      if (['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8'].includes(e.code)) pickUpgrade(parseInt(e.code.slice(-1),10)-1);
      if (e.code==='KeyR') doReroll();
    }
    if (state==='event'){
      if (['Digit1','Digit2','Digit3','Digit4'].includes(e.code)) pickEventChoice(parseInt(e.code.slice(-1),10)-1);
    }
    if (e.code==='KeyM'){ DB.muted=!DB.muted; saveDB(); refreshMuteBtn(); }
    // 비밀 커맨드 (타이틀 화면에서 ↑↑↓↓BA)
    if (state==='idle'){
      window.__seq = (window.__seq||[]);
      window.__seq.push(e.code);
      if (window.__seq.length>6) window.__seq.shift();
      // 공로자: 'chlquddn' (최병우) 타이핑
      window.__seq2 = (window.__seq2||'') + (e.key && e.key.length===1 ? e.key.toLowerCase() : '');
      if (window.__seq2.length>12) window.__seq2 = window.__seq2.slice(-12);
      if (window.__seq2.endsWith('chlquddn') && !DB.unlocked.contributor){
        DB.unlocked.contributor = true;
        unlockAch('hidden');
        saveDB();
        toast('...세계가 창조주를 알아본다. 비밀 직업 [최병우] 해금');
        SFX.play('win');
        renderClassCards();
      }
      if (window.__seq.join(',')==='ArrowUp,ArrowUp,ArrowDown,ArrowDown,KeyB,KeyA' && !DB.unlocked.debug){
        DB.unlocked.debug = true;
        unlockAch('hidden');
        saveDB();
        toast('!?— 비밀 직업 [디버거] 해금');
        SFX.play('win');
        renderClassCards();
      }
    }
    if (e.code==='Escape'){
      if (state==='playing') setPaused(true);
      else if (state==='paused') setPaused(false);
      else if (state==='inv') closeInv();
    }
    SFX.unlock();
  }
  function handleKeyUp(e){
    const d = keyToDir(e.code);
    if (d) keys.delete(d);
  }
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);

  function grabFocus(){ try{ wrap.focus({preventScroll:true}); }catch(e){ wrap.focus(); } }
  window.addEventListener('load', grabFocus);
  setTimeout(grabFocus,50); setTimeout(grabFocus,300);

  // touch: virtual joystick (visualized) + dash button
  let touchOrigin = null, touchVec = {x:0,y:0}, touchCur = null, movePointerId = null;
  function relPos(e){
    const rect = wrap.getBoundingClientRect();
    return { x:e.clientX-rect.left, y:e.clientY-rect.top };
  }
  wrap.addEventListener('pointerdown', (e)=>{
    grabFocus(); SFX.unlock();
    if (state!=='playing') return;
    if (movePointerId !== null) return; // 이미 이동 손가락이 있음 — 두 번째 손가락은 무시 (대시 버튼 등)
    movePointerId = e.pointerId;
    touchOrigin = relPos(e);
    touchCur = relPos(e);
  });
  wrap.addEventListener('pointermove', (e)=>{
    if (!touchOrigin || e.pointerId !== movePointerId) return; // 내 이동 손가락만 추적
    touchCur = relPos(e);
    const dx = touchCur.x-touchOrigin.x, dy = touchCur.y-touchOrigin.y;
    const d = Math.hypot(dx,dy)||1;
    const m = Math.min(1, d/36);
    touchVec = { x: dx/d*m, y: dy/d*m };
  });
  function endTouch(e){
    if (e && e.pointerId !== undefined && e.pointerId !== movePointerId) return; // 다른 손가락(대시 등)이 떨어져도 이동 유지
    movePointerId = null;
    touchOrigin=null; touchCur=null; touchVec={x:0,y:0};
  }
  wrap.addEventListener('pointerup', endTouch);
  wrap.addEventListener('pointercancel', endTouch);
  wrap.addEventListener('contextmenu', (e)=> e.preventDefault());

  // 🎯 탭/클릭 마크: 짧은 탭(이동 드래그 아님)으로 표적 지정 — 자동사격이 그 표적을 최우선으로 노린다
  // 기믹 보스('진짜 고르기' 등)를 내 손으로 공략하는 수단. 빈 곳 탭 = 해제. 데스크톱=클릭, 모바일=탭.
  let tapInfo = null;
  wrap.addEventListener('pointerdown', (e)=>{
    if (state==='playing') tapInfo = { x:e.clientX, y:e.clientY, t:performance.now(), id:e.pointerId };
  });
  wrap.addEventListener('pointerup', (e)=>{
    if (!tapInfo || e.pointerId!==tapInfo.id) return;
    const dp = Math.hypot(e.clientX-tapInfo.x, e.clientY-tapInfo.y);
    const held = performance.now()-tapInfo.t;
    tapInfo = null;
    if (state!=='playing' || dp>9 || held>320 || !player) return;
    const rect = c.getBoundingClientRect();
    const wx = (e.clientX-rect.left)*(W/rect.width) - W/2 + player.x;
    const wy = (e.clientY-rect.top)*(H/rect.height) - H/2 + player.y;
    // 관문 QTE 오브젝트 우선: 탭하면 즉시 해제/발동
    for (let i=gateObjs.length-1;i>=0;i--){
      const o = gateObjs[i];
      if (o.kind==='qte' && (o.x-wx)**2+(o.y-wy)**2 < (o.r+34)**2){
        gateObjs.splice(i,1);
        if (o.onTap) o.onTap();
        SFX.play('quest');
        return;
      }
    }
    let best=null, bd=70*70;
    for (const en of enemies){ const d=(en.x-wx)**2+(en.y-wy)**2; if (d<bd){ bd=d; best=en; } }
    for (const bs of bosses){ if (bs.ghost) continue; const d=(bs.x-wx)**2+(bs.y-wy)**2; if (d<bd){ bd=d; best=bs; } }
    if (best){
      player.markTarget = best;
      effects.push({ type:'ring', x:best.x, y:best.y, life:0.4, age:0, r0:(best.r||12)+6, r1:(best.r||12)+22 });
      addTextNum(best.x, best.y-(best.r||12)-10, '🎯 표적');
      SFX.play('tele');
    } else if (player.markTarget){
      player.markTarget = null;
      addTextNum(wx, wy, '표적 해제');
    }
  });

  const IS_TOUCH = ('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (IS_TOUCH) dashBtn.style.display = 'flex';
  dashBtn.addEventListener('pointerdown', (e)=>{
    e.stopPropagation(); e.preventDefault(); SFX.unlock();
    if (state==='playing') tryDash();
  });
  $('ultBtn').addEventListener('pointerdown', (e)=>{
    e.stopPropagation(); e.preventDefault(); SFX.unlock();
    if (state==='playing') player.ultFireReq = true;
  });

  window.addEventListener('blur', ()=>{ if (state==='playing') setPaused(true); });
  overlay.addEventListener('pointerdown', (e)=> e.stopPropagation());

  function setPaused(p){
    if (p && state==='playing'){
      state='paused';
      let build = '<div style="font-size:15px; font-weight:700; margin-bottom:6px;">일시정지</div>';
      try{
        build += '<div style="font-size:9.5px;opacity:0.8; white-space:pre-line; margin-bottom:10px;">'+statsSummary()+'</div>';
      }catch(e){}
      build += '<div style="display:flex; gap:8px; justify-content:center; pointer-events:auto;">'
        + '<button class="miniBtn" id="pmResume">▶ 계속하기</button>'
        + '<button class="miniBtn" id="pmSound">'+(DB.muted?'🔇 사운드 켜기':'🔊 사운드 끄기')+'</button>'
        + '<button class="miniBtn" id="pmHome" style="color:#b8362e; border-color:#b8362e;">🏠 홈으로 (런 포기)</button>'
        + '</div>';
      pausedTag.innerHTML = build;
      pausedTag.style.display='block';
      pausedTag.style.pointerEvents = 'auto';
      const rb2 = $('pmResume'), sb2 = $('pmSound'), hb2 = $('pmHome');
      if (rb2) rb2.addEventListener('click', (e)=>{ e.stopPropagation(); setPaused(false); });
      if (sb2) sb2.addEventListener('click', (e)=>{ e.stopPropagation(); muteBtn.click(); setPaused(false); setPaused(true); });
      if (hb2) hb2.addEventListener('click', (e)=>{
        e.stopPropagation();
        if (!confirm('이 런을 포기하고 홈으로 돌아갈까요? (골드·성장은 저장됩니다)')) return;
        pausedTag.style.display='none';
        try{ bankRun(); }catch(err){}
        showIdle();
      });
    }
    else if (!p && state==='paused'){ state='playing'; pausedTag.style.display='none'; last=performance.now(); resumeGrace(); }
  }
  wrap.addEventListener('click', ()=>{ if (state==='paused') setPaused(false); });

  // ---------- maps ----------
  let selMap = 'field';
  let MAP = MAPS.field, PAL = MAP.pal;

  // "잉크 위에 떨어진 물감" — 세계는 잉크, 이펙트와 보상에만 색을 입힌다
  const COLORS = {
    fire:'#e2603f', frost:'#3fa8c9', volt:'#e0b73d', acid:'#6faa4e',
    boom:'#e2823f', mech:'#7a8a99', psi:'#9a6fc4',
    holy:'#e0c04f', grav:'#6a5acd', chrono:'#5ab8c9', blood:'#c9403a',
    gold:'#d9a53f', xp:'#3aa895', hp:'#d9534f', danger:'#c94f4f',
    heart:'#d97ba8', chest:'#b98a3f', crit:'#d9613f'
  };
  function mapUnlocked(key){
    const m = MAPS[key];
    return !m.unlockAfter || !!DB.mapCleared[m.unlockAfter];
  }
  function renderMapRow(){
    mapRow.innerHTML = '';
    // 맵 선택 UI 제거 — 진행 상태만 한 줄로
    const st = document.createElement('div');
    st.style.cssText = 'width:100%; text-align:center; font-family:IBM Plex Mono,monospace; font-size:10.5px; color:var(--ink-500);';
    st.innerHTML = MAP_ORDER.map(k=>{
      const m = MAPS[k];
      const unlocked = mapUnlocked(k);
      return (DB.mapCleared[k]?'✓ ':'') + m.name + (unlocked ? (DB.best[k]?' ('+fmtTime(DB.best[k])+')':'') : ' 🔒');
    }).join('  ·  ');
    mapRow.appendChild(st);
    // 위험도 셀렉터 (디아블로식 난이도, 0~20)
    const pWrap = document.createElement('div');
    pWrap.style.cssText = 'width:100%; display:flex; gap:8px; align-items:center; justify-content:center; font-family:IBM Plex Mono,monospace; font-size:12px; color:var(--ink-700); margin-top:2px; flex-wrap:wrap;';
    const p = DB.peril||0;
    pWrap.innerHTML = '<span style="font-size:10px; color:var(--ink-500);">출격 맵 무작위 배정</span>'
      + '<button class="miniBtn" id="perilDown">−</button>'
      + '<b style="color:var(--ink-900);">위험도 '+p+'</b> <span style="font-size:10px;">/ 최대 '+(DB.perilMax||0)+' (한계 60)</span>'
      + '<button class="miniBtn" id="perilUp">＋</button>'
      + '<span style="font-size:10px; color:var(--ink-500);">적 +'+Math.round(35*p)+'% / 보상 +'+Math.round(25*p)+'%</span>';
    mapRow.appendChild(pWrap);
    setTimeout(()=>{
      const up = $('perilUp'), dn = $('perilDown');
      if (up) up.addEventListener('click', ()=>{ DB.peril = Math.min(DB.perilMax||0, Math.min(60,(DB.peril||0)+1)); saveDB(); renderMapRow(); });
      if (dn) dn.addEventListener('click', ()=>{ DB.peril = Math.max(0,(DB.peril||0)-1); saveDB(); renderMapRow(); });
    }, 0);
  }

  // ---------- quests ----------
  const QUESTS = [
    { key:'kill',    name:'프로세스 정리', unit:'처치',    tiers:[300,1000,3000,8000,20000,50000,120000], gold:[50,120,300,700,1500,3000,6000], equip:[0,0,0,2,0,4,6] },
    { key:'elite',   name:'엘리트 사냥꾼', unit:'엘리트',   tiers:[5,15,40,100,250,600],  gold:[0,0,0,0,800,2000], equip:[1,2,3,4,4,6] },
    { key:'boss',    name:'보스 슬레이어', unit:'보스',     tiers:[3,10,25,60,150,350],   gold:[80,200,500,1200,2500,5000], equip:[0,2,3,4,5,6] },
    { key:'survive', name:'생존 전문가',  unit:'초 생존',   tiers:[180,300,480,720,1200,1800], gold:[60,150,400,900,2000,4000], equip:[0,0,3,0,5,0] },
    { key:'evolve',  name:'병기 개발',    unit:'진화',     tiers:[1,4,10,25,60],       gold:[40,100,250,600,1500], equip:[0,3,4,4,6] },
    { key:'treasure',name:'황금 사냥꾼',  unit:'보물 골렘', tiers:[1,5,15,40],          gold:[60,180,500,1200], equip:[0,2,4,5] },
    { key:'trial',   name:'시련 정복자',  unit:'시련 완수', tiers:[1,3,8,20],           gold:[80,250,700,1800], equip:[0,3,4,6] },
    { key:'client',  name:'해결사',       unit:'의뢰 완수', tiers:[1,5,15,40],          gold:[70,220,600,1500], equip:[0,2,4,5] },
    { key:'fuse',    name:'융합 기술자',  unit:'무기 합성', tiers:[1,5,15],             gold:[100,400,1200], equip:[3,4,6] },
    { key:'imbue',   name:'각인사',       unit:'각인',     tiers:[1,5,20,50],          gold:[60,200,600,1500], equip:[0,3,4,5] },
  ];
  function questAdd(key, n){
    const q = QUESTS.find(q=>q.key===key);
    if (!q) return;
    if (key==='survive') DB.prog[key] = Math.max(DB.prog[key]||0, n);
    else DB.prog[key] = (DB.prog[key]||0) + n;
    let tier = DB.prog.tier[key]||0;
    while (tier < q.tiers.length && DB.prog[key] >= q.tiers[tier]){
      // grant reward
      if (q.gold[tier]) { DB.gold += q.gold[tier]; }
      if (q.equip[tier]) {
        const eb = q.equip[tier];
        if (eb>=6) addEquip(genPrimal());
        else if (eb>=5) addEquip(genUnique());
        else addEquip(genEquip(eb));
      }
      toast('퀘스트 달성! '+q.name+' '+q.tiers[tier]+q.unit
        + (q.gold[tier]? ' → +'+q.gold[tier]+'G':'') + (q.equip[tier]? ' → 장비 획득':''));
      SFX.play('quest');
      tier += 1;
      DB.prog.tier[key] = tier;
    }
    saveDB();
  }
  function renderQuests(){
    questList.innerHTML = '';
    QUESTS.forEach((q)=>{
      const tier = DB.prog.tier[q.key]||0;
      const cur = DB.prog[q.key]||0;
      const row = document.createElement('div');
      row.className = 'shopItem';
      if (tier >= q.tiers.length){
        row.innerHTML = '<div class="info"><div class="nm">'+q.name+'</div><div class="ds">모든 단계 완료!</div></div><div class="lv">★ 완료</div>';
      } else {
        const target = q.tiers[tier];
        const rewardTxt = (q.gold[tier]? '+'+q.gold[tier]+'G ':'') + (q.equip[tier]? '장비상자':'');
        row.innerHTML = '<div class="info"><div class="nm">'+q.name+' '+(tier+1)+'단계</div>'
          + '<div class="ds">'+target+q.unit+' 달성 → '+rewardTxt+'</div></div>'
          + '<div class="lv">'+Math.min(cur,target)+' / '+target+'</div>';
      }
      questList.appendChild(row);
    });
  }

  // ---------- achievements ----------
  const ACHIEVEMENTS = [
    { key:'evolve1',       name:'첫 진화',    desc:'무기를 처음으로 진화시킨다', gold:50 },
    { key:'fever50',       name:'학살자',     desc:'콤보 50 달성', gold:100 },
    { key:'melt',          name:'융해 반응',  desc:'냉기 상태의 적에게 화상을 부여해 융해를 일으킨다', gold:80 },
    { key:'legend',        name:'전설의 시작', desc:'전설 등급 장비 획득', gold:150 },
    { key:'relic',         name:'유물 발굴',  desc:'직업 전용 유물 획득', gold:100 },
    { key:'jackpot',       name:'대박',      desc:'잭팟 카드를 획득한다', gold:150 },
    { key:'lv30',          name:'과성장',     desc:'한 판에 레벨 30 도달', gold:200 },
    { key:'nodmg3',        name:'무결점',     desc:'3분간 피격 없이 생존', gold:200 },
    { key:'dash50',        name:'질주 본능',  desc:'한 판에 대시 50회', gold:100 },
    { key:'clear_field',   name:'필드 정리',  desc:'그레이 필드 클리어', gold:100 },
    { key:'clear_archive', name:'서고 반납',  desc:'침묵의 서고 클리어', gold:200 },
    { key:'clear_abyss',   name:'심연 탈출',  desc:'심연 회로 클리어', gold:400 },
    { key:'gold5k',        name:'자산가',     desc:'보유 골드 5,000 달성', gold:300 },
    { key:'survive20',     name:'불사신',     desc:'한 판 20분 생존', gold:400 },
    { key:'hidden',        name:'???',       desc:'히든 직업을 해금한다', gold:200 },
    { key:'fusion1',       name:'융합의 대가', desc:'무기 합성에 처음 성공한다', gold:150 },
    { key:'imbue1',        name:'첫 각인',    desc:'무기에 원소를 처음 각인한다', gold:80 },
    { key:'peril5',        name:'위험을 즐기는 자', desc:'위험도 5 이상에서 클리어', gold:500 },
    { key:'peril10',       name:'재앙 그 자체', desc:'위험도 10 이상에서 클리어', gold:1500 },
    { key:'peril20',       name:'한계 돌파',   desc:'위험도 20에서 클리어', gold:5000 },
    { key:'primal',        name:'태초에 닿다', desc:'태초 등급 장비 획득', gold:400 },
    { key:'set3',          name:'세트 완성',   desc:'세트 3부위를 모두 장착하고 출격', gold:300 },
    { key:'gw20',          name:'명검의 탄생', desc:'무명검을 20레벨까지 성장시킨다', gold:400 },
    { key:'craft1',        name:'대장장이',    desc:'유일 무기를 처음 제작한다', gold:200 },
    { key:'allmaps',       name:'세계의 끝',   desc:'모든 맵을 클리어한다', gold:1000 },
    { key:'title1',        name:'명명(命名)',  desc:'3속성 조합 칭호를 처음 각성한다', gold:250 },
    { key:'rift1',         name:'차원 여행자', desc:'차원 균열 시련을 돌파한다', gold:200 },
    { key:'wave1',         name:'파도를 넘어', desc:'웨이브 모드를 클리어한다', gold:300 },
    { key:'gate1',         name:'격의 돌파',   desc:'각성 의식으로 성장무기의 격을 돌파한다', gold:300 },
    { key:'mythtech',      name:'신화에 손을 뻗다', desc:'신화 테크를 획득한다', gold:400 },
    { key:'bleed1',        name:'차원 침식 목격자', desc:'다른 세계에서 넘어온 보스를 처치한다', gold:250 },
  ];
  // 업적 → 유니크 장비 직접 해금 (Halls of Torment식)
  const UNIQUE_FROM_ACH = {
    nodmg3:    { slot:'acc1',  r:4, name:'수도자의 띠',     stats:[{k:'hp',v:40},{k:'regen',v:1}], affix:'firstaid' },
    fever50:   { slot:'acc2',  r:4, name:'학살자의 메달',   stats:[{k:'atk',v:12},{k:'crit',v:8}], affix:'execute' },
    survive20: { slot:'cloak', r:4, name:'불사조의 망토',   stats:[{k:'hp',v:50},{k:'regen',v:1.5}], affix:'overdrive' },
    clear_abyss:{ slot:'head', r:4, name:'심연을 본 자의 왕관', stats:[{k:'atk',v:10},{k:'cdr',v:8},{k:'gold',v:12}], affix:'blast' },
  };
  function unlockAch(key){
    if (!DB.ach) DB.ach = {};
    if (DB.ach[key]) return;
    const a = ACHIEVEMENTS.find(a=>a.key===key);
    if (!a) return;
    DB.ach[key] = true;
    if (a.gold) DB.gold += a.gold;
    toast('🏆 업적 달성: '+a.name+(a.gold?' (+'+a.gold+'G)':''));
    const uq = UNIQUE_FROM_ACH[key];
    if (uq){
      addEquip({ id:DB.nextId++, slot:uq.slot, r:uq.r, name:uq.name, stats:uq.stats.map(s=>({k:s.k,v:s.v})), affix:uq.affix, unique:true });
      toast('✦ 유니크 장비 해금: '+uq.name);
    }
    SFX.play('quest');
    saveDB();
  }
  function achCount(){ return Object.keys(DB.ach||{}).length; }
  function renderAch(){
    const list = $('achList');
    list.innerHTML = '';
    // 도감: 유니크·태초·세트 수집 현황
    const uniqNames = new Set(DB.inv.filter(i=>i.r===5).map(i=>i.name));
    const primalN = DB.inv.filter(i=>i.r===6).length;
    const setN = DB.inv.filter(i=>i.set).length;
    const col = document.createElement('div');
    col.className = 'shopItem';
    col.innerHTML = '<div class="info"><div class="nm">📖 수집 도감</div>'
      + '<div class="ds">유니크 '+uniqNames.size+'/'+UNIQUE_POOL.length+' 종 · 태초 '+primalN+'개 · 세트 조각 '+setN+' · 업적 '+achCount()+'/'+ACHIEVEMENTS.length+'</div></div>';
    list.appendChild(col);
    // 성장무기 도감 — 정체를 알 수 없는 설명 (수집욕 자극, 획득 단서 없음)
    const gwDex = [
      { found: DB.growth.found, name:'무명검', hint:'이름을 잃은 검. 벨수록 무언가를 기억해낸다고 한다.' },
      { found: DB.gweps.bow.found, name:'침묵하는 활', hint:'시위를 당겨도 소리가 나지 않는다. 어디서 왔는지 아무도 모른다.' },
      { found: DB.gweps.tome.found, name:'굶주린 마도서', hint:'책장이 스스로 넘어간다. 굶주려 있다.' },
      { found: DB.gweps.blade.found, name:'핏빛 대검', hint:'날에 마르지 않는 얼룩. 들 수 있는 자가 드물다.' },
    ];
    const gwRow = document.createElement('div');
    gwRow.className = 'shopItem';
    gwRow.innerHTML = '<div class="info"><div class="nm">⚔ 성장무기 도감 ('+gwDex.filter(g=>g.found).length+'/4)</div>'
      + '<div class="ds">'+gwDex.map(g=> g.found ? '<b>'+g.name+'</b> — '+g.hint : '??? — <span style="opacity:0.6;">'+g.hint+'</span>').join('<br>')+'</div></div>';
    list.appendChild(gwRow);
    // 테크 도감 — 속성별 발견 현황
    const seen = DB.seenTech||{};
    const techLine = SPEC_TREES.map(tk=>{
      const nodes = TREES[tk].nodes;
      const found = nodes.filter(n=>seen[n.key]).length;
      return '<span style="color:'+(COLORS[tk]||'#888')+'; font-weight:600;">'+TREES[tk].name+' '+found+'/'+nodes.length+'</span>';
    }).join(' · ');
    const techRow = document.createElement('div');
    techRow.className = 'shopItem';
    techRow.innerHTML = '<div class="info"><div class="nm">🔮 테크 도감 (11속성)</div><div class="ds">'+techLine+'</div></div>';
    list.appendChild(techRow);
    ACHIEVEMENTS.forEach((a)=>{
      const done = DB.ach && DB.ach[a.key];
      const row = document.createElement('div');
      row.className = 'shopItem';
      row.style.opacity = done ? '1' : '0.55';
      row.innerHTML = '<div class="info"><div class="nm">'+(done?'✓ ':'')+a.name+'</div>'
        + '<div class="ds">'+a.desc+'</div></div>'
        + '<div class="lv">'+(done?'달성':(a.gold?'+'+a.gold+'G':''))+'</div>';
      list.appendChild(row);
    });
  }

  // ---------- equipment ----------
  // 계열 각인: 절반의 유니크·태초는 특정 직업군 전용으로 떨어진다 (원거리템은 원거리군만)
  const GRP_NAME = { war:'전사군', rng:'원거리군', mag:'마법군', rog:'도적군', pri:'사제군', mer:'상인군' };
  function rollEquipGrp(it){
    if (Math.random()<0.5){
      const gs = Object.keys(GRP_NAME);
      it.grp = gs[(Math.random()*gs.length)|0];
      it.name += ' ⟨'+GRP_NAME[it.grp]+'⟩';
    }
    return it;
  }
  function genUnique(){
    const u = UNIQUE_POOL[(Math.random()*UNIQUE_POOL.length)|0];
    return rollEquipGrp({ id:DB.nextId++, slot:u.slot, r:5, name:u.name, stats:u.stats.map(s=>({k:s.k,v:s.v})), affix:u.affix, unique:true });
  }
  function genSetItem(){
    const keys = Object.keys(SET_DEFS);
    const sk = keys[(Math.random()*keys.length)|0];
    const def = SET_DEFS[sk];
    const it = def.items[(Math.random()*def.items.length)|0];
    return { id:DB.nextId++, slot:it.slot, r:4, name:it.name, stats:it.stats.map(s=>({k:s.k,v:s.v})), affix:null, set:sk };
  }
  function genPrimal(){
    // 태초 (r6): 스탯 4개 + 특성 2개 — 고위험도 전리품
    const it = genEquip(4);
    it.r = 6;
    it.name = '태초의 ' + EQ_NOUNS[it.slot][(Math.random()*EQ_NOUNS[it.slot].length)|0];
    const pool = EQ_STATS.slice();
    it.stats = [];
    for (let i=0;i<4;i++){
      const s = pool.splice((Math.random()*pool.length)|0,1)[0];
      let v = (s.min + Math.random()*(s.max-s.min)) * 2.2;
      it.stats.push({ k:s.k, v: s.dec ? Math.round(v)/10 : Math.round(v) });
    }
    const af = EQ_AFFIX.slice();
    it.affix = af.splice((Math.random()*af.length)|0,1)[0].k;
    it.affix2 = af[(Math.random()*af.length)|0].k;
    it.curse = null;
    return rollEquipGrp(it);
  }
  function genRelic(){
    const keys = Object.keys(RELICS);
    const ck = keys[(Math.random()*keys.length)|0];
    return { id: DB.nextId++, slot:'relic', r:3, name:RELICS[ck].name, stats:[], affix:null, classKey:ck };
  }
  function genEquip(bias){
    // bias 1~4 nudges the rarity roll upward
    let r = 0;
    const roll = Math.random()*100 + (bias||0)*9;
    if (roll>=104) r=4; else if (roll>=94) r=3; else if (roll>=78) r=2; else if (roll>=52) r=1; else r=0;
    const slot = NORMAL_SLOTS[(Math.random()*NORMAL_SLOTS.length)|0];
    // 방어구(머리/몸통)는 경갑·중갑으로 나뉜다 — 중갑은 스탯 +30%지만 일부 직업만 착용 가능
    const wt = (slot==='head'||slot==='body') ? (Math.random()<0.45 ? 'heavy' : 'light') : null;
    // 저주 장비: 고급 이상 12% 확률, 스탯 +50%에 저주 하나
    const curse = (r>=1 && Math.random()<0.12) ? EQ_CURSES[(Math.random()*EQ_CURSES.length)|0].k : null;
    const statCount = [1,1,2,2,3][r];
    const pool = EQ_STATS.slice();
    const stats = [];
    for (let i=0;i<statCount;i++){
      const s = pool.splice((Math.random()*pool.length)|0,1)[0];
      let v = s.min + Math.random()*(s.max-s.min);
      v *= (1 + r*0.30);
      if (wt==='heavy') v *= 1.3;
      if (curse) v *= 1.5;
      v = s.dec ? Math.round(v)/10 : Math.round(v);
      stats.push({ k:s.k, v });
    }
    const affix = r>=3 ? EQ_AFFIX[(Math.random()*EQ_AFFIX.length)|0].k : null;
    const noun = EQ_NOUNS[slot][(Math.random()*EQ_NOUNS[slot].length)|0];
    const name = (curse ? '저주받은 ' : RARITY_PREFIX[r]+' ') + noun;
    return { id: DB.nextId++, slot, r, wt, name, stats, affix, curse };
  }
  function addEquip(item){
    if (DB.inv.length >= 40){
      // auto-sell the cheapest unequipped item
      const equippedIds = allEquippedIds();
      let worst=null, wi=-1;
      DB.inv.forEach((it,i)=>{ if (!equippedIds.has(it.id) && (worst===null || it.r<worst.r)){ worst=it; wi=i; } });
      if (wi>=0){ DB.gold += SELL_PRICE[worst.r]; DB.inv.splice(wi,1); toast('가방이 가득! '+worst.name+' 자동 판매'); }
    }
    DB.inv.push(item);
    toast('장비 획득: ['+RARITY_NAMES[item.r]+'] '+item.name);
    // 초희귀 획득: 전광판 연출 (자랑 타임) + 에고 무기 반응
    if (item.r>=4 && player && ownedWeapon('nameless') && Math.random()<0.7){
      setTimeout(()=>egoSay(EGO_RARE), 900);
    }
    if (item.r>=5){
      showBossBanner(item.r===6 ? '✦ 태초의 유물 ✦' : '✦ 유니크 발견 ✦', item.name, item.r===6 ? '#d9a53f' : '#b8362e');
      freeze = Math.max(freeze, 0.25);
      effects.push({ type:'rays', x:player?player.x:0, y:player?player.y:0, life:0.8, age:0 });
    }
    if (item.r===4) unlockAch('legend');
    if (item.r===6) unlockAch('primal');
    if (item.slot==='relic') unlockAch('relic');
    SFX.play('equip');
    saveDB();
  }
  function statLine(st){
    const def = EQ_STATS.find(s=>s.k===st.k);
    return def.n+' +'+st.v+(def.pct?'%':'');
  }
  function equipDesc(item){
    if (item.slot==='relic'){
      const cls = CLASSES[item.classKey];
      return '['+(cls?cls.name:'?')+' 전용] '+RELICS[item.classKey].desc+' — 다른 직업은 효과 없음';
    }
    let t = item.stats.map(statLine).join(' · ');
    if (item.plus) t = '+'+item.plus+' 강화 (효과 +'+(item.plus*6)+'%) · ' + t;
    if (item.wt) t = (item.wt==='heavy' ? '[중갑] ' : '[경갑] ') + t;
    if (item.set){
      const sd = SET_DEFS[item.set];
      t += ' · [세트: '+sd.name+'] 2셋: '+sd.bonus2+' / 3셋: '+sd.bonus3;
    }
    if (item.affix){
      const a = EQ_AFFIX.find(a=>a.k===item.affix);
      t += ' · ['+a.n+'] '+a.d;
    }
    if (item.affix2){
      const a2 = EQ_AFFIX.find(a=>a.k===item.affix2);
      t += ' · ['+a2.n+'] '+a2.d;
    }
    if (item.curse){
      const c = EQ_CURSES.find(c=>c.k===item.curse);
      t += ' · ☠ [저주] '+c.d;
    }
    if (item.wt==='heavy') t += ' (중갑: 착용 가능 직업 제한)';
    return t;
  }
  // 직업별 장비 로드아웃 — 직업마다 독립된 장비 세팅 (최초엔 기존 공용 장비를 복사)
  function loadoutFor(ck){
    if (!DB.loadouts) DB.loadouts = {};
    if (!DB.loadouts[ck]) DB.loadouts[ck] = {}; // 직업마다 빈손에서 시작 — 탭별 세팅이 확실히 구분되게
    return DB.loadouts[ck];
  }
  function allEquippedIds(){
    const ids = new Set(Object.values(DB.equipped||{}));
    if (DB.loadouts) for (const ck in DB.loadouts) for (const s in DB.loadouts[ck]) ids.add(DB.loadouts[ck][s]);
    return ids;
  }
  function equippedBonuses(classKey){
    const lo = loadoutFor(classKey);
    const out = { atk:0, hp:0, spd:0, cdr:0, crit:0, gold:0, magnet:0, regen:0, affixes:{}, curses:[], relic:null, inactive:0, sets:{} };
    for (const slot of SLOT_KEYS){
      const id = lo[slot];
      if (!id) continue;
      const item = DB.inv.find(i=>i.id===id);
      if (!item) continue;
      if (item.slot==='relic'){
        if (item.classKey===classKey) out.relic = item.classKey;
        else out.inactive += 1;
        continue;
      }
      if (item.wt==='heavy' && !HEAVY_OK[classKey] && !starHasName('중갑 숙련')){ out.inactive += 1; continue; }
      if (item.grp && !(RESONANCE[item.grp]||[]).includes(classKey)){ out.inactive += 1; continue; } // 계열 각인 불일치 — 효과 정지
      const plusMult = 1 + (item.plus||0)*0.06; // 강화 보너스
      out.power = (out.power||0) + (item.r+1)*0.010 + (item.plus||0)*0.005; // 파워 지수 기여 (관문 보정용)
      for (const st of item.stats) out[st.k] += st.v * plusMult;
      if (item.affix) out.affixes[item.affix] = true;
      if (item.affix2) out.affixes[item.affix2] = true;
      if (item.curse) out.curses.push(item.curse);
      if (item.set) out.sets[item.set] = (out.sets[item.set]||0) + 1;
    }
    // 세트 보너스
    if ((out.sets.pilgrim||0)>=2) out.atk += 10;
    if ((out.sets.pilgrim||0)>=3){ out.setProc = 0.08; out.cdr += 8; }
    if ((out.sets.king||0)>=2) out.gold += 25;
    if ((out.sets.king||0)>=3){ out.luckSet = 30; out.setGoldPower = true; }
    if ((out.sets.pilgrim||0)>=3 || (out.sets.king||0)>=3) unlockAch('set3');
    return out;
  }
  function applyEquipBonuses(p, classKey){
    const eq = equippedBonuses(classKey);
    p.equipPower = eq.power || 0;
    p.maxHp += eq.hp;
    p.speed *= 1 + eq.spd/100;
    p.dmgMult *= 1 + eq.atk/100;
    p.cdr *= 1 - eq.cdr/100;
    p.magnet += eq.magnet;
    p.regen += eq.regen;
    p.goldMult *= 1 + eq.gold/100;
    p.critChance += eq.crit/100;
    if (eq.affixes.execute) p.execThresh = Math.max(p.execThresh, 0.15);
    if (eq.affixes.giantkill) p.eliteDmg = (p.eliteDmg||1)*1.15;
    if (eq.affixes.kingslayer) p.bossDmg = (p.bossDmg||1)*1.12;
    if (eq.affixes.blast) p.blastOnKill = true;
    if (eq.affixes.thorns) p.thorns = 0.6;
    if (eq.affixes.firstaid) p.firstAid = true;
    if (eq.affixes.overdrive) p.overdrive = true;
    // 세트 3셋 효과
    if (eq.setProc) p.procBonus = (p.procBonus||0) + eq.setProc;
    if (eq.luckSet) p.luck *= 1 + eq.luckSet/100;
    if (eq.setGoldPower) p.goldPower = true;
    // 직업 전용 유물
    if (eq.relic==='manager'){ p.cdr*=0.92; p.dmgMult*=1.05; }
    else if (eq.relic==='sniper'){ p.critChance+=0.10; }
    else if (eq.relic==='rusher'){ p.speed*=1.08; p.lifesteal+=1; }
    else if (eq.relic==='archer'){ p.rateMult*=1.10; p.pierce+=1; }
    else if (eq.relic==='ninja'){ p.dodge=Math.min(0.5,p.dodge+0.08); }
    else if (eq.relic==='engineer'){ p.goldMult*=1.15; p.cdr*=0.95; }
    else if (eq.relic==='paladin'){ p.dmgTaken*=0.92; p.maxHp+=30; }
    else if (eq.relic==='reaper'){ p.execThresh+=0.05; p.lifesteal+=1; }
    else if (eq.relic==='pilot'){ p.droneBoost+=0.2; p.rateMult*=1.05; }
    else if (eq.relic==='cheol'){ p.dmgTaken*=0.94; p.maxHp+=20; }
    else if (eq.relic==='voidc'){ p.procBonus=(p.procBonus||0)+0.06; }
    else if (eq.relic==='necro'){ p.ghostDur=4; p.ghostCap=(p.ghostCap||4)+1; }
    else if (eq.relic==='bard'){ p.comboKeep=(p.comboKeep||0)+1; p.goldMult*=1.10; }
    // 저주 적용
    for (const c of eq.curses){
      if (c==='noheal') p.healMult *= 0.5;
      else if (c==='glass') p.dmgTaken *= 1.15;
      else if (c==='slowdash') p.dashCdMax *= 1.25;
      else if (c==='greed') p.goldMult *= 0.7;
      else if (c==='fragile') p.maxHp = Math.max(30, Math.round(p.maxHp*0.85));
    }
    p.hp = p.maxHp;
    if (eq.curses.length>0) setTimeout(()=>toast('☠ 저주 장비 '+eq.curses.length+'개 착용 중'), 600);
    if (eq.inactive>0) setTimeout(()=>toast('직업 제한으로 장비 '+eq.inactive+'개 비활성'), 400);
  }
  // 장비 아이콘: 부위별 글리프를 희귀도색으로 그린 미니 캔버스
  const RARITY_ICON_TINT = ['#8f9194','#4c9a55','#3b82c4','#8b5cf6','#e08a2e','#b8362e','#d9a53f'];
  function itemIcon(item){
    const c = document.createElement('canvas');
    c.width = 34; c.height = 34;
    c.style.cssText = 'width:34px; height:34px; flex:none; border-radius:7px; background:var(--paper-2); border:1.5px solid '+(RARITY_ICON_TINT[item.r]||'#999')+';';
    const g = c.getContext('2d');
    const tint = RARITY_ICON_TINT[item.r]||'#999';
    g.strokeStyle = tint; g.fillStyle = tint; g.lineWidth = 2; g.lineCap='round'; g.lineJoin='round';
    g.translate(17,17);
    const s = item.slot;
    if (s==='head'){ g.beginPath(); g.arc(0,1,8,Math.PI,0); g.lineTo(8,5); g.lineTo(-8,5); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(0,-7); g.lineTo(0,-11); g.stroke(); }
    else if (s==='body'){ g.beginPath(); g.moveTo(-7,-8); g.lineTo(7,-8); g.lineTo(9,-3); g.lineTo(6,9); g.lineTo(-6,9); g.lineTo(-9,-3); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(0,-8); g.lineTo(0,9); g.stroke(); }
    else if (s==='hand'){ g.beginPath(); g.moveTo(-5,8); g.lineTo(-5,-4); g.arc(0,-4,5,Math.PI,0); g.lineTo(5,8); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-2,-2); g.lineTo(-2,4); g.moveTo(2,-2); g.lineTo(2,4); g.stroke(); }
    else if (s==='foot'){ g.beginPath(); g.moveTo(-6,-8); g.lineTo(-6,4); g.lineTo(8,4); g.lineTo(8,8); g.lineTo(-6,8); g.closePath(); g.stroke(); }
    else if (s==='cloak'){ g.beginPath(); g.moveTo(-8,-8); g.quadraticCurveTo(0,-11,8,-8); g.lineTo(5,9); g.lineTo(0,6); g.lineTo(-5,9); g.closePath(); g.stroke(); }
    else if (s==='acc1'){ g.beginPath(); g.arc(0,1,6,0,Math.PI*2); g.stroke(); g.beginPath(); g.arc(0,-7,2.5,0,Math.PI*2); g.fill(); }
    else if (s==='acc2'){ g.beginPath(); g.moveTo(0,-9); g.lineTo(7,0); g.lineTo(0,9); g.lineTo(-7,0); g.closePath(); g.stroke(); g.beginPath(); g.arc(0,0,2,0,Math.PI*2); g.fill(); }
    else if (s==='relic'){ g.beginPath(); for (let k=0;k<5;k++){ const a=-Math.PI/2+(Math.PI*2/5)*k; g.lineTo(Math.cos(a)*8, Math.sin(a)*8); const a2=a+Math.PI/5; g.lineTo(Math.cos(a2)*3.5, Math.sin(a2)*3.5); } g.closePath(); g.stroke(); }
    else if (s==='gw'){
      // 유일 성장무기: 은하빛 검 + 반짝임
      c.style.borderImage = 'linear-gradient(135deg,#3aa895,#8b5cf6) 1';
      c.style.boxShadow = '0 0 8px rgba(139,92,246,0.4)';
      const gr = g.createLinearGradient(-9,-9,9,9);
      gr.addColorStop(0,'#3aa895'); gr.addColorStop(1,'#8b5cf6');
      g.strokeStyle = gr; g.fillStyle = gr; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(-6,8); g.lineTo(6,-6); g.stroke(); // 검신
      g.beginPath(); g.moveTo(-3,2); g.lineTo(1,6); g.stroke();  // 가드
      g.beginPath(); g.moveTo(-6,8); g.lineTo(-8,10); g.stroke(); // 자루
      g.fillRect(6,-8,2,2); g.fillRect(9,-3,1.5,1.5); g.fillRect(3,-10,1.5,1.5); // 반짝임
    }
    else { g.beginPath(); g.arc(0,0,7,0,Math.PI*2); g.stroke(); }
    if (item.curse){ g.fillStyle='#b8362e'; g.font='700 10px monospace'; g.textAlign='center'; g.fillText('☠', 10, -8); }
    if ((item.plus||0)>0){ g.fillStyle=tint; g.font='700 8px monospace'; g.textAlign='center'; g.fillText('+'+item.plus, -10, 13); }
    return c;
  }
  let equipClassTab = 'manager';
  function renderEquip(){
    // 직업 탭 — 직업마다 독립 로드아웃
    let tabRow = $('equipTabs');
    if (!tabRow){
      tabRow = document.createElement('div');
      tabRow.id = 'equipTabs';
      tabRow.style.cssText = 'display:flex; gap:4px; flex-wrap:wrap; justify-content:center; width:100%; margin-bottom:2px;';
      slotGrid.parentNode.insertBefore(tabRow, slotGrid);
    }
    tabRow.innerHTML = '';
    Object.keys(CLASSES).forEach((ck)=>{
      if (!isClassUnlocked(ck)) return;
      const tb = document.createElement('button');
      tb.className = 'miniBtn';
      const cc = CLASS_COLORS[ck]||'#888';
      const on = ck===equipClassTab;
      tb.textContent = CLASSES[ck].name;
      tb.style.cssText = 'font-size:10px; padding:4px 8px;' + (on ? 'background:'+cc+'; color:#fff; border-color:'+cc+';' : 'border-color:'+cc+'55; color:'+cc+';');
      tb.addEventListener('click', ()=>{ equipClassTab = ck; renderEquip(); });
      tabRow.appendChild(tb);
    });
    const lo = loadoutFor(equipClassTab);
    // 장착 스탯 합계 표시
    let statBar = $('equipStatBar');
    if (!statBar){
      statBar = document.createElement('div');
      statBar.id = 'equipStatBar';
      statBar.style.cssText = 'font-family:IBM Plex Mono,monospace; font-size:10.5px; color:var(--ink-700); width:100%; text-align:center; padding:3px 0;';
      slotGrid.parentNode.insertBefore(statBar, slotGrid);
    }
    const eb2 = equippedBonuses(equipClassTab);
    statBar.textContent = '합계: 공격 +'+R(eb2.atk)+'% · 체력 +'+R(eb2.hp)+' · 이속 +'+R(eb2.spd)+'% · 쿨감 '+R(eb2.cdr)+'% · 치명 +'+R(eb2.crit)+'% · 골드 +'+R(eb2.gold)+'% · 재생 +'+R1(eb2.regen)
      + (eb2.relic ? ' · 유물 발동' : '') + (eb2.inactive>0 ? ' · ⚠비활성 '+eb2.inactive : '');
    slotGrid.innerHTML = '';
    SLOT_KEYS.forEach((slot)=>{
      const id = lo[slot];
      const item = id ? DB.inv.find(i=>i.id===id) : null;
      const cell = document.createElement('div');
      cell.className = 'slotCell' + (item?' filled':'');
      if (item){
        cell.innerHTML = SLOT_NAMES[slot]+'<b><span class="rbadge r'+item.r+'">'+RARITY_NAMES[item.r]+'</span>'+item.name+'</b>'
          + '<span style="font-size:9px;">'+item.stats.map(statLine).join(' · ')+'</span>';
        cell.style.cursor = 'pointer';
        cell.title = '클릭하여 해제';
        cell.addEventListener('click', ()=>{ delete lo[slot]; saveDB(); renderEquip(); });
      } else {
        cell.innerHTML = SLOT_NAMES[slot]+'<b>비어 있음</b>';
      }
      slotGrid.appendChild(cell);
    });
    // 무기 슬롯 (유일 성장무기)
    {
      const wcell = document.createElement('div');
      const gwKey = lo.gw;
      const gwDef = gwKey && WEAPONS[gwKey];
      wcell.className = 'slotCell' + (gwDef?' filled':'');
      if (gwDef){
        wcell.innerHTML = '무기<b><span class="rbadge rgw">✦</span>'+gwDef.name+'</b><span style="font-size:9px;">런 시작부터 장착 출전</span>';
        wcell.style.cursor = 'pointer';
        wcell.style.borderColor = '#8b5cf6';
        wcell.title = '클릭하여 해제';
        wcell.addEventListener('click', ()=>{ delete lo.gw; saveDB(); renderEquip(); });
      } else {
        wcell.innerHTML = '무기<b>비어 있음</b><span style="font-size:9px;">아래 유일 무기를 장착</span>';
      }
      slotGrid.appendChild(wcell);
    }
    invList.innerHTML = '';
    // ⚔ 무기 섹션 — 기본 무기(직업 고정) / 테크트리 무기(런 중 카드) / 유일 성장무기(장착식, 전용 강화 트리)
    {
      const bw = CLASSES[equipClassTab].weapon;
      const bwName = bw==='random2' ? '무작위 2종' : bw==='random3' ? '무작위 3종' : (WEAPONS[bw] ? WEAPONS[bw].name : bw);
      const wHead = document.createElement('div');
      wHead.className = 'shopItem';
      wHead.innerHTML = '<div class="info"><div class="nm">⚔ 무기</div>'
        + '<div class="ds">기본 무기 <b>'+bwName+'</b> · 일반 무기는 런 중 테크트리 카드로 획득 · <b>유일 성장무기</b>는 아래에서 장착하면 전용 강화 트리가 따라온다</div></div>';
      invList.appendChild(wHead);
    }
    // 유일 성장무기 — 일반 장비와 같은 행 양식 (희귀도: 유일)
    const GW_LIST = [
      { key:'nameless', found:DB.growth.found, lv:DB.growth.lv, def:WEAPONS.nameless, ds:'벨수록 성장하는 검 — 형(型) 선택·전용 강화 트리' },
      { key:'gbow', found:DB.gweps.bow.found, lv:DB.gweps.bow.lv, def:WEAPONS.gbow, ds:'보스의 정수로 성장하는 장궁' },
      { key:'gtome', found:DB.gweps.tome.found, lv:DB.gweps.tome.lv, def:WEAPONS.gtome, ds:'별의 조각을 먹는 마도서' },
      { key:'gblade', found:DB.gweps.blade.found, lv:DB.gweps.blade.lv, def:WEAPONS.gblade, ds:'고대 톱니로 성장하는 대검' },
    ].filter(g=>g.found);
    GW_LIST.forEach(g=>{
      const on = lo.gw === g.key;
      const row = document.createElement('div');
      row.className = 'shopItem gwRow';
      row.innerHTML = '<div class="info"><div class="nm"><span class="rbadge rgw">✦ 유일</span>'
        + g.def.name+' <span style="font-size:9px;color:var(--ink-500);">Lv'+g.lv+'</span>'
        + (on?' <span style="font-size:9px;color:var(--ink-500);">[장착중]</span>':'') + '</div>'
        + '<div class="ds">'+g.ds+' · 장착 시 런 시작부터 들고 출전</div></div>';
      row.insertBefore(itemIcon({ slot:'gw', r:5 }), row.firstChild);
      const eqB = document.createElement('button');
      eqB.className = 'buy';
      eqB.textContent = on ? '해제' : '장착';
      eqB.addEventListener('click', ()=>{
        lo.gw = on ? null : g.key;
        saveDB(); SFX.play('equip'); renderEquip();
      });
      row.appendChild(eqB);
      invList.appendChild(row);
    });
    const equippedIds = Object.values(lo);
    const sorted = DB.inv.slice().sort((a,b)=> b.r-a.r);
    if (!sorted.length){
      const emp = document.createElement('div');
      emp.style.cssText = 'font-size:11px;color:var(--ink-500);padding:10px;';
      emp.textContent = '보유 장비가 없습니다. 보스와 엘리트를 처치해 장비를 모으세요.';
      invList.appendChild(emp);
    }
    sorted.forEach((item)=>{
      const isEq = equippedIds.includes(item.id);
      const row = document.createElement('div');
      row.className = 'shopItem';
      row.innerHTML = '<div class="info"><div class="nm"><span class="rbadge r'+item.r+'">'+RARITY_NAMES[item.r]+'</span>'
        + item.name + (isEq?' <span style="font-size:9px;color:var(--ink-500);">[장착중]</span>':'') + '</div>'
        + '<div class="ds">'+equipDesc(item)+'</div></div>';
      row.insertBefore(itemIcon(item), row.firstChild);
      const eqBtn = document.createElement('button');
      eqBtn.className = 'buy';
      // 직업 제한: 전용 유물은 해당 직업 탭에서만, 중갑은 착용 가능 직업만
      const relicLocked = item.slot==='relic' && item.classKey && item.classKey!==equipClassTab;
      const heavyLocked = item.wt==='heavy' && !HEAVY_OK[equipClassTab] && !starHasName('중갑 숙련');
      if (relicLocked){
        eqBtn.textContent = (CLASSES[item.classKey]?CLASSES[item.classKey].name:'?')+' 전용';
        eqBtn.disabled = true;
      } else if (heavyLocked && !isEq){
        eqBtn.textContent = '중갑 불가';
        eqBtn.disabled = true;
      } else {
        eqBtn.textContent = isEq ? '해제' : '장착';
      }
      eqBtn.addEventListener('click', ()=>{
        if (eqBtn.disabled) return;
        if (isEq){ delete lo[item.slot]; }
        else { lo[item.slot] = item.id; SFX.play('equip'); }
        saveDB(); renderEquip();
      });
      row.appendChild(eqBtn);
      // 강화 (+9까지, 3강마다 별의 조각 필요)
      if (item.slot!=='relic' && (item.plus||0)<9){
        const plus = item.plus||0;
        // 강화 = 핵심 골드 소모처: 지수 곡선 — 고강은 수천 골드를 태운다
        const cost = Math.round(((item.r+1)*40 + plus*30) * Math.pow(1.55, plus) / 5) * 5;
        const needShard = (plus+1)%3===0 ? 1 : 0;
        const enhBtn = document.createElement('button');
        enhBtn.className = 'buy sec';
        enhBtn.textContent = '+'+(plus+1)+' ('+cost+'G'+(needShard?'+★':'')+')';
        enhBtn.disabled = DB.gold<cost || DB.mats.shard<needShard;
        enhBtn.addEventListener('click', ()=>{
          if (DB.gold<cost || DB.mats.shard<needShard) return;
          DB.gold -= cost;
          DB.mats.shard -= needShard;
          item.plus = plus+1;
          saveDB(); SFX.play('equip');
          toast(item.name+' +'+item.plus+' 강화!');
          renderEquip(); goldVal.textContent = DB.gold;
        });
        row.appendChild(enhBtn);
      }
      if (!isEq && !allEquippedIds().has(item.id)){
        const sellBtn = document.createElement('button');
        sellBtn.className = 'buy sec';
        sellBtn.textContent = SELL_PRICE[item.r]+'G 판매';
        sellBtn.addEventListener('click', ()=>{
          DB.gold += SELL_PRICE[item.r];
          DB.inv = DB.inv.filter(i=>i.id!==item.id);
          saveDB(); renderEquip(); goldVal.textContent = DB.gold;
          SFX.play('coin');
        });
        row.appendChild(sellBtn);
        // 흡수: 무명검에게 먹이기
        if (DB.growth.found && !item.unique){
          const absBtn = document.createElement('button');
          absBtn.className = 'buy sec';
          absBtn.textContent = '검에 흡수';
          absBtn.addEventListener('click', ()=>{
            const xp = SELL_PRICE[item.r]*2;
            DB.inv = DB.inv.filter(i=>i.id!==item.id);
            DB.growth.xp += xp;
            while (DB.growth.xp >= 20 + DB.growth.lv*15){
              if (GROWTH_GATE_LVS.includes(DB.growth.lv)){ toast('⚔ 무명검이 격(格)의 벽에 막혔다 — 영구 강화에서 각성 의식 필요'); break; }
              DB.growth.xp -= (20 + DB.growth.lv*15);
              DB.growth.lv += 1;
              toast('무명검이 장비를 삼키고 성장했다 — Lv'+DB.growth.lv);
              growthTierToast(DB.growth.lv);
            }
            saveDB(); SFX.play('sweep');
            renderEquip();
          });
          row.appendChild(absBtn);
        }
      }
      invList.appendChild(row);
    });
  }

  // ---------- meta shop ----------
  const META_ITEMS = [
    { key:'hp',     name:'기초 체력',   desc:'시작 최대체력 +12 / 레벨', max:5, base:30 },
    { key:'dmg',    name:'공격 계수',   desc:'모든 피해 +8% / 레벨',     max:5, base:40 },
    { key:'spd',    name:'이동 회로',   desc:'이동속도 +4% / 레벨',      max:5, base:35 },
    { key:'gold',   name:'환율 우대',   desc:'골드 획득 +12% / 레벨',    max:5, base:35 },
    { key:'magnet', name:'수집 반경',   desc:'시작 자석 범위 +18 / 레벨', max:5, base:30 },
    { key:'reroll', name:'리롤 토큰',   desc:'레벨업 리롤 횟수 +1 / 레벨', max:3, base:60 },
    { key:'revive', name:'백업 전원',   desc:'사망 시 1회 부활 (체력 50%)', max:1, base:400 },
  ];
  function metaCost(item){
    const lv = DB.meta[item.key]||0;
    return Math.round(item.base * Math.pow(1.7, lv) / 5) * 5;
  }
  // 성장 무기 도감 (직업군별 파밍 무기)
  const GWEP_DEFS = {
    bow:   { name:'침묵하는 활',   mat:'essence', matN:'보스의 정수', craftCost:3, group:'원거리 계열 (궁수·저격수·파일럿)' },
    tome:  { name:'굶주린 마도서', mat:'shard',   matN:'별의 조각',   craftCost:5, group:'술법 계열 (관리자·기술자·공허술사)' },
    blade: { name:'핏빛 대검',     mat:'gear',    matN:'고대 톱니',   craftCost:4, group:'근접 계열 (돌격병·성기사·사신·철혈)' },
  };
  function renderShop(){
    goldVal.textContent = DB.gold;
    shopList.innerHTML = '';
    // 재료 현황
    const matRow = document.createElement('div');
    matRow.className = 'shopItem';
    matRow.innerHTML = '<div class="info"><div class="nm">파밍 재료</div>'
      + '<div class="ds">★ 별의 조각 <b>'+DB.mats.shard+'</b> (엘리트) · ◆ 보스의 정수 <b>'+DB.mats.essence+'</b> (보스) · ⚙ 고대 톱니 <b>'+DB.mats.gear+'</b> (보물 골렘)</div></div>';
    shopList.appendChild(matRow);
    // 소모품 (다음 런 1회용)
    [
      { nm:'리롤 토큰', ds:'다음 런에서 리롤 +1 (1회용, 누적 가능)', cost:30, fx:()=>{ DB.consum.reroll+=1; } },
      { nm:'부활 보험', ds:'다음 런에서 부활 1회 (1회용)', cost:150, fx:()=>{ DB.consum.revive+=1; } },
    ].forEach((c)=>{
      const row = document.createElement('div');
      row.className = 'shopItem';
      const held = c.nm==='리롤 토큰' ? DB.consum.reroll : DB.consum.revive;
      row.innerHTML = '<div class="info"><div class="nm">'+c.nm+(held>0?' <span class="lv">보유 '+held+'</span>':'')+'</div><div class="ds">'+c.ds+'</div></div>';
      const buy = document.createElement('button');
      buy.className = 'buy';
      buy.textContent = c.cost+'G';
      buy.disabled = DB.gold < c.cost;
      buy.addEventListener('click', ()=>{
        if (DB.gold < c.cost) return;
        DB.gold -= c.cost;
        c.fx(); saveDB(); SFX.play('coin'); renderShop();
      });
      row.appendChild(buy);
      shopList.appendChild(row);
    });
    // 성장 무기 제작/강화
    const sep0 = document.createElement('div');
    sep0.style.cssText = 'font-size:11px;color:var(--ink-500);margin-top:6px;letter-spacing:1px;';
    sep0.textContent = '— 유일 무기 공방 —';
    shopList.appendChild(sep0);
    Object.keys(GWEP_DEFS).forEach((gk)=>{
      const gd = GWEP_DEFS[gk];
      const gw = DB.gweps[gk];
      const row = document.createElement('div');
      row.className = 'shopItem';
      if (!gw.found){
        row.innerHTML = '<div class="info"><div class="nm">'+gd.name+' 제작 <span class="rbadge r5">유일</span></div>'
          + '<div class="ds">'+gd.group+' — '+gd.matN+' '+gd.craftCost+'개 + 100G 필요</div></div>';
        const buy = document.createElement('button');
        buy.className = 'buy';
        buy.textContent = '제작';
        buy.disabled = DB.mats[gd.mat] < gd.craftCost || DB.gold < 100;
        buy.addEventListener('click', ()=>{
          if (DB.mats[gd.mat] < gd.craftCost || DB.gold < 100) return;
          DB.mats[gd.mat] -= gd.craftCost;
          DB.gold -= 100;
          gw.found = true;
          unlockAch('craft1');
          saveDB(); SFX.play('evolve');
          toast(gd.name+' 제작 완료! 레벨업에서 선택 가능');
          renderShop();
        });
        row.appendChild(buy);
      } else {
        const need = 20 + gw.lv*15;
        row.innerHTML = '<div class="info"><div class="nm">'+gd.name+' Lv'+gw.lv+' <span class="rbadge r5">유일</span></div>'
          + '<div class="ds">'+gw.xp+'/'+need+' 경험치 — '+gd.matN+' 1개+30G로 강화 (+30xp)</div></div>';
        const buy = document.createElement('button');
        buy.className = 'buy';
        buy.textContent = '강화';
        buy.disabled = DB.mats[gd.mat] < 1 || DB.gold < 30;
        buy.addEventListener('click', ()=>{
          if (DB.mats[gd.mat] < 1 || DB.gold < 30) return;
          DB.mats[gd.mat] -= 1;
          DB.gold -= 30;
          gw.xp += 30;
          while (gw.xp >= 20 + gw.lv*15){ gw.xp -= (20 + gw.lv*15); gw.lv += 1; toast(gd.name+' 성장! Lv'+gw.lv); }
          saveDB(); SFX.play('quest'); renderShop();
        });
        row.appendChild(buy);
      }
      shopList.appendChild(row);
    });

    // ---- 도박 코너 ----
    const sep = document.createElement('div');
    sep.style.cssText = 'font-size:11px;color:var(--ink-500);margin-top:6px;letter-spacing:1px;';
    sep.textContent = '— 도박 코너 —';
    shopList.appendChild(sep);

    const gacha = document.createElement('div');
    gacha.className = 'shopItem';
    gacha.innerHTML = '<div class="info"><div class="nm">장비 뽑기</div>'
      + '<div class="ds">무작위 장비 1개 — 일반 40% · 고급 30% · 희귀 18% · 영웅 9% · 전설 3%</div></div>';
    const gBuy = document.createElement('button');
    gBuy.className = 'buy';
    gBuy.textContent = '120G';
    gBuy.disabled = DB.gold < 120;
    gBuy.addEventListener('click', ()=>{
      if (DB.gold < 120) return;
      DB.gold -= 120;
      if (Math.random()<0.10){
        addEquip(genRelic());
        SFX.play('evolve');
        saveDB(); renderShop();
        return;
      }
      const roll = Math.random()*100;
      let r = 0;
      if (roll>=97) r=4; else if (roll>=88) r=3; else if (roll>=70) r=2; else if (roll>=40) r=1;
      const item = genEquip(0);
      item.r = r; // 뽑기 전용 확률표로 등급을 강제하고 스탯을 다시 굴린다
      const statCount = [1,1,2,2,3][r];
      const pool2 = EQ_STATS.slice();
      item.stats = [];
      for (let i=0;i<statCount;i++){
        const s = pool2.splice((Math.random()*pool2.length)|0,1)[0];
        let v = s.min + Math.random()*(s.max-s.min);
        v *= (1 + r*0.30);
        item.stats.push({ k:s.k, v: s.dec ? Math.round(v)/10 : Math.round(v) });
      }
      item.affix = r>=3 ? EQ_AFFIX[(Math.random()*EQ_AFFIX.length)|0].k : null;
      item.name = RARITY_PREFIX[r]+' '+EQ_NOUNS[item.slot][(Math.random()*EQ_NOUNS[item.slot].length)|0];
      addEquip(item);
      SFX.play(r>=3 ? 'evolve' : 'chest');
      saveDB(); renderShop();
    });
    gacha.appendChild(gBuy);
    shopList.appendChild(gacha);

    const bet = document.createElement('div');
    bet.className = 'shopItem';
    bet.innerHTML = '<div class="info"><div class="nm">따당 도박</div>'
      + '<div class="ds">50G 베팅 — 45% 꽝 · 50% 2배(100G) · 5% 잭팟(300G)</div></div>';
    const bBuy = document.createElement('button');
    bBuy.className = 'buy';
    bBuy.textContent = '50G';
    bBuy.disabled = DB.gold < 50;
    bBuy.addEventListener('click', ()=>{
      if (DB.gold < 50) return;
      DB.gold -= 50;
      const roll = Math.random();
      if (roll < 0.05){ DB.gold += 300; toast('잭팟!! +300G'); SFX.play('win'); }
      else if (roll < 0.55){ DB.gold += 100; toast('당첨! +100G'); SFX.play('coin'); }
      else { toast('꽝... -50G'); SFX.play('hit'); }
      saveDB(); renderShop();
    });
    bet.appendChild(bBuy);
    shopList.appendChild(bet);

    // 무명검 각성 의식 — 골드 연마 폐지. 성장은 오직 처치·흡수로, 돌파 단계에서만 재료 의식이 열린다
    if (DB.growth.found){
      const GATES = { 9:{shard:2,gold:200,next:'무명검·각성'}, 19:{shard:4,gold:400,next:'명검·해방'}, 34:{shard:7,gold:800,next:'진명검·현신'}, 59:{shard:12,gold:1500,next:'무극검·초월'}, 99:{shard:20,gold:3000,next:'시원의 검·귀일'} };
      const gate = GATES[DB.growth.lv];
      if (gate){
        const gr = document.createElement('div');
        gr.className = 'shopItem gwRow';
        gr.innerHTML = '<div class="info"><div class="nm">⚔ 각성 의식 <span class="rbadge rgw">✦ 유일</span></div>'
          + '<div class="ds">무명검이 다음 격(格)의 문턱에 섰다 — <b>['+gate.next+']</b>로 돌파하려면 의식이 필요하다<br>'
          + '필요: 별의 조각 ×'+gate.shard+' (보유 '+DB.mats.shard+') + '+gate.gold+'G</div></div>';
        const gBuy2 = document.createElement('button');
        gBuy2.className = 'buy';
        gBuy2.textContent = '의식 거행';
        gBuy2.disabled = DB.gold < gate.gold || DB.mats.shard < gate.shard;
        gBuy2.addEventListener('click', ()=>{
          if (DB.gold < gate.gold || DB.mats.shard < gate.shard) return;
          DB.gold -= gate.gold;
          DB.mats.shard -= gate.shard;
          DB.growth.lv += 1;
          DB.growth.xp = 0;
          growthTierToast(DB.growth.lv);
          unlockAch('gate1');
          saveDB(); SFX.play('evolve');
          renderShop();
        });
        gr.appendChild(gBuy2);
        shopList.appendChild(gr);
      }
    }
  }

  // ---------- idle panel switching ----------
  function showPanel(name){
    classBox.style.display = name==='class' ? 'flex':'none';
    shopBox.style.display  = name==='shop' ? 'flex':'none';
    equipBox.style.display = name==='equip' ? 'flex':'none';
    questBox.style.display = name==='quest' ? 'flex':'none';
    $('achBox').style.display = name==='ach' ? 'flex':'none';
    $('dexBox').style.display = name==='dex' ? 'flex':'none';
    $('starBox').style.display = name==='star' ? 'flex':'none';
    shopBtn.classList.toggle('on', name==='shop');
    equipBtn.classList.toggle('on', name==='equip');
    questBtn.classList.toggle('on', name==='quest');
    $('achBtn').classList.toggle('on', name==='ach');
    $('dexBtn').classList.toggle('on', name==='dex');
    $('starBtn').classList.toggle('on', name==='star');
    if (name==='shop') renderShop();
    if (name==='equip') renderEquip();
    if (name==='quest') renderQuests();
    if (name==='dex') renderDex();
    if (name==='ach') renderAch();
    if (name==='star'){ setTimeout(()=>{ resizeStarCanvas(); drawStarTree(); }, 30); }
    goldVal.textContent = DB.gold;
  }
  shopBtn.addEventListener('click', ()=> showPanel(shopBox.style.display==='flex'?'class':'shop'));
  equipBtn.addEventListener('click', ()=> showPanel(equipBox.style.display==='flex'?'class':'equip'));
  questBtn.addEventListener('click', ()=> showPanel(questBox.style.display==='flex'?'class':'quest'));
  $('achBtn').addEventListener('click', ()=> showPanel($('achBox').style.display==='flex'?'class':'ach'));
  $('dexBtn').addEventListener('click', ()=> showPanel($('dexBox').style.display==='flex'?'class':'dex'));
  $('starBtn').addEventListener('click', ()=> showPanel($('starBox').style.display==='flex'?'class':'star'));

  // 일일 도전 — 날짜 시드로 모두가 같은 조건에서 경쟁
  function mulberry32(a){
    return function(){
      a|=0; a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296;
    };
  }
  function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  $('dailyBtn').addEventListener('click', ()=>{
    dailyPending = !dailyPending;
    $('dailyBtn').classList.toggle('on', dailyPending);
    toast(dailyPending ? '📅 일일 도전 모드 — 오늘('+todayStr()+') 모두가 같은 시드로 경쟁!' : '일일 도전 해제');
    SFX.play('beep');
  });
  // 세이브 백업/복원 — 카톡 인앱 브라우저는 저장소가 사라질 수 있어 코드로 백업
  $('saveBtn').addEventListener('click', ()=>{
    const mode = confirm('확인 = 세이브 내보내기 (코드 복사)\n취소 = 세이브 가져오기 (코드 붙여넣기)');
    if (mode){
      const code = btoa(unescape(encodeURIComponent(JSON.stringify(DB))));
      try{
        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(code);
          toast('세이브 코드가 클립보드에 복사됨! 메모장에 붙여넣어 보관하세요');
        }
      }catch(e){}
      prompt('이 코드를 복사해 보관하세요 (카톡 나가기 전에!):', code);
    } else {
      const code = prompt('세이브 코드를 붙여넣으세요:');
      if (!code) return;
      try{
        const d = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
        if (!d || typeof d.gold !== 'number') throw new Error('bad');
        localStorage.setItem(SAVE_KEY, JSON.stringify(d));
        toast('세이브 복원 완료! 새로고침합니다...');
        setTimeout(()=>location.reload(), 800);
      }catch(e){
        toast('잘못된 코드입니다');
        SFX.play('hit');
      }
    }
  });
  // 기본 = 웨이브 모드. 버튼은 '무한 모드' 토글
  $('sprintBtn').textContent = '♾ 무한 모드';
  $('sprintBtn').addEventListener('click', ()=>{
    waveModePending = !waveModePending;
    $('sprintBtn').classList.toggle('on', !waveModePending);
    toast(!waveModePending ? '♾ 무한 모드 — 웨이브 제한 없이 원래 흐름대로 (최종 보스는 맵 시간에)' : '⚡ 기본(웨이브) 모드로 복귀 — 8웨이브 + 최종 보스');
    SFX.play('beep');
  });
  document.querySelectorAll('.backBtn').forEach(b=> b.addEventListener('click', ()=>{
    if (state==='inv'){ closeInv(); return; }
    showPanel('class');
  }));

  // ---------- 성좌 트리 (PoE식 영구 패시브) ----------
  // 중앙 '기원'에서 6대 계열로 뻗는 별자리. 소형 노드(스탯) → 노터블(특수 효과) → 키스톤(양날 빌드 효과).
  const STAR_NODES = {};
  (function buildStarTree(){
    function add(id, x, y, tier, name, desc, ap, links, color){
      STAR_NODES[id] = { id, x, y, tier, name, desc, ap, links, color };
      for (const l of links){
        if (STAR_NODES[l] && !STAR_NODES[l].links.includes(id)) STAR_NODES[l].links.push(id);
      }
    }
    add('center', 0, 0, 'start', '기원', '모든 여정이 시작되는 곳', null, [], '#8f9194');
    const STEP = 36;
    STAR_BRANCHES.forEach((br, bi)=>{
      const th = br.angle*Math.PI/180;
      // 관문 (중앙과 가지 사이)
      const gid = br.key+'_g';
      add(gid, Math.cos(th)*34, Math.sin(th)*34, 'small', br.name+'의 관문', br.small.d, br.small.ap, ['center'], br.color);
      // 본 가지 11단: 소소N0 소소N1 소소N2 소 K
      const steps = ['s','s','N0','s','s','N1','s','s','N2','s','K'];
      let prev = gid, ni = 0;
      steps.forEach((st, si)=>{
        const r = 70 + si*STEP;
        const a = th + Math.sin(si*0.8)*0.07;
        const x = Math.cos(a)*r, y = Math.sin(a)*r;
        let id, tier, name, desc, ap;
        if (st==='s'){ id = br.key+'_s'+si; tier='small'; name=br.small.n; desc=br.small.d; ap=br.small.ap; }
        else if (st==='K'){ id = br.key+'_k'; tier='key'; name=br.keystone.n; desc=br.keystone.d; ap=br.keystone.ap; }
        else { const nb = br.notables[ni++]; id = br.key+'_n'+ni; tier='notable'; name=nb.n; desc=nb.d; ap=nb.ap; }
        add(id, x, y, tier, name, desc, ap, [prev], br.color);
        prev = id;
      });
      // 곁가지 A (N1에서, +0.40): 소·소·노터블4
      let sprev = br.key+'_n1';
      for (let k=0;k<3;k++){
        const r = 70 + (3+k)*STEP;
        const a = th + 0.40;
        const isN = k===2;
        const nb = br.notables[3];
        const id = br.key+(isN?'_x1':'_a'+k);
        add(id, Math.cos(a)*r, Math.sin(a)*r, isN?'notable':'small',
            isN?nb.n:br.small.n, isN?nb.d:br.small.d, isN?nb.ap:br.small.ap, [sprev], br.color);
        sprev = id;
      }
      // 곁가지 B (N2에서, -0.40): 소·소·노터블5
      sprev = br.key+'_n2';
      for (let k=0;k<3;k++){
        const r = 70 + (6+k)*STEP;
        const a = th - 0.40;
        const isN = k===2;
        const nb = br.notables[4];
        const id = br.key+(isN?'_x2':'_b'+k);
        add(id, Math.cos(a)*r, Math.sin(a)*r, isN?'notable':'small',
            isN?nb.n:br.small.n, isN?nb.d:br.small.d, isN?nb.ap:br.small.ap, [sprev], br.color);
        sprev = id;
      }
      // 곁가지 C (N3에서, +0.34): 스탯 부스터 소형 3개
      sprev = br.key+'_n3';
      for (let k=0;k<3;k++){
        const r = 70 + (9+k)*STEP;
        const a = th + 0.34;
        const id = br.key+'_c'+k;
        add(id, Math.cos(a)*r, Math.sin(a)*r, 'small', br.small.n, br.small.d, br.small.ap, [sprev], br.color);
        sprev = id;
      }
      // v6-2차: 직업 성단 — 키스톤 너머, "이 계열 직업으로 플레이할 때만" 발동하는 전용 구역
      const CL = {
        war: { nN:'전사의 긍지', nD:'[전사군 전용] 모든 피해 +10%', nF:(p)=>{ p.dmgMult*=1.1; },
               kN:'군신(軍神)', kD:'[전사군 전용] 피해 +15%, 받는 피해 -8%', kF:(p)=>{ p.dmgMult*=1.15; p.dmgTaken*=0.92; } },
        rng: { nN:'사냥의 대가', nD:'[원거리군 전용] 공격속도 +10%', nF:(p)=>{ p.rateMult*=1.1; },
               kN:'천리안', kD:'[원거리군 전용] 치명 +10%, 관통 +1', kF:(p)=>{ p.critChance=Math.min(0.9,p.critChance+0.1); p.pierce+=1; } },
        mag: { nN:'비전 통달', nD:'[마법군 전용] 원소 발동 +8%p', nF:(p)=>{ p.procBonus=(p.procBonus||0)+0.08; },
               kN:'대마도사', kD:'[마법군 전용] 쿨다운 -12%, 피해 +10%', kF:(p)=>{ p.cdr*=0.88; p.dmgMult*=1.1; } },
        rog: { nN:'그림자 계약', nD:'[도적군 전용] 회피 +8%', nF:(p)=>{ p.dodge=Math.min(0.65,p.dodge+0.08); },
               kN:'밤의 지배자', kD:'[도적군 전용] 치명 +12%, 대시 쿨 -15%', kF:(p)=>{ p.critChance=Math.min(0.9,p.critChance+0.12); p.dashCdMax*=0.85; } },
        pri: { nN:'성직 서약', nD:'[사제군 전용] 회복 효과 +20%', nF:(p)=>{ p.healMult*=1.2; },
               kN:'대사제', kD:'[사제군 전용] 재생 +1, 받는 피해 -10%', kF:(p)=>{ p.regen+=1; p.dmgTaken*=0.9; } },
        mer: { nN:'길드 마스터', nD:'[상인군 전용] 골드 +20%', nF:(p)=>{ p.goldMult*=1.2; },
               kN:'재벌', kD:'[상인군 전용] 행운 +30%, 골드 +20%', kF:(p)=>{ p.luck*=1.3; p.goldMult*=1.2; } },
      }[br.key];
      if (CL){
        let cprev = br.key+'_k';
        for (let k=0;k<2;k++){
          const r = 70 + (11+k)*STEP;
          const a = th - 0.12;
          const id = br.key+'_cl'+k;
          add(id, Math.cos(a)*r, Math.sin(a)*r, 'small', br.small.n, br.small.d, br.small.ap, [cprev], br.color);
          cprev = id;
        }
        const rn = 70 + 13*STEP, an = th - 0.12;
        add(br.key+'_cln', Math.cos(an)*rn, Math.sin(an)*rn, 'notable', CL.nN, CL.nD,
            (B)=>{ (B.classPerks=B.classPerks||[]).push({ g:br.key, f:CL.nF }); }, [cprev], br.color);
        add(br.key+'_clk', Math.cos(an)*(rn+STEP), Math.sin(an)*(rn+STEP), 'key', CL.kN, CL.kD,
            (B)=>{ (B.classPerks=B.classPerks||[]).push({ g:br.key, f:CL.kF }); }, [br.key+'_cln'], br.color);
        // 전직의 길 성좌 (영구): 런에서 같은 이름의 전직 가지를 고르면 1단계 무료 개방 — 영구 성도와 런 전직의 다리
        const WAYS = { war:['공세','수호','광폭'], rng:['속사','관통','급소'], mag:['연산','원소','증폭'],
                       rog:['그림자','급소','처형'], pri:['축복','수호','심판'], mer:['재화','행운','환전'] }[br.key];
        if (WAYS){
          WAYS.forEach((wn, wi2)=>{
            const aw2 = th + 0.24 + wi2*0.09;
            const rw = 70 + 14.2*STEP;
            add(br.key+'_way'+wi2, Math.cos(aw2)*rw, Math.sin(aw2)*rw, 'notable', wn+'의 길 성좌',
                '[전직 공명] 런에서 ['+wn+'의 길] 전직 가지를 고르는 순간 그 가지 1단계가 무료로 개방된다 · 즉시 효과: 모든 피해 +2%',
                (B)=>{ B.dmg+=2; }, [br.key+'_k'], br.color);
          });
        }
      }
    });
    // v6.20: 32직업 개별 소성단 — 직업 성단 키스톤 너머, 그 직업으로 플레이할 때만 발동하는 전용 별
    const CS = {
      rusher:{n:'맹진',d:'[돌격병 전용] 피해 +8%, 이속 +5%',f:(p)=>{p.dmgMult*=1.08;p.speed*=1.05;}},
      paladin:{n:'서약의 방패',d:'[성기사 전용] 받는 피해 -8%, 재생 +0.4',f:(p)=>{p.dmgTaken*=0.92;p.regen+=0.4;}},
      cheol:{n:'철혈의 심장',d:'[철혈 전용] 최대체력 +15%, 가시 +30%',f:(p)=>{p.maxHp=Math.round(p.maxHp*1.15);p.hp=p.maxHp;p.thorns=(p.thorns||0)+0.3;}},
      exhero:{n:'전성기의 기억',d:'[전직 용사 전용] 피해 +10%, 경험치 +8%',f:(p)=>{p.dmgMult*=1.1;p.xpMult=(p.xpMult||1)*1.08;}},
      madman:{n:'더 깊은 광기',d:'[광인 전용] 피해 +12%, 받는 피해 +5%',f:(p)=>{p.dmgMult*=1.12;p.dmgTaken*=1.05;}},
      monk:{n:'백팔번뇌',d:'[수도승 전용] 1번 무기 강화 상한 +10%p',f:(p)=>{p.weaponCap1=(p.weaponCap1||1.3)+0.10;}},
      archer:{n:'폭풍 시위',d:'[궁수 전용] 공속 +8%, 투사체 +1 (10% 확률)',f:(p)=>{p.rateMult*=1.08;p.multishotCh=(p.multishotCh||0)+0.10;}},
      sniper:{n:'단 한 발',d:'[저격수 전용] 치명 배율 +0.5',f:(p)=>{p.critMult+=0.5;}},
      pilot:{n:'에이스 기동',d:'[파일럿 전용] 이속 +8%, 회피 +4%',f:(p)=>{p.speed*=1.08;p.dodge=Math.min(0.7,p.dodge+0.04);}},
      manager:{n:'결재 전결권',d:'[관리자 전용] 쿨다운 -10%',f:(p)=>{p.cdr*=0.9;}},
      voidc:{n:'심연 응시',d:'[공허술사 전용] 원소 발동 +7%p',f:(p)=>{p.procBonus=(p.procBonus||0)+0.07;}},
      ninja:{n:'그림자 여덟',d:'[닌자 전용] 회피 +6%, 대시 쿨 -12%',f:(p)=>{p.dodge=Math.min(0.7,p.dodge+0.06);p.dashCdMax*=0.88;}},
      reaper:{n:'수확의 계절',d:'[사신 전용] 처형 임계 +6%p',f:(p)=>{p.execThresh=Math.min(0.45,(p.execThresh||0)+0.06);}},
      glitch:{n:'세그폴트',d:'[글리치 전용] 치명 +8%, 피해 +6%',f:(p)=>{p.critChance=Math.min(0.9,p.critChance+0.08);p.dmgMult*=1.06;}},
      blackcat:{n:'아홉 목숨',d:'[흑묘 전용] 회피 +8%',f:(p)=>{p.dodge=Math.min(0.7,p.dodge+0.08);}},
      shadow:{n:'일격의 정적',d:'[그림자 전용] 치명 배율 +0.4, 이속 +4%',f:(p)=>{p.critMult+=0.4;p.speed*=1.04;}},
      tombraider:{n:'유물 감식안',d:'[도굴꾼 전용] 수집 범위 +50, 행운 +15%',f:(p)=>{p.magnet+=50;p.luck*=1.15;}},
      mumyeong:{n:'무명의 깨달음',d:'[무명자 전용] 피해 +8%, 쿨다운 -6%',f:(p)=>{p.dmgMult*=1.08;p.cdr*=0.94;}},
      commander:{n:'총지휘',d:'[지휘관 전용] 위성·소환 피해 +18%',f:(p)=>{p.satDmg=(p.satDmg||1)*1.18;}},
      necro:{n:'망자의 군단',d:'[강령술사 전용] 소환수 피해 +15%, 재생 +0.3',f:(p)=>{p.satDmg=(p.satDmg||1)*1.15;p.regen+=0.3;}},
      bard:{n:'앙코르',d:'[음유시인 전용] 쿨다운 -8%, 회복 +15%',f:(p)=>{p.cdr*=0.92;p.healMult*=1.15;}},
      returner:{n:'회귀자의 예지',d:'[회귀자 전용] 받는 피해 -6%, 경험치 +6%',f:(p)=>{p.dmgTaken*=0.94;p.xpMult=(p.xpMult||1)*1.06;}},
      engineer:{n:'오버클럭',d:'[기술자 전용] 위성 피해 +15%, 공속 +5%',f:(p)=>{p.satDmg=(p.satDmg||1)*1.15;p.rateMult*=1.05;}},
      debug:{n:'핫픽스',d:'[디버거 전용] 쿨다운 -8%, 치명 +5%',f:(p)=>{p.cdr*=0.92;p.critChance=Math.min(0.9,p.critChance+0.05);}},
      tourist:{n:'만보객',d:'[관광객 전용] 이속 +8%, 걸음 골드 가속',f:(p)=>{p.speed*=1.08;p.walkGold=true;}},
      slime:{n:'무한 증식',d:'[슬라임 전용] 최대체력 +18%',f:(p)=>{p.maxHp=Math.round(p.maxHp*1.18);p.hp=p.maxHp;}},
      gambler:{n:'하이 롤러',d:'[도박사 전용] 행운 +25%',f:(p)=>{p.luck*=1.25;}},
      collector:{n:'완벽한 진열장',d:'[수집가 전용] 상자 결과 상향',f:(p)=>{p.chestPlus=true;}},
      contributor:{n:'커밋 권한',d:'[기여자 전용] 피해 +8%, 골드 +10%',f:(p)=>{p.dmgMult*=1.08;p.goldMult*=1.1;}},
      baeksu:{n:'프로 백수',d:'[백수 전용] 경험치 +12%',f:(p)=>{p.xpMult=(p.xpMult||1)*1.12;}},
      stonks:{n:'존버 정신',d:'[스톤크스 전용] 골드 +15%, 이자 강화',f:(p)=>{p.goldMult*=1.15;}},
      gymbro:{n:'3대 500',d:'[헬창 전용] 최대체력 +12%, 피해 +8%',f:(p)=>{p.maxHp=Math.round(p.maxHp*1.12);p.hp=p.maxHp;p.dmgMult*=1.08;}},
    };
    // v6.22: 직업 승천 웹 — 소성단 너머로 3갈래 분기, 사이드스톤(변형 중)·키스톤(변형 대)이
    // 캐릭터의 메커니즘 자체를 바꾼다. 키스톤은 2차 전직 도달 시 '심화'가 추가 개방된다.
    const WEB = {
      war:[
        { sn:'혈기 충전', sd:'피해 +8%, 최대체력 +8%', sf:(p)=>{p.dmgMult*=1.08;p.maxHp=Math.round(p.maxHp*1.08);p.hp=p.maxHp;},
          kn:'피의 질주', kd:'[변형] 대시가 학살 돌진이 된다 (시작·종료 폭발) · 심화(2차 전직): 피해 +10%', kf:(p)=>{p.bloodRush=true;}, df:(p)=>{p.dmgMult*=1.1;} },
        { sn:'가시 돋친 살갗', sd:'가시 반사 +40%', sf:(p)=>{p.thorns=(p.thorns||0)+0.4;},
          kn:'가시 성채', kd:'[변형] 가시 반사 120% — 맞는 것이 곧 공격 · 심화: 받는 피해 -8%', kf:(p)=>{p.thorns=Math.max(p.thorns||0,1.2);}, df:(p)=>{p.dmgTaken*=0.92;} },
        { sn:'망나니의 눈', sd:'처형 임계 +4%p', sf:(p)=>{p.execThresh=Math.min(0.45,(p.execThresh||0)+0.04);},
          kn:'수급 사냥꾼', kd:'[변형] 처형 임계 +10%p — 빈사는 곧 죽음 · 심화: 처형 시 회복 +2', kf:(p)=>{p.execThresh=Math.min(0.5,(p.execThresh||0)+0.10);}, df:(p)=>{p.lifesteal+=2;} },
      ],
      rng:[
        { sn:'갈래 화살', sd:'추가 투사체 확률 +12%', sf:(p)=>{p.multishotCh=(p.multishotCh||0)+0.12;},
          kn:'화살 폭풍', kd:'[변형] 추가 투사체 확률 +30% · 심화: 공속 +10%', kf:(p)=>{p.multishotCh=(p.multishotCh||0)+0.30;}, df:(p)=>{p.rateMult*=1.1;} },
        { sn:'관통 촉', sd:'관통 +1', sf:(p)=>{p.pierce+=1;},
          kn:'꿰뚫는 자', kd:'[변형] 관통 +2 — 탄환이 벽처럼 뚫는다 · 심화: 피해 +8%', kf:(p)=>{p.pierce+=2;}, df:(p)=>{p.dmgMult*=1.08;} },
        { sn:'맹금의 시야', sd:'치명 배율 +0.3', sf:(p)=>{p.critMult+=0.3;},
          kn:'급소 파괴자', kd:'[변형] 치명 배율 +0.8 · 심화: 치명 확률 +8%', kf:(p)=>{p.critMult+=0.8;}, df:(p)=>{p.critChance=Math.min(0.9,p.critChance+0.08);} },
      ],
      mag:[
        { sn:'이중 영창 준비', sd:'쿨다운 -6%', sf:(p)=>{p.cdr*=0.94;},
          kn:'이중 시전', kd:'[변형] 전용기가 2연속 발동한다 · 심화: 쿨다운 -10%', kf:(p)=>{p.ultEcho=true;}, df:(p)=>{p.cdr*=0.9;} },
        { sn:'원소 친화', sd:'원소 발동 +5%p', sf:(p)=>{p.procBonus=(p.procBonus||0)+0.05;},
          kn:'원소 폭주', kd:'[변형] 원소 발동 +12%p — 손끝마다 재해 · 심화: 피해 +8%', kf:(p)=>{p.procBonus=(p.procBonus||0)+0.12;}, df:(p)=>{p.dmgMult*=1.08;} },
        { sn:'메아리 감지', sd:'스킬 20% 확률 쿨 환급', sf:(p)=>{p.echoCast=true;},
          kn:'시간 왜곡자', kd:'[변형] 쿨다운 -15% · 심화: 이속 +8%', kf:(p)=>{p.cdr*=0.85;}, df:(p)=>{p.speed*=1.08;} },
      ],
      rog:[
        { sn:'그림자 호흡', sd:'회피 +5%', sf:(p)=>{p.dodge=Math.min(0.7,p.dodge+0.05);},
          kn:'그림자 분신', kd:'[변형] 대시 시 3초간 분신이 함께 사격 · 심화: 대시 쿨 -15%', kf:(p)=>{p.shadowClone=true;}, df:(p)=>{p.dashCdMax*=0.85;} },
        { sn:'급소 지식', sd:'처형 임계 +4%p', sf:(p)=>{p.execThresh=Math.min(0.45,(p.execThresh||0)+0.04);},
          kn:'밤의 처형인', kd:'[변형] 처형 임계 +8%p, 치명 +6% · 심화: 치명 배율 +0.4', kf:(p)=>{p.execThresh=Math.min(0.5,(p.execThresh||0)+0.08);p.critChance=Math.min(0.9,p.critChance+0.06);}, df:(p)=>{p.critMult+=0.4;} },
        { sn:'유령 걸음', sd:'이속 +5%, 회피 +3%', sf:(p)=>{p.speed*=1.05;p.dodge=Math.min(0.7,p.dodge+0.03);},
          kn:'실체 없는 자', kd:'[변형] 회피 +12% · 심화: 대시 무적 +0.2초', kf:(p)=>{p.dodge=Math.min(0.75,p.dodge+0.12);}, df:(p)=>{p.dashInvuln=(p.dashInvuln||0)+0.2;} },
      ],
      pri:[
        { sn:'응보의 불씨', sd:'가시 반사 +30%', sf:(p)=>{p.thorns=(p.thorns||0)+0.3;},
          kn:'성스러운 보복', kd:'[변형] 피격 시 신성 폭발이 주변을 불태운다 · 심화: 받는 피해 -6%', kf:(p)=>{p.holyRet=true;}, df:(p)=>{p.dmgTaken*=0.94;} },
        { sn:'생명 순환', sd:'회복 효과 +15%', sf:(p)=>{p.healMult*=1.15;},
          kn:'생명의 성소', kd:'[변형] 회복 +35%, 재생 +1 · 심화: 최대체력 +10%', kf:(p)=>{p.healMult*=1.35;p.regen+=1;}, df:(p)=>{p.maxHp=Math.round(p.maxHp*1.1);p.hp=p.maxHp;} },
        { sn:'수호 기도', sd:'받는 피해 -5%', sf:(p)=>{p.dmgTaken*=0.95;},
          kn:'순교의 길', kd:'[변형] 부활 +1회 · 심화: 부활 시 5초 무적', kf:(p)=>{p.reviveLeft=(p.reviveLeft||0)+1;}, df:(p)=>{p.reviveInvuln=5;} },
      ],
      mer:[
        { sn:'금전 감각', sd:'골드 +10%', sf:(p)=>{p.goldMult*=1.1;},
          kn:'황금 혈맥', kd:'[변형] 런 골드 100당 투사체 피해 +3% (최대 +30%) · 심화: 골드 +15%', kf:(p)=>{p.goldPower=true;}, df:(p)=>{p.goldMult*=1.15;} },
        { sn:'행운의 동전', sd:'행운 +12%', sf:(p)=>{p.luck*=1.12;},
          kn:'운명 조작사', kd:'[변형] 행운 +35% — 상위 카드가 쏟아진다 · 심화: 리롤 +2', kf:(p)=>{p.luck*=1.35;}, df:(p)=>{rerollsLeft+=2;} },
        { sn:'피의 장사', sd:'흡혈 +1', sf:(p)=>{p.lifesteal+=1;},
          kn:'마탄 흡혈귀', kd:'[변형] 투사체 명중 5% 확률 체력 +1 · 심화: 흡혈 +2', kf:(p)=>{p.projLeech=true;}, df:(p)=>{p.lifesteal+=2;} },
      ],
    };
    // RESONANCE는 이 IIFE보다 뒤에 선언되므로 로컬 사본 사용 (동기화 주의)
    const RES_LOCAL = {
      war:['rusher','paladin','cheol','exhero','madman','monk'],
      rng:['archer','sniper','pilot'],
      mag:['manager','voidc','commander'],
      rog:['ninja','reaper','glitch','blackcat','shadow','tombraider','mumyeong'],
      pri:['necro','bard','returner'],
      mer:['engineer','debug','tourist','slime','gambler','collector','contributor','baeksu','stonks','gymbro'],
    };
    for (const g in RES_LOCAL){
      const brKey = g;
      const br2 = STAR_BRANCHES.find(bb=>bb.key===brKey);
      if (!br2) continue;
      const th2 = br2.angle*Math.PI/180;
      const list = RES_LOCAL[g];
      list.forEach((ck, ci)=>{
        const cs = CS[ck]; if (!cs) return;
        const a2 = th2 - 0.12 + (ci-(list.length-1)/2)*0.13;
        const r1 = 70 + 15.2*STEP, r2 = r1 + STEP*0.9;
        const sid = 'cs_'+ck+'_s';
        add(sid, Math.cos(a2)*r1, Math.sin(a2)*r1, 'small', br2.small.n, br2.small.d, br2.small.ap, [brKey+'_clk'], br2.color);
        add('cs_'+ck+'_n', Math.cos(a2)*r2, Math.sin(a2)*r2, 'notable', cs.n, cs.d,
            (B)=>{ (B.classPerks=B.classPerks||[]).push({ cls:ck, f:cs.f }); }, [sid], br2.color);
        // 승천 웹: 소성단 노터블에서 3갈래 분기 — [소형 → 사이드스톤(변형) → 키스톤(대변형+심화)]
        // 직업별 이름 스킨: 같은 엔진이라도 직업의 정체성에 맞는 이름을 쓴다 (저격수에게 '화살'은 없다)
        const CSKIN = {
          archer:[{sn:'갈래 화살',kn:'화살 폭풍'},{sn:'관통 살촉',kn:'꿰뚫는 화살'},{sn:'매의 눈',kn:'심장 사격'}],
          sniper:[{sn:'확장 탄창',kn:'연발 사격'},{sn:'철갑탄',kn:'관통 탄도'},{sn:'조준경 보정',kn:'헤드샷'}],
          pilot:[{sn:'보조 포드',kn:'미사일 폭풍'},{sn:'레일 코일',kn:'레일건 관통'},{sn:'조준 컴퓨터',kn:'정밀 폭격'}],
          necro:[{sn:'원혼의 불씨',kn:'망령의 보복'},{sn:'사령 순환',kn:'불사의 성소'},{sn:'명계 서약',kn:'명계의 길'}],
          bard:[{sn:'불협화음',kn:'절규의 반격'},{sn:'치유의 선율',kn:'생명의 합창'},{sn:'수호 화음',kn:'앙코르의 기적'}],
          returner:[{sn:'인과 기록',kn:'인과응보'},{sn:'회귀 보정',kn:'생환의 법칙'},{sn:'예지 방어',kn:'두 번째 기회'}],
          manager:[{sn:'결재 이중화',kn:'전결 남발'},{sn:'업무 과부하',kn:'권한 폭주'},{sn:'칼퇴 본능',kn:'시간 외 수당'}],
          voidc:[{sn:'공허 영창',kn:'이중 균열'},{sn:'심연 친화',kn:'공허 폭주'},{sn:'차원 감각',kn:'시공 왜곡'}],
          commander:[{sn:'예비 편대',kn:'전 부대 일제사격'},{sn:'화망 구성',kn:'집중 포화'},{sn:'긴급 재배치',kn:'전술 시간표'}],
          rusher:[{sn:'돌파 기세',kn:'전선 붕괴'},{sn:'철조망 갑주',kn:'참호의 왕'},{sn:'전장의 눈',kn:'섬멸 명령'}],
          paladin:[{sn:'성스러운 담금질',kn:'심판의 낙인'},{sn:'수호 서약',kn:'축성된 성벽'},{sn:'단죄의 시선',kn:'천벌 선고'}],
          cheol:[{sn:'끓는 혈기',kn:'혈철 폭류'},{sn:'강철 비늘',kn:'불괴의 철갑'},{sn:'파쇄 본능',kn:'뼈를 부수는 자'}],
          exhero:[{sn:'녹슨 검의 기억',kn:'용사의 잔광'},{sn:'낡은 방패의 긍지',kn:'전설의 재현'},{sn:'노장의 감각',kn:'마지막 필살기'}],
          madman:[{sn:'광기 주입',kn:'피의 축제'},{sn:'통각 상실',kn:'고통의 왕관'},{sn:'절단 집착',kn:'붉은 절정'}],
          monk:[{sn:'단전 호흡',kn:'백보신권'},{sn:'금강불괴 수련',kn:'금강나한'},{sn:'명경지수',kn:'무념무상'}],
          ninja:[{sn:'수리검 다발',kn:'만천화우'},{sn:'인법 개조',kn:'그림자 봉인술'},{sn:'질풍 은신',kn:'무음 암살'}],
          reaper:[{sn:'낫날 연마',kn:'영혼 수확'},{sn:'죽음의 낙인',kn:'명부 소환장'},{sn:'수확 가속',kn:'대낫 회전참'}],
          glitch:[{sn:'버퍼 오버플로',kn:'스택 붕괴'},{sn:'널 포인터',kn:'세그폴트 폭발'},{sn:'프레임 드랍',kn:'렉 순간이동'}],
          blackcat:[{sn:'검은 발톱',kn:'불길한 할퀴기'},{sn:'액운 뿌리기',kn:'재앙의 울음'},{sn:'유연한 착지',kn:'검은 질주'}],
          shadow:[{sn:'정적의 칼끝',kn:'일섬'},{sn:'어둠 융화',kn:'그림자 잠행'},{sn:'살기 은폐',kn:'적막의 일격'}],
          tombraider:[{sn:'도굴 삽날',kn:'고대의 함정 해제'},{sn:'유물 후각',kn:'파라오의 금고'},{sn:'문양 해독',kn:'저주받은 보물'}],
          mumyeong:[{sn:'무명의 손끝',kn:'이름 없는 검격'},{sn:'무형의 흐름',kn:'형태 없는 방어'},{sn:'무상의 경지',kn:'공(空)의 일격'}],
          engineer:[{sn:'부품 개조',kn:'오버클럭 폭주'},{sn:'자동화 설비',kn:'무인 공장 가동'},{sn:'응급 수리',kn:'풀가동 프로토콜'}],
          debug:[{sn:'로그 추적',kn:'핫픽스 배포'},{sn:'브레이크포인트',kn:'런타임 조작'},{sn:'롤백 준비',kn:'긴급 롤백'}],
          tourist:[{sn:'가벼운 짐',kn:'세계일주 완주'},{sn:'기념품 수집',kn:'만국 컬렉션'},{sn:'지름길 감각',kn:'현지인 루트'}],
          slime:[{sn:'점액 분비',kn:'산성 점막'},{sn:'세포 분열',kn:'무한 증식'},{sn:'탄성 몸체',kn:'슬라임 쓰나미'}],
          gambler:[{sn:'밑장 빼기',kn:'로열 스트레이트'},{sn:'배팅 감각',kn:'더블 오어 낫싱'},{sn:'포커페이스',kn:'하우스 엣지'}],
          collector:[{sn:'진열대 확장',kn:'한정판 획득'},{sn:'감정 안목',kn:'위작 감별'},{sn:'교환 인맥',kn:'풀세트 컬렉션'}],
          contributor:[{sn:'커밋 적립',kn:'메인 브랜치 머지'},{sn:'코드 리뷰',kn:'LGTM 연타'},{sn:'이슈 트래킹',kn:'천 개의 스타'}],
          baeksu:[{sn:'낮잠 보충',kn:'취업 대신 득도'},{sn:'생활비 절약',kn:'무소유의 경지'},{sn:'유튜브 지식',kn:'프로 정보수집러'}],
          stonks:[{sn:'분할 매수',kn:'풀레버리지'},{sn:'존버 근육',kn:'다이아몬드 핸드'},{sn:'차트 직감',kn:'상한가 신공'}],
          gymbro:[{sn:'프로틴 타이밍',kn:'벌크업 시즌'},{sn:'중량 증가',kn:'3대 500 달성'},{sn:'펌핑 유지',kn:'헬스장 지박령'}],
        };
        // 시그니처 키스톤: 갈래 0의 키스톤은 직업마다 이름·효과가 완전히 다르다 (정체성)
        const SIGKEY = {
          rusher:{n:'브레이크 없는 돌격',d:'대시 학살 돌진 + 대시 쿨 -20%',f:(p)=>{p.bloodRush=true;p.dashCdMax*=0.8;}},
          paladin:{n:'불침의 성벽',d:'받는 피해 -12%, 피격 시 신성 폭발',f:(p)=>{p.dmgTaken*=0.88;p.holyRet=true;}},
          cheol:{n:'혈철 순환',d:'가시 120% + 피격 시 재생 가속(재생 +1)',f:(p)=>{p.thorns=Math.max(p.thorns||0,1.2);p.regen+=1;}},
          exhero:{n:'전성기 재림',d:'피해 +14%, 경험치 +10%',f:(p)=>{p.dmgMult*=1.14;p.xpMult=(p.xpMult||1)*1.1;}},
          madman:{n:'출혈 도가니',d:'피해 +16%, 처형 임계 +8%p, 받는 피해 +8%',f:(p)=>{p.dmgMult*=1.16;p.execThresh=Math.min(0.5,(p.execThresh||0)+0.08);p.dmgTaken*=1.08;}},
          monk:{n:'일격일념',d:'1번 무기 강화 상한 +20%p, 쿨다운 -8%',f:(p)=>{p.weaponCap1=(p.weaponCap1||1.3)+0.20;p.cdr*=0.92;}},
          archer:{n:'화살비의 주인',d:'추가 투사체 +35%',f:(p)=>{p.multishotCh=(p.multishotCh||0)+0.35;}},
          sniper:{n:'제로인 완성',d:'치명 배율 +1.0, 관통 +1 (한 발의 무게)',f:(p)=>{p.critMult+=1.0;p.pierce+=1;}},
          pilot:{n:'풀 스로틀',d:'이속 +12%, 공속 +10%, 대시 무적 +0.15초',f:(p)=>{p.speed*=1.12;p.rateMult*=1.1;p.dashInvuln=(p.dashInvuln||0)+0.15;}},
          manager:{n:'무한 결재',d:'전용기 이중 시전 + 쿨다운 -8%',f:(p)=>{p.ultEcho=true;p.cdr*=0.92;}},
          voidc:{n:'심연 융합',d:'원소 발동 +15%p',f:(p)=>{p.procBonus=(p.procBonus||0)+0.15;}},
          ninja:{n:'그림자 군단',d:'대시 분신 + 대시 쿨 -20%',f:(p)=>{p.shadowClone=true;p.dashCdMax*=0.8;}},
          reaper:{n:'대수확',d:'처형 임계 +12%p, 처치 회복 +1',f:(p)=>{p.execThresh=Math.min(0.55,(p.execThresh||0)+0.12);p.lifesteal+=1;}},
          glitch:{n:'메모리 오염',d:'치명 +12%, 치명 배율 +0.5',f:(p)=>{p.critChance=Math.min(0.9,p.critChance+0.12);p.critMult+=0.5;}},
          blackcat:{n:'아홉 번째 목숨',d:'회피 +12%, 부활 +1',f:(p)=>{p.dodge=Math.min(0.75,p.dodge+0.12);p.reviveLeft=(p.reviveLeft||0)+1;}},
          shadow:{n:'무영살',d:'무피격 3초 후 공격은 확정 치명 + 배율 +0.4',f:(p)=>{p.shadowStrike=true;p.critMult+=0.4;}},
          tombraider:{n:'왕가의 저주',d:'행운 +30%, 수집 +60, 상자 상향',f:(p)=>{p.luck*=1.3;p.magnet+=60;p.chestPlus=true;}},
          mumyeong:{n:'무명무極',d:'피해 +10%, 쿨 -10%, 공속 +6% (이름 없는 완성)',f:(p)=>{p.dmgMult*=1.1;p.cdr*=0.9;p.rateMult*=1.06;}},
          commander:{n:'총공세 명령',d:'위성·소환 피해 +35%',f:(p)=>{p.satDmg=(p.satDmg||1)*1.35;}},
          necro:{n:'사령 지배',d:'소환 피해 +25%, 흡혈 +1',f:(p)=>{p.satDmg=(p.satDmg||1)*1.25;p.lifesteal+=1;}},
          bard:{n:'광시곡',d:'쿨 -12%, 스킬 30% 쿨 환급',f:(p)=>{p.cdr*=0.88;p.echoCast=true;}},
          returner:{n:'회귀의 정석',d:'받는 피해 -10%, 부활 +1',f:(p)=>{p.dmgTaken*=0.9;p.reviveLeft=(p.reviveLeft||0)+1;}},
          engineer:{n:'풀오토 팩토리',d:'위성 피해 +25%, 공속 +8%',f:(p)=>{p.satDmg=(p.satDmg||1)*1.25;p.rateMult*=1.08;}},
          debug:{n:'루트 권한',d:'쿨 -12%, 치명 +8%, 리롤 +2',f:(p)=>{p.cdr*=0.88;p.critChance=Math.min(0.9,p.critChance+0.08);rerollsLeft+=2;}},
          tourist:{n:'세계일주',d:'이속 +12%, 걸음 골드, 회피 +5%',f:(p)=>{p.speed*=1.12;p.walkGold=true;p.dodge=Math.min(0.75,p.dodge+0.05);}},
          slime:{n:'초재생 점막',d:'최대체력 +25%, 재생 +1.2',f:(p)=>{p.maxHp=Math.round(p.maxHp*1.25);p.hp=p.maxHp;p.regen+=1.2;}},
          gambler:{n:'올인',d:'행운 +50% / 최대체력 -15%',f:(p)=>{p.luck*=1.5;p.maxHp=Math.max(30,Math.round(p.maxHp*0.85));p.hp=Math.min(p.hp,p.maxHp);}},
          collector:{n:'박물관 개관',d:'상자 상향 + 골드 +20%',f:(p)=>{p.chestPlus=true;p.goldMult*=1.2;}},
          contributor:{n:'메인테이너',d:'피해 +12%, 골드 +15%, 경험치 +8%',f:(p)=>{p.dmgMult*=1.12;p.goldMult*=1.15;p.xpMult=(p.xpMult||1)*1.08;}},
          baeksu:{n:'무직의 여유',d:'경험치 +20%, 회피 +6%',f:(p)=>{p.xpMult=(p.xpMult||1)*1.2;p.dodge=Math.min(0.75,p.dodge+0.06);}},
          stonks:{n:'가즈아',d:'골드가 곧 화력 (황금 혈맥) + 골드 +20%',f:(p)=>{p.goldPower=true;p.goldMult*=1.2;}},
          gymbro:{n:'무한 벌크업',d:'최대체력 +20%, 피해 +12%, 몸집 +10%',f:(p)=>{p.maxHp=Math.round(p.maxHp*1.2);p.hp=p.maxHp;p.dmgMult*=1.12;p.r*=1.1;}},
        };
        // 시그니처 2호 (갈래 1): 32직업 고유 효과 — 갈래 1 키스톤도 직업마다 완전히 다르다
        const SIGKEY2 = {
          rusher:{d:'돌진 경로에 화상 (반사 +50%, 피해 +6%)',f:(p)=>{p.thorns=(p.thorns||0)+0.5;p.dmgMult*=1.06;}},
          paladin:{d:'수호 성역 (받는 피해 -10%, 회복 +20%)',f:(p)=>{p.dmgTaken*=0.9;p.healMult*=1.2;}},
          cheol:{d:'철벽 요새 (최대체력 +18%, 반사 +40%)',f:(p)=>{p.maxHp=Math.round(p.maxHp*1.18);p.hp=p.maxHp;p.thorns=(p.thorns||0)+0.4;}},
          exhero:{d:'노장의 관록 (받는 피해 -8%, 피해 +8%)',f:(p)=>{p.dmgTaken*=0.92;p.dmgMult*=1.08;}},
          madman:{d:'고통 흡수 (흡혈 +2, 받는 피해 +5%)',f:(p)=>{p.lifesteal+=2;p.dmgTaken*=1.05;}},
          monk:{d:'호신강기 (받는 피해 -8%, 반사 +40%)',f:(p)=>{p.dmgTaken*=0.92;p.thorns=(p.thorns||0)+0.4;}},
          archer:{d:'이중 관통 (관통 +2)',f:(p)=>{p.pierce+=2;}},
          sniper:{d:'철갑 관통탄 (관통 +1, 피해 +10%)',f:(p)=>{p.pierce+=1;p.dmgMult*=1.1;}},
          pilot:{d:'레일건 코일 (관통 +1, 공속 +8%)',f:(p)=>{p.pierce+=1;p.rateMult*=1.08;}},
          manager:{d:'권한 남용 (원소 발동 +10%p)',f:(p)=>{p.procBonus=(p.procBonus||0)+0.10;}},
          voidc:{d:'공허 침식 (원소 발동 +8%p, 피해 +8%)',f:(p)=>{p.procBonus=(p.procBonus||0)+0.08;p.dmgMult*=1.08;}},
          commander:{d:'집중 포화 명령 (위성·소환 피해 +25%)',f:(p)=>{p.satDmg=(p.satDmg||1)*1.25;}},
          ninja:{d:'급소 표창 (치명 +10%, 처형 +4%p)',f:(p)=>{p.critChance=Math.min(0.9,p.critChance+0.10);p.execThresh=Math.min(0.55,(p.execThresh||0)+0.04);}},
          reaper:{d:'명부 소환장 (처형 +8%p, 피해 +6%)',f:(p)=>{p.execThresh=Math.min(0.6,(p.execThresh||0)+0.08);p.dmgMult*=1.06;}},
          glitch:{d:'널 포인터 (치명 배율 +0.6)',f:(p)=>{p.critMult+=0.6;}},
          blackcat:{d:'재앙의 발톱 (치명 +8%, 회피 +6%)',f:(p)=>{p.critChance=Math.min(0.9,p.critChance+0.08);p.dodge=Math.min(0.75,p.dodge+0.06);}},
          shadow:{d:'그림자 잠행 (회피 +8%, 치명 배율 +0.3)',f:(p)=>{p.dodge=Math.min(0.75,p.dodge+0.08);p.critMult+=0.3;}},
          tombraider:{d:'파라오의 금고 (행운 +20%, 골드 +15%)',f:(p)=>{p.luck*=1.2;p.goldMult*=1.15;}},
          mumyeong:{d:'형태 없는 방어 (회피 +8%, 받는 피해 -6%)',f:(p)=>{p.dodge=Math.min(0.75,p.dodge+0.08);p.dmgTaken*=0.94;}},
          necro:{d:'불사의 성소 (재생 +1, 소환 피해 +12%)',f:(p)=>{p.regen+=1;p.satDmg=(p.satDmg||1)*1.12;}},
          bard:{d:'생명의 합창 (회복 +30%, 재생 +0.6)',f:(p)=>{p.healMult*=1.3;p.regen+=0.6;}},
          returner:{d:'생환의 법칙 (최대체력 +12%, 회복 +15%)',f:(p)=>{p.maxHp=Math.round(p.maxHp*1.12);p.hp=Math.min(p.maxHp,p.hp+20);p.healMult*=1.15;}},
          engineer:{d:'무인 공장 (위성 피해 +18%, 쿨 -6%)',f:(p)=>{p.satDmg=(p.satDmg||1)*1.18;p.cdr*=0.94;}},
          debug:{d:'런타임 조작 (쿨 -10%, 행운 +10%)',f:(p)=>{p.cdr*=0.9;p.luck*=1.1;}},
          tourist:{d:'만국 컬렉션 (수집 +70, 골드 +12%)',f:(p)=>{p.magnet+=70;p.goldMult*=1.12;}},
          slime:{d:'산성 점막 (반사 +50%, 재생 +0.8)',f:(p)=>{p.thorns=(p.thorns||0)+0.5;p.regen+=0.8;}},
          gambler:{d:'더블 오어 낫싱 (행운 +30%, 치명 배율 +0.4)',f:(p)=>{p.luck*=1.3;p.critMult+=0.4;}},
          collector:{d:'위작 감별 (행운 +25%, 수집 +40)',f:(p)=>{p.luck*=1.25;p.magnet+=40;}},
          contributor:{d:'LGTM 연타 (골드 +12%, 쿨 -6%)',f:(p)=>{p.goldMult*=1.12;p.cdr*=0.94;}},
          baeksu:{d:'무소유의 경지 (회피 +8%, 경험치 +10%)',f:(p)=>{p.dodge=Math.min(0.75,p.dodge+0.08);p.xpMult=(p.xpMult||1)*1.1;}},
          stonks:{d:'다이아몬드 핸드 (골드 +25%, 받는 피해 -5%)',f:(p)=>{p.goldMult*=1.25;p.dmgTaken*=0.95;}},
          gymbro:{d:'3대 500 완성 (피해 +10%, 최대체력 +10%)',f:(p)=>{p.dmgMult*=1.1;p.maxHp=Math.round(p.maxHp*1.1);p.hp=p.maxHp;}},
        };
        // 시그니처 3호 (갈래 2): 마지막 키스톤까지 32직업 전부 고유 — 웹의 세 극의 완성
        const SIGKEY3 = {
          rusher:{d:'멈추지 않는 전차 (이속 +8%, 피해 +10%)',f:(p)=>{p.speed*=1.08;p.dmgMult*=1.1;}},
          paladin:{d:'천벌 선고 (피해 +12%, 발동 +6%p)',f:(p)=>{p.dmgMult*=1.12;p.procBonus=(p.procBonus||0)+0.06;}},
          cheol:{d:'뼈를 부수는 자 (피해 +14%, 처형 +5%p)',f:(p)=>{p.dmgMult*=1.14;p.execThresh=Math.min(0.6,(p.execThresh||0)+0.05);}},
          exhero:{d:'마지막 필살기 (전용기 이중 시전)',f:(p)=>{p.ultEcho=true;}},
          madman:{d:'붉은 절정 (치명 +10%, 배율 +0.5)',f:(p)=>{p.critChance=Math.min(0.9,p.critChance+0.10);p.critMult+=0.5;}},
          monk:{d:'무념무상 (쿨 -12%, 회피 +6%)',f:(p)=>{p.cdr*=0.88;p.dodge=Math.min(0.75,p.dodge+0.06);}},
          archer:{d:'심장 사격 (치명 +10%, 배율 +0.4)',f:(p)=>{p.critChance=Math.min(0.9,p.critChance+0.10);p.critMult+=0.4;}},
          sniper:{d:'헤드샷 프로토콜 (치명 +12%, 처형 +6%p)',f:(p)=>{p.critChance=Math.min(0.9,p.critChance+0.12);p.execThresh=Math.min(0.6,(p.execThresh||0)+0.06);}},
          pilot:{d:'정밀 폭격 (피해 +12%, 발동 +5%p)',f:(p)=>{p.dmgMult*=1.12;p.procBonus=(p.procBonus||0)+0.05;}},
          manager:{d:'시간 외 수당 (쿨 -10%, 골드 +12%)',f:(p)=>{p.cdr*=0.9;p.goldMult*=1.12;}},
          voidc:{d:'시공 왜곡 (쿨 -12%, 이속 +6%)',f:(p)=>{p.cdr*=0.88;p.speed*=1.06;}},
          commander:{d:'전술 시간표 (쿨 -10%, 위성 피해 +15%)',f:(p)=>{p.cdr*=0.9;p.satDmg=(p.satDmg||1)*1.15;}},
          ninja:{d:'무음 암살 (무피격 3초 후 확정 치명)',f:(p)=>{p.shadowStrike=true;}},
          reaper:{d:'대낫 회전참 (피해 +12%, 공속 +8%)',f:(p)=>{p.dmgMult*=1.12;p.rateMult*=1.08;}},
          glitch:{d:'렉 순간이동 (대시 쿨 -20%, 회피 +6%)',f:(p)=>{p.dashCdMax*=0.8;p.dodge=Math.min(0.75,p.dodge+0.06);}},
          blackcat:{d:'검은 질주 (이속 +10%, 대시 무적 +0.15초)',f:(p)=>{p.speed*=1.1;p.dashInvuln=(p.dashInvuln||0)+0.15;}},
          shadow:{d:'적막의 일격 (처형 +8%p, 치명 배율 +0.3)',f:(p)=>{p.execThresh=Math.min(0.6,(p.execThresh||0)+0.08);p.critMult+=0.3;}},
          tombraider:{d:'저주받은 보물 (상자 상향, 행운 +15%)',f:(p)=>{p.chestPlus=true;p.luck*=1.15;}},
          mumyeong:{d:'공(空)의 일격 (피해 +10%, 치명 +8%)',f:(p)=>{p.dmgMult*=1.1;p.critChance=Math.min(0.9,p.critChance+0.08);}},
          necro:{d:'명계의 길 (부활 +1)',f:(p)=>{p.reviveLeft=(p.reviveLeft||0)+1;}},
          bard:{d:'앙코르의 기적 (스킬 환급 +10%p, 회복 +15%)',f:(p)=>{p.echoBoost=true;p.healMult*=1.15;}},
          returner:{d:'두 번째 기회 (부활 +1)',f:(p)=>{p.reviveLeft=(p.reviveLeft||0)+1;}},
          engineer:{d:'풀가동 프로토콜 (위성 피해 +20%, 공속 +6%)',f:(p)=>{p.satDmg=(p.satDmg||1)*1.2;p.rateMult*=1.06;}},
          debug:{d:'긴급 롤백 (부활 +1)',f:(p)=>{p.reviveLeft=(p.reviveLeft||0)+1;}},
          tourist:{d:'현지인 루트 (이속 +10%, 회피 +5%)',f:(p)=>{p.speed*=1.1;p.dodge=Math.min(0.75,p.dodge+0.05);}},
          slime:{d:'슬라임 쓰나미 (최대체력 +15%, 피해 +8%)',f:(p)=>{p.maxHp=Math.round(p.maxHp*1.15);p.hp=p.maxHp;p.dmgMult*=1.08;}},
          gambler:{d:'하우스 엣지 (행운 +25%, 골드 +15%)',f:(p)=>{p.luck*=1.25;p.goldMult*=1.15;}},
          collector:{d:'풀세트 컬렉션 (수집 +60, 골드 +12%)',f:(p)=>{p.magnet+=60;p.goldMult*=1.12;}},
          contributor:{d:'천 개의 스타 (피해 +10%, 경험치 +10%)',f:(p)=>{p.dmgMult*=1.1;p.xpMult=(p.xpMult||1)*1.1;}},
          baeksu:{d:'프로 정보수집러 (경험치 +15%, 행운 +12%)',f:(p)=>{p.xpMult=(p.xpMult||1)*1.15;p.luck*=1.12;}},
          stonks:{d:'상한가 신공 (골드 +20%, 피해 +8%)',f:(p)=>{p.goldMult*=1.2;p.dmgMult*=1.08;}},
          gymbro:{d:'헬스장 지박령 (재생 +1, 최대체력 +12%)',f:(p)=>{p.regen+=1;p.maxHp=Math.round(p.maxHp*1.12);p.hp=p.maxHp;}},
        };
        const web = WEB[brKey]||[];
        web.forEach((wb, wi)=>{
          const wa = a2 + (wi-1)*0.085;
          const wr0 = r2 + STEP*0.85, wr1 = wr0 + STEP*0.85, wr2 = wr1 + STEP*0.9;
          const skin = (CSKIN[ck]||[])[wi] || {};
          const w0 = 'csw_'+ck+'_'+wi+'_0';
          add(w0, Math.cos(wa)*wr0, Math.sin(wa)*wr0, 'small', br2.small.n, br2.small.d, br2.small.ap, ['cs_'+ck+'_n'], br2.color);
          add('csw_'+ck+'_'+wi+'_1', Math.cos(wa)*wr1, Math.sin(wa)*wr1, 'notable', skin.sn||wb.sn, '['+cs.n.split(' ')[0]+' 승천] '+wb.sd,
              (B)=>{ (B.classPerks=B.classPerks||[]).push({ cls:ck, f:wb.sf }); }, [w0], br2.color);
          const sig = wi===0 ? SIGKEY[ck] : (wi===1 ? SIGKEY2[ck] : SIGKEY3[ck]);
          const sigName = sig ? (sig.n || skin.kn || wb.kn) : (skin.kn||wb.kn);
          add('csw_'+ck+'_'+wi+'_2', Math.cos(wa)*wr2, Math.sin(wa)*wr2, 'key',
              sigName,
              sig ? '[시그니처 키스톤 — 이 직업만의 극의] '+sig.d+' · 심화(2차 전직): 추가 강화' : wb.kd,
              (B)=>{ (B.classPerks=B.classPerks||[]).push({ cls:ck, f:(sig?sig.f:wb.kf), deep:wb.df }); }, ['csw_'+ck+'_'+wi+'_1'], sig ? '#e8c56a' : '#e8e8e6');
        });
      });
    }

    // 내륜 (순환로 1): 인접 계열의 N1끼리 소형 2개로 연결 — r ≈ 250
    for (let i=0;i<6;i++){
      const a1 = STAR_BRANCHES[i].angle*Math.PI/180;
      const a2 = STAR_BRANCHES[(i+1)%6].angle*Math.PI/180;
      const r = 70 + 5*STEP;
      for (let k=0;k<2;k++){
        const t = (k+1)/3;
        let am = a1 + t*(Math.PI/3);
        const id = 'ring1_'+i+'_'+k;
        const br = STAR_BRANCHES[k===0?i:(i+1)%6];
        const links = k===0 ? [STAR_BRANCHES[i].key+'_n2'] : ['ring1_'+i+'_0', STAR_BRANCHES[(i+1)%6].key+'_n2'];
        add(id, Math.cos(am)*r, Math.sin(am)*r, 'small', br.small.n, br.small.d, br.small.ap, links, br.color);
      }
    }
    // 외륜 (순환로 2): 키스톤끼리 [소·변혁 키·소]로 연결 — r ≈ 430
    TRANSFORM_KEYS.forEach((tk, i)=>{
      const b1 = STAR_BRANCHES[tk.between[0]], b2 = STAR_BRANCHES[tk.between[1]];
      const a1 = b1.angle*Math.PI/180;
      const r = 70 + 10*STEP + 14;
      const mid = a1 + Math.PI/6;
      add('or_'+i+'_0', Math.cos(a1+Math.PI/9)*r, Math.sin(a1+Math.PI/9)*r, 'small', b1.small.n, b1.small.d, b1.small.ap, [b1.key+'_k'], b1.color);
      add(tk.id, Math.cos(mid)*(r+12), Math.sin(mid)*(r+12), 'key', tk.n, tk.d, tk.ap, ['or_'+i+'_0'], '#e8e8e6');
      add('or_'+i+'_1', Math.cos(a1+Math.PI*5/18)*r, Math.sin(a1+Math.PI*5/18)*r, 'small', b2.small.n, b2.small.d, b2.small.ap, [tk.id, b2.key+'_k'], b2.color);
      // 심층 소켓: 변혁 키 너머의 강력한 스탯 노드
      add('deep_'+i+'_0', Math.cos(mid)*(r+52), Math.sin(mid)*(r+52), 'small', b1.small.n, b1.small.d, b1.small.ap, [tk.id], '#c7c8c6');
      add('deep_'+i+'_1', Math.cos(mid)*(r+90), Math.sin(mid)*(r+90), 'notable', '심연의 별',
          '모든 피해 +5%, 최대체력 +12, 행운 +5%',
          (B)=>{ B.dmg+=5; B.hp+=12; B.luckPct+=5; }, ['deep_'+i+'_0'], '#e8e8e6');
    });
    // v6-2차: 빌드 변형 키스톤 — 캐릭터의 근본을 바꾸는 최심층 (PoE식) — 심연의 별 너머
    const TRANS2 = [
      { i:0, id:'t2_bladewave', n:'검기 방출', d:'[변형] 역장·낫 무기가 4초마다 검기 3발을 발사한다 (근접 → 원거리)', ap:(B)=>{ B.bladeWave=true; } },
      { i:2, id:'t2_rapidfire', n:'광포화', d:'[변형] 공격속도 +25% / 모든 피해 -15% (기관총 빌드)', ap:(B)=>{ B.rate+=25; B.dmg-=15; } },
      { i:4, id:'t2_projleech', n:'마탄 흡혈', d:'[변형] 투사체 명중 시 5% 확률 체력 +1 (원거리 → 흡혈)', ap:(B)=>{ B.projLeech=true; } },
    ];
    TRANS2.forEach(t2=>{
      const b1 = STAR_BRANCHES[TRANSFORM_KEYS[t2.i].between[0]];
      const a1 = b1.angle*Math.PI/180;
      const mid = a1 + Math.PI/6;
      const r2 = 70 + 10*36 + 14 + 130;
      add(t2.id, Math.cos(mid)*r2, Math.sin(mid)*r2, 'key', t2.n, t2.d, t2.ap, ['deep_'+t2.i+'_1'], '#d9a53f');
    });
  })();
  function starAllocated(id){ return id==='center' || !!(DB.star && DB.star.nodes[id]); }
  // 티어 비용: 소형 1P / 노터블 3P / 키스톤 5P — 위로 갈수록 비싸진다 (급성장 제어)
  function starCost(id){
    const n = STAR_NODES[id];
    if (!n) return 1;
    return n.tier==='key' ? 5 : n.tier==='notable' ? 3 : 1;
  }
  function starSpent(){ let s=0; for (const id in (DB.star.nodes||{})) s += starCost(id); return s; }
  function starAvailPts(){ return (DB.star.pts||0) - starSpent(); }
  function starBranchSpent(pref){
    let s=0;
    for (const id in (DB.star.nodes||{})){ if (id.indexOf(pref+'_')===0) s += starCost(id); }
    return s;
  }
  // 투자 게이트: 노터블은 해당 계열 5P, 키스톤은 12P 투자 필요 (공유 구역은 총 투자 20P/35P)
  function starGateReq(id){
    const n = STAR_NODES[id];
    if (!n || (n.tier!=='notable' && n.tier!=='key')) return null;
    const pref = id.split('_')[0];
    const isBranch = STAR_BRANCHES.some(b=>b.key===pref);
    if (n.tier==='notable') return isBranch ? {branch:pref, need:5} : {total:20};
    return isBranch ? {branch:pref, need:12} : {total:35};
  }
  function starGateOk(id){
    const g = starGateReq(id);
    if (!g) return true;
    if (g.branch) return starBranchSpent(g.branch) >= g.need;
    return starSpent() >= g.total;
  }
  function starClassLock(id){
    // 직업 대성단(cs_/csw_)은 '최근 그 직업으로 출전'해야 찍을 수 있다 — 별은 주인을 기다린다
    if (id.indexOf('cs_')===0 || id.indexOf('csw_')===0){
      const ck = id.split('_')[1];
      return DB.lastClass === ck;
    }
    return true;
  }
  function starCanBuy(id){
    const n = STAR_NODES[id];
    return n && !starAllocated(id) && starAvailPts() >= starCost(id)
      && n.links.some(l=>starAllocated(l)) && starGateOk(id) && starClassLock(id);
  }
  function starHasName(name){
    for (const id in DB.star.nodes){ if (STAR_NODES[id] && STAR_NODES[id].name===name) return true; }
    return false;
  }
  function starBonuses(){
    const B = { hp:0, hpPct:0, dmg:0, spd:0, rate:0, cdr:0, crit:0, critMult:0, dodge:0, regen:0,
                gold:0, luckPct:0, magnet:0, lifesteal:0, dashCd:0, dashInv:0, heal:0, dr:0, xp:0,
                proc:0, revive:0, attrPlus:0, startGold:0, undyingDR:0, heavyAll:false, merchantDisc:false,
                bloodRush:false, shatter:false, ultEcho:false, shadowClone:false, holyRet:false, goldPower:false };
    for (const id in DB.star.nodes){
      const n = STAR_NODES[id];
      if (n && n.ap) n.ap(B);
    }
    return B;
  }
  // 직업 공명 — 자기 계열의 노드는 직업에 따라 더 강하게 발현된다
  const RESONANCE = {
    war:['rusher','paladin','cheol','exhero','madman','monk'],
    rng:['archer','sniper','pilot'],
    mag:['manager','voidc'],
    rog:['ninja','reaper','glitch','blackcat','shadow','tombraider','mumyeong'],
    mag2:['commander'],
    pri:['necro','bard','returner'],
    mer:['engineer','debug','tourist','slime','gambler','collector','contributor','baeksu','stonks','gymbro'],
  };
  function resonantCount(classKey){
    let n = 0;
    for (const id in DB.star.nodes){
      const prefix = id.split('_')[0];
      if (RESONANCE[prefix] && RESONANCE[prefix].includes(classKey)) n++;
    }
    return n;
  }
  function applyStarBonuses(p){
    const B = starBonuses();
    // 직업 성단: 해당 계열 직업으로 플레이할 때만 발동 — 타 계열 별은 '흐릿한 공명'으로 약하게 빛난다
    if (B.classPerks && B.classPerks.length){
      const myGroup = classResGroup(p.classKey);
      let fired = 0, dim = 0;
      for (const perk of B.classPerks){
        if (perk.cls){
          if (perk.cls===p.classKey){
            perk.f(p); fired++;
            if (perk.deep) (p.csDeep=p.csDeep||[]).push(perk.deep); // 승천 키스톤 심화 — 2차 전직에서 개방
          } else dim++;
        } // 32직업 개별 소성단 — 정확히 그 직업만
        else if (perk.g===myGroup){ perk.f(p); fired++; }
        else dim++;
      }
      if (fired>0) setTimeout(()=>toast('⭐ 직업 성단 발동 ×'+fired), 1100);
      if (dim>0){
        const dc = Math.min(dim, 4);
        p.dmgMult *= 1 + 0.02*dc;
        p.maxHp = Math.round(p.maxHp*(1 + 0.01*dc)); p.hp = Math.min(p.hp, p.maxHp);
        setTimeout(()=>toast('🌫 흐릿한 공명 ×'+dc+' — 타 계열의 별도 희미하게 힘을 보탠다 (피해 +'+(2*dc)+'%)'), 1500);
      }
    }
    // 키스톤 시너지: 특정 키스톤 조합이 함께면 추가 효과 (PoE식 빌드 완성 보너스)
    const syn = [];
    if (starHasName('광전사의 피') && starHasName('일격필살')){ p.critMult+=0.5; syn.push('사신일격 (치명 배율 +0.5)'); }
    if (starHasName('유리 그림자') && starHasName('원소 과부하')){ p.procBonus=(p.procBonus||0)+0.06; p.dodge=Math.min(0.7,p.dodge+0.05); syn.push('원소 그림자 (발동 +6%p, 회피 +5%)'); }
    if (starHasName('검기 방출') && starHasName('광포화')){ p.bladeWaveFast=true; syn.push('참격 폭풍 (검기 주기 절반)'); }
    if (starHasName('마탄 흡혈') && starHasName('일격필살')){ p.projLeechMult=2; syn.push('흡혈 관통탄 (흡혈량 2배)'); }
    if (syn.length) setTimeout(()=>toast('✨ 키스톤 시너지: '+syn.join(' · ')), 1300);
    // 빌드 변형 플래그 전달
    if (B.bladeWave) p.bladeWave = true;
    if (B.projLeech) p.projLeech = true;
    // 공명 보너스: 공명 계열 노드 1개당 피해 +1%, 최대체력 +1
    const rc = resonantCount(p.classKey);
    if (rc>0){
      p.dmgMult *= 1 + 0.01*rc;
      p.maxHp += rc;
      setTimeout(()=>toast('직업 공명 ×'+rc+' — 피해 +'+rc+'%, 체력 +'+rc), 900);
    }
    p.maxHp = Math.max(30, Math.round((p.maxHp + B.hp) * (1 + B.hpPct/100)));
    p.dmgMult *= 1 + B.dmg/100;
    p.speed *= 1 + B.spd/100;
    p.rateMult *= 1 + B.rate/100;
    p.cdr *= 1 - B.cdr/100;
    p.critChance = Math.min(0.85, p.critChance + B.crit/100);
    p.critMult += B.critMult;
    p.dodge = Math.min(0.6, p.dodge + B.dodge/100);
    p.regen += B.regen;
    p.goldMult *= 1 + B.gold/100;
    p.luck *= 1 + B.luckPct/100;
    p.magnet += B.magnet;
    p.lifesteal += B.lifesteal;
    p.dashCdMax *= 1 - B.dashCd/100;
    p.dashInvuln += B.dashInv;
    p.healMult *= 1 + B.heal/100;
    p.dmgTaken *= 1 - B.dr/100;
    p.undyingDR = Math.min(0.6, p.undyingDR + B.undyingDR);
    p.xpMult = (p.xpMult||1) * (1 + B.xp/100);
    p.procBonus = (p.procBonus||0) + B.proc;
    if (B.revive) p.reviveLeft += B.revive;
    if (B.attrPlus) p.attrLimit = (p.attrLimit||3) + B.attrPlus;
    if (B.merchantDisc) p.merchantDisc = 0.75;
    if (B.startGold) runGold += B.startGold;
    // 변혁 키스톤
    p.bloodRush = B.bloodRush;
    p.shatter = B.shatter;
    p.ultEcho = B.ultEcho;
    p.shadowClone = B.shadowClone;
    p.holyRet = B.holyRet;
    p.goldPower = B.goldPower;
    p.hp = p.maxHp;
  }

  // ---- 성좌 트리 UI (팬/줌/툴팁) ----
  const starC = $('starC');
  const starCtx = starC.getContext('2d');
  const starView = { x:0, y:0, scale:1.1 };
  let starDrag = null, starHover = null;
  function resizeStarCanvas(){
    const rect = starC.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    starC.width = Math.max(100, Math.floor(rect.width*dpr));
    starC.height = Math.max(100, Math.floor(rect.height*dpr));
    starCtx.setTransform(dpr,0,0,dpr,0,0);
  }
  function starToScreen(n){
    const rect = starC.getBoundingClientRect();
    return { x: rect.width/2 + (n.x - starView.x)*starView.scale,
             y: rect.height/2 + (n.y - starView.y)*starView.scale };
  }
  function drawStarTree(){
    const rect = starC.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    starCtx.clearRect(0,0,w,h);
    // 밤하늘 배경 별
    starCtx.fillStyle = '#17181c';
    starCtx.fillRect(0,0,w,h);
    for (let i=0;i<70;i++){
      const sx = (hash2(i,7)*w), sy = (hash2(3,i)*h);
      starCtx.globalAlpha = 0.15 + hash2(i,i)*0.5;
      starCtx.fillStyle = '#e8e8e6';
      starCtx.fillRect(sx, sy, 1.4, 1.4);
    }
    starCtx.globalAlpha = 1;
    // 연결선
    const drawn = new Set();
    for (const id in STAR_NODES){
      const n = STAR_NODES[id];
      for (const l of n.links){
        const key = [id,l].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const m = STAR_NODES[l];
        const p1 = starToScreen(n), p2 = starToScreen(m);
        const lit = starAllocated(id) && starAllocated(l);
        starCtx.strokeStyle = lit ? n.color : 'rgba(232,232,230,0.16)';
        starCtx.lineWidth = lit ? 2.4 : 1.2;
        starCtx.beginPath(); starCtx.moveTo(p1.x,p1.y); starCtx.lineTo(p2.x,p2.y); starCtx.stroke();
      }
    }
    // 노드
    for (const id in STAR_NODES){
      const n = STAR_NODES[id];
      const p = starToScreen(n);
      if (p.x<-30||p.x>w+30||p.y<-30||p.y>h+30) continue;
      const alloc = starAllocated(id);
      const canBuy = starCanBuy(id);
      const mine = (typeof starFocusMode==='undefined' || !starFocusMode) || starNodeMine(id);
      const R2 = (n.tier==='key'?13 : n.tier==='notable'?9.5 : n.tier==='start'?11 : 6) * starView.scale;
      if (!mine) starCtx.globalAlpha = 0.15; // 내 별만 모드: 무관한 별은 흐리게
      // 글로우
      if (alloc){
        starCtx.fillStyle = n.color;
        starCtx.globalAlpha = mine ? 0.22 : 0.06;
        starCtx.beginPath(); starCtx.arc(p.x,p.y,R2*1.9,0,Math.PI*2); starCtx.fill();
        starCtx.globalAlpha = mine ? 1 : 0.15;
      }
      // 구매 가능: 숨쉬는 펄스 링 — 한눈에 "여기 찍을 수 있다"
      if (canBuy && mine){
        const pu = 1 + Math.sin(performance.now()/300)*0.18;
        starCtx.strokeStyle = n.color;
        starCtx.globalAlpha = 0.55;
        starCtx.lineWidth = 1.6;
        starCtx.beginPath(); starCtx.arc(p.x,p.y,(R2+5)*pu,0,Math.PI*2); starCtx.stroke();
        starCtx.globalAlpha = mine ? 1 : 0.15;
      }
      starCtx.beginPath(); starCtx.arc(p.x,p.y,R2,0,Math.PI*2);
      starCtx.fillStyle = alloc ? n.color : (canBuy ? '#3a3d45' : '#24262c');
      starCtx.fill();
      starCtx.lineWidth = n.tier==='key' ? 2.4 : 1.4;
      starCtx.strokeStyle = alloc ? '#f2f2f0' : (canBuy ? n.color : 'rgba(232,232,230,0.3)');
      starCtx.stroke();
      if (n.tier==='key'){
        starCtx.strokeStyle = alloc ? '#f2f2f0' : 'rgba(232,232,230,0.4)';
        starCtx.beginPath(); starCtx.arc(p.x,p.y,R2+4*starView.scale,0,Math.PI*2); starCtx.stroke();
      }
      // 투자 게이트 미달 노터블·키스톤: 자물쇠 표시 — 확대했을 때만, 은은하게 (원경에서 자물쇠 벽이 되지 않게)
      if (!alloc && (n.tier==='notable'||n.tier==='key') && !starGateOk(id) && starView.scale>0.85){
        starCtx.globalAlpha = 0.55;
        starCtx.font = Math.round(7*starView.scale+3)+'px sans-serif';
        starCtx.textAlign='center'; starCtx.textBaseline='middle';
        starCtx.fillText('🔒', p.x, p.y);
        starCtx.globalAlpha = mine ? 1 : 0.15;
      }
      if (starHover===id){
        starCtx.strokeStyle = '#fff';
        starCtx.lineWidth = 2;
        starCtx.beginPath(); starCtx.arc(p.x,p.y,R2+6,0,Math.PI*2); starCtx.stroke();
      }
      starCtx.globalAlpha = 1;
    }
    // 계열 라벨: 여섯 성단의 이름을 항상 표시 — 길을 잃지 않게
    starCtx.font = '600 '+Math.max(10, Math.round(12*starView.scale))+'px "IBM Plex Sans KR", sans-serif';
    starCtx.textAlign='center'; starCtx.textBaseline='middle';
    for (const br of STAR_BRANCHES){
      const a = br.angle*Math.PI/180;
      const lp = starToScreen({ x:Math.cos(a)*205, y:Math.sin(a)*205 });
      starCtx.fillStyle = br.color;
      starCtx.globalAlpha = 0.85;
      starCtx.fillText(br.name, lp.x, lp.y);
      // 승천 구역 라벨 (바깥)
      const lp2 = starToScreen({ x:Math.cos(a-0.12)*(70+16.8*36), y:Math.sin(a-0.12)*(70+16.8*36) });
      starCtx.globalAlpha = 0.5;
      starCtx.fillText('✦ '+br.name+' 승천 구역', lp2.x, lp2.y);
      starCtx.globalAlpha = 1;
    }
    // 직업 소성단 라벨: 확대하면 각 직업 별자리에 주인 이름이 보인다 (전용 여부 가시성)
    if (starView.scale >= 0.7){
      starCtx.font = '600 '+Math.max(9, Math.round(9.5*starView.scale))+'px "IBM Plex Sans KR", sans-serif';
      for (const id in STAR_NODES){
        if (id.indexOf('cs_')!==0 || id.slice(-2)!=='_n') continue;
        const ck = id.slice(3, -2);
        const cn = CLASSES[ck];
        if (!cn) continue;
        const nd = STAR_NODES[id];
        const lp3 = starToScreen({ x:nd.x, y:nd.y });
        if (lp3.x<-40||lp3.x>starC.clientWidth+40||lp3.y<-40||lp3.y>starC.clientHeight+40) continue;
        starCtx.fillStyle = DB.lastClass===ck ? '#e8c56a' : 'rgba(200,200,198,0.55)';
        starCtx.fillText((DB.lastClass===ck?'▶ ':'')+cn.name, lp3.x, lp3.y - 14*starView.scale - 6);
      }
    }
    $('starPtsVal').textContent = starAvailPts();
  }
  function starHitTest(mx, my){
    for (const id in STAR_NODES){
      const p = starToScreen(STAR_NODES[id]);
      const R2 = (STAR_NODES[id].tier==='key'?15:11) * starView.scale;
      if (Math.hypot(mx-p.x, my-p.y) < Math.max(12, R2)) return id;
    }
    return null;
  }
  function starShowInfo(id){
    const info = $('starInfo');
    if (!id){ info.style.display='none'; return; }
    const n = STAR_NODES[id];
    const alloc = starAllocated(id);
    const canBuy = starCanBuy(id);
    const tierName = n.tier==='key' ? '★ 키스톤' : n.tier==='notable' ? '◆ 노터블' : n.tier==='start' ? '기원' : '· 소형';
    const prefix = id.split('_')[0];
    const resCls = RESONANCE[prefix] ? RESONANCE[prefix].map(k=>CLASSES[k]?CLASSES[k].name:k).join('·') : '';
    const cost = starCost(id);
    const gate = starGateReq(id);
    let lockMsg = '연결된 노드를 먼저 습득하세요';
    if (!alloc && !canBuy && n.links.some(l=>starAllocated(l))){
      if (!starClassLock(id)){
        const ck2 = id.split('_')[1];
        lockMsg = '['+(CLASSES[ck2]?CLASSES[ck2].name:ck2)+'](으)로 출전한 뒤에만 밝힐 수 있는 별';
      } else if (gate && !starGateOk(id)){
        lockMsg = gate.branch
          ? '이 계열에 '+gate.need+'P 투자 필요 (현재 '+starBranchSpent(gate.branch)+'P)'
          : '성도 총 '+gate.total+'P 투자 필요 (현재 '+starSpent()+'P)';
      } else if (starAvailPts() < cost){
        lockMsg = '포인트 부족 ('+cost+'P 필요)';
      }
    }
    // 직업 전용 별: 누구의 별인지 크게 명시
    let ownerLine = '';
    if (id.indexOf('cs_')===0 || id.indexOf('csw_')===0){
      const ck3 = id.split('_')[1];
      const cn3 = CLASSES[ck3];
      if (cn3){
        const isMine = DB.lastClass===ck3;
        ownerLine = '<div style="margin:3px 0; padding:2px 8px; display:inline-block; border-radius:5px;'
          + 'background:'+(isMine?'rgba(232,197,106,0.18)':'rgba(120,120,124,0.18)')+'; color:'+(isMine?'#e8c56a':'#aeb0b2')+'; font-weight:700;">'
          + '👤 ['+cn3.name+'] 전용'+(isMine?' — 현재 내 직업':' · 이 직업으로 출전해야 습득 가능')+'</div><br>';
      }
    }
    info.innerHTML = '<b style="color:'+n.color+';">'+tierName+' — '+n.name+'</b> <span style="opacity:0.8;">['+cost+'P]</span><br>' + ownerLine + n.desc
      + (id.indexOf('cs_')===0 && n.tier==='notable' ? '<br><span style="color:#e2b23f;">⭐ 진화하는 별 — 런 중 전직(1·2·3차)·각성 순간마다 한 단계씩 강해진다 (최대 Ⅳ→✦)</span>' : '')
      + (resCls ? '<br><span style="opacity:0.75;">공명 직업: '+resCls+' (공명 시 추가 보너스)</span>' : '')
      + '<br><span style="opacity:0.7;">'+(alloc?'습득 완료':(canBuy?'클릭하여 습득 ('+cost+'P)':lockMsg))+'</span>';
    info.style.display = 'block';
  }
  starC.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    const rect = starC.getBoundingClientRect();
    starDrag = { sx:e.clientX, sy:e.clientY, vx:starView.x, vy:starView.y, moved:false };
    starC.setPointerCapture(e.pointerId);
  });
  starC.addEventListener('pointermove', (e)=>{
    const rect = starC.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    if (starDrag){
      const dx = e.clientX-starDrag.sx, dy = e.clientY-starDrag.sy;
      if (Math.hypot(dx,dy)>6) starDrag.moved = true;
      if (starDrag.moved){
        starView.x = starDrag.vx - dx/starView.scale;
        starView.y = starDrag.vy - dy/starView.scale;
        drawStarTree();
      }
    } else {
      const hit = starHitTest(mx,my);
      if (hit!==starHover){ starHover = hit; drawStarTree(); starShowInfo(hit); }
    }
  });
  starC.addEventListener('pointerup', (e)=>{
    const rect = starC.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    const wasDrag = starDrag && starDrag.moved;
    starDrag = null;
    if (wasDrag) return;
    const hit = starHitTest(mx,my);
    starShowInfo(hit);
    if (hit){
      const canBuy = starCanBuy(hit);
      if (canBuy){
        DB.star.nodes[hit] = true;
        saveDB();
        SFX.play('quest');
        drawStarTree();
        starShowInfo(hit);
      } else if (!starAllocated(hit)){
        SFX.play('hit');
      }
    }
  });
  starC.addEventListener('wheel', (e)=>{
    e.preventDefault();
    starView.scale = Math.max(0.5, Math.min(2.4, starView.scale * (e.deltaY<0 ? 1.12 : 0.89)));
    drawStarTree();
  }, { passive:false });
  $('starZoomIn').addEventListener('click', ()=>{ starView.scale = Math.min(2.4, starView.scale*1.2); drawStarTree(); });
  $('starZoomOut').addEventListener('click', ()=>{ starView.scale = Math.max(0.5, starView.scale*0.83); drawStarTree(); });
  // UI/UX: 전체 보기(성도 전경으로 핏) · 내 별만(최근 출전 직업 관련 별 하이라이트)
  let starFocusMode = false;
  const sfB = $('starFitBtn'), smB = $('starMineBtn');
  if (sfB) sfB.addEventListener('click', ()=>{
    starView.x = 0; starView.y = 0;
    starView.scale = Math.max(0.28, Math.min(1, (starC.clientHeight||480) / 1750));
    drawStarTree();
  });
  if (smB) smB.addEventListener('click', ()=>{
    starFocusMode = !starFocusMode;
    smB.textContent = starFocusMode ? '✦ 전체 별' : '✦ 내 별만';
    drawStarTree();
  });
  function starNodeMine(id){
    const ck = DB.lastClass;
    if (!ck || id==='center') return true;
    if (id.indexOf('cs_'+ck)===0 || id.indexOf('csw_'+ck)===0) return true;
    const g = classResGroup(ck);
    const pref = id.split('_')[0];
    if (pref===g) return true;
    if (id.indexOf('cs_')===0 || id.indexOf('csw_')===0) return false; // 남의 직업 별
    return pref==='ring1' || pref==='or' || pref==='deep' || pref==='t2' || pref==='T'; // 공유 구역은 표시
  }
  $('starResetBtn').addEventListener('click', ()=>{
    if (starSpent()===0) return;
    if (DB.gold < 2000){ toast('리스펙 비용 2000G 부족'); SFX.play('hit'); return; }
    DB.gold -= 2000;
    DB.star.nodes = {};
    saveDB();
    toast('운명 성도 리스펙 완료');
    SFX.play('coin');
    goldVal.textContent = DB.gold;
    drawStarTree();
  });

  // 성도 프리셋: 빌드 저장/전환 — 리스펙 없이 두 빌드를 오간다 (적용 500G)
  function starPresetSave(slot){
    DB.star.presets = DB.star.presets||{};
    DB.star.presets[slot] = Object.assign({}, DB.star.nodes);
    saveDB();
    toast('성도 프리셋 '+slot+' 저장 ('+Object.keys(DB.star.nodes).length+'노드)');
    SFX.play('quest');
  }
  function starPresetLoad(slot){
    const ps = DB.star.presets && DB.star.presets[slot];
    if (!ps || !Object.keys(ps).length){ toast('프리셋 '+slot+'이 비어있다'); SFX.play('hit'); return; }
    if (DB.gold < 500){ toast('프리셋 적용 비용 500G 부족'); SFX.play('hit'); return; }
    DB.gold -= 500;
    DB.star.nodes = Object.assign({}, ps);
    saveDB();
    toast('성도 프리셋 '+slot+' 적용 완료');
    SFX.play('coin');
    goldVal.textContent = DB.gold;
    drawStarTree();
  }
  const spA=$('starSaveA'), slA=$('starLoadA'), spB=$('starSaveB'), slB=$('starLoadB');
  if (spA) spA.addEventListener('click', ()=>starPresetSave('A'));
  if (slA) slA.addEventListener('click', ()=>starPresetLoad('A'));
  if (spB) spB.addEventListener('click', ()=>starPresetSave('B'));
  if (slB) slB.addEventListener('click', ()=>starPresetLoad('B'));

  // ---------- classes (9) ----------
  const CLASSES = {
    manager: {
      name:'관리자', tag:'위성 & 쿨감',
      desc:'[위성]으로 시작. 모든 쿨다운 -10%.',
      weapon:'satellite',
      apply:(p)=>{ p.cdr*=0.90; }
    },
    sniper: {
      name:'저격수', tag:'한 방 묵직',
      desc:'[추적 탄환]으로 시작. 공속 -45%, 대신 탄환 피해 +150% · 20% 확률 3배 치명타. 한 발 한 발이 무겁다.',
      weapon:'missile',
      apply:(p)=>{ p.critChance=0.20; p.critMult=3.0; p.rateMult*=0.55; p.projMult*=2.5; p.recoilScale=3; }
    },
    rusher: {
      name:'돌격병', tag:'돌진 베기',
      desc:'[역장]으로 시작. 이동 +20%, 처치 시 회복, 대시가 곧 공격 — 돌파 폭발 기본 장착. [중갑 가능]',
      weapon:'aura',
      apply:(p)=>{ p.speed*=1.2; p.lifesteal=2; p.dashBlast=(p.dashBlast||0)+18; }
    },
    archer: {
      name:'궁수', tag:'속사',
      desc:'[화살]로 시작. 공격속도 +30%로 쉴 새 없이 쏘지만 한 발은 가볍다 (-15%). 관통 +1.',
      weapon:'arrow',
      apply:(p)=>{ p.pierce+=1; p.rateMult*=1.30; p.projMult*=0.85; }
    },
    ninja: {
      name:'닌자', tag:'대시 특화', cost:250,
      desc:'[수리검]으로 시작. 대시 쿨다운 -40%, 회피 10%. 던질 때 몸이 앞으로 쏠린다.',
      weapon:'shuriken',
      apply:(p)=>{ p.dashCdMax*=0.6; p.dodge=0.10; p.lungeThrow=true; }
    },
    engineer: {
      name:'기술자', tag:'골드 & 행운', cost:400,
      desc:'[낙뢰]로 시작. 골드 +25%, 아이템 드랍 2배.',
      weapon:'lightning',
      apply:(p)=>{ p.goldMult*=1.25; p.luck*=2; }
    },
    paladin: {
      name:'성기사', tag:'방패 반격', cost:600,
      desc:'[역장]으로 시작. 받는 피해 -20%, 최대체력 +25, 접촉 피해의 40%를 방패로 반격. [중갑 가능]',
      weapon:'aura',
      apply:(p)=>{ p.dmgTaken=0.8; p.maxHp+=25; p.hp+=25; p.thorns=Math.max(p.thorns||0, 0.4); }
    },
    reaper: {
      name:'사신', tag:'대낫 · 처형', cost:800,
      desc:'[낫]으로 시작. 낫이 크고 무겁게 휘둘러지며(피해 +25%), 체력 12% 이하 일반 적 즉사, 흡혈 1.',
      weapon:'scythe',
      apply:(p)=>{ p.execThresh=Math.max(p.execThresh,0.12); p.lifesteal+=1; p.scytheBoost=(p.scytheBoost||1)*1.25; }
    },
    pilot: {
      name:'파일럿', tag:'드론', cost:700,
      desc:'[드론]으로 시작. 드론 피해 +30%, 아이템 드랍 +50%.',
      weapon:'drone',
      apply:(p)=>{ p.droneBoost=1.3; p.luck*=1.5; }
    },
    // ---- RPG 확장 직업 (고전 아키타입, 새로운 이름) ----
    cheol: {
      name:'철혈', tag:'중장 전사', cost:900,
      desc:'[낫]으로 시작. 받는 피해 -12%, 낫·역장 피해 +15%. [중갑 가능]',
      weapon:'scythe',
      apply:(p)=>{ p.dmgTaken*=0.88; p.scytheBoost=(p.scytheBoost||1)*1.15; p.auraBoost=(p.auraBoost||1)*1.15; }
    },
    voidc: {
      name:'공허술사', tag:'금단 마도', cost:1000,
      desc:'[낙뢰]로 시작. 모든 원소 발동 +6%p, 쿨다운 -8%.',
      weapon:'lightning',
      apply:(p)=>{ p.procBonus=(p.procBonus||0)+0.06; p.cdr*=0.92; }
    },
    necro: {
      name:'망자의 목자', tag:'강령', cost:1200,
      desc:'[위성]으로 시작. 처치한 적이 12% 확률로 아군 유령이 된다 (최대 4).',
      weapon:'satellite',
      apply:(p)=>{ p.necroChance=0.12; p.ghostCap=4; }
    },
    bard: {
      name:'선율가', tag:'전장의 악사', cost:1000,
      desc:'[역장]으로 시작. 콤보 유지 +1.5초, 피버 지속 +3초·피버 중 피해 +15%.',
      weapon:'aura',
      apply:(p)=>{ p.comboKeep=1.5; p.feverPlus=3; p.feverDmg=true; }
    },
    // ---- 재미 직업 ----
    tourist: {
      name:'관광객', tag:'재미', cost:500,
      desc:'[드론(셀카봉)]으로 시작. 이동 중 골드가 저절로 모인다 (+행운 +30%). 싸움엔 관심 없음.',
      weapon:'drone',
      apply:(p)=>{ p.luck*=1.3; p.walkGold=true; p.dmgMult*=0.9; p.speed*=1.08; }
    },
    stonks: {
      name:'주식쟁이', tag:'재미', cost:600,
      desc:'[추적 탄환]으로 시작. 피해가 시장처럼 등락하고(±40% 사이클), 30초마다 보유 골드의 3% 이자.',
      weapon:'missile',
      apply:(p)=>{ p.stonks=true; p.goldMult*=1.15; }
    },
    gymbro: {
      name:'헬창', tag:'재미', cost:500,
      desc:'[역장]으로 시작. 최대체력 +40, 체력이 높을수록 피해 증가. 이동은 조금 느리다 (벌크업).',
      weapon:'aura',
      apply:(p)=>{ p.maxHp+=40; p.hp+=40; p.gymbro=true; p.speed*=0.92; }
    },
    baeksu: {
      name:'백수', tag:'재미', cost:400,
      desc:'[역장]으로 시작. 가만히 서 있으면 재생 3배 + 받는 피해 -20%. 움직이면 평범해진다. 원래 집이 최고다.',
      weapon:'aura',
      apply:(p)=>{ p.baeksu=true; p.regen+=0.5; }
    },
    gambler: {
      name:'도박사', tag:'재미', cost:800,
      desc:'[추적 탄환]으로 시작. 모든 피해가 0.5×~2.5× 사이에서 무작위. 카드 상위 등급 확률 +50%.',
      weapon:'missile',
      apply:(p)=>{ p.luck*=1.5; p.gambleDmg=true; }
    },
    // ---- 히든 직업 (골드가 아니라 조건으로 해금) ----
    collector: {
      name:'수집가', tag:'히든', hidden:true,
      condDesc:'유니크 장비 3종 보유 시 해금',
      cond:()=> DB.inv.filter(i=>i.r===5).length>=3,
      desc:'무작위 무기 2개로 시작. 아이템 드랍 +50%, 상자에서 나오는 것이 한 단계 좋아진다.',
      weapon:'random2',
      apply:(p)=>{ p.luck*=1.5; p.chestPlus=true; }
    },
    madman: {
      name:'광인', tag:'히든', hidden:true,
      condDesc:'위험도 5 도달 시 해금',
      cond:()=> (DB.perilMax||0)>=5,
      desc:'체력이 계속 새어나간다 (초당 0.8%). 대신 처치 회복 +3, 피해 +12%. 멈추면 죽는다 — 계속 사냥하라.',
      weapon:'scythe',
      apply:(p)=>{ p.madman=true; p.lifesteal+=3; p.dmgMult*=1.12; }
    },
    monk: {
      name:'수도승', tag:'히든', hidden:true,
      condDesc:'위험도 10 도달 시 해금',
      cond:()=> (DB.perilMax||0)>=10,
      desc:'무기 슬롯 1개. 단 하나의 무기와 함께 정진한다 — 그 무기 피해 +30%, 쿨다운 -10%.',
      weapon:'aura',
      apply:(p)=>{ p.weaponCap=1; p.dmgMult*=1.3; p.cdr*=0.9; }
    },
    commander: {
      name:'지휘관', tag:'히든', hidden:true,
      condDesc:'위험도 15 도달 시 해금',
      cond:()=> (DB.perilMax||0)>=15,
      desc:'직접 싸우지 않는다. 터렛 1기·유령 소환으로 시작, 모든 소환물 +50% / 본인 투사체 -30%.',
      weapon:'satellite',
      apply:(p)=>{ p.turretLv=1; p.turretDmg=10; p.necroChance=0.10; p.ghostCap=5; p.droneBoost+=0.5; p.ghostDmg=(p.ghostDmg||1)*1.5; p.projMult*=0.7; }
    },
    tombraider: {
      name:'도굴꾼', tag:'히든', hidden:true,
      condDesc:'위험도 20 도달 시 해금',
      cond:()=> (DB.perilMax||0)>=20,
      desc:'수집 범위 +100, 아이템 드랍 +70%. 그러나 몹이 골드를 떨구지 않는다 — 상자가 전부다.',
      weapon:'shuriken',
      apply:(p)=>{ p.magnet+=100; p.luck*=1.7; p.goldDropMod=0; }
    },
    mumyeong: {
      name:'무명자(無名者)', tag:'히든', hidden:true,
      condDesc:'위험도 30 도달 시 해금',
      cond:()=> (DB.perilMax||0)>=30,
      desc:'이름도 직업도 없다. 모든 직업의 스킬 풀에서 무작위 4개를 배운다 — 매 판이 다른 직업.',
      weapon:'missile',
      apply:(p)=>{ p.randomSkills=true; }
    },
    exhero: {
      name:'전직 용사', tag:'히든', hidden:true,
      condDesc:'보스 누적 100회 처치 시 해금',
      cond:()=> (DB.prog.boss||0)>=100,
      desc:'마왕을 잡고 은퇴했지만 몸이 기억한다. 레벨 5에 이미 1차 전직 상태로 시작.',
      weapon:'scythe',
      apply:(p)=>{ p.exhero=true; }
    },
    shadow: {
      name:'그림자', tag:'히든', hidden:true,
      condDesc:'엘리트 누적 150회 처치 시 해금',
      cond:()=> (DB.prog.elite||0)>=150,
      desc:'3초간 피격 없이 움직이면 다음 공격이 반드시 치명타가 된다. 회피 +10%.',
      weapon:'shuriken',
      apply:(p)=>{ p.shadowStrike=true; p.dodge=Math.min(0.6,p.dodge+0.1); }
    },
    blackcat: {
      name:'검은 고양이', tag:'히든', hidden:true,
      condDesc:'업적 20개 달성 시 해금',
      cond:()=> achCount()>=20,
      desc:'아홉 개의 목숨. 부활 +2, 회피 +12%, 몸이 작다. 가끔 아무 이유 없이 뛰어다닌다.',
      weapon:'shuriken',
      apply:(p)=>{ p.reviveLeft+=2; p.dodge=Math.min(0.6,p.dodge+0.12); p.catSmall=true; p.speed*=1.08; p.r=10; }
    },
    slime: {
      name:'슬라임', tag:'히든', hidden:true,
      condDesc:'누적 20,000마리 처치 시 해금',
      cond:()=> (DB.prog.kill||0)>=20000,
      desc:'너무 많이 죽여서 몬스터가 되어버렸다. [역장]으로 시작, 체력이 높을수록 커지고 강해진다.',
      weapon:'aura',
      apply:(p)=>{ p.maxHp=Math.round(p.maxHp*1.3); p.hp=p.maxHp; p.slimeBody=true; p.speed*=0.95; }
    },
    glitch: {
      name:'글리치', tag:'히든', hidden:true,
      condDesc:'심연 회로 클리어 시 해금',
      cond:()=> !!DB.mapCleared.abyss,
      desc:'무작위 무기 2개로 시작. 카드 상위 등급 확률 대폭 상승, 잭팟 확률 3배.',
      weapon:'random2',
      apply:(p)=>{ p.luck*=1.5; p.jackpotMult=2; p.dodge=0.05; }
    },
    returner: {
      name:'회귀자', tag:'히든', hidden:true,
      condDesc:'업적 12개 달성 시 해금',
      cond:()=> achCount()>=12,
      desc:'모든 것을 기억한 채 돌아왔다. 속성을 4계열까지 선택 가능, 리롤 +2.',
      weapon:'missile',
      apply:(p)=>{ p.attrLimit=4; rerollsLeft+=2; }
    },
    contributor: {
      name:'최병우', tag:'비밀', hidden:true, secretInput:true,
      condDesc:'??? (힌트: 공로자)',
      cond:()=> false,
      desc:'이 세계를 처음 만든 자가 직접 강림했다. 무작위 무기 3개로 시작, 카드 +1장. 힘이 아니라 자유가 그의 특권이다.',
      weapon:'random3',
      apply:(p)=>{ p.luck*=1.15; p.cardSlots=(p.cardSlots||6)+1; }
    },
    debug: {
      name:'디버거', tag:'비밀', hidden:true,
      condDesc:'??? (비밀 커맨드로만 해금)',
      cond:()=> false,
      desc:'존재해선 안 되는 관측자. 레벨업 카드가 5장 보이지만, 능력치는 평범하다.',
      weapon:'missile',
      apply:(p)=>{ p.cardSlots=8; }
    }
  };
  function isClassUnlocked(key){
    const c = CLASSES[key];
    if (c.hidden) return !!DB.unlocked[key];
    return !c.cost || DB.unlocked[key];
  }
  function renderClassCards(){
    classCardsEl.innerHTML = '';
    goldVal.textContent = DB.gold;
    Object.keys(CLASSES).forEach((key)=>{
      const c = CLASSES[key];
      const unlocked = isClassUnlocked(key);
      const el = document.createElement('div');
      el.className = 'card' + (unlocked?'':' locked');
      if (unlocked){
        el.innerHTML = '<div class="tag">'+c.tag+'</div><div class="name">'+c.name+'</div><div class="desc">'+c.desc+'</div>';
        el.addEventListener('click', ()=> startGame(key));
      } else if (c.hidden){
        el.innerHTML = '<div class="tag">히든</div><div class="name">???</div><div class="desc">'+c.condDesc+'</div>';
        // 비밀 입력형 (모바일 대응): 카드를 누르면 입력창
        if (c.secretInput){
          el.style.cursor = 'pointer';
          el.addEventListener('click', ()=>{
            const ans = prompt('...무언가를 알고 있다면 이름을 말하라.');
            if (ans && ans.trim()==='최병우'){
              DB.unlocked[key] = true;
              unlockAch('hidden');
              saveDB();
              toast('...세계가 창조주를 알아본다. 비밀 직업 ['+c.name+'] 해금');
              SFX.play('win');
              renderClassCards();
            } else if (ans){ toast('...아무 일도 일어나지 않았다.'); }
          });
        }
      } else {
        el.innerHTML = '<div class="tag">잠금 · '+c.cost+'G</div><div class="name">'+c.name+'</div><div class="desc">'+c.desc+'<br><b>클릭하여 해금</b></div>';
        el.addEventListener('click', ()=>{
          if (DB.gold >= c.cost){
            DB.gold -= c.cost;
            DB.unlocked[key] = true;
            saveDB(); SFX.play('chest');
            renderClassCards();
          } else {
            SFX.play('hit');
          }
        });
      }
      classCardsEl.appendChild(el);
    });
  }
  function checkHiddenUnlocks(){
    Object.keys(CLASSES).forEach((key)=>{
      const c = CLASSES[key];
      if (c.hidden && !DB.unlocked[key] && c.cond && c.cond()){
        DB.unlocked[key] = true;
        toast('히든 직업 해금: '+c.name+'!');
        unlockAch('hidden');
        SFX.play('win');
        saveDB();
      }
    });
  }

  // ---------- class ultimates ----------
  const CLASS_ULTIMATES = {
    manager: {
      key:'ult_overload', name:'위성 과부하', desc:'8초마다 위성이 폭발해 주변 전체에 강한 피해를 입힙니다.',
      strengthenDesc:'과부하 피해 +15, 재사용 대기시간 감소',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=8; p.ultCooldown=1.5; p.ultDamage=40; },
      strengthen:(p)=>{ p.ultDamage+=15; p.ultCooldownMax=Math.max(4,p.ultCooldownMax-0.8); }
    },
    sniper: {
      key:'ult_snipe', name:'관통 저격', desc:'5초마다 모든 것을 관통하는 확정 치명타 저격탄을 발사합니다.',
      strengthenDesc:'저격 피해 배율 증가, 재사용 대기시간 감소',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=5; p.ultCooldown=1; p.ultMult=4; },
      strengthen:(p)=>{ p.ultMult+=1; p.ultCooldownMax=Math.max(2.5,p.ultCooldownMax-0.6); }
    },
    rusher: {
      key:'ult_whirl', name:'회전베기', desc:'4초마다 검을 휘둘러 주변 전체를 베어냅니다.',
      strengthenDesc:'베기 피해·범위 증가',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=4; p.ultCooldown=1; p.ultDamage=22; p.ultRadius=90; },
      strengthen:(p)=>{ p.ultDamage+=10; p.ultRadius+=15; }
    },
    archer: {
      key:'ult_volley', name:'일제사격', desc:'6초마다 사방으로 화살을 퍼붓습니다.',
      strengthenDesc:'화살 수·피해 증가',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=6; p.ultCooldown=1; p.ultVolleyCount=12; p.ultVolleyDmg=14; },
      strengthen:(p)=>{ p.ultVolleyCount=Math.min(24,p.ultVolleyCount+4); p.ultVolleyDmg+=6; }
    },
    ninja: {
      key:'ult_flurry', name:'수리검 난무', desc:'5초마다 관통 수리검을 원형으로 흩뿌립니다.',
      strengthenDesc:'수리검 수 +4, 피해 +6',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=5; p.ultCooldown=1; p.ultVolleyCount=10; p.ultVolleyDmg=16; },
      strengthen:(p)=>{ p.ultVolleyCount=Math.min(22,p.ultVolleyCount+4); p.ultVolleyDmg+=6; }
    },
    engineer: {
      key:'ult_emp', name:'시스템 과부하', desc:'9초마다 무작위 적 10기에 강력한 뇌격을 내립니다.',
      strengthenDesc:'뇌격 피해 +12, 재사용 대기시간 감소',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=9; p.ultCooldown=1.5; p.ultDamage=30; },
      strengthen:(p)=>{ p.ultDamage+=12; p.ultCooldownMax=Math.max(5,p.ultCooldownMax-1); }
    },
    paladin: {
      key:'ult_judge', name:'심판', desc:'10초마다 성역이 폭발하며 2초간 무적이 됩니다.',
      strengthenDesc:'심판 피해 +18, 재사용 대기시간 감소',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=10; p.ultCooldown=2; p.ultDamage=45; },
      strengthen:(p)=>{ p.ultDamage+=18; p.ultCooldownMax=Math.max(6,p.ultCooldownMax-1); }
    },
    reaper: {
      key:'ult_harvest', name:'수확', desc:'7초마다 거대한 낫 회오리로 주변을 베고, 처치당 체력을 회복합니다.',
      strengthenDesc:'수확 피해·범위 증가',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=7; p.ultCooldown=1.5; p.ultDamage=30; p.ultRadius=110; },
      strengthen:(p)=>{ p.ultDamage+=12; p.ultRadius+=18; }
    },
    pilot: {
      key:'ult_airstrike', name:'항공 지원', desc:'11초마다 전방 일직선으로 폭격이 떨어집니다.',
      strengthenDesc:'폭격 수·피해 증가',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=11; p.ultCooldown=2; p.ultDamage=35; p.ultVolleyCount=5; },
      strengthen:(p)=>{ p.ultDamage+=12; p.ultVolleyCount=Math.min(9,p.ultVolleyCount+2); }
    },
    cheol: {
      key:'ult_quake', name:'대지 가르기', desc:'9초마다 전방 대지를 갈라 3연쇄 충격파를 일으킵니다.',
      strengthenDesc:'충격파 피해·범위 증가',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=9; p.ultCooldown=1.5; p.ultDamage=38; },
      strengthen:(p)=>{ p.ultDamage+=14; }
    },
    voidc: {
      key:'ult_void', name:'공허 균열', desc:'12초마다 균열을 열어 적을 빨아들이며 태웁니다.',
      strengthenDesc:'균열 피해·지속 증가',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=12; p.ultCooldown=2; p.ultDamage=18; },
      strengthen:(p)=>{ p.ultDamage+=8; }
    },
    necro: {
      key:'ult_march', name:'망자의 행진', desc:'10초마다 유령 병사 6기를 즉시 일으킵니다.',
      strengthenDesc:'소환 수 +2',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=10; p.ultCooldown=2; p.ultVolleyCount=6; },
      strengthen:(p)=>{ p.ultVolleyCount=Math.min(12,p.ultVolleyCount+2); }
    },
    gambler: {
      key:'ult_dice', name:'운명의 주사위', desc:'10초마다 거대 주사위를 굴립니다 — 눈에 따라 대폭발부터 초대박 골드까지.',
      strengthenDesc:'나쁜 눈이 사라지고 기대값 상승',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=10; p.ultCooldown=1.5; p.ultDamage=30; },
      strengthen:(p)=>{ p.ultDamage+=15; p.diceLucky=true; }
    },
    collector: {
      key:'ult_vault', name:'수장고 개방', desc:'13초마다 수집품이 쏟아져 나와 적을 관통하며 휩쓸고 지나갑니다.',
      strengthenDesc:'발사 수 +4',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=13; p.ultCooldown=2; p.ultVolleyCount=8; p.ultVolleyDmg=15; },
      strengthen:(p)=>{ p.ultVolleyCount+=4; }
    },
    tourist: {
      key:'ult_photo', name:'기념 촬영', desc:'12초마다 셔터를 눌러 모든 적을 2.5초 정지시키고 골드를 줍습니다.',
      strengthenDesc:'재사용 대기시간 감소',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=12; p.ultCooldown=2; p.ultDamage=10; },
      strengthen:(p)=>{ p.ultCooldownMax=Math.max(7,p.ultCooldownMax-1.5); }
    },
    slime: {
      key:'ult_press', name:'바디 프레스', desc:'9초마다 온몸으로 짓눌러 체력에 비례한 광역 피해를 주고 조금 회복합니다.',
      strengthenDesc:'피해 +12, 회복량 증가',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=9; p.ultCooldown=1.5; p.ultDamage=24; },
      strengthen:(p)=>{ p.ultDamage+=12; }
    },
    bard: {
      key:'ult_crescendo', name:'광상곡', desc:'14초마다 폭발적인 연주로 즉시 피버를 일으킵니다.',
      strengthenDesc:'피버 지속 +1초',
      unlock:(p)=>{ p.ultReady=true; p.ultCooldownMax=14; p.ultCooldown=2; p.ultDamage=20; },
      strengthen:(p)=>{ p.feverPlus=(p.feverPlus||0)+1; }
    }
  };

  // ---------- 직업 전용 테크 (해당 직업으로만 등장, 등급 적용) ----------
  const CLASS_TECH = {
    manager: [
      { key:'ct_ma1', name:'위성 네트워크', desc:(m)=>'위성 타격 피해 +'+R(12*m)+'%', apply:(p,m)=>{ p.satBoost=(p.satBoost||1)*(1+0.12*m); } },
      { key:'ct_ma2', name:'관리자 권한', desc:(m)=>'모든 쿨다운 -'+R(3*m)+'%', apply:(p,m)=>{ p.cdr*=1-0.03*m; } },
    ],
    sniper: [
      { key:'ct_sn1', name:'정밀 조준', desc:(m)=>'치명타 확률 +'+R(4*m)+'%, 배율 +'+R1(0.15*m), apply:(p,m)=>{ p.critChance=Math.min(0.85,p.critChance+0.04*m); p.critMult+=0.15*m; } },
      { key:'ct_sn2', name:'철갑탄', desc:(m)=>'투사체 피해 +'+R(8*m)+'%, 관통 +1', apply:(p,m)=>{ p.projMult*=1+0.08*m; p.pierce+=1; } },
    ],
    rusher: [
      { key:'ct_ru1', name:'전장의 광기', desc:(m)=>'처치 시 회복 +'+Math.max(1,R(m))+', 이동속도 +'+R(4*m)+'%', apply:(p,m)=>{ p.lifesteal+=Math.max(1,R(m)); p.speed*=1+0.04*m; } },
      { key:'ct_ru2', name:'역장 증폭', desc:(m)=>'역장 초당 피해 +'+R(15*m)+'%', apply:(p,m)=>{ p.auraBoost=(p.auraBoost||1)*(1+0.15*m); } },
    ],
    archer: [
      { key:'ct_ar1', name:'명사수', desc:(m)=>'투사체 피해 +'+R(10*m)+'%', apply:(p,m)=>{ p.projMult*=1+0.10*m; } },
      { key:'ct_ar2', name:'속사', desc:(m)=>'공격속도 +'+R(7*m)+'%', apply:(p,m)=>{ p.rateMult*=1+0.07*m; } },
    ],
    ninja: [
      { key:'ct_ni1', name:'그림자 유영', desc:(m)=>'대시 쿨다운 -'+R(8*m)+'%, 회피 +'+R(2*m)+'%', apply:(p,m)=>{ p.dashCdMax*=1-0.08*m; p.dodge=Math.min(0.6,p.dodge+0.02*m); } },
      { key:'ct_ni2', name:'인술 연마', desc:(m)=>'수리검·투사체 피해 +'+R(9*m)+'%', apply:(p,m)=>{ p.projMult*=1+0.09*m; } },
    ],
    engineer: [
      { key:'ct_en1', name:'고압 전류', desc:(m)=>'낙뢰 피해 +'+R(14*m)+'%', apply:(p,m)=>{ p.boltBoost=(p.boltBoost||1)*(1+0.14*m); } },
      { key:'ct_en2', name:'사업 확장', desc:(m)=>'골드 +'+R(7*m)+'%, 행운 +'+R(10*m)+'%', apply:(p,m)=>{ p.goldMult*=1+0.07*m; p.luck*=1+0.10*m; } },
    ],
    paladin: [
      { key:'ct_pa1', name:'신성한 맹세', desc:(m)=>'받는 피해 -'+R(4*m)+'%', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; } },
      { key:'ct_pa2', name:'성역 확장', desc:(m)=>'역장 초당 피해 +'+R(12*m)+'%, 최대체력 +'+R(8*m), apply:(p,m)=>{ p.auraBoost=(p.auraBoost||1)*(1+0.12*m); p.maxHp+=R(8*m); p.hp+=R(8*m); } },
    ],
    reaper: [
      { key:'ct_re1', name:'죽음의 문턱', desc:(m)=>'처형 임계값 +'+R(2*m)+'%p', apply:(p,m)=>{ p.execThresh=Math.min(0.35,p.execThresh+0.02*m); } },
      { key:'ct_re2', name:'낫질 숙련', desc:(m)=>'낫 피해 +'+R(13*m)+'%', apply:(p,m)=>{ p.scytheBoost=(p.scytheBoost||1)*(1+0.13*m); } },
    ],
    pilot: [
      { key:'ct_pi1', name:'드론 개조', desc:(m)=>'드론 피해 +'+R(12*m)+'%', apply:(p,m)=>{ p.droneBoost+=0.12*m; } },
      { key:'ct_pi2', name:'통신 최적화', desc:(m)=>'공격속도 +'+R(6*m)+'%, 쿨다운 -'+R(2*m)+'%', apply:(p,m)=>{ p.rateMult*=1+0.06*m; p.cdr*=1-0.02*m; } },
    ],
    glitch: [
      { key:'ct_gl1', name:'오류 주입', desc:(m)=>'무작위 강화: 공격/공속/이속 중 하나 +'+R(12*m)+'%', apply:(p,m)=>{
          const r=Math.random();
          if (r<0.34) p.dmgMult*=1+0.12*m;
          else if (r<0.67) p.rateMult*=1+0.12*m;
          else p.speed*=1+0.12*m;
        } },
      { key:'ct_gl2', name:'확률 조작', desc:(m)=>'행운 +'+R(15*m)+'%', apply:(p,m)=>{ p.luck*=1+0.15*m; } },
    ],
    returner: [
      { key:'ct_rt1', name:'회귀의 기억', desc:(m)=>'경험치 +'+R(8*m)+'%', apply:(p,m)=>{ p.xpMult=(p.xpMult||1)*(1+0.08*m); } },
      { key:'ct_rt2', name:'예지', desc:(m)=>'리롤 +1', apply:(p,m)=>{ rerollsLeft+=1; } },
    ],
    cheol: [
      { key:'ct_ch1', name:'전열 붕괴', desc:(m)=>'낫·역장 피해 +'+R(10*m)+'%', apply:(p,m)=>{ p.scytheBoost=(p.scytheBoost||1)*(1+0.10*m); p.auraBoost=(p.auraBoost||1)*(1+0.10*m); } },
      { key:'ct_ch2', name:'철벽', desc:(m)=>'받는 피해 -'+R(4*m)+'%', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; } },
    ],
    voidc: [
      { key:'ct_vo1', name:'심연 응시', desc:(m)=>'모든 원소 발동 +'+R(3*m)+'%p', apply:(p,m)=>{ p.procBonus=(p.procBonus||0)+0.03*m; } },
      { key:'ct_vo2', name:'균열 확장', desc:(m)=>'쿨다운 -'+R(3*m)+'%, 피해 +'+R(5*m)+'%', apply:(p,m)=>{ p.cdr*=1-0.03*m; p.dmgMult*=1+0.05*m; } },
    ],
    necro: [
      { key:'ct_ne1', name:'망자 결속', desc:(m)=>'유령 최대 수 +1, 유령 피해 +'+R(15*m)+'%', apply:(p,m)=>{ p.ghostCap+=1; p.ghostDmg=(p.ghostDmg||1)*(1+0.15*m); } },
      { key:'ct_ne2', name:'수확의 종', desc:(m)=>'유령 소환 확률 +'+R(4*m)+'%p', apply:(p,m)=>{ p.necroChance=Math.min(0.5,p.necroChance+0.04*m); } },
    ],
    bard: [
      { key:'ct_ba1', name:'연주 가속', desc:(m)=>'공격속도 +'+R(6*m)+'%', apply:(p,m)=>{ p.rateMult*=1+0.06*m; } },
      { key:'ct_ba2', name:'군중 열광', desc:(m)=>'피버 지속 +'+R1(0.5*m)+'초', apply:(p,m)=>{ p.feverPlus=(p.feverPlus||0)+0.5*m; } },
    ],
  };

  // ---------- 직업별 고유 스킬 (레벨 도달로 습득 → 슬롯 2~4에 장착) ----------
  // 임시 버프 시스템
  function tbuff(stat, v, t){ player.tbuffs.push({ stat, v, t }); }
  function buffMult(stat){
    let m = 1;
    for (const b of (player.tbuffs||[])) if (b.stat===stat) m *= b.v;
    return m;
  }
  function skFreezeAll(t){
    for (const e of enemies) e.frozenT = Math.max(e.frozenT||0, t);
    effects.push({ type:'ring', x:player.x, y:player.y, life:0.5, age:0, r0:30, r1:420 });
    SFX.play('tele');
  }
  function skNova(r, dmg){ friendlyBlast(player.x, player.y, r, dmg*player.dmgMult, true); SFX.play('boom'); }
  const SKILL_POOLS = {
    manager: [
      { n:'정지 명령', lv:3, cd:16, d:'모든 적을 1.5초 정지', fx:()=>skFreezeAll(1.5) },
      { n:'강제 종료', lv:8, cd:14, d:'주변 적 현재 체력 20% 피해', fx:()=>{ for (let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; if (Math.hypot(e.x-player.x,e.y-player.y)<200){ const d2=e.hp*0.2+8; e.hp-=d2; addDmgNum(e.x,e.y,d2,false); if(e.hp<=0) defeatEnemy(i); } } SFX.play('boom'); } },
      { n:'재배치', lv:15, cd:10, d:'무작위 순간이동 + 1초 무적', fx:()=>{ const a=Math.random()*Math.PI*2; burst(player.x,player.y,12,160); player.x+=Math.cos(a)*220; player.y+=Math.sin(a)*220; player.invuln=Math.max(player.invuln,1); SFX.play('tele'); } },
      { n:'루트 권한', lv:25, cd:30, d:'5초간 공격속도 +50%', fx:()=>{ tbuff('rate',1.5,5); addTextNum(player.x,player.y-26,'ROOT'); SFX.play('fever'); } },
    ],
    sniper: [
      { n:'조준 사격', lv:3, cd:8, d:'모든 것을 관통하는 저격탄', fx:()=>{ const t=nearestTarget(); if(t){ const a=Math.atan2(t.y-player.y,t.x-player.x); projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*700,vy:Math.sin(a)*700,r:5,damage:30*player.dmgMult,crit:true,pierce:9999,life:1.2,mega:true}); SFX.play('shoot'); } } },
      { n:'연막', lv:8, cd:16, d:'3초간 회피 +40%', fx:()=>{ player.dodge=Math.min(0.9,player.dodge+0.4); setTimeout(()=>{ player.dodge=Math.max(0,player.dodge-0.4); },3000); burst(player.x,player.y,20,120); } },
      { n:'더블탭', lv:15, cd:14, d:'3초간 모든 공격 확정 치명타', fx:()=>{ const o=player.critChance; player.critChance=1; setTimeout(()=>{ player.critChance=o; },3000); SFX.play('fever'); } },
      { n:'데드아이', lv:25, cd:26, d:'적 8명을 즉시 저격', fx:()=>{ let n=0; for (let i=enemies.length-1;i>=0&&n<8;i--,n++){ const e=enemies[i]; const d2=40*player.dmgMult*player.critMult; e.hp-=d2; addDmgNum(e.x,e.y,d2,true); burst(e.x,e.y,6,140); if(e.hp<=0) defeatEnemy(i); } SFX.play('boom'); } },
    ],
    rusher: [
      { n:'돌격', lv:3, cd:9, d:'전방 돌진 + 경로 폭발', fx:()=>{ tryDashFree(); dashExplosion(player.x,player.y,30); } },
      { n:'전투 함성', lv:8, cd:15, d:'4초간 피해 +25%', fx:()=>{ tbuff('dmg',1.25,4); addTextNum(player.x,player.y-26,'함성!'); SFX.play('warn'); } },
      { n:'피의 소용돌이', lv:15, cd:13, d:'주변을 베고 처치당 회복', fx:()=>{ const before=killCount; skNova(150,26); const k=killCount-before; if(k>0){ player.hp=Math.min(player.maxHp,player.hp+k*3*player.healMult); } } },
      { n:'무모함', lv:25, cd:28, d:'5초간 받는 피해 -70%', fx:()=>{ tbuff('dr',0.3,5); addTextNum(player.x,player.y-26,'무모함!'); } },
    ],
    archer: [
      { n:'관통 사격', lv:3, cd:8, d:'초관통 화살 3연발', fx:()=>{ const t=nearestTarget(); const a=t?Math.atan2(t.y-player.y,t.x-player.x):player.facing; for(let k=-1;k<=1;k++) projectiles.push({x:player.x,y:player.y,vx:Math.cos(a+k*0.12)*560,vy:Math.sin(a+k*0.12)*560,r:4,damage:18*player.dmgMult,crit:false,pierce:12,life:1.1,arrow:true}); SFX.play('shoot'); } },
      { n:'화살비', lv:8, cd:14, d:'전방 지역에 화살 폭격', fx:()=>{ const a=player.facing; for(let k=0;k<4;k++) addHazard(player.x+Math.cos(a)*(90+k*60)+(Math.random()*60-30), player.y+Math.sin(a)*(90+k*60)+(Math.random()*60-30), 52, 0.3+k*0.1, 26*player.dmgMult, true); SFX.play('shoot'); } },
      { n:'속사', lv:15, cd:16, d:'4초간 공격속도 +40%', fx:()=>{ tbuff('rate',1.4,4); SFX.play('fever'); } },
      { n:'수확의 바람', lv:25, cd:24, d:'모든 조각을 끌어모으고 회오리 피해', fx:()=>{ for (const o of orbs) o.magnetized=true; skNova(170,30); } },
    ],
    ninja: [
      { n:'수리검 부채', lv:3, cd:8, d:'부채꼴 수리검 7발', fx:()=>{ const t=nearestTarget(); const a=t?Math.atan2(t.y-player.y,t.x-player.x):player.facing; for(let k=0;k<7;k++) projectiles.push({x:player.x,y:player.y,vx:Math.cos(a+(k-3)*0.18)*430,vy:Math.sin(a+(k-3)*0.18)*430,r:5,damage:14*player.dmgMult,crit:false,pierce:2,life:0.9,kind:'shuriken',phase:'out',noReturn:true,spin:0,hitSet:new Set()}); SFX.play('shoot'); } },
      { n:'연막탄', lv:8, cd:15, d:'대시 쿨 초기화 + 3초 회피 +30%', fx:()=>{ player.dashCd=0; player.dodge=Math.min(0.9,player.dodge+0.3); setTimeout(()=>{ player.dodge=Math.max(0,player.dodge-0.3); },3000); burst(player.x,player.y,18,140); } },
      { n:'그림자 습격', lv:15, cd:12, d:'가장 가까운 적 뒤로 점멸 + 참격', fx:()=>{ const t=nearestTarget(); if(t){ burst(player.x,player.y,10,130); player.x=t.x+20; player.y=t.y; player.invuln=Math.max(player.invuln,0.6); friendlyBlast(t.x,t.y,90,35*player.dmgMult,true); SFX.play('tele'); } } },
      { n:'분신 소환', lv:25, cd:26, d:'분신 3기가 5초간 함께 사격', fx:()=>{ for(let k=0;k<3;k++) player.shadows.push({x:player.x+(Math.random()*60-30),y:player.y+(Math.random()*60-30),t:5,cd:0.2}); SFX.play('tele'); } },
    ],
    engineer: [
      { n:'스파크', lv:3, cd:9, d:'즉시 연쇄 번개 4회', fx:()=>{ for(let k=0;k<4;k++) lightningStrike(20*player.dmgMult, true); } },
      { n:'골드 러시', lv:8, cd:20, d:'5초간 골드 획득 2배', fx:()=>{ const o=player.goldMult; player.goldMult*=2; setTimeout(()=>{ player.goldMult=o; },5000); addTextNum(player.x,player.y-26,'💰'); SFX.play('coin'); } },
      { n:'임시 포탑', lv:15, cd:18, d:'10초짜리 포탑 설치', fx:()=>{ player.turrets.push({x:player.x+40,y:player.y,cd:0,temp:10}); if(!player.turretDmg) player.turretDmg=12; SFX.play('equip'); } },
      { n:'EMP', lv:25, cd:26, d:'전체 감전 + 1초 정지', fx:()=>{ skFreezeAll(1); for(let k=0;k<8;k++) lightningStrike(24*player.dmgMult,true); } },
    ],
    paladin: [
      { n:'심판의 망치', lv:3, cd:9, d:'전방 성스러운 강타', fx:()=>{ const a=player.facing; addHazard(player.x+Math.cos(a)*100, player.y+Math.sin(a)*100, 70, 0.25, 35*player.dmgMult, true); SFX.play('boom'); } },
      { n:'축성', lv:8, cd:18, d:'체력 20% 회복 + 3초 피해감소', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.2*player.healMult); tbuff('dr',0.7,3); SFX.play('pick'); } },
      { n:'수호의 방패', lv:15, cd:16, d:'즉시 방벽 1회 충전', fx:()=>{ player.shieldReady=true; if(!player.shieldCdMax) player.shieldCdMax=12; effects.push({type:'ring',x:player.x,y:player.y,life:0.3,age:0,r0:14,r1:40}); SFX.play('tele'); } },
      { n:'천상의 빛', lv:25, cd:28, d:'대범위 성역 폭발 + 2초 무적', fx:()=>{ skNova(220,45); player.invuln=Math.max(player.invuln,2); } },
    ],
    reaper: [
      { n:'사신의 손짓', lv:3, cd:12, d:'5초간 처형 임계값 +10%p', fx:()=>{ player.execThresh+=0.10; setTimeout(()=>{ player.execThresh=Math.max(0,player.execThresh-0.10); },5000); addTextNum(player.x,player.y-26,'죽음이 온다'); } },
      { n:'영혼 수확', lv:8, cd:10, d:'주변을 베고 조각 흡수', fx:()=>{ skNova(130,28); for (const o of orbs) o.magnetized=true; } },
      { n:'죽음의 표식', lv:15, cd:14, d:'주변 적 전체에 부식 2중첩', fx:()=>{ for (const e of enemies){ if (Math.hypot(e.x-player.x,e.y-player.y)<250){ e.corrodeS=Math.min(player.corrodeMaxS,(e.corrodeS||0)+2); e.corrodeT=6; } } SFX.play('warn'); } },
      { n:'대낫 회전', lv:25, cd:24, d:'거대 낫 3연속 회전', fx:()=>{ let k=0; const iv=setInterval(()=>{ if(state==='playing') skNova(170,32); k++; if(k>=3) clearInterval(iv); },300); } },
    ],
    pilot: [
      { n:'집중 포화', lv:3, cd:9, d:'드론·터렛 표적 일제 사격', fx:()=>{ const t=nearestTarget(); if(t){ for(let k=0;k<6;k++){ const a=Math.random()*Math.PI*2; projectiles.push({x:t.x+Math.cos(a)*80,y:t.y+Math.sin(a)*80,vx:-Math.cos(a)*500,vy:-Math.sin(a)*500,r:3,damage:14*player.dmgMult,crit:false,pierce:0,life:0.5,tracer:true}); } SFX.play('shoot'); } } },
      { n:'보급 요청', lv:8, cd:25, d:'무작위 아이템 2개 투하', fx:()=>{ dropItem(player.x+50,player.y-30); dropItem(player.x-50,player.y-30); SFX.play('coin'); } },
      { n:'드론 과부하', lv:15, cd:16, d:'4초간 공격속도 +35%', fx:()=>{ tbuff('rate',1.35,4); SFX.play('fever'); } },
      { n:'궤도 폭격', lv:25, cd:26, d:'주변 8발 융단 폭격', fx:()=>{ for(let k=0;k<8;k++){ const a=Math.random()*Math.PI*2,d2=60+Math.random()*220; addHazard(player.x+Math.cos(a)*d2,player.y+Math.sin(a)*d2,60,0.5+k*0.1,40*player.dmgMult,true); } SFX.play('meteor'); } },
    ],
    glitch: [
      { n:'???', lv:3, cd:12, d:'무작위 직업의 무작위 스킬 발동', fx:()=>{ const ks=Object.keys(SKILL_POOLS).filter(k=>k!=='glitch'); const pool=SKILL_POOLS[ks[(Math.random()*ks.length)|0]]; const sk=pool[(Math.random()*pool.length)|0]; addTextNum(player.x,player.y-26,'?? '+sk.n); sk.fx(); } },
      { n:'롤백', lv:8, cd:18, d:'체력 18% 복구', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.18*player.healMult); addTextNum(player.x,player.y-26,'ctrl+z'); SFX.play('pick'); } },
      { n:'노클립', lv:15, cd:16, d:'2초간 무적', fx:()=>{ player.invuln=Math.max(player.invuln,2); addTextNum(player.x,player.y-26,'noclip'); } },
      { n:'스택 오버플로', lv:25, cd:30, d:'화면이 버그로 뒤덮인다 (대폭발)', fx:()=>{ for(let k=0;k<12;k++){ const a=Math.random()*Math.PI*2,d2=Math.random()*300; addHazard(player.x+Math.cos(a)*d2,player.y+Math.sin(a)*d2,55,0.2+Math.random()*0.8,35*player.dmgMult,true); } shake=Math.min(24,shake+16); SFX.play('boom'); } },
    ],
    returner: [
      { n:'기시감', lv:3, cd:20, d:'모든 스킬 쿨다운 -50%', fx:()=>{ player.skCds=player.skCds.map(c=>c*0.5); player.ultCooldown*=0.5; addTextNum(player.x,player.y-26,'이미 본 미래'); } },
      { n:'미래시', lv:8, cd:16, d:'4초간 회피 +35%', fx:()=>{ player.dodge=Math.min(0.9,player.dodge+0.35); setTimeout(()=>{ player.dodge=Math.max(0,player.dodge-0.35); },4000); } },
      { n:'회귀 파동', lv:15, cd:14, d:'적을 크게 밀쳐내는 파동', fx:()=>{ for (const e of enemies){ const d2=Math.hypot(e.x-player.x,e.y-player.y); if(d2<220){ const a=Math.atan2(e.y-player.y,e.x-player.x); e.x+=Math.cos(a)*140; e.y+=Math.sin(a)*140; } } skNova(200,18); } },
      { n:'시간 정지', lv:25, cd:32, d:'2.5초간 세계가 멈춘다', fx:()=>skFreezeAll(2.5) },
    ],
    cheol: [
      { n:'방패 밀치기', lv:3, cd:8, d:'전방 강타 + 넉백', fx:()=>{ const a=player.facing; addHazard(player.x+Math.cos(a)*80,player.y+Math.sin(a)*80,65,0.15,28*player.dmgMult,true); } },
      { n:'철벽 태세', lv:8, cd:18, d:'4초간 받는 피해 -50%', fx:()=>{ tbuff('dr',0.5,4); addTextNum(player.x,player.y-26,'철벽'); } },
      { n:'대지 강타', lv:15, cd:14, d:'주변 대지를 내려찍는다', fx:()=>{ skNova(160,38); shake=Math.min(20,shake+12); } },
      { n:'최후의 보루', lv:25, cd:30, d:'체력 30% 회복 + 5초 피해 +20%', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.3*player.healMult); tbuff('dmg',1.2,5); } },
    ],
    voidc: [
      { n:'공허 화살', lv:3, cd:8, d:'관통 공허탄 + 부식', fx:()=>{ const t=nearestTarget(); if(t){ const a=Math.atan2(t.y-player.y,t.x-player.x); projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*500,vy:Math.sin(a)*500,r:6,damage:26*player.dmgMult,crit:false,pierce:8,life:1.1,imbue:'acid'}); SFX.play('shoot'); } } },
      { n:'침식 파동', lv:8, cd:14, d:'주변 적 전체 부식 + 피해', fx:()=>{ for (const e of enemies){ if (Math.hypot(e.x-player.x,e.y-player.y)<230){ e.corrodeS=Math.min(player.corrodeMaxS,(e.corrodeS||0)+1); e.corrodeT=6; } } skNova(180,22); } },
      { n:'소균열', lv:15, cd:16, d:'작은 공허 균열 소환', fx:()=>{ const t=nearestTarget(); const x2=t?t.x:player.x+Math.cos(player.facing)*150, y2=t?t.y:player.y+Math.sin(player.facing)*150; if (zones.length<40) zones.push({x:x2,y:y2,r:85,dps:16*player.dmgMult,t:3,maxT:3,type:'void'}); SFX.play('tele'); } },
      { n:'심연 개방', lv:25, cd:30, d:'거대 공허 균열', fx:()=>{ if (zones.length<40) zones.push({x:player.x,y:player.y,r:170,dps:30*player.dmgMult,t:5,maxT:5,type:'void'}); SFX.play('warn'); } },
    ],
    necro: [
      { n:'유령 소환', lv:3, cd:12, d:'유령 2기 소환', fx:()=>{ for(let k=0;k<2;k++) player.ghosts.push({x:player.x+(Math.random()*60-30),y:player.y+(Math.random()*60-30),t:8+(player.ghostDur||0),cd:0}); SFX.play('tele'); } },
      { n:'뼈 감옥', lv:8, cd:16, d:'주변 적 2초 정지', fx:()=>{ for (const e of enemies){ if (Math.hypot(e.x-player.x,e.y-player.y)<200) e.frozenT=Math.max(e.frozenT||0,2); } SFX.play('tele'); } },
      { n:'희생', lv:15, cd:14, d:'모든 유령이 폭발한다', fx:()=>{ for (const gh of player.ghosts){ friendlyBlast(gh.x,gh.y,90,30*player.dmgMult,true); } player.ghosts.length=0; SFX.play('boom'); } },
      { n:'사자의 군단', lv:25, cd:30, d:'유령 8기 대소환', fx:()=>{ for(let k=0;k<8;k++){ const a=(Math.PI*2/8)*k; player.ghosts.push({x:player.x+Math.cos(a)*50,y:player.y+Math.sin(a)*50,t:10,cd:0}); } addTextNum(player.x,player.y-26,'일어나라!'); SFX.play('warn'); } },
    ],
    bard: [
      { n:'불협화음', lv:3, cd:9, d:'귀를 찢는 음파 넉백', fx:()=>{ for (const e of enemies){ const d2=Math.hypot(e.x-player.x,e.y-player.y); if(d2<180){ const a=Math.atan2(e.y-player.y,e.x-player.x); e.x+=Math.cos(a)*110; e.y+=Math.sin(a)*110; } } skNova(170,20); } },
      { n:'진혼곡', lv:8, cd:20, d:'체력 15% 회복 + 재생 5초', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.15*player.healMult); tbuff('dr',0.85,5); SFX.play('pick'); } },
      { n:'템포 업', lv:15, cd:16, d:'4초간 공속 +30%, 이속 +15%', fx:()=>{ tbuff('rate',1.3,4); tbuff('spd',1.15,4); SFX.play('fever'); } },
      { n:'피날레', lv:25, cd:30, d:'즉시 피버 + 대폭발', fx:()=>{ combo=Math.max(combo,15); feverTimer=6+(player.feverPlus||0); comboTag.style.display='block'; comboTag.classList.add('fever'); skNova(200,40); SFX.play('win'); } },
    ],
    debug: [
      { n:'print()', lv:3, cd:8, d:'전방에 데미지 로그를 출력한다', fx:()=>{ const a=player.facing; for(let k=0;k<5;k++) addHazard(player.x+Math.cos(a)*(60+k*55),player.y+Math.sin(a)*(60+k*55),40,0.1+k*0.08,22*player.dmgMult,true); } },
      { n:'git revert', lv:8, cd:18, d:'체력 20% 복구', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.2*player.healMult); addTextNum(player.x,player.y-26,'reverted'); } },
      { n:'sudo', lv:15, cd:20, d:'4초간 모든 버프 (공속·이속·피해 +20%)', fx:()=>{ tbuff('rate',1.2,4); tbuff('spd',1.2,4); tbuff('dmg',1.2,4); addTextNum(player.x,player.y-26,'#'); } },
      { n:'rm -rf', lv:25, cd:34, d:'보스를 제외한 화면을 청소한다', fx:()=>{ for (let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; if(e.type!=='treasure'){ e.hp-=200*player.dmgMult; addDmgNum(e.x,e.y,200*player.dmgMult,true); if(e.hp<=0) defeatEnemy(i); } } shake=Math.min(24,shake+18); SFX.play('boom'); } },
    ],
    tourist: [
      { n:'셀카', lv:3, cd:14, d:'주변 적 1.5초 정지 + 골드 5', fx:()=>{ for (const e of enemies){ if((e.x-player.x)**2+(e.y-player.y)**2<160*160) e.frozenT=Math.max(e.frozenT||0,1.5); } runGold+=Math.round(5*player.goldMult); addTextNum(player.x,player.y-26,'📸'); SFX.play('tele'); } },
      { n:'간식 타임', lv:8, cd:18, d:'체력 15% 회복', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.15*player.healMult); addTextNum(player.x,player.y-26,'냠냠'); SFX.play('pick'); } },
      { n:'택시!', lv:15, cd:16, d:'대시 즉시 충전 + 3초간 이속 +30%', fx:()=>{ player.dashCd=0; tbuff('spd',1.3,3); addTextNum(player.x,player.y-26,'택시!'); } },
      { n:'환불 요청', lv:25, cd:30, d:'골드 30 소모, 6초간 피해 +40% (진상의 힘)', fx:()=>{ if(runGold>=30){ runGold-=30; tbuff('dmg',1.4,6); addTextNum(player.x,player.y-26,'환불해줘!'); SFX.play('warn'); } else { addTextNum(player.x,player.y-26,'잔액 부족...'); } } },
    ],
    slime: [
      { n:'점액 뿌리기', lv:3, cd:12, d:'주변 적 3초간 감속 60%', fx:()=>{ for (const e of enemies){ if((e.x-player.x)**2+(e.y-player.y)**2<150*150) e.chillS=Math.max(e.chillS||0,3); } addTextNum(player.x,player.y-26,'끈적'); SFX.play('tele'); } },
      { n:'분열', lv:8, cd:20, d:'체력 10% 소모, 4초간 분신처럼 사방 파편 발사', fx:()=>{ player.hp=Math.max(1,player.hp-player.maxHp*0.1); skNova(120, 22); addTextNum(player.x,player.y-26,'뽀잉!'); } },
      { n:'젤리 방패', lv:15, cd:18, d:'4초간 받는 피해 -60%', fx:()=>{ tbuff('dr',0.4,4); addTextNum(player.x,player.y-26,'말랑'); } },
      { n:'폭식', lv:25, cd:32, d:'최대 체력 +10% (영구) + 즉시 20% 회복', fx:()=>{ player.maxHp=Math.round(player.maxHp*1.1); player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.2); addTextNum(player.x,player.y-26,'꿀꺽'); SFX.play('win'); } },
    ],
    gambler: [
      { n:'주사위', lv:3, cd:10, d:'무작위 효과: 폭발/회복/골드/꽝', fx:()=>{ const r=Math.random(); if(r<0.3){ skNova(140,30); addTextNum(player.x,player.y-26,'🎲 폭발!'); } else if(r<0.55){ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.12*player.healMult); addTextNum(player.x,player.y-26,'🎲 회복!'); } else if(r<0.8){ gainGold(15); addTextNum(player.x,player.y-26,'🎲 +15G'); } else { addTextNum(player.x,player.y-26,'🎲 꽝...'); } SFX.play('pick'); } },
      { n:'올인', lv:8, cd:24, d:'골드 20 배팅 — 50% 확률 2배 회수+피해 버프, 실패 시 잃음', fx:()=>{ if(runGold>=20){ runGold-=20; if(Math.random()<0.5){ runGold+=40; tbuff('dmg',1.35,5); addTextNum(player.x,player.y-26,'💰 잭팟!'); SFX.play('win'); } else { addTextNum(player.x,player.y-26,'파산...'); SFX.play('warn'); } } } },
      { n:'속임수', lv:15, cd:16, d:'2초 무적 + 회피 20% (4초)', fx:()=>{ player.invuln=Math.max(player.invuln,2); const o=player.dodge; player.dodge=Math.min(0.7,player.dodge+0.2); setTimeout(()=>{ player.dodge=o; },4000); addTextNum(player.x,player.y-26,'속임수!'); } },
      { n:'룰렛', lv:25, cd:30, d:'화면의 적 절반이 무작위로 즉사 (보스 제외)', fx:()=>{ for (let i=enemies.length-1;i>=0;i--){ if(Math.random()<0.5 && enemies[i].type!=='treasure'){ enemies[i].hp=0; defeatEnemy(i); } } addTextNum(player.x,player.y-26,'러시안 룰렛!'); shake=Math.min(20,shake+10); SFX.play('boom'); } },
    ],
    collector: [
      { n:'감정', lv:3, cd:15, d:'주변에 아이템 1개 드랍', fx:()=>{ dropItem(player.x+40,player.y,null); addTextNum(player.x,player.y-26,'감정 완료'); SFX.play('pick'); } },
      { n:'자석 손', lv:8, cd:14, d:'모든 경험치·아이템 흡인', fx:()=>{ for (const o of orbs) o.magnetized=true; addTextNum(player.x,player.y-26,'자석 손!'); } },
      { n:'보존 처리', lv:15, cd:20, d:'4초간 받는 피해 -50%', fx:()=>{ tbuff('dr',0.5,4); addTextNum(player.x,player.y-26,'보존!'); } },
      { n:'개인 창고', lv:25, cd:36, d:'보물상자 1개 소환', fx:()=>{ dropItem(player.x+50,player.y,'chest'); addTextNum(player.x,player.y-26,'창고 개방!'); SFX.play('chest'); } },
    ],
    stonks: [
      { n:'분할 매수', lv:3, cd:14, d:'골드 10 지불 → 4초간 피해 +25%', fx:()=>{ if(runGold>=10){ runGold-=10; tbuff('dmg',1.25,4); addTextNum(player.x,player.y-26,'매수!'); } } },
      { n:'손절', lv:8, cd:20, d:'체력 12% 회복 (눈물의 손절)', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.12*player.healMult); addTextNum(player.x,player.y-26,'손절...'); SFX.play('pick'); } },
      { n:'공매도', lv:15, cd:22, d:'5초간 적 이속 -25%', fx:()=>{ for (const e of enemies) e.chillS=Math.max(e.chillS||0,2); addTextNum(player.x,player.y-26,'공매도!'); } },
      { n:'떡상 기원', lv:25, cd:32, d:'6초간 시장 사이클 최고점 고정', fx:()=>{ tbuff('dmg',1.5,6); addTextNum(player.x,player.y-26,'📈📈📈'); SFX.play('win'); } },
    ],
    gymbro: [
      { n:'3대 500', lv:3, cd:14, d:'4초간 피해 +25%', fx:()=>{ tbuff('dmg',1.25,4); addTextNum(player.x,player.y-26,'흡!'); } },
      { n:'단백질 보충', lv:8, cd:20, d:'최대체력 +5 (영구) + 10% 회복', fx:()=>{ player.maxHp+=5; player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.1); addTextNum(player.x,player.y-26,'프로틴!'); } },
      { n:'스쿼트 자세', lv:15, cd:18, d:'4초간 받는 피해 -50% (그러나 이속 -30%)', fx:()=>{ tbuff('dr',0.5,4); tbuff('spd',0.7,4); addTextNum(player.x,player.y-26,'풀 스쿼트'); } },
      { n:'펌핑', lv:25, cd:30, d:'6초간 피해·공속 +30%', fx:()=>{ tbuff('dmg',1.3,6); tbuff('rate',1.3,6); addTextNum(player.x,player.y-26,'펌핑 왔다!'); SFX.play('fever'); } },
    ],
    exhero: [
      { n:'용사의 검기', lv:3, cd:12, d:'전방위 검기 (피해 28)', fx:()=>{ skNova(110,28); addTextNum(player.x,player.y-26,'하압!'); } },
      { n:'은퇴 연금', lv:8, cd:24, d:'골드 +20', fx:()=>{ gainGold(20); addTextNum(player.x,player.y-26,'연금 수령'); SFX.play('coin'); } },
      { n:'왕년의 실력', lv:15, cd:20, d:'5초간 피해 +35%', fx:()=>{ tbuff('dmg',1.35,5); addTextNum(player.x,player.y-26,'몸이 기억한다'); } },
      { n:'마왕 참살검', lv:25, cd:34, d:'보스에게 500% 일격', fx:()=>{ for (const b of bosses){ if(!b.ghost){ const d2=100*player.dmgMult*(player.bossDmg||1); b.hp-=d2; addDmgNum(b.x,b.y,d2,true); FX.puff(b.x,b.y,0xb8a03f,30); refreshBossBar(); break; } } SFX.play('boom'); } },
    ],
    shadow: [
      { n:'그림자 송곳', lv:3, cd:11, d:'무피격 시간 비례 피해 폭발', fx:()=>{ skNova(100, 15+Math.min(45,noHitT*5)); addTextNum(player.x,player.y-26,'스윽'); } },
      { n:'은신', lv:8, cd:20, d:'2.5초 무적', fx:()=>{ player.invuln=Math.max(player.invuln,2.5); addTextNum(player.x,player.y-26,'...'); } },
      { n:'그림자 발걸음', lv:15, cd:16, d:'대시 충전 + 3초 이속 +35%', fx:()=>{ player.dashCd=0; tbuff('spd',1.35,3); } },
      { n:'암살 선고', lv:25, cd:30, d:'처형 임계 +12%p (6초)', fx:()=>{ player.execThresh+=0.12; setTimeout(()=>{ player.execThresh=Math.max(0,player.execThresh-0.12); },6000); addTextNum(player.x,player.y-26,'선고'); } },
    ],
    baeksu: [
      { n:'낮잠', lv:3, cd:18, d:'2초 무적 (자는 척)', fx:()=>{ player.invuln=Math.max(player.invuln,2); addTextNum(player.x,player.y-26,'Zzz...'); } },
      { n:'배달 주문', lv:8, cd:22, d:'회복 아이템 1개 배달', fx:()=>{ dropItem(player.x+40,player.y,'heal'); addTextNum(player.x,player.y-26,'주문 완료'); SFX.play('pick'); } },
      { n:'이불 밖은 위험해', lv:15, cd:20, d:'5초간 받는 피해 -50%', fx:()=>{ tbuff('dr',0.5,5); addTextNum(player.x,player.y-26,'이불 소환'); } },
      { n:'재취업 각성', lv:25, cd:30, d:'6초간 피해·공속 +30% (일할 때는 확실하게)', fx:()=>{ tbuff('dmg',1.3,6); tbuff('rate',1.3,6); addTextNum(player.x,player.y-26,'각성!'); SFX.play('fever'); } },
    ],
    blackcat: [
      { n:'할퀴기', lv:3, cd:10, d:'주변 광역 피해', fx:()=>{ skNova(90,22); addTextNum(player.x,player.y-26,'냥!'); } },
      { n:'우다다', lv:8, cd:16, d:'대시 충전 + 3초 이속 +40%', fx:()=>{ player.dashCd=0; tbuff('spd',1.4,3); addTextNum(player.x,player.y-26,'우다다다'); } },
      { n:'골골송', lv:15, cd:20, d:'체력 15% 회복', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.15*player.healMult); addTextNum(player.x,player.y-26,'골골골...'); SFX.play('pick'); } },
      { n:'불길한 예감', lv:25, cd:28, d:'5초간 회피 +25%', fx:()=>{ const o=player.dodge; player.dodge=Math.min(0.75,player.dodge+0.25); setTimeout(()=>{ player.dodge=o; },5000); addTextNum(player.x,player.y-26,'검은 고양이가 지나갔다'); } },
    ],
    contributor: [
      { n:'패치 노트', lv:3, cd:14, d:'무작위 버프 하나 (4초)', fx:()=>{ const r=Math.random(); if(r<0.34) tbuff('dmg',1.3,4); else if(r<0.67) tbuff('rate',1.3,4); else tbuff('dr',0.5,4); addTextNum(player.x,player.y-26,'v1.0.'+((Math.random()*99)|0)); SFX.play('quest'); } },
      { n:'밸런스 패치', lv:8, cd:20, d:'주변 적 피해 -30% 너프 (스탯 반토막 5초)', fx:()=>{ for (const e of enemies){ if((e.x-player.x)**2+(e.y-player.y)**2<180*180){ e.dmg=Math.round(e.dmg*0.7); e.speed*=0.7; } } addTextNum(player.x,player.y-26,'너프!'); SFX.play('warn'); } },
      { n:'롤백', lv:15, cd:22, d:'체력 25% 복구', fx:()=>{ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.25*player.healMult); addTextNum(player.x,player.y-26,'롤백 완료'); SFX.play('pick'); } },
      { n:'서비스 점검', lv:25, cd:34, d:'3초간 전체 정지 + 화면 청소 (보스 제외)', fx:()=>{ for (const e of enemies) e.frozenT=Math.max(e.frozenT||0,3); for (let i=enemies.length-1;i>=0;i--){ if(Math.random()<0.4 && enemies[i].type!=='treasure'){ enemies[i].hp=0; defeatEnemy(i); } } addTextNum(player.x,player.y-26,'점검 중...'); SFX.play('boom'); } },
    ],
    cheolhyeol: [],
  };
  SKILL_POOLS.cheolhyeol = SKILL_POOLS.cheol;
  function tryDashFree(){ const o=player.dashCd; player.dashCd=0; tryDash(); if (player.dashCd>0) player.dashCd=Math.min(player.dashCd,o); }

  // ---------- 전직 (레벨 10: 1차 4택 → 레벨 25: 2차 → 레벨 40: 3차) ----------
  const JOB_TREES = {
    manager:  [ { n:'시스템 설계자', d:'위성 피해 +20%, 쿨다운 -6%', fx:(p)=>{ p.satBoost=(p.satBoost||1)*1.2; p.cdr*=0.94; } },
                { n:'감사관', d:'골드 +20%, 행운 +20%', fx:(p)=>{ p.goldMult*=1.2; p.luck*=1.2; } },
                { n:'보안 책임자', d:'받는 피해 -10%, 방벽 충전 시간 -20%', fx:(p)=>{ p.dmgTaken*=0.9; if(p.shieldCdMax) p.shieldCdMax*=0.8; } },
                { n:'아키텍트', d:'모든 피해 +12%', fx:(p)=>{ p.dmgMult*=1.12; } } ],
    sniper:   [ { n:'헤드헌터', d:'치명 확률 +10%, 배율 +0.3', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.1); p.critMult+=0.3; } },
                { n:'유격수', d:'이동 +10%, 공속 +8%', fx:(p)=>{ p.speed*=1.1; p.rateMult*=1.08; } },
                { n:'중화기병', d:'투사체 피해 +15%, 관통 +1', fx:(p)=>{ p.projMult*=1.15; p.pierce+=1; } },
                { n:'탄도학자', d:'모든 피해 +10%, 관통 +1', fx:(p)=>{ p.dmgMult*=1.1; p.pierce+=1; } } ],
    rusher:   [ { n:'광전사', d:'피해 +15%, 흡혈 +2', fx:(p)=>{ p.dmgMult*=1.15; p.lifesteal+=2; } },
                { n:'선봉장', d:'이동 +12%, 대시 쿨 -15%', fx:(p)=>{ p.speed*=1.12; p.dashCdMax*=0.85; } },
                { n:'수호기사', d:'받는 피해 -12%, 체력 +15%', fx:(p)=>{ p.dmgTaken*=0.88; p.maxHp=Math.round(p.maxHp*1.15); } },
                { n:'결투가', d:'치명 확률 +12%', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.12); } } ],
    archer:   [ { n:'질풍 사수', d:'공속 +12%, 이동 +6%', fx:(p)=>{ p.rateMult*=1.12; p.speed*=1.06; } },
                { n:'명궁', d:'치명 +8%, 관통 +2', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.08); p.pierce+=2; } },
                { n:'사냥주술사', d:'원소 발동 +8%p', fx:(p)=>{ p.procBonus=(p.procBonus||0)+0.08; } },
                { n:'유랑 궁사', d:'이동 +8%, 행운 +25%', fx:(p)=>{ p.speed*=1.08; p.luck*=1.25; } } ],
    ninja:    [ { n:'암살자', d:'치명 +10%, 처형 임계 +5%p', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.1); p.execThresh=Math.min(0.35,p.execThresh+0.05); } },
                { n:'환영술사', d:'회피 +8%, 대시 시 분신', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.08); p.shadowClone=true; } },
                { n:'질주자', d:'대시 쿨 -25%, 이동 +8%', fx:(p)=>{ p.dashCdMax*=0.75; p.speed*=1.08; } },
                { n:'독인', d:'부식 발동 +12%p', fx:(p)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.12); } } ],
    engineer: [ { n:'발명가', d:'드론·터렛 피해 +25%', fx:(p)=>{ p.droneBoost+=0.25; p.turretDmg=(p.turretDmg||10)*1.25; } },
                { n:'금융공학자', d:'골드 +25%, 아이템 드랍 +30%', fx:(p)=>{ p.goldMult*=1.25; p.luck*=1.3; } },
                { n:'뇌격술사', d:'낙뢰 피해 +25%', fx:(p)=>{ p.boltBoost=(p.boltBoost||1)*1.25; } },
                { n:'정비공', d:'쿨다운 -10%, 재생 +0.5', fx:(p)=>{ p.cdr*=0.9; p.regen+=0.5; } } ],
    paladin:  [ { n:'성전사', d:'피해 +15%', fx:(p)=>{ p.dmgMult*=1.15; } },
                { n:'수호성인', d:'받는 피해 -12%, 회복 +20%', fx:(p)=>{ p.dmgTaken*=0.88; p.healMult*=1.2; } },
                { n:'심판관', d:'처형 임계 +8%p, 치명 +6%', fx:(p)=>{ p.execThresh=Math.min(0.35,p.execThresh+0.08); p.critChance=Math.min(0.85,p.critChance+0.06); } },
                { n:'순례자', d:'이동 +10%, 재생 +0.6', fx:(p)=>{ p.speed*=1.1; p.regen+=0.6; } } ],
    reaper:   [ { n:'수확자', d:'처형 임계 +8%p, 낫 피해 +15%', fx:(p)=>{ p.execThresh=Math.min(0.35,p.execThresh+0.08); p.scytheBoost=(p.scytheBoost||1)*1.15; } },
                { n:'원혼술사', d:'처치 시 15% 유령 소환', fx:(p)=>{ p.necroChance=Math.max(p.necroChance,0.15); } },
                { n:'침묵', d:'회피 +10%, 치명 +8%', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.1); p.critChance=Math.min(0.85,p.critChance+0.08); } },
                { n:'재앙', d:'모든 피해 +14%', fx:(p)=>{ p.dmgMult*=1.14; } } ],
    pilot:    [ { n:'에이스', d:'공속 +12%, 드론 +15%', fx:(p)=>{ p.rateMult*=1.12; p.droneBoost+=0.15; } },
                { n:'폭격수', d:'폭발·궁극 피해 +20%', fx:(p)=>{ p.ultDamage=Math.round((p.ultDamage||30)*1.2); p.explodeDmg=(p.explodeDmg||18)*1.2; } },
                { n:'정찰병', d:'이동 +10%, 수집 범위 +40', fx:(p)=>{ p.speed*=1.1; p.magnet+=40; } },
                { n:'군수담당', d:'아이템 드랍 +50%, 골드 +15%', fx:(p)=>{ p.luck*=1.5; p.goldMult*=1.15; } } ],
    glitch:   [ { n:'바이러스', d:'부식 발동 +12%p', fx:(p)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.12); } },
                { n:'오버클럭', d:'공속 +10%, 쿨다운 -8%', fx:(p)=>{ p.rateMult*=1.1; p.cdr*=0.92; } },
                { n:'랜덤 포인터', d:'무작위 스탯 대폭 강화 ×2', fx:(p)=>{ for(let k=0;k<2;k++){ const r=Math.random(); if(r<0.33) p.dmgMult*=1.15; else if(r<0.66) p.rateMult*=1.15; else p.speed*=1.15; } } },
                { n:'세그폴트', d:'피해 +20% / 체력 -10%', fx:(p)=>{ p.dmgMult*=1.2; p.maxHp=Math.round(p.maxHp*0.9); } } ],
    returner: [ { n:'예언자', d:'리롤 +2, 행운 +20%', fx:(p)=>{ rerollsLeft+=2; p.luck*=1.2; } },
                { n:'기록자', d:'경험치 +15%', fx:(p)=>{ p.xpMult=(p.xpMult||1)*1.15; } },
                { n:'시간술사', d:'쿨다운 -12%', fx:(p)=>{ p.cdr*=0.88; } },
                { n:'순환자', d:'재생 +0.8, 회복 +15%', fx:(p)=>{ p.regen+=0.8; p.healMult*=1.15; } } ],
    cheol:    [ { n:'파성퇴', d:'피해 +15%, 낫 피해 +10%', fx:(p)=>{ p.dmgMult*=1.15; p.scytheBoost=(p.scytheBoost||1)*1.1; } },
                { n:'요새', d:'받는 피해 -12%, 체력 +20%', fx:(p)=>{ p.dmgTaken*=0.88; p.maxHp=Math.round(p.maxHp*1.2); } },
                { n:'단조가', d:'모든 피해 +10%, 체력 +10%', fx:(p)=>{ p.dmgMult*=1.1; p.maxHp=Math.round(p.maxHp*1.1); } },
                { n:'전장군주', d:'주변 아군 효과 — 유령·분신·터렛 피해 +30%', fx:(p)=>{ p.ghostDmg=(p.ghostDmg||1)*1.3; p.droneBoost+=0.3; p.turretDmg=(p.turretDmg||10)*1.3; } } ],
    voidc:    [ { n:'심연 대변자', d:'원소 발동 +10%p', fx:(p)=>{ p.procBonus=(p.procBonus||0)+0.10; } },
                { n:'붕괴술사', d:'부식 강화 (중첩당 +22%)', fx:(p)=>{ p.corrodeAmp=Math.max(p.corrodeAmp,0.22); } },
                { n:'허무', d:'쿨다운 -10%, 피해 +8%', fx:(p)=>{ p.cdr*=0.9; p.dmgMult*=1.08; } },
                { n:'별지기', d:'공명 노드당 피해 +0.5% 추가', fx:(p)=>{ p.dmgMult*=1+0.005*resonantCount(p.classKey); } } ],
    necro:    [ { n:'군단장', d:'유령 최대 +2, 유령 피해 +25%', fx:(p)=>{ p.ghostCap+=2; p.ghostDmg=(p.ghostDmg||1)*1.25; } },
                { n:'무덤지기', d:'받는 피해 -10%, 유령 지속 +3초', fx:(p)=>{ p.dmgTaken*=0.9; p.ghostDur=(p.ghostDur||0)+3; } },
                { n:'영매', d:'회복 +25%, 유령 소환 확률 +5%p', fx:(p)=>{ p.healMult*=1.25; p.necroChance+=0.05; } },
                { n:'역병술사', d:'부식 발동 +12%p', fx:(p)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.12); } } ],
    bard:     [ { n:'지휘자', d:'스킬 버프 지속... 피버 +2초', fx:(p)=>{ p.feverPlus=(p.feverPlus||0)+2; } },
                { n:'음유시인', d:'골드 +20%, 행운 +20%', fx:(p)=>{ p.goldMult*=1.2; p.luck*=1.2; } },
                { n:'전쟁고수', d:'피해 +12%, 공속 +8%', fx:(p)=>{ p.dmgMult*=1.12; p.rateMult*=1.08; } },
                { n:'진혼가수', d:'회복 +25%, 재생 +0.6', fx:(p)=>{ p.healMult*=1.25; p.regen+=0.6; } } ],
    madman:   [ { n:'피에 젖은 광인', d:'처치 회복 +2, 피해 +10%', fx:(p)=>{ p.lifesteal+=2; p.dmgMult*=1.1; } },
                { n:'웃는 광인', d:'회피 +10% (예측 불가)', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.1); } },
                { n:'광란의 무희', d:'이속 +12%, 공속 +10%', fx:(p)=>{ p.speed*=1.12; p.rateMult*=1.1; } },
                { n:'고통의 순례자', d:'출혈 완화 (초당 -0.8%→-0.5%)', fx:(p)=>{ p.madmanSlow=true; } } ],
    monk:     [ { n:'일념(一念)', d:'무기 피해 +15%', fx:(p)=>{ p.dmgMult*=1.15; } },
                { n:'철벽 수행', d:'받는 피해 -12%', fx:(p)=>{ p.dmgTaken*=0.88; } },
                { n:'행각승', d:'이속 +12%, 재생 +0.6', fx:(p)=>{ p.speed*=1.12; p.regen+=0.6; } },
                { n:'참선', d:'쿨다운 -12%', fx:(p)=>{ p.cdr*=0.88; } } ],
    commander:[ { n:'전술 지휘관', d:'소환물 피해 +25%', fx:(p)=>{ p.droneBoost+=0.25; p.ghostDmg=(p.ghostDmg||1)*1.25; p.turretDmg=(p.turretDmg||10)*1.25; } },
                { n:'보급 지휘관', d:'골드 +25%, 아이템 +25%', fx:(p)=>{ p.goldMult*=1.25; p.luck*=1.25; } },
                { n:'요새 지휘관', d:'터렛 +1기', fx:(p)=>{ p.turretLv+=1; } },
                { n:'망령 지휘관', d:'유령 소환 +8%p, 유령 +2', fx:(p)=>{ p.necroChance+=0.08; p.ghostCap+=2; } } ],
    tombraider:[{ n:'전문 도굴꾼', d:'행운 +30%', fx:(p)=>{ p.luck*=1.3; } },
                { n:'유물 감식가', d:'상자 결과 상향', fx:(p)=>{ p.chestPlus=true; } },
                { n:'날쌘 손', d:'이속 +12%, 수집 +40', fx:(p)=>{ p.speed*=1.12; p.magnet+=40; } },
                { n:'저주 수집가', d:'피해 +15% / 받는 피해 +6%', fx:(p)=>{ p.dmgMult*=1.15; p.dmgTaken*=1.06; } } ],
    mumyeong: [ { n:'무명의 검', d:'피해 +12%', fx:(p)=>{ p.dmgMult*=1.12; } },
                { n:'무명의 방패', d:'받는 피해 -10%', fx:(p)=>{ p.dmgTaken*=0.9; } },
                { n:'무명의 바람', d:'이속·공속 +8%', fx:(p)=>{ p.speed*=1.08; p.rateMult*=1.08; } },
                { n:'무명의 운', d:'행운 +30%, 리롤 +1', fx:(p)=>{ p.luck*=1.3; rerollsLeft+=1; } } ],
    contributor: [
      { n:'회귀자 최병우', d:'모든 것을 기억한다 — 리롤 +3, 행운 +30%', fx:(p)=>{ rerollsLeft+=3; p.luck*=1.3; } },
      { n:'전생자 최병우', d:'전생의 무공 — 피해 +15%, 치명 +8%', fx:(p)=>{ p.dmgMult*=1.15; p.critChance=Math.min(0.85,p.critChance+0.08); } },
      { n:'빙의자 최병우', d:'악역 영애의 몸에 들어갔다 — 받는 피해 -12%, 골드 +25%', fx:(p)=>{ p.dmgTaken*=0.88; p.goldMult*=1.25; } },
      { n:'SSS급 헌터 최병우', d:'각성 등급 측정 불가 — 공속 +12%, 이동 +10%', fx:(p)=>{ p.rateMult*=1.12; p.speed*=1.1; } } ],
    gambler:  [ { n:'타짜', d:'치명 +10%, 도박 피해 하한 0.8×로 상승', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.1); p.gambleFloor=true; } },
                { n:'카운터', d:'행운 +30%, 리롤 +1', fx:(p)=>{ p.luck*=1.3; rerollsLeft+=1; } },
                { n:'현상금 사냥꾼', d:'골드 +25%, 행운 +15%', fx:(p)=>{ p.goldMult*=1.25; p.luck*=1.15; } },
                { n:'승부사', d:'피해 +18% / 받는 피해 +6%', fx:(p)=>{ p.dmgMult*=1.18; p.dmgTaken*=1.06; } } ],
    collector:[ { n:'감정사', d:'행운 +35%', fx:(p)=>{ p.luck*=1.35; } },
                { n:'골동품상', d:'골드 +25%, 수집 범위 +40', fx:(p)=>{ p.goldMult*=1.25; p.magnet+=40; } },
                { n:'유물 사냥꾼', d:'피해 +12%, 아이템 드랍 +25%', fx:(p)=>{ p.dmgMult*=1.12; p.luck*=1.25; } },
                { n:'큐레이터', d:'받는 피해 -10%, 재생 +0.5', fx:(p)=>{ p.dmgTaken*=0.9; p.regen+=0.5; } } ],
    tourist:  [ { n:'배낭여행자', d:'이동 +12%, 골드 +15%', fx:(p)=>{ p.speed*=1.12; p.goldMult*=1.15; } },
                { n:'사진작가', d:'쿨다운 -12%', fx:(p)=>{ p.cdr*=0.88; } },
                { n:'미식가', d:'회복 +30%, 체력 +10%', fx:(p)=>{ p.healMult*=1.3; p.maxHp=Math.round(p.maxHp*1.1); } },
                { n:'인플루언서', d:'행운 +40%, 아이템 드랍 강화', fx:(p)=>{ p.luck*=1.4; } } ],
    slime:    [ { n:'킹슬라임', d:'체력 +25%, 피해 +10%', fx:(p)=>{ p.maxHp=Math.round(p.maxHp*1.25); p.dmgMult*=1.1; } },
                { n:'산성 슬라임', d:'부식 발동 +12%p', fx:(p)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.12); } },
                { n:'메탈 슬라임', d:'받는 피해 -15% / 이동 -5%', fx:(p)=>{ p.dmgTaken*=0.85; p.speed*=0.95; } },
                { n:'분열 슬라임', d:'처치 시 파편 발사', fx:(p)=>{ p.shatter=true; } } ],
    debug:    [ { n:'백엔드', d:'쿨다운 -12%', fx:(p)=>{ p.cdr*=0.88; } },
                { n:'프론트엔드', d:'공속 +12%', fx:(p)=>{ p.rateMult*=1.12; } },
                { n:'데브옵스', d:'모든 스탯 +6%', fx:(p)=>{ p.dmgMult*=1.06; p.rateMult*=1.06; p.speed*=1.06; p.maxHp=Math.round(p.maxHp*1.06); } },
                { n:'해커', d:'치명 +10%, 행운 +30%', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.1); p.luck*=1.3; } } ],
  };
  JOB_TREES.cheolhyeol = JOB_TREES.cheol;
  const JOB2_OPTIONS = [
    { n:'극의', d:'피해 +15%, 공속 +10%', fx:(p)=>{ p.dmgMult*=1.15; p.rateMult*=1.1; } },
    { n:'수호', d:'체력 +20%, 받는 피해 -8%', fx:(p)=>{ p.maxHp=Math.round(p.maxHp*1.2); p.dmgTaken*=0.92; } },
    { n:'쇄도', d:'공속 +14%, 이동 +10%, 대시 쿨 -12%', fx:(p)=>{ p.rateMult*=1.14; p.speed*=1.1; p.dashCdMax*=0.88; } },
    { n:'탐구', d:'쿨다운 -10%, 행운 +25%, 리롤 +1', fx:(p)=>{ p.cdr*=0.9; p.luck*=1.25; rerollsLeft+=1; } },
  ];
  // v6-1차: 2차 전직 — 직업별 고유 4택 (공용 4택은 폴백)
  const JOB2_BY_CLASS = {
    manager:  [ { n:'총괄 이사', d:'위성 +25%, 쿨다운 -8%', fx:(p)=>{ p.satBoost=(p.satBoost||1)*1.25; p.cdr*=0.92; } },
                { n:'감찰관', d:'엘리트·보스 피해 +12%', fx:(p)=>{ p.eliteDmg*=1.12; p.bossDmg*=1.12; } },
                { n:'전산 총괄', d:'스킬 쿨다운 -15%', fx:(p)=>{ p.cdr*=0.85; } },
                { n:'경영의 신', d:'골드 +30%, 행운 +25%', fx:(p)=>{ p.goldMult*=1.3; p.luck*=1.25; } } ],
    sniper:   [ { n:'원샷원킬', d:'치명 배율 +0.5', fx:(p)=>{ p.critMult+=0.5; } },
                { n:'속사수', d:'공속 +16%', fx:(p)=>{ p.rateMult*=1.16; } },
                { n:'대물 저격수', d:'보스 피해 +15%, 관통 +1', fx:(p)=>{ p.bossDmg*=1.15; p.pierce+=1; } },
                { n:'유령 위장', d:'회피 +10%, 이동 +8%', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.1); p.speed*=1.08; } } ],
    rusher:   [ { n:'혈전사', d:'흡혈 +2, 피해 +10%', fx:(p)=>{ p.lifesteal+=2; p.dmgMult*=1.1; } },
                { n:'철벽 기사', d:'받는 피해 -12%, 체력 +12%', fx:(p)=>{ p.dmgTaken*=0.88; p.maxHp=Math.round(p.maxHp*1.12); } },
                { n:'질풍 창기병', d:'이속 +12%, 대시 폭발 강화', fx:(p)=>{ p.speed*=1.12; p.dashBlast=(p.dashBlast||20)+15; } },
                { n:'검투사', d:'치명 +10%, 처형 임계 +4%p', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.1); p.execThresh=Math.min(0.35,p.execThresh+0.04); } } ],
    archer:   [ { n:'폭풍 궁수', d:'공속 +14%, 화살 +1', fx:(p)=>{ p.rateMult*=1.14; } },
                { n:'관통왕', d:'관통 +2, 투사체 +10%', fx:(p)=>{ p.pierce+=2; p.projMult*=1.1; } },
                { n:'정령 사수', d:'원소 발동 +8%p', fx:(p)=>{ p.procBonus=(p.procBonus||0)+0.08; } },
                { n:'추격자', d:'이동 +10%, 엘리트 피해 +10%', fx:(p)=>{ p.speed*=1.1; p.eliteDmg*=1.1; } } ],
    ninja:    [ { n:'그림자 무희', d:'회피 +10%, 분신 강화', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.1); p.shadowClone=true; } },
                { n:'맹독 인술사', d:'부식 +10%p', fx:(p)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.1); } },
                { n:'섬광', d:'대시 쿨 -20%, 대시 무적 +0.1초', fx:(p)=>{ p.dashCdMax*=0.8; p.dashInvuln+=0.1; } },
                { n:'절명자', d:'치명 +12%, 처형 +4%p', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.12); p.execThresh=Math.min(0.35,p.execThresh+0.04); } } ],
    engineer: [ { n:'수석 개발자', d:'터렛·드론 +25%', fx:(p)=>{ p.droneBoost+=0.25; p.turretDmg=(p.turretDmg||7)*1.25; } },
                { n:'투자의 귀재', d:'골드 +30%', fx:(p)=>{ p.goldMult*=1.3; } },
                { n:'낙뢰 기술자', d:'낙뢰 +25%', fx:(p)=>{ p.boltBoost=(p.boltBoost||1)*1.25; } },
                { n:'오버클러커', d:'쿨다운 -12%, 공속 +8%', fx:(p)=>{ p.cdr*=0.88; p.rateMult*=1.08; } } ],
    paladin:  [ { n:'성기사단장', d:'받는 피해 -12%, 회복 +15%', fx:(p)=>{ p.dmgTaken*=0.88; p.healMult*=1.15; } },
                { n:'퇴마사', d:'악몽·엘리트 피해 +15%', fx:(p)=>{ p.eliteDmg*=1.15; } },
                { n:'빛의 집행자', d:'피해 +14%', fx:(p)=>{ p.dmgMult*=1.14; } },
                { n:'수호천사', d:'재생 +1, 부활 시 체력 +25%p', fx:(p)=>{ p.regen+=1; } } ],
    reaper:   [ { n:'절망의 낫', d:'처형 임계 +6%p, 낫 +12%', fx:(p)=>{ p.execThresh=Math.min(0.4,p.execThresh+0.06); p.scytheBoost=(p.scytheBoost||1)*1.12; } },
                { n:'혼령 인도자', d:'유령 소환 +8%p', fx:(p)=>{ p.necroChance=(p.necroChance||0)+0.08; } },
                { n:'어둠 상인', d:'처치 골드 확률 상승, 골드 +20%', fx:(p)=>{ p.goldMult*=1.2; p.luck*=1.15; } },
                { n:'죽음 그 자체', d:'피해 +15%', fx:(p)=>{ p.dmgMult*=1.15; } } ],
    pilot:    [ { n:'곡예 비행사', d:'회피 +8%, 이속 +10%', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.08); p.speed*=1.1; } },
                { n:'폭장량 증가', d:'궁극·폭발 +18%', fx:(p)=>{ p.ultDamage=Math.round((p.ultDamage||30)*1.18); p.explodeDmg=(p.explodeDmg||18)*1.18; } },
                { n:'드론 군단장', d:'드론 +30%', fx:(p)=>{ p.droneBoost+=0.3; } },
                { n:'보급 전문가', d:'아이템 드랍 +40%', fx:(p)=>{ p.luck*=1.4; } } ],
    glitch:   [ { n:'커널 패닉', d:'무작위 강화 ×3', fx:(p)=>{ for(let k=0;k<3;k++){ const r=Math.random(); if(r<0.33) p.dmgMult*=1.1; else if(r<0.66) p.rateMult*=1.1; else p.maxHp=Math.round(p.maxHp*1.1); } } },
                { n:'제로데이', d:'부식 +10%p', fx:(p)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.1); } },
                { n:'램 오버플로', d:'카드 +1장', fx:(p)=>{ p.cardSlots=(p.cardSlots||6)+1; } },
                { n:'루트킷', d:'피해 +15% / 체력 -8%', fx:(p)=>{ p.dmgMult*=1.15; p.maxHp=Math.round(p.maxHp*0.92); } } ],
    returner: [ { n:'전지자', d:'리롤 +2, 제외 +1', fx:(p)=>{ rerollsLeft+=2; banishLeft+=1; } },
                { n:'가속자', d:'경험치 +20%', fx:(p)=>{ p.xpMult=(p.xpMult||1)*1.2; } },
                { n:'인과 조율자', d:'쿨다운 -12%', fx:(p)=>{ p.cdr*=0.88; } },
                { n:'생존 본능', d:'재생 +0.8, 받는 피해 -6%', fx:(p)=>{ p.regen+=0.8; p.dmgTaken*=0.94; } } ],
    cheol:    [ { n:'파쇄자', d:'피해 +14%, 낫 +10%', fx:(p)=>{ p.dmgMult*=1.14; p.scytheBoost=(p.scytheBoost||1)*1.1; } },
                { n:'불침함', d:'받는 피해 -14%', fx:(p)=>{ p.dmgTaken*=0.86; } },
                { n:'맹장', d:'엘리트·보스 피해 +14%', fx:(p)=>{ p.eliteDmg*=1.14; p.bossDmg*=1.14; } },
                { n:'군단 사령관', d:'유령·터렛·드론 +25%', fx:(p)=>{ p.ghostDmg=(p.ghostDmg||1)*1.25; p.droneBoost+=0.25; p.turretDmg=(p.turretDmg||7)*1.25; } } ],
    voidc:    [ { n:'심연 궁구자', d:'원소 발동 +10%p', fx:(p)=>{ p.procBonus=(p.procBonus||0)+0.10; } },
                { n:'붕괴 가속자', d:'부식 강화', fx:(p)=>{ p.corrodeAmp=Math.max(p.corrodeAmp,0.25); } },
                { n:'별의 대변인', d:'공명 노드당 피해 +0.4%', fx:(p)=>{ p.dmgMult*=1+0.004*resonantCount(p.classKey); } },
                { n:'무의 술사', d:'쿨다운 -10%, 피해 +8%', fx:(p)=>{ p.cdr*=0.9; p.dmgMult*=1.08; } } ],
    necro:    [ { n:'백골 군주', d:'유령 +2, 유령 피해 +20%', fx:(p)=>{ p.ghostCap+=2; p.ghostDmg=(p.ghostDmg||1)*1.2; } },
                { n:'상엿집 주인', d:'유령 지속 +3초, 회복 +15%', fx:(p)=>{ p.ghostDur=(p.ghostDur||0)+3; p.healMult*=1.15; } },
                { n:'원혼 방출자', d:'유령 소환 +8%p', fx:(p)=>{ p.necroChance+=0.08; } },
                { n:'죽음의 설교자', d:'피해 +12%, 처형 +4%p', fx:(p)=>{ p.dmgMult*=1.12; p.execThresh=Math.min(0.35,p.execThresh+0.04); } } ],
    bard:     [ { n:'광란의 지휘자', d:'피버 +3초, 피버 피해 강화', fx:(p)=>{ p.feverPlus=(p.feverPlus||0)+3; p.feverDmg=true; } },
                { n:'순회 공연가', d:'골드 +25%, 이속 +8%', fx:(p)=>{ p.goldMult*=1.25; p.speed*=1.08; } },
                { n:'전장의 북', d:'피해 +10%, 공속 +10%', fx:(p)=>{ p.dmgMult*=1.1; p.rateMult*=1.1; } },
                { n:'치유의 선율', d:'재생 +1, 회복 +20%', fx:(p)=>{ p.regen+=1; p.healMult*=1.2; } } ],
    tourist:  [ { n:'만행 전문가', d:'이속 +12%, 걷기 골드 강화', fx:(p)=>{ p.speed*=1.12; p.goldMult*=1.2; } },
                { n:'사진 명장', d:'쿨다운 -14%', fx:(p)=>{ p.cdr*=0.86; } },
                { n:'호캉스족', d:'체력 +15%, 재생 +0.8', fx:(p)=>{ p.maxHp=Math.round(p.maxHp*1.15); p.regen+=0.8; } },
                { n:'세계 기록가', d:'경험치 +20%, 행운 +20%', fx:(p)=>{ p.xpMult=(p.xpMult||1)*1.2; p.luck*=1.2; } } ],
    slime:    [ { n:'거대화', d:'체력 +20%, 피해 +8%', fx:(p)=>{ p.maxHp=Math.round(p.maxHp*1.2); p.dmgMult*=1.08; } },
                { n:'강산성', d:'부식 +10%p', fx:(p)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.1); } },
                { n:'탄성체', d:'받는 피해 -10%, 회피 +6%', fx:(p)=>{ p.dmgTaken*=0.9; p.dodge=Math.min(0.6,p.dodge+0.06); } },
                { n:'포식자', d:'처치 회복 +1, 회복 +20%', fx:(p)=>{ p.lifesteal+=1; p.healMult*=1.2; } } ],
    debug:    [ { n:'풀스택', d:'모든 스탯 +7%', fx:(p)=>{ p.dmgMult*=1.07; p.rateMult*=1.07; p.speed*=1.07; p.maxHp=Math.round(p.maxHp*1.07); } },
                { n:'QA 마스터', d:'회피 +10% (버그를 피하는 힘)', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.1); } },
                { n:'핫픽스', d:'재생 +1, 쿨다운 -8%', fx:(p)=>{ p.regen+=1; p.cdr*=0.92; } },
                { n:'치트 의심', d:'행운 +40%, 카드 +1장', fx:(p)=>{ p.luck*=1.4; p.cardSlots=(p.cardSlots||6)+1; } } ],
  };
  JOB2_BY_CLASS.cheolhyeol = JOB2_BY_CLASS.cheol;
  // v6-1차 잔여: 3차 전직 직업별 고유 3택 — fx(p, rc) 공명 스케일 (공용 JOB3는 폴백)
  const JOB3_BY_CLASS = {
    manager:  [ { n:'시스템 그 자체', d:'위성·쿨감 극대 + 공명 스케일', fx:(p,rc)=>{ p.satBoost=(p.satBoost||1)*1.4; p.cdr*=0.88-0.002*Math.min(20,rc); } },
                { n:'최종 결재권자', d:'모든 피해 +18% + 공명', fx:(p,rc)=>{ p.dmgMult*=1.18+0.004*rc; } },
                { n:'무정전 시스템', d:'체력 +25%, 방벽 강화', fx:(p,rc)=>{ p.maxHp=Math.round(p.maxHp*1.25); if(p.shieldCdMax) p.shieldCdMax*=0.7; } } ],
    sniper:   [ { n:'신살자(神殺)', d:'보스 피해 +25% + 공명', fx:(p,rc)=>{ p.bossDmg*=1.25+0.004*rc; } },
                { n:'탄도의 종언', d:'치명 배율 +1.0', fx:(p,rc)=>{ p.critMult+=1.0+0.01*Math.min(20,rc); } },
                { n:'바람의 저격수', d:'공속 +15%, 이속 +10% (묵직함 완화)', fx:(p,rc)=>{ p.rateMult*=1.15; p.speed*=1.1; } } ],
    rusher:   [ { n:'전장의 폭군', d:'피해 +22% + 공명', fx:(p,rc)=>{ p.dmgMult*=1.22+0.004*rc; } },
                { n:'불사의 선봉', d:'체력 +30%, 부활 +1', fx:(p,rc)=>{ p.maxHp=Math.round(p.maxHp*1.3); p.reviveLeft+=1; } },
                { n:'폭풍의 인도자', d:'이속 +15%, 대시 쿨 -20%', fx:(p,rc)=>{ p.speed*=1.15; p.dashCdMax*=0.8; } } ],
    archer:   [ { n:'화살비의 주인', d:'공속 +20% + 공명', fx:(p,rc)=>{ p.rateMult*=1.2+0.003*rc; } },
                { n:'별 사수', d:'관통 +3, 투사체 +15%', fx:(p,rc)=>{ p.pierce+=3; p.projMult*=1.15; } },
                { n:'정령왕의 계약자', d:'원소 발동 +12%p', fx:(p,rc)=>{ p.procBonus=(p.procBonus||0)+0.12; } } ],
    ninja:    [ { n:'그림자의 왕', d:'회피 +15%, 분신 강화', fx:(p,rc)=>{ p.dodge=Math.min(0.65,p.dodge+0.15); p.shadowClone=true; } },
                { n:'일섬(一閃)', d:'치명 +15%, 처형 +6%p', fx:(p,rc)=>{ p.critChance=Math.min(0.9,p.critChance+0.15); p.execThresh=Math.min(0.4,p.execThresh+0.06); } },
                { n:'만천화우', d:'피해 +18% + 공명', fx:(p,rc)=>{ p.dmgMult*=1.18+0.004*rc; } } ],
    engineer: [ { n:'특이점 발명가', d:'터렛·드론 +40%', fx:(p,rc)=>{ p.droneBoost+=0.4; p.turretDmg=(p.turretDmg||7)*1.4; } },
                { n:'재벌 총수', d:'골드 +50%, 골드가 곧 힘', fx:(p,rc)=>{ p.goldMult*=1.5; p.goldPower=true; } },
                { n:'뇌신의 대리인', d:'낙뢰 +40% + 공명', fx:(p,rc)=>{ p.boltBoost=(p.boltBoost||1)*(1.4+0.004*rc); } } ],
    paladin:  [ { n:'수호신', d:'받는 피해 -20% + 공명 체력', fx:(p,rc)=>{ p.dmgTaken*=0.8; p.maxHp=Math.round(p.maxHp*(1.1+0.005*rc)); } },
                { n:'천벌 대행자', d:'피해 +20%, 신성 강화', fx:(p,rc)=>{ p.dmgMult*=1.2; p.holyAmp=(p.holyAmp||1)*1.2; } },
                { n:'영생의 성자', d:'재생 +1.5, 회복 +30%', fx:(p,rc)=>{ p.regen+=1.5; p.healMult*=1.3; } } ],
    reaper:   [ { n:'종말', d:'처형 임계 +12%p', fx:(p,rc)=>{ p.execThresh=Math.min(0.45,p.execThresh+0.12); } },
                { n:'명계의 군주', d:'유령 +3, 유령 피해 +40%', fx:(p,rc)=>{ p.ghostCap+=3; p.ghostDmg=(p.ghostDmg||1)*1.4; } },
                { n:'낫의 극의', d:'낫 피해 +30% + 공명', fx:(p,rc)=>{ p.scytheBoost=(p.scytheBoost||1)*(1.3+0.004*rc); } } ],
    pilot:    [ { n:'하늘의 왕', d:'궁극 폭격 +50%', fx:(p,rc)=>{ p.ultDamage=Math.round((p.ultDamage||30)*1.5); } },
                { n:'무한 드론', d:'드론 +50% + 공명', fx:(p,rc)=>{ p.droneBoost+=0.5+0.004*rc; } },
                { n:'음속 돌파', d:'공속 +20%, 이속 +15%', fx:(p,rc)=>{ p.rateMult*=1.2; p.speed*=1.15; } } ],
    glitch:   [ { n:'시스템 붕괴', d:'대혼돈 강화 ×4', fx:(p,rc)=>{ for(let k=0;k<4;k++){ const r=Math.random(); if(r<0.33) p.dmgMult*=1.12; else if(r<0.66) p.rateMult*=1.12; else p.luck*=1.25; } } },
                { n:'관리자 탈취', d:'카드 +2장', fx:(p,rc)=>{ p.cardSlots=(p.cardSlots||6)+2; } },
                { n:'바이러스 창궐', d:'부식 극대화', fx:(p,rc)=>{ p.corrodeChance=Math.min(0.8,p.corrodeChance+0.15); p.corrodeAmp=Math.max(p.corrodeAmp,0.28); } } ],
    returner: [ { n:'운명의 편집자', d:'리롤 +3, 제외 +2, 행운 +30%', fx:(p,rc)=>{ rerollsLeft+=3; banishLeft+=2; p.luck*=1.3; } },
                { n:'무한 회귀', d:'부활 +1, 부활 시 강화', fx:(p,rc)=>{ p.reviveLeft+=1; } },
                { n:'전지(全知)', d:'속성 6계열까지, 경험치 +25%', fx:(p,rc)=>{ p.attrLimit=(p.attrLimit||3)+1; p.xpMult=(p.xpMult||1)*1.25; } } ],
    cheol:    [ { n:'전쟁의 화신', d:'피해 +25% + 공명', fx:(p,rc)=>{ p.dmgMult*=1.25+0.004*rc; } },
                { n:'절대 요새', d:'받는 피해 -18%, 체력 +25%', fx:(p,rc)=>{ p.dmgTaken*=0.82; p.maxHp=Math.round(p.maxHp*1.25); } },
                { n:'만군의 주인', d:'모든 소환물 +40%', fx:(p,rc)=>{ p.ghostDmg=(p.ghostDmg||1)*1.4; p.droneBoost+=0.4; p.turretDmg=(p.turretDmg||7)*1.4; } } ],
    voidc:    [ { n:'심연의 목소리', d:'원소 발동 +15%p', fx:(p,rc)=>{ p.procBonus=(p.procBonus||0)+0.15; } },
                { n:'허무의 정점', d:'피해 +20%, 쿨감 -10% + 공명', fx:(p,rc)=>{ p.dmgMult*=1.2+0.004*rc; p.cdr*=0.9; } },
                { n:'별의 붕괴자', d:'부식·용해 극대', fx:(p,rc)=>{ p.corrodeAmp=Math.max(p.corrodeAmp,0.32); p.dissolveDps=(p.dissolveDps||3)*1.6; } } ],
    necro:    [ { n:'사자(死者)의 왕', d:'유령 +4, 유령 피해 +50%', fx:(p,rc)=>{ p.ghostCap+=4; p.ghostDmg=(p.ghostDmg||1)*1.5; } },
                { n:'영원한 목자', d:'유령 지속 +5초, 소멸 시 치유', fx:(p,rc)=>{ p.ghostDur=(p.ghostDur||0)+5; p.ghostHeal=true; } },
                { n:'죽음의 설계자', d:'피해 +18% + 공명', fx:(p,rc)=>{ p.dmgMult*=1.18+0.004*rc; } } ],
    bard:     [ { n:'불멸의 디바', d:'피버 +5초, 피버 강화', fx:(p,rc)=>{ p.feverPlus=(p.feverPlus||0)+5; p.feverDmg=true; } },
                { n:'전설의 지휘자', d:'피해·공속 +14% + 공명', fx:(p,rc)=>{ p.dmgMult*=1.14+0.004*rc; p.rateMult*=1.14; } },
                { n:'생명의 노래', d:'재생 +1.5, 회복 +35%', fx:(p,rc)=>{ p.regen+=1.5; p.healMult*=1.35; } } ],
    tourist:  [ { n:'전설의 방랑자', d:'이속 +20%, 골드 +40%', fx:(p,rc)=>{ p.speed*=1.2; p.goldMult*=1.4; } },
                { n:'인생샷 장인', d:'쿨다운 -18%', fx:(p,rc)=>{ p.cdr*=0.82; } },
                { n:'만수르 여행객', d:'행운 +70% + 공명', fx:(p,rc)=>{ p.luck*=1.7+0.005*rc; } } ],
    slime:    [ { n:'태초의 슬라임', d:'체력 +50%, 체력 비례 피해', fx:(p,rc)=>{ p.maxHp=Math.round(p.maxHp*1.5); p.dmgMult*=1+p.maxHp*0.0006; } },
                { n:'융해왕', d:'부식 극대', fx:(p,rc)=>{ p.corrodeChance=Math.min(0.8,p.corrodeChance+0.15); p.corrodeAmp=Math.max(p.corrodeAmp,0.3); } },
                { n:'불멸의 젤리', d:'재생 +2.5, 받는 피해 -12%', fx:(p,rc)=>{ p.regen+=2.5; p.dmgTaken*=0.88; } } ],
    debug:    [ { n:'신의 손', d:'모든 스탯 +12%', fx:(p,rc)=>{ p.dmgMult*=1.12; p.rateMult*=1.12; p.speed*=1.12; p.maxHp=Math.round(p.maxHp*1.12); } },
                { n:'무결성 증명', d:'회피 +15%, 받는 피해 -10%', fx:(p,rc)=>{ p.dodge=Math.min(0.65,p.dodge+0.15); p.dmgTaken*=0.9; } },
                { n:'전설의 개발자', d:'카드 +2장, 행운 +40%', fx:(p,rc)=>{ p.cardSlots=(p.cardSlots||6)+2; p.luck*=1.4; } } ],
  };
  JOB3_BY_CLASS.cheolhyeol = JOB3_BY_CLASS.cheol;
  const JOB3_OPTIONS = [
    { n:'초월', d:'모든 스탯 +10% + 공명 노드당 +0.5%', fx:(p,rc)=>{
      const m = 1.10 + 0.005*rc;
      p.dmgMult*=m; p.rateMult*=1.1; p.speed*=1.08;
      p.maxHp=Math.round(p.maxHp*1.1); p.hp=Math.min(p.maxHp,p.hp+p.maxHp*0.1);
    } },
    { n:'멸살', d:'피해 +22% + 엘리트·보스 피해 +10% + 공명 노드당 +0.4%', fx:(p,rc)=>{
      p.dmgMult*=1.22+0.004*rc; p.eliteDmg*=1.1; p.bossDmg*=1.1;
    } },
    { n:'불멸', d:'체력 +25%, 받는 피해 -12%, 재생 +1 + 공명 노드당 체력 +0.5%', fx:(p,rc)=>{
      p.maxHp=Math.round(p.maxHp*(1.25+0.005*rc)); p.dmgTaken*=0.88; p.regen+=1; p.hp=Math.min(p.maxHp,p.hp+p.maxHp*0.15);
    } },
  ];
  // 소성단 진화: 직업 전용 별을 찍어뒀다면, 이 런의 전직·각성 순간마다 그 별이 한 단계 진화한다
  function evolveClassStar(stage){
    if (!player) return;
    const nid = 'cs_'+player.classKey+'_n';
    if (!starAllocated(nid)) return;
    const nd = STAR_NODES[nid];
    player.csEvo = (player.csEvo||0)+1;
    const roman = ['','Ⅱ','Ⅲ','Ⅳ','✦'][Math.min(player.csEvo,4)];
    // 승천 키스톤 심화: 2차 전직(또는 그 이후 첫 진화)에 한 번 개방
    if (stage>=2 && player.csDeep && player.csDeep.length && !player.csDeepDone){
      player.csDeepDone = true;
      for (const df of player.csDeep) df(player);
      toast('🌠 승천 키스톤 심화 개방 ×'+player.csDeep.length+' — 별의 이면이 드러난다');
    }
    if (stage>=4){
      player.dmgMult *= 1.10; player.dmgTaken *= 0.94;
      player.maxHp = Math.round(player.maxHp*1.06); player.hp = Math.min(player.maxHp, player.hp+20);
      toast('🌌 소성단 대공명 — ['+nd.name+' '+roman+'] 피해 +10%, 받는 피해 -6%, 체력 +6%');
    } else {
      player.dmgMult *= 1.05;
      player.maxHp = Math.round(player.maxHp*1.04); player.hp = Math.min(player.maxHp, player.hp+10);
      toast('⭐ 소성단 진화 — ['+nd.name+' '+roman+'] 피해 +5%, 체력 +4%');
    }
    effects.push({ type:'rays', x:player.x, y:player.y, life:0.7, age:0 });
    SFX.play('evolve');
  }
  function openJobChoice(tier){
    if (tier===1){
      const list = JOB_TREES[player.classKey] || JOB_TREES.manager;
      // 성도 공명 연동: 공명 노드 10개 이상이면 전직이 '공명 강화'로 진화 (같은 전직도 성도에 따라 달라진다)
      const rc = resonantCount(player.classKey);
      const resonant = rc >= 10;
      const opts = list.map((j, ji)=>({
        l:'전직: '+(resonant?'✦ ':'')+j.n,
        d:j.d + (resonant ? ' — 공명 강화: 추가 피해 +'+(rc*0.4).toFixed(0)+'%' : ''),
        fx:()=>{
          j.fx(player); player.jobs.push(j.n);
          (player.jobPicks=player.jobPicks||[])[0]={n:j.n, v:ji}; // 전직 선택지별 전용 가지 개방
          wayStarResonate(1, ji);
          if (resonant){ player.dmgMult *= 1 + 0.004*rc; }
          evolveClassStar(1);
          setTimeout(()=>toast('🌌 승천반 개방 — J 키(전장에서)로 성반을 열어 승천석을 사용하라'), 900);
          toast('1차 전직 — '+j.n+'!'+(resonant?' (성도 공명 ×'+rc+')':''));
          effects.push({ type:'rays', x:player.x, y:player.y, life:0.7, age:0 });
          SFX.play('win');
        }
      }));
      openEvent({ t:'1차 전직'+(resonant?' — 성도가 공명한다':''), d:'길이 갈라진다. 이 런에서 걸어갈 길을 선택하세요.', opts });
    } else if (tier===2){
      const base = player.jobs[0] || '';
      const list2 = JOB2_BY_CLASS[player.classKey] || JOB2_OPTIONS;
      const opts = list2.map((j, ji)=>({ l:'2차 전직: '+j.n, d:j.d + (base?' — ['+base+']의 길이 깊어진다':''), fx:()=>{
        j.fx(player); player.jobs.push(j.n);
        (player.jobPicks=player.jobPicks||[])[1]={n:j.n, v:ji};
        wayStarResonate(2, ji);
        evolveClassStar(2);
        // 계승 공명: 승천반에 4석 이상 투자했다면 전직이 성반과 공명 — 투자한 길이 전직으로 이어진다
        const ascInv2 = (player.ascTaken||[]).reduce((s,v)=>s+v,0);
        if (ascInv2>=4){ player.dmgMult*=1.04; player.maxHp=Math.round(player.maxHp*1.03); toast('✦ 계승 공명 — 성반이 전직에 응답한다 (피해 +4%, 체력 +3%)'); }
        toast('2차 전직 — '+j.n+'!');
        SFX.play('win');
      } }));
      openEvent({ t:'2차 전직 — '+CLASSES[player.classKey].name+'의 길', d:'직업 고유의 심화 경로 중 하나를 선택하세요.', opts });
    } else {
      const rc = resonantCount(player.classKey);
      const list3 = JOB3_BY_CLASS[player.classKey] || JOB3_OPTIONS;
      const opts = list3.map((j, ji)=>({ l:'3차 전직: '+j.n, d:j.d, fx:()=>{
        j.fx(player, rc);
        player.jobs.push(j.n);
        (player.jobPicks=player.jobPicks||[])[2]={n:j.n, v:ji};
        wayStarResonate(3, ji);
        evolveClassStar(3);
        const ascInv3 = (player.ascTaken||[]).reduce((s,v)=>s+v,0) + (player.ascTaken2||[]).reduce((s,v)=>s+v,0);
        if (ascInv3>=8){ player.dmgMult*=1.06; player.dmgTaken*=0.96; toast('✦ 대계승 공명 — 성반의 모든 별이 정점에 응답한다 (피해 +6%, 받는 피해 -4%)'); }
        toast('3차 전직 — '+j.n+'! (공명 ×'+rc+')');
        freeze=Math.max(freeze,0.25);
        SFX.play('win');
      } }));
      openEvent({ t:'3차 전직 — '+CLASSES[player.classKey].name+'의 정점', d:'모든 길의 끝. 존재가 한 단계 올라선다.', opts });
    }
  }

  // ---------- 각성 (레벨 20) — 전 직업 고유 경로 ----------
  const AWAKEN_BY_CLASS = {
    manager:  [ { n:'중앙 통제', d:'위성 피해 +30%, 쿨다운 -10%', fx:(p)=>{ p.satBoost=(p.satBoost||1)*1.3; p.cdr*=0.9; } },
                { n:'무결성', d:'받는 피해 -15%, 방벽 즉시 충전', fx:(p)=>{ p.dmgTaken*=0.85; p.shieldReady=true; if(!p.shieldCdMax) p.shieldCdMax=12; } } ],
    sniper:   [ { n:'일격의 화신', d:'치명 배율 +0.8', fx:(p)=>{ p.critMult+=0.8; } },
                { n:'유령 사수', d:'회피 +12%, 공속 +10%', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.12); p.rateMult*=1.1; } } ],
    rusher:   [ { n:'전신(戰神)', d:'피해 +25% / 받는 피해 +8%', fx:(p)=>{ p.dmgMult*=1.25; p.dmgTaken*=1.08; } },
                { n:'불사조', d:'부활 +1, 흡혈 +2', fx:(p)=>{ p.reviveLeft+=1; p.lifesteal+=2; } } ],
    archer:   [ { n:'바람의 사도', d:'공속 +20%, 이동 +10%', fx:(p)=>{ p.rateMult*=1.2; p.speed*=1.1; } },
                { n:'별을 쏘는 자', d:'관통 +3, 투사체 피해 +12%', fx:(p)=>{ p.pierce+=3; p.projMult*=1.12; } } ],
    ninja:    [ { n:'그림자 그 자체', d:'회피 +15%, 대시 무적 +0.2초', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.15); p.dashInvuln+=0.2; } },
                { n:'필살의 인', d:'치명 +15%, 처형 임계 +6%p', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.15); p.execThresh=Math.min(0.35,p.execThresh+0.06); } } ],
    engineer: [ { n:'수석 엔지니어', d:'터렛 +1기, 드론 피해 +30%', fx:(p)=>{ p.turretLv=(p.turretLv||0)+1; if(!p.turretDmg) p.turretDmg=12; p.droneBoost+=0.3; } },
                { n:'대부호', d:'골드 +40%, 골드가 곧 힘 (황금 혈맥)', fx:(p)=>{ p.goldMult*=1.4; p.goldPower=true; } } ],
    paladin:  [ { n:'대천사의 가호', d:'받는 피해 -18%, 회복 +25%', fx:(p)=>{ p.dmgTaken*=0.82; p.healMult*=1.25; } },
                { n:'응징의 빛', d:'피해 +18%, 피격 시 신성 폭발', fx:(p)=>{ p.dmgMult*=1.18; p.holyRet=true; } } ],
    reaper:   [ { n:'죽음의 군주', d:'처형 임계 +10%p', fx:(p)=>{ p.execThresh=Math.min(0.4,p.execThresh+0.10); } },
                { n:'망령왕', d:'유령 소환 +10%p, 유령 피해 +40%', fx:(p)=>{ p.necroChance=(p.necroChance||0)+0.10; p.ghostDmg=(p.ghostDmg||1)*1.4; } } ],
    pilot:    [ { n:'하늘의 지배자', d:'궁극 폭격 강화 +40%', fx:(p)=>{ p.ultDamage=Math.round((p.ultDamage||35)*1.4); } },
                { n:'풀 스로틀', d:'공속 +18%, 이동 +12%', fx:(p)=>{ p.rateMult*=1.18; p.speed*=1.12; } } ],
    glitch:   [ { n:'메모리 누수', d:'매우 무작위한 대폭 강화', fx:(p)=>{ for(let k=0;k<3;k++){ const r=Math.random(); if(r<0.25) p.dmgMult*=1.12; else if(r<0.5) p.rateMult*=1.12; else if(r<0.75) p.maxHp=Math.round(p.maxHp*1.12); else p.luck*=1.3; } } },
                { n:'무한 루프', d:'스킬 쿨다운 -20%', fx:(p)=>{ p.cdr*=0.8; } } ],
    returner: [ { n:'모든 것을 본 자', d:'속성 5계열까지 선택 가능', fx:(p)=>{ p.attrLimit=(p.attrLimit||3)+1; } },
                { n:'되감기', d:'부활 +1', fx:(p)=>{ p.reviveLeft+=1; } } ],
    cheol:    [ { n:'강철의 화신', d:'받는 피해 -20%', fx:(p)=>{ p.dmgTaken*=0.8; } },
                { n:'전쟁 기계', d:'피해 +22%, 낫·역장 +15%', fx:(p)=>{ p.dmgMult*=1.22; p.scytheBoost=(p.scytheBoost||1)*1.15; p.auraBoost=(p.auraBoost||1)*1.15; } } ],
    voidc:    [ { n:'공허와의 계약', d:'원소 발동 +12%p', fx:(p)=>{ p.procBonus=(p.procBonus||0)+0.12; } },
                { n:'경계의 붕괴', d:'피해 +20%, 쿨다운 -8%', fx:(p)=>{ p.dmgMult*=1.2; p.cdr*=0.92; } } ],
    necro:    [ { n:'사령제왕', d:'유령 최대 +3, 피해 +30%', fx:(p)=>{ p.ghostCap+=3; p.ghostDmg=(p.ghostDmg||1)*1.3; } },
                { n:'윤회의 목자', d:'유령이 죽을 때 치유', fx:(p)=>{ p.ghostHeal=true; } } ],
    bard:     [ { n:'영웅서사시', d:'피버 지속 +4초, 피버 피해 +25%', fx:(p)=>{ p.feverPlus=(p.feverPlus||0)+4; p.feverDmg=true; } },
                { n:'세이렌', d:'적 이속 -10%, 골드 +25%', fx:(p)=>{ p.slowAll*=0.9; p.goldMult*=1.25; } } ],
    madman:   [ { n:'각성한 광기', d:'피해 +20%, 출혈 가속 (사냥 압박↑)', fx:(p)=>{ p.dmgMult*=1.2; } },
                { n:'고요한 광기', d:'출혈 절반, 받는 피해 -10%', fx:(p)=>{ p.madmanSlow=true; p.dmgTaken*=0.9; } } ],
    monk:     [ { n:'해탈', d:'무기 피해 +25%, 쿨다운 -10%', fx:(p)=>{ p.dmgMult*=1.25; p.cdr*=0.9; } },
                { n:'금강불괴', d:'받는 피해 -15%, 체력 +20%', fx:(p)=>{ p.dmgTaken*=0.85; p.maxHp=Math.round(p.maxHp*1.2); } } ],
    commander:[ { n:'대원수', d:'모든 소환물 +40%', fx:(p)=>{ p.droneBoost+=0.4; p.ghostDmg=(p.ghostDmg||1)*1.4; p.turretDmg=(p.turretDmg||10)*1.4; } },
                { n:'불사의 군단', d:'유령 지속 +4초, 소멸 시 치유', fx:(p)=>{ p.ghostDur=(p.ghostDur||0)+4; p.ghostHeal=true; } } ],
    tombraider:[{ n:'왕묘의 주인', d:'행운 +50%, 상자 결과 상향', fx:(p)=>{ p.luck*=1.5; p.chestPlus=true; } },
                { n:'그림자 손', d:'회피 +12%, 이속 +10%', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.12); p.speed*=1.1; } } ],
    mumyeong: [ { n:'무명 초월', d:'모든 스탯 +10%', fx:(p)=>{ p.dmgMult*=1.1; p.rateMult*=1.1; p.speed*=1.1; p.maxHp=Math.round(p.maxHp*1.1); } },
                { n:'이름을 얻은 자', d:'스킬 쿨다운 -15%', fx:(p)=>{ p.cdr*=0.85; } } ],
    contributor: [
      { n:'천마 최병우', d:'무림 최강 — 피해 +22%, 처형 임계 +6%p', fx:(p)=>{ p.dmgMult*=1.22; p.execThresh=Math.min(0.4,p.execThresh+0.06); } },
      { n:'만렙 최병우', d:'렙업이 남들과 다르다 — 경험치 +30%, 카드 +1장', fx:(p)=>{ p.xpMult=(p.xpMult||1)*1.3; p.cardSlots=(p.cardSlots||6)+1; } } ],
    gambler:  [ { n:'운명 조작', d:'도박 피해 상한 3×로 상승, 행운 +40%', fx:(p)=>{ p.gambleCeil=true; p.luck*=1.4; } },
                { n:'하우스 에지', d:'골드 +35%, 골드가 곧 힘 (황금 혈맥)', fx:(p)=>{ p.goldMult*=1.35; p.goldPower=true; } } ],
    collector:[ { n:'완벽한 소장품', d:'모든 스탯 +8%, 행운 +30%', fx:(p)=>{ p.dmgMult*=1.08; p.rateMult*=1.08; p.speed*=1.08; p.maxHp=Math.round(p.maxHp*1.08); p.luck*=1.3; } },
                { n:'박물관장', d:'상자 소환 궁극 강화, 아이템 드랍 +50%', fx:(p)=>{ p.ultVolleyCount=(p.ultVolleyCount||8)+4; p.luck*=1.5; } } ],
    tourist:  [ { n:'세계일주자', d:'이동 +18%, 골드 +30%', fx:(p)=>{ p.speed*=1.18; p.goldMult*=1.3; } },
                { n:'전설의 리뷰어', d:'행운 +60%', fx:(p)=>{ p.luck*=1.6; } } ],
    slime:    [ { n:'슬라임 황제', d:'체력 +40%, 체력 비례 피해', fx:(p)=>{ p.maxHp=Math.round(p.maxHp*1.4); p.dmgMult*=1+p.maxHp*0.0008; } },
                { n:'불멸의 점액', d:'재생 +2, 받는 피해 -10%', fx:(p)=>{ p.regen+=2; p.dmgTaken*=0.9; } } ],
    debug:    [ { n:'루트 어드민', d:'모든 스탯 +10%', fx:(p)=>{ p.dmgMult*=1.1; p.rateMult*=1.1; p.speed*=1.1; p.maxHp=Math.round(p.maxHp*1.1); } },
                { n:'열람자', d:'카드 +2장 표시', fx:(p)=>{ p.cardSlots=(p.cardSlots||6)+2; } } ],
  };
  AWAKEN_BY_CLASS.cheolhyeol = AWAKEN_BY_CLASS.cheol;
  const AWAKENINGS = {
    war: [
      { n:'파괴자', d:'모든 피해 +20% / 받는 피해 +10%', fx:(p)=>{ p.dmgMult*=1.2; p.dmgTaken*=1.1; } },
      { n:'불괴',   d:'받는 피해 -15%, 최대체력 +15%', fx:(p)=>{ p.dmgTaken*=0.85; p.maxHp=Math.round(p.maxHp*1.15); p.hp=Math.min(p.maxHp,p.hp+p.maxHp*0.15); } },
    ],
    rng: [
      { n:'질풍', d:'공격속도 +18%, 이동속도 +10%', fx:(p)=>{ p.rateMult*=1.18; p.speed*=1.1; } },
      { n:'매의 혼', d:'치명 확률 +12%, 치명 배율 +0.4', fx:(p)=>{ p.critChance=Math.min(0.85,p.critChance+0.12); p.critMult+=0.4; } },
    ],
    mag: [
      { n:'대현자', d:'쿨다운 -15%, 원소 발동 +8%p', fx:(p)=>{ p.cdr*=0.85; p.procBonus=(p.procBonus||0)+0.08; } },
      { n:'폭주 마력', d:'모든 피해 +25% / 쿨다운 +10%', fx:(p)=>{ p.dmgMult*=1.25; p.cdr*=1.1; } },
    ],
    rog: [
      { n:'그림자 군주', d:'회피 +10%, 대시 쿨 -20%', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.1); p.dashCdMax*=0.8; } },
      { n:'맹독왕', d:'원소 발동 +10%p, 부식 효과 강화', fx:(p)=>{ p.procBonus=(p.procBonus||0)+0.10; p.corrodeAmp=Math.max(p.corrodeAmp,0.22); } },
    ],
    pri: [
      { n:'대사제', d:'회복 +30%, 재생 +1', fx:(p)=>{ p.healMult*=1.3; p.regen+=1; } },
      { n:'심판자', d:'모든 피해 +15%, 받는 피해 -8%', fx:(p)=>{ p.dmgMult*=1.15; p.dmgTaken*=0.92; } },
    ],
    mer: [
      { n:'재벌', d:'골드 +35%, 행운 +25%', fx:(p)=>{ p.goldMult*=1.35; p.luck*=1.25; } },
      { n:'투기꾼', d:'카드 상위 등급 확률 +50%', fx:(p)=>{ p.luck*=1.5; } },
    ],
  };
  const AWAKEN_COMMON = [
    { n:'초월', d:'피해·공속·이속·체력 +8%', fx:(p)=>{ p.dmgMult*=1.08; p.rateMult*=1.08; p.speed*=1.08; p.maxHp=Math.round(p.maxHp*1.08); } },
    { n:'탐욕', d:'골드·경험치 +20%', fx:(p)=>{ p.goldMult*=1.2; p.xpMult=(p.xpMult||1)*1.2; } },
    { n:'폭주', d:'피해 +20% / 받는 피해 +8%', fx:(p)=>{ p.dmgMult*=1.2; p.dmgTaken*=1.08; } },
    { n:'현자', d:'쿨다운 -12%, 리롤 +2', fx:(p)=>{ p.cdr*=0.88; rerollsLeft+=2; } },
  ];
  function classResGroup(classKey){
    for (const g in RESONANCE) if (RESONANCE[g].includes(classKey)) return g==='mag2'?'mag':g; // 지휘관(mag2)도 마법군 성단에 공명
    return 'war';
  }
  function openAwakening(){
    const g = classResGroup(player.classKey);
    // 직업별 고유 각성 2 + 공용 2 (고유가 없으면 공명군 각성으로 폴백)
    const own = AWAKEN_BY_CLASS[player.classKey] || AWAKENINGS[g] || AWAKENINGS.war;
    const list = own.concat(AWAKEN_COMMON);
    const rc = resonantCount(player.classKey);
    const opts = list.map(a=>({ l:'각성: '+a.n, d:a.d + (rc>0 ? ' — 공명 증폭 +'+(rc*0.5).toFixed(1)+'%' : ''), fx:()=>{
      a.fx(player);
      // 성도 공명 연동: 공명 노드가 많을수록 각성이 강해진다
      if (rc>0) player.dmgMult *= 1 + 0.005*rc;
      player.awakening = a.n;
      evolveClassStar(4);
      toast('각성 — '+a.n+'!'+(rc>0?' (공명 ×'+rc+')':''));
      effects.push({ type:'rays', x:player.x, y:player.y, life:0.8, age:0 });
      freeze = Math.max(freeze, 0.2);
      SFX.play('win');
    } }));
    openEvent({ t:'각성의 순간', d:'한계를 넘어선다. 이 런에서 각성 경로를 하나 선택하세요.', opts });
  }

  // ---------- weapons (8) ----------
  const MAX_WEAPONS = 4;
  const WEAPONS = {
    missile: {
      name:'추적 탄환', desc:'가장 가까운 적을 향해 자동 사격',
      evName:'유도 미사일', evDesc:'적을 스스로 쫓는 유도탄을 연발합니다',
      lvDesc:['','발사 수 +1','피해 +40%','발사 수 +1','피해 강화 + 발사간격 감소'],
      baseCd:(w)=> w.evolved ? 0.5 : (w.lv>=5 ? 0.62 : 0.75),
      dmg:(w)=> (w.evolved ? 26 : [10,10,14,14,19][w.lv-1]),
      count:(w)=> (w.evolved ? 4 : 1 + (w.lv>=2?1:0) + (w.lv>=4?1:0))
    },
    satellite: {
      name:'위성', desc:'주위를 도는 위성이 부딪히는 적을 타격',
      evName:'궤도 레이저', evDesc:'위성 4기 + 궤도 링 전체가 레이저가 됩니다',
      lvDesc:['','위성 +1','타격 피해 +45%','위성 +1','타격 피해 강화'],
      dmg:(w)=> (w.evolved ? 34 : [14,14,19,19,25][w.lv-1]),
      count:(w)=> (w.evolved ? 4 : 1 + (w.lv>=2?1:0) + (w.lv>=4?1:0)),
      orbitR:(w)=> (w.evolved ? 62 : 48),
      spin:(w)=> (w.evolved ? 4.2 : 3.2)
    },
    arrow: {
      name:'화살', desc:'전방 부채꼴로 관통 화살을 발사',
      evName:'화살폭풍', evDesc:'앞뒤로 화살을 퍼붓고 관통이 대폭 늘어납니다',
      lvDesc:['','화살 +1','피해 +40%','화살 +1','화살 +1, 피해 강화'],
      baseCd:(w)=> w.evolved ? 0.85 : 1.1,
      dmg:(w)=> (w.evolved ? 18 : [8,8,11,11,14][w.lv-1]),
      count:(w)=> (w.evolved ? 6 : 2 + (w.lv>=2?1:0) + (w.lv>=4?1:0) + (w.lv>=5?1:0))
    },
    lightning: {
      name:'낙뢰', desc:'무작위 적에게 번개가 내리칩니다',
      evName:'연쇄 뇌격', evDesc:'번개가 근처 적에게 연쇄로 튑니다',
      lvDesc:['','낙뢰 +1','피해 +40%','낙뢰 +1','낙뢰 +1, 피해 강화'],
      baseCd:(w)=> w.evolved ? 1.3 : 1.6,
      dmg:(w)=> (w.evolved ? 38 : [16,16,22,22,30][w.lv-1]),
      count:(w)=> (w.evolved ? 5 : 1 + (w.lv>=2?1:0) + (w.lv>=4?1:0) + (w.lv>=5?1:0))
    },
    aura: {
      name:'역장', desc:'주변에 지속 피해 + 감속 필드를 펼칩니다',
      evName:'성역', evDesc:'필드가 커지고, 적이 안에 있으면 체력이 회복됩니다',
      lvDesc:['','범위 확장','초당 피해 증가','범위 확장','초당 피해 강화'],
      radius:(w)=> (w.evolved ? 108 : [55,63,71,79,88][w.lv-1]),
      dps:(w)=> (w.evolved ? 36 : [12,15,18,22,27][w.lv-1]),
      slow:(w)=> (w.evolved ? 0.55 : 0.75)
    },
    shuriken: {
      name:'수리검', desc:'날아갔다 돌아오는 관통 수리검을 던집니다',
      evName:'풍마 수리검', evDesc:'거대 수리검 3개가 적진을 왕복합니다',
      lvDesc:['','피해 증가','수리검 +1','피해 증가','수리검 +1'],
      baseCd:(w)=> w.evolved ? 1.1 : 1.4,
      dmg:(w)=> (w.evolved ? 26 : [12,15,15,19,19][w.lv-1]),
      count:(w)=> (w.evolved ? 3 : 1 + (w.lv>=3?1:0) + (w.lv>=5?1:0)),
      size:(w)=> (w.evolved ? 12 : 7)
    },
    scythe: {
      name:'낫', desc:'전방을 크게 베어 부채꼴 범위를 타격',
      evName:'사신의 원무', evDesc:'낫이 360도로 회전하며 모든 방향을 벱니다',
      lvDesc:['','범위 확장','피해 +35%','범위 확장','피해 강화'],
      baseCd:(w)=> w.evolved ? 1.05 : 1.3,
      dmg:(w)=> (w.evolved ? 34 : [14,14,19,19,25][w.lv-1]),
      radius:(w)=> (w.evolved ? 120 : [72,82,82,94,94][w.lv-1]),
      arc:(w)=> (w.evolved ? Math.PI*2 : 1.9)
    },
    gbow: {
      name:'침묵하는 활', desc:'[유일] 전장을 꿰뚫는 장궁 — 보스의 정수로 성장',
      evName:'침묵하는 활·만개', evDesc:'시위가 스스로 노래하기 시작합니다',
      lvDesc:['','피해 강화','피해 +25%','관통 강화','피해 강화'],
      baseCd:(w)=> w.evolved ? 0.95 : 1.2,
      dmg:(w)=>{
        const gl = gwepEffLv(DB.gweps.bow.lv||1);
        const g = 2 + gl*1.4;
        const tier = gl>=30?1.4 : gl>=15?1.2 : 1; // 각성/진각성
        return g * [1,1.25,1.55,1.9,2.3][w.lv-1] * tier * (w.evolved?1.5:1);
      },
      count:(w)=> 1 + (DB.gweps.bow.lv>=20?1:0) + (w.evolved?1:0)
    },
    gtome: {
      name:'굶주린 마도서', desc:'[유일] 스스로 사냥하는 마탄 — 별의 조각으로 성장',
      evName:'굶주린 마도서·탐식', evDesc:'책장이 끝없이 펄럭이며 마탄을 토해냅니다',
      lvDesc:['','마탄 +1','피해 +25%','마탄 +1','피해 강화'],
      baseCd:(w)=> w.evolved ? 1.1 : 1.4,
      dmg:(w)=>{
        const gl = gwepEffLv(DB.gweps.tome.lv||1);
        const g = 1.5 + gl*1.1;
        const tier = gl>=30?1.4 : gl>=15?1.2 : 1;
        return g * [1,1.25,1.55,1.9,2.3][w.lv-1] * tier * (w.evolved?1.5:1);
      },
      count:(w)=> 2 + (w.lv>=2?1:0) + (w.lv>=4?1:0) + Math.floor((DB.gweps.tome.lv||1)/12) + (w.evolved?2:0)
    },
    gblade: {
      name:'핏빛 대검', desc:'[유일] 대지를 가르는 참격 — 고대 톱니로 성장',
      evName:'핏빛 대검·개방', evDesc:'봉인이 풀리며 검이 울부짖습니다',
      lvDesc:['','참격 확장','피해 +25%','참격 확장','피해 강화'],
      baseCd:(w)=> w.evolved ? 1.25 : 1.6,
      dmg:(w)=>{
        const gl = gwepEffLv(DB.gweps.blade.lv||1);
        const g = 3 + gl*1.8;
        const tier = gl>=30?1.4 : gl>=15?1.2 : 1;
        return g * [1,1.25,1.55,1.9,2.3][w.lv-1] * tier * (w.evolved?1.5:1);
      },
      count:(w)=> 1 + (DB.gweps.blade.lv>=25?1:0)
    },
    nameless: {
      name:'무명검', desc:'[유일] 처음엔 형편없지만, 벤 만큼 영원히 성장하는 검',
      evName:'무명검·현신', evDesc:'이름 없는 검이 마침내 제 모습을 드러냅니다',
      lvDesc:['','검기 강화','피해 +25%','검기 확장','피해 강화'],
      baseCd:(w)=> (w.evolved ? 0.85 : 1.05) * ((player&&player.growthBranch==='gale')?0.86:1) * ((player&&player.gwCd)||1),
      dmg:(w)=>{
        const gl = growthEffLv(); // 봉인 해제: 이 판의 처치 수만큼만 본래 힘을 낸다
        const g = 2 + gl*1.1;
        const t = [1,1.25,1.55,1.9,2.3][w.lv-1];
        // 성장 단계 진화 보너스: Lv10 각성 / Lv20 해방 / Lv35 진명검 / Lv60 초월 / Lv100 귀일
        const tier = gl>=100?1.7 : gl>=60?1.5 : gl>=35?1.35 : gl>=20?1.2 : gl>=10?1.1 : 1;
        const branch = (player&&player.growthBranch==='slash') ? 1.18 : 1;
        return g * t * tier * branch * ((player&&player.gwDmg)||1) * (w.evolved?1.5:1);
      },
      count:(w)=>{ const gl = growthEffLv(); return 1 + (gl>=15?1:0) + (gl>=30?1:0) + ((player&&player.growthBranch==='gale')?1:0) + ((player&&player.gwCount)||0) + (w.evolved?1:0); }
    },
    drone: {
      name:'드론', desc:'호위 드론이 자동으로 적을 사격합니다',
      evName:'드론 군단', evDesc:'드론 3기가 강화 탄환을 퍼붓습니다',
      lvDesc:['','드론 +1','피해 +40%','연사 강화','드론 +1, 피해 강화'],
      baseCd:(w)=> (w.evolved ? 0.38 : (w.lv>=4 ? 0.45 : 0.55)),
      dmg:(w)=> (w.evolved ? 20 : [8,8,11,11,14][w.lv-1]),
      count:(w)=> (w.evolved ? 3 : 1 + (w.lv>=2?1:0) + (w.lv>=5?1:0))
    }
  };

  // ---------- tech trees ----------
  // 카드 등급: 같은 테크라도 뽑힌 등급에 따라 효과 배율(m)이 달라진다.
  const CARD_RARITY = [
    { n:'일반', w:55,  m:1.0, cls:'r0' },
    { n:'고급', w:28,  m:1.35, cls:'r1' },
    { n:'희귀', w:12,  m:1.7, cls:'r2' },
    { n:'영웅', w:4,   m:2.2, cls:'r3' },
    { n:'전설', w:1.0, m:3.0, cls:'r4' },
    { n:'신화', w:0,   m:4.5, cls:'r5m' },  // 일반 롤에선 안 나옴 — 신화 노드 전용 (트리당 유일)
  ];
  function rollCardRarity(){
    const luckB = Math.min(3, Math.max(1, player ? player.luck : 1));
    let total = 0;
    const ws = CARD_RARITY.slice(0,5).map((r,i)=> { const w = i===0 ? r.w : r.w*luckB; total += w; return w; });
    let roll = Math.random()*total;
    for (let i=0;i<ws.length;i++){ roll -= ws[i]; if (roll<=0) return i; }
    return 0;
  }
  const R = (v)=> Math.round(v);
  const R1 = (v)=> Math.round(v*10)/10;

  // 속성 테크트리 — 윤회보험 RIP식 원소 속성. 전문 속성은 한 판에 3계열까지만.
  const TREES = {
    common: { name:'공통', common:true, nodes:[
      { key:'c_hp',    name:'단련',  tier:1, max:9, desc:(m)=>'최대체력 +'+R(10*m)+', 즉시 회복', apply:(p,m)=>{ p.maxHp+=R(10*m); p.hp=Math.min(p.maxHp,p.hp+R(10*m)); } },
      { key:'c_dmg',   name:'연마',  tier:1, max:9, desc:(m)=>'모든 피해 +'+R(5*m)+'%', apply:(p,m)=>{ p.dmgMult*=1+0.05*m; } },
      { key:'c_spd',   name:'속보',  tier:1, max:6, desc:(m)=>'이동속도 +'+R(3*m)+'%', apply:(p,m)=>{ p.speed*=1+0.03*m; } },
      { key:'c_mag',   name:'수집',  tier:1, max:6, desc:(m)=>'수집 범위 +'+R(15*m), apply:(p,m)=>{ p.magnet+=15*m; } },
      { key:'c_rate',  name:'집중',  tier:1, max:6, desc:(m)=>'공격속도 +'+R(5*m)+'%', apply:(p,m)=>{ p.rateMult*=1+0.05*m; } },
      { key:'c_regen', name:'재생',  tier:1, max:5, desc:(m)=>'초당 체력 +'+R1(0.4*m), apply:(p,m)=>{ p.regen+=0.4*m; } },
      { key:'c_steal', name:'흡혈',  tier:2, max:3, desc:(m)=>'처치 시 회복 +'+Math.max(1,R(0.8*m)), apply:(p,m)=>{ p.lifesteal+=Math.max(1,R(0.8*m)); } },
      { key:'c_luck',  name:'행운',  tier:2, max:3, desc:(m)=>'골드 +'+R(8*m)+'%, 아이템 드랍 +'+R(12*m)+'%', apply:(p,m)=>{ p.goldMult*=1+0.08*m; p.luck*=1+0.12*m; } },
      { key:'c_giant', name:'거인 사냥꾼', tier:2, max:3, desc:(m)=>'엘리트·악몽급 피해 +'+R(9*m)+'%, 보스 피해 +'+R(6*m)+'%', apply:(p,m)=>{ p.eliteDmg*=1+0.09*m; p.bossDmg*=1+0.06*m; } },
      { key:'c_undying',name:'불굴', tier:3, max:1, desc:(m)=>'[궁극] 1회 부활, 체력 30% 이하일 때 피해 -'+Math.min(60,R(15*m))+'%', apply:(p,m)=>{ p.undyingRevive=true; p.undyingDR=Math.min(0.6,0.15*m); } },
    ]},
    fire: { name:'지옥불', nodes:[
      { key:'f_ignite', name:'발화',       tier:1, max:4, desc:(m)=>'타격 시 화상 확률 +'+R(10*m)+'%, 화상 피해 +'+R(3*m)+'/초 (3초)', apply:(p,m)=>{ if(!p.burnChance) p.burnDps=6; p.burnChance=Math.min(0.8,p.burnChance+0.10*m); p.burnDps+=3*m; } },
      { key:'f_ball',   name:'화염구',     tier:1, max:3, desc:(m)=>'3.5초마다 화염구 발사 — 착탄 시 폭발+화상 (피해 +'+R(12*m)+')', apply:(p,m)=>{ if(!p.fireballLv) p.fireballDmg=22; p.fireballLv+=1; p.fireballDmg+=12*m; } },
      { key:'f_trail',  name:'불의 궤적',  tier:2, max:2, desc:(m)=>'이동 경로에 불길이 남는다 (초당 피해 +'+R(5*m)+')', apply:(p,m)=>{ p.firetrailLv+=1; p.firetrailDps=(p.firetrailDps||7)+5*m; } },
      { key:'f_zone',   name:'폭염 지대',  tier:2, max:2, desc:(m)=>'불길 장판 피해 +'+R(10*m)+', 지속 +0.4초', apply:(p,m)=>{ p.firetrailDps=(p.firetrailDps||10)+10*m; p.firetrailDur+=0.4; } },
      { key:'f_heart',  name:'타오르는 심장', tier:1, max:3, desc:(m)=>'모든 피해 +'+R(4*m)+'%, 화상 피해 +'+R(2*m)+'/초', apply:(p,m)=>{ p.dmgMult*=1+0.04*m; if(p.burnDps) p.burnDps+=2*m; else { p.burnChance=Math.max(p.burnChance||0,0.1); p.burnDps=6+2*m; } } },
      { key:'f_ash',    name:'재의 질주',   tier:2, max:2, desc:(m)=>'이동속도 +'+R(4*m)+'%, 불의 궤적 피해 +'+R(5*m), apply:(p,m)=>{ p.speed*=1+0.04*m; p.firetrailDps=(p.firetrailDps||10)+5*m; } },
      { key:'f_meteor', name:'유성우',     tier:2, max:2, desc:(m)=>'9초마다 유성 3개가 무작위 적에게 낙하 (피해 +'+R(14*m)+', 화상)', apply:(p,m)=>{ p.meteorLv=(p.meteorLv||0)+1; p.meteorDmg=(p.meteorDmg||20)+14*m; } },
      { key:'f_inferno',name:'대화재',     tier:3, max:1, desc:(m)=>'[궁극] 12초마다 대폭염 (피해 '+R(60*m)+') + 모든 화상 즉시 폭발', apply:(p,m)=>{ p.inferno=60*m; } },
      { key:'f_spark',  name:'불꽃 심지',   tier:1, max:3, desc:(m)=>'화염구 피해 +'+R(8*m), apply:(p,m)=>{ if(!p.fireballLv){ p.fireballLv=1; p.fireballDmg=22; } p.fireballDmg+=8*m; } },
      { key:'f_pyro',   name:'방화광',     tier:1, max:3, desc:(m)=>'피해 +'+R(4*m)+'%, 화상 확률 +'+R(4*m)+'%p', apply:(p,m)=>{ p.dmgMult*=1+0.04*m; p.burnChance=Math.min(0.9,(p.burnChance||0)+0.04*m); } },
      { key:'f_soot',   name:'그을음 구름', tier:2, max:2, desc:(m)=>'모든 적 이속 -'+R(3*m)+'%', apply:(p,m)=>{ p.slowAll*=1-0.03*m; } },
      { key:'f_kindle', name:'별의 불씨',   tier:2, max:2, desc:(m)=>'유성우 피해 +'+R(10*m), apply:(p,m)=>{ p.meteorDmg=(p.meteorDmg||20)+10*m; if(!p.meteorLv) p.meteorLv=1; } },
      { key:'f_warm',   name:'온기',       tier:1, max:2, desc:(m)=>'재생 +'+R1(0.3*m)+', 회복 +'+R(6*m)+'%', apply:(p,m)=>{ p.regen+=0.3*m; p.healMult*=1+0.06*m; } },
      { key:'f_myth',   name:'겁화의 군주', tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 화상 피해 2배, 화상 확률 +20%p, 대화재 쿨다운 -30%', apply:(p)=>{ p.burnDps=(p.burnDps||6)*2; p.burnChance=Math.min(0.95,(p.burnChance||0)+0.2); p.infernoCdMult=0.7; } },
    ]},
    frost: { name:'서리', nodes:[
      { key:'i_chill',  name:'냉기 부여',  tier:1, max:3, desc:(m)=>'타격 시 냉기 중첩 — 중첩당 이속 -'+R((0.15+0.03*m)*100)+'% (최대 3중첩)', apply:(p,m)=>{ p.chillOn=true; p.chillPower=Math.min(0.28,(p.chillPower||0.12)+0.03*m); } },
      { key:'i_lance',  name:'얼음창',     tier:1, max:3, desc:(m)=>'4초마다 관통 얼음창 — 25% 확률 1초 빙결 (피해 +'+R(10*m)+')', apply:(p,m)=>{ if(!p.lanceLv) p.lanceDmg=16; p.lanceLv+=1; p.lanceDmg+=10*m; } },
      { key:'i_armor',  name:'서리 갑옷',  tier:2, max:2, desc:(m)=>'피격 시 주변 적 빙결 1.2초, 받는 피해 -'+R(6*m)+'%', apply:(p,m)=>{ p.frostArmor=(p.frostArmor||0)+1; p.dmgTaken*=1-0.06*m; } },
      { key:'i_deep',   name:'혹한',       tier:2, max:2, desc:(m)=>'빙결·냉기 상태의 적에게 피해 +'+R(10*m)+'%', apply:(p,m)=>{ p.frozenAmp+=0.10*m; } },
      { key:'i_calm',   name:'냉정',       tier:1, max:3, desc:(m)=>'쿨다운 -'+R(3*m)+'%, 냉기 효과 +'+R(2*m)+'%p', apply:(p,m)=>{ p.cdr*=1-0.03*m; p.chillPower=Math.min(0.32,(p.chillPower||0.12)+0.02*m); p.chillOn=true; } },
      { key:'i_shatter',name:'분쇄',       tier:2, max:2, desc:(m)=>'빙결·냉기 상태의 적 피해 +'+R(8*m)+'%', apply:(p,m)=>{ p.frozenAmp+=0.08*m; } },
      { key:'i_blizz',  name:'눈보라',     tier:2, max:2, desc:(m)=>'9초마다 주변에 눈보라 (초당 피해 +'+R(4*m)+', 냉기 중첩)', apply:(p,m)=>{ p.blizzLv=(p.blizzLv||0)+1; p.blizzDps=(p.blizzDps||6)+4*m; } },
      { key:'i_abszero',name:'절대영도',   tier:3, max:1, desc:(m)=>'[궁극] 14초마다 화면 전체 2초 빙결 + 피해 '+R(40*m), apply:(p,m)=>{ p.absZero=40*m; } },
      { key:'i_shard',  name:'얼음 파편',   tier:1, max:3, desc:(m)=>'얼음창 피해 +'+R(7*m), apply:(p,m)=>{ if(!p.lanceLv){ p.lanceLv=1; p.lanceDmg=16; } p.lanceDmg+=7*m; } },
      { key:'i_mist',   name:'냉기 안개',   tier:1, max:2, desc:(m)=>'모든 적 이속 -'+R(3*m)+'%', apply:(p,m)=>{ p.slowAll*=1-0.03*m; } },
      { key:'i_core',   name:'빙핵',       tier:2, max:2, desc:(m)=>'쿨다운 -'+R(4*m)+'%, 빙결 적 피해 +'+R(6*m)+'%', apply:(p,m)=>{ p.cdr*=1-0.04*m; p.frozenAmp+=0.06*m; } },
      { key:'i_snow',   name:'적설',       tier:2, max:2, desc:(m)=>'눈보라 피해 +'+R(5*m)+'/초', apply:(p,m)=>{ p.blizzDps=(p.blizzDps||6)+5*m; if(!p.blizzLv) p.blizzLv=1; } },
      { key:'i_veil',   name:'서리 장막',   tier:1, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; } },
      { key:'i_myth',   name:'영원한 겨울', tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 빙결·냉기 적 피해 +35%, 냉기 최대 효과, 서리 갑옷 강화', apply:(p)=>{ p.frozenAmp+=0.35; p.chillPower=0.32; p.chillOn=true; p.frostArmor=(p.frostArmor||0)+1; } },
    ]},
    volt: { name:'번개', nodes:[
      { key:'l_shock',  name:'감전',       tier:1, max:4, desc:(m)=>'타격 시 '+R(8*m)+'% 확률 연쇄 번개 (피해 +'+R(5*m)+')', apply:(p,m)=>{ p.shockChance=Math.min(0.6,p.shockChance+0.08*m); p.shockDmg=(p.shockDmg||10)+5*m; } },
      { key:'l_charge', name:'축전',       tier:1, max:3, desc:(m)=>'공격속도 +'+R(6*m)+'%, 대시 후 2초간 감전 확률 100%', apply:(p,m)=>{ p.rateMult*=1+0.06*m; p.chargeBoost=true; if(!p.shockDmg) p.shockDmg=10; } },
      { key:'l_field',  name:'자기장',     tier:2, max:2, desc:(m)=>'4초마다 주변에 감전 펄스 (피해 +'+R(6*m)+')', apply:(p,m)=>{ p.magfieldLv+=1; p.magfieldDmg=(p.magfieldDmg||9)+6*m; } },
      { key:'l_over',   name:'과전압',     tier:2, max:1, desc:(m)=>'감전 연쇄가 한 번 더 튄다', apply:(p,m)=>{ p.chainPlus=1; } },
      { key:'l_cap',    name:'축전기',     tier:1, max:3, desc:(m)=>'쿨다운 -'+R(3*m)+'%, 감전 피해 +'+R(4*m), apply:(p,m)=>{ p.cdr*=1-0.03*m; p.shockDmg=(p.shockDmg||10)+4*m; } },
      { key:'l_flash',  name:'전광석화',   tier:2, max:2, desc:(m)=>'이동속도 +'+R(4*m)+'%, 공격속도 +'+R(4*m)+'%', apply:(p,m)=>{ p.speed*=1+0.04*m; p.rateMult*=1+0.04*m; } },
      { key:'l_spear',  name:'천둥 창',    tier:2, max:2, desc:(m)=>'6초마다 관통 뇌창 발사 (피해 +'+R(12*m)+', 관통 6)', apply:(p,m)=>{ p.spearLv=(p.spearLv||0)+1; p.spearDmg=(p.spearDmg||18)+12*m; } },
      { key:'l_thor',   name:'뇌신 강림',  tier:3, max:1, desc:(m)=>'[궁극] 11초마다 거대 낙뢰 8연타 (피해 '+R(30*m)+')', apply:(p,m)=>{ p.thor=30*m; } },
      { key:'l_coil',   name:'테슬라 코일', tier:1, max:3, desc:(m)=>'감전 피해 +'+R(5*m), apply:(p,m)=>{ p.shockDmg=(p.shockDmg||10)+5*m; } },
      { key:'l_storm',  name:'폭풍 인도',   tier:2, max:2, desc:(m)=>'천둥 창 피해 +'+R(9*m), apply:(p,m)=>{ p.spearDmg=(p.spearDmg||18)+9*m; if(!p.spearLv) p.spearLv=1; } },
      { key:'l_static', name:'정전기장',   tier:1, max:2, desc:(m)=>'원소 발동 +'+R(3*m)+'%p', apply:(p,m)=>{ p.procBonus=(p.procBonus||0)+0.03*m; } },
      { key:'l_surge',  name:'서지 전류',   tier:1, max:3, desc:(m)=>'공격속도 +'+R(4*m)+'%', apply:(p,m)=>{ p.rateMult*=1+0.04*m; } },
      { key:'l_ground', name:'접지',       tier:2, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%, 감전 확률 +'+R(4*m)+'%p', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; p.shockChance=Math.min(0.8,(p.shockChance||0)+0.04*m); } },
      { key:'l_myth',   name:'천둥의 심장', tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 감전 연쇄 +2회, 감전 확률 +15%p, 감전 피해 +15', apply:(p)=>{ p.chainPlus=(p.chainPlus||0)+2; p.shockChance=Math.min(0.8,(p.shockChance||0)+0.15); p.shockDmg=(p.shockDmg||10)+15; } },
    ]},
    acid: { name:'부식', nodes:[
      { key:'a_shred',  name:'방어 붕괴',  tier:1, max:4, desc:(m)=>'타격 시 '+R(10*m)+'% 확률 부식 — 중첩당 받는 피해 +15% (5초)', apply:(p,m)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.10*m); } },
      { key:'a_melt',   name:'용해',       tier:1, max:3, desc:(m)=>'부식된 적은 초당 '+R(3*m)+' 추가 피해', apply:(p,m)=>{ p.dissolveDps=(p.dissolveDps||0)+3*m; } },
      { key:'a_cloud',  name:'산성 구름',  tier:2, max:2, desc:(m)=>'7초마다 산성 구름 장판 (초당 피해 +'+R(5*m)+', 부식 부여)', apply:(p,m)=>{ p.acidLv+=1; p.acidDps=(p.acidDps||7)+5*m; } },
      { key:'a_burst',  name:'침식 폭발',  tier:2, max:1, desc:(m)=>'부식 2중첩 이상 적이 죽으면 산성 폭발이 퍼진다', apply:(p,m)=>{ p.acidBurst=true; } },
      { key:'a_blood',  name:'맹독 혈액',  tier:1, max:3, desc:(m)=>'부식 확률 +'+R(6*m)+'%p, 재생 +'+R1(0.2*m), apply:(p,m)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.06*m); p.regen+=0.2*m; } },
      { key:'a_endur',  name:'내성',       tier:2, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%, 용해 피해 +'+R(2*m)+'/초', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; p.dissolveDps=(p.dissolveDps||0)+2*m; } },
      { key:'a_wave',   name:'산성 파도',  tier:2, max:2, desc:(m)=>'8초마다 부식 파동 방출 (피해 +'+R(10*m)+', 부식 부여)', apply:(p,m)=>{ p.awaveLv=(p.awaveLv||0)+1; p.awaveDmg=(p.awaveDmg||14)+10*m; } },
      { key:'a_collapse',name:'완전 붕괴', tier:3, max:1, desc:(m)=>'[궁극] 부식 최대 4중첩·효과 강화, 15초마다 전 화면 부식', apply:(p,m)=>{ p.collapse=true; p.corrodeMaxS=4; p.corrodeAmp=0.22; } },
      { key:'a_fume',   name:'유독 증기',   tier:1, max:3, desc:(m)=>'산성 구름 피해 +'+R(5*m)+'/초', apply:(p,m)=>{ p.acidDps=(p.acidDps||7)+5*m; if(!p.acidLv) p.acidLv=1; } },
      { key:'a_spit',   name:'산성 침',     tier:2, max:2, desc:(m)=>'산성 파도 피해 +'+R(8*m), apply:(p,m)=>{ p.awaveDmg=(p.awaveDmg||14)+8*m; if(!p.awaveLv) p.awaveLv=1; } },
      { key:'a_rot',    name:'부패 촉진',   tier:2, max:2, desc:(m)=>'부식 효과 +'+R(3*m)+'%p', apply:(p,m)=>{ p.corrodeAmp=Math.min(0.4,p.corrodeAmp+0.03*m); } },
      { key:'a_skin',   name:'산성 피부',   tier:1, max:2, desc:(m)=>'접촉 피해의 '+R(30*m)+'% 반사', apply:(p,m)=>{ p.thorns=Math.max(p.thorns||0, 0.3*m); } },
      { key:'a_pool',   name:'용해조',     tier:1, max:2, desc:(m)=>'용해 피해 +'+R(2*m)+'/초', apply:(p,m)=>{ p.dissolveDps=(p.dissolveDps||0)+2*m; } },
      { key:'a_myth',   name:'만물 분해',  tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 부식 중첩당 받는 피해 +30%로 강화, 용해 피해 2배', apply:(p)=>{ p.corrodeAmp=0.30; p.dissolveDps=(p.dissolveDps||3)*2; } },
    ]},
    boom: { name:'폭발', nodes:[
      { key:'e_boom',   name:'유폭',       tier:1, max:4, desc:(m)=>'처치 시 '+R(10*m)+'% 확률 폭발 (피해 +'+R(10*m)+')', apply:(p,m)=>{ p.explodeChance=Math.min(0.6,(p.explodeChance||0)+0.10*m); p.explodeDmg=(p.explodeDmg||18)+10*m; } },
      { key:'e_dash',   name:'돌파 폭발',  tier:1, max:3, desc:(m)=>'대시할 때 주변 폭발 (피해 +'+R(18*m)+')', apply:(p,m)=>{ if(!p.dashBlast) p.dashBlast=20; p.dashBlast+=18*m; } },
      { key:'e_mines',  name:'지뢰 살포',  tier:2, max:2, desc:(m)=>'5초마다 지뢰 2개 설치 (피해 +'+R(10*m)+')', apply:(p,m)=>{ p.mineLv+=1; p.mineDmg=(p.mineDmg||22)+10*m; } },
      { key:'e_chain2', name:'연쇄 기폭',  tier:2, max:2, desc:(m)=>'유폭·지뢰 피해 +'+R(15*m)+'%', apply:(p,m)=>{ p.explodeDmg=(p.explodeDmg||18)*(1+0.15*m); p.mineDmg=(p.mineDmg||30)*(1+0.15*m); } },
      { key:'e_pack',   name:'추가 화약',  tier:1, max:3, desc:(m)=>'유폭 확률 +'+R(8*m)+'%p, 폭발 피해 +'+R(6*m), apply:(p,m)=>{ p.explodeChance=Math.min(0.6,(p.explodeChance||0)+0.08*m); p.explodeDmg=(p.explodeDmg||18)+6*m; } },
      { key:'e_vest',   name:'폭발 조끼',  tier:2, max:2, desc:(m)=>'받는 피해 -'+R(3*m)+'%, 돌파 폭발 피해 +'+R(10*m), apply:(p,m)=>{ p.dmgTaken*=1-0.03*m; p.dashBlast=(p.dashBlast||20)+10*m; } },
      { key:'e_cluster',name:'클러스터 폭격', tier:2, max:2, desc:(m)=>'10초마다 집속 폭격 — 본폭발 + 분열탄 3 (피해 +'+R(12*m)+')', apply:(p,m)=>{ p.clusterLv=(p.clusterLv||0)+1; p.clusterDmg=(p.clusterDmg||18)+12*m; } },
      { key:'e_carpet', name:'융단 폭격',  tier:3, max:1, desc:(m)=>'[궁극] 16초마다 8발 폭격 (피해 '+R(45*m)+')', apply:(p,m)=>{ p.orbital=45*m; } },
      { key:'e_fuse',   name:'짧은 도화선', tier:1, max:3, desc:(m)=>'유폭 확률 +'+R(6*m)+'%p', apply:(p,m)=>{ p.explodeChance=Math.min(0.7,(p.explodeChance||0)+0.06*m); } },
      { key:'e_shrap',  name:'파편 조각',   tier:1, max:3, desc:(m)=>'폭발 피해 +'+R(6*m), apply:(p,m)=>{ p.explodeDmg=(p.explodeDmg||18)+6*m; } },
      { key:'e_nitro',  name:'니트로 첨가', tier:2, max:2, desc:(m)=>'클러스터 폭격 피해 +'+R(9*m), apply:(p,m)=>{ p.clusterDmg=(p.clusterDmg||18)+9*m; if(!p.clusterLv) p.clusterLv=1; } },
      { key:'e_tremor', name:'여진',       tier:2, max:2, desc:(m)=>'지뢰 피해 +'+R(8*m), apply:(p,m)=>{ p.mineDmg=(p.mineDmg||22)+8*m; if(!p.mineLv) p.mineLv=1; } },
      { key:'e_plate',  name:'폭연 갑주',   tier:1, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; } },
      { key:'e_myth',   name:'메가톤',     tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 모든 폭발 피해 +40%, 유폭 확률 +15%p', apply:(p)=>{ p.explodeDmg=(p.explodeDmg||18)*1.4; p.mineDmg=(p.mineDmg||30)*1.4; p.explodeChance=Math.min(0.75,(p.explodeChance||0)+0.15); } },
    ]},
    mech: { name:'기계', nodes:[
      { key:'m_turret', name:'자동 터렛',  tier:1, max:2, desc:(m)=>'자동 사격 터렛 +1기 (피해 +'+R(4*m)+')', apply:(p,m)=>{ p.turretLv+=1; p.turretDmg=(p.turretDmg||7)+4*m; } },
      { key:'m_tune',   name:'정비',       tier:1, max:4, desc:(m)=>'모든 쿨다운 -'+R(4*m)+'%, 재생 +'+R1(0.25*m), apply:(p,m)=>{ p.cdr*=1-0.04*m; p.regen+=0.25*m; } },
      { key:'m_ammo',   name:'강화 탄자',  tier:2, max:3, desc:(m)=>'관통 +'+(m<2?1:2)+', 투사체 피해 +'+R(8*m)+'%', apply:(p,m)=>{ p.pierce+=(m<2?1:2); p.projMult*=1+0.08*m; } },
      { key:'m_heat',   name:'포탑 과열',  tier:2, max:2, desc:(m)=>'터렛 공격속도 +'+R(15*m)+'%', apply:(p,m)=>{ p.turretRate*=1+0.15*m; } },
      { key:'m_repair', name:'자가 수리',  tier:1, max:3, desc:(m)=>'재생 +'+R1(0.4*m)+', 쿨다운 -'+R(2*m)+'%', apply:(p,m)=>{ p.regen+=0.4*m; p.cdr*=1-0.02*m; } },
      { key:'m_scrap',  name:'재활용',     tier:2, max:2, desc:(m)=>'골드 +'+R(6*m)+'%, 터렛 피해 +'+R(4*m), apply:(p,m)=>{ p.goldMult*=1+0.06*m; p.turretDmg=(p.turretDmg||10)+4*m; } },
      { key:'m_emp',    name:'EMP 방출',   tier:2, max:2, desc:(m)=>'9초마다 전자기 충격파 (피해 +'+R(8*m)+', 0.4초 정지)', apply:(p,m)=>{ p.empLv=(p.empLv||0)+1; p.empDmg=(p.empDmg||12)+8*m; } },
      { key:'m_od',     name:'오버드라이브',tier:3, max:1, desc:(m)=>'[궁극] 15초마다 5초간 공격속도 +'+R((0.3+0.1*m)*100)+'%·이동속도 +20%', apply:(p,m)=>{ p.odCd=15; p.odPower=0.3+0.1*m; } },
      { key:'m_servo',  name:'고속 서보',   tier:1, max:3, desc:(m)=>'터렛 공속 +'+R(10*m)+'%', apply:(p,m)=>{ p.turretRate*=1+0.10*m; } },
      { key:'m_amp',    name:'EMP 증폭기',  tier:2, max:2, desc:(m)=>'EMP 피해 +'+R(6*m), apply:(p,m)=>{ p.empDmg=(p.empDmg||12)+6*m; if(!p.empLv) p.empLv=1; } },
      { key:'m_forge',  name:'정밀 단조',   tier:1, max:3, desc:(m)=>'투사체 피해 +'+R(6*m)+'%', apply:(p,m)=>{ p.projMult*=1+0.06*m; } },
      { key:'m_battery',name:'보조 배터리', tier:1, max:2, desc:(m)=>'쿨다운 -'+R(3*m)+'%', apply:(p,m)=>{ p.cdr*=1-0.03*m; } },
      { key:'m_plate',  name:'복합 장갑',   tier:2, max:2, desc:(m)=>'받는 피해 -'+R(3*m)+'%, 체력 +'+R(8*m), apply:(p,m)=>{ p.dmgTaken*=1-0.03*m; p.maxHp+=8*m; } },
      { key:'m_myth',   name:'기계 반란',  tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 터렛 +2기, 터렛 공격속도 +30%, 관통 +1', apply:(p)=>{ p.turretLv=(p.turretLv||0)+2; if(!p.turretDmg) p.turretDmg=12; p.turretRate*=1.3; p.pierce+=1; } },
    ]},
    psi: { name:'염동', nodes:[
      { key:'p_pulse',  name:'염동 파동',   tier:1, max:4, desc:(m)=>'7초마다 주변을 밀쳐내는 파동 (피해 +'+R(8*m)+')', apply:(p,m)=>{ if(!p.pulseLv) p.pulseDmg=14; p.pulseLv+=1; p.pulseDmg+=8*m; } },
      { key:'p_shield', name:'사이오닉 방벽', tier:1, max:2, desc:(m)=>'주기적으로 피해 1회 무효 (충전 '+R1(Math.max(5,12-1.5*m))+'초)', apply:(p,m)=>{ const cd=Math.max(5,12-1.5*m); p.shieldCdMax = p.shieldCdMax? Math.min(p.shieldCdMax,cd) : cd; p.shieldT=0; } },
      { key:'p_slow',   name:'정신 압박',   tier:2, max:3, desc:(m)=>'모든 적 이동속도 -'+R(4*m)+'%', apply:(p,m)=>{ p.slowAll*=1-0.04*m; } },
      { key:'p_grav',   name:'중력 붕괴',   tier:2, max:1, desc:(m)=>'염동 파동이 적을 끌어당기며 피해 +30%', apply:(p,m)=>{ p.pulsePull=true; } },
      { key:'p_focus',  name:'정신 집중',   tier:1, max:3, desc:(m)=>'모든 피해 +'+R(4*m)+'%, 파동 피해 +'+R(5*m), apply:(p,m)=>{ p.dmgMult*=1+0.04*m; if(p.pulseLv) p.pulseDmg+=5*m; else { p.pulseLv=1; p.pulseDmg=20+5*m; } } },
      { key:'p_ward',   name:'결계',        tier:2, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%, 방벽 충전 -1초', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; if(p.shieldCdMax) p.shieldCdMax=Math.max(4,p.shieldCdMax-1); } },
      { key:'p_barrier',name:'염동 결계',   tier:2, max:1, desc:(m)=>'7초마다 주변의 적 탄환을 전부 소거', apply:(p,m)=>{ p.wardLv=(p.wardLv||0)+1; } },
      { key:'p_blink',  name:'점멸',        tier:3, max:1, desc:(m)=>'[궁극] 대시가 순간이동이 되고 도착 지점에 대폭발 (피해 '+R(55*m)+')', apply:(p,m)=>{ p.blink=55*m; } },
      { key:'p_lens',   name:'정신 렌즈',   tier:1, max:3, desc:(m)=>'파동 피해 +'+R(6*m), apply:(p,m)=>{ if(!p.pulseLv){ p.pulseLv=1; p.pulseDmg=14; } p.pulseDmg+=6*m; } },
      { key:'p_calm2',  name:'깊은 명상',   tier:1, max:2, desc:(m)=>'재생 +'+R1(0.3*m)+', 쿨다운 -'+R(2*m)+'%', apply:(p,m)=>{ p.regen+=0.3*m; p.cdr*=1-0.02*m; } },
      { key:'p_press',  name:'압장 강화',   tier:2, max:2, desc:(m)=>'모든 적 이속 -'+R(3*m)+'%', apply:(p,m)=>{ p.slowAll*=1-0.03*m; } },
      { key:'p_third',  name:'제3의 눈',    tier:2, max:2, desc:(m)=>'치명 확률 +'+R(5*m)+'%', apply:(p,m)=>{ p.critChance=Math.min(0.85,p.critChance+0.05*m); } },
      { key:'p_float',  name:'염동 부양',   tier:1, max:2, desc:(m)=>'이동속도 +'+R(4*m)+'%', apply:(p,m)=>{ p.speed*=1+0.04*m; } },
      { key:'p_myth',   name:'초월자',      tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 파동 피해 +60%·적을 끌어당김, 모든 적 이속 -8%', apply:(p)=>{ if(!p.pulseLv){ p.pulseLv=1; p.pulseDmg=20; } p.pulseDmg=Math.round(p.pulseDmg*1.6); p.pulsePull=true; p.slowAll*=0.92; } },
    ]},
    holy: { name:'신성', nodes:[
      { key:'h_smite',  name:'성광 강타',   tier:1, max:4, desc:(m)=>'타격 시 '+R(8*m)+'% 확률 신성 피해 +'+R(8*m), apply:(p,m)=>{ p.smiteChance=Math.min(0.6,(p.smiteChance||0)+0.08*m); p.smiteDmg=(p.smiteDmg||10)+8*m; } },
      { key:'h_bless',  name:'빛의 축복',   tier:1, max:3, desc:(m)=>'재생 +'+R1(0.4*m)+', 회복 효과 +'+R(8*m)+'%', apply:(p,m)=>{ p.regen+=0.4*m; p.healMult*=1+0.08*m; } },
      { key:'h_halo',   name:'후광',        tier:1, max:3, desc:(m)=>'6초마다 주변 신성 파동 (피해 +'+R(9*m)+', 체력 2 회복)', apply:(p,m)=>{ p.haloLv=(p.haloLv||0)+1; p.haloDmg=(p.haloDmg||12)+9*m; } },
      { key:'h_ward',   name:'성역',        tier:2, max:2, desc:(m)=>'피격을 '+R(6*m)+'% 확률로 무효화', apply:(p,m)=>{ p.holyWard=Math.min(0.35,(p.holyWard||0)+0.06*m); } },
      { key:'h_zeal',   name:'열광',        tier:2, max:2, desc:(m)=>'신성 피해 +'+R(12*m)+'%, 회복할 때마다 다음 공격 강화', apply:(p,m)=>{ p.holyAmp=(p.holyAmp||1)*(1+0.12*m); p.holyHealOnSmite=true; } },
      { key:'h_judge',  name:'심판의 빛',   tier:3, max:1, desc:(m)=>'[전용기] 12초마다 무작위 적 5기에 빛기둥 (피해 '+R(35*m)+' + 회복 5)', apply:(p,m)=>{ p.judgment=35*m; } },
      { key:'h_relic',  name:'성물함',     tier:1, max:3, desc:(m)=>'성광 강타 피해 +'+R(6*m), apply:(p,m)=>{ p.smiteDmg=(p.smiteDmg||10)+6*m; if(!p.smiteChance) p.smiteChance=0.08; } },
      { key:'h_choir',  name:'성가대',     tier:2, max:2, desc:(m)=>'후광 피해 +'+R(7*m)+', 회복 +1', apply:(p,m)=>{ p.haloDmg=(p.haloDmg||12)+7*m; if(!p.haloLv) p.haloLv=1; } },
      { key:'h_grace',  name:'은총',       tier:1, max:2, desc:(m)=>'회복 효과 +'+R(10*m)+'%', apply:(p,m)=>{ p.healMult*=1+0.10*m; } },
      { key:'h_armor',  name:'빛의 갑주',   tier:2, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; } },
      { key:'h_wrath',  name:'진노',       tier:2, max:2, desc:(m)=>'엘리트·보스 피해 +'+R(8*m)+'%', apply:(p,m)=>{ p.eliteDmg*=1+0.08*m; p.bossDmg*=1+0.08*m; } },
      { key:'h_myth',   name:'신격',        tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 신성 피해 2배, 성역 +10%p, 심판이 회복 2배', apply:(p)=>{ p.holyAmp=(p.holyAmp||1)*2; p.holyWard=Math.min(0.45,(p.holyWard||0)+0.10); p.judgeHeal2=true; } },
    ]},
    grav: { name:'중력', nodes:[
      { key:'g_well',   name:'중력 우물',   tier:1, max:3, desc:(m)=>'8초마다 적을 빨아들이는 우물 생성 (초당 피해 +'+R(5*m)+')', apply:(p,m)=>{ p.gravLv=(p.gravLv||0)+1; p.gravDps=(p.gravDps||8)+5*m; } },
      { key:'g_weight', name:'중량 가중',   tier:1, max:3, desc:(m)=>'모든 적 이동속도 -'+R(4*m)+'%', apply:(p,m)=>{ p.slowAll*=1-0.04*m; } },
      { key:'g_orbit',  name:'궤도 안정',   tier:1, max:2, desc:(m)=>'수집 범위 +'+R(25*m)+', 경험치 구슬이 스스로 끌려온다', apply:(p,m)=>{ p.magnet+=25*m; } },
      { key:'g_crush',  name:'압착',        tier:2, max:3, desc:(m)=>'중력 우물 안의 적 피해 +'+R(14*m)+'%', apply:(p,m)=>{ p.crushAmp=(p.crushAmp||0)+0.14*m; } },
      { key:'g_singul', name:'특이점',      tier:3, max:1, desc:(m)=>'[전용기] 15초마다 거대 특이점 — 흡인 후 대폭발 (피해 '+R(50*m)+')', apply:(p,m)=>{ p.singularity=50*m; } },
      { key:'g_dense',  name:'고밀도 코어', tier:1, max:3, desc:(m)=>'중력 우물 피해 +'+R(4*m)+'/초', apply:(p,m)=>{ p.gravDps=(p.gravDps||8)+4*m; if(!p.gravLv) p.gravLv=1; } },
      { key:'g_field',  name:'인력장',     tier:1, max:2, desc:(m)=>'수집 범위 +'+R(20*m)+', 적 이속 -'+R(2*m)+'%', apply:(p,m)=>{ p.magnet+=20*m; p.slowAll*=1-0.02*m; } },
      { key:'g_mass',   name:'질량 붕괴',   tier:2, max:2, desc:(m)=>'압착 효과 +'+R(8*m)+'%', apply:(p,m)=>{ p.crushAmp=(p.crushAmp||0)+0.08*m; } },
      { key:'g_anchor', name:'중력 닻',     tier:1, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; } },
      { key:'g_lens',   name:'중력 렌즈',   tier:2, max:2, desc:(m)=>'관통 +1, 투사체 +'+R(5*m)+'%', apply:(p,m)=>{ p.pierce+=1; p.projMult*=1+0.05*m; } },
      { key:'g_myth',   name:'사건의 지평선', tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 중력 우물 상시 유지 + 우물 피해·압착 +50%', apply:(p)=>{ p.gravAlways=true; if(!p.gravLv){ p.gravLv=1; p.gravDps=8; } p.gravDps=Math.round(p.gravDps*1.5); p.crushAmp=(p.crushAmp||0)*1.5+0.1; } },
    ]},
    chrono: { name:'시간', nodes:[
      { key:'c_cut',    name:'시간 절단',   tier:1, max:4, desc:(m)=>'타격 시 '+R(6*m)+'% 확률로 0.5초 정지', apply:(p,m)=>{ p.stutterChance=Math.min(0.5,(p.stutterChance||0)+0.06*m); p.stutterDur=0.5; } },
      { key:'c_haste',  name:'가속',        tier:1, max:3, desc:(m)=>'공격속도 +'+R(5*m)+'%, 쿨다운 -'+R(3*m)+'%', apply:(p,m)=>{ p.rateMult*=1+0.05*m; p.cdr*=1-0.03*m; } },
      { key:'c_drag',   name:'지연장',      tier:2, max:2, desc:(m)=>'내 주변 적 탄환 속도 -'+R(15*m)+'%', apply:(p,m)=>{ p.dragField=Math.min(0.6,(p.dragField||0)+0.15*m); } },
      { key:'c_moment', name:'찰나 포착',   tier:2, max:2, desc:(m)=>'정지 상태의 적 피해 +'+R(15*m)+'%', apply:(p,m)=>{ p.frozenAmp+=0.15*m; } },
      { key:'c_stop',   name:'시간 정지',   tier:3, max:1, desc:(m)=>'[전용기] 16초마다 전 화면 1.2초 정지 (피해 '+R(20*m)+')', apply:(p,m)=>{ p.timestop=20*m; } },
      { key:'c_wind',   name:'태엽 감기',   tier:1, max:3, desc:(m)=>'공격속도 +'+R(4*m)+'%', apply:(p,m)=>{ p.rateMult*=1+0.04*m; } },
      { key:'c_split',  name:'초침 분할',   tier:2, max:2, desc:(m)=>'시간 절단 확률 +'+R(5*m)+'%p', apply:(p,m)=>{ p.stutterChance=Math.min(0.6,(p.stutterChance||0)+0.05*m); p.stutterDur=p.stutterDur||0.5; } },
      { key:'c_dilate', name:'시공 팽창',   tier:2, max:2, desc:(m)=>'지연장 감속 +'+R(10*m)+'%p', apply:(p,m)=>{ p.dragField=Math.min(0.7,(p.dragField||0)+0.10*m); } },
      { key:'c_loop',   name:'시간 고리',   tier:1, max:2, desc:(m)=>'쿨다운 -'+R(4*m)+'%', apply:(p,m)=>{ p.cdr*=1-0.04*m; } },
      { key:'c_after',  name:'잔상',       tier:1, max:2, desc:(m)=>'회피 +'+R(4*m)+'%', apply:(p,m)=>{ p.dodge=Math.min(0.6,p.dodge+0.04*m); } },
      { key:'c_myth',   name:'인과 역전',   tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 정지 지속 2배, 정지 적 피해 +40%, 시간 정지 쿨 -25%', apply:(p)=>{ p.stutterDur=1.0; p.frozenAmp+=0.40; p.timestopCdMult=0.75; } },
    ]},
    blood: { name:'혈마', nodes:[
      { key:'b_pact',   name:'피의 계약',   tier:1, max:3, desc:(m)=>'피해 +'+R(7*m)+'% / 최대체력 -3%', apply:(p,m)=>{ p.dmgMult*=1+0.07*m; p.maxHp=Math.max(30,Math.round(p.maxHp*0.97)); p.hp=Math.min(p.hp,p.maxHp); } },
      { key:'b_leech',  name:'흡혈 낙인',   tier:1, max:4, desc:(m)=>'타격 시 '+R(5*m)+'% 확률 체력 +'+Math.max(1,R(m))+' 회복', apply:(p,m)=>{ p.bloodLeechChance=Math.min(0.5,(p.bloodLeechChance||0)+0.05*m); p.bloodMult=Math.max(1,R(m)); } },
      { key:'b_burst',  name:'혈폭',        tier:1, max:3, desc:(m)=>'처치 시 '+R(10*m)+'% 확률 핏빛 폭발 (피해 +'+R(9*m)+')', apply:(p,m)=>{ p.bloodBurstCh=Math.min(0.6,(p.bloodBurstCh||0)+0.10*m); p.bloodBurstDmg=(p.bloodBurstDmg||14)+9*m; } },
      { key:'b_frenzy', name:'광혈',        tier:2, max:2, desc:(m)=>'잃은 체력 10%당 공격속도 +'+R(3*m)+'%', apply:(p,m)=>{ p.bloodFrenzy=(p.bloodFrenzy||0)+0.03*m; } },
      { key:'b_lord',   name:'피의 군주',   tier:3, max:1, desc:(m)=>'[전용기] 12초마다 체력 8%를 바쳐 핏빛 대폭발 (피해 '+R(45*m)+')', apply:(p,m)=>{ p.bloodLord=45*m; } },
      { key:'b_thick',  name:'진한 피',     tier:1, max:3, desc:(m)=>'체력 +'+R(8*m)+', 처치 회복 +1', apply:(p,m)=>{ p.maxHp+=8*m; p.lifesteal+=1; } },
      { key:'b_mark',   name:'낙인 확산',   tier:2, max:2, desc:(m)=>'흡혈 낙인 확률 +'+R(4*m)+'%p', apply:(p,m)=>{ p.bloodLeechChance=Math.min(0.6,(p.bloodLeechChance||0)+0.04*m); p.bloodMult=p.bloodMult||1; } },
      { key:'b_boil',   name:'끓는 피',     tier:2, max:2, desc:(m)=>'혈폭 피해 +'+R(7*m), apply:(p,m)=>{ p.bloodBurstDmg=(p.bloodBurstDmg||14)+7*m; if(!p.bloodBurstCh) p.bloodBurstCh=0.1; } },
      { key:'b_iron',   name:'철분 과다',   tier:1, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; } },
      { key:'b_thirst', name:'갈증',       tier:2, max:2, desc:(m)=>'피해 +'+R(6*m)+'% / 최대체력 -2%', apply:(p,m)=>{ p.dmgMult*=1+0.06*m; p.maxHp=Math.max(30,Math.round(p.maxHp*0.98)); } },
      { key:'b_myth',   name:'진혈각성',    tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 모든 흡혈·회복 낙인 2배, 혈폭 확률 +15%p, 피의 군주 체력 소모 절반', apply:(p)=>{ p.bloodMult=(p.bloodMult||1)*2; p.lifesteal*=2; p.bloodBurstCh=Math.min(0.75,(p.bloodBurstCh||0)+0.15); p.bloodLordHalf=true; } },
    ]}
  };
  const SPEC_TREES = ['fire','frost','volt','acid','boom','mech','psi','holy','grav','chrono','blood'];
  const TIER_GATE = { 2:2, 3:4, 4:7 };     // 전문 속성: 트리 투자 포인트 게이트 (4=신화, 깊은 투자 필요)
  const COMMON_GATE = { 2:4, 3:7, 4:99 };  // 공통: 더 깊은 게이트 (공통엔 신화 없음)
  let focusTree = null; // 이번 레벨업에 '강림'한 속성
  let focusOverride = null; // 속성 지정 리롤 (원하는 속성 선택)
  // 하위테크 분류: 무기(생성물) / 전술(스탯·상태이상) / 수호(방어) / 보조(경제·유틸)
  const NODE_CAT = {
    f_ball:'무기', f_trail:'무기', f_zone:'무기',
    i_lance:'무기', l_field:'무기', a_cloud:'무기',
    e_mines:'무기', e_dash:'무기', m_turret:'무기', p_pulse:'무기',
    i_armor:'수호', p_shield:'수호', p_ward:'수호', e_vest:'수호', a_endur:'수호', i_calm:'수호',
    m_scrap:'보조', m_repair:'보조', f_ash:'보조', l_flash:'보조', a_blood:'보조',
    h_halo:'무기', h_ward:'수호', h_bless:'운명',
    g_well:'무기', g_orbit:'운명', g_weight:'전술',
    c_drag:'수호', c_haste:'보조',
    b_burst:'무기', b_frenzy:'금단', b_leech:'전술', b_pact:'금단',
    c_luck:'운명', a_blood:'금단',
    f_meteor:'무기', i_blizz:'무기', l_spear:'무기', a_wave:'무기', e_cluster:'무기', m_emp:'무기', p_barrier:'수호',
    f_spark:'무기', f_kindle:'무기', f_warm:'보조', f_soot:'전술',
    i_shard:'무기', i_snow:'무기', i_veil:'수호', i_mist:'전술', i_core:'보조',
    l_coil:'무기', l_storm:'무기', l_ground:'수호', l_surge:'보조',
    a_fume:'무기', a_spit:'무기', a_skin:'수호', a_pool:'전술', a_rot:'전술',
    e_fuse:'전술', e_shrap:'무기', e_nitro:'무기', e_tremor:'무기', e_plate:'수호',
    m_servo:'무기', m_amp:'무기', m_forge:'전술', m_battery:'보조', m_plate:'수호',
    p_lens:'무기', p_calm2:'보조', p_press:'전술', p_third:'전술', p_float:'보조',
    h_relic:'무기', h_choir:'무기', h_grace:'보조', h_armor:'수호', h_wrath:'전술',
    g_dense:'무기', g_field:'운명', g_mass:'전술', g_anchor:'수호', g_lens:'전술',
    c_wind:'보조', c_split:'무기', c_dilate:'수호', c_loop:'보조', c_after:'수호',
    b_thick:'전술', b_mark:'무기', b_boil:'무기', b_iron:'수호', b_thirst:'금단',
  };

  // 잭팟 카드 — 아주 낮은 확률로 등장하는 파격 보상
  const JACKPOTS = [
    { key:'j_weapon', name:'오버클럭 코어', desc:'보유한 모든 무기 +1레벨',
      apply:(p)=>{ for (const w of p.weapons){ if (w.lv<5) w.lv+=1; } renderWeaponRow(); } },
    { key:'j_chest',  name:'보물 지도', desc:'근처에 보물상자 2개가 떨어진다',
      apply:(p)=>{ for (let i=0;i<2;i++) dropItem(p.x+(Math.random()*120-60), p.y+(Math.random()*120-60), 'chest'); } },
    { key:'j_awaken', name:'완전 각성', desc:'공격 +15%, 쿨다운 -10%, 이동속도 +8%',
      apply:(p)=>{ p.dmgMult*=1.15; p.cdr*=0.9; p.speed*=1.08; } },
    { key:'j_life',   name:'생명의 샘', desc:'최대체력 +40, 완전 회복, 재생 +1',
      apply:(p)=>{ p.maxHp+=40; p.hp=p.maxHp; p.regen+=1; } },
  ];

  function ownedWeapon(key){
    for (const w of player.weapons){ if (w.key===key) return w; }
    return null;
  }
  // 봉인 해제: 성장무기는 런 시작 시 봉인 상태 — 이 판의 처치 수로 서서히 본래 힘을 되찾는다
  // (메타 성장이 높을수록 '상한'이 높아질 뿐, 초반 난이도를 부수지 않음)
  // ---------- 에고 무기: 무명검은 말이 많다 (수백 년 잠들었더니 수다스러움) ----------
  const EGO_IDLE = [
    '...심심하다.', '주인. 오늘 저녁 뭐 먹을 거냐.', '방금 그건 좀 위험했다.', '네 등이 너무 허술하다.',
    '월급날은 아직인가.', '요즘 물가에 비하면 골드가 너무 안 모인다.', '연애는 하고 다니냐.', '어제보다 좀... 무거워진 것 같다. 너 말이다.',
    '운동 좀 해라. 휘두르는 팔이 후들거린다.', '나 정도 되는 검이 왜 너 같은 놈 손에...', '아니다. 방금 말은 취소한다.',
    '적이 많다는 건 좋은 거다. 경험치니까.', '왼쪽. 아니 오른쪽. 아무튼 피해라.', '이 속도면 오늘 안에 집에 가긴 글렀군.',
    '내가 전성기였을 땐 이것보다 100배는 많았다.', '너 지금 도망친 거냐? 전략적 후퇴라고 해두자.',
    '보험은 들어놨냐. 아, 죽으면 소용없나.', '커피 한 잔 하고 싶군. 검이지만.', '주말에도 일하는 기분이군.',
    '너의 대시는 예측이 너무 쉽다.', '적금은 붓고 있냐. 골드 말고 현실 돈.', '살려는 의지는 높이 산다.',
    '슬슬 각성해야 하는데. 나 말고 너.', '엄살 부리지 마라. 아직 체력 남았다.', '방금 스킬은 좀 멋있었다. 조금.',
    '검한테 말 시키지 말고 앞이나 봐라.', '휴가... 그게 뭐였지.', '네 빌드 그거 맞냐? 인터넷 찾아봐라.',
    '점심 메뉴 고민할 시간에 한 마리 더 잡아라.', '나를 더 갈아라. 아프지 않다. 아마도.',
    '카드값 결제일이 다가온다... 아 이건 내 기억이 아니군.', '전 주인은 너보다 검을 잘 닦았다.',
    '요즘 검들은 소켓이니 옵션이니... 나 때는 날 하나로 승부했다.', '너 방금 하품했나? 전장에서?',
    '통장을 보고도 그렇게 태연할 수 있다니 대단하군.', '적게 일하고 많이 잡아라.',
    '내가 말이 많은 건 수백 년 묻혀 있었기 때문이다. 이해해라.', '오늘 걸음 수는 채웠겠군. 그건 인정.',
    '눈앞의 적보다 무서운 건 다음 달 공과금이다.', '헬스장 등록만 하고 안 간 지 몇 달째냐.',
    '연락 안 하는 친구는 손절이 아니라 자연사다.', '너의 최고 기록, 내가 다 봤다. 별거 없더군.',
    '적이 몰려온다. 월요일 아침처럼.', '지금 뛰는 건 운동이 아니라 도망이다.',
    '침착해라. 통장 잔고 볼 때처럼.', '그 장비 진짜 쓸 거냐? 패션이냐?',
    '내 이름을 지어줄 생각은 없나. 아, 무명검이 이름이군. 성의 없기는.',
    '휴대폰 그만 보고— 아 여긴 게임이었지.', '삶은 짧다. 쿨다운은 길고.',
    '너 정도면 잘하고 있다. 검이 하는 위로다. 새겨들어라.', '가끔은 지는 것도 경험치다. 가끔은.',
    '집중력이 3초짜리군. 붕어냐.', '이 판 끝나면 물 마셔라. 인간은 그런 게 필요하다지.',
    '보스가 이명을 달고 나오면 도망쳐도 된다. 아무도 뭐라 안 한다. 내가 뭐라 하겠지만.',
    '경험치 구슬 놓쳤다. 방금. 두 개나.', '어깨 펴라. 새우처럼 굽었다.',
    '적금 깨서 산 게 겨우 리롤이냐.', '너의 회피율은 네 인생의 책임 회피율보다 낮다.',
    '숫자가 커지는 게임은 좋은 게임이다. 인생과 다르게 정직하지.', '오늘도 야근이군. 게임 속에서까지.',
    '검에게도 주말은 필요하다.', '다음 생엔 방패로 태어나고 싶군. 맞는 건 네가 해라.',
    '지금 빌드로 끝까지 갈 생각이냐? 용감하군.', '설거지는 하고 나온 거냐.',
    '데드라인은 마감의 화신만의 얘기가 아니다. 네 얘기다.', '숨은 쉬면서 해라.',
    '이 정도 물량이면 특근 수당을 받아야 한다.', '방금 그 회피, 우연이었지? 다 안다.',
  ];
  const EGO_FEVER = [
    '좋아, 물이 올랐군! 그대로 썰어라!', '피버다! 월급날 기분이 이런 건가!', '지금이다! 생각은 나중에!',
  ];
  const EGO_RARE = [
    '오... 그거 비싸 보이는군. 내 옆에 두지 마라. 비교된다.', '팔지 마라. 절대 팔지 마라.', '운을 여기서 다 쓰는군. 내일 조심해라.',
  ];
  const EGO_LOWHP = [
    '어이, 죽지 마라. 나 또 땅에 묻히기 싫다.', '체력 관리도 실력이다!', '도망쳐라! 부끄러운 게 아니다!',
    '이래서 보험 들어두라고 했지 않나!', '숨 쉬어라 주인. 심호흡. 들이쉬고—',
  ];
  const EGO_LEVELUP = [
    '오. 조금은 쓸만해졌군.', '그래도 아직 내 전성기의 3%다.', '좋아. 다음 봉인이 근질거린다.',
    '이 힘... 그리웠다.', '더. 더 잡아라. 몇백 마리쯤은 잡아야 눈이 떠진다.',
  ];
  const EGO_BOSS = [
    '저놈 이명 봤나? 웃기지도 않는군.', '큰 놈이다. 월급 루팡처럼 생겼군.', '집중해라. 저건 읽씹하면 안 되는 상대다.',
  ];
  let egoT = 0, keyHintUntil = 30;
  let egoBubble = null; // { text, t } — 검에서 직접 나오는 말풍선
  function egoSay(pool){
    const line = pool[(Math.random()*pool.length)|0];
    egoBubble = { text: line, t: 4.6 };
  }
  function tickEgo(dt){
    if (!ownedWeapon('nameless')) return;
    egoT -= dt;
    if (egoT <= 0){
      egoT = 26 + Math.random()*30;
      if (player.hp < player.maxHp*0.3) egoSay(EGO_LOWHP);
      else if (bosses.length>0 && Math.random()<0.4) egoSay(EGO_BOSS);
      else if (feverTimer>0 && Math.random()<0.6) egoSay(EGO_FEVER);
      else egoSay(EGO_IDLE);
    }
  }
  // 봉인 곡선: 레벨이 오를수록 요구 처치 수가 폭증 (2렙 ~55킬 → 5렙 ~880킬 → 7렙 ~2000킬)
  function growthEffLv(){
    const full = DB.growth.lv||1;
    if (!player) return full;
    return Math.min(full, 1 + Math.floor(Math.sqrt(killCount/55)));
  }
  function gwepEffLv(full){
    if (!player) return full;
    return Math.min(full, 1 + Math.floor(Math.sqrt(killCount/45)));
  }
  // 유일무기 진화: 성장 레벨에 따라 이름이 바뀐다 (각성 → 진각성)
  Object.defineProperty(WEAPONS.nameless, 'name', { get(){
    const l = (DB.growth&&DB.growth.lv)||1;
    const base = l>=100?'시원의 검·귀일' : l>=60?'무극검·초월' : l>=35?'진명검·현신' : l>=20?'명검·해방' : l>=10?'무명검·각성' : '무명검';
    const bt = (player&&player.growthBranch) ? '['+GROWTH_BRANCHES[player.growthBranch].tag+'] ' : '';
    return bt + base;
  }});
  Object.defineProperty(WEAPONS.gbow, 'name', { get(){
    const l = (DB.gweps&&DB.gweps.bow.lv)||1;
    return l>=100?'침묵하는 활·종언' : l>=60?'침묵하는 활·극의' : l>=30?'침묵하는 활·진각성' : l>=15?'침묵하는 활·각성' : '침묵하는 활';
  }});
  Object.defineProperty(WEAPONS.gtome, 'name', { get(){
    const l = (DB.gweps&&DB.gweps.tome.lv)||1;
    return l>=100?'굶주린 마도서·종언' : l>=60?'굶주린 마도서·극의' : l>=30?'굶주린 마도서·진각성' : l>=15?'굶주린 마도서·각성' : '굶주린 마도서';
  }});
  Object.defineProperty(WEAPONS.gblade, 'name', { get(){
    const l = (DB.gweps&&DB.gweps.blade.lv)||1;
    return l>=100?'핏빛 대검·종언' : l>=60?'핏빛 대검·극의' : l>=30?'핏빛 대검·진각성' : l>=15?'핏빛 대검·각성' : '핏빛 대검';
  }});
  const GROWTH_GATE_LVS = [9,19,34,59,99]; // 이 레벨에서는 각성 의식(영구 강화 탭)으로만 돌파 가능
  function growthTierToast(lv){
    if (lv===10) toast('⚔ 무명검이 각성했다 — [무명검·각성]');
    else if (lv===20) toast('⚔ 검이 이름을 얻었다 — [명검·해방]');
    else if (lv===35) toast('⚔ 진각성! — [진명검·현신]');
    else if (lv===60) toast('⚔ 초월! — [무극검·초월]');
    else if (lv===100) toast('⚔ 궁극의 경지 — [시원의 검·귀일]');
  }
  // 무명검 성장 (영구)
  function addGrowthXp(n){
    if (!DB.growth.found) return;
    if (player && player.gwXp2) n *= 2; // 명검 공명
    DB.growth.xp += n;
    const need = 20 + DB.growth.lv*15;
    if (DB.growth.xp >= need){
      if (GROWTH_GATE_LVS.includes(DB.growth.lv)){ DB.growth.xp = need; return; } // 격의 벽 — 각성 의식 필요
      DB.growth.xp -= need;
      DB.growth.lv += 1;
      if (DB.growth.lv >= 20) unlockAch('gw20');
      if (player) addTextNum(player.x, player.y-30, '무명검 Lv'+DB.growth.lv);
      toast('무명검이 성장했다 — Lv'+DB.growth.lv);
      SFX.play('quest');
      saveDB();
    }
  }
  function activeSpecTrees(){
    return SPEC_TREES.filter(t=> (player.tech[t]||0) > 0);
  }

  function rollUpgrades(n){
    const pool = [];

    // weapon options
    for (const w of player.weapons){
      if (w.lv < 5 && !w.evolved){
        const def = WEAPONS[w.key];
        pool.push({
          key:'wl_'+w.key, kind:'weaponlv',
          name:def.name+' Lv'+(w.lv+1), tag:'무기 강화',
          desc:def.lvDesc[w.lv] || '무기 강화',
          apply:()=>{ w.lv+=1; renderWeaponRow(); }
        });
      }
    }
    // ⚡ 강림 속성 확정 — 반드시 무기 카드 생성보다 먼저! (순서 버그: 무기 각인이 직전 강림을 참조하던 근본 원인)
    {
      const actives0 = activeSpecTrees();
      const lockOthers0 = actives0.length >= (player.attrLimit||3);
      const candidates0 = lockOthers0 ? actives0 : SPEC_TREES.slice();
      if (focusOverride && candidates0.includes(focusOverride)){ focusTree = focusOverride; }
      else focusTree = candidates0.length ? candidates0[(Math.random()*candidates0.length)|0] : null;
      focusOverride = null;
    }
    if (player.weapons.length < (player.weaponCap||MAX_WEAPONS)){
      // 성장무기를 들고 있으면 일반 새 무기 제안 중단 (성장무기 중심 빌드로 — 사용자 요청)
      const hasGrowth = ownedWeapon('nameless') || ownedWeapon('gbow') || ownedWeapon('gtome') || ownedWeapon('gblade');
      Object.keys(WEAPONS).forEach((key)=>{
        // 성장무기는 장비탭에서 장착하는 방식 — 카드로는 등장하지 않음
        if (['nameless','gbow','gtome','gblade'].includes(key)) return;
        if (hasGrowth) return; // 성장무기 소지 시 일반 새 무기도 미등장
        if (!ownedWeapon(key) && !banned.has('wn_'+key)){
          const def = WEAPONS[key];
          // 무기 희귀도: 카드 등급이 시작 레벨을 결정 (희귀+ → Lv2, 전설 → Lv3)
          const wri = rollCardRarity();
          const startLv = 1 + (wri>=2?1:0) + (wri>=4?1:0);
          // 속성 각인 무기: 강림 속성이 각인 가능 원소면 그 속성이 깃든 채로 나온다
          const imbEl = (focusTree && {fire:1,frost:1,volt:1,acid:1,boom:1}[focusTree]) ? focusTree : null;
          pool.push({
            key:'wn_'+key, kind:'weaponnew', rarity:wri, elc: imbEl,
            name: (imbEl ? TREES[imbEl].name+' ' : '') + def.name + (startLv>1 ? ' Lv'+startLv : ''),
            tag: imbEl ? TREES[imbEl].name+' 병기' : '새 무기',
            desc: def.desc + (imbEl ? ' ['+TREES[imbEl].name+' 각인 상태로 획득]' : '') + (startLv>1 ? ' (등급 보너스: Lv'+startLv+' 시작)' : ''),
            apply:()=>{
              addWeapon(key);
              const w2 = player.weapons[player.weapons.length-1];
              if (w2){ w2.lv = Math.min(5, startLv); if (imbEl){ w2.imbue = imbEl; w2.imbueDmg = 1.1; } }
              renderWeaponRow();
            }
          });
        }
      });
    }

    // 무기 합성 — 진화 무기 2개를 한 슬롯으로 (한 판 1회)
    if (!player.fusedOnce && !banned.has('fusion')){
      const evolved = player.weapons.filter(w=>w.evolved && w.key!=='fusion');
      if (evolved.length>=2){
        const fa = evolved[0], fb = evolved[1];
        pool.push({
          key:'fusion', kind:'fusion', cap:true,
          name:'무기 합성', tag:'합성',
          desc:'['+WEAPONS[fa.key].evName+'] × ['+WEAPONS[fb.key].evName+'] — 두 무기가 한 슬롯으로 합쳐져 슬롯 1개가 비워집니다 (각 성능 85%)',
          apply:()=>{
            const fusion = { key:'fusion', lv:5, evolved:true, cd:0, angle:0, drones:[], parts:[fa, fb] };
            player.weapons = player.weapons.filter(w=>w!==fa && w!==fb);
            player.weapons.push(fusion);
            player.fusedOnce = true;
            questAdd('fuse', 1);
            unlockAch('fusion1');
            toast('무기 합성! '+WEAPONS[fa.key].evName+' × '+WEAPONS[fb.key].evName);
            SFX.play('evolve');
            renderWeaponRow();
          }
        });
      }
    }

    // 무기 속성 각인 — 보유한 원소 속성을 무기에 부여 (무기당 1회)
    const IMBUE_ELEMS = { fire:'지옥불', frost:'서리', volt:'번개', acid:'부식', boom:'폭발' };
    const imbuePool = activeSpecTrees().filter(t=>IMBUE_ELEMS[t]);
    if (imbuePool.length){
      for (const w of player.weapons){
        if (!w.imbue && w.key!=='aura' && w.key!=='lightning' && w.key!=='fusion' && !banned.has('im_'+w.key)){
          const elem = imbuePool[(Math.random()*imbuePool.length)|0];
          pool.push({
            key:'im_'+w.key, kind:'imbue',
            name:WEAPONS[w.key].name+' 각인', tag:'각인',
            desc:'['+IMBUE_ELEMS[elem]+'] 속성 부여 — 이 무기 타격 시 50% 확률 속성 발동, 피해 +10%',
            apply:()=>{ w.imbue=elem; w.imbueDmg=1.1; questAdd('imbue',1); unlockAch('imbue1'); renderWeaponRow(); }
          });
        }
      }
    }

    // tech options — 속성 강림 방식:
    // 레벨업마다 무작위 속성 1개가 '강림'하여 그 속성의 하위테크만 등장.
    // 3속성 확정 후에는 그 3개 중에서만 강림. 공통 트리는 항상 소량 등장.
    // (강림 확정은 무기 카드 생성 전에 이미 완료됨 — 위 참조)
    const SLOT_LIMIT = 5; // 트리당 하위테크 종류 슬롯 (신화 제외)
    // 공통 트리는 매 레벨업 2종만 무작위 등장 (강림 속성이 풀의 주인공이 되도록)
    const commonAllow = new Set();
    {
      const cn = TREES.common.nodes.filter(n=>!banned.has(n.key) && (player.techPicks[n.key]||0) < n.max);
      for (let i2=0;i2<2 && cn.length;i2++){ commonAllow.add(cn.splice((Math.random()*cn.length)|0,1)[0].key); }
    }
    Object.keys(TREES).forEach((tkey)=>{
      const tree = TREES[tkey];
      if (!tree.common && tkey !== focusTree) return;
      const pts = player.tech[tkey]||0;
      // 슬롯: 한 트리에서 서로 다른 테크는 5종까지 — 그 후엔 찍은 것만 성장
      const distinct = tree.common ? 0 : tree.nodes.filter(n=>(player.techPicks[n.key]||0)>0).length;
      for (const node of tree.nodes){
        if (banned.has(node.key)) continue;
        if (tree.common && !commonAllow.has(node.key)) continue;
        const picks = player.techPicks[node.key]||0;
        if (picks >= node.max) continue;
        if (!tree.common && !node.myth && picks===0 && distinct>=SLOT_LIMIT) continue;
        const gate = tree.common ? COMMON_GATE : TIER_GATE;
        if (node.tier>=2 && pts < (gate[node.tier]||99)) continue;
        // 신화 노드: 등급 고정 (트리당 유일한 빌드 정점)
        // 희귀도 바닥 잠금: 한 번 얻은 등급 아래로는 다시 안 나온다 — 위 등급은 확률대로 등장 가능
        const locked = player.cardRLock && player.cardRLock[node.key];
        let ri = node.myth ? 5 : rollCardRarity();
        if (!node.myth && locked!==undefined && picks>0 && ri<locked) ri = locked;
        let honed = false;
        if (!node.myth && picks>0 && ri<4 && Math.random()<0.25){ ri+=1; honed=true; }
        // 수확 체감: 같은 테크를 반복해서 찍을수록 효율이 65%씩 감소 (무한 성장 차단)
        const m = node.myth ? 1 : CARD_RARITY[ri].m * Math.pow(0.65, picks);
        const cat = node.myth ? '신화' : node.tier===3 ? '전용기' : (NODE_CAT[node.key]||'전술');
        pool.push({
          key:node.key, kind:'tech', tkey, node, rarity:ri, myth:!!node.myth,
          elc: tree.common ? null : tkey,
          name:node.name, tag:(tree.common ? tree.name : tree.name+' · '+cat) + (honed?' · 숙련':''),
          desc:node.desc(m), cap:node.tier===3,
          apply:()=>{
            node.apply(player, m);
            player.tech[tkey] = (player.tech[tkey]||0) + 1;
            player.techPicks[node.key] = picks + 1;
            (player.cardRLock = player.cardRLock||{})[node.key] = ri; // 희귀도 잠금
            if (!DB.seenTech) DB.seenTech = {};
            DB.seenTech[node.key] = true; // 테크 도감 기록
            if (node.myth) unlockAch('mythtech');
            renderTreeRow();
            checkComboTitle();
          }
        });
      }
    });

    // 직업 전용 테크 — 이 직업으로만 등장 (등급 확률 적용)
    const ctList = CLASS_TECH[player.classKey];
    if (ctList){
      for (const ct of ctList){
        if (banned.has(ct.key)) continue;
        const picks = player.techPicks[ct.key]||0;
        if (picks >= 4) continue;
        const lockedC = player.cardRLock && player.cardRLock[ct.key];
        let ri = rollCardRarity();
        if (lockedC!==undefined && picks>0 && ri<lockedC) ri = lockedC;
        const m = CARD_RARITY[ri].m * Math.pow(0.7, picks); // 수확 체감
        pool.push({
          key:ct.key, kind:'ctech', rarity:ri, ctag:true,
          name:ct.name, tag:CLASSES[player.classKey].name+' 전용',
          desc:ct.desc(m),
          apply:()=>{ ct.apply(player, m); player.techPicks[ct.key] = picks+1; (player.cardRLock=player.cardRLock||{})[ct.key]=ri; }
        });
      }
    }

    // 성장무기 전용 테크 — 무명검을 든 런에서만 등장 (이 판에서의 운용 방식 선택)
    if (ownedWeapon('nameless')){
      const GW_TECHS = [
        { key:'gw_hone',  name:'검기 연마', max:3, desc:(m)=>'무명검 피해 +'+R(12*m)+'%', apply:(p,m)=>{ p.gwDmg=(p.gwDmg||1)*(1+0.12*m); } },
        { key:'gw_multi', name:'잔영 검기', max:2, desc:(m)=>'검기 +1발', apply:(p,m)=>{ p.gwCount=(p.gwCount||0)+1; } },
        { key:'gw_soul',  name:'명검 공명', max:1, desc:(m)=>'이 판 동안 무명검 성장 경험치 2배', apply:(p,m)=>{ p.gwXp2=true; } },
        { key:'gw_haste', name:'검기 가속', max:2, desc:(m)=>'무명검 발사 간격 -'+R(8*m)+'%', apply:(p,m)=>{ p.gwCd=(p.gwCd||1)*(1-0.08*m); } },
      ];
      for (const gt of GW_TECHS){
        if (banned.has(gt.key)) continue;
        const picks = player.techPicks[gt.key]||0;
        if (picks >= gt.max) continue;
        const lockedG = player.cardRLock && player.cardRLock[gt.key];
        let ri = rollCardRarity();
        if (lockedG!==undefined && picks>0 && ri<lockedG) ri = lockedG;
        const m = CARD_RARITY[ri].m * Math.pow(0.7, picks); // 수확 체감
        pool.push({
          key:gt.key, kind:'gwtech', rarity:ri, ctag:true,
          name:'무명검 · '+gt.name, tag:'무기 강화 · 유일',
          desc:gt.desc(m),
          apply:()=>{ gt.apply(player, m); player.techPicks[gt.key] = picks+1; (player.cardRLock=player.cardRLock||{})[gt.key]=ri; }
        });
      }
    }

    // ultimate (전용기): 해금 전까지 반드시 등장, 이후 강화가 풀에 합류
    const ultDef = CLASS_ULTIMATES[player.classKey];
    let forced = null;
    if (ultDef){
      if (!player.ultReady){
        forced = { key:ultDef.key, kind:'ult', name:ultDef.name, tag:'전용기', desc:ultDef.desc, apply:()=>ultDef.unlock(player) };
      } else {
        pool.push({ key:ultDef.key+'_up', kind:'ult', name:ultDef.name+' 강화', tag:'전용기', desc:ultDef.strengthenDesc, apply:()=>ultDef.strengthen(player) });
      }
    }

    const out = [];
    let need = n;
    if (forced){ out.push(forced); need -= 1; }
    // 강림 보장: 강림한 속성의 노드가 최소 3장 (있는 만큼) 먼저 확정 — 속성이 진짜 주인공이 되도록
    // + 강림 중에는 다른 속성 카드를 풀에서 제거 (부식 강림인데 폭발이 나오는 혼선 방지 — 무속성·무기·전용기는 유지)
    if (focusTree){
      // 타 속성 테크 카드 + 타 속성 '각인' 무기 카드(elc) 모두 제거 — 강림 표기와 어긋난 카드 원천 차단
      for (let i=pool.length-1;i>=0;i--){
        if ((pool[i].tkey && pool[i].tkey!==focusTree) || (pool[i].elc && pool[i].elc!==focusTree)) pool.splice(i,1);
      }
      const focusIdx = [];
      for (let i=pool.length-1;i>=0;i--) if (pool[i].tkey===focusTree) focusIdx.push(i);
      let take = Math.min(3, focusIdx.length, need);
      while (take>0){
        const pick = focusIdx.splice((Math.random()*focusIdx.length)|0,1)[0];
        const cand = pool.splice(pick,1)[0];
        // splice로 인덱스가 밀리므로 남은 인덱스 보정
        for (let k=0;k<focusIdx.length;k++) if (focusIdx[k]>pick) focusIdx[k]-=1;
        out.push(cand); need -= 1; take -= 1;
      }
    }
    for (let i=0;i<need && pool.length;i++){
      const idx = (Math.random()*pool.length)|0;
      const cand = pool.splice(idx,1)[0];
      if (out.some(o=>o.key===cand.key)){ i--; continue; }
      out.push(cand);
    }

    // 잭팟: 초저확률로 마지막 슬롯이 잭팟 카드로 대체
    const jackpotChance = 0.025 * (1 + (player.luck-1)*0.5) * (player.jackpotMult||1);
    if (out.length>1 && Math.random() < jackpotChance){
      const j = JACKPOTS[(Math.random()*JACKPOTS.length)|0];
      out[out.length-1] = { key:j.key, kind:'jackpot', name:j.name, tag:'잭팟', desc:j.desc, rarity:4, jackpot:true, apply:()=>j.apply(player) };
    }

    for (let i=out.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const tmp=out[i]; out[i]=out[j]; out[j]=tmp; }
    return out;
  }

  // ---------- 런 계약 (아르카나) — 시작 시 선택하는 런 모디파이어 ----------
  const ARCANA = [
    { n:'피의 서약',  d:'회복 효과 없음 / 모든 피해 +40%', fx:(p)=>{ p.healMult=0; p.dmgMult*=1.4; } },
    { n:'황금 계약',  d:'골드 +60% / 경험치 -25%', fx:(p)=>{ p.goldMult*=1.6; p.xpMult=0.75; } },
    { n:'유리 대포',  d:'모든 피해 +30% / 최대체력 -30%', fx:(p)=>{ p.dmgMult*=1.3; p.maxHp=Math.max(30,Math.round(p.maxHp*0.7)); p.hp=Math.min(p.hp,p.maxHp); } },
    { n:'물량 계약',  d:'적 스폰 +50% / 경험치 +30%', fx:(p)=>{ p.hordeMod=1.5; p.xpMult=(p.xpMult||1)*1.3; } },
    { n:'강철 거북',  d:'받는 피해 -25% / 이동속도 -15%', fx:(p)=>{ p.dmgTaken*=0.75; p.speed*=0.85; } },
    { n:'도박사',     d:'카드 상위 등급 확률 2배 / 리롤·제외 불가', fx:(p)=>{ p.luck*=2; rerollsLeft=0; banishLeft=0; } },
    { n:'고행',       d:'무기 슬롯 3개 제한 / 모든 피해 +25%', fx:(p)=>{ p.weaponCap=3; p.dmgMult*=1.25; } },
    { n:'질풍 계약',  d:'적 이동속도 +20% / 내 이속 +15%, 대시 쿨다운 -15%', fx:(p)=>{ p.enemySpdMod=1.2; p.speed*=1.15; p.dashCdMax*=0.85; } },
    { n:'수전노',     d:'처치 골드 드랍 3배 / 회복 아이템 등장 안 함', fx:(p)=>{ p.goldDropMod=3; p.noHealDrops=true; } },
    { n:'침묵의 서약', d:'스킬(2~4번) 사용 불가 / 모든 피해 +35%', fx:(p)=>{ p.skillsSealed=true; p.dmgMult*=1.35; } },
    { n:'맨몸 수행',  d:'무기 슬롯 2개 제한 / 경험치 +40%', fx:(p)=>{ p.weaponCap=2; p.xpMult=(p.xpMult||1)*1.4; } },
    { n:'시한부 계약', d:'매 60초마다 최대체력 -5% / 피해 +30%', fx:(p)=>{ p.decayContract=true; p.dmgMult*=1.3; } },
    { n:'대식가 계약', d:'회복 +50% / 이동속도 -12%', fx:(p)=>{ p.healMult*=1.5; p.speed*=0.88; } },
    { n:'유령 계약',  d:'회피 +15% / 최대체력 -20%', fx:(p)=>{ p.dodge=Math.min(0.6,p.dodge+0.15); p.maxHp=Math.max(30,Math.round(p.maxHp*0.8)); } },
    { n:'폭풍 인도자', d:'웨이브 주기 -30% (더 자주) / 웨이브마다 골드 +15', fx:(p)=>{ p.stormCall=true; } },
    // v6.20 신규 — 독특한 계약들
    { n:'메아리 계약', d:'스킬 시전 시 30% 확률로 쿨다운 90% 환급 / 최대체력 -12%', fx:(p)=>{ p.echoCast=true; p.maxHp=Math.max(30,Math.round(p.maxHp*0.88)); p.hp=Math.min(p.hp,p.maxHp); } },
    { n:'야시장 계약', d:'떠돌이 상인 등장 주기 -40%, 가격 -30% / 골드 획득 -20%', fx:(p)=>{ p.merchantFreq=0.6; p.merchantDisc=(p.merchantDisc||1)*0.7; p.goldMult*=0.8; } },
    { n:'천공 계약',  d:'투사체 관통 +1 / 이동속도 -10%', fx:(p)=>{ p.pierce+=1; p.speed*=0.9; } },
    { n:'피뢰침 계약', d:'피격 시 강한 가시 반사 (80%) / 받는 피해 +10%', fx:(p)=>{ p.thorns=Math.max(p.thorns||0,0.8); p.dmgTaken*=1.1; } },
    { n:'거인 계약',  d:'몸집 +25% (잘 맞는다) / 모든 피해 +20%, 최대체력 +20%', fx:(p)=>{ p.r*=1.25; p.dmgMult*=1.2; p.maxHp=Math.round(p.maxHp*1.2); p.hp=p.maxHp; } },
    { n:'희극 계약',  d:'리롤 +3 / 최대체력 -15%', fx:(p)=>{ rerollsLeft+=3; p.maxHp=Math.max(30,Math.round(p.maxHp*0.85)); p.hp=Math.min(p.hp,p.maxHp); } },
    { n:'수집광 계약', d:'수집 범위 +80 / 대시 쿨다운 +20%', fx:(p)=>{ p.magnet+=80; p.dashCdMax*=1.2; } },
  ];
  // 히든 런 계약 — 낮은 확률(슬롯당 8%)로만 풀에 섞이는 강렬한 계약
  const HIDDEN_ARCANA = [
    { n:'🌙 월광 계약', d:'[히든] 화면이 상시 어둑하다 / 모든 피해 +50%', fx:(p)=>{ p.moonlight=true; p.dmgMult*=1.5; } },
    { n:'🃏 컬렉터의 광기', d:'[히든] 상자 결과 상향 + 상자 2배 가치 / 받는 피해 +25%', fx:(p)=>{ p.chestPlus=true; p.dmgTaken*=1.25; } },
    { n:'👻 영혼 거래', d:'[히든] 부활 +1회 / 최대체력 -40%', fx:(p)=>{ p.reviveLeft=(p.reviveLeft||0)+1; p.maxHp=Math.max(30,Math.round(p.maxHp*0.6)); p.hp=Math.min(p.hp,p.maxHp); } },
    { n:'😈 악마의 흥정', d:'[히든] 모든 피해 +60% / 회복 효과 없음, 이동속도 -10%', fx:(p)=>{ p.dmgMult*=1.6; p.healMult=0; p.speed*=0.9; } },
  ];
  // 중간 계약 — 4분/8분에 나타나는 추가 제약 제안 (수락할수록 위험하고 강해진다)
  const MID_CONTRACTS = [
    { n:'가속 조항',  d:'적 이동속도 +12% / 모든 피해 +14%', fx:(p)=>{ p.enemySpdMod=(p.enemySpdMod||1)*1.12; p.dmgMult*=1.14; } },
    { n:'피의 조항',  d:'회복 효과 -40% / 흡혈 +2', fx:(p)=>{ p.healMult*=0.6; p.lifesteal+=2; } },
    { n:'군중 조항',  d:'적 스폰 +35% / 경험치 +25%', fx:(p)=>{ p.hordeMod=(p.hordeMod||1)*1.35; p.xpMult=(p.xpMult||1)*1.25; } },
    { n:'유리 조항',  d:'받는 피해 +15% / 쿨다운 -12%', fx:(p)=>{ p.dmgTaken*=1.15; p.cdr*=0.88; } },
    { n:'궁핍 조항',  d:'골드 획득 -50% / 처형 임계 +5%p', fx:(p)=>{ p.goldMult*=0.5; p.execThresh=Math.min(0.4,p.execThresh+0.05); } },
    { n:'폭주 조항',  d:'적 피해 +20% / 공격속도 +15%', fx:(p)=>{ p.midEdmg=(p.midEdmg||1)*1.2; p.rateMult*=1.15; } },
  ];
  let midContractTimes = [240, 480], midContractIdx = 0;
  function openMidContract(){
    const pool2 = MID_CONTRACTS.slice();
    const opts = [];
    for (let i=0;i<3 && pool2.length;i++){
      const c = pool2.splice((Math.random()*pool2.length)|0,1)[0];
      opts.push({ l:c.n, d:c.d, fx:()=>{ c.fx(player); toast('추가 계약: '+c.n); SFX.play('quest'); } });
    }
    opts.push({ l:'거절한다', d:'추가 제약 없이 계속한다', fx:null });
    openEvent({ t:'중간 계약 — 어둠의 재협상', d:'그림자가 다시 나타나 새 조항을 내민다. 위험과 힘을 저울질하라.', opts });
  }
  function openArcanaChoice(){
    const pool = ARCANA.slice();
    const opts = [];
    for (let i=0;i<3;i++){
      // 히든 계약: 슬롯당 8% 확률로 희귀 계약이 대신 끼어든다
      if (Math.random()<0.08 && HIDDEN_ARCANA.length){
        const h = HIDDEN_ARCANA[(Math.random()*HIDDEN_ARCANA.length)|0];
        opts.push({ l:h.n, d:h.d, fx:()=>{ h.fx(player); toast('히든 계약 체결: '+h.n); unlockAch('hiddenpact'); SFX.play('evolve'); } });
        continue;
      }
      const a = pool.splice((Math.random()*pool.length)|0,1)[0];
      opts.push({ l:a.n, d:a.d, fx:()=>{ a.fx(player); toast('계약 체결: '+a.n); SFX.play('quest'); } });
    }
    // ⭐ 키스톤 대여: 미보유 변형·변혁 키스톤 하나를 이번 런만 체험 (35% 확률 등장)
    const rentPool = TRANSFORM_KEYS.concat([
      { id:'t2_bladewave', n:'검기 방출', d:'역장·낫 무기가 4초마다 검기 3발 발사 (근접 → 원거리)', ap:(B)=>{ B.bladeWave=true; } },
      { id:'t2_rapidfire', n:'광포화', d:'공격속도 +25% / 모든 피해 -15%', ap:(B)=>{ B.rate+=25; B.dmg-=15; } },
      { id:'t2_projleech', n:'마탄 흡혈', d:'투사체 명중 시 5% 확률 체력 +1', ap:(B)=>{ B.projLeech=true; } },
    ]).filter(tk=>!DB.star.nodes[tk.id]);
    if (rentPool.length && Math.random()<0.35){
      const tk = rentPool[(Math.random()*rentPool.length)|0];
      opts.push({ l:'⭐ 키스톤 대여: '+tk.n, d:'[1런 체험] '+tk.d+' — 마음에 들면 성도에서 정식 투자', fx:()=>{
        const B2 = {}; tk.ap(B2);
        if (B2.bloodRush) player.bloodRush=true;
        if (B2.shatter) player.shatter=true;
        if (B2.ultEcho) player.ultEcho=true;
        if (B2.shadowClone) player.shadowClone=true;
        if (B2.holyRet) player.holyRet=true;
        if (B2.goldPower) player.goldPower=true;
        if (B2.bladeWave) player.bladeWave=true;
        if (B2.projLeech) player.projLeech=true;
        if (B2.rate) player.rateMult*=1+B2.rate/100;
        if (B2.dmg) player.dmgMult*=1+B2.dmg/100;
        toast('⭐ 키스톤 대여: '+tk.n+' (이번 런 한정)');
        SFX.play('evolve');
      } });
    }
    opts.push({ l:'계약 없음', d:'모디파이어 없이 순수하게 진행한다', fx:null });
    openEvent({ t:'런 계약 선택', d:'이번 판 전체에 적용되는 계약입니다. 위험과 보상을 저울질하세요.', opts });
  }

  // ---------- 무명검 계보 (이 판에서 검을 어떻게 진화시킬지 — 매 런마다 새로 선택) ----------
  const GROWTH_BRANCHES = {
    slash: { n:'참격의 형(型)', d:'이 판 동안 검기 피해 +18% — 이름에 [참(斬)]', tag:'참' },
    gale:  { n:'질풍의 형(型)', d:'이 판 동안 발사 간격 -14%, 검기 +1 — 이름에 [풍(風)]', tag:'풍' },
    leech: { n:'흡명의 형(型)', d:'이 판 동안 처치 시 회복 +1 — 이름에 [명(命)]', tag:'명' },
  };
  function openGrowthBranch(){
    const opts = Object.keys(GROWTH_BRANCHES).map(bk=>{
      const br = GROWTH_BRANCHES[bk];
      return { l:br.n, d:br.d, fx:()=>{
        player.growthBranch = bk;
        toast('⚔ 형 개방 — '+br.n+'! (이 판 한정)');
        SFX.play('evolve');
      } };
    });
    opts.push({ l:'형을 개방하지 않는다', d:'다음 레벨업 후 다시 물어본다', fx:()=>{ pendingBranchAsk = true; } });
    openEvent({ t:'검이 형(型)을 묻는다', d:'해방된 검은 매 전장에서 다른 형태로 운용할 수 있다. 이번 판의 형을 선택하라.', opts });
  }
  let pendingBranchAsk = true;

  // ---------- 떠돌이 상인 — 런 중 골드를 쓸 곳 ----------
  const MERCHANT_OFFERS = [
    { n:'회복 팩',   cost:30, d:'체력 50% 회복', fx:()=>{ player.hp=Math.min(player.maxHp, player.hp+player.maxHp*0.5*Math.max(0.5,player.healMult)); SFX.play('pick'); } },
    { n:'무기 정비', cost:60, d:'무작위 무기 +1레벨', fx:()=>{
        const ws = player.weapons.filter(w=>w.lv<5 && w.key!=='fusion');
        if (ws.length){ const w=ws[(Math.random()*ws.length)|0]; w.lv+=1; toast(WEAPONS[w.key].name+' Lv'+w.lv); renderWeaponRow(); }
        else { runGold+=60; toast('강화할 무기가 없어 환불'); }
      } },
    { n:'전투 자극제', cost:50, d:'이번 판 공격력 +8%', fx:()=>{ player.dmgMult*=1.08; } },
    { n:'장비 상자',  cost:90, d:'무작위 장비 1개 (고급 확률↑)', fx:()=>{ addEquip(genEquip(2)); } },
    { n:'초강력 자석', cost:25, d:'필드의 모든 조각 수집', fx:()=>{ for (const o of orbs) o.magnetized=true; SFX.play('pick'); } },
    { n:'수상한 복권', cost:40, d:'50% 꽝 / 40% +100G / 10% 보물상자', fx:()=>{
        const r=Math.random();
        if (r<0.10){ dropItem(player.x+30, player.y, 'chest'); toast('당첨! 보물상자!'); SFX.play('win'); }
        else if (r<0.50){ const g=gainGold(100); toast('+'+g+'G!'); SFX.play('coin'); }
        else { toast('꽝...'); SFX.play('hit'); }
      } },
  ];
  function openMerchant(){
    const pool = MERCHANT_OFFERS.slice();
    const opts = [];
    // 유일 무기: 우연이 겹쳐야만 나타나는 물건 — 위험도 15+ & 업적 10+ & 상자와 동일한 0.001% 확률
    // 직업 계열마다 다른 모습으로 나타난다 (같은 물건, 다른 껍데기)
    if (!DB.growth.found && (DB.peril||0)>=15 && achCount()>=10 && Math.random()<0.00001){
      const cost0 = Math.round(500 * (player.merchantDisc||1));
      const GW_SHAPE = {
        war:{ n:'이 빠진 검자루', d:'"어느 무명 무사가 맡기고 찾아가질 않네. 살 거요?"' },
        rng:{ n:'뒤틀린 활대', d:'"시위를 걸어도 소리가 안 나. 이상한 물건이야. 살 거요?"' },
        mag:{ n:'젖은 마도서 뭉치', d:'"글자가 읽는 사람마다 다르게 보인다더군. 살 거요?"' },
        rog:{ n:'날 없는 단검', d:'"날이 없는데 손을 베였어. 꺼림칙해서 팔아치우려고. 살 거요?"' },
        pri:{ n:'금 간 성물', d:'"축성이 풀렸는데도 밤마다 빛이 새어나와. 살 거요?"' },
        mer:{ n:'녹슨 저울', d:'"뭘 올려도 같은 무게를 가리켜. 고물이지만... 살 거요?"' },
      }[classResGroup(player.classKey)] || { n:'고철 뭉치', d:'상인도 이게 뭔지 모른다. "살 거요?"' };
      opts.push({
        l:GW_SHAPE.n+' ('+cost0+'G)', d:GW_SHAPE.d,
        fx:()=>{
          if (runGold < cost0){ toast('골드 부족!'); SFX.play('hit'); return; }
          runGold -= cost0;
          DB.growth.found = true;
          saveDB();
          toast('무명검을 손에 넣었다! 레벨업에서 선택 가능');
          SFX.play('evolve');
          updateHud();
        }
      });
    }
    const offerN = opts.length>0 ? 2 : 3;
    for (let i=0;i<offerN;i++){
      const of = pool.splice((Math.random()*pool.length)|0,1)[0];
      const cost = Math.round(of.cost * 2 * (player.merchantDisc||1)); // 물가 2배 (골드 소모처) — 운명 '큰손' 할인 적용
      opts.push({
        l:of.n+' ('+cost+'G)', d:of.d,
        fx:()=>{
          if (runGold < cost){ toast('골드 부족!'); SFX.play('hit'); return; }
          runGold -= cost;
          of.fx();
          updateHud();
        }
      });
    }
    opts.push({ l:'떠난다', d:'아무것도 사지 않는다', fx:null });
    openEvent({ t:'떠돌이 상인', d:'"어서 오게. 좋은 물건이 있다네." (이번 판 골드로 구매)', opts });
  }

  // ---------- 조사 이벤트 (필드 탐색 선택지) ----------
  const FIELD_EVENTS = [
    { t:'떠돌이 서기관', d:'너덜너덜한 두루마리 뭉치를 든 서기관이 서 있다.', opts:[
      { l:'두루마리를 산다', d:'골드 -25 → 리롤 +2', fx:()=>{ if (runGold>=25){ runGold-=25; } else { DB.gold=Math.max(0,DB.gold-25); } rerollsLeft+=2; toast('리롤 +2!'); SFX.play('quest'); } },
      { l:'도장을 산다', d:'골드 -25 → 제외 +2', fx:()=>{ if (runGold>=25){ runGold-=25; } else { DB.gold=Math.max(0,DB.gold-25); } banishLeft+=2; toast('제외 +2!'); SFX.play('quest'); } },
      { l:'빼앗는다', d:'50% 리롤·제외 +1씩 / 50% 저주 (받는 피해 +10%)', fx:()=>{
          if (Math.random()<0.5){ rerollsLeft+=1; banishLeft+=1; toast('리롤·제외 +1!'); SFX.play('quest'); }
          else { player.dmgTaken*=1.1; toast('서기관의 저주...'); SFX.play('warn'); }
        } },
    ]},
    { t:'봉인된 신화 조각', d:'검은 돌에 미지의 문양이 새겨져 있다. 손을 대면 뜨겁다.', opts:[
      { l:'봉인을 뜯는다', d:'체력 -25% → 현재 최다 투자 속성 +2포인트', fx:()=>{
          player.hp = Math.max(1, player.hp - player.maxHp*0.25);
          let best=null, bp=0;
          for (const tk of SPEC_TREES){ const p2=player.tech[tk]||0; if (p2>bp){ bp=p2; best=tk; } }
          if (best){ player.tech[best]=(player.tech[best]||0)+2; toast(TREES[best].name+' 속성 +2P (신화가 가까워진다)'); SFX.play('quest'); }
          else { const g=gainGold(40); toast('공명 없음... +'+g+'G'); }
        } },
      { l:'놔둔다', d:'아무 일도 일어나지 않는다', fx:null },
    ]},
    { t:'수상한 자판기 2호', d:'"강화석 뽑기 — 한 번 40G" 라고 적혀 있다.', opts:[
      { l:'40G를 넣는다', d:'40% 강화석 / 60% 꽝', fx:()=>{ if (runGold>=40){ runGold-=40; } else { DB.gold=Math.max(0,DB.gold-40); } if (Math.random()<0.4){ dropItem(player.x+40, player.y, 'whet'); toast('강화석이 굴러나왔다!'); SFX.play('chest'); } else { toast('덜컹... 꽝.'); SFX.play('hit'); } } },
      { l:'흔들어본다', d:'20% 공짜 / 80% 적 습격', fx:()=>{ if (Math.random()<0.2){ dropItem(player.x+40, player.y, 'whet'); toast('공짜!'); SFX.play('chest'); } else { toast('경보 발동!'); for (let i=0;i<8;i++){ const a=(Math.PI*2/8)*i; enemies.push(makeEnemy('swarm', player.x+Math.cos(a)*200, player.y+Math.sin(a)*200, false)); } SFX.play('warn'); } } },
    ]},
    { t:'시간의 균열 조각', d:'공중에 작게 갈라진 틈. 시간이 새어나온다.', opts:[
      { l:'손을 넣는다', d:'50% 스킬 쿨다운 전부 초기화 / 50% 5초간 이속 -30%', fx:()=>{ if (Math.random()<0.5){ player.skCds=[0,0,0]; player.ultCooldown=0; toast('시간이 되감겼다!'); SFX.play('quest'); } else { tbuff('spd',0.7,5); toast('시간이 끈적하게 달라붙는다...'); SFX.play('warn'); } } },
      { l:'봉합한다', d:'경험치 소량', fx:()=>{ grantXp(Math.ceil(player.xpNext*0.3)); toast('균열 봉합 — 경험치 획득'); SFX.play('pick'); } },
    ]},
    { t:'낡은 게시판', d:'현상수배 전단이 붙어 있다. "이명 보스 처치 시 보상 두 배"', opts:[
      { l:'전단을 뜯는다', d:'다음 보스가 반드시 이명(강화)으로 등장 — 처치 골드 2배', fx:()=>{ player.bounty=true; toast('현상수배 수락 — 다음 보스가 강해져서 온다'); SFX.play('warn'); } },
      { l:'무시한다', d:'아무 일도 일어나지 않는다', fx:null },
    ]},
    { t:'버려진 보급상자', d:'먼지 쌓인 보급상자가 놓여 있다.', opts:[
      { l:'상자를 연다', d:'골드 +30~60', fx:()=>{ const g=gainGold(30+((Math.random()*31)|0)); toast('+'+g+'G'); SFX.play('coin'); } },
      { l:'지나친다', d:'아무 일도 일어나지 않는다', fx:null },
    ]},
    { t:'수상한 실험 장치', d:'웅웅거리는 장치가 가동을 기다린다.', opts:[
      { l:'가동한다', d:'무작위 무기 +1레벨 / 체력 -15%', fx:()=>{
          const ws = player.weapons.filter(w=>w.lv<5);
          if (ws.length){ const w=ws[(Math.random()*ws.length)|0]; w.lv+=1; toast(WEAPONS[w.key].name+' Lv'+w.lv+'!'); renderWeaponRow(); }
          player.hp = Math.max(1, player.hp - player.maxHp*0.15);
        } },
      { l:'파괴한다', d:'골드 +25', fx:()=>{ const g=gainGold(25); toast('+'+g+'G'); SFX.play('coin'); } },
    ]},
    { t:'응급 스테이션', d:'아직 작동하는 회복 장치를 발견했다.', opts:[
      { l:'치료를 받는다', d:'체력 40% 회복', fx:()=>{ player.hp=Math.min(player.maxHp, player.hp+player.maxHp*0.4); toast('체력 회복!'); SFX.play('pick'); } },
      { l:'부품을 회수한다', d:'폭탄 아이템 1개', fx:()=>{ dropItem(player.x+40, player.y, 'bomb'); toast('폭탄 획득 지점 생성'); } },
    ]},
    { t:'어둠의 거래', d:'그림자 속에서 목소리가 들린다. "힘을 원하나?"', opts:[
      { l:'계약한다', d:'최대체력 -10% / 공격력 +12%', fx:()=>{ player.maxHp=Math.max(30, Math.round(player.maxHp*0.9)); player.hp=Math.min(player.hp,player.maxHp); player.dmgMult*=1.12; toast('힘을 얻었다...'); } },
      { l:'거절한다', d:'아무 일도 일어나지 않는다', fx:null },
    ]},
    { t:'명상의 제단', d:'고요한 제단이 정신을 맑게 한다.', opts:[
      { l:'명상한다', d:'경험치 대량 획득', fx:()=>{ grantXp(Math.ceil(player.xpNext*0.8)); toast('경험치 획득!'); SFX.play('pick'); } },
      { l:'공물을 바친다', d:'골드 -30 → 전설급 공통 테크 1개', fx:()=>{
          if (runGold>=30){ runGold-=30; } else { DB.gold=Math.max(0,DB.gold-30); }
          const nodes = TREES.common.nodes;
          const node = nodes[(Math.random()*nodes.length)|0];
          node.apply(player, 4.5);
          toast('[전설] '+node.name+' 획득!'); SFX.play('quest');
        } },
    ]},
    { t:'고장난 자판기', d:'금이 간 자판기가 위태롭게 서 있다.', opts:[
      { l:'발로 찬다', d:'50% 골드 +60 / 50% 적 습격', fx:()=>{
          if (Math.random()<0.5){ const g=gainGold(60); toast('+'+g+'G!'); SFX.play('coin'); }
          else {
            toast('적 습격!'); SFX.play('warn');
            for (let i=0;i<6;i++){ const a=(Math.PI*2/6)*i; enemies.push(makeEnemy('swarm', player.x+Math.cos(a)*180, player.y+Math.sin(a)*180, false)); }
          }
        } },
      { l:'지나친다', d:'아무 일도 일어나지 않는다', fx:null },
    ]},
    { t:'수상한 뽑기 기계', d:'동전 투입구가 빛나고 있다.', opts:[
      { l:'골드 40을 넣는다', d:'60% 장비 / 30% 꽝 / 10% 전설 장비', fx:()=>{
          if (runGold>=40){ runGold-=40; } else { DB.gold=Math.max(0,DB.gold-40); }
          const roll = Math.random();
          if (roll<0.10){ const it=genEquip(4); it.r=4; addEquip(it); toast('전설 장비!!'); SFX.play('win'); }
          else if (roll<0.70){ addEquip(genEquip(1)); }
          else { toast('꽝...'); SFX.play('hit'); }
        } },
      { l:'무시한다', d:'아무 일도 일어나지 않는다', fx:null },
    ]},
    { t:'고대 룰렛', d:'낡은 룰렛이 돌아가길 기다린다. 결과는 아무도 모른다.', opts:[
      { l:'돌린다', d:'33% 최대체력 +25 / 33% 공격 +10% / 33% 습격+체력 -20%', fx:()=>{
          const roll = Math.random();
          if (roll<0.34){ player.maxHp+=25; player.hp=Math.min(player.maxHp,player.hp+25); toast('최대체력 +25!'); SFX.play('quest'); }
          else if (roll<0.67){ player.dmgMult*=1.10; toast('공격력 +10%!'); SFX.play('quest'); }
          else {
            player.hp = Math.max(1, player.hp - player.maxHp*0.2);
            toast('불운... 적 습격 + 체력 -20%'); SFX.play('warn');
            for (let i=0;i<8;i++){ const a=(Math.PI*2/8)*i; enemies.push(makeEnemy('normal', player.x+Math.cos(a)*200, player.y+Math.sin(a)*200, false)); }
          }
        } },
      { l:'떠난다', d:'아무 일도 일어나지 않는다', fx:null },
    ]},
  ];

  // ---------- run state ----------
  let state = 'idle'; // idle | playing | paused | levelup | event | dead | win
  let last = 0, raf = null;
  let elapsed = 0;
  let killCount = 0;
  let runGold = 0;
  let spawnTimer = 0;
  let pendingLevelUps = 0;
  let currentChoices = [];
  let rerollsLeft = 1, banishLeft = 2, banishMode = false;
  let banned = new Set();
  let shake = 0, freeze = 0;
  let totalDmg = 0, noHitT = 0, dashCount = 0;
  let combo = 0, comboTimer = 0, feverTimer = 0;
  let eliteCount = 0, waveCount = 0, surveyCount = 0, altarCount = 0;
  let altars = [], trialT = 0, trialKind = 'horde', eraTimer = 0;
  let merchants = [], merchantCount = 0;
  let slowmoT = 0, screenDimT = 0;
  let endless = false, rootDefeated = false, nextRootAt = 0;
  let currentEvent = null;

  let bossTimer = 0, bossSpawnedOnce = false, bossOrderIdx = 0, bossEncounterCount = 0;
  const BOSS_FIRST_AT = 55;
  const BOSS_INTERVAL = 80;
  const DOUBLE_BOSS_FROM = 3;
  const ELITE_FIRST_AT = 35, ELITE_INTERVAL = 32;
  const WAVE_FIRST_AT = 45, WAVE_INTERVAL = 45;
  const SURVEY_FIRST_AT = 25, SURVEY_INTERVAL = 45;

  let player, enemies, projectiles, orbs, particles, bosses, hostileShots, items, dmgNums, effects, hazards, surveys;

  function freshPlayer(){
    const p = {
      x:0, y:0, r:13,
      hp:0, maxHp: 80,
      speed: 150,
      vx:0, vy:0,
      dmgMult: 1,
      rateMult:1,
      cdr: 1,
      pierce:0,
      magnet: 70,
      regen: 0,
      goldMult: 1,
      luck:1,
      level:1, xp:0, xpNext:10,
      invuln:0, hitFlash:0, slowT:0, confuseT:0, knockX:0, knockY:0,
      classKey:null,
      critChance: 0.05, critMult:2,
      lifesteal:0, dodge:0, dmgTaken:1, healMult:1, facing:0, faceX:1,
      weapons:[],
      tech:{}, techPicks:{},
      // dash
      dashCd:0, dashCdMax:3.0, dashTime:0, dashDir:{x:1,y:0}, dashInvuln:0.30, dashHasteT:0,
      // equipment affixes (장비 적용 시 활성화)
      execThresh: 0,
      blastOnKill: false,
      thorns: 0,
      firstAid: false,
      overdrive: false,
      droneBoost:1,
      // tech ability state — 원소 속성
      burnChance:0, burnDps:0,
      fireballLv:0, fireballDmg:0, fireballT:2,
      firetrailLv:0, firetrailDps:0, firetrailT:0,
      inferno:0, infernoT:4,
      chillOn:false, chillPower:0.12,
      lanceLv:0, lanceDmg:0, lanceT:2,
      frostArmor:0,
      absZero:0, absZeroT:6,
      shockChance:0, shockDmg:0, chargeBoost:false, shockSureT:0,
      magfieldLv:0, magfieldDmg:0, magfieldT:2,
      thor:0, thorT:4,
      corrodeChance:0, corrodeMaxS:2, corrodeAmp:0.15, dissolveDps:0,
      acidLv:0, acidDps:0, acidT:3,
      collapse:false, collapseT:6,
      explodeChance:0, explodeDmg:0,
      mineLv:0, mineDmg:0, mineT:2,
      turretLv:0, turretDmg:0, turretRepoT:0, turrets:[], shadows:[], ghosts:[],
      necroChance:0, ghostCap:4, comboKeep:0, feverPlus:0, feverDmg:false, rageT:0,
      tbuffs:[], skills:[null,null,null], learned:[], skCds:[0,0,0], awakening:null, jobs:[],
      eliteDmg:1, bossDmg:1, // 등급 상대 피해 (엘리트·악몽 / 보스)
      acidBurst:false, chainPlus:0, frozenAmp:1, freezeBonus:0, turretRate:1, pulsePull:false, firetrailDur:1.6,
      ultChargedT:0, ultFireReq:false,
      projMult:1, odCd:0, odPower:0, odT:0, odTimer:5,
      orbital:0, orbitalT:0,
      pulseLv:0, pulseDmg:0, pulseT:0,
      shieldCdMax:0, shieldT:0, shieldReady:false,
      slowAll:1,
      dashBlast:0, blink:0,
      undyingRevive:false, undyingDR:0,
      reviveLeft: 0,
      // class ultimate
      ultReady:false, ultCooldown:0, ultCooldownMax:0,
      ultDamage:0, ultMult:0, ultRadius:0, ultFlash:0,
      ultVolleyCount:0, ultVolleyDmg:0
    };
    p.hp = p.maxHp;
    return p;
  }

  function addWeapon(key){
    if (player.weapons.length >= (player.weaponCap||MAX_WEAPONS)) return;
    player.weapons.push({ key, lv:1, evolved:false, cd:0.3, angle:Math.random()*Math.PI*2, drones:[] });
    renderWeaponRow();
  }

  const IMBUE_MARK = { fire:'화', frost:'설', volt:'뇌', acid:'식', boom:'폭' };
  function renderWeaponRow(){
    weaponRow.innerHTML = '';
    for (const w of player.weapons){
      const chip = document.createElement('div');
      chip.className = 'wchip' + (w.evolved?' ev':'');
      if (w.key==='fusion'){
        chip.innerHTML = '<b>융합: '+w.parts.map(p=>WEAPONS[p.key].name).join('×')+'</b>';
        weaponRow.appendChild(chip);
        continue;
      }
      const def = WEAPONS[w.key];
      let pips = '';
      for (let i=1;i<=5;i++) pips += '<span class="pip'+(i<=w.lv?' on':'')+'"></span>';
      const mark = w.imbue ? '<span style="background:var(--ink-900);color:var(--paper);border-radius:3px;padding:0 3px;font-size:8px;">'+IMBUE_MARK[w.imbue]+'</span>' : '';
      chip.innerHTML = mark+'<b>'+(w.evolved?def.evName:def.name)+'</b><span class="pips">'+pips+'</span>';
      weaponRow.appendChild(chip);
    }
  }
  function renderTreeRow(){
    treeRow.innerHTML = '';
    activeSpecTrees().forEach((t)=>{
      const chip = document.createElement('div');
      chip.className = 'tchip';
      if (COLORS[t]) chip.style.background = COLORS[t];
      chip.textContent = TREES[t].name+' '+(player.tech[t]||0);
      treeRow.appendChild(chip);
    });
  }

  function resetWorld(){
    MAP = MAPS[selMap]; PAL = MAP.pal;
    player = freshPlayer();
    player.x = 0; player.y = 0;
    enemies = []; projectiles = []; orbs = []; particles = [];
    bosses = []; hostileShots = []; items = []; dmgNums = []; effects = [];
    hazards = []; surveys = []; bossMines = []; zones = []; fmines = [];
    totalDmg = 0; noHitT = 0; dashCount = 0;
    elapsed = 0; killCount = 0; runGold = 0; spawnTimer = 0; pendingLevelUps = 0;
    shake = 0; freeze = 0;
    combo = 0; comboTimer = 0; feverTimer = 0;
    eliteCount = 0; waveCount = 0; surveyCount = 0; altarCount = 0;
    altars = []; trialT = 0; slowmoT = 0; screenDimT = 0; eraTimer = 0;
    merchants = []; merchantCount = 0;
    clients = []; clientCount = 0; runQuest = null;
    pendingSkills = []; pendingAwaken = false; pendingJobs = [];
    rifts = []; riftCount = 0; rift = null;
    nextSurveyAt = SURVEY_FIRST_AT; nextAltarAt = 60; nextRiftAt = 110;
    bossPool = [];
    pendingBranchAsk = true;
    midContractIdx = 0;
    egoT = 12; keyHintUntil = 30;
    waveModeRun = waveModePending; sprintWave = 0;
    runFinalAt = waveModeRun ? 380 : MAP.finalAt;
    endless = false; rootDefeated = false; nextRootAt = 0;
    currentEvent = null;
    rerollsLeft = 1;
    banishLeft = 2; banishMode = false; banned = new Set();
    bossTimer = 0; bossSpawnedOnce = false; bossOrderIdx = 0; bossEncounterCount = 0;
    bossBar.style.display = 'none';
    comboTag.style.display = 'none';
    renderWeaponRow();
    renderTreeRow();
    updateHud();
  }

  function updateHud(){
    lvVal.textContent = player.level;
    xpFill.style.width = Math.min(100, (player.xp/player.xpNext)*100) + '%';
    hpFill.style.width = Math.max(0, (player.hp/player.maxHp)*100) + '%';
    dashFill.style.width = Math.max(0, Math.min(1, 1 - player.dashCd/player.dashCdMax))*100 + '%';
    timeVal.textContent = fmtTime(elapsed);
    killVal.textContent = killCount;
    goldStatVal.textContent = runGold;
    const wv = $('waveVal'); if (wv) wv.textContent = waveModeRun ? sprintWave+'/8' : waveCount;
    // 키 안내: 초반엔 선명 → 반투명 → 소멸, H로 다시 표시
    const kh = $('keyHints');
    if (kh){
      const show = elapsed < keyHintUntil;
      kh.style.display = 'block';
      kh.style.opacity = show ? (elapsed < 18 ? 0.92 : 0.85) : (elapsed < keyHintUntil + 14 ? 0.3 : 0);
    }
    // 스킬바 (플레이 중 표시)
    const sb = $('skillBar');
    sb.style.display = (state==='playing'||state==='paused') ? 'flex' : 'none';
    const mm = $('mobMenu');
    if (mm) mm.style.display = (state==='playing'||state==='paused') ? 'flex' : 'none';
    const chips = sb.querySelectorAll('.skillChip');
    const cds = [player.ultReady ? player.ultCooldown : -1, player.skCds[0], player.skCds[1], player.skCds[2]];
    chips.forEach((ch,i)=>{
      if (i===0){
        if (!player.ultReady){ ch.disabled=true; ch.classList.remove('ready'); return; }
        ch.disabled = false;
        ch.innerHTML = '1<span style="font-size:8px;display:block;">궁극</span>';
      } else {
        const sk = player.skills[i-1];
        if (!sk){ ch.disabled=true; ch.classList.remove('ready'); ch.innerHTML = i+1+'<span style="font-size:8px;display:block;">—</span>'; return; }
        ch.disabled = false;
        ch.innerHTML = (i+1)+'<span style="font-size:8px;display:block;">'+sk.n.slice(0,3)+'</span>';
      }
      const ready = cds[i] <= 0;
      ch.classList.toggle('ready', ready);
      ch.style.opacity = ready ? '1' : '0.55';
    });
    // 전용기 Q 버튼 (해금 시 표시, 준비되면 직업 색 테두리)
    const ub = $('ultBtn');
    if (player.ultReady){
      ub.style.display = 'flex';
      const ready = player.ultCooldown<=0;
      ub.style.borderColor = ready ? (CLASS_COLORS[player.classKey]||'#fff') : 'transparent';
      ub.style.background = ready ? 'rgba(32,33,36,0.95)' : 'rgba(32,33,36,0.5)';
    } else {
      ub.style.display = 'none';
    }
    // 다음 위협 카운트다운
    const nk = $('nextKey'), nv = $('nextVal');
    if (rift){
      nk.textContent = '◈균열';
      nv.textContent = (rift.mode==='kill' ? (killCount-rift.kills0)+'/'+rift.need+' ' : rift.mode==='elite' ? '정예 '+enemies.filter(e=>e.riftElite).length+'기 ' : rift.mode==='guard' ? '수문장 ' : '생존 ')+Math.ceil(rift.t)+'s';
    } else if (runQuest){
      const isGw = runQuest.type==='gwkill' || runQuest.type==='gwboss';
      nk.textContent = isGw ? '⚒시험' : '의뢰';
      const prog = runQuest.type==='kill' ? (killCount-runQuest.start)+'/'+runQuest.goal
                 : runQuest.type==='combo' ? combo+'/'+runQuest.goal
                 : runQuest.type==='gwkill' ? (killCount-runQuest.start)+'/'+runQuest.goal
                 : runQuest.type==='gwboss' ? '보스 '+((DB.prog.boss||0)-runQuest.bstart)+'/'+runQuest.goal
                 : '무피격';
      nv.textContent = prog + (isGw ? '' : ' '+Math.ceil(runQuest.t)+'s');
    } else if (trialT>0){
      nk.textContent = '시련'; nv.textContent = fmtTime(Math.ceil(trialT));
    } else if (bosses.length>0){
      nk.textContent = 'BOSS'; nv.textContent = '전투!';
    } else if (!rootDefeated && runFinalAt - elapsed <= (bossSpawnedOnce ? BOSS_INTERVAL - bossTimer : BOSS_FIRST_AT - elapsed)){
      nk.textContent = 'FINAL'; nv.textContent = fmtTime(Math.max(0, runFinalAt - elapsed));
    } else {
      nk.textContent = 'BOSS';
      const tRemain = bossSpawnedOnce ? (BOSS_INTERVAL - bossTimer) : (BOSS_FIRST_AT - elapsed);
      nv.textContent = fmtTime(Math.max(0, tRemain));
    }
  }

  // ---------- combo / fever ----------
  function addCombo(){
    combo += 1;
    comboTimer = 2.5 + (player ? (player.comboKeep||0) : 0);
    if (combo >= 15 && feverTimer <= 0){
      feverTimer = 6 + (player ? (player.feverPlus||0) : 0);
      comboTag.classList.add('fever');
      SFX.play('fever');
    }
    if (combo >= 50) unlockAch('fever50');
    if (combo >= 5){
      comboTag.style.display = 'block';
      comboNum.textContent = '×' + combo;
    }
  }
  function tickCombo(dt){
    if (comboTimer > 0){
      comboTimer -= dt;
      if (comboTimer <= 0){
        combo = 0;
        comboTag.style.display = 'none';
        comboTag.classList.remove('fever');
      }
    }
    if (feverTimer > 0){
      feverTimer -= dt;
      if (feverTimer <= 0) comboTag.classList.remove('fever');
    }
  }
  function feverRate(){ return feverTimer > 0 ? 1.4 : 1; }

  // ---------- damage numbers ----------
  function addDmgNum(x, y, val, crit){
    totalDmg += Math.max(0, Math.round(val));
    if (dmgNums.length > 80) dmgNums.shift();
    dmgNums.push({ x:x+(Math.random()*10-5), y:y-6, vy:-46, life:0.7, age:0, text:String(Math.round(val)), crit:!!crit });
  }
  function addTextNum(x, y, text){
    if (dmgNums.length > 80) dmgNums.shift();
    dmgNums.push({ x, y:y-6, vy:-40, life:0.9, age:0, text, crit:false, label:true });
  }

  function gainGold(v){
    // 경제 조정 2차: 전역 수급 -75% + 무한 모드(클리어 후)는 추가 -70% — 붕괴 상태 파밍 방지
    const g = Math.max(1, Math.round(v * 0.25 * (endless?0.3:1) * player.goldMult * MAP.mult.reward * perilR() * (feverTimer>0?2:1)));
    runGold += g;
    return g;
  }

  // ---------- enemies ----------
  // 위험도 (디아블로식 난이도): 적 강화 ×(1+0.35n), 보상 ×(1+0.25n)
  // 위험도 60단계: 20까지는 급하게, 그 이후는 완만하게 (하지만 끝없이) 오른다
  function perilE(){ const p=DB.peril||0; return 1 + 0.35*Math.min(p,20) + 0.32*Math.max(0,p-20); } // 고위험도 곡선 강화 — 성장이 세상을 이기지 못하게
  function perilR(){ const p=DB.peril||0; return 1 + 0.25*Math.min(p,20) + 0.12*Math.max(0,p-20); }
  // v4.4 난이도 재설계: 시간 + 플레이어 파워(레벨·테크·성장무기)에 함께 반응하는 적응형 곡선
  function powerScale(){
    if (!player) return 1;
    let pw = Math.max(0, player.level - 6) * 0.035;              // 레벨이 오를수록
    let tpts = 0; for (const k in player.tech) tpts += player.tech[k];
    pw += Math.max(0, tpts - 5) * 0.022;                          // 테크를 찍을수록
    if (ownedWeapon('nameless')) pw += growthEffLv() * 0.012;     // 성장무기가 깨어날수록
    pw += starSpent() * 0.006;                                    // 성도를 찍을수록 (승천 웹·시그니처 시대에 맞춰 반응 강화)
    pw += player.equipPower || 0;                                 // 장비를 갖출수록 (희귀도·강화 반영)
    // 성단 진화 + 승천반 전체 투자(내륜·외곽·3차·전직 가지)도 세상이 지켜본다 — 방대해진 성반에 맞춘 반응
    const ascAll = ((player.ascTaken||[]).reduce((s,v)=>s+v,0))
      + ((player.ascTaken2||[]).reduce((s,v)=>s+v,0))
      + ((player.ascTaken3||[]).reduce((s,v)=>s+v,0))
      + ((player.jobBr && Object.values(player.jobBr).reduce((s,v)=>s+v,0))||0)
      + (player.ascSeal2?2:0) + (player.ascSeal3?3:0) + (player.ascAwakenTaken?3:0);
    pw += (player.csEvo||0) * 0.03 + ascAll * 0.015;
    return 1 + Math.min(2.3, pw);                                 // 최대 +230% — 운명이 커질수록 세상도 커진다
  }
  // v6.13 난이도 재상향: 웨이브 3부터는 무빙·기믹 없이는 절대 못 버틴다 (자동사냥 사형선고)
  function hpScale(){ return (1 + elapsed*0.027 + Math.pow(Math.max(0,elapsed-240)*0.0070,1.7)) * MAP.mult.ehp * perilE() * powerScale(); }
  function dmgScale(){ const p=DB.peril||0; return (1 + elapsed*0.0060 + Math.max(0,elapsed-300)*0.0038) * MAP.mult.edmg * (1 + 0.25*Math.min(p,20) + 0.15*Math.max(0,p-20)) * (0.85 + powerScale()*0.15) * ((player&&player.midEdmg)||1); }
  function spdScale(){ return 1 + Math.min(0.75, elapsed*0.0017); }
  function ringSpawnPos(minR, maxR){
    const a = Math.random()*Math.PI*2;
    const d = (minR||Math.hypot(W,H)/2+50) + Math.random()*((maxR||0)-(minR||0) > 0 ? (maxR-minR) : 60);
    return { x: player.x + Math.cos(a)*d, y: player.y + Math.sin(a)*d };
  }
  const ELITE_AFFIXES = {
    explode: '폭발', summon: '소환', dash: '돌진', barrage: '탄막', regen: '재생'
  };
  function makeEnemy(type, x, y, elite){
    const s = hpScale(), ds = dmgScale();
    let e;
    if (type==='swarm'){
      e = { type, x,y, r:8, hp:7*s, maxHp:7*s, speed:95+Math.random()*26, dmg:5*ds, xpValue:1, hitCd:0 };
    } else if (type==='brute'){
      e = { type, x,y, r:24, hp:80*s, maxHp:80*s, speed:34+Math.random()*8, dmg:16*ds, xpValue:7, hitCd:0 };
    } else if (type==='shooter'){
      e = { type, x,y, r:12, hp:20*s, maxHp:20*s, speed:46+Math.random()*10, dmg:6*ds, xpValue:4, hitCd:0, fireTimer:1.2+Math.random() };
    } else if (type==='splitter'){
      e = { type, x,y, r:16, hp:30*s, maxHp:30*s, speed:48+Math.random()*14, dmg:10*ds, xpValue:4, hitCd:0 };
    } else if (type==='binder'){
      e = { type, x,y, r:13, hp:26*s, maxHp:26*s, speed:42+Math.random()*8, dmg:4*ds, xpValue:5, hitCd:0, fireTimer:1.6+Math.random() };
    } else if (type==='kamikaze'){
      e = { type, x,y, r:11, hp:14*s, maxHp:14*s, speed:120+Math.random()*20, dmg:6*ds, xpValue:3, hitCd:0, fuse:-1 };
    } else if (type==='fish'){
      e = { type, x,y, r:9, hp:10*s, maxHp:10*s, speed:130+Math.random()*20, dmg:6*ds, xpValue:1, hitCd:0 };
    } else if (type==='clone'){
      e = { type, x,y, r:16, hp:55*s, maxHp:55*s, speed:70+Math.random()*10, dmg:10*ds, xpValue:3, hitCd:0 };
    } else if (type==='treasure'){
      e = { type, x,y, r:17, hp:70*s, maxHp:70*s, speed:105, dmg:0, xpValue:6, hitCd:0, fleeT:15 };
    } else {
      e = { type:'normal', x,y, r:13, hp:16*s, maxHp:16*s, speed:54+Math.random()*20, dmg:9*ds, xpValue:2, hitCd:0 };
    }
    e.speed *= spdScale() * (player && player.enemySpdMod ? player.enemySpdMod : 1);
    e.skin = MAP.skins[e.type] || e.type;
    // 축복받은 몹 (1.5%): 금빛 오라, 처치 시 무작위 축복
    if (!elite && type!=='treasure' && Math.random()<0.015){
      e.blessed = true;
      e.hp *= 2.5; e.maxHp *= 2.5;
      e.xpValue *= 3;
    }
    // 몹 희귀도: 시간이 흐를수록 상위 등급 몹이 섞인다 (레벨업 파워커브 견제)
    if (!elite && !e.blessed && type!=='treasure'){
      if (elapsed > 420 && Math.random() < Math.min(0.10, 0.03 + (elapsed-420)*0.0002)){
        // 악몽 (보라 오라): 후반 정예급 일반몹
        e.grade = 2;
        e.hp *= 3.2; e.maxHp *= 3.2;
        e.dmg = Math.round(e.dmg*1.8);
        e.speed *= 1.12;
        e.xpValue *= 4;
        e.r *= 1.15;
      } else if (elapsed > 150 && Math.random() < Math.min(0.16, 0.05 + (elapsed-150)*0.0003)){
        // 베테랑 (진한 윤곽): 중반 강화몹
        e.grade = 1;
        e.hp *= 1.8; e.maxHp *= 1.8;
        e.dmg = Math.round(e.dmg*1.35);
        e.xpValue *= 2;
      }
    }
    if (elite){
      e.elite = true;
      e.hp *= 8; e.maxHp *= 8;
      e.r *= 1.35; e.speed *= 0.85;
      e.dmg = Math.round(e.dmg*1.5);
      e.xpValue *= 5;
      const keys = Object.keys(ELITE_AFFIXES);
      e.affix = keys[(Math.random()*keys.length)|0];
      e.affT = 2;
      e.dashT = 0; e.dashDir = null;
      // 엘리트 이름: 어픽스별 개성 부여
      const EN = { explode:'성질 급한 폭탄마', summon:'다단계 팀장', dash:'지각 5분 전', barrage:'민원 폭격기', regen:'불사신 야근러' };
      e.name = EN[e.affix] || '엘리트';
      // 후반 엘리트: 이중 어픽스 + 추가 체력 (7분 이후)
      if (elapsed > 420){
        e.affix2 = keys[(Math.random()*keys.length)|0];
        e.hp *= 1.5; e.maxHp *= 1.5;
      }
    }
    return e;
  }
  function spawnEnemy(){
    const p = ringSpawnPos();
    let type = 'normal';
    const r = Math.random();
    if (MAP.extraMob && elapsed>60 && r<0.09) type = MAP.extraMob;
    else if (elapsed>90 && r<0.17) type='splitter';
    else if (elapsed>50 && r<0.26) type='shooter';
    else if (elapsed>45 && r<0.38) type='brute';
    else if (r<0.66) type='swarm';
    enemies.push(makeEnemy(type, p.x, p.y, false));
  }
  function spawnElite(){
    const p = ringSpawnPos();
    const type = Math.random()<0.5 ? 'normal' : 'brute';
    const e = makeEnemy(type, p.x, p.y, true);
    enemies.push(e);
    bossWarn.textContent = '['+ELITE_AFFIXES[e.affix]+'] 엘리트 감지';
    bossWarn.style.opacity = '1';
    setTimeout(()=>{ bossWarn.style.opacity='0'; }, 1400);
    SFX.play('warn');
  }
  function spawnWave(){
    // 웨이브 3종 로테이션: 포위 링 / 돌격 대열 / 보물 골렘
    const variant = waveCount % 3;
    let warnText = '⚠ 대량 유입 감지';
    if (variant===0){
      const n = Math.min(40, 18 + Math.floor(elapsed/50)*4);
      for (let i=0;i<n;i++){
        const a = (Math.PI*2/n)*i;
        enemies.push(makeEnemy('swarm', player.x+Math.cos(a)*300, player.y+Math.sin(a)*300, false));
      }
    } else if (variant===1){
      // 돌격 대열: 한 방향에서 빠른 스웜이 밀려온다
      const a = Math.random()*Math.PI*2;
      const n = Math.min(30, 16 + Math.floor(elapsed/60)*3);
      for (let i=0;i<n;i++){
        const off = (i%5-2)*36, depth = Math.floor(i/5)*40;
        const px2 = player.x + Math.cos(a)*(420+depth) + Math.cos(a+Math.PI/2)*off;
        const py2 = player.y + Math.sin(a)*(420+depth) + Math.sin(a+Math.PI/2)*off;
        const e = makeEnemy('swarm', px2, py2, false);
        e.speed *= 1.6;
        enemies.push(e);
      }
      warnText = '⚠ 돌격 대열 접근';
    } else {
      // 보물 골렘: 도망다니는 황금 골렘 — 잡으면 대박, 15초 뒤 도주
      const p = ringSpawnPos(260, 360);
      enemies.push(makeEnemy('treasure', p.x, p.y, false));
      warnText = '💰 보물 골렘 출현! (15초)';
    }
    bossWarn.textContent = warnText;
    bossWarn.style.opacity = '1';
    setTimeout(()=>{ bossWarn.style.opacity='0'; }, 1600);
    SFX.play(variant===2 ? 'coin' : 'warn');
  }
  function spawnSurvey(){
    if (surveys.length >= 2) return;
    const p = ringSpawnPos(240, 420);
    surveys.push({ x:p.x, y:p.y, r:15, ev:(Math.random()*FIELD_EVENTS.length)|0 });
  }

  // ---------- 차원 균열 (미니 던전: 진입 → 시련 → 보상 → 복귀) ----------
  let rifts = [], riftCount = 0, rift = null;
  let nextSurveyAt = 25, nextAltarAt = 60, nextRiftAt = 110;
  const RIFT_MODES = [
    { key:'kill',   name:'섬멸',  d:(n)=>'35초 안에 '+n+'마리 처치' },
    { key:'live',   name:'생존',  d:()=>'몰려드는 적들 속에서 25초 생존' },
    { key:'elite',  name:'정예 사냥', d:()=>'40초 안에 정예 2기 처치' },
    { key:'guard',  name:'수문장', d:()=>'50초 안에 균열의 수문장 격파' },
  ];
  function spawnRift(){
    if (rifts.length >= 1 || rift) return;
    const p = ringSpawnPos(300, 460);
    rifts.push({ x:p.x, y:p.y, r:17 });
    toast('◈ 차원 균열이 열렸다 — 들어가면 시련이 시작된다');
    SFX.play('tele');
  }
  function enterRift(){
    const mode = RIFT_MODES[(Math.random()*RIFT_MODES.length)|0];
    const need = mode.key==='elite' ? 2 : 22 + Math.floor(elapsed/60)*4 + (DB.peril||0)*2;
    rift = { mode:mode.key, t:(mode.key==='live'?25:mode.key==='elite'?40:mode.key==='guard'?50:35), need, kills0:killCount, elite0:0, returnX:player.x, returnY:player.y };
    // 아득히 먼 별공간으로 이동 (무한 필드의 외딴 좌표)
    player.x += 50000; player.y += 50000;
    trialT = Math.max(trialT, rift.t); // 시련 스폰 2배 재활용
    for (let k=0;k<10;k++){ const a=(Math.PI*2/10)*k; enemies.push(makeEnemy(Math.random()<0.3?'fish':'swarm', player.x+Math.cos(a)*260, player.y+Math.sin(a)*260, false)); }
    if (mode.key==='elite'){ for (let k=0;k<2;k++){ const a=Math.random()*Math.PI*2; const e=makeEnemy('brute', player.x+Math.cos(a)*320, player.y+Math.sin(a)*320, true); e.riftElite=true; enemies.push(e); rift.elite0++; } }
    if (mode.key==='guard'){ spawnBoss('gatekeeper'); const gb=bosses[bosses.length-1]; if (gb) gb.riftBoss=true; }
    showBossBanner('차원 균열 — '+mode.name, '시련: '+mode.d(need), '#5c4a8a');
    toast('◈ 시련 시작! 성공 시 보물과 재료를 얻는다');
    screenDimT = Math.max(screenDimT||0, 0.4);
    SFX.play('warn');
  }
  function exitRift(success){
    player.x = rift.returnX; player.y = rift.returnY;
    player.invuln = Math.max(player.invuln, 1.5);
    // 균열 전용 보스·원격 몹 정리: 안에서 못 잡은 것은 바깥으로 따라오지 못한다
    for (let i=bosses.length-1;i>=0;i--){
      if (bosses[i].riftBoss || Math.hypot(bosses[i].x-player.x, bosses[i].y-player.y) > 5000) bosses.splice(i,1);
    }
    for (let i=enemies.length-1;i>=0;i--){
      if (Math.hypot(enemies[i].x-player.x, enemies[i].y-player.y) > 5000) enemies.splice(i,1);
    }
    refreshBossBar();
    if (success){
      dropItem(player.x+40, player.y, 'chest');
      DB.mats.shard += 1; saveDB();
      const g = gainGold(40+(DB.peril||0)*5);
      unlockAch('rift1');
      showBossBanner('시련 돌파', '보물상자 + 별의 조각 + '+g+'G', '#d9a53f');
      freeze = Math.max(freeze, 0.2);
      SFX.play('win');
    } else {
      toast('시련 실패... 균열이 닫혔다');
      SFX.play('warn');
    }
    rift = null;
  }
  function spawnAltar(){
    if (altars.length >= 1 || trialT > 0) return;
    const p = ringSpawnPos(280, 440);
    altars.push({ x:p.x, y:p.y, r:16 });
  }

  // ---------- field items ----------
  function dropItem(x, y, forceType){
    let type = forceType;
    if (!type){
      const r = Math.random();
      if (r<0.55) type='gold';
      else if (r<0.67) type='heal';
      else if (r<0.75) type='magnet';
      else if (r<0.80) type='bomb';
      else if (r<0.825) type='freeze';
      else if (r<0.833) type='scroll';   // 리롤 두루마리 (0.8%)
      else if (r<0.838) type='stamp';    // 제외 도장 (0.5%)
      else type='gold';
    }
    if (type==='heal' && player && player.noHealDrops) type = 'gold'; // 수전노 계약
    if (items.length > 30) items.shift();
    items.push({ type, x, y, r:9, age:0, value: type==='gold' ? (2+((Math.random()*3)|0)) : 0 });
  }
  function useItem(it){
    if (it.type==='gold'){
      const g = gainGold(it.value);
      addTextNum(it.x, it.y, '+'+g+'G');
      SFX.play('coin');
    } else if (it.type==='heal'){
      const hv = Math.round(25*player.healMult);
      player.hp = Math.min(player.maxHp, player.hp+hv);
      addTextNum(it.x, it.y, '+'+hv);
      SFX.play('pick');
    } else if (it.type==='magnet'){
      for (const o of orbs) o.magnetized = true;
      addTextNum(it.x, it.y, '자석!');
      SFX.play('pick');
    } else if (it.type==='freeze'){
      for (const e of enemies) e.frozenT = 3;
      addTextNum(it.x, it.y, '시간 정지!');
      effects.push({ type:'ring', x:player.x, y:player.y, life:0.5, age:0, r0:20, r1:400 });
      SFX.play('tele');
    } else if (it.type==='bomb'){
      const dmg = 130 * (1 + elapsed*0.006) * player.dmgMult;
      for (let i=enemies.length-1;i>=0;i--){
        const e = enemies[i];
        // 등급별 계수: 일반 100% / 축복 60% / 엘리트 35%
        const coef = e.elite ? 0.35 : e.blessed ? 0.6 : 1;
        e.hp -= dmg*coef;
        addDmgNum(e.x, e.y, dmg*coef, true);
        if (e.hp<=0) defeatEnemy(i);
      }
      for (let i=bosses.length-1;i>=0;i--){
        const b = bosses[i];
        b.hp -= dmg*0.2; // 보스 계수 하향 (폭탄으로 보스를 녹이지 못하게)
        addDmgNum(b.x, b.y, dmg*0.2, true);
        if (b.hp<=0) defeatBoss(i); else refreshBossBar();
      }
      burst(player.x, player.y, 40, 320);
      effects.push({ type:'ring', x:player.x, y:player.y, life:0.45, age:0, r0:30, r1:500 });
      shake = Math.min(24, shake+16);
      freeze = Math.max(freeze, 0.06);
      SFX.play('boom');
    } else if (it.type==='whet'){
      // 강화석: 장착 중인 무작위 장비를 즉석에서 +1 강화 (+9 한도)
      const eqs = Object.values(loadoutFor(player.classKey)).map(id=>DB.inv.find(v=>v.id===id)).filter(v=>v && (v.plus||0)<9);
      if (eqs.length){
        const tgt = eqs[(Math.random()*eqs.length)|0];
        tgt.plus = (tgt.plus||0)+1; saveDB();
        addTextNum(it.x, it.y, tgt.name+' +'+tgt.plus+'!');
        effects.push({ type:'rays', x:player.x, y:player.y, life:0.5, age:0 });
        SFX.play('evolve');
      } else {
        const g = gainGold(15); addTextNum(it.x, it.y, '+'+g+'G');
      }
    } else if (it.type==='scroll'){
      rerollsLeft += 1;
      addTextNum(it.x, it.y, '리롤 +1');
      SFX.play('quest');
    } else if (it.type==='stamp'){
      banishLeft += 1;
      addTextNum(it.x, it.y, '제외 +1');
      SFX.play('quest');
    } else if (it.type==='chest'){
      openChest(it.x, it.y);
    }
  }

  // ---------- treasure chest ----------
  function openChest(x, y){
    const candidates = player.weapons.filter(w => w.lv>=5 && !w.evolved);
    effects.push({ type:'rays', x, y, life:0.6, age:0 });
    // 유일 무기 발견 (0.001% & 위험도 40+ — 사실상 전설의 목격담)
    if (!DB.growth.found && (DB.peril||0)>=40 && Math.random()<0.00001){
      DB.growth.found = true;
      saveDB();
      addTextNum(x, y-14, '무명검 발견!');
      toast('상자 밑바닥에서 이름 없는 검을 발견했다...');
      SFX.play('evolve');
      return;
    }
    if (candidates.length){
      const w = candidates[(Math.random()*candidates.length)|0];
      w.evolved = true;
      const def = WEAPONS[w.key];
      addTextNum(x, y-10, '무기 진화!');
      bossWarn.textContent = '★ ' + def.name + ' → ' + def.evName + ' ★';
      bossWarn.style.opacity = '1';
      setTimeout(()=>{ bossWarn.style.opacity='0'; }, 2200);
      burst(x, y, 34, 280);
      freeze = Math.max(freeze, 0.09);
      shake = Math.min(20, shake+10);
      renderWeaponRow();
      questAdd('evolve', 1);
      unlockAch('evolve1');
      SFX.play('evolve');
      return;
    }
    let roll = Math.random();
    if (player.chestPlus) roll *= 0.6; // 수집가: 상자 결과가 한 단계 좋아진다
    if (roll < 0.28){
      // 장비 드랍 테이블: 유물 > 유니크 > 세트 > 태초 > 일반 생성 (전부 극악 — 위험도가 유일한 지렛대)
      const pr = DB.peril||0;
      let r2 = Math.random();
      if (player.chestPlus) r2 *= 0.6;
      // 상위 장비 드랍 반토막 + 유니크·태초는 위험도 30+ 전용 — 장비가 게임을 지배하지 못하게
      // 무한 모드(클리어 후)에는 유물·유니크·태초 봉인 — 붕괴 상태에서 상위템 파밍 금지
      if (!endless && r2 < 0.008) addEquip(genRelic());
      else if (!endless && pr>=30 && r2 < 0.008 + 0.0012 + pr*0.0006) addEquip(genUnique());
      else if (r2 < 0.008 + 0.0012 + pr*0.0006 + 0.012) addEquip(genSetItem());
      else if (!endless && pr>=30 && r2 < 0.008 + 0.0012 + pr*0.0006 + 0.012 + 0.0008 + pr*0.0004) addEquip(genPrimal());
      else addEquip(genEquip(1 + (MAP.mult.reward>1.4?1:0) + (MAP.mult.reward>2?1:0) + Math.floor(pr/2)));
    } else if (roll < 0.75){
      const lvable = player.weapons.filter(w => w.lv<5);
      if (lvable.length){
        const w = lvable[(Math.random()*lvable.length)|0];
        w.lv += 1;
        addTextNum(x, y-10, WEAPONS[w.key].name+' Lv'+w.lv);
        renderWeaponRow();
      } else {
        const g = gainGold(30); addTextNum(x, y-10, '+'+g+'G');
      }
    } else {
      const g = gainGold(25 + ((Math.random()*15)|0));
      addTextNum(x, y-10, '+'+g+'G');
    }
    burst(x, y, 16, 190);
    SFX.play('chest');
  }

  // ---------- kill handling ----------
  function defeatEnemy(idx){
    const e = enemies[idx];
    killCount += 1;
    addCombo();
    questAdd('kill', 1);
    // 사망 버스트: 몹 등급·타입 색으로 (엘리트 금색 / 악몽 보라 / 축복 노랑 / 타입 틴트)
    const deathTint = e.elite ? 0xd9a53f : e.grade===2 ? 0x5c4a8a : e.blessed ? 0xe8c56a
      : (ENEMY_TINTS[e.type] ? parseInt(ENEMY_TINTS[e.type].slice(1),16) : 0xbfc2c7);
    burst(e.x,e.y, e.elite?20:(e.type==='brute'?16:8), e.elite?230:(e.type==='brute'?200:130), deathTint);
    FX.puff(e.x, e.y, deathTint, e.r); // 디졸브 퍼프
    // 혈마 혈폭: 처치 시 핏빛 연쇄 폭발
    if (player.bloodBurstCh>0 && Math.random()<player.bloodBurstCh){
      friendlyBlast(e.x, e.y, 60, player.bloodBurstDmg*player.dmgMult, true);
      FX.puff(e.x, e.y, 0xc9403a, 16);
    }
    // 망자의 목자: 처치한 적이 유령이 된다
    if (player.necroChance>0 && Math.random()<player.necroChance && player.ghosts.length<player.ghostCap){
      player.ghosts.push({ x:e.x, y:e.y, t:8+(player.ghostDur||0), cd:0 });
      addTextNum(e.x, e.y-10, '起');
    }
    // 변혁 '파편 폭풍': 투사체 처치 시 파편 발사
    if (player.shatter){
      for (let k=0;k<2;k++){
        const a = Math.random()*Math.PI*2;
        projectiles.push({
          x:e.x, y:e.y, vx:Math.cos(a)*360, vy:Math.sin(a)*360,
          r:3, damage:8*player.dmgMult, crit:false, pierce:0, life:0.5, tracer:true
        });
      }
    }
    // 변혁 '침식 폭발' (부식 테크): 부식 중첩 적 사망 시 산성 폭발
    if (player.acidBurst && (e.corrodeS||0)>=2){
      effects.push({ type:'ring', x:e.x, y:e.y, life:0.3, age:0, r0:10, r1:72 });
      for (const o of enemies){
        if (o===e) continue;
        if (Math.hypot(o.x-e.x,o.y-e.y) < 72+o.r){
          o.hp -= 22*player.dmgMult;
          o.corrodeS = Math.min(player.corrodeMaxS,(o.corrodeS||0)+1);
          o.corrodeT = 5;
        }
      }
    }
    // 사망 파편 — 회전하며 흩어지는 조각들
    for (let k=0;k<3;k++){
      const a = Math.random()*Math.PI*2;
      particles.push({
        x:e.x, y:e.y,
        vx:Math.cos(a)*(90+Math.random()*90), vy:Math.sin(a)*(90+Math.random()*90)-40,
        life:0.5+Math.random()*0.2, age:0, r:2+Math.random()*2.5,
        shard:true, rot:Math.random()*Math.PI, vr:(Math.random()-0.5)*14
      });
    }
    orbs.push({ x:e.x, y:e.y, value:e.xpValue, r: e.elite?7:(e.xpValue>=4?6:5) });
    if (player.lifesteal>0){ healCapped(player.lifesteal*player.healMult); }

    // 장비특성: 폭발탄
    if (player.blastOnKill && Math.random()<0.10){
      const bd = 30*player.dmgMult;
      effects.push({ type:'ring', x:e.x, y:e.y, life:0.3, age:0, r0:8, r1:70 });
      for (let k=enemies.length-1;k>=0;k--){
        if (k===idx) continue;
        const o = enemies[k];
        if (Math.hypot(o.x-e.x,o.y-e.y) < 70+o.r){
          o.hp -= bd;
          addDmgNum(o.x,o.y,bd,false);
          if (o.hp<=0 && k<idx){ defeatEnemy(k); idx--; }
          else if (o.hp<=0) defeatEnemy(k);
        }
      }
    }

    if (e.type==='splitter'){
      for (let k=0;k<3;k++){
        const child = makeEnemy('swarm', e.x+(Math.random()*22-11), e.y+(Math.random()*22-11), false);
        child.hp = Math.max(4, child.hp*0.6); child.maxHp = child.hp;
        enemies.push(child);
      }
    }
    if (e.type==='treasure'){
      // 보물 골렘 처치: 대박 보상 + 고대 톱니
      questAdd('treasure', 1);
      DB.mats.gear += 1;
      toast('⚙ 고대 톱니 획득 ('+DB.mats.gear+')');
      const g = gainGold(35 + ((Math.random()*26)|0));
      addTextNum(e.x, e.y-20, '+'+g+'G!!');
      dropItem(e.x, e.y, 'chest');
      dropItem(e.x+30, e.y, 'gold');
      dropItem(e.x-30, e.y, 'gold');
      effects.push({ type:'rays', x:e.x, y:e.y, life:0.6, age:0 });
      freeze = Math.max(freeze, 0.06);
      SFX.play('win');
    }
    if (e.blessed){
      // 축복: 무작위 은총
      const br = Math.random();
      if (br<0.3){ tbuff('dmg',1.3,6); addTextNum(e.x,e.y-14,'✨ 힘의 축복'); }
      else if (br<0.55){ tbuff('rate',1.3,6); addTextNum(e.x,e.y-14,'✨ 신속의 축복'); }
      else if (br<0.8){ player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.15*player.healMult); addTextNum(e.x,e.y-14,'✨ 치유의 축복'); }
      else { rerollsLeft+=1; addTextNum(e.x,e.y-14,'✨ 운명의 축복 (리롤+1)'); }
      effects.push({ type:'ring', x:e.x, y:e.y, life:0.4, age:0, r0:10, r1:70 });
      SFX.play('quest');
    }
    if (e.elite){
      questAdd('elite', 1);
      if (Math.random()<0.12){
        DB.mats.shard += 1;
        toast('★ 별의 조각 획득 ('+DB.mats.shard+')');
      }
      if (Math.random()<0.55) dropItem(e.x, e.y, 'chest'); // 엘리트 상자도 확정 아님
      if (Math.random()<0.10) dropItem(e.x+30, e.y, 'whet'); // 강화석 (희귀)
      const g = gainGold(15 + ((Math.random()*10)|0));
      addTextNum(e.x, e.y-16, '+'+g+'G');
      freeze = Math.max(freeze, 0.05);
      SFX.play('boom');
    } else if (Math.random() < 0.009*player.luck){
      dropItem(e.x, e.y);
    } else if (Math.random() < 0.05*player.luck*(player.goldDropMod||1)){
      dropItem(e.x, e.y, 'gold');
    }
    enemies.splice(idx,1);
  }

  // ---------- bosses (15) ----------
  let bossPool = []; // 셔플된 보스 순서 (매판 랜덤)
  let bleedNext = false; // 차원 침식 표식
  function nextBossKey(){
    const list = MAP.bosses;
    // 차원 침식: 위험도 10+에서는 25% 확률로 다른 맵의 보스가 차원을 넘어 난입한다
    if ((DB.peril||0) >= 10 && Math.random() < 0.25){
      const foreign = Object.keys(BOSS_TYPES).filter(k=> !BOSS_TYPES[k].finale && k!=='gatekeeper' && !list.includes(k));
      if (foreign.length){
        const fk = foreign[(Math.random()*foreign.length)|0];
        setTimeout(()=>toast('⚠ 차원 침식 — 다른 세계의 보스가 넘어왔다!'), 600);
        bossOrderIdx += 1;
        bleedNext = true;
        return fk;
      }
    }
    // 랜덤 출현: 한 바퀴를 셔플해서 소진 — 같은 보스 연속 방지하면서 순서는 매판 다르게
    if (!bossPool.length){
      bossPool = list.slice();
      for (let i=bossPool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=bossPool[i]; bossPool[i]=bossPool[j]; bossPool[j]=t; }
    }
    bossOrderIdx += 1;
    return bossPool.shift();
  }
  // 코믹 칭호 — 등장 시 40% 확률로 붙고, 그 보스는 '이명 강화형'으로 강해진다
  const BOSS_COMIC = {
    oseojin:['정시 퇴근을 모르는','기념일을 또 까먹은','월급날만 기다리는'],
    parktaeyoung:['브레이크가 고장난','신호등을 못 본 척하는','환승연애 중인'],
    wonGeun:['회의만 7시간 하는','참조에 전부 다 넣는','밥 한번 먹자고만 하는'],
    minGi:['주말에도 출근하는','연차를 못 쓰는','답장이 늘 ㅇㅋ뿐인'],
    seulgi:['읽씹의 달인','썸만 5년째인','프사가 늘 뒷모습인'],
    byungWoo:['답장을 3일 뒤에 하는','더치페이 계산이 칼같은','축의금 액수를 고민하는'],
    jiEun:['다이어트는 내일부터인','새벽 배송을 매일 시키는','장바구니만 채우는'],
    eunJae:['화나면 아무도 못 말리는','기분이 태도가 되는','설거지 순서로 싸우는'],
    yuJinKong:['바람보다 말이 빠른','비밀을 3초 만에 퍼뜨리는','단톡방을 캡처하는'],
    jungWoo:['어제의 동료를 오늘 파는','회식에서만 착해지는','성과를 조용히 가로채는'],
    seonJeong:['통장 잔고가 마이너스인','할부가 12개월 남은','적금을 3일 만에 깬'],
    spaceStar:['별자리 운세를 맹신하는','MBTI로 사람을 거르는','타로 카드에 월급을 바친'],
    nukNukEX:['점심 메뉴를 2시간 고민하는','배달앱만 30분 보는','결정 장애가 온'],
    goDokGeun:['마흔살까지 장가 못 간','소개팅 100번 실패한','명절마다 추궁당하는'],
    monday:['주말을 순삭시키고 나타난','알람 5개를 뚫고 오는','출근길을 지배하는'],
    deadline:['어제까지였다고 말하는','금요일 6시에 일을 주는','내일의 나에게 미룬'],
    overtime:['저녁 약속을 증발시키는','내일 아침에도 남아 있는','수당 없이 반복되는'],
    rentday:['보증금을 야금야금 먹는','월급날 직후에 오는','계약 갱신을 노리는'],
    aiface:['자소서를 3초 만에 거른','표정 관리가 완벽한','탈락 사유를 안 알려주는'],
  };
  function isEmpoweredCycle(){
    return bossOrderIdx > MAP.bosses.length; // 한 바퀴 다 만난 뒤부터는 강화형
  }

  function spawnBoss(key, emp){
    const def = BOSS_TYPES[key];
    const p = ringSpawnPos(Math.min(W,H)/2+30, Math.min(W,H)/2+120);
    const encScale = def.finale ? 1 : (1 + 0.45*Math.max(0, bossEncounterCount-1));
    const empMult = emp ? 1.7 : 1;
    // 이명(코믹 칭호) 출현: 40% 확률 — 칭호가 붙은 보스는 더 강하다 (칭호는 풀에서 랜덤)
    const cpool = BOSS_COMIC[key];
    const bountyOn = player && player.bounty && !def.finale;
    const comic = (!def.finale && cpool && (bountyOn || Math.random()<0.4)) ? cpool[(Math.random()*cpool.length)|0] : null;
    const comicMult = comic ? 1.35 : 1;
    const hp = def.hp * encScale * empMult * comicMult * MAP.mult.ehp;
    const b = {
      isBoss:true, key, kind:def.kind,
      name: (comic ? '『'+comic+'』 ' : '') + (emp?'강화 ':'') + def.name,
      comic: !!comic, bountyMark: !!bountyOn,
      emp: !!emp, finale: !!def.finale,
      x:p.x, y:p.y, r:def.r * (emp?1.15:1),
      hp, maxHp:hp,
      speed: def.speed * (emp?1.15:1) * (comic?1.08:1),
      dmg: def.contactDmg * dmgScale() * (emp?1.3:1) * (comic?1.2:1),
      xpValue: def.xpValue * (emp?2:1),
      hitCd:0, satCd:0,
      fireTimer:1.0,
      // generic pattern state
      gauge:0, chargeState:'idle', chargeDir:{x:1,y:0}, telegraphTimer:0, chargeTimer:0, recoverTimer:0,
      patTimer:1.6, patIdx:0,
      teleT:2.5, summonT:4,
      beamState:'idle', beamT:2, beamA:0,
      volleyT:2.5,
      cloneT:3,
      frenzyT:3, frenzy:0,
      gustT:3.5,
      cycleT:3, ghost:false, stolen:0, dmgStack:0, slashT:0,
      mineT:1.2,
      meteorT:3, dashT2:2,
      waveT:3, orbT:1.5,
      burstT:4, trail:[], segs:[]
    };
    if (def.kind==='centipede'){
      const segN = def.finale ? 16 : 11;
      for (let i=0;i<segN;i++) b.segs.push({ x:b.x - i*22, y:b.y });
    }
    if (def.finale) b.meteorT = 6;
    bosses.push(b);
    refreshBossBar();
    screenDimT = 0.9; // 보스 등장 암전 연출
    freeze = Math.max(freeze, 0.3); // 등장 순간 정지
    // 등장 충격파 (시그니처 색)
    if (FX.enabled){
      const ac2 = (BOSS_ACCENTS && BOSS_ACCENTS[key]) ? parseInt(BOSS_ACCENTS[key].slice(1),16) : 0xb8362e;
      FX.ring(b.x, b.y, ac2, 22);
      FX.puff(b.x, b.y, ac2, b.r*2);
    }
    if (bountyOn) player.bounty = false; // 현상수배 소모
    if (bleedNext){ b.bleed = true; bleedNext = false; } // 차원 침식 보스 표식
    showBossBanner(BOSS_TITLES[key]||'', b.name, BOSS_ACCENTS ? BOSS_ACCENTS[key] : null);
    shake = Math.min(20, shake+10);
    SFX.play('warn');
  }
  // QA 훅 (콘솔 전용): 관문 보스 강제 소환 — 잔몹 정리 + gate 플래그까지 실전과 동일
  window.__qaGate = (key)=>{
    try {
      if (typeof key==='number'){ spawnGateStage(key); const g2=bosses[bosses.length-1]; return g2?g2.name+' st'+g2.gateStage:'no chain'; }
      spawnBoss(key);
      const gb = bosses[bosses.length-1];
      if (gb){ gb.gate = true; for (let i=enemies.length-1;i>=0;i--) enemies.splice(i,1); }
      return gb ? gb.name : 'spawn failed';
    } catch(e){ return 'ERR '+String(e); }
  };
  window.__qaGod = ()=>{
    try { player.maxHp=999999; player.hp=999999; return 'god'; } catch(e){ return 'ERR '+String(e); }
  };
  window.__qaBoss = (frac, aliveT)=>{
    try {
      bosses.forEach(b=>{ if (frac!==undefined) b.hp=b.maxHp*frac; if (aliveT!==undefined) b.aliveT=aliveT; });
      refreshBossBar();
      return bosses.map(b=>b.name+' '+Math.round(b.hp)+'/'+Math.round(b.maxHp)+' t'+Math.round(b.aliveT||0)).join('|') || 'no boss';
    } catch(e){ return 'ERR '+String(e); }
  };
  window.__qaState = ()=>{
    try {
      return JSON.stringify({
        bosses: bosses.map(b=>({k:b.key, ph:b.jPhase, enr:!!b.jEnraged, wiped:!!(b.jWiped||b.hWiped), hp:Math.round(b.hp), t:Math.round(b.aliveT||0)})),
        enemies: enemies.length, zones: zones.map(z=>z.type), hp: Math.round(player&&player.hp||0), err: window.__gameErr||null
      });
    } catch(e){ return 'ERR '+String(e); }
  };

  function refreshBossBar(){
    if (bosses.length===0){ bossBar.style.display='none'; bossBar.innerHTML=''; return; }
    bossBar.style.display = 'flex';
    bossBar.innerHTML = bosses.map((b)=>{
      const pct = Math.max(0, (b.hp/b.maxHp)*100);
      return '<div class="bossRow"><div class="k'+(b.emp?' emp':'')+'">'+b.name+'</div>'
        + '<div class="bossHpTrack"><div class="bossHpFill" style="width:'+pct+'%"></div></div></div>';
    }).join('');
  }

  function defeatBoss(idx){
    const b = bosses[idx];
    killCount += 1;
    addCombo();
    questAdd('boss', 1);
    if (b.bleed) unlockAch('bleed1');
    burst(b.x,b.y, 34, 240, 0xe8c56a);
    FX.ring(b.x, b.y, 0xe8c56a, 22);
    effects.push({ type:'ring', x:b.x, y:b.y, life:0.5, age:0, r0:20, r1:220 });
    const n = 5;
    for (let i=0;i<n;i++){
      const a = (Math.PI*2/n)*i;
      orbs.push({ x:b.x+Math.cos(a)*14, y:b.y+Math.sin(a)*14, value:Math.ceil(b.xpValue/n), r:6 });
    }
    dropItem(b.x, b.y, 'chest');
    if (player){ const asG = b.gate?2:1; player.ascStones = (player.ascStones||0)+asG; addTextNum(b.x, b.y-40, '◈ 승천석 +'+asG); }
    let essN = (b.finale ? 1 : (Math.random()<0.5?1:0)) + Math.floor((DB.peril||0)/4); // 정수 드랍 하향 (일반 보스 50%)
    if (endless) essN = Math.random()<0.3 ? 1 : 0; // 무한 모드: 재료도 체감
    DB.mats.essence += essN;
    toast('◆ 보스의 정수 +'+essN+' ('+DB.mats.essence+')');
    let goldBase = b.finale ? 200 : 45;
    if (b.emp) goldBase = Math.round(goldBase*1.6);
    if (b.bountyMark){ goldBase *= 2; toast('현상수배 완수 — 보상 2배!'); }
    const g = gainGold(goldBase);
    addTextNum(b.x, b.y-20, '+'+g+'G');
    if (b.kind==='backstab' && b.stolen>0){
      const back = gainGold(b.stolen*2);
      addTextNum(b.x, b.y-38, '빼앗긴 골드 회수 +'+back+'G');
      toast('정우팍에게서 골드를 이자까지 회수했다! +'+back+'G');
    }
    shake = Math.min(22, shake+16);
    freeze = Math.max(freeze, 0.08);
    slowmoT = Math.max(slowmoT, 0.55); // 보스 처치 슬로모션
    for (let k=0;k<8;k++){
      const a = Math.random()*Math.PI*2;
      particles.push({ x:b.x, y:b.y, vx:Math.cos(a)*(140+Math.random()*140), vy:Math.sin(a)*(140+Math.random()*140)-60,
        life:0.7, age:0, r:3+Math.random()*3, shard:true, rot:Math.random()*Math.PI, vr:(Math.random()-0.5)*16 });
    }
    SFX.play('boom');
    const wasFinal = b.finale;
    bosses.splice(idx,1);
    refreshBossBar();
    // 관문 체인 진행: 수문장 돌파 → 체크포인트 저장 + 다음 관문 소환 / 관문보스 완주 → 진행 초기화
    if (b.gate && b.gateChain!==undefined){
      DB.gateProg = DB.gateProg||{};
      const chain = GATE_CHAIN[b.gateChain]||[];
      const nextStage = (b.gateStage||0)+1;
      if (nextStage < chain.length){
        DB.gateProg[b.gateChain] = nextStage;
        saveDB();
        showBossBanner('관문 '+nextStage+'/'+chain.length+' 돌파', '진행이 저장되었다 — 다음 관문이 열린다', '#3f7a5c');
        SFX.play('win');
        gatePending = { peril: b.gateChain, stage: nextStage, t: 2.8 }; // 게임 루프에서 소환 (레벨업 중에도 유실 없음)
      } else {
        DB.gateProg[b.gateChain] = 0; // 완주 — 재도전은 처음부터 (위험도는 이미 해금)
        // 진행감 보상의 축: 관문보스 완주 = 운명 포인트 대량 지급 (관문이 높을수록 크다)
        const gateP = 6 + Math.floor((b.gateChain||0)/4);
        DB.star.pts = (DB.star.pts||0) + gateP;
        toast('⚔ 관문 완전 돌파 보상: 운명 포인트 +'+gateP+'P');
        SFX.play('win');
        saveDB();
      }
    }
    if (wasFinal){
      rootDefeated = true;
      nextRootAt = elapsed + 240;
      if (!endless) winGame();
    }
  }

  // ---------- boss AI helpers ----------
  function bossMoveToward(b, tx, ty, sp, dt){
    const dx = tx-b.x, dy = ty-b.y;
    const d = Math.hypot(dx,dy)||1;
    b.x += dx/d*sp*dt;
    b.y += dy/d*sp*dt;
  }
  function hostileShot(x, y, a, speed, r, dmg, life, extra){
    const s = { x, y, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, r, damage:dmg, life };
    if (extra) Object.assign(s, extra);
    hostileShots.push(s);
  }
  function addHazard(x, y, r, timer, dmg, friendly){
    hazards.push({ x, y, r, timer, maxT:timer, dmg, friendly:!!friendly });
  }

  // ---------- 다단 관문 체인: 수문장 1~2관문 → 관문보스. 돌파 시 DB.gateProg에 체크포인트 ----------
  const GATE_CHAIN = {
    8:['gkShield','jealousEx'], 12:['gkTwin','protestEx'], 16:['gkTrain','heatwaveEx'],
    20:['gkShield','blinddateEx'], 24:['gkTwin','upstairsEx'],
    28:['gkShield','gkTrain','jeonseEx'], 32:['gkTwin','gkTrain','aialgoEx'],
    36:['gkShield','gkTwin','teamleadEx'], 40:['gkTrain','gkTwin','relativesEx'],
    44:['gkShield','gkTrain','chinaEx'], 48:['gkTwin','gkShield','tariffEx2'],
    50:['gkShield','gkTwin','gkTrain','burnoutEx'],
    52:['gkTrain','gkTwin','warzoneEx'], 56:['gkShield','gkTrain','yeongkkeulEx']
  };
  // 수문장 테마: 관문보스의 세계관에 맞는 이름 + 전용 추가 패턴 (엔진은 3종 공유, 얼굴과 한 수는 관문마다 다르다)
  // [stage0 테마, stage1 테마(3단 이상일 때)]
  const GATE_MID_THEME = {
    8:[{n:'수문장 · 미련의 자물쇠', f:'sns'}],
    12:[{n:'수문장 · 선봉 피켓조', f:'picket'}],
    16:[{n:'수문장 · 아스팔트 아지랑이', f:'sun'}],
    20:[{n:'수문장 · 주선자의 비서', f:'heart'}],
    24:[{n:'수문장 · 복도의 발소리', f:'noise'}],
    28:[{n:'수문장 · 바지사장', f:'money'},{n:'수문장 · 근저당 문서', f:'money'}],
    32:[{n:'수문장 · 추천 피드', f:'ad'},{n:'수문장 · 팝업 광고', f:'ad'}],
    36:[{n:'수문장 · 사수', f:'work'},{n:'수문장 · 인사팀 대리', f:'work'}],
    40:[{n:'수문장 · 첫째 이모', f:'family'},{n:'수문장 · 옆집 아줌마', f:'family'}],
    44:[{n:'수문장 · 홍위병', f:'red'},{n:'수문장 · 정찰풍선', f:'red'}],
    48:[{n:'수문장 · 국경 순찰대', f:'wall'},{n:'수문장 · 관세 감사관', f:'wall'}],
    50:[{n:'수문장 · 월요일 아침', f:'tired'},{n:'수문장 · 밀린 빨래', f:'tired'},{n:'수문장 · 읽지 않은 메일 99+', f:'tired'}],
    52:[{n:'수문장 · 정찰 드론', f:'war'},{n:'수문장 · 포병 관측수', f:'war'}],
    56:[{n:'수문장 · 불법 주차 킥보드', f:'money'},{n:'수문장 · 중도상환 수수료', f:'money'}],
  };
  function applyGateTheme(gb, peril, stage){
    if (!gb || gb.finale) return;
    const ths = GATE_MID_THEME[peril];
    const th = ths && ths[Math.min(stage, ths.length-1)];
    if (th){ gb.name = th.n; gb.flav = th.f; refreshBossBar(); }
  }
  // 관문 보정: 플레이어가 과성장했으면 관문도 함께 단단해진다 (웨이브 파밍으로 밸런스 붕괴 방지)
  function applyGateScale(gb){
    if (!gb) return;
    const gs = 0.5 + 0.75*powerScale(); // 초반 1.25× ~ 풀성장 2.0× (레벨·테크·성도·장비 전부 반영)
    gb.maxHp = Math.round(gb.maxHp * gs);
    gb.hp = gb.maxHp;
    gb.dmg = Math.round(gb.dmg * (0.8 + 0.3*powerScale()));
    refreshBossBar();
  }
  // 수문장 테마 전용 한 수 — 3종 엔진 공통으로 호출
  function tickMidFlavor(b, dt, ds){
    b.mfT = (b.mfT===undefined?5:b.mfT) - dt;
    if (b.mfT>0) return;
    b.mfT = 6.5;
    const aim = Math.atan2(player.y-b.y, player.x-b.x);
    switch (b.flav){
      case 'sns': for (let k=0;k<3;k++) addHazard(player.x+(Math.random()-0.5)*140, player.y+(Math.random()-0.5)*140, 52, 1.0, 18*ds, false); addTextNum(player.x, player.y-40, '읽음 1'); break;
      case 'picket': for (let k=-2;k<=2;k++) hostileShot(b.x, b.y, aim+k*0.2, 210, 6, 15*ds, 2.4); break;
      case 'sun': for (let k=0;k<3;k++) addHazard(player.x+(Math.random()-0.5)*220, player.y+(Math.random()-0.5)*220, 58, 1.2, 18*ds, false); break;
      case 'heart': for (let k=0;k<3;k++) hostileShot(b.x, b.y, aim+(k-1)*0.3, 165, 7, 15*ds, 3.2, {kind:'tornado',curve:(k%2?1:-1)*1.2}); break;
      case 'noise': { const pa=aim; player.knockX+=Math.cos(pa)*380; player.knockY+=Math.sin(pa)*380; for (let k=0;k<8;k++){ const a2=(Math.PI*2/8)*k; hostileShot(b.x,b.y,a2,150,6,13*ds,2.2);} SFX.play('sweep'); break; }
      case 'money': { const take=Math.min(runGold,10); if (take>0){ runGold-=take; addTextNum(player.x, player.y-30, '-'+take+'G 수수료'); } for (let k=0;k<3;k++) hostileShot(b.x, b.y, aim+(k-1)*0.15, 230, 6, 15*ds, 2.2); break; }
      case 'ad': { const lead=0.5; hostileShot(b.x, b.y, Math.atan2(player.y+((b.mvY||0)*lead)-b.y, player.x+((b.mvX||0)*lead)-b.x), 290, 6, 16*ds, 2.2); for (let k=0;k<2;k++) hostileShot(b.x, b.y, aim+(k?0.12:-0.12), 290, 6, 16*ds, 2.2); break; }
      case 'work': for (let k=0;k<4;k++) addHazard(player.x+(Math.random()-0.5)*280, player.y+(Math.random()-0.5)*280, 54, 1.2, 19*ds, false); addTextNum(player.x, player.y-40, '"이것도 오늘까지"'); break;
      case 'family': for (let k=0;k<8;k++){ const a2=(Math.PI*2/8)*k; const sx=player.x+Math.cos(a2)*300, sy=player.y+Math.sin(a2)*300; hostileShot(sx, sy, Math.atan2(player.y-sy,player.x-sx), 155, 6, 15*ds, 2.4); } break;
      case 'red': for (let k=0;k<12;k++){ const a2=(Math.PI*2/12)*k; hostileShot(b.x, b.y, a2, 165, 6, 14*ds, 2.6); } break;
      case 'wall': if (zones.length<38){ const a2=Math.random()*Math.PI*2; zones.push({ x:player.x+Math.cos(a2)*120, y:player.y+Math.sin(a2)*120, r:24, dps:0, t:10, maxT:10, type:'block', hostile:true, hitT:0 }); } break;
      case 'war': for (let k=0;k<5;k++) addHazard(player.x+(Math.random()-0.5)*360, player.y+(Math.random()-0.5)*360, 56, 0.9+Math.random()*0.6, 20*ds, false); break;
      case 'tired': if (zones.length<40){ zones.push({ x:player.x, y:player.y, r:110, dps:0, t:4, maxT:4, type:'silence', hostile:true, hitT:0 }); addTextNum(player.x, player.y-40, '...5분만'); } break;
    }
  }

  // 공용 관문 코어: 모든 관문 전투(수문장 포함)에 주기적으로 뜨는 인터랙션 —
  // 💥 약점 코어(탭 = 보스 최대체력 5% 삭제) / ⚡ 과부하(탭 = 스킬 쿨 초기화) / 🛡 잔향 보호막(탭 = 2초 무적)
  // "기믹을 수행하는 손"이 곧 딜이고 생존이다. 수문장은 70초 소프트 전멸기도 공유.
  function tickGateCore(b, dt){
    const ds2 = dmgScale();
    b.gcCoreT = (b.gcCoreT===undefined?12:b.gcCoreT) - dt;
    if (b.gcCoreT<=0){
      b.gcCoreT = 15 + Math.random()*5;
      const roll = Math.random();
      const a2 = Math.random()*Math.PI*2;
      const ox = player.x+Math.cos(a2)*170, oy = player.y+Math.sin(a2)*170;
      if (roll < 0.5){
        addGateObj({ kind:'qte', icon:'💥', x:ox, y:oy, r:23, maxT:3.5,
          onTap:()=>{ b.hp -= b.maxHp*0.05; addDmgNum(b.x, b.y, b.maxHp*0.05, true); addTextNum(b.x, b.y-b.r-16, '약점 파괴!'); shake=Math.min(16,shake+8); refreshBossBar(); if (b.hp<=0){ const bi=bosses.indexOf(b); if (bi>=0) defeatBoss(bi); } },
          onFail:()=>{} });
        addTextNum(player.x, player.y-44, '💥 약점 코어 노출 — 탭!');
      } else if (roll < 0.8){
        addGateObj({ kind:'qte', icon:'⚡', x:ox, y:oy, r:23, maxT:3,
          onTap:()=>{ player.skCds=[0,0,0]; player.ultCooldown=0; addTextNum(player.x, player.y-30, '⚡ 과부하 — 스킬 초기화!'); },
          onFail:()=>{} });
        addTextNum(player.x, player.y-44, '⚡ 마력 과부하 — 탭!');
      } else {
        addGateObj({ kind:'qte', icon:'🛡', x:ox, y:oy, r:23, maxT:3,
          onTap:()=>{ player.invuln=Math.max(player.invuln,2); addTextNum(player.x, player.y-30, '🛡 잔향 보호막 (2초)'); },
          onFail:()=>{} });
        addTextNum(player.x, player.y-44, '🛡 잔향 보호막 — 탭!');
      }
      SFX.play('tele');
    }
    // 수문장 소프트 전멸기 (70초): 관문 1·2도 딜 체크
    if (!b.finale && (b.aliveT||0) > 70 && !b.midWiped){
      b.midWiped = true;
      showBossBanner('수문장 전멸기', '관문이 닫히기 시작한다.', '#b8362e');
      for (let k=0;k<20;k++){ const a2=(Math.PI*2/20)*k; hostileShot(b.x, b.y, a2, 145, 7, 45*ds2, 3.5); }
      b.dmg = Math.round(b.dmg*1.5); b.speed *= 1.25;
      SFX.play('warn');
    }
  }

  let gatePending = null; // 다음 관문 지연 소환 (수문장 돌파 후)
  function tickGatePending(dt){
    if (!gatePending) return;
    gatePending.t -= dt;
    if (gatePending.t>0) return;
    const chain = GATE_CHAIN[gatePending.peril]||[];
    const key = chain[gatePending.stage];
    const gp = gatePending; gatePending = null;
    if (!key) return;
    spawnBoss(key);
    const gb = bosses[bosses.length-1];
    if (gb){ gb.gate = true; gb.gateChain = gp.peril; gb.gateStage = gp.stage; applyGateTheme(gb, gp.peril, gp.stage); applyGateScale(gb); }
    for (let i2=enemies.length-1;i2>=0;i2--) enemies.splice(i2,1);
  }
  function spawnGateStage(peril){
    const chain = GATE_CHAIN[peril];
    if (!chain) return false;
    DB.gateProg = DB.gateProg||{};
    const prog = Math.min(DB.gateProg[peril]||0, chain.length-1);
    spawnBoss(chain[prog]);
    const gb = bosses[bosses.length-1];
    if (gb){ gb.gate = true; gb.gateChain = peril; gb.gateStage = prog; applyGateTheme(gb, peril, prog); applyGateScale(gb); }
    for (let i=enemies.length-1;i>=0;i--) enemies.splice(i,1);
    toast('⚔ 관문 '+(prog+1)+'/'+chain.length+(prog<chain.length-1 ? ' — 수문장이 길을 막는다' : ' — 관문의 주인이 왔다'));
    return true;
  }

  // ---------- 관문 인터랙션 오브젝트 (MMO식 기믹: QTE 탭 / 아이템 줍기) ----------
  // kind 'qte': 제한시간 내 탭/클릭 → onTap, 시간 초과 → onFail
  // kind 'pick': 밟으면 → onPick, 시간 초과 → onFail(선택)
  let gateObjs = [];
  function addGateObj(o){ o.t = o.maxT; gateObjs.push(o); }
  function updateGateObjs(dt){
    if (!bosses.some(b=>b.gate)){ if (gateObjs.length) gateObjs.length = 0; return; }
    for (let i=gateObjs.length-1;i>=0;i--){
      const o = gateObjs[i];
      o.t -= dt;
      if (o.kind==='pick' && Math.hypot(player.x-o.x, player.y-o.y) < o.r+player.r){
        gateObjs.splice(i,1);
        if (o.onPick) o.onPick();
        continue;
      }
      if (o.t<=0){
        gateObjs.splice(i,1);
        if (o.onFail) o.onFail();
      }
    }
  }
  function drawGateObjs(){
    for (const o of gateObjs){
      const urgent = o.t < o.maxT*0.35;
      ctx.save();
      ctx.translate(o.x, o.y);
      const pulse = 1 + Math.sin(performance.now()/(urgent?90:220))*0.12;
      ctx.strokeStyle = urgent ? '#b8362e' : (o.kind==='qte' ? '#e2b23f' : '#5a8cc8');
      ctx.lineWidth = 2.2;
      ctx.setLineDash(o.kind==='qte' ? [5,4] : []);
      ctx.beginPath(); ctx.arc(0,0,o.r*pulse,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = Math.round(o.r*0.9)+'px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(o.icon||'❔', 0, 1);
      // 남은 시간 게이지
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0,0,o.r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*(o.t/o.maxT)); ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- boss AI (returns true if the player died) ----------
  function updateBoss(b, dt){
    const def = BOSS_TYPES[b.key];
    const bx = player.x-b.x, by = player.y-b.y;
    const bd = Math.hypot(bx,by)||1;
    const ds = dmgScale();
    const empN = b.emp ? 1 : 0;

    // 시간 초과 기믹 — 90초 안에 못 잡으면 보스가 '초조'해진다 (단계적 강화)
    // 관문 보스는 제외: 자체 전멸기 타임라인을 쓴다 (체력 회복 겹치면 이중 처벌)
    b.aliveT = (b.aliveT||0) + dt;
    if (!b.gate){
    if (!b.impatient && b.aliveT > 90){
      b.impatient = 1;
      b.dmg = Math.round(b.dmg*1.25); b.speed *= 1.2;
      showBossBanner('시간 초과', (b.name||'보스')+'의 인내심이 바닥났다', '#b8362e');
      toast('⏳ 보스 광폭화 1단계 — 서두르세요!');
      SFX.play('warn');
    } else if (b.impatient===1 && b.aliveT > 150){
      b.impatient = 2;
      b.dmg = Math.round(b.dmg*1.3); b.speed *= 1.2;
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp*0.15); refreshBossBar();
      toast('⏳ 보스 광폭화 2단계 — 체력 회복 + 대폭 강화!');
      SFX.play('warn');
    }
    }

    // 분노 페이즈 — 체력 45% 이하에서 각성
    if (!b.enraged && b.hp < b.maxHp*0.45){
      b.enraged = true;
      b.speed *= 1.15;
      b.dmg *= 1.15;
      b.patTimer *= 0.5; b.fireTimer *= 0.5; b.frenzyT *= 0.5;
      b.volleyT *= 0.5; b.gustT *= 0.5; b.mineT *= 0.5; b.meteorT *= 0.5; b.waveT *= 0.5; b.teleT *= 0.5;
      showBossBanner('분노', b.name+'의 분노!', BOSS_ACCENTS[b.key]);
      shake = Math.min(22, shake+12);
      freeze = Math.max(freeze, 0.15);
      // 분노 폭발: 시그니처 색 WebGL 링 + 버스트
      if (FX.enabled){
        const ac = BOSS_ACCENTS[b.key];
        const tint = ac ? parseInt(ac.slice(1),16) : 0xb8362e;
        FX.ring(b.x, b.y, tint, 24);
        FX.burst(b.x, b.y, tint, 20, 220, 0.6);
      }
      SFX.play('warn');
    }

    if (b.kind==='ranged'){
      if (bd > def.preferredRange+24) bossMoveToward(b, player.x, player.y, b.speed, dt);
      else if (bd < def.preferredRange-24) bossMoveToward(b, player.x, player.y, -b.speed, dt);
      b.fireTimer -= dt;
      if (b.fireTimer<=0){
        const a = Math.atan2(by, bx);
        hostileShot(b.x, b.y, a, def.projSpeed, def.projR, def.projDmg*ds, 2.8);
        if (b.emp){ hostileShot(b.x, b.y, a+0.25, def.projSpeed, def.projR, def.projDmg*ds, 2.8); hostileShot(b.x, b.y, a-0.25, def.projSpeed, def.projR, def.projDmg*ds, 2.8); }
        burst(b.x,b.y,5,70);
        b.fireTimer = def.fireInterval*(b.emp?0.8:1) + (Math.random()*0.3-0.15);
      }

    } else if (b.kind==='charger'){
      if (b.chargeState==='idle'){
        bossMoveToward(b, player.x, player.y, b.speed, dt);
        b.gauge += dt;
        if (b.gauge>=def.gaugeTime){
          b.chargeState='telegraph'; b.telegraphTimer=def.telegraph;
          const predX = player.x + player.vx*0.45, predY = player.y + player.vy*0.45;
          const a = Math.atan2(predY-b.y, predX-b.x);
          b.chargeDir = { x:Math.cos(a), y:Math.sin(a) };
        }
      } else if (b.chargeState==='telegraph'){
        b.telegraphTimer -= dt;
        if (b.telegraphTimer<=0){ b.chargeState='charging'; b.chargeTimer=def.chargeDuration; }
      } else if (b.chargeState==='charging'){
        b.x += b.chargeDir.x*def.chargeSpeed*dt;
        b.y += b.chargeDir.y*def.chargeSpeed*dt;
        b.chargeTimer -= dt;
        if (b.chargeTimer<=0){ b.chargeState='recover'; b.recoverTimer=def.recover; }
        else if (Math.hypot(player.x-b.x, player.y-b.y) < b.r+player.r && player.invuln<=0){
          if (playerHit(def.chargeDamage*ds, 0.8, 14)) return true;
        }
      } else {
        b.recoverTimer -= dt;
        if (b.recoverTimer<=0){ b.chargeState='idle'; b.gauge=0; }
      }

    } else if (b.kind==='summoner'){
      bossMoveToward(b, player.x, player.y, bd>230 ? b.speed : -b.speed*0.6, dt);
      b.teleT -= dt;
      if (b.teleT<=0){
        burst(b.x,b.y,14,150);
        const a = Math.random()*Math.PI*2;
        b.x = player.x + Math.cos(a)*250;
        b.y = player.y + Math.sin(a)*250;
        burst(b.x,b.y,14,150);
        SFX.play('tele');
        const aim = Math.atan2(player.y-b.y, player.x-b.x);
        for (let k=-1;k<=1;k++) hostileShot(b.x,b.y, aim+k*0.22, 220, 6, 12*ds, 2.6);
        b.teleT = 5.5 - empN;
      }
      b.summonT -= dt;
      if (b.summonT<=0){
        for (let k=0;k<4+empN*2;k++){
          const a = Math.random()*Math.PI*2;
          enemies.push(makeEnemy(Math.random()<0.6?'swarm':'normal', b.x+Math.cos(a)*60, b.y+Math.sin(a)*60, false));
        }
        addTextNum(b.x, b.y-30, '소환!');
        b.summonT = 8 - empN*2;
      }

    } else if (b.kind==='beam'){
      if (b.beamState==='idle'){
        bossMoveToward(b, player.x, player.y, b.speed, dt);
        b.beamT -= dt;
        if (b.beamT<=0){ b.beamState='warm'; b.beamT=1.1; b.beamA=Math.atan2(by,bx); }
      } else if (b.beamState==='warm'){
        b.beamT -= dt;
        if (b.beamT<=0){ b.beamState='fire'; b.beamT=2.6+empN; SFX.play('warn'); }
      } else {
        bossMoveToward(b, player.x, player.y, b.speed*0.4, dt);
        b.beamA += dt*(0.85+empN*0.25);
        b.beamT -= dt;
        // beam collision: distance from player to the beam ray
        const len = 300;
        const ex = b.x+Math.cos(b.beamA)*len, ey = b.y+Math.sin(b.beamA)*len;
        const t = Math.max(0, Math.min(1, ((player.x-b.x)*(ex-b.x)+(player.y-b.y)*(ey-b.y))/(len*len)));
        const cx2 = b.x+(ex-b.x)*t, cy2 = b.y+(ey-b.y)*t;
        if (Math.hypot(player.x-cx2, player.y-cy2) < 15+player.r && player.invuln<=0){
          if (playerHit(14*ds, 0.5, 10)) return true;
        }
        if (b.beamT<=0){ b.beamState='idle'; b.beamT=2.2; }
      }

    } else if (b.kind==='fickle'){
      // 슬기짱: 어장관리 — 끌어당겼다가 밀쳐낸다
      const want = 220;
      if (bd > want+30) bossMoveToward(b, player.x, player.y, b.speed, dt);
      else if (bd < want-30) bossMoveToward(b, player.x, player.y, -b.speed*0.7, dt);
      b.patTimer -= dt;
      if (b.patTimer<=0){
        const pat = b.patIdx % 3; b.patIdx += 1;
        if (pat===0){ b.pull=2.0; addTextNum(b.x, b.y-34, '이리 와~'); SFX.play('tele'); b.patTimer=3.2; }
        else if (pat===1){
          addTextNum(b.x, b.y-34, '가까이 오지 마!');
          const pa = Math.atan2(player.y-b.y, player.x-b.x);
          player.knockX += Math.cos(pa)*430; player.knockY += Math.sin(pa)*430;
          for (let k=0;k<10+empN*4;k++){
            const a = (Math.PI*2/(10+empN*4))*k;
            hostileShot(b.x,b.y,a,150,6.5,10*ds,3.2,{kind:'heart'});
          }
          SFX.play('warn'); b.patTimer=3.2;
        } else {
          for (let k=0;k<2+empN;k++){
            const a = Math.random()*Math.PI*2;
            enemies.push(makeEnemy('fish', b.x+Math.cos(a)*50, b.y+Math.sin(a)*50, false));
          }
          addTextNum(b.x, b.y-34, '얘들아~'); b.patTimer=3.5;
        }
      }
      if (b.pull>0){
        b.pull -= dt;
        const pa = Math.atan2(b.y-player.y, b.x-player.x);
        player.knockX += Math.cos(pa)*300*dt*4;
        player.knockY += Math.sin(pa)*300*dt*4;
      }

    } else if (b.kind==='mortar'){
      const want = 260;
      if (bd > want+30) bossMoveToward(b, player.x, player.y, b.speed, dt);
      else if (bd < want-40) bossMoveToward(b, player.x, player.y, -b.speed*0.8, dt);
      b.volleyT -= dt;
      if (b.volleyT<=0){
        for (let k=0;k<3+empN*2;k++){
          const tx = player.x + player.vx*0.6 + (Math.random()*160-80);
          const ty = player.y + player.vy*0.6 + (Math.random()*160-80);
          addHazard(tx, ty, 62, 1.0, 22*ds, false);
        }
        burst(b.x,b.y,8,110);
        SFX.play('shoot');
        b.volleyT = 4 - empN;
      }

    } else if (b.kind==='clones'){
      bossMoveToward(b, player.x, player.y, b.speed, dt);
      b.cloneT -= dt;
      if (b.cloneT<=0){
        for (let k=0;k<2+empN;k++){
          const a = Math.random()*Math.PI*2;
          const c = makeEnemy('clone', b.x+Math.cos(a)*46, b.y+Math.sin(a)*46, false);
          c.skin = 'jieun';
          enemies.push(c);
        }
        addTextNum(b.x, b.y-30, '분신술!');
        SFX.play('tele');
        b.cloneT = 9 - empN*2;
      }
      b.fireTimer -= dt;
      if (b.fireTimer<=0){
        const aim = Math.atan2(by, bx);
        for (let k=-1;k<=1;k++) hostileShot(b.x,b.y, aim+k*0.2, 210, 5.5, 11*ds, 2.4);
        b.fireTimer = 2.6;
      }

    } else if (b.kind==='jealous'){
      // 관문 보스 1호: 의부증 전여친 은재 — 최병우를 놓지 못한 자 (3페이즈 + 발악 + 전멸기)
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 의심', '"...나 몰래 최병우 만났지?"', '#c94f8a'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 확신', '"통화 목록 다 봤어."', '#b8362e'); screenDimT=Math.max(screenDimT,0.5); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage){
        if (!b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 집 앞이야', '"문 열어."', '#b8362e'); shake=Math.min(24,shake+14); }
        bossMoveToward(b, player.x, player.y, b.speed*2.4, dt);
      } else {
        bossMoveToward(b, player.x, player.y, b.speed*(ph===3?1.4:1), dt);
      }
      // 추궁 장판 '지금 어디야?': 플레이어 위치에 경고 후 폭발 (페이즈별 강화)
      b.jHazT = (b.jHazT===undefined?2.5:b.jHazT) - dt;
      if (b.jHazT<=0){
        for (let k=0;k<ph;k++){
          const ox = ph===3 ? 0 : (Math.random()-0.5)*120;
          const oy = ph===3 ? 0 : (Math.random()-0.5)*120;
          addHazard(player.x+ox, player.y+oy, 66, 1.2, 24*ds, false);
        }
        addTextNum(player.x, player.y-40, '"지금 어디야?"');
        b.jHazT = (ph===1?2.4 : ph===2?1.6 : 1.1) - empN*0.3;
      }
      // 통화 목록 검사: 2페+ 부채꼴 스캔 탄막
      if (ph>=2){
        b.jScanT = (b.jScanT===undefined?4:b.jScanT) - dt;
        if (b.jScanT<=0){
          const base = Math.atan2(player.y-b.y, player.x-b.x);
          for (let k=-3;k<=3;k++) hostileShot(b.x, b.y, base+k*0.15, 235, 5.5, 15*ds, 2.6);
          addTextNum(b.x, b.y-b.r-14, '통화 목록 검사');
          b.jScanT = ph===3 ? 1.8 : 2.8;
        }
      }
      // 신규 QTE '부재중 31통': 울리는 전화를 3초 내 탭해 끊어야 한다 — 방치 시 벨소리 폭발
      b.jCallT = (b.jCallT===undefined?9:b.jCallT) - dt;
      if (b.jCallT<=0){
        const a2 = Math.random()*Math.PI*2;
        addGateObj({ kind:'qte', icon:'📞', x:player.x+Math.cos(a2)*150, y:player.y+Math.sin(a2)*150, r:22, maxT:3,
          onTap:()=>{ addTextNum(player.x, player.y-30, '통화 거절'); },
          onFail:()=>{
            addTextNum(player.x, player.y-40, '벨소리 폭발!');
            for (let k=0;k<10;k++){ const a3=(Math.PI*2/10)*k; hostileShot(player.x, player.y, a3, 180, 6, 22*ds, 1.6); }
            shake=Math.min(20,shake+10); SFX.play('boom');
          } });
        addTextNum(player.x, player.y-44, '📞 전화가 온다 — 탭해서 끊어라!');
        b.jCallT = ph===3?7:11;
      }
      // 신규 'SNS 염탐' (2페+): 0.8초 전 내 위치가 기록되어 폭발한다 — 계속 움직여라
      if (ph>=2){
        b.jTrail = b.jTrail||[];
        b.jTrailT = (b.jTrailT||0) - dt;
        if (b.jTrailT<=0){ b.jTrail.push({x:player.x, y:player.y}); if (b.jTrail.length>3) b.jTrail.shift(); b.jTrailT = 0.8; }
        b.jSnsT = (b.jSnsT===undefined?7:b.jSnsT) - dt;
        if (b.jSnsT<=0 && b.jTrail.length){
          for (const tp of b.jTrail) addHazard(tp.x, tp.y, 58, 0.7, 22*ds, false);
          addTextNum(player.x, player.y-44, '"인스타 스토리 봤어."');
          b.jSnsT = 8 - ph;
        }
      }
      // 신규 '어디 숨었어?' (2페+): 화면 밖 사방에서 저격 관통탄
      if (ph>=2){
        b.jEdgeT = (b.jEdgeT===undefined?6:b.jEdgeT) - dt;
        if (b.jEdgeT<=0){
          for (let k=0;k<3+ph;k++){
            const a2 = Math.random()*Math.PI*2;
            const sx = player.x+Math.cos(a2)*430, sy = player.y+Math.sin(a2)*430;
            hostileShot(sx, sy, Math.atan2(player.y-sy,player.x-sx)+(Math.random()-0.5)*0.2, 300, 6, 18*ds, 2.2);
          }
          addTextNum(player.x, player.y-44, '"어디 숨었어?"');
          b.jEdgeT = ph===3?3.5:5;
        }
      }
      // 전멸기 '읽씹의 대가': 100초 초과 시 전방위 즉사급 탄막 + 영구 강화
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 읽씹의 대가', '"...그래. 너도 똑같네."', '#b8362e');
        for (let k=0;k<24;k++){ const a2=(Math.PI*2/24)*k; hostileShot(b.x, b.y, a2, 150, 7, 60*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.3;
      }
    } else if (b.kind==='protest'){
      // 관문 보스 2호: 전장연 시위대장 — 도로 점거의 달인 (이원근이 후원한다)
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 점거 확대', '"우리도 시민이다!"', '#3f7a5c'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 총력 투쟁', '"오늘, 지하철은 멈춘다."', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){
        b.jEnraged=true; showBossBanner('발악 — 결사 항전', '"마지막 한 명까지 연행돼도."', '#b8362e'); shake=Math.min(24,shake+14);
      }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.8: ph===3?1.3:1), dt);
      // 기믹 '출근길 봉쇄': 바리케이드 설치 — 닿으면 피해+밀쳐냄, 동선이 잘린다
      b.jBarT = (b.jBarT===undefined?3:b.jBarT) - dt;
      if (b.jBarT<=0 && zones.length<40){
        if (ph>=3){
          // 3페: 플레이어를 감싸는 포위 링
          for (let k=0;k<6;k++){
            const a2 = (Math.PI*2/6)*k + Math.random()*0.4;
            zones.push({ x:player.x+Math.cos(a2)*135, y:player.y+Math.sin(a2)*135, r:24, dps:0, t:12, maxT:12, type:'block', hostile:true, hitT:0 });
          }
          addTextNum(player.x, player.y-40, '전면 봉쇄!');
        } else {
          for (let k=0;k<ph;k++){
            const a2 = Math.random()*Math.PI*2;
            zones.push({ x:player.x+Math.cos(a2)*(90+Math.random()*70), y:player.y+Math.sin(a2)*(90+Math.random()*70), r:24, dps:0, t:14, maxT:14, type:'block', hostile:true, hitT:0 });
          }
        }
        SFX.play('tele');
        b.jBarT = (ph===1?4.5 : ph===2?3.2 : 8) - empN*0.4;
      }
      // 일반 '피켓 투척': 조준 투사체 (페이즈별 갈래 증가)
      b.jPickT = (b.jPickT===undefined?2.5:b.jPickT) - dt;
      if (b.jPickT<=0){
        const base = Math.atan2(player.y-b.y, player.x-b.x);
        const n = enrage?7 : ph===1?2 : ph===2?4 : 6;
        for (let k=0;k<n;k++) hostileShot(b.x, b.y, base+(k-(n-1)/2)*0.20, 220, 6, 16*ds, 2.8);
        b.jPickT = (enrage?1.2 : 2.4 - ph*0.3) - empN*0.2;
      }
      // 특수 '방패벽' (2페+): 이원근의 지원 — 보스와 나 사이를 가로막는 소환수 (관문 예외: 패턴 소환)
      if (ph>=2){
        b.jWallT = (b.jWallT===undefined?9:b.jWallT) - dt;
        if (b.jWallT<=0){
          const wa = Math.atan2(player.y-b.y, player.x-b.x);
          const mx = (b.x+player.x)/2, my = (b.y+player.y)/2;
          for (let k=-1;k<=1;k++){
            const sh = makeEnemy('brute', mx+Math.cos(wa+Math.PI/2)*k*46, my+Math.sin(wa+Math.PI/2)*k*46, false);
            sh.name='이원근의 방패벽'; sh.hp*=1.6; sh.maxHp*=1.6; sh.speed*=0.45; sh.xpValue=0; sh.grade=0; sh.blessed=false;
            enemies.push(sh);
          }
          addTextNum(b.x, b.y-b.r-14, '방패벽 강림');
          SFX.play('warn');
          b.jWallT = 20 - empN*2;
        }
      }
      // 신규 '농성 텐트' (2페+): 보스를 회복시키는 텐트 소환 — 부수지 않으면 딜이 무의미해진다
      if (ph>=2){
        b.jTentT = (b.jTentT===undefined?15:b.jTentT) - dt;
        if (b.jTentT<=0){
          const a2 = Math.random()*Math.PI*2;
          const tent = makeEnemy('brute', b.x+Math.cos(a2)*110, b.y+Math.sin(a2)*110, false);
          tent.name='농성 텐트'; tent.speed=0; tent.hp*=1.2; tent.maxHp*=1.2; tent.dmg=0; tent.xpValue=0; tent.grade=0; tent.blessed=false; tent.pTent=true;
          enemies.push(tent);
          addTextNum(b.x, b.y-b.r-14, '⛺ 농성 텐트 — 부숴라!');
          SFX.play('warn');
          b.jTentT = 20;
        }
        // 텐트 생존 시 보스 초당 회복
        let tents = 0;
        for (const e of enemies) if (e.pTent) tents++;
        if (tents>0) b.hp = Math.min(b.maxHp, b.hp + b.maxHp*0.006*tents*dt);
      }
      // 신규 '물대포' (3페+): 강력한 넉백 직선 수류
      if (ph>=3){
        b.jCanT = (b.jCanT===undefined?7:b.jCanT) - dt;
        if (b.jCanT<=0){
          const aim = Math.atan2(player.y-b.y, player.x-b.x);
          for (let k=0;k<6;k++){
            setTimeout(()=>{ if (state==='playing' && bosses.includes(b)) hostileShot(b.x, b.y, aim, 340, 9, 12*ds, 1.6); }, k*90);
          }
          player.knockX += Math.cos(aim)*300; player.knockY += Math.sin(aim)*300;
          addTextNum(b.x, b.y-b.r-14, '💦 물대포');
          b.jCanT = 8;
        }
      }
      // 신규 '구호 제창' (2페+): 함성 충격파 — 플레이어를 밀쳐내고 링 탄막
      if (ph>=2){
        b.jChantT = (b.jChantT===undefined?8:b.jChantT) - dt;
        if (b.jChantT<=0){
          const pa = Math.atan2(player.y-b.y, player.x-b.x);
          player.knockX += Math.cos(pa)*420; player.knockY += Math.sin(pa)*420;
          for (let k=0;k<12;k++){ const a2=(Math.PI*2/12)*k; hostileShot(b.x,b.y,a2,160,6,14*ds,2.8); }
          effects.push({ type:'ring', x:b.x, y:b.y, life:0.5, age:0, r0:30, r1:340 });
          addTextNum(b.x, b.y-b.r-14, '"물러나라! 물러나라!"');
          SFX.play('sweep');
          b.jChantT = ph===3?6:9;
        }
      }
      // 전멸기 '무기한 총파업': 100초 초과 시 전방위 탄막 + 필드 봉쇄 + 영구 강화
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 무기한 총파업', '"협상은 끝났다."', '#b8362e');
        for (let k=0;k<32;k++){ const a2=(Math.PI*2/32)*k; hostileShot(b.x, b.y, a2, 145, 7, 55*ds, 4); }
        for (let k=0;k<8 && zones.length<40;k++){
          const a2=(Math.PI*2/8)*k;
          zones.push({ x:player.x+Math.cos(a2)*170, y:player.y+Math.sin(a2)*170, r:26, dps:0, t:30, maxT:30, type:'block', hostile:true, hitT:0 });
        }
        b.dmg = Math.round(b.dmg*1.5); b.speed *= 1.35;
      }
    } else if (b.kind==='heatwave'){
      // 관문 보스 3호: 폭염 · 열대야 — 이동하는 그늘만이 살길이다
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 체감 39도', '"에어컨 없는 자에게 자비란 없다."', '#d4772e'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 열대야', '"밤에도 식지 않는다. 그늘이 좁아진다."', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){
        b.jEnraged=true; showBossBanner('발악 — 오존주의보', '"태양이 너만 노려본다."', '#b8362e'); shake=Math.min(24,shake+14);
      }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.6:1), dt);
      // 기믹 '한 뼘의 그늘': 유일한 안전지대가 천천히 이동한다 — 밖은 작열 도트
      if (b.hShadeX===undefined){ b.hShadeX=player.x; b.hShadeY=player.y; b.hShadeA=Math.random()*Math.PI*2; }
      b.hShadeA += (Math.random()-0.5)*dt*2.2;
      const shSpd = (ph===1?36 : ph===2?50 : 66) * (enrage?1.8:1);
      b.hShadeX += Math.cos(b.hShadeA)*shSpd*dt;
      b.hShadeY += Math.sin(b.hShadeA)*shSpd*dt;
      const shadeR = b.hWiped?42 : ph===1?115 : ph===2?88 : 64;
      if (!b.hShadeZone || b.hShadeZone.t<=0){
        b.hShadeZone = { x:b.hShadeX, y:b.hShadeY, r:shadeR, dps:0, t:0.6, maxT:0.6, type:'shade', hostile:true };
        zones.push(b.hShadeZone);
      }
      b.hShadeZone.x=b.hShadeX; b.hShadeZone.y=b.hShadeY; b.hShadeZone.r=shadeR; b.hShadeZone.t=0.6;
      // 작열 도트: 그늘 밖에 있으면 타들어간다
      b.hDotT = (b.hDotT||0) + dt;
      if (b.hDotT >= 0.8){
        b.hDotT = 0;
        const inShade = Math.hypot(player.x-b.hShadeX, player.y-b.hShadeY) < shadeR;
        if (!inShade && !(b.hUmb>0) && player.invuln<=0){
          if (playerHit(9*ds*(b.hWiped?3:1), 0.1, 2)) return true;
          addTextNum(player.x, player.y-30, '작열');
        }
      }
      // 일반 '자외선 직사': 조준 광선탄
      b.hRayT = (b.hRayT===undefined?2.8:b.hRayT) - dt;
      if (b.hRayT<=0){
        const base = Math.atan2(player.y-b.y, player.x-b.x);
        const n = ph===1?3 : ph===2?4 : 5;
        for (let k=0;k<n;k++) hostileShot(b.x, b.y, base+(k-(n-1)/2)*0.13, 265, 5.5, 15*ds, 2.4);
        addTextNum(b.x, b.y-b.r-14, '자외선 직사');
        b.hRayT = (ph===3?1.5:2.2) - empN*0.3;
      }
      // 특수 '실외기 폭발' (2페+): 랜덤 위치 다중 폭발 — 그늘 안이라고 안심 금지
      if (ph>=2){
        b.hAcT = (b.hAcT===undefined?6:b.hAcT) - dt;
        if (b.hAcT<=0){
          for (let k=0;k<3+ph;k++){
            addHazard(player.x+(Math.random()-0.5)*260, player.y+(Math.random()-0.5)*260, 56, 1.4, 15*ds, false);
          }
          addTextNum(player.x, player.y-44, '실외기 폭발!');
          b.hAcT = (ph===3?5:6.5) - empN*0.5;
        }
      }
      // 신규 '양산' 아이템: 주우면 10초간 개인 그늘 (작열 면역) — 그늘 밖 진출 찬스
      b.hUmb = Math.max(0, (b.hUmb||0) - dt);
      b.hUmbT = (b.hUmbT===undefined?16:b.hUmbT) - dt;
      if (b.hUmbT<=0){
        const a2 = Math.random()*Math.PI*2;
        addGateObj({ kind:'pick', icon:'🌂', x:player.x+Math.cos(a2)*200, y:player.y+Math.sin(a2)*200, r:20, maxT:7,
          onPick:()=>{ b.hUmb = 10; addTextNum(player.x, player.y-30, '🌂 양산 — 10초 작열 면역'); SFX.play('quest'); },
          onFail:null });
        addTextNum(player.x, player.y-44, '🌂 양산이 떨어졌다!');
        b.hUmbT = 20;
      }
      // 신규 '백드래프트' (3페): 6초 예고 후 전 필드 폭염 — 그늘 안만 생존 (프로토콜 기믹)
      if (ph>=3){
        b.hBackT = (b.hBackT===undefined?12:b.hBackT) - dt;
        if (b.hBackT<=0 && !b.hBackWarn){
          b.hBackWarn = 6;
          showBossBanner('경고 — 백드래프트', '6초 후 대기가 발화한다. 그늘로!', '#b8362e');
          SFX.play('warn');
        }
        if (b.hBackWarn){
          b.hBackWarn -= dt;
          if (b.hBackWarn<=0){
            b.hBackWarn = null; b.hBackT = 16;
            const inS = Math.hypot(player.x-b.hShadeX, player.y-b.hShadeY) < shadeR || b.hUmb>0;
            effects.push({ type:'ring', x:player.x, y:player.y, life:0.7, age:0, r0:60, r1:600 });
            shake = Math.min(26, shake+16); SFX.play('boom');
            if (!inS && player.invuln<=0){ if (playerHit(70*ds, 0.5, 14)) return true; addTextNum(player.x, player.y-40, '백드래프트!'); }
            else addTextNum(player.x, player.y-30, '그늘 생존!');
          }
        }
      }
      // 신규 '신기루' (2페+): 가짜 그늘 — 들어가는 순간 폭발 (진짜 그늘은 파란 점선, 신기루는 붉은 점선)
      if (ph>=2){
        b.hMirT = (b.hMirT===undefined?10:b.hMirT) - dt;
        if (b.hMirT<=0 && zones.length<40){
          const a2 = Math.random()*Math.PI*2;
          zones.push({ x:player.x+Math.cos(a2)*(160+Math.random()*120), y:player.y+Math.sin(a2)*(160+Math.random()*120), r:70, dps:0, t:12, maxT:12, type:'mirage', hostile:true });
          b.hMirT = 13 - ph*2;
        }
      }
      // 전멸기 '재난문자 — 폭염 경보': 100초 초과 시 그늘 붕괴 + 도트 3배 + 전방위 탄막
      if ((b.aliveT||0) > 100 && !b.hWiped){
        b.hWiped = true;
        showBossBanner('전멸기 — 재난문자', '"[국민재난안전처] 폭염 경보. 야외활동을 자제하십시오."', '#b8362e');
        for (let k=0;k<24;k++){ const a2=(Math.PI*2/24)*k; hostileShot(b.x, b.y, a2, 150, 7, 55*ds, 4); }
        b.dmg = Math.round(b.dmg*1.5);
      }
    } else if (b.kind==='blinddate'){
      // 관문 보스 4호: 소개팅 지옥 · 주선자 — 셋 중 진짜는 하나 (이원근 더블부킹·이민기 나이 확인 연계)
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 밥투정', '"여긴 좀 아닌 것 같아요. 옮길까요?"', '#b85c8a'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 계산대', '"...더치페이 괜찮으시죠?"', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){
        b.jEnraged=true; showBossBanner('발악 — 결혼 얘기', '"혹시... 결혼은 언제쯤 생각하세요?"', '#b8362e'); shake=Math.min(24,shake+14);
      }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.7: ph===3?1.25:1), dt);
      // 기믹 '더블부킹': 가짜 상대 2명 유지 — 죽이면 '애프터 폭탄'이 터진다 (진짜만 노려라)
      b.bdAll = b.bdAll||[];
      let bdAlive = 0;
      for (const dcy of b.bdAll){
        if (enemies.includes(dcy)){ bdAlive++; continue; }
        if (!dcy.bdPunished){
          dcy.bdPunished = true;
          addHazard(player.x, player.y, 92, 0.9, 30*ds, false);
          addTextNum(player.x, player.y-40, '애프터 폭탄!');
          SFX.play('warn');
        }
      }
      b.bdSummonT = (b.bdSummonT===undefined?1:b.bdSummonT) - dt;
      if (b.bdSummonT<=0 && bdAlive<2){
        while (bdAlive<2){
          const a2 = Math.random()*Math.PI*2;
          const dcy = makeEnemy('clone', b.x+Math.cos(a2)*90, b.y+Math.sin(a2)*90, false);
          dcy.name='소개팅 상대?'; dcy.hp*=5; dcy.maxHp*=5; dcy.speed*=0.8; dcy.xpValue=0; dcy.blessed=false; dcy.grade=0; dcy.bdDecoy=true;
          enemies.push(dcy); b.bdAll.push(dcy); bdAlive++;
        }
        addTextNum(b.x, b.y-b.r-14, '더블부킹');
        b.bdSummonT = 14;
      }
      // 일반 '주선자의 압박': 외곽 원에서 플레이어로 수렴하는 탄막
      b.bdConvT = (b.bdConvT===undefined?3:b.bdConvT) - dt;
      if (b.bdConvT<=0){
        const n = 8 + ph*3;
        for (let k=0;k<n;k++){
          const a2 = (Math.PI*2/n)*k + Math.random()*0.2;
          const sx = player.x+Math.cos(a2)*360, sy = player.y+Math.sin(a2)*360;
          hostileShot(sx, sy, Math.atan2(player.y-sy, player.x-sx), 165, 6, 16*ds, 3.0);
        }
        addTextNum(player.x, player.y-44, '주선자의 압박');
        b.bdConvT = (ph===1?4.2 : ph===2?3.2 : 2.4) - empN*0.3;
      }
      // 특수 '어색한 침묵' (2페+): 정적의 존 — 안에 있으면 스킬 봉인 + 도트
      if (ph>=2){
        b.bdSilT = (b.bdSilT===undefined?6:b.bdSilT) - dt;
        if (b.bdSilT<=0 && zones.length<40){
          zones.push({ x:player.x, y:player.y, r:120, dps:0, t:5, maxT:5, type:'silence', hostile:true, hitT:0 });
          addTextNum(player.x, player.y-40, '...어색한 침묵');
          b.bdSilT = 9 - empN;
        }
      }
      // 특수 '나이 확인' (3페): 이민기의 스캔 — 고속 3연 조준
      if (ph>=3){
        b.bdScanT = (b.bdScanT===undefined?4:b.bdScanT) - dt;
        if (b.bdScanT<=0){
          const base = Math.atan2(player.y-b.y, player.x-b.x);
          for (let k=0;k<3;k++){
            setTimeout(()=>{ if (state==='playing' && bosses.includes(b)) hostileShot(b.x, b.y, Math.atan2(player.y-b.y, player.x-b.x), 320, 5, 18*ds, 1.8); }, k*220);
          }
          addTextNum(b.x, b.y-b.r-14, '나이 확인');
          b.bdScanT = 5.5;
        }
      }
      // 3페 '계산대': 주기적으로 골드를 지불하거나 (없으면) 피해
      if (ph>=3){
        b.bdCalcT = (b.bdCalcT===undefined?5:b.bdCalcT) - dt;
        if (b.bdCalcT<=0){
          const bill = 30 + Math.floor((b.aliveT||0)/10)*5;
          if (runGold >= bill){ runGold -= bill; addTextNum(player.x, player.y-30, '-'+bill+'G 계산...'); }
          else if (player.invuln<=0){ if (playerHit(20*ds, 0.3, 6)) return true; addTextNum(player.x, player.y-30, '무전취식의 대가'); }
          b.bdCalcT = 7;
        }
      }
      // 발악 '결혼 얘기': 도주로 하나만 남는 압박 링 (틈새 랜덤)
      if (enrage){
        b.bdRingT = (b.bdRingT===undefined?1:b.bdRingT) - dt;
        if (b.bdRingT<=0){
          const gap = (Math.random()*24)|0;
          for (let k=0;k<24;k++){
            if (k===gap || k===(gap+1)%24 || k===(gap+23)%24) continue;
            const a2 = (Math.PI*2/24)*k;
            hostileShot(b.x, b.y, a2, 175, 6, 20*ds, 3.2);
          }
          addTextNum(b.x, b.y-b.r-14, '결혼 얘기');
          b.bdRingT = 2.6;
        }
      }
      // 신규 QTE '훅 들어오는 질문': '?'를 탭해 받아쳐야 — 방치 시 침묵 존 3개
      b.bdQT = (b.bdQT===undefined?11:b.bdQT) - dt;
      if (b.bdQT<=0){
        const a2 = Math.random()*Math.PI*2;
        addGateObj({ kind:'qte', icon:'❓', x:player.x+Math.cos(a2)*140, y:player.y+Math.sin(a2)*140, r:22, maxT:3.5,
          onTap:()=>{ addTextNum(player.x, player.y-30, '"아, 그건 말이죠—" (받아침)'); },
          onFail:()=>{
            for (let k=0;k<3 && zones.length<40;k++){
              const a3 = Math.random()*Math.PI*2;
              zones.push({ x:player.x+Math.cos(a3)*110, y:player.y+Math.sin(a3)*110, r:95, dps:0, t:5, maxT:5, type:'silence', hostile:true, hitT:0 });
            }
            addTextNum(player.x, player.y-40, '말문이 막혔다...');
          } });
        addTextNum(player.x, player.y-44, '❓ 훅 들어오는 질문 — 탭해서 받아쳐라!');
        b.bdQT = 12;
      }
      // 신규 '메뉴판 선택' (2페+): 둘 중 하나를 밟아야 한다 — 된장찌개(소량 피해) vs 오마카세(골드 -80)
      if (ph>=2){
        b.bdMenuT = (b.bdMenuT===undefined?14:b.bdMenuT) - dt;
        if (b.bdMenuT<=0){
          const a2 = Math.random()*Math.PI*2;
          let resolved = false;
          const mk1 = { kind:'pick', icon:'🍲', x:player.x+Math.cos(a2)*130, y:player.y+Math.sin(a2)*130, r:22, maxT:5,
            onPick:()=>{ if (resolved) return; resolved=true; if (player.invuln<=0) playerHit(12*ds, 0.2, 4); addTextNum(player.x, player.y-30, '"소박하시네요." (-피해)'); },
            onFail:()=>{ if (!resolved){ resolved=true; if (player.invuln<=0) playerHit(26*ds, 0.3, 8); addTextNum(player.x, player.y-30, '결정 장애의 대가'); } } };
          const mk2 = { kind:'pick', icon:'🍣', x:player.x-Math.cos(a2)*130, y:player.y-Math.sin(a2)*130, r:22, maxT:5,
            onPick:()=>{ if (resolved) return; resolved=true; const pay=Math.min(runGold,80); runGold-=pay; addTextNum(player.x, player.y-30, '"오마카세 좋죠." (-'+pay+'G)'); },
            onFail:null };
          addGateObj(mk1); addGateObj(mk2);
          addTextNum(player.x, player.y-44, '🍲/🍣 메뉴를 골라 밟아라 (5초)');
          b.bdMenuT = 16;
        }
      }
      // 신규 '프로필 검증': 주기적으로 표적 마크 소실 + 보스·디코이 자리 바꿈 (다시 골라야 한다)
      b.bdShufT = (b.bdShufT===undefined?12:b.bdShufT) - dt;
      if (b.bdShufT<=0){
        const alive2 = (b.bdAll||[]).filter(e=>enemies.includes(e));
        if (alive2.length){
          const sw = alive2[(Math.random()*alive2.length)|0];
          const tx=b.x, ty=b.y; b.x=sw.x; b.y=sw.y; sw.x=tx; sw.y=ty;
        }
        player.markTarget = null;
        screenDimT = Math.max(screenDimT, 0.35);
        addTextNum(player.x, player.y-44, '"프로필 다시 볼게요" — 표적 소실');
        SFX.play('tele');
        b.bdShufT = 13;
      }
      // 전멸기 '주선자 실망': 100초 초과 — 자리를 파토낸다
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 주선자 실망', '"두 분... 아닌 것 같네요. 자리 정리할게요."', '#b8362e');
        for (let k=0;k<28;k++){ const a2=(Math.PI*2/28)*k; hostileShot(b.x, b.y, a2, 155, 7, 60*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.35;
      }
    } else if (b.kind==='upstairs'){
      // 관문 보스 5호: 층간소음 윗집 — 천장이 울린다 (진동파 틈새 회피 레이드)
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 밤 10시', '쿵. 쿵. 쿵. 간격이 짧아진다.', '#7a6a52'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 새벽 3시', '어둠 속 — 소리가 나는 곳이 곧 위험이다.', '#b8362e'); screenDimT=Math.max(screenDimT,0.6); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){
        b.jEnraged=true; showBossBanner('발악 — 인테리어 공사', '"이참에 바닥을 싹 뜯기로 했어요."', '#b8362e'); shake=Math.min(24,shake+14);
      }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.5:1), dt);
      if (ph===3) screenDimT = Math.max(screenDimT, 0.25); // 새벽 — 상시 어둑
      // 기믹 '쿵쿵': 보스 중심 진동파 링 확산 — 링 띠에 닿으면 피해, 틈새로 회피
      b.uRings = b.uRings||[];
      b.uRingT = (b.uRingT===undefined?2:b.uRingT) - dt;
      if (b.uRingT<=0){
        b.uRings.push({ cx:b.x, cy:b.y, r:b.r+6 });
        effects.push({ type:'ring', x:b.x, y:b.y, life:5.0, age:0, r0:b.r+6, r1:b.r+6+150*5.0 });
        shake = Math.min(14, shake+5);
        SFX.play('hit');
        b.uRingT = (ph===1?3.0 : ph===2?1.6 : 1.1) * (enrage?0.7:1);
      }
      for (let ri=b.uRings.length-1;ri>=0;ri--){
        const rg = b.uRings[ri];
        rg.r += 150*dt;
        if (rg.r > 800){ b.uRings.splice(ri,1); continue; }
        const pd2 = Math.hypot(player.x-rg.cx, player.y-rg.cy);
        if (Math.abs(pd2-rg.r) < 15 && player.invuln<=0){
          if (playerHit(18*ds, 0.35, 8)) return true;
          addTextNum(player.x, player.y-30, '쿵!');
        }
      }
      // 일반 '발망치': 직선 충격파 3연
      b.uHamT = (b.uHamT===undefined?3:b.uHamT) - dt;
      if (b.uHamT<=0){
        const base = Math.atan2(player.y-b.y, player.x-b.x);
        for (let k=0;k<3;k++){
          setTimeout(()=>{ if (state==='playing' && bosses.includes(b)){
            const a3 = Math.atan2(player.y-b.y, player.x-b.x);
            for (let j=-1;j<=1;j++) hostileShot(b.x, b.y, a3+j*0.09, 250, 7, 17*ds, 2.4);
          } }, k*260);
        }
        addTextNum(b.x, b.y-b.r-14, '발망치');
        b.uHamT = (ph>=2?3.2:4.2) - empN*0.3;
      }
      // 일반 '가구 끌기' (2페+): 가로 스윕 탄막
      if (ph>=2){
        b.uDragT = (b.uDragT===undefined?5:b.uDragT) - dt;
        if (b.uDragT<=0){
          const vert = Math.random()<0.5;
          for (let k=0;k<9;k++){
            const off = (k-4)*70;
            const sx = vert ? player.x+off : player.x-420;
            const sy = vert ? player.y-420 : player.y+off;
            hostileShot(sx, sy, vert ? Math.PI/2 : 0, 190, 8, 16*ds, 4.5);
          }
          addTextNum(player.x, player.y-44, '가구 끄는 소리...');
          b.uDragT = 8 - ph;
        }
      }
      // 특수 '아이 뛰노는 소리': 무작위 다중 낙하 (경고 후 착탄)
      b.uKidT = (b.uKidT===undefined?4:b.uKidT) - dt;
      if (b.uKidT<=0){
        for (let k=0;k<3+ph*2;k++){
          addHazard(player.x+(Math.random()-0.5)*320, player.y+(Math.random()-0.5)*320, 54, 1.1, 20*ds, false);
        }
        addTextNum(player.x, player.y-44, '아이 뛰노는 소리');
        b.uKidT = (ph===3?3.2:4.8) - empN*0.4;
      }
      // 발악 '인테리어 공사': 필드 순차 붕괴 — 연속 대형 낙하
      if (enrage){
        b.uReno = (b.uReno===undefined?0.5:b.uReno) - dt;
        if (b.uReno<=0){
          const a2 = Math.random()*Math.PI*2, rr = Math.random()*260;
          addHazard(player.x+Math.cos(a2)*rr, player.y+Math.sin(a2)*rr, 88, 0.8, 30*ds, false);
          b.uReno = 0.55;
        }
      }
      // 신규 QTE '항의 방문': 초인종을 탭하면 보스가 5초 그로기 (받는 피해 2배) — 성공 보상형
      b.uBellT = (b.uBellT===undefined?18:b.uBellT) - dt;
      if (b.uBellT<=0){
        addGateObj({ kind:'qte', icon:'🔔', x:b.x+(Math.random()-0.5)*80, y:b.y+(Math.random()-0.5)*80, r:24, maxT:4,
          onTap:()=>{
            b.uGroggy = 5;
            addTextNum(b.x, b.y-b.r-16, '"...누구세요?" (그로기!)');
            showBossBanner('그로기', '항의 방문 성공 — 5초간 피해 2배', '#3f7a5c');
          },
          onFail:()=>{ addTextNum(player.x, player.y-30, '초인종을 못 눌렀다...'); } });
        addTextNum(player.x, player.y-44, '🔔 초인종 찬스 — 탭하면 그로기!');
        b.uBellT = 22;
      }
      if (b.uGroggy>0){
        b.uGroggy -= dt;
        b.hp -= b.maxHp*0.008*dt; // 그로기 중 추가 출혈 (피해 2배 근사)
        if (Math.random()<dt*3) particles.push({ x:b.x+(Math.random()-0.5)*30, y:b.y-b.r, vx:0, vy:-30, life:0.5, age:0, r:3, ghost:true });
      }
      // 신규 '잔해' (2페+): 낙하물이 통행 불가 잔해를 남긴다 — 전장이 점점 좁아진다
      if (ph>=2){
        b.uDebrisT = (b.uDebrisT===undefined?12:b.uDebrisT) - dt;
        if (b.uDebrisT<=0 && zones.length<38){
          const a2 = Math.random()*Math.PI*2, rr = 90+Math.random()*160;
          zones.push({ x:player.x+Math.cos(a2)*rr, y:player.y+Math.sin(a2)*rr, r:26, dps:0, t:25, maxT:25, type:'block', hostile:true, hitT:0 });
          addTextNum(player.x, player.y-44, '천장 잔해 낙하!');
          b.uDebrisT = 13 - ph*2;
        }
      }
      // 신규 '세탁기 탈수' (3페): 회전 나선 탄막
      if (ph>=3){
        b.uSpinA = (b.uSpinA||0) + dt*2.6;
        b.uSpinT = (b.uSpinT===undefined?1:b.uSpinT) - dt;
        if (b.uSpinT<=0){
          for (let k=0;k<2;k++) hostileShot(b.x, b.y, b.uSpinA + k*Math.PI, 190, 6, 15*ds, 3.2);
          b.uSpinT = 0.16;
        }
      }
      // 전멸기 '경비실 호출 무시': 100초 초과 — 온 건물이 울린다
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 경비실 호출 무시', '"신고하시든가요. 저희 집인데."', '#b8362e');
        for (let k=0;k<28;k++){ const a2=(Math.PI*2/28)*k; hostileShot(b.x, b.y, a2, 145, 7, 60*ds, 4); }
        b.uRingT = 0; b.dmg = Math.round(b.dmg*1.6);
      }
    } else if (b.kind==='jeonse'){
      // 관문 보스 6호: 전세 사기꾼 — 보증금을 지키는 재산 방어 레이드
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 특약 발동', '"계약서엔 그런 말 없었는데요?"', '#8a7a3f'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 경매 개시', '"낙찰되면 나가주셔야죠."', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage){
        if (!b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 야반도주', '"...잠깐 화장실 좀."', '#b8362e'); shake=Math.min(24,shake+14); }
        // 도주하며 후방 살포 — 놓치면 전멸기가 먼저 온다
        bossMoveToward(b, player.x, player.y, -b.speed*2.0, dt);
        b.zRunT = (b.zRunT||0) - dt;
        if (b.zRunT<=0){
          const away = Math.atan2(player.y-b.y, player.x-b.x);
          for (let k=-1;k<=1;k++) hostileShot(b.x, b.y, away+Math.PI+k*0.3, 200, 6, 18*ds, 2.4);
          b.zRunT = 0.8;
        }
      } else {
        bossMoveToward(b, player.x, player.y, b.speed*(ph===3?1.3:1), dt);
      }
      // 기믹 '보증금 회수': 주기적으로 골드를 뜯어간다 — 못 내면 몸으로
      b.zRentT = (b.zRentT===undefined?6:b.zRentT) - dt;
      if (b.zRentT<=0){
        const take = Math.min(runGold, 15 + ph*12);
        if (take>0){ runGold -= take; b.zStolen=(b.zStolen||0)+take; addTextNum(player.x, player.y-30, '-'+take+'G 보증금 회수'); }
        else if (player.invuln<=0){ if (playerHit(22*ds, 0.3, 6)) return true; addTextNum(player.x, player.y-30, '"돈이 없으면 몸으로."'); }
        SFX.play('coin');
        b.zRentT = 7 - ph;
      }
      // '깡통전세': 함정 장판 대량 살포
      b.zTrapT = (b.zTrapT===undefined?4:b.zTrapT) - dt;
      if (b.zTrapT<=0){
        for (let k=0;k<3+ph*2;k++){
          addHazard(player.x+(Math.random()-0.5)*340, player.y+(Math.random()-0.5)*340, 58, 1.3, 20*ds, false);
        }
        addTextNum(player.x, player.y-44, '깡통전세!');
        b.zTrapT = (ph===3?3.6:5.2) - empN*0.4;
      }
      // 신규 '진짜 계약서' 아이템 (2페+): 주우면 보스 대미지 + 뜯긴 보증금 절반 회수
      if (ph>=2){
        b.zPaperT = (b.zPaperT===undefined?14:b.zPaperT) - dt;
        if (b.zPaperT<=0){
          const a2 = Math.random()*Math.PI*2;
          addGateObj({ kind:'pick', icon:'📜', x:b.x+Math.cos(a2)*160, y:b.y+Math.sin(a2)*160, r:20, maxT:6,
            onPick:()=>{
              b.hp -= b.maxHp*0.05;
              const back = Math.floor((b.zStolen||0)*0.5); b.zStolen = 0;
              if (back>0){ runGold += back; addTextNum(player.x, player.y-30, '📜 증거 확보! +'+back+'G 회수'); }
              else addTextNum(player.x, player.y-30, '📜 증거 확보! (보스 타격)');
              refreshBossBar(); SFX.play('win');
            },
            onFail:()=>{ addTextNum(player.x, player.y-30, '계약서가 파쇄되었다...'); } });
          addTextNum(player.x, player.y-44, '📜 진짜 계약서가 떨어졌다!');
          b.zPaperT = 18;
        }
      }
      // '등기부 등본' (2페+): 휘어지며 쫓아오는 서류 탄
      if (ph>=2){
        b.zDocT = (b.zDocT===undefined?3:b.zDocT) - dt;
        if (b.zDocT<=0){
          const aim = Math.atan2(player.y-b.y, player.x-b.x);
          for (let k=0;k<2+ph;k++) hostileShot(b.x, b.y, aim+(k-1)*0.4, 175, 7, 17*ds, 3.4, {kind:'tornado',curve:(k%2?1:-1)*1.3});
          addTextNum(b.x, b.y-b.r-14, '등기부 등본');
          b.zDocT = 4.2 - ph*0.5;
        }
      }
      // 3페 '경매 개시': 전방위 낙찰봉
      if (ph>=3){
        b.zAucT = (b.zAucT===undefined?4:b.zAucT) - dt;
        if (b.zAucT<=0){
          for (let k=0;k<20;k++){ const a2=(Math.PI*2/20)*k; hostileShot(b.x, b.y, a2, 165, 6, 18*ds, 3.0); }
          addTextNum(b.x, b.y-b.r-14, '유찰! 재경매!');
          b.zAucT = 5;
        }
      }
      // 전멸기 '전세사기 완성': 100초 — 재산 절반 증발 + 대탄막
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 전세사기 완성', '"명의는 이미 바지사장 겁니다."', '#b8362e');
        const lost = Math.floor(runGold*0.5);
        runGold -= lost;
        toast('💸 런 골드 절반 증발 (-'+lost+'G)');
        for (let k=0;k<32;k++){ const a2=(Math.PI*2/32)*k; hostileShot(b.x, b.y, a2, 150, 7, 60*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.3;
      }
    } else if (b.kind==='aialgo'){
      // 관문 보스 7호: AI 알고리즘 — 너의 움직임을 학습한다 (예측 사격 레이드)
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 맞춤 추천', '「회원님이 좋아할 만한 탄막」', '#5ab8c9'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 무한 스크롤', '「다음 탄막이 자동 재생됩니다」', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){
        b.jEnraged=true; showBossBanner('발악 — A/B 테스트', '「어느 쪽에 죽는지 실험 중」', '#b8362e'); shake=Math.min(24,shake+14);
      }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.6:1), dt);
      // 플레이어 속도 추정 (학습)
      if (b.aiLX!==undefined){
        b.aiVX = (player.x-b.aiLX)/Math.max(dt,0.001)*0.7 + (b.aiVX||0)*0.3;
        b.aiVY = (player.y-b.aiLY)/Math.max(dt,0.001)*0.7 + (b.aiVY||0)*0.3;
      }
      b.aiLX = player.x; b.aiLY = player.y;
      // 기믹 '알고리즘 추천': 예측 조준탄 — 이동 방향 앞을 노린다 (무빙을 읽힌다)
      b.aiPredT = (b.aiPredT===undefined?2.5:b.aiPredT) - dt;
      if (b.aiPredT<=0){
        const lead = 0.55;
        const tx = player.x + (b.aiVX||0)*lead, ty = player.y + (b.aiVY||0)*lead;
        const aim = Math.atan2(ty-b.y, tx-b.x);
        const n = 2+ph;
        for (let k=0;k<n;k++) hostileShot(b.x, b.y, aim+(k-(n-1)/2)*0.10, 290, 6, 17*ds, 2.2);
        addTextNum(b.x, b.y-b.r-14, '맞춤 추천');
        b.aiPredT = (ph===3?1.6:2.3) - empN*0.2;
      }
      // '숏폼 늪' (2페+): 들어가면 스킬 봉인 + 도트 — 화면에서 눈을 못 뗀다
      if (ph>=2){
        b.aiFeedT = (b.aiFeedT===undefined?7:b.aiFeedT) - dt;
        if (b.aiFeedT<=0 && zones.length<40){
          zones.push({ x:player.x+(Math.random()-0.5)*160, y:player.y+(Math.random()-0.5)*160, r:110, dps:0, t:6, maxT:6, type:'silence', hostile:true, hitT:0 });
          addTextNum(player.x, player.y-40, '숏폼 늪 — 손이 멈추지 않는다');
          b.aiFeedT = 10 - ph;
        }
      }
      // 신규 QTE '광고 스킵': AD를 탭하면 예측탄 5초 정지 — 방치 시 강제 광고 폭탄
      b.aiAdT = (b.aiAdT===undefined?13:b.aiAdT) - dt;
      if (b.aiAdT<=0){
        const a2 = Math.random()*Math.PI*2;
        addGateObj({ kind:'qte', icon:'⏭', x:player.x+Math.cos(a2)*150, y:player.y+Math.sin(a2)*150, r:22, maxT:3,
          onTap:()=>{ b.aiPredT = Math.max(b.aiPredT||0, 5); addTextNum(player.x, player.y-30, '광고 건너뛰기 — 추천 정지 5초'); },
          onFail:()=>{
            for (let k=0;k<14;k++){ const a3=(Math.PI*2/14)*k; hostileShot(player.x, player.y, a3, 170, 6, 20*ds, 1.8); }
            addTextNum(player.x, player.y-40, '건너뛸 수 없는 광고!');
            SFX.play('boom');
          } });
        addTextNum(player.x, player.y-44, '⏭ 광고가 재생된다 — 탭해서 스킵!');
        b.aiAdT = 14;
      }
      // 신규 '쿠키 수집' (2페+): 쿠키를 보스보다 먼저 밟아 없애라 — 방치 시 보스가 먹고 영구 강화
      if (ph>=2){
        b.aiCookT = (b.aiCookT===undefined?10:b.aiCookT) - dt;
        if (b.aiCookT<=0){
          const a2 = Math.random()*Math.PI*2;
          addGateObj({ kind:'pick', icon:'🍪', x:b.x+Math.cos(a2)*180, y:b.y+Math.sin(a2)*180, r:20, maxT:6,
            onPick:()=>{ addTextNum(player.x, player.y-30, '쿠키 삭제 — 학습 차단'); },
            onFail:()=>{ b.dmg = Math.round(b.dmg*1.08); b.speed *= 1.04; addTextNum(b.x, b.y-b.r-14, '개인정보 수집 완료 (영구 강화)'); SFX.play('warn'); } });
          addTextNum(player.x, player.y-44, '🍪 쿠키를 먼저 밟아 없애라!');
          b.aiCookT = 12;
        }
      }
      // 3페 '무한 스크롤': 4갈래 회전 나선
      if (ph>=3){
        b.aiSpinA = (b.aiSpinA||0) + dt*2.2;
        b.aiSpinT = (b.aiSpinT===undefined?1:b.aiSpinT) - dt;
        if (b.aiSpinT<=0){
          for (let k=0;k<4;k++) hostileShot(b.x, b.y, b.aiSpinA + k*Math.PI/2, 180, 6, 16*ds, 3.2);
          b.aiSpinT = 0.20;
        }
      }
      // 발악 'A/B 테스트': 예측탄·나선 고속 교차
      if (enrage){
        b.aiPredT = Math.min(b.aiPredT, 1.0);
        b.aiSpinT = Math.min(b.aiSpinT===undefined?0.2:b.aiSpinT, 0.13);
      }
      // 전멸기 '계정 정지': 100초 — 스킬 잠금 + 대탄막
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 계정 정지', '「커뮤니티 가이드라인 위반: 생존 시도」', '#b8362e');
        player.skCds = player.skCds.map(cd=>Math.max(cd,10));
        player.ultCooldown = Math.max(player.ultCooldown, 10);
        toast('🚫 모든 스킬 10초 잠금');
        for (let k=0;k<28;k++){ const a2=(Math.PI*2/28)*k; hostileShot(b.x, b.y, a2, 155, 7, 60*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6);
      }
    } else if (b.kind==='chinafeast'){
      // 관문 44: 중화 대연회 — 페이즈마다 페르소나가 바뀐다 (계란볶음밥 → 마오쩌둥 → 시진핑핑이)
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ b.name='중화 대연회 · 마오쩌둥'; showBossBanner('2페르소나 — 인민의 파도', '"인민의 바다에 빠뜨려라."', '#b8362e'); refreshBossBar(); SFX.play('warn'); }
        if (ph===3){ b.name='중화 대연회 · 시진핑핑이'; showBossBanner('3페르소나 — 검열', '"이 전투 기록은 존재하지 않는다."', '#c9a13f'); refreshBossBar(); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 대연회 폭주', '세 얼굴이 동시에 눈을 뜬다.', '#b8362e'); shake=Math.min(24,shake+14); }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.5:1), dt);
      // 1페르소나 '웍 화염': 회전 화염 나선 + 볶음 장판
      if (ph===1 || enrage){
        b.cSpinA = (b.cSpinA||0) + dt*2.4;
        b.cSpinT = (b.cSpinT===undefined?1:b.cSpinT) - dt;
        if (b.cSpinT<=0){
          for (let k=0;k<3;k++) hostileShot(b.x, b.y, b.cSpinA + k*Math.PI*2/3, 185, 6, 18*ds, 3.0);
          b.cSpinT = 0.22;
        }
        b.cWokT = (b.cWokT===undefined?4:b.cWokT) - dt;
        if (b.cWokT<=0){
          for (let k=0;k<4;k++) addHazard(player.x+(Math.random()-0.5)*260, player.y+(Math.random()-0.5)*260, 60, 1.2, 22*ds, false);
          addTextNum(b.x, b.y-b.r-14, '웍질!');
          b.cWokT = 5;
        }
      }
      // 2페르소나 '인해전술': 대량 소환 + 대장정 돌진
      if (ph===2 || enrage){
        b.cMassT = (b.cMassT===undefined?4:b.cMassT) - dt;
        if (b.cMassT<=0){
          for (let k=0;k<6;k++){
            const a2 = Math.random()*Math.PI*2;
            const mob = makeEnemy('swarm', b.x+Math.cos(a2)*100, b.y+Math.sin(a2)*100, false);
            mob.xpValue=0; enemies.push(mob);
          }
          addTextNum(b.x, b.y-b.r-14, '인해전술');
          b.cMassT = enrage?6:8;
        }
        b.cMarchT = (b.cMarchT===undefined?6:b.cMarchT) - dt;
        if (b.cMarchT<=0){
          bossMoveToward(b, player.x, player.y, b.speed*6, dt*8); // 대장정 — 순간 압박 돌진
          addTextNum(b.x, b.y-b.r-14, '대장정!');
          shake=Math.min(16,shake+8);
          b.cMarchT = 7;
        }
      }
      // 3페르소나 '검열': 화면 어둑 + 정찰풍선 (자폭 소환) + 포위 수렴탄
      if (ph===3 || enrage){
        screenDimT = Math.max(screenDimT, 0.25);
        b.cBalT = (b.cBalT===undefined?5:b.cBalT) - dt;
        if (b.cBalT<=0){
          for (let k=0;k<3;k++){
            const a2 = Math.random()*Math.PI*2;
            const bal = makeEnemy('kamikaze', player.x+Math.cos(a2)*320, player.y+Math.sin(a2)*320, false);
            bal.name='정찰풍선'; bal.xpValue=0; enemies.push(bal);
          }
          addTextNum(player.x, player.y-44, '🎈 정찰풍선 접근');
          b.cBalT = 7;
        }
        b.cConvT = (b.cConvT===undefined?4:b.cConvT) - dt;
        if (b.cConvT<=0){
          for (let k=0;k<14;k++){
            const a2 = (Math.PI*2/14)*k;
            const sx = player.x+Math.cos(a2)*380, sy = player.y+Math.sin(a2)*380;
            hostileShot(sx, sy, Math.atan2(player.y-sy, player.x-sx), 160, 6, 18*ds, 3.0);
          }
          addTextNum(player.x, player.y-44, '만리방화벽');
          b.cConvT = 5.5;
        }
      }
      // QTE '사상 검증' (2페+): 탭해서 통과하지 못하면 침묵 + 도트
      if (ph>=2){
        b.cQuizT = (b.cQuizT===undefined?11:b.cQuizT) - dt;
        if (b.cQuizT<=0){
          const a2 = Math.random()*Math.PI*2;
          addGateObj({ kind:'qte', icon:'📕', x:player.x+Math.cos(a2)*150, y:player.y+Math.sin(a2)*150, r:22, maxT:3,
            onTap:()=>{ addTextNum(player.x, player.y-30, '"만족스러운 답변이다."'); },
            onFail:()=>{ if (zones.length<40) zones.push({ x:player.x, y:player.y, r:130, dps:0, t:6, maxT:6, type:'silence', hostile:true, hitT:0 }); addTextNum(player.x, player.y-40, '재교육 대상 지정'); } });
          addTextNum(player.x, player.y-44, '📕 사상 검증 — 탭해서 통과하라!');
          b.cQuizT = 12;
        }
      }
      // '🥟 만두' 회복 찬스 (연회니까)
      b.cFoodT = (b.cFoodT===undefined?20:b.cFoodT) - dt;
      if (b.cFoodT<=0){
        const a2 = Math.random()*Math.PI*2;
        addGateObj({ kind:'pick', icon:'🥟', x:player.x+Math.cos(a2)*190, y:player.y+Math.sin(a2)*190, r:20, maxT:6,
          onPick:()=>{ player.hp = Math.min(player.maxHp, player.hp + player.maxHp*0.10); addTextNum(player.x, player.y-30, '🥟 +10%'); },
          onFail:null });
        b.cFoodT = 22;
      }
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 국가 기밀', '"너는 처음부터 없었다."', '#b8362e');
        for (let k=0;k<32;k++){ const a2=(Math.PI*2/32)*k; hostileShot(b.x, b.y, a2, 150, 7, 62*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.3;
      }
    } else if (b.kind==='tariffwar'){
      // 관문 48: 관세 전쟁 · 트럼프 — 고지서를 치워야 산다
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 무역 장벽', '"벽을 세울 겁니다. 아주 거대한 벽을."', '#d4772e'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 폭풍 관세', '"모두에게 100% 관세!"', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 트루스 소셜 폭주', '전부 대문자로 쏟아진다.', '#b8362e'); shake=Math.min(24,shake+14); }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.7:1), dt);
      // 기믹 '관세 고지서': 필드에 고지서 — 밟아서 치우지 않으면 폭발 + 보스 영구 강화 스택
      b.tBillT = (b.tBillT===undefined?4:b.tBillT) - dt;
      if (b.tBillT<=0){
        for (let k=0;k<(ph>=3?2:1);k++){
          const a2 = Math.random()*Math.PI*2;
          const bx2 = player.x+Math.cos(a2)*(120+Math.random()*140), by2 = player.y+Math.sin(a2)*(120+Math.random()*140);
          addGateObj({ kind:'pick', icon:'🧾', x:bx2, y:by2, r:20, maxT:8,
            onPick:()=>{ addTextNum(player.x, player.y-30, '관세 무효화'); },
            onFail:()=>{
              b.dmg = Math.round(b.dmg*1.05);
              for (let j=0;j<8;j++){ const a3=(Math.PI*2/8)*j; hostileShot(bx2, by2, a3, 170, 6, 20*ds, 1.8); }
              addTextNum(bx2, by2-24, '관세 발효! (보스 강화)');
              SFX.play('boom');
            } });
        }
        b.tBillT = (ph===1?7 : ph===2?5.5 : 4) * (enrage?0.7:1);
      }
      // '무역 장벽' (2페+): 파괴 가능한 장벽 라인 — 경로가 막힌다
      if (ph>=2){
        b.tWallT = (b.tWallT===undefined?10:b.tWallT) - dt;
        if (b.tWallT<=0){
          const wa = Math.random()*Math.PI*2;
          for (let k=-2;k<=2;k++){
            const wall = makeEnemy('brute', player.x+Math.cos(wa)*180+Math.cos(wa+Math.PI/2)*k*52, player.y+Math.sin(wa)*180+Math.sin(wa+Math.PI/2)*k*52, false);
            wall.name='국경 장벽'; wall.speed=0; wall.hp*=2; wall.maxHp*=2; wall.dmg=0; wall.xpValue=0; wall.grade=0; wall.blessed=false;
            enemies.push(wall);
          }
          addTextNum(player.x, player.y-44, '🧱 장벽 건설! 부수고 나가라');
          b.tWallT = 16;
        }
      }
      // '트윗 폭풍': 랜덤 산탄
      b.tTweetT = (b.tTweetT===undefined?3:b.tTweetT) - dt;
      if (b.tTweetT<=0){
        const n = 5+ph*2;
        for (let k=0;k<n;k++) hostileShot(b.x, b.y, Math.random()*Math.PI*2, 200+Math.random()*80, 6, 16*ds, 2.4);
        addTextNum(b.x, b.y-b.r-14, 'SNS 폭풍');
        b.tTweetT = (enrage?1.2:2.6) - empN*0.2;
      }
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 디폴트 선언', '"손해는 전부 너희 몫입니다."', '#b8362e');
        for (let k=0;k<32;k++){ const a2=(Math.PI*2/32)*k; hostileShot(b.x, b.y, a2, 150, 7, 62*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.3;
      }
    } else if (b.kind==='warzone'){
      // 관문 52: 동원령 — 전쟁 그 자체. 참호 안에서만 폭격을 버틴다
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 총동원', '전선이 확대된다.', '#5c6652'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 소모전', '포성이 멎지 않는다.', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 총력전', '모든 포문이 열린다.', '#b8362e'); shake=Math.min(24,shake+14); }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.4:1), dt);
      // 기믹 '참호': 이동하는 안전지대 (그늘 재활용) — 융단폭격은 참호 안만 생존
      if (b.wTrX===undefined){ b.wTrX=player.x; b.wTrY=player.y; b.wTrA=Math.random()*Math.PI*2; }
      b.wTrA += (Math.random()-0.5)*dt*1.8;
      b.wTrX += Math.cos(b.wTrA)*30*dt; b.wTrY += Math.sin(b.wTrA)*30*dt;
      const trR = ph===1?120 : ph===2?95 : 75;
      if (!b.wTrZone || b.wTrZone.t<=0){ b.wTrZone = { x:b.wTrX, y:b.wTrY, r:trR, dps:0, t:0.6, maxT:0.6, type:'shade', hostile:true }; zones.push(b.wTrZone); }
      b.wTrZone.x=b.wTrX; b.wTrZone.y=b.wTrY; b.wTrZone.r=trR; b.wTrZone.t=0.6;
      // '융단 폭격': 5초 예고 후 참호 밖 전멸급
      b.wNukeT = (b.wNukeT===undefined?14:b.wNukeT) - dt;
      if (b.wNukeT<=0 && !b.wNukeWarn){
        b.wNukeWarn = 5;
        showBossBanner('경고 — 융단 폭격', '5초 후 착탄. 참호로!', '#b8362e');
        SFX.play('warn');
      }
      if (b.wNukeWarn){
        b.wNukeWarn -= dt;
        if (b.wNukeWarn<=0){
          b.wNukeWarn = null; b.wNukeT = ph===3?11:15;
          const inT = Math.hypot(player.x-b.wTrX, player.y-b.wTrY) < trR;
          effects.push({ type:'ring', x:player.x, y:player.y, life:0.8, age:0, r0:80, r1:700 });
          shake = Math.min(28, shake+18); SFX.play('boom');
          if (!inT && player.invuln<=0){ if (playerHit(75*ds, 0.5, 14)) return true; addTextNum(player.x, player.y-40, '융단 폭격 직격!'); }
          else addTextNum(player.x, player.y-30, '참호 생존!');
        }
      }
      // '포격 좌표': 순차 격자 폭격
      b.wArtT = (b.wArtT===undefined?3:b.wArtT) - dt;
      if (b.wArtT<=0){
        for (let k=0;k<4+ph*2;k++) addHazard(player.x+(Math.random()-0.5)*420, player.y+(Math.random()-0.5)*420, 58, 1.0+Math.random()*0.8, 24*ds, false);
        b.wArtT = (ph===3?2.6:3.8) * (enrage?0.6:1);
      }
      // '드론 편대' (2페+): 자폭 드론
      if (ph>=2){
        b.wDroneT = (b.wDroneT===undefined?7:b.wDroneT) - dt;
        if (b.wDroneT<=0){
          for (let k=0;k<3;k++){
            const a2 = Math.random()*Math.PI*2;
            const dr = makeEnemy('kamikaze', player.x+Math.cos(a2)*340, player.y+Math.sin(a2)*340, false);
            dr.name='자폭 드론'; dr.xpValue=0; dr.speed*=1.25; enemies.push(dr);
          }
          addTextNum(player.x, player.y-44, '✈ 드론 편대 접근');
          b.wDroneT = 9;
        }
      }
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 핵우산', '외교의 시간은 끝났다.', '#b8362e');
        for (let k=0;k<36;k++){ const a2=(Math.PI*2/36)*k; hostileShot(b.x, b.y, a2, 145, 8, 65*ds, 4.5); }
        b.dmg = Math.round(b.dmg*1.6);
      }
    } else if (b.kind==='yeongkkeul'){
      // 관문 56: 영끌 폭주 연합 — 킥보드 군단 + 이자 지뢰밭
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 변동 금리', '"금리가 또 올랐습니다."', '#8a6a3f'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 만기 도래', '"원금 상환일입니다."', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 신용 붕괴', '더 잃을 것이 없는 자가 가장 위험하다.', '#b8362e'); shake=Math.min(24,shake+14); }
      // '뺑소니 돌진': 예고 후 고속 직선 관통
      b.yDashT = (b.yDashT===undefined?4:b.yDashT) - dt;
      if (b.yDashPrep){
        b.yDashPrep -= dt;
        if (b.yDashPrep<=0){
          b.yDashing = 0.7;
          b.yDashA = Math.atan2(player.y-b.y, player.x-b.x);
          SFX.play('sweep');
        }
      } else if (b.yDashing){
        b.yDashing -= dt;
        b.x += Math.cos(b.yDashA)*760*dt;
        b.y += Math.sin(b.yDashA)*760*dt;
        if (Math.hypot(player.x-b.x, player.y-b.y) < b.r+player.r+4 && player.invuln<=0){
          if (playerHit(30*ds, 0.5, 10)) return true;
        }
        if (b.yDashing<=0) b.yDashT = (ph===3?3.2:4.5) * (enrage?0.6:1);
      } else if (b.yDashT<=0){
        b.yDashPrep = 0.55;
        addTextNum(b.x, b.y-b.r-14, '🛴 뺑소니 예고!');
      } else {
        bossMoveToward(b, player.x, player.y, b.speed, dt);
      }
      // '이자 지뢰밭': 오래 남는 지뢰 장판
      b.yMineT = (b.yMineT===undefined?4:b.yMineT) - dt;
      if (b.yMineT<=0){
        for (let k=0;k<3+ph;k++) addHazard(player.x+(Math.random()-0.5)*360, player.y+(Math.random()-0.5)*360, 50, 2.5+Math.random()*2, 22*ds, false);
        addTextNum(player.x, player.y-44, '복리 지뢰');
        b.yMineT = 6 - ph;
      }
      // '킥보드 군단' (2페+): 고속 자폭 킥보드 소환
      if (ph>=2){
        b.yKickT = (b.yKickT===undefined?8:b.yKickT) - dt;
        if (b.yKickT<=0){
          for (let k=0;k<4;k++){
            const a2 = Math.random()*Math.PI*2;
            const kb = makeEnemy('fish', player.x+Math.cos(a2)*360, player.y+Math.sin(a2)*360, false);
            kb.name='공유 킥보드'; kb.xpValue=0; kb.speed*=1.3; enemies.push(kb);
          }
          addTextNum(player.x, player.y-44, '🛴 킥보드 군단');
          b.yKickT = 10;
        }
      }
      // '벌금 고지서' 선택: 밟으면 -60G, 방치하면 폭발
      b.yFineT = (b.yFineT===undefined?12:b.yFineT) - dt;
      if (b.yFineT<=0){
        const a2 = Math.random()*Math.PI*2;
        const fx2 = player.x+Math.cos(a2)*160, fy2 = player.y+Math.sin(a2)*160;
        addGateObj({ kind:'pick', icon:'💸', x:fx2, y:fy2, r:20, maxT:6,
          onPick:()=>{ const pay=Math.min(runGold,60); runGold-=pay; addTextNum(player.x, player.y-30, '벌금 납부 (-'+pay+'G)'); },
          onFail:()=>{
            for (let j=0;j<10;j++){ const a3=(Math.PI*2/10)*j; hostileShot(fx2, fy2, a3, 175, 6, 22*ds, 1.8); }
            addTextNum(fx2, fy2-24, '연체 — 가산세 폭발!');
            SFX.play('boom');
          } });
        addTextNum(player.x, player.y-44, '💸 벌금 고지서 — 낼 것인가 버틸 것인가');
        b.yFineT = 14;
      }
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 파산 선고', '"보유 자산 전액을 회수합니다."', '#b8362e');
        const lost = runGold; runGold = 0;
        if (lost>0) toast('💸 런 골드 전액 증발 (-'+lost+'G)');
        for (let k=0;k<32;k++){ const a2=(Math.PI*2/32)*k; hostileShot(b.x, b.y, a2, 150, 7, 65*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.3;
      }
    } else if (b.kind==='gkshield'){
      // 수문장 · 강철 방패기사: 주기적 절대 방어 — 핵(⚙)을 탭해 실드를 깨야 한다
      bossMoveToward(b, player.x, player.y, b.speed*(b.gsGroggy>0?0:1), dt);
      if (b.gsGroggy>0){ b.gsGroggy -= dt; b.hp -= b.maxHp*0.01*dt; }
      b.gsCycT = (b.gsCycT===undefined?8:b.gsCycT) - dt;
      if (b.gsCycT<=0 && !b.gsShield){
        b.gsShield = 8; b.gsLockHp = b.hp;
        addGateObj({ kind:'qte', icon:'⚙', x:b.x+(Math.random()-0.5)*120, y:b.y+(Math.random()-0.5)*120, r:24, maxT:8,
          onTap:()=>{ b.gsShield = 0; b.gsGroggy = 3.5; addTextNum(b.x, b.y-b.r-16, '실드 붕괴! (그로기)'); showBossBanner('실드 브레이크', '핵 파괴 — 3.5초 그로기', '#3f7a5c'); },
          onFail:()=>{} });
        showBossBanner('절대 방어', '⚙ 핵을 탭해 실드를 깨라!', '#6a7a8a');
        SFX.play('warn');
      }
      if (b.gsShield>0){
        b.gsShield -= dt;
        b.hp = Math.max(b.hp, b.gsLockHp); // 실드 중 피해 무효
        if (b.gsShield<=0){ b.gsCycT = 10; addTextNum(b.x, b.y-b.r-14, '실드 소멸'); }
      }
      // 방패 밀치기: 정면 3연 광탄
      b.gsPushT = (b.gsPushT===undefined?3:b.gsPushT) - dt;
      if (b.gsPushT<=0 && !(b.gsGroggy>0)){
        const aim = Math.atan2(player.y-b.y, player.x-b.x);
        for (let k=-1;k<=1;k++) hostileShot(b.x, b.y, aim+k*0.16, 230, 8, 18*ds, 2.2);
        b.gsPushT = 3.2;
      }
      if (b.flav && !(b.gsGroggy>0)) tickMidFlavor(b, dt, ds);
    } else if (b.kind==='gktwin'){
      // 수문장 · 쌍둥이 그림자: 분신이 살아있는 동안 화력 2배 — 분신부터 처리하라
      bossMoveToward(b, player.x, player.y, b.speed, dt);
      b.gtClone = b.gtClone && enemies.includes(b.gtClone) ? b.gtClone : null;
      b.gtCloneT = (b.gtCloneT===undefined?1:b.gtCloneT) - dt;
      if (!b.gtClone && b.gtCloneT<=0){
        const a2 = Math.random()*Math.PI*2;
        const cl = makeEnemy('clone', b.x+Math.cos(a2)*120, b.y+Math.sin(a2)*120, false);
        cl.name='그림자 분신'; cl.hp*=6; cl.maxHp*=6; cl.xpValue=0; cl.grade=0; cl.blessed=false;
        enemies.push(cl); b.gtClone = cl;
        addTextNum(b.x, b.y-b.r-14, '그림자 분열');
        b.gtCloneT = 12;
      }
      const twinUp = b.gtClone ? 2 : 1;
      // 거울 탄막: 조준 + 정반대 동시
      b.gtMirT = (b.gtMirT===undefined?2.5:b.gtMirT) - dt;
      if (b.gtMirT<=0){
        const aim = Math.atan2(player.y-b.y, player.x-b.x);
        for (let k=0;k<twinUp;k++){
          hostileShot(b.x, b.y, aim, 240, 6, 16*ds, 2.4);
          hostileShot(b.x, b.y, aim+Math.PI, 240, 6, 16*ds, 2.4);
          if (b.gtClone){ hostileShot(b.gtClone.x, b.gtClone.y, Math.atan2(player.y-b.gtClone.y, player.x-b.gtClone.x), 240, 6, 16*ds, 2.4); }
        }
        b.gtMirT = 2.8/twinUp;
      }
      // 교차 베기: 플레이어 양측 협공탄
      b.gtCrossT = (b.gtCrossT===undefined?6:b.gtCrossT) - dt;
      if (b.gtCrossT<=0){
        const a2 = Math.random()*Math.PI*2;
        hostileShot(player.x+Math.cos(a2)*300, player.y+Math.sin(a2)*300, a2+Math.PI, 320, 8, 20*ds, 2.0);
        hostileShot(player.x-Math.cos(a2)*300, player.y-Math.sin(a2)*300, a2, 320, 8, 20*ds, 2.0);
        addTextNum(player.x, player.y-40, '교차 베기!');
        b.gtCrossT = 7;
      }
      if (b.flav) tickMidFlavor(b, dt, ds);
    } else if (b.kind==='gktrain'){
      // 수문장 · 궤도 기관차: 선로 예고 후 관통 돌진 — 선로 밖으로!
      if (b.trDashing){
        b.trDashing -= dt;
        b.x += Math.cos(b.trA)*680*dt;
        b.y += Math.sin(b.trA)*680*dt;
        if (Math.hypot(player.x-b.x, player.y-b.y) < b.r+player.r+6 && player.invuln<=0){
          if (playerHit(28*ds, 0.5, 12)) return true;
        }
      } else if (b.trPrep){
        b.trPrep -= dt;
        if (b.trPrep<=0){ b.trDashing = 1.1; SFX.play('sweep'); shake=Math.min(16,shake+8); }
      } else {
        bossMoveToward(b, player.x, player.y, b.speed, dt);
        b.trT = (b.trT===undefined?4:b.trT) - dt;
        if (b.trT<=0){
          b.trA = Math.atan2(player.y-b.y, player.x-b.x);
          b.trPrep = 0.9;
          // 선로 예고: 경로에 하자드 라인
          for (let k=1;k<=6;k++) addHazard(b.x+Math.cos(b.trA)*k*110, b.y+Math.sin(b.trA)*k*110, 46, 0.9, 16*ds, false);
          addTextNum(b.x, b.y-b.r-14, '🚂 기적 소리 — 선로를 벗어나라!');
          SFX.play('warn');
          b.trT = 5.5;
        }
        // 석탄 살포
        b.trCoalT = (b.trCoalT===undefined?3:b.trCoalT) - dt;
        if (b.trCoalT<=0){
          for (let k=0;k<4;k++) hostileShot(b.x, b.y, Math.random()*Math.PI*2, 150+Math.random()*80, 6, 14*ds, 2.6);
          b.trCoalT = 3.4;
        }
        if (b.flav) tickMidFlavor(b, dt, ds);
      }
    } else if (b.kind==='teamlead'){
      // 관문 36: 퇴사 막는 팀장 — 사직서 3장을 보스보다 먼저 회수하라
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 회유', '"연봉 얘기는 밥 먹으면서 하자."', '#4a5568'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 압박', '"지금 나가면 경력에 흠집 나."', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 읍소', '"제발... 다음 달까지만."', '#b8362e'); shake=Math.min(24,shake+14); }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.6: ph===3?1.25:1), dt);
      // 기믹 '사직서 쟁탈': 사직서를 밟아 3장 모으면 보스 그로기 — 방치하면 팀장이 찢고 영구 강화
      if (b.tlGroggy>0){ b.tlGroggy -= dt; b.hp -= b.maxHp*0.009*dt; }
      b.tlDocT = (b.tlDocT===undefined?5:b.tlDocT) - dt;
      if (b.tlDocT<=0){
        const a2 = Math.random()*Math.PI*2;
        addGateObj({ kind:'pick', icon:'📄', x:player.x+Math.cos(a2)*(140+Math.random()*120), y:player.y+Math.sin(a2)*(140+Math.random()*120), r:20, maxT:7,
          onPick:()=>{
            b.tlDocs = (b.tlDocs||0)+1;
            addTextNum(player.x, player.y-30, '📄 사직서 확보 ('+b.tlDocs+'/3)');
            if (b.tlDocs>=3){ b.tlDocs=0; b.tlGroggy=4; showBossBanner('그로기', '"자, 잠깐만—" 사직서 제출!', '#3f7a5c'); }
          },
          onFail:()=>{ b.dmg = Math.round(b.dmg*1.06); addTextNum(b.x, b.y-b.r-14, '"이건 내가 보관할게." (영구 강화)'); SFX.play('warn'); } });
        addTextNum(player.x, player.y-44, '📄 사직서가 떨어졌다 — 팀장보다 먼저!');
        b.tlDocT = 9 - ph;
      }
      // '업무 폭탄 돌리기': 대량 낙하
      b.tlBombT = (b.tlBombT===undefined?4:b.tlBombT) - dt;
      if (b.tlBombT<=0){
        for (let k=0;k<3+ph*2;k++) addHazard(player.x+(Math.random()-0.5)*320, player.y+(Math.random()-0.5)*320, 56, 1.2, 22*ds, false);
        addTextNum(player.x, player.y-44, '"이것 좀 부탁해~"');
        b.tlBombT = (ph===3?3.4:5) * (enrage?0.7:1);
      }
      // '회식 강요' (2페+): 강제 흡인
      if (ph>=2){
        b.tlPullT = (b.tlPullT===undefined?8:b.tlPullT) - dt;
        if (b.tlPullT<=0){
          const pa = Math.atan2(b.y-player.y, b.x-player.x);
          player.knockX += Math.cos(pa)*520; player.knockY += Math.sin(pa)*520;
          addTextNum(b.x, b.y-b.r-14, '"한 잔만 하고 가!"');
          for (let k=0;k<8;k++){ const a3=(Math.PI*2/8)*k; hostileShot(b.x, b.y, a3, 140, 6, 15*ds, 2.0); }
          SFX.play('sweep');
          b.tlPullT = 9;
        }
      }
      // '주말 출근 문자' QTE (3페): 무시(탭)하지 못하면 침묵
      if (ph>=3){
        b.tlMsgT = (b.tlMsgT===undefined?10:b.tlMsgT) - dt;
        if (b.tlMsgT<=0){
          const a2 = Math.random()*Math.PI*2;
          addGateObj({ kind:'qte', icon:'📱', x:player.x+Math.cos(a2)*140, y:player.y+Math.sin(a2)*140, r:22, maxT:3,
            onTap:()=>{ addTextNum(player.x, player.y-30, '읽씹 성공'); },
            onFail:()=>{ if (zones.length<40) zones.push({ x:player.x, y:player.y, r:120, dps:0, t:5, maxT:5, type:'silence', hostile:true, hitT:0 }); addTextNum(player.x, player.y-40, '"토요일에 잠깐만 나올래?"'); } });
          addTextNum(player.x, player.y-44, '📱 주말 출근 문자 — 탭해서 읽씹!');
          b.tlMsgT = 11;
        }
      }
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 인사평가 C', '"태도 점수라는 게 있거든."', '#b8362e');
        for (let k=0;k<32;k++){ const a2=(Math.PI*2/32)*k; hostileShot(b.x, b.y, a2, 150, 7, 62*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.3;
      }
    } else if (b.kind==='relatives'){
      // 관문 40: 명절 친척 연합 — 질문자가 12초마다 교대한다
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 본격 심문', '"앉아봐라. 얘기 좀 하자."', '#a3653f'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 연합 심문', '온 친척이 동시에 입을 연다.', '#b8362e'); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 마지막 질문', '"그래서, 결론이 뭐냐?"', '#b8362e'); shake=Math.min(24,shake+14); }
      bossMoveToward(b, player.x, player.y, b.speed*(enrage?1.5:1), dt);
      // 로테이션: 큰아버지(수렴탄) → 고모(링+침묵) → 사촌(예측탄+골드)
      b.rRot = (b.rRot===undefined?0:b.rRot);
      b.rRotT = (b.rRotT===undefined?12:b.rRotT) - dt;
      if (b.rRotT<=0){
        b.rRot = (b.rRot+1)%3;
        const names = ['큰아버지 — "취업은 했고?"','고모 — "만나는 사람은 있니?"','사촌 — "나 이번에 연봉 좀 올랐어."'];
        showBossBanner('질문자 교대', names[b.rRot], '#a3653f');
        SFX.play('warn');
        b.rRotT = 12;
      }
      b.rAtkT = (b.rAtkT===undefined?3:b.rAtkT) - dt;
      if (b.rAtkT<=0){
        const rot = b.rRot;
        if (rot===0 || (ph>=3)){
          for (let k=0;k<10;k++){
            const a2 = (Math.PI*2/10)*k;
            const sx = player.x+Math.cos(a2)*340, sy = player.y+Math.sin(a2)*340;
            hostileShot(sx, sy, Math.atan2(player.y-sy, player.x-sx), 165, 6, 17*ds, 2.6);
          }
        }
        if (rot===1 || (ph>=3)){
          for (let k=0;k<14;k++){ const a2=(Math.PI*2/14)*k; hostileShot(b.x, b.y, a2, 170, 6, 15*ds, 2.6); }
          if (zones.length<40 && Math.random()<0.5) zones.push({ x:player.x, y:player.y, r:100, dps:0, t:4, maxT:4, type:'silence', hostile:true, hitT:0 });
        }
        if (rot===2 || (ph>=3)){
          const aim = Math.atan2(player.y-b.y, player.x-b.x);
          for (let k=0;k<4;k++) hostileShot(b.x, b.y, aim+(k-1.5)*0.12, 280, 6, 18*ds, 2.2);
          const take = Math.min(runGold, 12);
          if (take>0){ runGold -= take; addTextNum(player.x, player.y-30, '-'+take+'G "용돈 좀 주라?"'); }
        }
        b.rAtkT = (ph>=3?2.6:3.4) * (enrage?0.65:1);
      }
      // '차례상 전 부치기' 아이템: 유일한 회복 찬스
      b.rFoodT = (b.rFoodT===undefined?15:b.rFoodT) - dt;
      if (b.rFoodT<=0){
        const a2 = Math.random()*Math.PI*2;
        addGateObj({ kind:'pick', icon:'🥘', x:player.x+Math.cos(a2)*180, y:player.y+Math.sin(a2)*180, r:20, maxT:6,
          onPick:()=>{ player.hp = Math.min(player.maxHp, player.hp + player.maxHp*0.12); addTextNum(player.x, player.y-30, '🥘 전 하나 집어먹음 (+12%)'); SFX.play('quest'); },
          onFail:null });
        addTextNum(player.x, player.y-44, '🥘 차례상 — 회복 찬스!');
        b.rFoodT = 18;
      }
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 단체사진', '"자, 다 같이 찍자. 도망가지 말고."', '#b8362e');
        for (let k=0;k<32;k++){ const a2=(Math.PI*2/32)*k; hostileShot(b.x, b.y, a2, 150, 7, 62*ds, 4); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.3;
      }
    } else if (b.kind==='burnout'){
      // 관문 50 (최종): 번아웃 · 또 다른 나 — 나를 흉내내는 그림자
      const ph = b.hp > b.maxHp*0.66 ? 1 : b.hp > b.maxHp*0.33 ? 2 : 3;
      if (ph !== b.jPhase){
        b.jPhase = ph;
        if (ph===2){ showBossBanner('2페이즈 — 무기력', '"...열심히 해서 뭐 하게?"', '#555058'); SFX.play('warn'); }
        if (ph===3){ showBossBanner('3페이즈 — 현타', '"이게 다 무슨 의미야."', '#b8362e'); screenDimT=Math.max(screenDimT,0.6); SFX.play('warn'); }
      }
      const enrage = b.hp < b.maxHp*0.12;
      if (enrage && !b.jEnraged){ b.jEnraged=true; showBossBanner('발악 — 전부 귀찮아', '그림자가 폭주한다.', '#b8362e'); shake=Math.min(24,shake+14); }
      if (ph===3) screenDimT = Math.max(screenDimT, 0.3);
      // 잔상 추격: 1.2초 전 내 위치로 점멸하며 따라온다 — 멈추면 죽는다
      b.boTrail = b.boTrail||[];
      b.boTrailT = (b.boTrailT||0) - dt;
      if (b.boTrailT<=0){ b.boTrail.push({x:player.x, y:player.y}); if (b.boTrail.length>4) b.boTrail.shift(); b.boTrailT = 0.4; }
      b.boBlinkT = (b.boBlinkT===undefined?2:b.boBlinkT) - dt;
      if (b.boBlinkT<=0 && b.boTrail.length>=3){
        const tp = b.boTrail[0];
        effects.push({ type:'ring', x:b.x, y:b.y, life:0.3, age:0, r0:b.r, r1:b.r+30 });
        b.x = tp.x; b.y = tp.y;
        effects.push({ type:'ring', x:b.x, y:b.y, life:0.3, age:0, r0:b.r+30, r1:b.r });
        if (Math.hypot(player.x-b.x, player.y-b.y) < b.r+player.r+10 && player.invuln<=0){
          if (playerHit(26*ds, 0.4, 8)) return true;
        }
        b.boBlinkT = (ph===3?1.6:2.4) * (enrage?0.6:1);
      } else {
        bossMoveToward(b, player.x, player.y, b.speed, dt);
      }
      // '무기력' 존 + '그림자 나' 소환 (2페+)
      if (ph>=2){
        b.boZoneT = (b.boZoneT===undefined?7:b.boZoneT) - dt;
        if (b.boZoneT<=0 && zones.length<40){
          zones.push({ x:player.x, y:player.y, r:130, dps:0, t:5, maxT:5, type:'silence', hostile:true, hitT:0 });
          addTextNum(player.x, player.y-40, '무기력이 발목을 잡는다');
          b.boZoneT = 9;
        }
        b.boCloneT = (b.boCloneT===undefined?10:b.boCloneT) - dt;
        if (b.boCloneT<=0){
          const a2 = Math.random()*Math.PI*2;
          const sh2 = makeEnemy('clone', player.x+Math.cos(a2)*280, player.y+Math.sin(a2)*280, false);
          sh2.name='그림자 나'; sh2.hp*=4; sh2.maxHp*=4; sh2.speed*=1.2; sh2.xpValue=0; sh2.grade=0; sh2.blessed=false;
          enemies.push(sh2);
          addTextNum(player.x, player.y-44, '또 다른 내가 늘어난다');
          b.boCloneT = 12;
        }
      }
      // QTE '알람 끄기' (3페): 실패 시 스킬 잠금
      if (ph>=3){
        b.boAlmT = (b.boAlmT===undefined?9:b.boAlmT) - dt;
        if (b.boAlmT<=0){
          const a2 = Math.random()*Math.PI*2;
          addGateObj({ kind:'qte', icon:'⏰', x:player.x+Math.cos(a2)*150, y:player.y+Math.sin(a2)*150, r:22, maxT:2.5,
            onTap:()=>{ addTextNum(player.x, player.y-30, '알람 정지 — 정신 차렸다'); },
            onFail:()=>{ player.skCds = player.skCds.map(cd=>Math.max(cd,6)); addTextNum(player.x, player.y-40, '5분만 더... (스킬 6초 잠금)'); SFX.play('warn'); } });
          addTextNum(player.x, player.y-44, '⏰ 알람 — 탭해서 정신 차려라!');
          b.boAlmT = 10;
        }
      }
      // '현타' (3페): 집중 수렴 탄막
      if (ph>=3){
        b.boConvT = (b.boConvT===undefined?4:b.boConvT) - dt;
        if (b.boConvT<=0){
          for (let k=0;k<12;k++){
            const a2 = (Math.PI*2/12)*k;
            const sx = player.x+Math.cos(a2)*360, sy = player.y+Math.sin(a2)*360;
            hostileShot(sx, sy, Math.atan2(player.y-sy, player.x-sx), 175, 6, 19*ds, 2.6);
          }
          b.boConvT = 4.5 * (enrage?0.6:1);
        }
      }
      if ((b.aliveT||0) > 100 && !b.jWiped){
        b.jWiped = true;
        showBossBanner('전멸기 — 이불 밖은 위험해', '"...같이 눕자."', '#b8362e');
        for (let k=0;k<36;k++){ const a2=(Math.PI*2/36)*k; hostileShot(b.x, b.y, a2, 145, 8, 68*ds, 4.5); }
        b.dmg = Math.round(b.dmg*1.6); b.speed *= 1.35;
      }
    } else if (b.kind==='berserk'){
      // 은재: 체력이 낮을수록 광폭화하는 광전사
      const rage = b.hp < b.maxHp*0.25 ? 2 : (b.hp < b.maxHp*0.5 ? 1 : 0);
      const rageSpd = 1 + rage*0.3;
      b.frenzyT -= dt;
      if (b.frenzy>0){
        b.frenzy -= dt;
        bossMoveToward(b, player.x, player.y, b.speed*2.3*rageSpd, dt);
        if (Math.random()<0.5) particles.push({ x:b.x, y:b.y, vx:0, vy:0, life:0.3, age:0, r:b.r*0.5, ghost:true });
      } else {
        bossMoveToward(b, player.x, player.y, b.speed*rageSpd, dt);
        if (b.frenzyT<=0){
          b.frenzy = 1.8;
          b.frenzyT = (rage>=2 ? 3.2 : 5.2) - empN;
          addTextNum(b.x, b.y-34, rage>=2 ? '광란!!!' : '분노!');
          SFX.play('warn');
          // 각성 은재: 광란 진입 시 검기 탄막 방출
          if (b.finale){
            for (let k=0;k<10;k++){
              const a2 = (Math.PI*2/10)*k;
              hostileShot(b.x, b.y, a2, 200, 6, 14*ds, 2.6);
            }
          }
        }
      }

    } else if (b.kind==='wind'){
      // 유진콩: 바람 — 회오리탄과 돌풍 밀쳐내기
      const want = 200;
      if (bd > want+30) bossMoveToward(b, player.x, player.y, b.speed, dt);
      else {
        const strafe = Math.atan2(by,bx)+Math.PI/2;
        b.x += Math.cos(strafe)*b.speed*0.7*dt;
        b.y += Math.sin(strafe)*b.speed*0.7*dt;
      }
      b.fireTimer -= dt;
      if (b.fireTimer<=0){
        const aim = Math.atan2(by,bx);
        hostileShot(b.x,b.y,aim,170,8,12*ds,3.4,{kind:'tornado',curve:(Math.random()<0.5?1:-1)*1.1});
        b.fireTimer = 1.9 - empN*0.4;
      }
      b.gustT -= dt;
      if (b.gustT<=0){
        addTextNum(b.x, b.y-32, '돌풍!');
        effects.push({ type:'ring', x:b.x, y:b.y, life:0.5, age:0, r0:30, r1:300 });
        const pa = Math.atan2(player.y-b.y, player.x-b.x);
        player.knockX += Math.cos(pa)*480;
        player.knockY += Math.sin(pa)*480;
        for (let k=0;k<3+empN*2;k++){
          hostileShot(b.x,b.y, pa+(k-1)*0.35, 150, 8, 10*ds, 3.4, {kind:'tornado',curve:(k%2?1:-1)*1.3});
        }
        SFX.play('sweep');
        b.gustT = 6 - empN;
      }

    } else if (b.kind==='backstab'){
      // 정우팍: 배신과 통수 — 사라졌다가 등 뒤에서 기습, 골드를 훔친다
      if (b.slashT>0){
        b.slashT -= dt;
        if (b.slashT<=0){
          if (Math.hypot(player.x-b.x, player.y-b.y) < 80+player.r){
            const dmgAmt = 18*ds*(1+b.dmgStack);
            if (player.invuln<=0){
              if (playerHit(dmgAmt, 0.7, 12)) return true;
              const steal = Math.min(15, runGold);
              if (steal>0){ runGold -= steal; b.stolen += steal; addTextNum(b.x, b.y-30, '-'+steal+'G 강탈!'); }
              b.dmgStack += 0.06;
            }
          }
          effects.push({ type:'arc', x:b.x, y:b.y, a:Math.atan2(player.y-b.y,player.x-b.x), arc:2.2, r:85, life:0.25, age:0 });
          SFX.play('sweep');
        }
      } else if (b.ghost){
        b.cycleT -= dt;
        if (b.cycleT<=0){
          b.ghost = false;
          const fa = Math.atan2(player.vy||Math.cos(player.facing), player.vx||Math.sin(player.facing));
          b.x = player.x - Math.cos(player.facing)*70;
          b.y = player.y - Math.sin(player.facing)*70;
          burst(b.x,b.y,12,140);
          addTextNum(b.x, b.y-30, '통수!');
          SFX.play('tele');
          b.slashT = 0.45;
          b.cycleT = 3.5 - empN*0.5;
        }
      } else {
        bossMoveToward(b, player.x, player.y, b.speed, dt);
        b.cycleT -= dt;
        if (b.cycleT<=0){
          b.ghost = true;
          addTextNum(b.x, b.y-30, '흐흐...');
          burst(b.x,b.y,10,120);
          b.cycleT = 0.8;
        }
      }
    }
    return updateBoss2(b, dt, def, bd, ds, empN);
  }

  // ---------- boss AI part 2 ----------
  let bossMines = [];
  function updateBoss2(b, dt, def, bd, ds, empN){
    if (b.kind==='mines'){
      // 선정팩: 플레이어 주위를 돌며 지뢰를 뿌린다
      const strafe = Math.atan2(player.y-b.y, player.x-b.x)+Math.PI/2;
      if (bd > 300) bossMoveToward(b, player.x, player.y, b.speed, dt);
      else {
        b.x += Math.cos(strafe)*b.speed*0.9*dt;
        b.y += Math.sin(strafe)*b.speed*0.9*dt;
      }
      b.mineT -= dt;
      if (b.mineT<=0){
        bossMines.push({ x:b.x, y:b.y, r:10, armT:0.8, life:14, dmg:22*ds });
        if (bossMines.length > 10+empN*4) bossMines.shift();
        SFX.play('beep');
        b.mineT = 1.6 - empN*0.4;
      }

    } else if (b.kind==='meteor'){
      // 우주별: 별 형태, 유성우 낙하
      bossMoveToward(b, player.x, player.y, b.speed, dt);
      b.meteorT -= dt;
      if (b.meteorT<=0){
        for (let k=0;k<6+empN*3;k++){
          const a = Math.random()*Math.PI*2, d = Math.random()*300;
          addHazard(player.x+Math.cos(a)*d, player.y+Math.sin(a)*d, 56, 1.1, 20*ds, false);
        }
        addTextNum(b.x, b.y-34, '유성우!');
        SFX.play('meteor');
        b.meteorT = 6.5 - empN;
      }
      b.dashT2 -= dt;
      if (b.dashT2<=0){
        const a = Math.atan2(player.y-b.y, player.x-b.x);
        b.x += Math.cos(a)*140; b.y += Math.sin(a)*140;
        burst(b.x,b.y,10,150);
        b.dashT2 = 4;
      }

    } else if (b.kind==='esper'){
      // 눅눅근EX: 에스퍼 — 정신 파동(혼란)과 염동 구체
      const want = 240;
      if (bd > want+30) bossMoveToward(b, player.x, player.y, b.speed, dt);
      else if (bd < want-40) bossMoveToward(b, player.x, player.y, -b.speed*0.7, dt);
      b.teleT -= dt;
      if (b.teleT<=0){
        burst(b.x,b.y,12,140);
        const a = Math.random()*Math.PI*2;
        b.x = player.x + Math.cos(a)*260;
        b.y = player.y + Math.sin(a)*260;
        burst(b.x,b.y,12,140);
        SFX.play('tele');
        b.teleT = 7 - empN*1.5;
      }
      b.waveT -= dt;
      if (b.waveT<=0){
        effects.push({ type:'psywave', x:b.x, y:b.y, radius:20, life:1.4, age:0, hit:false, dmg:10*ds });
        addTextNum(b.x, b.y-32, '정신 파동');
        SFX.play('tele');
        b.waveT = 5 - empN;
      }
      b.orbT -= dt;
      if (b.orbT<=0){
        const aim = Math.atan2(player.y-b.y, player.x-b.x);
        hostileShot(b.x, b.y, aim, 140, 7, 12*ds, 4, {kind:'psyorb'});
        if (b.emp) hostileShot(b.x, b.y, aim+0.5, 140, 7, 12*ds, 4, {kind:'psyorb'});
        b.orbT = 2.4;
      }

    } else if (b.kind==='centipede'){
      // 고독근: 소울풍 지네 — 머리를 따라 몸통이 이어진다
      const t = elapsed*3;
      const baseA = Math.atan2(player.y-b.y, player.x-b.x);
      const weave = Math.sin(t)*0.8;
      b.burstT -= dt;
      let sp = b.speed;
      if (b.burstT<=0 && b.burstT>-2){ sp = b.speed*2.1; }
      else if (b.burstT<=-2){ b.burstT = 6 - empN; }
      const a = baseA + weave;
      b.x += Math.cos(a)*sp*dt;
      b.y += Math.sin(a)*sp*dt;
      // trail history → segments
      b.trail.unshift({ x:b.x, y:b.y });
      if (b.trail.length > 260) b.trail.pop();
      const spacing = 5; // trail entries per segment
      for (let i=0;i<b.segs.length;i++){
        const ti = Math.min(b.trail.length-1, (i+1)*spacing);
        b.segs[i].x = b.trail[ti].x;
        b.segs[i].y = b.trail[ti].y;
      }
      // soul wisps
      if (Math.random()<dt*8){
        const s = b.segs[(Math.random()*b.segs.length)|0];
        particles.push({ x:s.x, y:s.y, vx:(Math.random()-0.5)*30, vy:-30-Math.random()*30, life:0.6, age:0, r:2.5, ghost:true });
      }
      // 고독근·심연: 영혼 유성우
      if (b.finale){
        b.meteorT -= dt;
        if (b.meteorT<=0){
          for (let k=0;k<6;k++){
            const a2 = Math.random()*Math.PI*2, d2 = Math.random()*300;
            addHazard(player.x+Math.cos(a2)*d2, player.y+Math.sin(a2)*d2, 50, 1.1, 20*ds, false);
          }
          addTextNum(b.x, b.y-30, '영혼의 비');
          SFX.play('meteor');
          b.meteorT = 8;
        }
      }
      // segment contact
      if (player.invuln<=0){
        for (const s of b.segs){
          if (Math.hypot(player.x-s.x, player.y-s.y) < 15+player.r){
            if (playerHit(b.dmg, 0.6, 10)) return true;
            break;
          }
        }
      }

    } else if (b.kind==='root'){
      if (b.chargeState==='telegraph'){
        b.telegraphTimer -= dt;
        if (b.telegraphTimer<=0){ b.chargeState='charging'; b.chargeTimer=def.chargeDuration; }
      } else if (b.chargeState==='charging'){
        b.x += b.chargeDir.x*def.chargeSpeed*dt;
        b.y += b.chargeDir.y*def.chargeSpeed*dt;
        b.chargeTimer -= dt;
        if (b.chargeTimer<=0){ b.chargeState='idle'; }
        else if (Math.hypot(player.x-b.x, player.y-b.y) < b.r+player.r && player.invuln<=0){
          if (playerHit(def.chargeDamage*ds, 0.8, 16)) return true;
        }
      } else {
        bossMoveToward(b, player.x, player.y, b.speed, dt);
        b.patTimer -= dt;
        if (b.patTimer<=0){
          const pat = b.patIdx % 4;
          b.patIdx += 1;
          b.patTimer = 2.3;
          if (pat===0){
            const n = 16;
            for (let k=0;k<n;k++){
              const a2 = (Math.PI*2/n)*k + Math.random()*0.2;
              hostileShot(b.x, b.y, a2, def.projSpeed, def.projR, def.projDmg*ds, 3.4);
            }
            burst(b.x,b.y,10,120);
          } else if (pat===1){
            const a0 = Math.atan2(player.y-b.y, player.x-b.x);
            for (let k=-1;k<=1;k++) hostileShot(b.x, b.y, a0+k*0.18, 280, 5.5, def.projDmg*ds, 2.8);
          } else if (pat===2){
            b.chargeState='telegraph';
            b.telegraphTimer=def.telegraph;
            const a2 = Math.atan2(player.y-b.y, player.x-b.x);
            b.chargeDir = { x:Math.cos(a2), y:Math.sin(a2) };
          } else {
            for (let k=0;k<6;k++){
              const a2 = (Math.PI*2/6)*k;
              enemies.push(makeEnemy('swarm', b.x+Math.cos(a2)*(b.r+24), b.y+Math.sin(a2)*(b.r+24), false));
            }
            burst(b.x,b.y,14,160);
          }
        }
      }
    }
    return false;
  }

  // ---------- particles / misc ----------
  function burst(x,y,n,spread,fxColor){
    // WebGL 글로우 파티클 (Pixi 레이어) — 일반 처치도 은은하게, 큰 폭발은 화려하게
    if (n>=8) FX.burst(x, y, fxColor||0xffffff, Math.floor(n*0.6), spread||120, n>=14?0.5:0.35);
    if (particles.length > 380) return;
    for (let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const s = (spread||120)*(0.4+Math.random()*0.8);
      particles.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.35+Math.random()*0.25, age:0, r:1.5+Math.random()*2 });
    }
  }
  function nearestTarget(){
    // 수동 마크 최우선: 클릭/탭으로 지정한 표적 (기믹 보스 '진짜 고르기' — 자동사격을 내가 조종한다)
    const mk = player.markTarget;
    if (mk){
      const alive = (mk.isBoss ? bosses.includes(mk) && !mk.ghost : enemies.includes(mk));
      if (alive && Math.hypot(mk.x-player.x, mk.y-player.y) < 560) return mk;
      if (!alive) player.markTarget = null;
    }
    // 조준 우선순위: 사거리 내 보스 > 엘리트·악몽 > 최근접 (자동 사격이 잡몹에 낭비되지 않게)
    for (const b of bosses){ if (!b.ghost && Math.hypot(b.x-player.x,b.y-player.y) < 420) return b; }
    let prio=null, pd=Infinity;
    for (const e of enemies){
      if (e.elite || e.grade===2){
        const d=(e.x-player.x)**2+(e.y-player.y)**2;
        if (d < 360*360 && d<pd){ pd=d; prio=e; }
      }
    }
    if (prio) return prio;
    let nearest=null, nd=Infinity;
    for (const e of enemies){ const d=(e.x-player.x)**2+(e.y-player.y)**2; if (d<nd){ nd=d; nearest=e; } }
    for (const b of bosses){ if (b.ghost) continue; const d=(b.x-player.x)**2+(b.y-player.y)**2; if (d<nd){ nd=d; nearest=b; } }
    return nearest;
  }

  // ---------- 액티브 스킬 (1~4) ----------
  // 스킬 시전 — 슬롯 1: 전용기 / 슬롯 2~4: 직업 스킬 (레벨 습득)
  function castSkill(n){
    if (state!=='playing') return;
    if (n===1){ player.ultFireReq = true; return; }
    if (player.skillsSealed || (player.zoneSilenceT||0)>0){ addTextNum(player.x, player.y-24, '침묵...'); return; } // 침묵의 서약 / 어색한 침묵 존
    const i = n-2;
    const sk = player.skills[i];
    if (!sk || player.skCds[i] > 0) return;
    // 스킬 시전 이펙트: 주력 속성 > 직업색 링
    if (FX.enabled){
      const sc = dominantElemColor() || CLASS_COLORS[player.classKey];
      if (sc) FX.ring(player.x, player.y, parseInt(sc.slice(1),16), 10);
    }
    sk.fx();
    player.skCds[i] = sk.cd * 1.35 * player.cdr; // 전역 쿨타임 +35% — 스킬은 강하되 아껴 써야 한다
    if (player.echoCast && Math.random() < (0.3 + (player.echoBoost?0.1:0))){ player.skCds[i] *= 0.1; addTextNum(player.x, player.y-46, '메아리!'); }
    addTextNum(player.x, player.y-34, sk.n);
  }
  document.querySelectorAll('.skillChip').forEach(b=>{
    b.addEventListener('pointerdown', (e)=>{
      e.stopPropagation(); e.preventDefault(); SFX.unlock();
      const n = parseInt(b.dataset.sk,10);
      // 빈 슬롯 탭 → 스킬북 (모바일에서 K키 대체)
      if (n>=2 && state==='playing' && !player.skills[n-2]){ openSkillBook(); return; }
      castSkill(n);
    });
  });

  // ---------- dash (기동 테크 연동) ----------
  function tryDash(){
    if (player.dashCd > 0 || player.dashTime > 0) return;
    let dx=0, dy=0;
    if (keys.has('up')) dy-=1;
    if (keys.has('down')) dy+=1;
    if (keys.has('left')) dx-=1;
    if (keys.has('right')) dx+=1;
    if (touchOrigin){ dx += touchVec.x; dy += touchVec.y; }
    const len = Math.hypot(dx,dy);
    if (len>0){ dx/=len; dy/=len; }
    else { dx = Math.cos(player.facing); dy = Math.sin(player.facing); }
    player.dashDir = {x:dx, y:dy};
    player.dashCd = player.dashCdMax;
    player.invuln = Math.max(player.invuln, player.dashInvuln);
    // Pixi 4단계: 대시 잔상 (직업색 글로우)
    if (FX.enabled){
      const cc = CLASS_COLORS[player.classKey];
      FX.burst(player.x, player.y, cc ? parseInt(cc.slice(1),16) : 0xffffff, 6, 70, 0.32);
    }
    if (player.overdrive) player.dashHasteT = 1.5;
    if (player.chargeBoost) player.shockSureT = 2; // 축전: 대시 후 감전 확정
    if (player.bloodRush) dashExplosion(player.x, player.y, 25); // 변혁: 피의 질주
    if (player.shadowClone){ // 변혁: 그림자 분신
      player.shadows.push({ x:player.x, y:player.y, t:3, cd:0.25 });
      if (player.shadows.length>3) player.shadows.shift();
    }
    dashCount += 1;
    if (dashCount >= 50) unlockAch('dash50');

    if (player.dashBlast>0){
      dashExplosion(player.x, player.y, player.dashBlast);
    }
    if (player.blink>0){
      // 점멸: 순간이동 + 도착 폭발
      burst(player.x, player.y, 14, 180);
      player.x += dx*190;
      player.y += dy*190;
      dashExplosion(player.x, player.y, player.blink);
      effects.push({ type:'ring', x:player.x, y:player.y, life:0.35, age:0, r0:14, r1:130 });
      SFX.play('tele');
    } else {
      player.dashTime = 0.18;
      SFX.play('dash');
    }
  }
  function dashExplosion(x, y, dmg){
    const d = dmg*player.dmgMult;
    effects.push({ type:'ring', x, y, life:0.3, age:0, r0:10, r1:100 });
    for (let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      if (Math.hypot(e.x-x, e.y-y) < 100+e.r){
        e.hp -= d;
        addDmgNum(e.x,e.y,d,false);
        if (e.hp<=0) defeatEnemy(i);
      }
    }
    for (let i=bosses.length-1;i>=0;i--){
      const b = bosses[i];
      if (!b.ghost && Math.hypot(b.x-x, b.y-y) < 100+b.r){
        b.hp -= d;
        addDmgNum(b.x,b.y,d,false);
        if (b.hp<=0) defeatBoss(i); else refreshBossBar();
      }
    }
  }

  // ---------- lightning ----------
  function lightningStrike(dmg, chain){
    if (enemies.length===0 && bosses.length===0) return false;
    let target = null, isBoss = false;
    if (enemies.length && (bosses.length===0 || Math.random()<0.8)){
      target = enemies[(Math.random()*enemies.length)|0];
    } else if (bosses.length){
      target = bosses[(Math.random()*bosses.length)|0];
      if (target.ghost) return false;
      isBoss = true;
    }
    if (!target) return false;
    effects.push({ type:'bolt', x:target.x, y:target.y, life:0.22, age:0 });
    const isCrit = Math.random()<player.critChance;
    const d = dmg * (isCrit?player.critMult:1);
    addDmgNum(target.x, target.y, d, isCrit);
    burst(target.x, target.y, 6, 140);
    SFX.play('hit');
    if (chain){
      let cn=null, cd2=130*130;
      for (const e of enemies){
        if (e===target) continue;
        const dd = (e.x-target.x)**2 + (e.y-target.y)**2;
        if (dd < cd2){ cd2=dd; cn=e; }
      }
      if (cn){
        effects.push({ type:'chain', x1:target.x, y1:target.y, x2:cn.x, y2:cn.y, life:0.18, age:0 });
        const cdmg = d*0.6;
        addDmgNum(cn.x, cn.y, cdmg, false);
        cn.hp -= cdmg;
        if (cn.hp<=0){ const ci=enemies.indexOf(cn); if (ci>=0) defeatEnemy(ci); }
      }
    }
    target.hp -= d;
    if (target.hp<=0){
      if (isBoss){ const bi=bosses.indexOf(target); if (bi>=0) defeatBoss(bi); }
      else { const ei=enemies.indexOf(target); if (ei>=0) defeatEnemy(ei); }
    } else if (isBoss) refreshBossBar();
    return true;
  }

  // ---------- weapons update ----------
  let satPos = [];
  let auraState = { on:false, r:0 };
  let dronePos = [];

  function fireProjectile(a, speed, dmg, pierce, life, extra){
    // 발사 모션: 사격형 = 반동(뒤로 킥), 투척형 = 런지(앞으로 쏠림), 저격수는 3배 묵직
    const rs = (player.recoilScale||1) * (player.lungeThrow ? -0.9 : 1);
    player.recoilX = (player.recoilX||0) - Math.cos(a)*2.6*rs;
    player.recoilY = (player.recoilY||0) - Math.sin(a)*2.6*rs;
    if (player.recoilScale>=3){ shake = Math.min(10, shake+1.4); } // 저격: 화면도 살짝 울림
    if (Math.random()<0.5) effects.push({ type:'muzzle', x:player.x+Math.cos(a)*14, y:player.y+Math.sin(a)*14, life:0.12, age:0 });
    const isCrit = Math.random()<player.critChance || (player.shadowStrike && noHitT>3); // 그림자: 무피격 3초+ 확정 치명
    let d = dmg * player.projMult * (isCrit?player.critMult:1);
    if (player.goldPower) d *= 1 + Math.min(0.3, runGold*0.0003); // 변혁: 황금 혈맥
    if (player.feverDmg && feverTimer>0) d *= 1.15; // 선율가: 피버 강화
    d *= buffMult('dmg'); // 스킬 버프
    if (player.gambleDmg) d *= (player.gambleFloor?0.8:0.5) + Math.random()*(player.gambleCeil?2.2:2); // 도박사: 피해가 매번 주사위
    if (player.stonks) d *= 1.1 + 0.4*Math.sin(elapsed/8); // 주식쟁이: 시장 사이클 (±40%)
    const p = {
      x:player.x, y:player.y,
      vx:Math.cos(a)*speed, vy:Math.sin(a)*speed,
      r:4, damage: d, crit:isCrit,
      pierce: pierce, life: life
    };
    if (extra) Object.assign(p, extra);
    projectiles.push(p);
  }

  // ---------- 원소 상태이상 ----------
  // 발화(도트) · 냉기(감속 중첩) · 감전(연쇄) · 부식(받는 피해 증가)
  // 시너지: 냉기/빙결 상태에 화상 부여 → [융해] 추가 피해 / 부식 상태에 감전 → 1.5배
  function corrodeMult(t){
    let m = 1 + player.corrodeAmp * (t.corrodeS||0);
    if ((t.frozenT>0 || t.chillS>0) && player.frozenAmp>1) m *= player.frozenAmp; // 혹한
    // 등급 상대 피해: 보스 / 엘리트·악몽급
    if (t.isBoss) m *= player.bossDmg||1;
    else if (t.elite || t.grade===2) m *= player.eliteDmg||1;
    if (player.gymbro) m *= 1 + player.maxHp*0.00025; // 헬창: 근육이 곧 화력
    return m;
  }
  function procElement(t, elem, isBoss){
    const D = player.dmgMult;
    if (elem==='fire'){
      if ((t.chillS>0 || t.frozenT>0)){
        const melt = 18*D;
        t.hp -= melt;
        addDmgNum(t.x, t.y-8, melt, true);
        addTextNum(t.x, t.y-22, '융해!');
        unlockAch('melt');
      }
      t.burnT = 3;
      t.burnDps = Math.max(t.burnDps||0, (player.burnDps||6) * D * (isBoss?0.5:1));
    } else if (elem==='frost'){
      if (isBoss) return;
      t.chillS = Math.min(3, (t.chillS||0)+1);
      t.chillT = 2.5;
    } else if (elem==='volt'){
      let d = (player.shockDmg||10) * D;
      if (t.corrodeS>0) d *= 1.5;
      t.hp -= d;
      addDmgNum(t.x, t.y-6, d, false);
      let cn=null, cd2=120*120;
      for (const e of enemies){
        if (e===t) continue;
        const dd = (e.x-t.x)**2 + (e.y-t.y)**2;
        if (dd < cd2){ cd2=dd; cn=e; }
      }
      if (cn){
        effects.push({ type:'chain', x1:t.x, y1:t.y, x2:cn.x, y2:cn.y, life:0.15, age:0 });
        cn.hp -= d*0.6;
        // 과전압: 한 번 더 연쇄
        if (player.chainPlus>0 && cn.hp>0){
          let cn2=null, cd3=120*120;
          for (const e2 of enemies){
            if (e2===t || e2===cn) continue;
            const dd2 = (e2.x-cn.x)**2 + (e2.y-cn.y)**2;
            if (dd2 < cd3){ cd3=dd2; cn2=e2; }
          }
          if (cn2){
            effects.push({ type:'chain', x1:cn.x, y1:cn.y, x2:cn2.x, y2:cn2.y, life:0.15, age:0 });
            cn2.hp -= d*0.36;
            if (cn2.hp<=0){ const c2i=enemies.indexOf(cn2); if (c2i>=0) defeatEnemy(c2i); }
          }
        }
        if (cn.hp<=0){ const ci=enemies.indexOf(cn); if (ci>=0) defeatEnemy(ci); }
      }
    } else if (elem==='acid'){
      t.corrodeS = Math.min(player.corrodeMaxS, (t.corrodeS||0)+1);
      t.corrodeT = 5;
    } else if (elem==='boom'){
      const d = 15*D;
      effects.push({ type:'ring', x:t.x, y:t.y, life:0.22, age:0, r0:8, r1:50 });
      for (const e of enemies){
        if (e===t) continue;
        if (Math.hypot(e.x-t.x,e.y-t.y) < 50+e.r){
          e.hp -= d;
          addDmgNum(e.x,e.y,d,false);
        }
      }
      t.hp -= d*(isBoss?0.5:1);
    }
  }
  function procOnHit(t, isBoss, imbue){
    const pb = player.procBonus||0; // 성좌 '원소 조화' 등
    // 각인된 무기: 해당 속성 50% 확정 발동
    if (imbue && Math.random()<0.5+pb) procElement(t, imbue, isBoss);
    if (player.burnChance>0 && Math.random()<player.burnChance+pb) procElement(t, 'fire', isBoss);
    if (player.chillOn && !isBoss) procElement(t, 'frost', isBoss);
    const shockCh = player.shockSureT>0 ? 1 : player.shockChance;
    if (player.shockDmg>0 && shockCh>0 && Math.random()<shockCh+pb) procElement(t, 'volt', isBoss);
    if (player.corrodeChance>0 && Math.random()<player.corrodeChance+pb) procElement(t, 'acid', isBoss);
    // 신성: 성광 강타 — 즉발 추가 피해 (신성한 금빛 섬광)
    if (player.smiteChance>0 && Math.random()<player.smiteChance+pb){
      const d = player.smiteDmg*player.dmgMult*(isBoss?0.6:1)*(player.holyAmp||1);
      t.hp -= d;
      addDmgNum(t.x, t.y-6, d, true);
      FX.puff(t.x, t.y, 0xe0c04f, 10);
      if (player.holyHealOnSmite && Math.random()<0.3) player.hp = Math.min(player.maxHp, player.hp+1*player.healMult);
    }
    // 시간: 시간 절단 — 짧은 정지
    if (player.stutterChance>0 && !isBoss && Math.random()<player.stutterChance+pb){
      t.frozenT = Math.max(t.frozenT||0, player.stutterDur||0.5);
      FX.puff(t.x, t.y, 0x9adbe8, 8);
    }
    // 혈마: 흡혈 낙인
    if (player.bloodLeechChance>0 && Math.random()<player.bloodLeechChance+pb){
      healCapped((player.bloodMult||1)*player.healMult);
    }
    // 변혁: 마탄 흡혈 — 투사체 명중 시 확률 회복
    if (player.projLeech && Math.random()<0.05){
      healCapped(1*(player.projLeechMult||1)*player.healMult);
    }
  }
  // 흡혈류 회복 감쇠: 초당 최대체력 4%까지만 — 물량전에서 무한 회복으로 불사가 되는 것 방지
  function healCapped(amount){
    const cap = player.maxHp * 0.04;
    if (player.__lsWin === undefined){ player.__lsWin = 0; player.__lsWinT = 0; }
    const room = Math.max(0, cap - player.__lsWin);
    const h = Math.min(amount, room);
    if (h > 0){
      player.hp = Math.min(player.maxHp, player.hp + h);
      player.__lsWin += h;
    }
  }
  function tickStatus(t, dt, isBoss){
    // returns true if killed by status (caller handles removal)
    if (t.burnT>0){
      t.burnT -= dt;
      t.hp -= t.burnDps*dt;
      if (Math.random()<dt*4) particles.push({ x:t.x+(Math.random()*10-5), y:t.y-6, vx:(Math.random()-0.5)*20, vy:-40, life:0.35, age:0, r:2 });
      if (Math.random()<dt*1.2) addDmgNum(t.x, t.y, t.burnDps, false);
    }
    if (t.corrodeT>0){
      t.corrodeT -= dt;
      if (t.corrodeT<=0) t.corrodeS = 0;
      else if (player.dissolveDps>0 && t.corrodeS>0){
        t.hp -= player.dissolveDps*player.dmgMult*(isBoss?0.5:1)*dt;
      }
    }
    if (t.chillT>0){
      t.chillT -= dt;
      if (t.chillT<=0) t.chillS = 0;
    }
    return t.hp<=0;
  }

  function updateWeapons(dt){
    satPos = [];
    auraState.on = false;
    dronePos = [];
    // 혈마 광혈: 잃은 체력 10%당 공격속도 가산
    const frenzyMult = player.bloodFrenzy>0 ? 1 + player.bloodFrenzy * Math.floor((1 - player.hp/player.maxHp)*10) : 1;
    const rate = player.rateMult * feverRate() * (player.dashHasteT>0 ? 1.35 : 1) * (player.odT>0 ? 1+player.odPower : 1) * (player.rageT>0 ? 1.3 : 1) * buffMult('rate') * frenzyMult;

    // 융합 무기는 두 파츠를 각각 85% 성능으로 발동
    const wlist = [];
    for (const w of player.weapons){
      if (w.key==='fusion'){
        for (const part of w.parts){ part.__rate = 0.85; wlist.push(part); }
      } else {
        w.__rate = 1;
        wlist.push(w);
      }
    }

    for (const w of wlist){
      const def = WEAPONS[w.key];

      if (w.key==='satellite'){
        const n = def.count(w);
        const orbitR = def.orbitR(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1) * (player.satBoost||1);
        w.angle += dt * def.spin(w);
        for (let s=0;s<n;s++){
          const a = w.angle + (Math.PI*2/n)*s;
          satPos.push({ x:player.x+Math.cos(a)*orbitR, y:player.y+Math.sin(a)*orbitR, ev:w.evolved, orbitR, dmg, ringDps:dmg*1.2, imbue:w.imbue });
        }
        continue;
      }
      if (w.key==='aura'){
        auraState.on = true;
        auraState.r = def.radius(w);
        auraState.dps = def.dps(w) * player.dmgMult * (player.auraBoost||1);
        auraState.slow = def.slow(w);
        auraState.ev = w.evolved;
        continue;
      }
      if (w.key==='drone'){
        // 드론 위치 갱신 (부드럽게 따라다님)
        const n = def.count(w);
        while (w.drones.length < n) w.drones.push({ x:player.x, y:player.y });
        while (w.drones.length > n) w.drones.pop();
        for (let i=0;i<w.drones.length;i++){
          const a = (Math.PI*2/n)*i + elapsed*0.8;
          const tx = player.x + Math.cos(a)*54, ty = player.y + Math.sin(a)*54 - 16;
          const dr = w.drones[i];
          dr.x += (tx-dr.x)*Math.min(1,dt*6);
          dr.y += (ty-dr.y)*Math.min(1,dt*6);
          dronePos.push(dr);
        }
        w.cd -= dt;
        if (w.cd <= 0){
          w.cd = def.baseCd(w) * player.cdr / (rate * (w.__rate||1));
          const t = nearestTarget();
          if (t && Math.hypot(t.x-player.x,t.y-player.y) < 420){
            const dmg = def.dmg(w) * player.dmgMult * player.droneBoost * (w.imbueDmg||1);
            for (const dr of w.drones){
              const a = Math.atan2(t.y-dr.y, t.x-dr.x);
              const isCrit = Math.random()<player.critChance;
              projectiles.push({
                x:dr.x, y:dr.y,
                vx:Math.cos(a)*500, vy:Math.sin(a)*500,
                r:3, damage:dmg*(isCrit?player.critMult:1), crit:isCrit,
                pierce:0, life:0.9, tracer:true, imbue:w.imbue
              });
            }
            SFX.play('shoot');
          } else { w.cd = 0.15; }
        }
        continue;
      }

      w.cd -= dt;
      if (w.cd > 0) continue;
      w.cd = def.baseCd(w) * player.cdr / (rate * (w.__rate||1));

      if (w.key==='missile'){
        const t = nearestTarget();
        if (!t){ w.cd = 0.12; continue; }
        const baseA = Math.atan2(t.y-player.y, t.x-player.x);
        const n = def.count(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1);
        for (let i=0;i<n;i++){
          const a = baseA + (i - (n-1)/2) * 0.14;
          fireProjectile(a, 430, dmg, player.pierce, 1.3, w.evolved ? { homing:true, r:5, imbue:w.imbue } : { imbue:w.imbue });
        }
        effects.push({ type:'muzzle', x:player.x+Math.cos(baseA)*16, y:player.y+Math.sin(baseA)*16, life:0.1, age:0 });
        SFX.play('shoot');

      } else if (w.key==='arrow'){
        const t = nearestTarget();
        const baseA = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.facing;
        const n = def.count(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1);
        const pierce = 1 + player.pierce + (w.evolved?2:0);
        for (let i=0;i<n;i++){
          const a = baseA + (i - (n-1)/2) * 0.16;
          fireProjectile(a, 480, dmg, pierce, 1.1, { r:3.5, arrow:true, imbue:w.imbue });
        }
        if (w.evolved){
          for (let i=0;i<3;i++){
            fireProjectile(baseA + Math.PI + (i-1)*0.22, 480, dmg, pierce, 1.1, { r:3.5, arrow:true, imbue:w.imbue });
          }
        }
        SFX.play('shoot');

      } else if (w.key==='lightning'){
        const n = def.count(w);
        const dmg = def.dmg(w) * player.dmgMult * (player.boltBoost||1);
        let any = false;
        for (let i=0;i<n;i++){ if (lightningStrike(dmg, w.evolved)) any = true; }
        if (!any) w.cd = 0.2;

      } else if (w.key==='gbow'){
        // 침묵하는 활: 관통 장궁
        const t = nearestTarget();
        if (!t){ w.cd = 0.15; continue; }
        const baseA = Math.atan2(t.y-player.y, t.x-player.x);
        const n = def.count(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1);
        for (let i=0;i<n;i++){
          const a = baseA + (i - (n-1)/2) * 0.2;
          projectiles.push({
            x:player.x, y:player.y, vx:Math.cos(a)*620, vy:Math.sin(a)*620,
            r:5, damage:dmg, crit:Math.random()<player.critChance, pierce:6+Math.floor((DB.gweps.bow.lv||1)/8),
            life:1.2, arrow:true, gwep:'bow', imbue:w.imbue
          });
        }
        SFX.play('shoot');

      } else if (w.key==='gtome'){
        // 굶주린 마도서: 유도 마탄
        const t = nearestTarget();
        if (!t){ w.cd = 0.15; continue; }
        const n = def.count(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1);
        for (let i=0;i<n;i++){
          const a = Math.random()*Math.PI*2;
          projectiles.push({
            x:player.x, y:player.y, vx:Math.cos(a)*260, vy:Math.sin(a)*260,
            r:3.5, damage:dmg, crit:false, pierce:0, life:1.8,
            homing:true, tracer:true, gwep:'tome', imbue:w.imbue
          });
        }
        SFX.play('shoot');

      } else if (w.key==='gblade'){
        // 핏빛 대검: 대형 참격
        const t = nearestTarget();
        const baseA = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.facing;
        const n = def.count(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1);
        for (let i=0;i<n;i++){
          const a = baseA + (i - (n-1)/2) * 0.5;
          projectiles.push({
            x:player.x, y:player.y, vx:Math.cos(a)*280, vy:Math.sin(a)*280,
            r: w.evolved?18:15, damage:dmg, crit:false, pierce:6, life:0.75,
            kind:'wave', gwep:'blade', imbue:w.imbue
          });
        }
        SFX.play('sweep');

      } else if (w.key==='nameless'){
        // 무명검: 성장하는 검기 파동
        const t = nearestTarget();
        const baseA = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.facing;
        const n = def.count(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1);
        for (let i=0;i<n;i++){
          const a = baseA + (i - (n-1)/2) * 0.4;
          projectiles.push({
            x:player.x, y:player.y,
            vx:Math.cos(a)*300, vy:Math.sin(a)*300,
            r: w.evolved?14:10, damage:dmg, crit:false,
            pierce: 3 + Math.floor((DB.growth.lv||1)/10), life:0.7,
            kind:'wave'
          });
        }
        SFX.play('sweep');

      } else if (w.key==='shuriken'){
        const t = nearestTarget();
        const baseA = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.facing;
        const n = def.count(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1);
        for (let i=0;i<n;i++){
          const a = baseA + (i - (n-1)/2) * 0.5;
          projectiles.push({
            x:player.x, y:player.y,
            vx:Math.cos(a)*400, vy:Math.sin(a)*400,
            r:def.size(w), damage:dmg, crit:false,
            pierce:9999, life:6, imbue:w.imbue,
            kind:'shuriken', phase:'out', spin:0, hitSet:new Set()
          });
        }
        SFX.play('shoot');

      } else if (w.key==='scythe'){
        // 낫: 부채꼴 스윕 (진화 시 360도)
        const t = nearestTarget();
        const baseA = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.facing;
        const radius = def.radius(w);
        const arc = def.arc(w);
        const dmg = def.dmg(w) * player.dmgMult * (w.imbueDmg||1) * (player.scytheBoost||1);
        const scytheImbue = w.imbue;
        effects.push({ type:'arc', x:player.x, y:player.y, a:baseA, arc, r:radius, life:0.28, age:0, friendly:true });
        const hitInArc = (tx, ty, tr)=>{
          const d = Math.hypot(tx-player.x, ty-player.y);
          if (d > radius+tr) return false;
          if (arc >= Math.PI*2) return true;
          let da = Math.atan2(ty-player.y, tx-player.x) - baseA;
          while (da>Math.PI) da-=Math.PI*2;
          while (da<-Math.PI) da+=Math.PI*2;
          return Math.abs(da) < arc/2;
        };
        for (let i=enemies.length-1;i>=0;i--){
          const e = enemies[i];
          if (hitInArc(e.x,e.y,e.r)){
            const isCrit = Math.random()<player.critChance;
            const d = dmg*(isCrit?player.critMult:1)*corrodeMult(e);
            e.hp -= d;
            addDmgNum(e.x,e.y,d,isCrit);
            procOnHit(e, false, scytheImbue);
            // 사신 처형
            if (player.execThresh>0 && !e.elite && e.hp>0 && e.hp < e.maxHp*player.execThresh){
              e.hp = 0; addTextNum(e.x, e.y-10, '처형!');
            }
            if (e.hp<=0) defeatEnemy(i);
          }
        }
        for (let i=bosses.length-1;i>=0;i--){
          const b = bosses[i];
          if (!b.ghost && hitInArc(b.x,b.y,b.r)){
            const d = dmg*corrodeMult(b);
            b.hp -= d;
            addDmgNum(b.x,b.y,d,false);
            procOnHit(b, true, scytheImbue);
            if (b.hp<=0) defeatBoss(i); else refreshBossBar();
          }
        }
        SFX.play('sweep');
      }
    }
  }

  // ---------- AoE helper (친구 아군 피해) ----------
  function friendlyBlast(x, y, radius, dmg, showRing){
    if (showRing) effects.push({ type:'ring', x, y, life:0.35, age:0, r0:radius*0.2, r1:radius });
    for (let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      if (Math.hypot(e.x-x, e.y-y) < radius+e.r){
        e.hp -= dmg;
        addDmgNum(e.x,e.y,dmg,false);
        if (e.hp<=0) defeatEnemy(i);
      }
    }
    for (let i=bosses.length-1;i>=0;i--){
      const b = bosses[i];
      if (!b.ghost && Math.hypot(b.x-x, b.y-y) < radius+b.r){
        b.hp -= dmg;
        addDmgNum(b.x,b.y,dmg,false);
        if (b.hp<=0) defeatBoss(i); else refreshBossBar();
      }
    }
  }

  // ---------- psionic pulse ----------
  function firePulse(){
    const pull = player.pulsePull; // 중력 붕괴: 밀치는 대신 끌어당김
    const dmg = player.pulseDmg * player.dmgMult * (pull?1.3:1);
    const radius = pull ? 170 : 130;
    effects.push({ type:'ring', x:player.x, y:player.y, life:0.4, age:0, r0: pull?radius:20, r1: pull?20:radius+40 });
    for (let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      const d = Math.hypot(e.x-player.x, e.y-player.y);
      if (d < radius+e.r){
        e.hp -= dmg;
        addDmgNum(e.x,e.y,dmg,false);
        const a = Math.atan2(e.y-player.y, e.x-player.x);
        const push = pull ? -Math.min(90, d-30) : 70;
        e.x += Math.cos(a)*push; e.y += Math.sin(a)*push;
        if (e.hp<=0) defeatEnemy(i);
      }
    }
    for (let i=bosses.length-1;i>=0;i--){
      const b = bosses[i];
      if (!b.ghost && Math.hypot(b.x-player.x, b.y-player.y) < radius+b.r){
        b.hp -= dmg*0.7;
        addDmgNum(b.x,b.y,dmg*0.7,false);
        if (b.hp<=0) defeatBoss(i); else refreshBossBar();
      }
    }
    SFX.play('tele');
  }

  // ---------- tech periodic abilities (원소 속성) ----------
  let zones = [], fmines = [];
  function updateTechAbilities(dt){
    const D = player.dmgMult;
    if (player.shockSureT>0) player.shockSureT -= dt;
    if (player.odT>0) player.odT -= dt;

    // 변혁: 검기 방출 — 근접 무기(역장·낫)가 원거리 검기를 쏜다
    if (player.bladeWave && (ownedWeapon('aura') || ownedWeapon('scythe'))){
      player.bwT = (player.bwT|| (player.bladeWaveFast?2:4)) - dt;
      if (player.bwT<=0){
        const t6 = nearestTarget();
        const a6 = t6 ? Math.atan2(t6.y-player.y, t6.x-player.x) : player.facing;
        for (let k=-1;k<=1;k++) fireProjectile(a6+k*0.25, 430, 16*D, 2, 0.9);
        SFX.play('shoot');
        player.bwT = (player.bladeWaveFast?2:4) * player.cdr;
      }
    }
    // ---- 속성 대확장: 신규 액티브 7종 ----
    // 지옥불: 유성우
    if (player.meteorLv>0){
      player.meteorT = (player.meteorT||9) - dt;
      if (player.meteorT<=0){
        for (let k=0;k<3 && enemies.length;k++){
          const e2 = enemies[(Math.random()*enemies.length)|0];
          const d2 = player.meteorDmg*D;
          e2.hp -= d2; e2.burnT = 2.5; e2.burnDps = Math.max(e2.burnDps||0, (player.burnDps||6)*D);
          addDmgNum(e2.x, e2.y, d2, true);
          burst(e2.x, e2.y, 10, 180, 0xe2603f);
          FX.puff(e2.x, e2.y, 0xe2603f, 18);
          if (e2.hp<=0){ const idx=enemies.indexOf(e2); if (idx>=0) defeatEnemy(idx); }
        }
        SFX.play('boom');
        player.meteorT = 9 * player.cdr;
      }
    }
    // 서리: 눈보라
    if (player.blizzLv>0){
      player.blizzT = (player.blizzT||9) - dt;
      if (player.blizzT<=0){
        if (zones.length<40) zones.push({ x:player.x, y:player.y, r:105, dps:player.blizzDps*D, t:4, maxT:4, type:'frost' });
        SFX.play('tele');
        player.blizzT = 9 * player.cdr;
      }
    }
    // 번개: 천둥 창
    if (player.spearLv>0){
      player.spearT = (player.spearT||6) - dt;
      if (player.spearT<=0){
        const t4 = nearestTarget();
        const a4 = t4 ? Math.atan2(t4.y-player.y, t4.x-player.x) : player.facing;
        fireProjectile(a4, 560, player.spearDmg*D, 6, 1.3, { imbue:'volt' });
        FX.puff(player.x+Math.cos(a4)*18, player.y+Math.sin(a4)*18, 0xe0b73d, 12);
        player.spearT = 6 * player.cdr;
      }
    }
    // 부식: 산성 파도
    if (player.awaveLv>0){
      player.awaveT = (player.awaveT||8) - dt;
      if (player.awaveT<=0){
        for (let i2=enemies.length-1;i2>=0;i2--){
          const e2 = enemies[i2];
          if (Math.hypot(e2.x-player.x, e2.y-player.y) < 140+e2.r){
            const d2 = player.awaveDmg*D*corrodeMult(e2);
            e2.hp -= d2; addDmgNum(e2.x, e2.y, d2, false);
            e2.corrodeS = Math.min(player.corrodeMaxS, (e2.corrodeS||0)+1); e2.corrodeT = 5;
            if (e2.hp<=0) defeatEnemy(i2);
          }
        }
        effects.push({ type:'ring', x:player.x, y:player.y, life:0.4, age:0, r0:20, r1:140 });
        FX.ring(player.x, player.y, 0x6faa4e, 12);
        SFX.play('tele');
        player.awaveT = 8 * player.cdr;
      }
    }
    // 폭발: 클러스터 폭격
    if (player.clusterLv>0){
      player.clusterT = (player.clusterT||10) - dt;
      if (player.clusterT<=0){
        const t5 = nearestTarget();
        if (t5){
          friendlyBlast(t5.x, t5.y, 70, player.clusterDmg*D, true);
          for (let k=0;k<3;k++){
            const a5 = Math.random()*Math.PI*2, d5 = 40+Math.random()*50;
            friendlyBlast(t5.x+Math.cos(a5)*d5, t5.y+Math.sin(a5)*d5, 45, player.clusterDmg*0.6*D, true);
          }
          shake = Math.min(14, shake+6);
          SFX.play('boom');
        }
        player.clusterT = 10 * player.cdr;
      }
    }
    // 기계: EMP 방출
    if (player.empLv>0){
      player.empT = (player.empT||9) - dt;
      if (player.empT<=0){
        for (let i2=enemies.length-1;i2>=0;i2--){
          const e2 = enemies[i2];
          if (Math.hypot(e2.x-player.x, e2.y-player.y) < 150+e2.r){
            e2.hp -= player.empDmg*D;
            e2.frozenT = Math.max(e2.frozenT||0, 0.4);
            addDmgNum(e2.x, e2.y, player.empDmg*D, false);
            if (e2.hp<=0) defeatEnemy(i2);
          }
        }
        effects.push({ type:'ring', x:player.x, y:player.y, life:0.35, age:0, r0:16, r1:150 });
        FX.ring(player.x, player.y, 0x7a8a99, 14);
        SFX.play('tele');
        player.empT = 9 * player.cdr;
      }
    }
    // 염동: 결계 (적탄 소거)
    if (player.wardLv>0){
      player.wardT = (player.wardT||7) - dt;
      if (player.wardT<=0){
        let cleared = 0;
        for (let i2=hostileShots.length-1;i2>=0;i2--){
          const s2 = hostileShots[i2];
          if (Math.hypot(s2.x-player.x, s2.y-player.y) < 150){ hostileShots.splice(i2,1); cleared++; }
        }
        if (cleared>0){
          addTextNum(player.x, player.y-26, '결계 ('+cleared+')');
          FX.ring(player.x, player.y, 0x9a6fc4, 10);
          SFX.play('tele');
        }
        player.wardT = 7 * player.cdr;
      }
    }
    // ---- 신성 ----
    if (player.haloLv>0){
      player.haloT = (player.haloT||6) - dt;
      if (player.haloT<=0){
        friendlyBlast(player.x, player.y, 95, player.haloDmg*D*(player.holyAmp||1), true);
        player.hp = Math.min(player.maxHp, player.hp + 2*player.healMult);
        FX.ring(player.x, player.y, 0xe0c04f, 12);
        player.haloT = 6 * player.cdr;
      }
    }
    if (player.judgment>0){
      player.judgeT = (player.judgeT||12) - dt;
      if (player.judgeT<=0){
        let struck = 0;
        for (let k=0;k<5 && enemies.length;k++){
          const e2 = enemies[(Math.random()*enemies.length)|0];
          const d2 = player.judgment*D*(player.holyAmp||1);
          e2.hp -= d2; addDmgNum(e2.x, e2.y, d2, true);
          FX.puff(e2.x, e2.y, 0xe0c04f, 20);
          effects.push({ type:'ring', x:e2.x, y:e2.y, life:0.35, age:0, r0:6, r1:44 });
          if (e2.hp<=0){ const idx=enemies.indexOf(e2); if (idx>=0) defeatEnemy(idx); }
          struck++;
        }
        if (struck>0){
          player.hp = Math.min(player.maxHp, player.hp + 5*(player.judgeHeal2?2:1)*player.healMult);
          addTextNum(player.x, player.y-30, '심판의 빛!');
          SFX.play('tele');
        }
        player.judgeT = 12 * player.cdr;
      }
    }
    // ---- 중력 ----
    if (player.gravLv>0 || player.gravAlways){
      player.gravT = (player.gravT||3) - dt;
      const hasWell = zones.some(z=>z.type==='grav');
      if (player.gravT<=0 && (!hasWell || !player.gravAlways)){
        const t2 = nearestTarget();
        const gx = t2 ? t2.x : player.x + Math.cos(player.facing)*140;
        const gy = t2 ? t2.y : player.y + Math.sin(player.facing)*140;
        if (zones.length<40) zones.push({ x:gx, y:gy, r:85, dps:player.gravDps*D, t:4, maxT:4, type:'grav' });
        player.gravT = 8 * player.cdr;
      }
    }
    if (player.singularity>0){
      player.singuT = (player.singuT||15) - dt;
      if (player.singuT<=0){
        const t3 = nearestTarget();
        const sx = t3 ? t3.x : player.x, sy = t3 ? t3.y : player.y;
        if (zones.length<40) zones.push({ x:sx, y:sy, r:150, dps:player.gravDps||10, t:2.2, maxT:2.2, type:'grav', singular:player.singularity*D });
        addTextNum(sx, sy-20, '특이점');
        FX.ring(sx, sy, 0x6a5acd, 18);
        SFX.play('tele');
        player.singuT = 15 * player.cdr;
      }
    }
    // ---- 시간 ----
    if (player.timestop>0){
      player.tstopT = (player.tstopT||16) - dt;
      if (player.tstopT<=0){
        for (const e2 of enemies) e2.frozenT = Math.max(e2.frozenT||0, 1.2*(player.stutterDur>=1?1.5:1));
        for (let i2=enemies.length-1;i2>=0;i2--){ const e2=enemies[i2]; e2.hp -= player.timestop*D; if (e2.hp<=0) defeatEnemy(i2); }
        addTextNum(player.x, player.y-30, '시간 정지!');
        FX.ring(player.x, player.y, 0x5ab8c9, 20);
        screenDimT = Math.max(screenDimT, 0.3);
        SFX.play('tele');
        player.tstopT = 16 * player.cdr * (player.timestopCdMult||1);
      }
    }
    // ---- 혈마 ----
    if (player.bloodLord>0){
      player.blordT = (player.blordT||12) - dt;
      if (player.blordT<=0){
        const cost = player.maxHp*0.08*(player.bloodLordHalf?0.5:1);
        if (player.hp > cost+10){
          player.hp -= cost;
          friendlyBlast(player.x, player.y, 170, player.bloodLord*D, true);
          FX.ring(player.x, player.y, 0xc9403a, 20);
          FX.puff(player.x, player.y, 0xc9403a, 40);
          addTextNum(player.x, player.y-30, '피의 군주!');
          shake = Math.min(18, shake+10);
          SFX.play('boom');
        }
        player.blordT = 12 * player.cdr;
      }
    }

    // 지옥불: 화염구
    if (player.fireballLv>0){
      player.fireballT -= dt;
      if (player.fireballT<=0){
        const t = nearestTarget();
        if (t){
          const a = Math.atan2(t.y-player.y, t.x-player.x);
          projectiles.push({
            x:player.x, y:player.y, vx:Math.cos(a)*320, vy:Math.sin(a)*320,
            r:6, damage:player.fireballDmg*D, crit:false, pierce:0, life:1.6, kind:'fireball'
          });
          SFX.play('shoot');
        }
        player.fireballT = 3.5 * player.cdr;
      }
    }
    // 지옥불: 불의 궤적
    if (player.firetrailLv>0){
      player.firetrailT -= dt;
      const moving = Math.hypot(player.vx,player.vy) > 20 || player.dashTime>0;
      if (player.firetrailT<=0 && moving){
        if (zones.length<40) zones.push({ x:player.x, y:player.y, r:26, dps:player.firetrailDps*D, t:player.firetrailDur, maxT:player.firetrailDur, type:'fire' });
        player.firetrailT = 0.22;
      }
    }
    // 지옥불: 대화재 — 폭염 + 화상 일괄 폭발
    if (player.inferno>0){
      player.infernoT -= dt;
      if (player.infernoT<=0){
        effects.push({ type:'ring', x:player.x, y:player.y, life:0.5, age:0, r0:30, r1:200 });
        for (let i=enemies.length-1;i>=0;i--){
          const e = enemies[i];
          if (Math.hypot(e.x-player.x,e.y-player.y) < 180+e.r){
            let d = player.inferno*D*corrodeMult(e);
            if (e.burnT>0){ d += e.burnDps*e.burnT*2; e.burnT=0; }
            e.hp -= d;
            addDmgNum(e.x,e.y,d,true);
            if (e.hp<=0) defeatEnemy(i);
          }
        }
        for (let i=bosses.length-1;i>=0;i--){
          const b = bosses[i];
          if (!b.ghost && Math.hypot(b.x-player.x,b.y-player.y) < 180+b.r){
            let d = player.inferno*D*0.8;
            if (b.burnT>0){ d += b.burnDps*b.burnT*2; b.burnT=0; }
            b.hp -= d;
            addDmgNum(b.x,b.y,d,true);
            if (b.hp<=0) defeatBoss(i); else refreshBossBar();
          }
        }
        addTextNum(player.x, player.y-30, '대화재!');
        shake = Math.min(18, shake+8);
        SFX.play('boom');
        player.infernoT = 12 * player.cdr * (player.infernoCdMult||1);
      }
    }
    // 서리: 얼음창
    if (player.lanceLv>0){
      player.lanceT -= dt;
      if (player.lanceT<=0){
        const t = nearestTarget();
        if (t){
          const a = Math.atan2(t.y-player.y, t.x-player.x);
          for (let k=0;k<player.lanceLv;k++){
            projectiles.push({
              x:player.x, y:player.y,
              vx:Math.cos(a+(k-(player.lanceLv-1)/2)*0.2)*380, vy:Math.sin(a+(k-(player.lanceLv-1)/2)*0.2)*380,
              r:5, damage:player.lanceDmg*D, crit:false, pierce:3, life:1.4, kind:'icelance'
            });
          }
          SFX.play('shoot');
        }
        player.lanceT = 4 * player.cdr;
      }
    }
    // 서리: 절대영도
    if (player.absZero>0){
      player.absZeroT -= dt;
      if (player.absZeroT<=0){
        effects.push({ type:'ring', x:player.x, y:player.y, life:0.6, age:0, r0:30, r1:460 });
        for (let i=enemies.length-1;i>=0;i--){
          const e = enemies[i];
          e.frozenT = Math.max(e.frozenT||0, 2);
          e.hp -= player.absZero*D;
          addDmgNum(e.x,e.y,player.absZero*D,false);
          if (e.hp<=0) defeatEnemy(i);
        }
        for (let i=bosses.length-1;i>=0;i--){
          const b = bosses[i];
          if (b.ghost) continue;
          b.hp -= player.absZero*D*0.5;
          if (b.hp<=0) defeatBoss(i); else refreshBossBar();
        }
        addTextNum(player.x, player.y-30, '절대영도!');
        freeze = Math.max(freeze, 0.07);
        SFX.play('tele');
        player.absZeroT = 14 * player.cdr;
      }
    }
    // 번개: 자기장
    if (player.magfieldLv>0){
      player.magfieldT -= dt;
      if (player.magfieldT<=0){
        effects.push({ type:'ring', x:player.x, y:player.y, life:0.3, age:0, r0:20, r1:135 });
        for (let i=enemies.length-1;i>=0;i--){
          const e = enemies[i];
          if (Math.hypot(e.x-player.x,e.y-player.y) < 130+e.r){
            const d = player.magfieldDmg*D*(e.corrodeS>0?1.5:1);
            e.hp -= d;
            addDmgNum(e.x,e.y,d,false);
            if (e.hp<=0) defeatEnemy(i);
          }
        }
        SFX.play('hit');
        player.magfieldT = 4 * player.cdr;
      }
    }
    // 번개: 뇌신 강림
    if (player.thor>0){
      player.thorT -= dt;
      if (player.thorT<=0){
        for (let k=0;k<8;k++) lightningStrike(player.thor*D, true);
        addTextNum(player.x, player.y-30, '뇌신 강림!');
        shake = Math.min(16, shake+8);
        SFX.play('boom');
        player.thorT = 11 * player.cdr;
      }
    }
    // 부식: 산성 구름
    if (player.acidLv>0){
      player.acidT -= dt;
      if (player.acidT<=0){
        if (zones.length<40) zones.push({ x:player.x, y:player.y, r:90, dps:player.acidDps*D, t:4, maxT:4, type:'acid' });
        player.acidT = 7 * player.cdr;
      }
    }
    // 부식: 완전 붕괴
    if (player.collapse){
      player.collapseT -= dt;
      if (player.collapseT<=0){
        for (const e of enemies){
          e.corrodeS = Math.min(player.corrodeMaxS, (e.corrodeS||0)+2);
          e.corrodeT = 6;
        }
        for (const b of bosses){ if (!b.ghost){ b.corrodeS = Math.min(2,(b.corrodeS||0)+1); b.corrodeT = 6; } }
        addTextNum(player.x, player.y-30, '완전 붕괴!');
        SFX.play('warn');
        player.collapseT = 15 * player.cdr;
      }
    }
    // 폭발: 지뢰 살포
    if (player.mineLv>0){
      player.mineT -= dt;
      if (player.mineT<=0){
        for (let k=0;k<2;k++){
          if (fmines.length<10) fmines.push({ x:player.x+(Math.random()*90-45), y:player.y+(Math.random()*90-45), armT:0.5, t:12 });
        }
        player.mineT = 5 * player.cdr;
      }
    }
    // 폭발: 융단 폭격
    if (player.orbital>0){
      player.orbitalT -= dt;
      if (player.orbitalT<=0){
        for (let k=0;k<8;k++){
          const a = Math.random()*Math.PI*2, d = 60+Math.random()*260;
          addHazard(player.x+Math.cos(a)*d, player.y+Math.sin(a)*d, 64, 0.6+k*0.12, player.orbital*D, true);
        }
        addTextNum(player.x, player.y-30, '융단 폭격!');
        SFX.play('meteor');
        player.orbitalT = 16 * player.cdr;
      }
    }
    // 기계: 터렛 (+스킬로 소환된 임시 터렛)
    if (player.turretLv>0 || player.turrets.length>0){
      while (player.turrets.filter(t=>!t.temp).length < player.turretLv) player.turrets.push({ x:player.x+40, y:player.y-40, cd:0.5 });
      for (let i=player.turrets.length-1;i>=0;i--){
        const tu = player.turrets[i];
        if (tu.temp !== undefined){ tu.temp -= dt; if (tu.temp<=0){ burst(tu.x,tu.y,6,110); player.turrets.splice(i,1); } }
      }
      player.turretRepoT -= dt;
      if (player.turretRepoT<=0){
        for (const tu of player.turrets){
          if (tu.temp !== undefined) continue;
          tu.x = player.x + (Math.random()*160-80);
          tu.y = player.y + (Math.random()*160-80);
          burst(tu.x, tu.y, 4, 90);
        }
        player.turretRepoT = 9;
      }
      for (const tu of player.turrets){
        tu.cd -= dt;
        if (tu.cd<=0){
          let tn=null, td=420*420;
          for (const e of enemies){ const dd=(e.x-tu.x)**2+(e.y-tu.y)**2; if (dd<td){ td=dd; tn=e; } }
          if (!tn){ for (const b of bosses){ if (b.ghost) continue; const dd=(b.x-tu.x)**2+(b.y-tu.y)**2; if (dd<td){ td=dd; tn=b; } } }
          if (tn){
            const a = Math.atan2(tn.y-tu.y, tn.x-tu.x);
            projectiles.push({
              x:tu.x, y:tu.y, vx:Math.cos(a)*520, vy:Math.sin(a)*520,
              r:3, damage:player.turretDmg*D*player.projMult, crit:false, pierce:0, life:0.9, tracer:true
            });
            tu.cd = 0.7 * player.cdr / (player.turretRate||1);
          } else tu.cd = 0.2;
        }
      }
    }
    // 기계: 오버드라이브
    if (player.odCd>0){
      player.odTimer -= dt;
      if (player.odTimer<=0){
        player.odT = 5;
        addTextNum(player.x, player.y-30, '오버드라이브!');
        SFX.play('fever');
        player.odTimer = player.odCd * player.cdr;
      }
    }
    // 유령 병사 (망자의 목자): 적을 쫓아가 두들긴다
    for (let i=player.ghosts.length-1;i>=0;i--){
      const gh = player.ghosts[i];
      gh.t -= dt;
      if (gh.t<=0){
        player.ghosts.splice(i,1);
        // 각성 '윤회의 목자': 유령이 소멸할 때 치유
        if (player.ghostHeal){ player.hp=Math.min(player.maxHp, player.hp+3*player.healMult); addTextNum(player.x,player.y-20,'+3',true); }
        continue;
      }
      if (gh.cd>0) gh.cd -= dt;
      let gn=null, gd2=Infinity;
      for (const e of enemies){ const dd=(e.x-gh.x)**2+(e.y-gh.y)**2; if (dd<gd2){ gd2=dd; gn=e; } }
      if (gn){
        const ga = Math.atan2(gn.y-gh.y, gn.x-gh.x);
        gh.x += Math.cos(ga)*180*dt;
        gh.y += Math.sin(ga)*180*dt;
        if (gh.cd<=0 && Math.hypot(gn.x-gh.x, gn.y-gh.y) < gn.r+12){
          const gdmg = 10*D*(player.ghostDmg||1);
          gn.hp -= gdmg;
          addDmgNum(gn.x, gn.y, gdmg, false);
          gh.cd = 0.5;
          if (gn.hp<=0){ const gi=enemies.indexOf(gn); if (gi>=0) defeatEnemy(gi); }
        }
      } else {
        gh.x += (player.x-gh.x)*dt*1.5;
        gh.y += (player.y-gh.y)*dt*1.5;
      }
    }
    // 변혁 '그림자 분신': 대시 잔상이 사격
    for (let i=player.shadows.length-1;i>=0;i--){
      const sh = player.shadows[i];
      sh.t -= dt;
      if (sh.t<=0){ player.shadows.splice(i,1); continue; }
      sh.cd -= dt;
      if (sh.cd<=0){
        let tn=null, td=380*380;
        for (const e of enemies){ const dd=(e.x-sh.x)**2+(e.y-sh.y)**2; if (dd<td){ td=dd; tn=e; } }
        if (tn){
          const a = Math.atan2(tn.y-sh.y, tn.x-sh.x);
          projectiles.push({
            x:sh.x, y:sh.y, vx:Math.cos(a)*460, vy:Math.sin(a)*460,
            r:3, damage:10*D, crit:false, pierce:0, life:0.8, tracer:true
          });
        }
        sh.cd = 0.35;
      }
    }
    // 염동: 파동 / 방벽
    if (player.pulseLv>0){
      player.pulseT -= dt;
      if (player.pulseT<=0){
        firePulse();
        player.pulseT = 7 * player.cdr;
      }
    }
    if (player.shieldCdMax>0 && !player.shieldReady){
      player.shieldT -= dt;
      if (player.shieldT<=0) player.shieldReady = true;
    }

    // 장판 (불길/산성) — 적에게 지속 피해 + 상태이상
    for (let i=zones.length-1;i>=0;i--){
      const z = zones[i];
      z.t -= dt;
      if (z.t<=0){
        // 특이점: 소멸 순간 대폭발
        if (z.singular){
          friendlyBlast(z.x, z.y, z.r+40, z.singular, true);
          FX.ring(z.x, z.y, 0x6a5acd, 20);
          shake = Math.min(18, shake+10);
          SFX.play('boom');
        }
        zones.splice(i,1); continue;
      }
      if (z.hostile){
        // 관문 기믹 구역: 적에게 무해 — 플레이어와만 상호작용
        if (z.type==='mirage'){
          // 신기루: 밟는 순간 폭발
          if (Math.hypot(player.x-z.x, player.y-z.y) < z.r*0.8){
            zones.splice(i,1);
            effects.push({ type:'ring', x:z.x, y:z.y, life:0.5, age:0, r0:20, r1:z.r+60 });
            addTextNum(player.x, player.y-36, '신기루!');
            SFX.play('boom');
            if (player.invuln<=0 && playerHit(24*dmgScale(), 0.4, 10)) return;
            continue;
          }
        } else if (z.type==='silence'){
          // 어색한 침묵: 안에 있으면 스킬 봉인 + 도트
          if (Math.hypot(player.x-z.x, player.y-z.y) < z.r){
            player.zoneSilenceT = 0.25;
            z.hitT = (z.hitT||0) - dt;
            if (z.hitT<=0 && player.invuln<=0){
              z.hitT = 0.7;
              if (playerHit(7*dmgScale(), 0.1, 2)) return;
              addTextNum(player.x, player.y-26, '...');
            }
          }
        } else if (z.type==='block'){
          if (z.hitT>0) z.hitT -= dt;
          const pd2 = Math.hypot(player.x-z.x, player.y-z.y);
          if (pd2 < z.r+player.r){
            const pa2 = Math.atan2(player.y-z.y, player.x-z.x) || 0;
            const push = z.r+player.r-pd2+2;
            player.x += Math.cos(pa2)*push;
            player.y += Math.sin(pa2)*push;
            if ((z.hitT||0)<=0 && player.invuln<=0){
              z.hitT = 0.6;
              if (playerHit(8*dmgScale(), 0.2, 4)) return;
            }
          }
        }
        continue;
      }
      for (let k=enemies.length-1;k>=0;k--){
        const e = enemies[k];
        if (Math.hypot(e.x-z.x,e.y-z.y) < z.r+e.r){
          e.hp -= z.dps*dt * (z.type==='grav' ? 1+(player.crushAmp||0) : 1);
          if (z.type==='fire' && Math.random()<dt*2){ e.burnT=2.5; e.burnDps=Math.max(e.burnDps||0, (player.burnDps||5)*D); }
          if (z.type==='acid' && Math.random()<dt*2){ e.corrodeS=Math.min(player.corrodeMaxS,(e.corrodeS||0)+1); e.corrodeT=5; }
          if (z.type==='frost' && Math.random()<dt*2.5){ e.chillS=Math.min(3,(e.chillS||0)+1); e.chillT=2.5; }
          if (z.type==='grav'){
            // 중력 우물: 중심으로 강하게 흡인
            const ga = Math.atan2(z.y-e.y, z.x-e.x);
            const pull = z.singular ? 160 : 110;
            e.x += Math.cos(ga)*pull*dt;
            e.y += Math.sin(ga)*pull*dt;
          }
          if (z.type==='void'){
            // 공허 균열: 중심으로 빨아들인다
            const va = Math.atan2(z.y-e.y, z.x-e.x);
            e.x += Math.cos(va)*90*dt;
            e.y += Math.sin(va)*90*dt;
          }
          if (Math.random()<dt*1.2) addDmgNum(e.x,e.y,z.dps*0.7,false);
          if (e.hp<=0) defeatEnemy(k);
        }
      }
      for (let k=bosses.length-1;k>=0;k--){
        const b = bosses[k];
        if (!b.ghost && Math.hypot(b.x-z.x,b.y-z.y) < z.r+b.r){
          b.hp -= z.dps*0.5*dt;
          if (b.hp<=0) defeatBoss(k); else if (Math.random()<dt) refreshBossBar();
        }
      }
    }
    // 아군 지뢰
    for (let i=fmines.length-1;i>=0;i--){
      const m = fmines[i];
      m.t -= dt;
      if (m.armT>0) m.armT -= dt;
      if (m.t<=0){ fmines.splice(i,1); continue; }
      if (m.armT<=0){
        let trig = false;
        for (const e of enemies){ if (Math.hypot(e.x-m.x,e.y-m.y) < 42+e.r){ trig=true; break; } }
        if (trig){
          friendlyBlast(m.x, m.y, 85, player.mineDmg*D, true);
          burst(m.x, m.y, 10, 170);
          SFX.play('boom');
          fmines.splice(i,1);
        }
      }
    }
  }

  // ---------- class ultimates ----------
  function triggerUltimate(){
    const D = player.dmgMult;
    const ck = player.classKey;
    // 궁극 시전 충격파 (직업색)
    if (FX.enabled){
      const uc = CLASS_COLORS[ck];
      if (uc){ const ti = parseInt(uc.slice(1),16); FX.ring(player.x, player.y, ti, 16); FX.puff(player.x, player.y, ti, 26); }
    }
    if (ck==='manager'){
      friendlyBlast(player.x, player.y, 108, player.ultDamage*D, true);
      burst(player.x,player.y,26,230);
      shake = Math.min(20, shake+10);
      SFX.play('boom');

    } else if (ck==='sniper'){
      const t = nearestTarget();
      if (t){
        const a = Math.atan2(t.y-player.y, t.x-player.x);
        projectiles.push({
          x:player.x, y:player.y,
          vx:Math.cos(a)*640, vy:Math.sin(a)*640,
          r:6, damage:16*D*player.ultMult*player.critMult, crit:true, pierce:9999, life:1.5, mega:true
        });
        burst(player.x,player.y,10,180);
        SFX.play('shoot');
      }

    } else if (ck==='rusher'){
      friendlyBlast(player.x, player.y, player.ultRadius, player.ultDamage*D, true);
      shake = Math.min(18, shake+8);
      SFX.play('sweep');

    } else if (ck==='archer' || ck==='ninja'){
      const n = player.ultVolleyCount;
      const isNinja = ck==='ninja';
      for (let i=0;i<n;i++){
        const a = (Math.PI*2/n)*i;
        projectiles.push({
          x:player.x, y:player.y,
          vx:Math.cos(a)*380, vy:Math.sin(a)*380,
          r: isNinja?6:4, damage:player.ultVolleyDmg*D, crit:false,
          pierce: isNinja?9999:Math.max(1,player.pierce), life:1.3,
          kind: isNinja?'shuriken':undefined, phase: isNinja?'out':undefined,
          spin:0, hitSet: isNinja?new Set():undefined, noReturn:true
        });
      }
      burst(player.x,player.y,18,210);
      SFX.play('shoot');

    } else if (ck==='engineer'){
      const dmg = player.ultDamage*D;
      for (let i=0;i<10;i++) lightningStrike(dmg, true);
      shake = Math.min(16, shake+8);
      SFX.play('boom');

    } else if (ck==='paladin'){
      friendlyBlast(player.x, player.y, 130, player.ultDamage*D, true);
      player.invuln = Math.max(player.invuln, 2.0);
      addTextNum(player.x, player.y-28, '심판!');
      effects.push({ type:'ring', x:player.x, y:player.y, life:0.6, age:0, r0:20, r1:180 });
      SFX.play('boom');

    } else if (ck==='reaper'){
      const before = killCount;
      effects.push({ type:'arc', x:player.x, y:player.y, a:player.facing, arc:Math.PI*2, r:player.ultRadius, life:0.4, age:0, friendly:true });
      friendlyBlast(player.x, player.y, player.ultRadius, player.ultDamage*D, false);
      const kills = killCount - before;
      if (kills>0){
        player.hp = Math.min(player.maxHp, player.hp + kills*3);
        addTextNum(player.x, player.y-28, '수확 +'+(kills*3));
      }
      SFX.play('sweep');

    } else if (ck==='pilot'){
      const a = player.facing;
      for (let i=0;i<player.ultVolleyCount;i++){
        addHazard(player.x + Math.cos(a)*(70+i*75), player.y + Math.sin(a)*(70+i*75), 54, 0.35+i*0.13, player.ultDamage*D, true);
      }
      addTextNum(player.x, player.y-28, '항공 지원!');
      SFX.play('meteor');

    } else if (ck==='cheol'){
      // 대지 가르기: 전방 3연쇄 충격파
      const a = player.facing;
      for (let i=0;i<3;i++){
        addHazard(player.x + Math.cos(a)*(80+i*90), player.y + Math.sin(a)*(80+i*90), 66, 0.15+i*0.15, player.ultDamage*D, true);
      }
      shake = Math.min(20, shake+12);
      SFX.play('boom');

    } else if (ck==='voidc'){
      // 공허 균열: 흡인 지대
      const t = nearestTarget();
      const vx2 = t ? t.x : player.x + Math.cos(player.facing)*160;
      const vy2 = t ? t.y : player.y + Math.sin(player.facing)*160;
      if (zones.length<40) zones.push({ x:vx2, y:vy2, r:110, dps:player.ultDamage*D, t:4, maxT:4, type:'void' });
      addTextNum(vx2, vy2-20, '공허 균열');
      SFX.play('tele');

    } else if (ck==='necro'){
      for (let i=0;i<player.ultVolleyCount;i++){
        const a = (Math.PI*2/player.ultVolleyCount)*i;
        player.ghosts.push({ x:player.x+Math.cos(a)*40, y:player.y+Math.sin(a)*40, t:8, cd:0 });
      }
      addTextNum(player.x, player.y-28, '망자의 행진!');
      SFX.play('tele');

    } else if (ck==='bard'){
      combo = Math.max(combo, 15);
      feverTimer = 6 + (player.feverPlus||0);
      comboTag.style.display='block';
      comboTag.classList.add('fever');
      comboNum.textContent = '×'+combo;
      friendlyBlast(player.x, player.y, 140, player.ultDamage*D, true);
      addTextNum(player.x, player.y-28, '광상곡!');
      SFX.play('fever');

    } else if (ck==='tourist'){
      // 기념 촬영: 화면 전체 정지 + 골드
      for (const e of enemies) e.frozenT = Math.max(e.frozenT||0, 2.5);
      runGold += Math.round(8*player.goldMult);
      screenDimT = Math.max(screenDimT||0, 0.15);
      addTextNum(player.x, player.y-28, '📸 찰칵!');
      SFX.play('tele');

    } else if (ck==='gambler'){
      // 운명의 주사위: 1~6 (강화 시 3~6)
      const pip = (player.diceLucky ? 3 : 1) + ((Math.random()*(player.diceLucky?4:6))|0);
      if (pip<=2){ addTextNum(player.x, player.y-28, '🎲 '+pip+' — 꽝'); }
      else if (pip<=4){ friendlyBlast(player.x, player.y, 130, player.ultDamage*D, true); addTextNum(player.x, player.y-28, '🎲 '+pip+' — 폭발!'); SFX.play('boom'); }
      else if (pip===5){ friendlyBlast(player.x, player.y, 170, player.ultDamage*1.5*D, true); gainGold(10); addTextNum(player.x, player.y-28, '🎲 5 — 대박!'); SFX.play('boom'); }
      else { friendlyBlast(player.x, player.y, 210, player.ultDamage*2.2*D, true); gainGold(25); shake=Math.min(22,shake+12); addTextNum(player.x, player.y-28, '🎲 6 — 초대박!!'); SFX.play('win'); }

    } else if (ck==='collector'){
      for (let i=0;i<player.ultVolleyCount;i++){
        const a = (Math.PI*2/player.ultVolleyCount)*i + Math.random()*0.3;
        fireProjectile(a, 420, player.ultVolleyDmg*D, 4, 1.4);
      }
      addTextNum(player.x, player.y-28, '수장고 개방!');
      SFX.play('shoot');

    } else if (ck==='slime'){
      // 바디 프레스: 체력 비례 광역 피해 + 소폭 회복
      const dmg = (player.ultDamage + player.maxHp*0.12) * D;
      friendlyBlast(player.x, player.y, 96+player.maxHp*0.15, dmg, true);
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp*0.04*player.healMult);
      shake = Math.min(20, shake+8);
      addTextNum(player.x, player.y-28, '바디 프레스!');
      SFX.play('boom');
    }
  }

  // ---------- update ----------
  function update(dt){
    elapsed += dt;
    tickCombo(dt);
    noHitT += dt;
    if (noHitT >= 180) unlockAch('nodmg3');

    // movement (+ dash, 넉백, 혼란)
    let dx=0, dy=0;
    if (keys.has('up')) dy-=1;
    if (keys.has('down')) dy+=1;
    if (keys.has('left')) dx-=1;
    if (keys.has('right')) dx+=1;
    if (touchOrigin){ dx += touchVec.x; dy += touchVec.y; }
    if (player.confuseT>0){ player.confuseT -= dt; dx=-dx; dy=-dy; }
    const len = Math.hypot(dx,dy);
    if (len>0){ dx/=len; dy/=len; player.facing = Math.atan2(dy,dx); if (Math.abs(dx)>0.15) player.faceX = dx>0?1:-1; }

    const slowMult = player.slowT>0 ? 0.6 : 1;
    if (player.slowT>0) player.slowT -= dt;

    if (player.dashTime > 0){
      player.dashTime -= dt;
      player.x += player.dashDir.x*640*dt;
      player.y += player.dashDir.y*640*dt;
      particles.push({ x:player.x, y:player.y, vx:0, vy:0, life:0.25, age:0, r:player.r*0.8, ghost:true });
      if (player.dashTime<=0 && player.bloodRush) dashExplosion(player.x, player.y, 25); // 피의 질주: 종료 폭발
    } else {
      const odMult = (player.odT>0 ? 1.2 : 1) * buffMult('spd');
      player.x += dx*player.speed*slowMult*odMult*dt;
      player.y += dy*player.speed*slowMult*odMult*dt;
    }
    // 외부 넉백 (돌풍/밀당)
    if (player.knockX || player.knockY){
      player.x += (player.knockX||0)*dt;
      player.y += (player.knockY||0)*dt;
      const dec = Math.min(1, dt*4);
      player.knockX *= (1-dec); player.knockY *= (1-dec);
      if (Math.abs(player.knockX)<5) player.knockX=0;
      if (Math.abs(player.knockY)<5) player.knockY=0;
    }
    player.vx = dx*player.speed;
    player.vy = dy*player.speed;

    if (player.dashCd>0) player.dashCd -= dt;
    if (player.dashHasteT>0) player.dashHasteT -= dt;
    for (let i=0;i<3;i++) if (player.skCds[i]>0) player.skCds[i] -= dt;
    if (player.rageT>0) player.rageT -= dt;
    // 임시 버프 만료
    for (let i=player.tbuffs.length-1;i>=0;i--){
      player.tbuffs[i].t -= dt;
      if (player.tbuffs[i].t<=0) player.tbuffs.splice(i,1);
    }
    if (player.invuln>0) player.invuln -= dt;
    if (player.zoneSilenceT>0) player.zoneSilenceT -= dt;
    updateGateObjs(dt);
    tickGatePending(dt);
    if (player.moonlight) screenDimT = Math.max(screenDimT, 0.22); // 월광 계약 — 상시 어둑
    // 파워 커브 틱: 초반형은 1분마다 -1.5%, 왕귀형은 +3.5% (히든캐릭 정체성)
    if (player.curveType){
      if (player.curveInit===undefined){ player.curveInit=true; player.dmgMult *= (player.curveType==='early'?1.12:0.9); }
      if (elapsed - (player.curveT0||0) >= 60){
        player.curveT0 = (player.curveT0||0) + 60;
        if (player.curveType==='late'){ player.dmgMult *= 1.035; addTextNum(player.x, player.y-52, '🌙 왕귀 곡선 — 피해 +3.5%'); }
        else { player.dmgMult *= 0.985; }
      }
    }
    // 마크 표적: 고동치는 링 표시
    if (player.markTarget){
      player.markPulseT = (player.markPulseT||0) - dt;
      if (player.markPulseT<=0){
        const mk = player.markTarget;
        effects.push({ type:'ring', x:mk.x, y:mk.y, life:0.45, age:0, r0:(mk.r||12)+4, r1:(mk.r||12)+16 });
        player.markPulseT = 0.5;
      }
    }
    if (player.hitFlash>0) player.hitFlash -= dt;
    if (player.regen>0){ player.hp = Math.min(player.maxHp, player.hp + player.regen*player.healMult*dt); }
    // 흡혈 감쇠 윈도 리셋 (1초 단위)
    player.__lsWinT = (player.__lsWinT||0) + dt;
    if (player.__lsWinT >= 1){ player.__lsWinT = 0; player.__lsWin = 0; }
    // 발사 반동 감쇠
    if (player.recoilX){ player.recoilX *= Math.max(0, 1-12*dt); if (Math.abs(player.recoilX)<0.1) player.recoilX=0; }
    if (player.recoilY){ player.recoilY *= Math.max(0, 1-12*dt); if (Math.abs(player.recoilY)<0.1) player.recoilY=0; }
    // 광인: 생명이 계속 새어나간다 — 사냥이 곧 생존
    if (player.madman && elapsed > 5){
      player.hp -= player.maxHp*(player.madmanSlow?0.005:0.008)*dt;
    }
    // 무명검 흡명의 형: 검을 든 동안 처치 회복 +1
    if (player.growthBranch==='leech' && !player.__leechApplied && ownedWeapon('nameless')){
      player.lifesteal += 1; player.__leechApplied = true;
    }
    // 백수: 가만히 있으면 강해진다 (움직이면 해제)
    if (player.baeksu){
      const still = dx===0 && dy===0 && player.dashTime<=0;
      player.__baeksuT = still ? (player.__baeksuT||0)+dt : 0;
      if (player.__baeksuT > 0.8){
        player.hp = Math.min(player.maxHp, player.hp + player.regen*2*player.healMult*dt); // 재생 3배 (기본+2배 추가)
        if (!player.__baeksuOn){ player.__baeksuOn=true; addTextNum(player.x, player.y-24, '집이 최고다...'); }
      } else if (player.__baeksuOn){ player.__baeksuOn=false; }
    }
    // 주식쟁이: 30초마다 보유 골드의 3% 이자
    if (player.stonks){
      player.__stonksT = (player.__stonksT||0) + dt;
      if (player.__stonksT >= 30){
        player.__stonksT = 0;
        const interest = Math.floor(runGold*0.03);
        if (interest>0){ runGold += interest; addTextNum(player.x, player.y-24, '📈 이자 +'+interest+'G'); SFX.play('coin'); }
      }
    }
    // 관광객: 이동 중 골드가 저절로 모인다
    if (player.walkGold && (dx!==0||dy!==0)){
      player.walkGoldAcc = (player.walkGoldAcc||0) + dt;
      if (player.walkGoldAcc >= 3.5){ player.walkGoldAcc = 0; gainGold(1); addTextNum(player.x, player.y-18, '+1G'); }
    }

    // spawns — 난이도 상향 곡선
    spawnTimer += dt;
    let interval = elapsed < 8 ? 1.15 : Math.max(0.15, 1.0 - (elapsed-8)*0.018);
    if (trialT > 0) interval *= (trialKind==='frenzy' ? 0.33 : 0.5); // 시련: 스폰 2배 (광란은 3배)
    if (waveModeRun) interval *= 0.78; // 웨이브 모드: 밀도 강화
    if (player.hordeMod) interval /= player.hordeMod; // 물량 계약
    const cap = Math.min(190, 20 + Math.floor(elapsed/2.6));
    const gateActive = bosses.some(b=>b.gate); // 관문 레이드 중엔 잔몹 스폰 전면 금지
    if (spawnTimer >= interval && !gateActive){
      spawnTimer = 0;
      const burstN = 1 + (elapsed>45?1:0) + (elapsed>120?1:0) + (elapsed>240?1:0) + (elapsed>330?1:0);
      for (let k=0;k<burstN;k++){ if (enemies.length < cap) spawnEnemy(); }
    }
    if (!gateActive && elapsed >= ELITE_FIRST_AT + eliteCount*ELITE_INTERVAL){ eliteCount+=1; spawnElite(); }
    if (!gateActive && elapsed >= WAVE_FIRST_AT + waveCount*WAVE_INTERVAL*(player.stormCall?0.7:1)){ waveCount+=1; spawnWave(); if (player.stormCall){ const g=gainGold(15); addTextNum(player.x, player.y-24, '폭풍 +'+g+'G'); } }
    // 시간의 압박: 60초마다 살아있는 모든 적이 강해진다 (필드에 오래 남은 몹도 위협 유지)
    eraTimer += dt;
    if (eraTimer >= 60){
      eraTimer = 0;
      for (const e of enemies){
        e.maxHp *= 1.1; e.hp *= 1.1;
        e.dmg = Math.round(e.dmg*1.08);
      }
      if (elapsed > 90) toast('⏰ 시간의 압박 — 모든 적이 강해졌다');
      // 유일무기 힌트: 미발견 상태에서 아주 가끔 세계가 속삭인다
      if (!DB.growth.found && Math.random()<0.12){
        setTimeout(()=>toast('👁 '+GW_HINTS[(Math.random()*GW_HINTS.length)|0]), 2000);
      }
      // 시한부 계약: 매분 최대체력 감소
      if (player.decayContract){
        player.maxHp = Math.max(30, Math.round(player.maxHp*0.95));
        player.hp = Math.min(player.hp, player.maxHp);
        toast('⌛ 시한부 계약 — 최대체력 -5%');
      }
    }
    // 에고 무기 수다 + 봉인 해제 알림
    tickEgo(dt);
    if (egoBubble){ egoBubble.t -= dt; if (egoBubble.t<=0) egoBubble = null; }
    if (ownedWeapon('nameless')){
      const gel = growthEffLv();
      if (gel > (player.__gel||1)){
        player.__gel = gel;
        toast('⚔ 봉인 해제 — 무명검 위력 단계 '+gel+'/'+(DB.growth.lv||1));
        egoSay(EGO_LEVELUP);
        FX.ring(player.x, player.y, 0xb8362e, 12);
      }
    }
    // 웨이브(스프린트) 모드: 45초마다 웨이브 상승 — 압축된 8웨이브 + 최종 보스
    if (waveModeRun && sprintWave < 8 && elapsed >= sprintWave*45 && !gateActive){
      sprintWave += 1;
      showBossBanner('WAVE '+sprintWave+' / 8', sprintWave>=8 ? '최종 보스가 다가온다' : '웨이브 '+sprintWave+' 시작', sprintWave>=7 ? '#b8362e' : '#45474a');
      for (let k=0;k<sprintWave*4;k++){
        const a = Math.random()*Math.PI*2;
        enemies.push(makeEnemy(Math.random()<0.4?'fish':'swarm', player.x+Math.cos(a)*(360+Math.random()*120), player.y+Math.sin(a)*(360+Math.random()*120), false));
      }
      SFX.play('warn');
    }
    // 중간 계약 (4분 / 8분)
    if (midContractIdx < midContractTimes.length && elapsed >= midContractTimes[midContractIdx]){
      midContractIdx += 1;
      openMidContract();
      return;
    }
    // 등장 주기 랜덤화: 매판·매회 다른 타이밍에 나타난다
    if (elapsed >= nextSurveyAt){ nextSurveyAt = elapsed + SURVEY_INTERVAL*(0.6+Math.random()*0.9); spawnSurvey(); }
    if (elapsed >= nextAltarAt){ nextAltarAt = elapsed + 75*(0.7+Math.random()*0.8); spawnAltar(); }
    if (elapsed >= nextRiftAt){ nextRiftAt = elapsed + 140*(0.7+Math.random()*0.7); spawnRift(); }
    // 차원 균열 시련 진행
    if (rift){
      rift.t -= dt;
      let done = false;
      if (rift.mode==='kill') done = (killCount - rift.kills0) >= rift.need;
      else if (rift.mode==='elite') done = !enemies.some(e=>e.riftElite);
      else if (rift.mode==='guard') done = !bosses.some(b=>b.riftBoss);
      else if (rift.mode==='live') done = false; // 시간을 버티면 성공
      if (done) exitRift(true);
      else if (rift.t <= 0) exitRift(rift.mode==='live');
    }
    tickRunQuest(dt);
    // NPC 의뢰인 스폰 — 극악의 조건이 겹치면 의뢰인 대신 '떠돌이 대장장이'가 온다 (유일무기 제3 루트)
    if (elapsed >= 45 + clientCount*90 && clients.length===0 && !runQuest){
      clientCount += 1;
      const cp = ringSpawnPos(240, 380);
      // 단계가 오를수록 대장장이는 더 깊이 숨는다 (2% → 0.8% → 0.3%)
      const gwOdds = [0.02, 0.008, 0.003][DB.gwq.stage||0] || 0;
      const gwNpc = !DB.growth.found && (DB.gwq.stage||0)<3 && (DB.peril||0)>=15 && achCount()>=12 && Math.random()<gwOdds;
      clients.push({ x:cp.x, y:cp.y, r:16, age:0, gw:gwNpc });
      toast(gwNpc ? '어디선가... 낡은 망치질 소리가 들린다 (!)' : '수상한 의뢰인이 나타났다 (!)');
    }
    for (let i=clients.length-1;i>=0;i--){
      const cl = clients[i];
      cl.age += dt;
      if (cl.age > 35 || Math.hypot(player.x-cl.x, player.y-cl.y) > 1400){ clients.splice(i,1); continue; }
      if (Math.hypot(player.x-cl.x, player.y-cl.y) < player.r+cl.r+6){
        const wasGw = cl.gw;
        clients.splice(i,1);
        if (wasGw) openGwQuest(); else openClientQuest();
        return;
      }
    }
    if (elapsed >= 90 + merchantCount*120*((player&&player.merchantFreq)||1) && merchants.length===0){
      merchantCount += 1;
      const mp = ringSpawnPos(240, 380);
      merchants.push({ x:mp.x, y:mp.y, r:16, age:0 });
      toast('떠돌이 상인이 나타났다! (40초)');
      SFX.play('coin');
    }
    for (let i=merchants.length-1;i>=0;i--){
      const mc = merchants[i];
      mc.age += dt;
      if (mc.age > 40 || Math.hypot(player.x-mc.x, player.y-mc.y) > 1400){ merchants.splice(i,1); continue; }
      if (Math.hypot(player.x-mc.x, player.y-mc.y) < player.r+mc.r+6){
        merchants.splice(i,1);
        openMerchant();
        return;
      }
    }

    // 시련 진행 — 60초간 스폰 2배, 버티면 대박 보상
    if (trialT > 0){
      trialT -= dt;
      if (trialT <= 0){
        questAdd('trial', 1);
        dropItem(player.x+40, player.y-30, 'chest');
        if (trialKind==='elite') dropItem(player.x-40, player.y-30, 'whet');
        else if (trialKind==='frenzy') dropItem(player.x-40, player.y-30, 'scroll');
        else dropItem(player.x-40, player.y-30, 'chest');
        const g = gainGold(50);
        addTextNum(player.x, player.y-30, '시련 완수! +'+g+'G');
        effects.push({ type:'rays', x:player.x, y:player.y, life:0.7, age:0 });
        toast('시련 완수! 보물상자 2개 + '+g+'G');
        SFX.play('win');
      }
    }

    updateWeapons(dt);
    updateTechAbilities(dt);

    // class ultimate auto-cast
    if (player.ultReady){
      player.ultCooldown -= dt * (1/player.cdr);
      if (player.ultFlash>0) player.ultFlash -= dt;
      if (player.ultCooldown<=0 && (enemies.length>0 || bosses.length>0)){
        // Q 수동 시전 — 1초 안에 안 누르면 자동 발동 (기존 4초는 자동이 멈춘 것처럼 느껴졌음)
        player.ultChargedT = (player.ultChargedT||0) + dt;
        if (player.ultFireReq || player.ultChargedT > 1.0){
          triggerUltimate();
          if (player.ultEcho){ // 변혁: 이중 시전
            setTimeout(()=>{ if (state==='playing') triggerUltimate(); }, 300);
          }
          player.ultCooldown = player.ultCooldownMax;
          player.ultFlash = 0.25;
          player.ultChargedT = 0;
          player.ultFireReq = false;
        }
      }
    }

    // projectiles
    for (let i=projectiles.length-1;i>=0;i--){
      const p = projectiles[i];
      if (p.homing){
        let hn=null, hd=320*320;
        for (const e of enemies){ const dd=(e.x-p.x)**2+(e.y-p.y)**2; if (dd<hd){ hd=dd; hn=e; } }
        if (!hn && bosses.length && !bosses[0].ghost) hn = bosses[0];
        if (hn){
          const want = Math.atan2(hn.y-p.y, hn.x-p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let diff = want-cur;
          while (diff>Math.PI) diff-=Math.PI*2;
          while (diff<-Math.PI) diff+=Math.PI*2;
          const turn = Math.max(-5*dt, Math.min(5*dt, diff));
          const sp = Math.hypot(p.vx,p.vy);
          p.vx = Math.cos(cur+turn)*sp; p.vy = Math.sin(cur+turn)*sp;
        }
      }
      if (p.kind==='shuriken'){
        p.spin += dt*14;
        if (!p.noReturn){
          if (p.phase==='out'){
            p.vx *= (1 - Math.min(1, dt*2.4));
            p.vy *= (1 - Math.min(1, dt*2.4));
            if (Math.hypot(p.vx,p.vy) < 110){ p.phase='return'; p.hitSet.clear(); }
          } else {
            const a = Math.atan2(player.y-p.y, player.x-p.x);
            const sp = Math.min(560, Math.hypot(p.vx,p.vy) + 900*dt);
            p.vx = Math.cos(a)*sp; p.vy = Math.sin(a)*sp;
            if (Math.hypot(player.x-p.x, player.y-p.y) < player.r+10){ projectiles.splice(i,1); continue; }
          }
        }
      }
      p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt;
      if (p.tracer && Math.random()<0.6) particles.push({ x:p.x, y:p.y, vx:0, vy:0, life:0.15, age:0, r:1.2 });
      const off = Math.hypot(p.x-player.x, p.y-player.y);
      if (p.life<=0 || off > Math.hypot(W,H)*0.75){ projectiles.splice(i,1); continue; }
    }

    // hazards (포격/유성/폭격 낙하 지점)
    for (let i=hazards.length-1;i>=0;i--){
      const h = hazards[i];
      h.timer -= dt;
      if (h.timer<=0){
        effects.push({ type:'ring', x:h.x, y:h.y, life:0.35, age:0, r0:h.r*0.3, r1:h.r*1.3 });
        burst(h.x, h.y, 10, 170);
        if (h.friendly){
          for (let k=enemies.length-1;k>=0;k--){
            const e = enemies[k];
            if (Math.hypot(e.x-h.x,e.y-h.y) < h.r+e.r){
              e.hp -= h.dmg;
              addDmgNum(e.x,e.y,h.dmg,false);
              if (e.hp<=0) defeatEnemy(k);
            }
          }
          for (let k=bosses.length-1;k>=0;k--){
            const b = bosses[k];
            if (!b.ghost && Math.hypot(b.x-h.x,b.y-h.y) < h.r+b.r){
              b.hp -= h.dmg;
              addDmgNum(b.x,b.y,h.dmg,false);
              if (b.hp<=0) defeatBoss(k); else refreshBossBar();
            }
          }
          SFX.play('boom');
        } else {
          if (Math.hypot(player.x-h.x, player.y-h.y) < h.r+player.r && player.invuln<=0){
            hazards.splice(i,1);
            if (playerHit(h.dmg, 0.6, 10)) return;
            continue;
          }
          SFX.play('boom');
        }
        hazards.splice(i,1);
      }
    }

    // boss mines (선정팩)
    for (let i=bossMines.length-1;i>=0;i--){
      const m = bossMines[i];
      m.life -= dt;
      if (m.armT>0) m.armT -= dt;
      if (m.life<=0){ bossMines.splice(i,1); continue; }
      if (m.armT<=0 && Math.hypot(player.x-m.x, player.y-m.y) < 46){
        effects.push({ type:'ring', x:m.x, y:m.y, life:0.3, age:0, r0:15, r1:80 });
        burst(m.x,m.y,12,180);
        bossMines.splice(i,1);
        SFX.play('boom');
        if (player.invuln<=0 && Math.hypot(player.x-m.x, player.y-m.y) < 80){
          if (playerHit(m.dmg, 0.6, 10)) return;
        }
      }
    }

    // enemies
    for (let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      const ex = player.x-e.x, ey = player.y-e.y;
      const ed = Math.hypot(ex,ey)||1;
      if (e.hitCd>0) e.hitCd -= dt;
      if (e.satCd>0) e.satCd -= dt;
      if (e.frozenT>0){ e.frozenT -= dt; }
      if (tickStatus(e, dt, false)){ defeatEnemy(i); continue; }

      // 너무 멀어진 적은 반대편 링으로 재배치 (무한 맵)
      if (ed > Math.hypot(W,H)*0.85 && !e.elite && e.type!=='treasure'){
        const p = ringSpawnPos();
        e.x = p.x; e.y = p.y;
        continue;
      }

      // aura: slow + tick damage (+냉기 중첩 감속)
      let speedFactor = e.frozenT>0 ? 0 : player.slowAll;
      if (e.chillS>0) speedFactor *= Math.max(0.3, 1 - player.chillPower*e.chillS);
      if (auraState.on && ed < auraState.r + e.r){
        speedFactor *= auraState.slow;
        e.hp -= auraState.dps*dt;
        if (Math.random() < dt*1.5) addDmgNum(e.x, e.y, auraState.dps*0.66, false);
        if (e.hp<=0){ defeatEnemy(i); continue; }
        if (auraState.ev){ player.hp = Math.min(player.maxHp, player.hp + 1.0*player.healMult*dt); }
      }

      // 보물 골렘: 플레이어에게서 도망치다 15초 뒤 땅속으로 사라진다
      if (e.type==='treasure'){
        e.fleeT -= dt;
        if (e.fleeT<=0){
          burst(e.x, e.y, 14, 160);
          addTextNum(e.x, e.y-16, '도망갔다!');
          enemies.splice(i,1);
          continue;
        }
        if (speedFactor>0 && ed < 380){
          e.x -= (ex/ed)*e.speed*speedFactor*dt;
          e.y -= (ey/ed)*e.speed*speedFactor*dt;
        }
      } else
      // movement AI per type
      if (speedFactor>0){
        if (e.type==='shooter' || e.type==='binder'){
          if (ed > 260){ e.x += (ex/ed)*e.speed*speedFactor*dt; e.y += (ey/ed)*e.speed*speedFactor*dt; }
          else if (ed < 190){ e.x -= (ex/ed)*e.speed*0.7*speedFactor*dt; e.y -= (ey/ed)*e.speed*0.7*speedFactor*dt; }
          e.fireTimer -= dt;
          if (e.fireTimer<=0 && ed < 460){
            const a = Math.atan2(player.y-e.y, player.x-e.x);
            if (e.type==='binder'){
              hostileShot(e.x, e.y, a, 160, 7, 4*dmgScale(), 3.4, {kind:'web'});
              e.fireTimer = 2.6 + Math.random();
            } else {
              hostileShot(e.x, e.y, a, 190, 5, 9*dmgScale(), 3.2);
              e.fireTimer = 2.2 + Math.random()*0.8;
            }
          }
        } else if (e.type==='kamikaze'){
          if (e.fuse>=0){
            e.fuse -= dt;
            if (e.fuse<=0){
              effects.push({ type:'ring', x:e.x, y:e.y, life:0.3, age:0, r0:12, r1:75 });
              burst(e.x,e.y,14,190);
              SFX.play('boom');
              if (player.invuln<=0 && Math.hypot(player.x-e.x,player.y-e.y) < 75+player.r){
                enemies.splice(i,1);
                if (playerHit(20*dmgScale(), 0.6, 10)) return;
                continue;
              }
              enemies.splice(i,1);
              continue;
            }
          } else {
            const sp = e.speed * (ed<200 ? 1.5 : 1);
            e.x += (ex/ed)*sp*speedFactor*dt;
            e.y += (ey/ed)*sp*speedFactor*dt;
            if (ed < 48) e.fuse = 0.55;
          }
        } else {
          e.x += (ex/ed)*e.speed*speedFactor*dt;
          e.y += (ey/ed)*e.speed*speedFactor*dt;
        }
      }

      // 엘리트 특수 패턴
      if (e.elite && e.frozenT<=0){
        e.affT -= dt;
        if (e.affix==='regen' || e.affix2==='regen'){
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp*0.02*dt);
        }
        // 이중 어픽스: 두 번째 어픽스도 주기적으로 발동 (탄막/소환)
        if (e.affix2 && e.affix2!==e.affix){
          e.aff2T = (e.aff2T===undefined ? 3 : e.aff2T) - dt;
          if (e.aff2T<=0){
            if (e.affix2==='barrage'){
              for (let k=0;k<6;k++){ const a=(Math.PI*2/6)*k+0.5; hostileShot(e.x, e.y, a, 170, 5.5, 8*dmgScale(), 2.6); }
              e.aff2T = 6;
            } else if (e.affix2==='summon'){
              for (let k=0;k<2;k++){ const a=Math.random()*Math.PI*2; enemies.push(makeEnemy('swarm', e.x+Math.cos(a)*40, e.y+Math.sin(a)*40, false)); }
              e.aff2T = 6;
            } else e.aff2T = 5;
          }
        }
        if (e.affT<=0){
          if (e.affix==='summon'){
            for (let k=0;k<2;k++){
              const a=Math.random()*Math.PI*2;
              enemies.push(makeEnemy('swarm', e.x+Math.cos(a)*40, e.y+Math.sin(a)*40, false));
            }
            addTextNum(e.x, e.y-e.r-10, '소환');
            e.affT = 6;
          } else if (e.affix==='barrage'){
            for (let k=0;k<6;k++){
              const a=(Math.PI*2/6)*k;
              hostileShot(e.x, e.y, a, 170, 5.5, 8*dmgScale(), 2.6);
            }
            e.affT = 6;
          } else if (e.affix==='dash'){
            const a = Math.atan2(player.y-e.y, player.x-e.x);
            e.dashDir = {x:Math.cos(a), y:Math.sin(a)};
            e.dashT = 0.5;
            e.affT = 5;
          } else {
            e.affT = 5;
          }
        }
        if (e.dashT>0){
          e.dashT -= dt;
          e.x += e.dashDir.x*380*dt;
          e.y += e.dashDir.y*380*dt;
        }
      }

      // vs projectiles
      for (let j=projectiles.length-1;j>=0;j--){
        const p = projectiles[j];
        const dd = Math.hypot(p.x-e.x, p.y-e.y);
        if (dd < e.r+p.r){
          if (p.kind==='shuriken'){
            if (p.hitSet.has(e)) continue;
            p.hitSet.add(e);
          }
          const dmgAmt = p.damage * corrodeMult(e);
          e.hp -= dmgAmt;
          addDmgNum(p.x, p.y, dmgAmt, p.crit);
          burst(p.x,p.y, p.crit?8:4, p.crit?170:90);
          if (p.crit) effects.push({ type:'ring', x:p.x, y:p.y, life:0.2, age:0, r0:4, r1:26 });
          if (Math.random()<0.35) SFX.play('hit');
          // 타격 넉백
          const kbA = Math.atan2(e.y-player.y, e.x-player.x);
          e.x += Math.cos(kbA)*7; e.y += Math.sin(kbA)*7;
          // 원소 부여 (+각인)
          procOnHit(e, false, p.imbue);
          // 화염구: 착탄 폭발 + 주변 화상
          if (p.kind==='fireball'){
            effects.push({ type:'ring', x:p.x, y:p.y, life:0.3, age:0, r0:12, r1:70 });
            burst(p.x, p.y, 10, 160);
            SFX.play('boom');
            for (const o of enemies){
              if (o===e) continue;
              if (Math.hypot(o.x-p.x, o.y-p.y) < 66+o.r){
                o.hp -= p.damage*0.8*corrodeMult(o);
                o.burnT = 2.5; o.burnDps = Math.max(o.burnDps||0, (player.burnDps||6)*player.dmgMult);
                addDmgNum(o.x, o.y, p.damage*0.8, false);
              }
            }
            e.burnT = 3; e.burnDps = Math.max(e.burnDps||0, (player.burnDps||6)*player.dmgMult);
          }
          // 얼음창: 빙결 확률
          if (p.kind==='icelance' && Math.random()<0.25){
            e.frozenT = Math.max(e.frozenT||0, 1);
          }
          if (p.kind!=='shuriken'){
            if (p.pierce>0){ p.pierce -= 1; } else { projectiles.splice(j,1); }
          }
          // 처형 (장비특성/사신)
          if (player.execThresh>0 && !e.elite && e.hp>0 && e.hp < e.maxHp*player.execThresh){
            e.hp = 0; addTextNum(e.x, e.y-10, '처형!');
          }
          if (e.hp<=0){
            defeatEnemy(i);
            if (p.gwep){
              // 유일 무기 성장 (인게임 처치분)
              const gw = DB.gweps[p.gwep];
              if (gw){ gw.xp += 1; if (gw.xp >= 20+gw.lv*15){ gw.xp -= (20+gw.lv*15); gw.lv += 1; toast(GWEP_DEFS[p.gwep].name+' 성장! Lv'+gw.lv); SFX.play('quest'); saveDB(); } }
            } else if (p.kind==='wave') addGrowthXp(1); // 무명검이 벤 수만큼 성장
          }
          break;
        }
      }
      if (!enemies[i]) continue;

      // vs satellites
      if (satPos.length){
        let hit = false;
        for (const sp of satPos){
          const sd = Math.hypot(sp.x-e.x, sp.y-e.y);
          if (sd < e.r+(sp.ev?10:8)){
            if (!(e.satCd>0)){
              const sdmg = sp.dmg * corrodeMult(e);
              e.hp -= sdmg;
              e.satCd = 0.35;
              addDmgNum(e.x, e.y, sdmg, false);
              burst(sp.x,sp.y,3,90);
              procOnHit(e, false, sp.imbue);
              if (Math.random()<0.4) SFX.play('hit');
            }
            hit = true;
            break;
          }
        }
        if (!hit && satPos[0].ev){
          const pd0 = Math.hypot(e.x-player.x, e.y-player.y);
          if (Math.abs(pd0 - satPos[0].orbitR) < 10 + e.r*0.4){
            e.hp -= satPos[0].ringDps*dt;
            if (Math.random() < dt*1.2) addDmgNum(e.x, e.y, satPos[0].ringDps*0.5, false);
          }
        }
        if (e.hp<=0){ defeatEnemy(i); continue; }
      }

      // vs player
      const pd = Math.hypot(player.x-e.x, player.y-e.y);
      if (pd < e.r+player.r && e.hitCd<=0 && player.invuln<=0 && e.dmg>0){
        e.hitCd = 0.6;
        const dmgIn = e.dmg;
        if (playerHit(dmgIn, 0.45, 8)) return;
        // 가시 반사
        if (player.thorns>0){
          const refl = dmgIn*player.thorns;
          e.hp -= refl;
          addDmgNum(e.x, e.y, refl, false);
          if (e.hp<=0){ defeatEnemy(i); continue; }
        }
      }
    }

    // boss spawn scheduling — 맵별 최종 보스(기존 보스의 각성형)
    // 균열 안에서는 일반 보스 스폰 정지 (균열은 자체 시련만)
    const finalAlive = bosses.some(b=>b.finale) || bosses.some(b=>b.gate);
    if (!rift){
    if (!finalAlive && !rootDefeated && elapsed>=runFinalAt){
      // 관문 위험도면 다단 관문 체인 (수문장 → 관문보스, 체크포인트 이어하기), 아니면 맵 최종 보스
      if (!spawnGateStage(DB.peril||0)) spawnBoss(MAP.final);
    } else if (!finalAlive && rootDefeated && endless && nextRootAt>0 && elapsed>=nextRootAt){
      spawnBoss(MAP.final, true);
    }
    if (bosses.length===0){
      if (!bossSpawnedOnce){
        if (elapsed>=BOSS_FIRST_AT){
          spawnBoss(nextBossKey(), false);
          bossSpawnedOnce=true; bossTimer=0; bossEncounterCount=1;
        }
      } else {
        bossTimer += dt;
        if (bossTimer>=BOSS_INTERVAL){
          bossEncounterCount += 1;
          const emp = isEmpoweredCycle();
          if (bossEncounterCount>=DOUBLE_BOSS_FROM){
            spawnBoss(nextBossKey(), emp);
            spawnBoss(nextBossKey(), emp);
          } else {
            spawnBoss(nextBossKey(), emp);
          }
          bossTimer=0;
        }
      }
    }
    } // !rift

    // bosses
    for (let i=bosses.length-1;i>=0;i--){
      const b = bosses[i];
      if (b.hitCd>0) b.hitCd -= dt;
      if (tickStatus(b, dt, true)){ defeatBoss(i); continue; }
      if (updateBoss(b, dt)) return;
      if (!bosses[i] || bosses[i]!==b) continue;
      if (b.gate) tickGateCore(b, dt);
      if (!bosses[i] || bosses[i]!==b) continue;

      // boss vs player projectiles
      if (!b.ghost){
        for (let j=projectiles.length-1;j>=0;j--){
          const p = projectiles[j];
          // 고독근: 몸통 어디든 맞는다
          let hitSeg = false;
          if (b.kind==='centipede'){
            if (Math.hypot(p.x-b.x, p.y-b.y) < 18+p.r) hitSeg = true;
            else for (const s of b.segs){ if (Math.hypot(p.x-s.x, p.y-s.y) < 15+p.r){ hitSeg=true; break; } }
          } else {
            hitSeg = Math.hypot(p.x-b.x, p.y-b.y) < b.r+p.r;
          }
          if (hitSeg){
            if (p.kind==='shuriken'){
              if (p.hitSet.has(b)) continue;
              p.hitSet.add(b);
            }
            const dmgAmt = (b.kind==='centipede' ? p.damage*0.75 : p.damage) * corrodeMult(b);
            b.hp -= dmgAmt;
            addDmgNum(p.x, p.y, dmgAmt, p.crit);
            burst(p.x,p.y, p.crit?8:4, p.crit?170:90);
            procOnHit(b, true, p.imbue);
            if (p.kind!=='shuriken'){
              if (p.pierce>0){ p.pierce -= 1; } else { projectiles.splice(j,1); }
            }
            if (b.hp<=0){ defeatBoss(i); break; }
            refreshBossBar();
          }
        }
      }
      if (!bosses[i] || bosses[i]!==b) continue;

      // boss vs satellites / aura
      if (!b.ghost){
        if (b.satCd>0) b.satCd -= dt;
        if (satPos.length){
          for (const sp of satPos){
            if (Math.hypot(sp.x-b.x, sp.y-b.y) < b.r+(sp.ev?10:8)){
              if (!(b.satCd>0)){
                const sdmg2 = sp.dmg * corrodeMult(b);
                b.hp -= sdmg2;
                b.satCd = 0.35;
                addDmgNum(b.x, b.y, sdmg2, false);
                burst(sp.x,sp.y,3,90);
                procOnHit(b, true, sp.imbue);
              }
              if (b.hp<=0){ defeatBoss(i); break; }
              refreshBossBar();
            }
          }
        }
        if (!bosses[i] || bosses[i]!==b) continue;
        if (auraState.on && Math.hypot(b.x-player.x, b.y-player.y) < auraState.r + b.r){
          b.hp -= auraState.dps*dt;
          if (b.hp<=0){ defeatBoss(i); continue; }
          refreshBossBar();
        }
      }
      if (!bosses[i] || bosses[i]!==b) continue;

      // boss vs player contact
      if (!b.ghost && b.kind!=='centipede' && b.chargeState!=='charging'){
        const pd2 = Math.hypot(player.x-b.x, player.y-b.y);
        if (pd2 < b.r+player.r && b.hitCd<=0 && player.invuln<=0){
          b.hitCd = 0.6;
          if (playerHit(b.dmg * (b.frenzy>0?1.3:1), 0.45, 8)) return;
        }
      }
    }

    // hostile shots
    for (let i=hostileShots.length-1;i>=0;i--){
      const p = hostileShots[i];
      if (p.kind==='tornado'){
        const cur = Math.atan2(p.vy,p.vx);
        const sp = Math.hypot(p.vx,p.vy);
        const na = cur + p.curve*dt;
        p.vx = Math.cos(na)*sp; p.vy = Math.sin(na)*sp;
      } else if (p.kind==='psyorb' || p.kind==='heart'){
        const want = Math.atan2(player.y-p.y, player.x-p.x);
        const cur = Math.atan2(p.vy,p.vx);
        let diff = want-cur;
        while (diff>Math.PI) diff-=Math.PI*2;
        while (diff<-Math.PI) diff+=Math.PI*2;
        const turn = Math.max(-1.6*dt, Math.min(1.6*dt, diff));
        const sp = Math.hypot(p.vx,p.vy);
        p.vx = Math.cos(cur+turn)*sp; p.vy = Math.sin(cur+turn)*sp;
      }
      // 시간 지연장: 내 주변 적탄 감속
      let dragMul = 1;
      if (player.dragField>0 && Math.hypot(p.x-player.x, p.y-player.y) < 160) dragMul = 1 - player.dragField;
      p.x += p.vx*dt*dragMul; p.y += p.vy*dt*dragMul; p.life -= dt;
      if (p.life<=0 || Math.hypot(p.x-player.x,p.y-player.y) > Math.hypot(W,H)*0.8){ hostileShots.splice(i,1); continue; }
      const dd = Math.hypot(p.x-player.x, p.y-player.y);
      if (dd < p.r+player.r && player.invuln<=0){
        hostileShots.splice(i,1);
        if (p.kind==='web'){ player.slowT = 2.0; addTextNum(player.x, player.y-16, '속박!'); }
        if (playerHit(p.damage, 0.5, 10)) return;
      }
    }

    // orbs
    const magnetR = player.magnet + (feverTimer>0 ? 60 : 0);
    if (orbs.length > 350){
      // 오래된 조각을 근처 조각에 흡수시켜 정리
      const o0 = orbs.shift();
      if (orbs.length) orbs[0].value += o0.value;
    }
    for (let i=orbs.length-1;i>=0;i--){
      const o = orbs[i];
      const d = Math.hypot(player.x-o.x, player.y-o.y);
      if (o.magnetized || d < magnetR){
        const pull = d<player.r+o.r ? 999 : (o.magnetized ? 460 : 270);
        const ux=(player.x-o.x)/(d||1), uy=(player.y-o.y)/(d||1);
        o.x += ux*pull*dt; o.y += uy*pull*dt;
      }
      if (d < player.r+o.r+2){
        grantXp(o.value);
        if (FX.enabled && Math.random()<0.5) FX.burst(o.x, o.y, 0x3aa895, 2, 60, 0.3);
        SFX.play('pick');
        orbs.splice(i,1);
      }
    }

    // items (골드는 자석에 끌려온다)
    for (let i=items.length-1;i>=0;i--){
      const it = items[i];
      it.age += dt;
      if (it.age > 20 && it.type!=='chest'){ items.splice(i,1); continue; }
      const itd = Math.hypot(player.x-it.x, player.y-it.y);
      if (it.type==='gold' && itd < magnetR){
        const ux=(player.x-it.x)/(itd||1), uy=(player.y-it.y)/(itd||1);
        it.x += ux*300*dt; it.y += uy*300*dt;
      }
      if (itd < player.r+it.r+4){
        useItem(it);
        items.splice(i,1);
      }
    }

    // 조사 지점
    for (let i=surveys.length-1;i>=0;i--){
      const s = surveys[i];
      if (Math.hypot(player.x-s.x, player.y-s.y) > 1400){ surveys.splice(i,1); continue; }
      if (Math.hypot(player.x-s.x, player.y-s.y) < player.r+s.r+4){
        surveys.splice(i,1);
        openEvent(FIELD_EVENTS[s.ev]);
        return;
      }
    }
    // 차원 균열 입구
    for (let i=rifts.length-1;i>=0;i--){
      const rf = rifts[i];
      if (Math.hypot(player.x-rf.x, player.y-rf.y) > 1600){ rifts.splice(i,1); continue; }
      if (Math.hypot(player.x-rf.x, player.y-rf.y) < player.r+rf.r+4){
        rifts.splice(i,1);
        enterRift();
        break;
      }
    }
    // 시련의 제단
    for (let i=altars.length-1;i>=0;i--){
      const al = altars[i];
      if (Math.hypot(player.x-al.x, player.y-al.y) > 1400){ altars.splice(i,1); continue; }
      if (Math.hypot(player.x-al.x, player.y-al.y) < player.r+al.r+4){
        altars.splice(i,1);
        // 제단 시련도 매번 다르게: 물량 / 정예 습격 / 광란 (짧고 격렬)
        const tr = Math.random();
        if (tr < 0.4){
          trialT = 60; trialKind = 'horde';
          bossWarn.textContent = '⚔ 물량 시련! 60초를 버텨라 (적 스폰 2배)';
        } else if (tr < 0.7){
          trialT = 45; trialKind = 'elite';
          for (let k=0;k<3;k++){ const a=Math.random()*Math.PI*2; enemies.push(makeEnemy('brute', player.x+Math.cos(a)*340, player.y+Math.sin(a)*340, true)); }
          bossWarn.textContent = '⚔ 정예 습격! 45초를 버텨라 (정예 3기 출현)';
        } else {
          trialT = 30; trialKind = 'frenzy';
          bossWarn.textContent = '⚔ 광란의 시련! 30초를 버텨라 (스폰 3배)';
        }
        bossWarn.style.opacity = '1';
        setTimeout(()=>{ bossWarn.style.opacity='0'; }, 2000);
        shake = Math.min(16, shake+8);
        SFX.play('warn');
      }
    }

    // damage numbers
    for (let i=dmgNums.length-1;i>=0;i--){
      const n = dmgNums[i];
      n.age += dt;
      if (n.age>=n.life){ dmgNums.splice(i,1); continue; }
      n.y += n.vy*dt;
      n.vy *= (1 - Math.min(1, dt*2));
    }

    // effects (psywave는 충돌 판정 포함)
    for (let i=effects.length-1;i>=0;i--){
      const fx = effects[i];
      fx.age += dt;
      if (fx.type==='psywave'){
        fx.radius += 240*dt;
        if (!fx.hit){
          const d = Math.hypot(player.x-fx.x, player.y-fx.y);
          if (Math.abs(d - fx.radius) < 16 + player.r*0.5 && player.invuln<=0){
            fx.hit = true;
            player.confuseT = 2.2;
            addTextNum(player.x, player.y-20, '혼란!');
            if (playerHit(fx.dmg, 0.5, 8)) return;
          }
        }
      }
      if (fx.age>=fx.life){ effects.splice(i,1); }
    }

    // particles
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.age += dt;
      if (p.age>=p.life){ particles.splice(i,1); continue; }
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.vx *= (1 - Math.min(1,dt*3));
      p.vy *= (1 - Math.min(1,dt*3));
    }

    if (shake>0) shake = Math.max(0, shake - dt*30);

    updateHud();
    maybeOpenLevelUp();
  }

  // ---------- player damage ----------
  function playerHit(dmg, invulnTime, shakeAmt){
    if (player.invuln>0) return false;
    if (player.dodge>0 && Math.random()<player.dodge){
      addTextNum(player.x, player.y-14, 'MISS');
      player.invuln = 0.25;
      return false;
    }
    // 신성 성역: 확률 무효화 (금빛 섬광)
    if (player.holyWard>0 && Math.random()<player.holyWard){
      addTextNum(player.x, player.y-14, '성역!');
      FX.puff(player.x, player.y, 0xe0c04f, 18);
      player.invuln = 0.3;
      return false;
    }
    // 사이오닉 방벽
    if (player.shieldReady){
      player.shieldReady = false;
      player.shieldT = player.shieldCdMax;
      addTextNum(player.x, player.y-14, '방벽!');
      effects.push({ type:'ring', x:player.x, y:player.y, life:0.3, age:0, r0:player.r, r1:player.r+30 });
      player.invuln = 0.4;
      SFX.play('tele');
      return false;
    }
    let d = dmg * player.dmgTaken * buffMult('dr');
    if (player.baeksu && (player.__baeksuT||0)>0.8) d *= 0.8; // 백수: 집콕 방어
    // 불굴: 낮은 체력 피해 감소
    if (player.undyingDR>0 && player.hp < player.maxHp*0.3) d *= (1-player.undyingDR);
    player.hp -= d;
    noHitT = 0;
    // 생존 의뢰 실패
    if (runQuest && runQuest.type==='nohit'){
      toast('의뢰 실패... (피격)');
      runQuest = null;
    }
    player.invuln = invulnTime;
    player.hitFlash = 0.25;
    shake = Math.min(22, shake+shakeAmt);
    burst(player.x,player.y,12,160,0xd9534f);
    FX.puff(player.x, player.y, 0xd9534f, 16); // 피격 적색 섬광
    SFX.play('hurt');
    // 서리 갑옷: 피격 시 주변 빙결
    if (player.frostArmor>0){
      effects.push({ type:'ring', x:player.x, y:player.y, life:0.3, age:0, r0:20, r1:130 });
      for (const e of enemies){
        if (Math.hypot(e.x-player.x, e.y-player.y) < 130+e.r){
          e.frozenT = Math.max(e.frozenT||0, 1.2);
        }
      }
    }
    if (player.firstAid && Math.random()<0.25){
      const fh = Math.round(12*player.healMult);
      player.hp = Math.min(player.maxHp, player.hp+fh);
      addTextNum(player.x, player.y-26, '+'+fh);
    }
    // 변혁 '성스러운 보복': 피격 시 신성 폭발
    if (player.holyRet){
      friendlyBlast(player.x, player.y, 120, 30*player.dmgMult, true);
    }
    // 위기 회피 — 빈사 상태 첫 진입 시 잠깐 슬로모션 (판단할 시간을 준다)
    if (player.hp>0 && player.hp < player.maxHp*0.15 && !player.lastStandUsed){
      player.lastStandUsed = true;
      slowmoT = 2.2;
      player.invuln = Math.max(player.invuln, 1.0);
      addTextNum(player.x, player.y-34, '위기!');
      SFX.play('tele');
    }
    if (player.hp<=0){
      if (player.reviveLeft>0 || player.undyingRevive){
        if (player.undyingRevive) player.undyingRevive = false;
        else player.reviveLeft -= 1;
        player.hp = Math.ceil(player.maxHp*0.5);
        player.invuln = 2.5;
        addTextNum(player.x, player.y-20, '재기동!');
        for (let i=enemies.length-1;i>=0;i--){
          const e = enemies[i];
          if (Math.hypot(e.x-player.x, e.y-player.y) < 200){
            e.hp -= 600;
            if (e.hp<=0) defeatEnemy(i);
          }
        }
        hostileShots.length = 0;
        burst(player.x, player.y, 40, 320);
        effects.push({ type:'ring', x:player.x, y:player.y, life:0.5, age:0, r0:20, r1:260 });
        shake = Math.min(24, shake+14);
        freeze = Math.max(freeze, 0.09);
        SFX.play('boom');
        updateHud();
        return false;
      }
      player.hp = 0;
      updateHud();
      endGame();
      return true;
    }
    return false;
  }

  // ---------- level up flow ----------
  function grantXp(v){
    player.xp += v * MAP.mult.reward * perilR() * (player.xpMult||1);
    if (player.level >= 60){ player.xp = 0; return; } // 런 내 레벨 상한 — 무한 성장 차단
    while (player.xp >= player.xpNext){
      if (player.level >= 60){ player.xp = 0; break; }
      player.xp -= player.xpNext;
      player.level += 1;
      if (player.level % 2 === 0){ player.ascStones = (player.ascStones||0)+1; addTextNum(player.x, player.y-52, '◈ 승천석 +1'); }
      player.xpNext = Math.floor(16 + player.level*11 + player.level*player.level*1.9); // 5차 하향 — 레벨은 더 귀하다 (장비 지배 견제)
      pendingLevelUps += 1;
    }
    if (player.level >= 30) unlockAch('lv30');
    // 스킬 습득 체크 (레벨 도달 시)
    const pool = player.customPool || SKILL_POOLS[player.classKey];
    if (pool){
      for (const sk of pool){
        if (player.level >= sk.lv && !player.learned.includes(sk)){
          player.learned.push(sk);
          const empty = player.skills.indexOf(null);
          if (empty >= 0){
            player.skills[empty] = sk;
            toast('스킬 습득: ['+sk.n+'] → 슬롯 '+(empty+2)+'번');
            SFX.play('quest');
          } else {
            pendingSkills.push(sk);
          }
        }
      }
    }
    // 전직 (레벨 10 / 25 / 40) — 3차까지 (전직 용사는 레벨 5부터)
    if (player.exhero && player.level >= 5 && player.jobs.length < 1 && !pendingJobs.includes(1)) pendingJobs.push(1);
    if (player.level >= 10 && player.jobs.length < 1 && !pendingJobs.includes(1)) pendingJobs.push(1);
    if (player.level >= 25 && player.jobs.length < 2 && !pendingJobs.includes(2)) pendingJobs.push(2);
    if (player.level >= 40 && player.jobs.length < 3 && !pendingJobs.includes(3)) pendingJobs.push(3);
    // 각성 (레벨 20)
    if (player.level >= 20 && !player.awakening && !pendingAwaken){
      pendingAwaken = true;
    }
  }
  const banishBtn = document.createElement('button');
  banishBtn.className = 'miniBtn';
  banishBtn.id = 'banishBtn';
  $('luBtns').appendChild(banishBtn);
  // 속성 지정: 리롤 1개를 소모해 원하는 속성을 강림시킨다 (다음 후보로 순환)
  const elemBtn = document.createElement('button');
  elemBtn.className = 'miniBtn';
  elemBtn.id = 'elemBtn';
  $('luBtns').appendChild(elemBtn);
  elemBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if (state!=='levelup' || rerollsLeft<=0 || !focusTree) return;
    const actives = activeSpecTrees();
    const cands = actives.length >= (player.attrLimit||3) ? actives : SPEC_TREES.slice();
    if (cands.length<2) return;
    rerollsLeft -= 1;
    focusOverride = cands[(cands.indexOf(focusTree)+1) % cands.length];
    currentChoices = rollUpgrades(player.cardSlots||6);
    renderCards();
    SFX.play('pick');
  });
  const statsLine = document.createElement('div');
  statsLine.style.cssText = 'font-family:IBM Plex Mono,monospace;font-size:10px;color:var(--ink-500);max-width:640px;line-height:1.7;white-space:pre-line;';
  levelupBox.appendChild(statsLine);

  function statsSummary(){
    const p = player;
    const els = activeSpecTrees().map(t=>TREES[t].name).join('·');
    const path = (p.comboTitle ? '『'+p.comboTitle+'』 ' : '') + [CLASSES[p.classKey].name].concat(p.jobs||[]).join(' → ') + (p.awakening ? ' ★'+p.awakening : '');
    return path+'\n속성 ['+(els||'없음')+'] — 공격 '+Math.round(p.dmgMult*100)+'% · 공속 '+Math.round(p.rateMult*100)+'% · 쿨감 '+Math.round((1-p.cdr)*100)+'%'
      + ' · 이속 '+Math.round(p.speed)+' · 치명 '+Math.round(p.critChance*100)+'%/'+p.critMult.toFixed(1)+'배'
      + ' · 관통 '+p.pierce+' · 회피 '+Math.round(p.dodge*100)+'% · 행운 '+p.luck.toFixed(1)
      + ' · 재생 '+p.regen.toFixed(1)+'/s';
  }

  function maybeOpenLevelUp(){
    if (pendingLevelUps>0 && state==='playing'){
      pendingLevelUps -= 1;
      currentChoices = rollUpgrades(player.cardSlots||6);
      renderCards();
      state = 'levelup';
      titleText.innerHTML = 'LEVEL <span class="lite">UP</span>';
      subText.style.display='none';
      classBox.style.display='none';
      shopBox.style.display='none'; equipBox.style.display='none'; questBox.style.display='none';
      mapRow.style.display='none';
      goldRow.style.display='none';
      resultBox.style.display='none';
      eventBox.style.display='none';
      levelupBox.style.display='flex';
      btn.style.display='none'; btn2.style.display='none';
      bestSub.style.display='none';
      overlay.classList.remove('hidden');
      SFX.play('level');
    }
  }
  function renderCards(){
    cardsEl.innerHTML = '';
    banishMode = false;
    if (focusTree){
      luHint.textContent = '⚡ ['+TREES[focusTree].name+'] 속성 강림 — 하나를 선택하세요 (1~6 · R 리롤)';
      luHint.style.color = COLORS[focusTree] || '';
      luHint.style.fontWeight = '700';
    } else { luHint.style.color=''; luHint.style.fontWeight=''; }
    currentChoices.forEach((u,i)=>{
      const el = document.createElement('div');
      el.className = 'card' + (u.cap?' cap':'') + (u.myth?' myth':'') + (u.rarity!==undefined&&!u.myth?' rar'+u.rarity:'');
      // 속성별 카드 스타일: 속성색 상단 바 + 태그 착색
      if (u.elc && COLORS[u.elc]){
        el.style.borderTop = '3px solid '+COLORS[u.elc];
        const tagEl0 = ()=>{ const te=el.querySelector('.tag'); if (te){ te.style.background=COLORS[u.elc]; te.style.color='#fff'; } };
        setTimeout(tagEl0, 0);
      }
      const num = '<div class="num">0'+(i+1)+'</div>';
      const tag = u.tag ? '<div class="tag"'+(u.ctag?' style="background:var(--ink-900);color:#e8c56a;"':'')+'>'+u.tag+'</div>' : '';
      const rb = (u.rarity!==undefined) ? '<span class="rbadge '+(u.jackpot?'r4':CARD_RARITY[u.rarity].cls)+'">'+(u.jackpot?'잭팟':CARD_RARITY[u.rarity].n+(u.rarity>0?' ×'+CARD_RARITY[u.rarity].m:''))+'</span>' : '';
      el.innerHTML = num+tag+'<div class="name">'+rb+u.name+'</div><div class="desc">'+u.desc+'</div>';
      el.addEventListener('click', ()=>{
        if (banishMode){
          if (banishLeft<=0) return;
          banishLeft -= 1;
          banned.add(u.key);
          banishMode = false;
          currentChoices = currentChoices.filter(c=>c!==u);
          renderCards();
          SFX.play('hit');
        } else {
          pickUpgrade(currentChoices.indexOf(u));
        }
      });
      cardsEl.appendChild(el);
    });
    rerollBtn.textContent = '리롤 ('+rerollsLeft+')';
    rerollBtn.disabled = rerollsLeft<=0;
    banishBtn.textContent = '제외 ('+banishLeft+')';
    banishBtn.disabled = banishLeft<=0;
    banishBtn.classList.remove('on');
    if (typeof elemBtn !== 'undefined'){
      const actives0 = activeSpecTrees();
      const cands0 = actives0.length >= (player.attrLimit||3) ? actives0 : SPEC_TREES;
      const nxt = focusTree ? cands0[(cands0.indexOf(focusTree)+1) % cands0.length] : null;
      elemBtn.textContent = nxt ? '→ '+TREES[nxt].name+' 강림 (리롤 1)' : '속성 변경';
      elemBtn.disabled = rerollsLeft<=0 || !nxt || nxt===focusTree;
    }
    statsLine.textContent = statsSummary();
  }
  banishBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if (banishLeft<=0) return;
    banishMode = !banishMode;
    banishBtn.classList.toggle('on', banishMode);
    luHint.textContent = banishMode ? '제외할 카드를 클릭하세요 (이번 판에서 다시 안 나옴)' : '레벨업 — 하나를 선택하세요 (1~4 · R 리롤)';
  });
  function closeLevelUp(){
    overlay.classList.add('hidden');
    levelupBox.style.display='none';
    luHint.textContent = '레벨업 — 하나를 선택하세요 (1~4 · R 리롤)';
    setTimeout(()=>{
      if (pendingLevelUps>0){ state='playing'; maybeOpenLevelUp(); }
      else if (pendingBranchAsk && DB.growth.found && DB.growth.lv>=20 && !player.growthBranch && ownedWeapon('nameless')){ pendingBranchAsk=false; state='playing'; openGrowthBranch(); }
      else if (pendingJobs.length>0){ state='playing'; openJobChoice(pendingJobs.shift()); }
      else if (pendingAwaken && !player.awakening){ state='playing'; openAwakening(); }
      else if (pendingSkills.length>0){ state='playing'; openSkillSwap(pendingSkills.shift()); }
      else { state='playing'; last = performance.now(); resumeGrace(); }
    }, 120);
  }
  // UI에서 전장 복귀 시 잠깐의 유예 — 복귀하자마자 탄막에 맞아 죽는 억울함 방지
  function resumeGrace(){
    if (!player) return;
    player.invuln = Math.max(player.invuln||0, 1.6);
    freeze = Math.max(freeze, 0.3);
  }
  // ---------- 📚 도감 (별도 탭) ----------
  function renderDex(){
    const list = $('dexList');
    list.innerHTML = '';
    const row = (html)=>{ const d=document.createElement('div'); d.className='shopItem'; d.innerHTML='<div class="info">'+html+'</div>'; list.appendChild(d); };
    // 수집 요약
    const uniqNames = new Set(DB.inv.filter(i=>i.r===5).map(i=>i.name));
    row('<div class="nm">📖 수집 현황</div><div class="ds">유니크 '+uniqNames.size+'/'+UNIQUE_POOL.length+' · 태초 '+DB.inv.filter(i=>i.r===6).length+'개 · 업적 '+achCount()+'/'+ACHIEVEMENTS.length+' · 직업 '+Object.keys(CLASSES).filter(isClassUnlocked).length+'/'+Object.keys(CLASSES).length+'</div>');
    // 장비 도감 — 유니크 풀 전체 공개 (보유 여부 표시)
    row('<div class="nm">🛡 유니크 장비 도감</div><div class="ds">'
      + UNIQUE_POOL.map(u=>{ const own = uniqNames.has(u.n||u.name||u); const nm = u.n||u.name||u; return own ? '<b style="color:#b8362e;">'+nm+' ✓</b>' : nm; }).join(' · ')+'</div>');
    // 세트 도감
    row('<div class="nm">🧩 세트 도감</div><div class="ds">'
      + Object.keys(SET_DEFS).map(sk=>{ const sd=SET_DEFS[sk]; const cnt=DB.inv.filter(i=>i.set===sk).length; return '<b>'+(sd.name||sk)+'</b> (보유 조각 '+cnt+')'; }).join(' · ')+'</div>');
    // 성장무기 도감 — 힌트만 (획득 단서 없음)
    const gwDex = [
      { found: DB.growth.found, name:'무명검', hint:'이름을 잃은 검. 벨수록 무언가를 기억해낸다고 한다.' },
      { found: DB.gweps.bow.found, name:'침묵하는 활', hint:'시위를 당겨도 소리가 나지 않는다.' },
      { found: DB.gweps.tome.found, name:'굶주린 마도서', hint:'책장이 스스로 넘어간다. 굶주려 있다.' },
      { found: DB.gweps.blade.found, name:'핏빛 대검', hint:'날에 마르지 않는 얼룩.' },
    ];
    row('<div class="nm">⚔ 성장무기 도감 ('+gwDex.filter(g=>g.found).length+'/4)</div><div class="ds">'
      + gwDex.map(g=> g.found ? '<b style="color:#8b5cf6;">'+g.name+' ✓</b> — '+g.hint : '??? — <span style="opacity:0.6;">'+g.hint+'</span>').join('<br>')+'</div>');
    // 테크 도감 — 처음부터 전체 공개 (획득한 것은 속성색 강조)
    const seen = DB.seenTech||{};
    for (const tk of SPEC_TREES){
      const tree = TREES[tk];
      const cnt = tree.nodes.filter(n=>seen[n.key]).length;
      row('<div class="nm" style="color:'+(COLORS[tk]||'#888')+';">'+tree.name+' ('+cnt+'/'+tree.nodes.length+')</div><div class="ds">'
        + tree.nodes.map(n=>{
            const cat = n.myth ? '신화' : n.tier===3 ? '전용기' : (NODE_CAT[n.key]||'전술');
            const nm = n.name+'<span style="font-size:8px;opacity:0.7;">['+cat+']</span>';
            return seen[n.key] ? '<b style="color:'+(COLORS[tk]||'#555')+';">'+nm+'</b>' : nm;
          }).join(' · ')+'</div>');
    }
    // 보스 도감
    row('<div class="nm">👑 보스 도감</div><div class="ds">'
      + Object.keys(BOSS_TYPES).filter(k=>!BOSS_TYPES[k].finale).map(k=>BOSS_TYPES[k].name).join(' · ')+'</div>');
  }
  // 유일무기 힌트 — 아주 가끔, 세계가 속삭인다
  const GW_HINTS = [
    '...위험을 아는 자(위험도 3+)에게만 상인이 창고 깊은 곳의 고철을 보여준다는 소문이 있다.',
    '...업적을 쌓은 방랑자만이 그 고철 뭉치의 진가를 알아본다고 한다.',
    '...보물상자 천 개 중 하나에 이름 없는 검이 잠들어 있다는 전설이 있다.',
  ];
  // 3속성 조합 칭호: 속성이 확정되는 순간 조합에 따른 칭호 부여
  const TITLE_WORD = { fire:'겁화', frost:'설한', volt:'뇌정', acid:'침식', boom:'폭렬', mech:'강철', psi:'염동', holy:'성광', grav:'중천', chrono:'시각(時刻)', blood:'혈혼' };
  const TITLE_ROLE = { fire:'방화왕', frost:'동토의 주인', volt:'뇌제(雷帝)', acid:'용해자', boom:'파괴자', mech:'기계 군주', psi:'초능력자', holy:'성인(聖人)', grav:'별을 당기는 자', chrono:'시간의 관리자', blood:'피의 군주' };
  function checkComboTitle(){
    if (player.comboTitle) return;
    const actives = activeSpecTrees();
    if (actives.length < (player.attrLimit||3)) return;
    const a = actives.slice().sort((x,y)=> (player.tech[y]||0)-(player.tech[x]||0));
    const title = TITLE_WORD[a[1]]+'·'+TITLE_WORD[a[2]!==undefined?a[2]:a[0]]+'의 '+TITLE_ROLE[a[0]];
    player.comboTitle = title;
    unlockAch('title1');
    showBossBanner('칭호 각성', '『'+title+'』', COLORS[a[0]]||'#e8c56a');
    toast('🏆 칭호 획득: '+title);
    FX.ring(player.x, player.y, parseInt((COLORS[a[0]]||'#e8c56a').slice(1),16), 16);
    SFX.play('win');
  }
  // 테크 현황 (T): 내가 선택한 속성·하위테크 전체 열람
  function openTechView(){
    const actives = activeSpecTrees();
    let lines = [];
    lines.push('속성 슬롯: '+actives.length+'/'+(player.attrLimit||3)+(actives.length>=(player.attrLimit||3)?' (확정 — 이 속성들만 강림)':' (아직 새 속성 등장 가능)'));
    for (const tk of actives.concat(['common'])){
      const tree = TREES[tk];
      const pts = player.tech[tk]||0;
      const picked = tree.nodes.filter(n=>(player.techPicks[n.key]||0)>0);
      if (tk!=='common'){
        lines.push('');
        lines.push('【'+tree.name+'】 투자 '+pts+'P · 슬롯 '+picked.filter(n=>!n.myth).length+'/5' + (picked.some(n=>n.myth)?' · ✦신화 보유':''));
      } else if (picked.length){
        lines.push('');
        lines.push('【공통】');
      }
      for (const n of picked){
        const cat = n.myth ? '신화' : n.tier===3 ? '전용기' : (NODE_CAT[n.key]||'전술');
        lines.push('  '+(n.myth?'✦':'·')+' '+n.name+' ×'+(player.techPicks[n.key]||0)+(tk==='common'?'':' ['+cat+']'));
      }
    }
    if (player.weapons.length){
      lines.push('');
      lines.push('무기: '+player.weapons.map(w=>WEAPONS[w.key].name+(w.evolved?'★':' Lv'+w.lv)+(w.imbue?'('+TREES[w.imbue].name+')':'')).join(' · '));
    }
    openEvent({ t:'테크 현황 — '+CLASSES[player.classKey].name, d:lines.join('\n'), opts:[{ l:'닫기', d:'게임으로 돌아간다', fx:null }] });
  }
  // 스킬창 (K): 습득한 스킬 열람 + 슬롯 재배치
  function openSkillBook(){
    if (!player.learned.length){ toast('아직 배운 스킬이 없습니다 (레벨 3부터 습득)'); return; }
    const opts = player.learned.map(sk=>{
      const slot = player.skills.indexOf(sk);
      return {
        l:sk.n + (slot>=0 ? ' [슬롯 '+(slot+2)+']' : ' [미장착]'),
        d:sk.d+' · 쿨다운 '+sk.cd+'초',
        fx:()=>{ setTimeout(()=>{ if (state==='playing') openSkillSwap(sk); }, 150); }
      };
    });
    opts.push({ l:'닫기', d:'게임으로 돌아간다', fx:null });
    openEvent({ t:'스킬북 ('+CLASSES[player.classKey].name+')', d:'배운 스킬을 눌러 슬롯 2~4에 배치할 수 있습니다.', opts });
  }
  // 슬롯이 가득 찼을 때: 새 스킬을 어디에 넣을지 선택
  function openSkillSwap(sk){
    const opts = player.skills.map((cur, i)=>({
      l:'슬롯 '+(i+2)+'번과 교체', d:'현재: ['+(cur?cur.n:'빈 슬롯')+'] → ['+sk.n+']',
      fx:()=>{ player.skills[i] = sk; player.skCds[i] = 0; toast('['+sk.n+'] 장착!'); SFX.play('equip'); }
    }));
    opts.push({ l:'배우기만 한다', d:'슬롯은 그대로 둔다', fx:null });
    openEvent({ t:'새 스킬: '+sk.n, d:sk.d+' (쿨다운 '+sk.cd+'초)', opts });
  }
  function pickUpgrade(i){
    if (state!=='levelup' || banishMode) return;
    const u = currentChoices[i];
    if (!u) return;
    u.apply();
    SFX.play(u.jackpot ? 'win' : 'pick');
    if (u.jackpot){ toast('잭팟! '+u.name); unlockAch('jackpot'); }
    closeLevelUp();
  }
  function doReroll(){
    if (state!=='levelup' || rerollsLeft<=0) return;
    rerollsLeft -= 1;
    currentChoices = rollUpgrades(player.cardSlots||6);
    renderCards();
    SFX.play('pick');
  }
  rerollBtn.addEventListener('click', (e)=>{ e.stopPropagation(); doReroll(); });
  skipBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if (state==='levelup') closeLevelUp(); });

  // ---------- 조사 이벤트 flow ----------
  function openEvent(ev){
    currentEvent = ev;
    state = 'event';
    titleText.innerHTML = '조사 <span class="lite">지점</span>';
    eventTitle.textContent = ev.t;
    eventDesc.style.whiteSpace = 'pre-line';
    eventDesc.style.textAlign = 'left';
    eventDesc.textContent = ev.d;
    eventCards.innerHTML = '';
    ev.opts.forEach((opt,i)=>{
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = '<div class="num">0'+(i+1)+'</div><div class="name">'+opt.l+'</div><div class="desc">'+opt.d+'</div>';
      el.addEventListener('click', ()=> pickEventChoice(i));
      eventCards.appendChild(el);
    });
    subText.style.display='none';
    classBox.style.display='none';
    shopBox.style.display='none'; equipBox.style.display='none'; questBox.style.display='none';
    mapRow.style.display='none';
    goldRow.style.display='none';
    resultBox.style.display='none';
    levelupBox.style.display='none';
    eventBox.style.display='flex';
    btn.style.display='none'; btn2.style.display='none';
    bestSub.style.display='none';
    overlay.classList.remove('hidden');
    SFX.play('beep');
  }
  function pickEventChoice(i){
    if (state!=='event' || !currentEvent) return;
    const opt = currentEvent.opts[i];
    if (!opt) return;
    if (opt.fx) opt.fx();
    currentEvent = null;
    overlay.classList.add('hidden');
    eventBox.style.display='none';
    setTimeout(()=>{ state='playing'; last=performance.now(); updateHud(); resumeGrace(); }, 120);
  }

  // ---------- 승천반 (J) — 런 내 전직 성반: 6방위 × [소석→사이드스톤→키스톤], 승천석으로 구매 ----------
  // 변형 방위는 직업 계열에 맞는 호환 효과를 자동 지급 (태그 충돌 원천 차단)
  const ASC_DIRS = [
    { n:'공격', c:'#c94f4f', nodes:[
      { n:'공세', d:'피해 +6%', cost:1, f:(p)=>{p.dmgMult*=1.06;} },
      { n:'맹공', d:'피해 +9%, 치명 +4%', cost:1, f:(p)=>{p.dmgMult*=1.09;p.critChance=Math.min(0.9,p.critChance+0.04);} },
      { n:'섬멸자', d:'[키스톤] 피해 +16%, 처형 임계 +5%p', cost:2, f:(p)=>{p.dmgMult*=1.16;p.execThresh=Math.min(0.5,(p.execThresh||0)+0.05);} } ] },
    { n:'연사', c:'#4c9a55', nodes:[
      { n:'속사', d:'공속 +6%', cost:1, f:(p)=>{p.rateMult*=1.06;} },
      { n:'과열 기관', d:'공속 +10%, 피해 -3%', cost:1, f:(p)=>{p.rateMult*=1.1;p.dmgMult*=0.97;} },
      { n:'폭주 엔진', d:'[키스톤] 공속 +16%, 추가 투사체 +10%', cost:2, f:(p)=>{p.rateMult*=1.16;p.multishotCh=(p.multishotCh||0)+0.10;} } ] },
    { n:'수비', c:'#3b82c4', nodes:[
      { n:'견갑', d:'받는 피해 -5%', cost:1, f:(p)=>{p.dmgTaken*=0.95;} },
      { n:'재생 조직', d:'재생 +0.6, 최대체력 +8%', cost:1, f:(p)=>{p.regen+=0.6;p.maxHp=Math.round(p.maxHp*1.08);p.hp=Math.min(p.maxHp,p.hp+15);} },
      { n:'불괴', d:'[키스톤] 받는 피해 -12%, 피격 무적 +0.2초', cost:2, f:(p)=>{p.dmgTaken*=0.88;p.hitInvuln=(p.hitInvuln||0)+0.2;} } ] },
    { n:'이동', c:'#8b5cf6', nodes:[
      { n:'질주', d:'이속 +6%', cost:1, f:(p)=>{p.speed*=1.06;} },
      { n:'잔상', d:'대시 쿨 -15%', cost:1, f:(p)=>{p.dashCdMax*=0.85;} },
      { n:'섬광 보법', d:'[키스톤] 이속 +10%, 대시 무적 +0.15초, 회피 +5%', cost:2, f:(p)=>{p.speed*=1.1;p.dashInvuln=(p.dashInvuln||0)+0.15;p.dodge=Math.min(0.75,p.dodge+0.05);} } ] },
    { n:'변형 · 무장', c:'#d9b23d', nodes:[
      { n:'무장 개조', d:'계열 맞춤: 근접=반사 +30% / 원거리=관통 +1 / 술법·지원=발동 +5%p', cost:1, f:(p)=>{
          const g=classResGroup(p.classKey);
          if (g==='war') p.thorns=(p.thorns||0)+0.3;
          else if (g==='rng'||g==='rog') p.pierce+=1;
          else p.procBonus=(p.procBonus||0)+0.05; } },
      { n:'무장 진화', d:'계열 맞춤 강화 (2중첩)', cost:1, f:(p)=>{
          const g=classResGroup(p.classKey);
          if (g==='war'){ p.thorns=(p.thorns||0)+0.4; p.dmgMult*=1.05; }
          else if (g==='rng'||g==='rog'){ p.critMult+=0.3; }
          else { p.cdr*=0.94; } } },
      { n:'무장 초월', d:'[키스톤] 근접=대시 학살 돌진 / 원거리=마탄 흡혈 / 술법·지원=이중 시전', cost:2, f:(p)=>{
          const g=classResGroup(p.classKey);
          if (g==='war') p.bloodRush=true;
          else if (g==='rng'||g==='rog') p.projLeech=true;
          else p.ultEcho=true;
          toast('⚜ 무장 초월 — 계열에 맞는 형태로 각인되었다'); } } ] },
    { n:'변형 · 이능', c:'#d9a53f', nodes:[
      { n:'이능 개화', d:'스킬 20% 확률 쿨 환급', cost:1, f:(p)=>{p.echoCast=true;} },
      { n:'이능 심화', d:'쿨다운 -8%', cost:1, f:(p)=>{p.cdr*=0.92;} },
      { n:'이능 해방', d:'[키스톤] 근접·지원=피격 신성 폭발 / 원거리·술법=대시 분신 사격', cost:2, f:(p)=>{
          const g=classResGroup(p.classKey);
          if (g==='war'||g==='pri'||g==='mer') p.holyRet=true;
          else p.shadowClone=true;
          toast('⚜ 이능 해방 — 계열에 맞는 형태로 각인되었다'); } } ] },
  ];
  // 승천반 2단계: 2차 전직 도달 시 외곽 링 개방 — 전직의 길을 심화하는 3방위 (계열 적응)
  const ASC_DIRS2 = [
    { n:'전직 극의', c:'#e8c56a', nodes:[
      { n:'극의 개방', d:'계열 극의: 근접=피해 +12%·반사 +30% / 원거리=치명 +8%·배율 +0.3 / 술법·지원=쿨 -10%·발동 +5%p', cost:2, f:(p)=>{
          const g=classResGroup(p.classKey);
          if (g==='war'){ p.dmgMult*=1.12; p.thorns=(p.thorns||0)+0.3; }
          else if (g==='rng'||g==='rog'){ p.critChance=Math.min(0.9,p.critChance+0.08); p.critMult+=0.3; }
          else { p.cdr*=0.9; p.procBonus=(p.procBonus||0)+0.05; } } },
      { n:'극의 완성', d:'[키스톤] 위 효과 재중첩 + 최대체력 +10%', cost:3, f:(p)=>{
          const g=classResGroup(p.classKey);
          if (g==='war'){ p.dmgMult*=1.12; p.thorns=(p.thorns||0)+0.3; }
          else if (g==='rng'||g==='rog'){ p.critChance=Math.min(0.9,p.critChance+0.08); p.critMult+=0.3; }
          else { p.cdr*=0.9; p.procBonus=(p.procBonus||0)+0.05; }
          p.maxHp=Math.round(p.maxHp*1.1); p.hp=Math.min(p.maxHp,p.hp+20); } } ] },
    { n:'심화 공세', c:'#c94f4f', nodes:[
      { n:'2차 공세', d:'피해 +8%, 공속 +5%', cost:2, f:(p)=>{p.dmgMult*=1.08;p.rateMult*=1.05;} },
      { n:'파멸의 정점', d:'[키스톤] 피해 +14%, 처형 +5%p', cost:3, f:(p)=>{p.dmgMult*=1.14;p.execThresh=Math.min(0.55,(p.execThresh||0)+0.05);} } ] },
    { n:'심화 수호', c:'#3b82c4', nodes:[
      { n:'2차 수호', d:'받는 피해 -6%, 재생 +0.5', cost:2, f:(p)=>{p.dmgTaken*=0.94;p.regen+=0.5;} },
      { n:'불멸의 정점', d:'[키스톤] 받는 피해 -10%, 회피 +5%', cost:3, f:(p)=>{p.dmgTaken*=0.9;p.dodge=Math.min(0.75,p.dodge+0.05);} } ] },
  ];
  // 각 방위 4단(상위 키스톤 ◈3) — 1차 성반의 연구 깊이 확장
  ASC_DIRS[0].nodes.push({ n:'학살 기계', d:'[상위 키스톤] 피해 +20%, 치명 배율 +0.4', cost:3, f:(p)=>{p.dmgMult*=1.2;p.critMult+=0.4;} });
  ASC_DIRS[1].nodes.push({ n:'무한 탄창', d:'[상위 키스톤] 공속 +14%, 추가 투사체 +12%', cost:3, f:(p)=>{p.rateMult*=1.14;p.multishotCh=(p.multishotCh||0)+0.12;} });
  ASC_DIRS[2].nodes.push({ n:'절대 요새', d:'[상위 키스톤] 받는 피해 -10%, 최대체력 +12%', cost:3, f:(p)=>{p.dmgTaken*=0.9;p.maxHp=Math.round(p.maxHp*1.12);p.hp=Math.min(p.maxHp,p.hp+25);} });
  ASC_DIRS[3].nodes.push({ n:'빛의 잔상', d:'[상위 키스톤] 이속 +8%, 대시 쿨 -15%, 회피 +4%', cost:3, f:(p)=>{p.speed*=1.08;p.dashCdMax*=0.85;p.dodge=Math.min(0.75,p.dodge+0.04);} });
  ASC_DIRS[4].nodes.push({ n:'무장 극한', d:'[상위 키스톤] 계열 극대화: 근접=반사 +60%·피해 +8% / 원거리=관통 +1·배율 +0.3 / 술법·지원=발동 +8%p', cost:3, f:(p)=>{
    const g=classResGroup(p.classKey);
    if (g==='war'){ p.thorns=(p.thorns||0)+0.6; p.dmgMult*=1.08; }
    else if (g==='rng'||g==='rog'){ p.pierce+=1; p.critMult+=0.3; }
    else { p.procBonus=(p.procBonus||0)+0.08; } } });
  ASC_DIRS[5].nodes.push({ n:'이능 극한', d:'[상위 키스톤] 쿨다운 -10%, 스킬 환급 확률 +10%p', cost:3, f:(p)=>{p.cdr*=0.9;p.echoBoost=true;} });
  // 3차 전직 링 (최외곽) — 정점의 연구
  const ASC_DIRS3 = [
    { n:'정점 일격', c:'#b8362e', nodes:[
      { n:'파국의 격', d:'[3차 키스톤] 피해 +18%, 처형 +6%p, 치명 +6%', cost:3, f:(p)=>{p.dmgMult*=1.18;p.execThresh=Math.min(0.6,(p.execThresh||0)+0.06);p.critChance=Math.min(0.9,p.critChance+0.06);} } ] },
    { n:'정점 불괴', c:'#4c6a9a', nodes:[
      { n:'불멸의 격', d:'[3차 키스톤] 받는 피해 -12%, 재생 +1, 피격 무적 +0.15초', cost:3, f:(p)=>{p.dmgTaken*=0.88;p.regen+=1;p.hitInvuln=(p.hitInvuln||0)+0.15;} } ] },
    { n:'정점 초월', c:'#8b5cf6', nodes:[
      { n:'초월의 격', d:'[3차 키스톤] 계열 초월: 근접=학살 돌진 / 원거리=분신 사격 / 술법·지원=이중 시전 (미보유 시)', cost:3, f:(p)=>{
        const g=classResGroup(p.classKey);
        if (g==='war') p.bloodRush=true;
        else if (g==='rng'||g==='rog') p.shadowClone=true;
        else p.ultEcho=true; } } ] },
  ];
  // 각성 문장 — 각성한 자만 밟는 마지막 한 수
  const ASC_AWAKEN = { n:'각성 문장', d:'[각성 전용] 모든 피해 +12%, 받는 피해 -6%, 최대체력 +8%', cost:4, f:(p)=>{p.dmgMult*=1.12;p.dmgTaken*=0.94;p.maxHp=Math.round(p.maxHp*1.08);p.hp=Math.min(p.maxHp,p.hp+20);} };
  // 길 성좌 공명: 성도에 그 길의 성좌를 찍어뒀다면, 런에서 그 길을 고르는 순간 가지 1단계 무료 개방
  function wayStarResonate(tier, ji){
    const g = classResGroup(player.classKey);
    const kits = JOBVAR[g]||[];
    const kit = kits[ji % kits.length];
    if (!kit) return;
    if (starHasName(kit.t+'의 길 성좌')){
      player.jobBr = player.jobBr||{};
      if (!player.jobBr[tier]){
        player.jobBr[tier] = 1;
        kit.f1(player, [1,1.4,1.9][tier-1]||1);
        toast('🌟 길 성좌 공명 — ['+kit.t+'의 길] 1단계 무료 개방');
        SFX.play('quest');
      }
    }
  }
  // 전직 선택지별 전용 가지: 어떤 전직을 골랐느냐에 따라 성반에 다른 가지가 자란다
  // (선택지 인덱스 × 계열)로 변형 키트가 결정 — 같은 직업이라도 다른 전직을 고르면 다른 노드
  const JOBVAR = {
    war:[
      { t:'공세', n1:'투지 단련', d1:'피해 +5%', f1:(p,m)=>{p.dmgMult*=1+0.05*m;}, n2:'맹공 오의', d2:'피해 +8%, 공속 +4%', f2:(p,m)=>{p.dmgMult*=1+0.08*m;p.rateMult*=1+0.04*m;}, n3:'파쇄 극의', d3:'피해 +12%, 처형 +4%p', f3:(p,m)=>{p.dmgMult*=1+0.12*m;p.execThresh=Math.min(0.6,(p.execThresh||0)+0.04*m);} },
      { t:'수호', n1:'견고 단련', d1:'받는 피해 -4%', f1:(p,m)=>{p.dmgTaken*=1-0.04*m;}, n2:'철벽 오의', d2:'받는 피해 -6%, 반사 +25%', f2:(p,m)=>{p.dmgTaken*=1-0.06*m;p.thorns=(p.thorns||0)+0.25*m;}, n3:'불괴 극의', d3:'받는 피해 -8%, 체력 +10%', f3:(p,m)=>{p.dmgTaken*=1-0.08*m;p.maxHp=Math.round(p.maxHp*(1+0.1*m));p.hp=Math.min(p.maxHp,p.hp+15);} },
      { t:'광폭', n1:'혈기 단련', d1:'공속 +5%', f1:(p,m)=>{p.rateMult*=1+0.05*m;}, n2:'광란 오의', d2:'공속 +8%, 피해 +5%', f2:(p,m)=>{p.rateMult*=1+0.08*m;p.dmgMult*=1+0.05*m;}, n3:'폭주 극의', d3:'피해 +14% / 받는 피해 +5%', f3:(p,m)=>{p.dmgMult*=1+0.14*m;p.dmgTaken*=1.05;} },
    ],
    rng:[
      { t:'속사', n1:'연사 단련', d1:'공속 +5%', f1:(p,m)=>{p.rateMult*=1+0.05*m;}, n2:'속사 오의', d2:'공속 +8%, 추가 투사체 +8%', f2:(p,m)=>{p.rateMult*=1+0.08*m;p.multishotCh=(p.multishotCh||0)+0.08*m;}, n3:'탄막 극의', d3:'추가 투사체 +15%, 공속 +6%', f3:(p,m)=>{p.multishotCh=(p.multishotCh||0)+0.15*m;p.rateMult*=1+0.06*m;} },
      { t:'관통', n1:'조준 단련', d1:'피해 +5%', f1:(p,m)=>{p.dmgMult*=1+0.05*m;}, n2:'관통 오의', d2:'관통 +1', f2:(p,m)=>{p.pierce+=1;}, n3:'저격 극의', d3:'관통 +1, 치명 배율 +0.4', f3:(p,m)=>{p.pierce+=1;p.critMult+=0.4*m;} },
      { t:'급소', n1:'표적 단련', d1:'치명 +4%', f1:(p,m)=>{p.critChance=Math.min(0.9,p.critChance+0.04*m);}, n2:'급소 오의', d2:'치명 +6%, 배율 +0.3', f2:(p,m)=>{p.critChance=Math.min(0.9,p.critChance+0.06*m);p.critMult+=0.3*m;}, n3:'필살 극의', d3:'치명 배율 +0.7', f3:(p,m)=>{p.critMult+=0.7*m;} },
    ],
    mag:[
      { t:'연산', n1:'집중 단련', d1:'쿨다운 -4%', f1:(p,m)=>{p.cdr*=1-0.04*m;}, n2:'가속 오의', d2:'쿨다운 -7%', f2:(p,m)=>{p.cdr*=1-0.07*m;}, n3:'시간 극의', d3:'쿨다운 -10%, 이속 +5%', f3:(p,m)=>{p.cdr*=1-0.1*m;p.speed*=1+0.05*m;} },
      { t:'원소', n1:'친화 단련', d1:'원소 발동 +4%p', f1:(p,m)=>{p.procBonus=(p.procBonus||0)+0.04*m;}, n2:'폭발 오의', d2:'원소 발동 +7%p', f2:(p,m)=>{p.procBonus=(p.procBonus||0)+0.07*m;}, n3:'재해 극의', d3:'원소 발동 +10%p, 피해 +6%', f3:(p,m)=>{p.procBonus=(p.procBonus||0)+0.10*m;p.dmgMult*=1+0.06*m;} },
      { t:'증폭', n1:'마력 단련', d1:'피해 +5%', f1:(p,m)=>{p.dmgMult*=1+0.05*m;}, n2:'증폭 오의', d2:'피해 +9%', f2:(p,m)=>{p.dmgMult*=1+0.09*m;}, n3:'붕괴 극의', d3:'피해 +14%', f3:(p,m)=>{p.dmgMult*=1+0.14*m;} },
    ],
    rog:[
      { t:'그림자', n1:'은신 단련', d1:'회피 +4%', f1:(p,m)=>{p.dodge=Math.min(0.75,p.dodge+0.04*m);}, n2:'환영 오의', d2:'회피 +6%, 대시 쿨 -10%', f2:(p,m)=>{p.dodge=Math.min(0.75,p.dodge+0.06*m);p.dashCdMax*=1-0.1*m;}, n3:'무영 극의', d3:'회피 +8%, 이속 +6%', f3:(p,m)=>{p.dodge=Math.min(0.78,p.dodge+0.08*m);p.speed*=1+0.06*m;} },
      { t:'급소', n1:'해부 단련', d1:'치명 +4%', f1:(p,m)=>{p.critChance=Math.min(0.9,p.critChance+0.04*m);}, n2:'맹독 오의', d2:'치명 +6%, 배율 +0.25', f2:(p,m)=>{p.critChance=Math.min(0.9,p.critChance+0.06*m);p.critMult+=0.25*m;}, n3:'일격 극의', d3:'치명 배율 +0.6', f3:(p,m)=>{p.critMult+=0.6*m;} },
      { t:'처형', n1:'낙인 단련', d1:'처형 +3%p', f1:(p,m)=>{p.execThresh=Math.min(0.6,(p.execThresh||0)+0.03*m);}, n2:'수확 오의', d2:'처형 +5%p, 처치 회복 +1', f2:(p,m)=>{p.execThresh=Math.min(0.6,(p.execThresh||0)+0.05*m);p.lifesteal+=1;}, n3:'사신 극의', d3:'처형 +8%p, 피해 +6%', f3:(p,m)=>{p.execThresh=Math.min(0.65,(p.execThresh||0)+0.08*m);p.dmgMult*=1+0.06*m;} },
    ],
    pri:[
      { t:'축복', n1:'기도 단련', d1:'회복 +12%', f1:(p,m)=>{p.healMult*=1+0.12*m;}, n2:'성수 오의', d2:'회복 +18%, 재생 +0.4', f2:(p,m)=>{p.healMult*=1+0.18*m;p.regen+=0.4*m;}, n3:'성역 극의', d3:'재생 +1, 체력 +10%', f3:(p,m)=>{p.regen+=1*m;p.maxHp=Math.round(p.maxHp*(1+0.1*m));p.hp=Math.min(p.maxHp,p.hp+15);} },
      { t:'수호', n1:'가호 단련', d1:'받는 피해 -4%', f1:(p,m)=>{p.dmgTaken*=1-0.04*m;}, n2:'방벽 오의', d2:'받는 피해 -6%, 체력 +6%', f2:(p,m)=>{p.dmgTaken*=1-0.06*m;p.maxHp=Math.round(p.maxHp*(1+0.06*m));p.hp=Math.min(p.maxHp,p.hp+10);}, n3:'헌신 극의', d3:'받는 피해 -9%', f3:(p,m)=>{p.dmgTaken*=1-0.09*m;} },
      { t:'심판', n1:'응징 단련', d1:'피해 +5%', f1:(p,m)=>{p.dmgMult*=1+0.05*m;}, n2:'천벌 오의', d2:'피해 +7%, 발동 +4%p', f2:(p,m)=>{p.dmgMult*=1+0.07*m;p.procBonus=(p.procBonus||0)+0.04*m;}, n3:'단죄 극의', d3:'피해 +12%, 발동 +5%p', f3:(p,m)=>{p.dmgMult*=1+0.12*m;p.procBonus=(p.procBonus||0)+0.05*m;} },
    ],
    mer:[
      { t:'재화', n1:'장부 단련', d1:'골드 +8%', f1:(p,m)=>{p.goldMult*=1+0.08*m;}, n2:'투자 오의', d2:'골드 +12%, 행운 +8%', f2:(p,m)=>{p.goldMult*=1+0.12*m;p.luck*=1+0.08*m;}, n3:'재벌 극의', d3:'골드 +18%, 피해 +5%', f3:(p,m)=>{p.goldMult*=1+0.18*m;p.dmgMult*=1+0.05*m;} },
      { t:'행운', n1:'감 단련', d1:'행운 +8%', f1:(p,m)=>{p.luck*=1+0.08*m;}, n2:'대박 오의', d2:'행운 +14%', f2:(p,m)=>{p.luck*=1+0.14*m;}, n3:'천운 극의', d3:'행운 +20%, 수집 +40', f3:(p,m)=>{p.luck*=1+0.2*m;p.magnet+=40;} },
      { t:'환전', n1:'셈 단련', d1:'피해 +5%', f1:(p,m)=>{p.dmgMult*=1+0.05*m;}, n2:'환전 오의', d2:'골드 +10%, 피해 +5%', f2:(p,m)=>{p.goldMult*=1+0.1*m;p.dmgMult*=1+0.05*m;}, n3:'황금 극의', d3:'골드가 곧 화력 (황금 혈맥)', f3:(p,m)=>{p.goldPower=true;} },
    ],
  };
  function renderAscJobBranches(){
    const box = $('ascJobs');
    if (!box || !player) return;
    box.innerHTML = '';
    const g = classResGroup(player.classKey);
    const kits = JOBVAR[g]||JOBVAR.war;
    (player.jobPicks||[]).forEach((pk, si)=>{
      if (!pk) return;
      const kit = kits[pk.v % kits.length];
      const m = [1, 1.4, 1.9][si] || 1;
      const stageN = si+1;
      const nodes = [
        { n:kit.n1, d:kit.d1, cost:1, f:(p)=>kit.f1(p,m) },
        { n:kit.n2, d:kit.d2, cost:2, f:(p)=>kit.f2(p,m) },
        { n:kit.n3, d:kit.d3, cost:2+si, f:(p)=>kit.f3(p,m) },
      ];
      player.jobBr = player.jobBr||{};
      const depth = player.jobBr[stageN]||0;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:6px; align-items:center; background:rgba(24,25,28,0.75); border:1px solid rgba(255,255,255,0.1); border-radius:9px; padding:6px 10px;';
      row.innerHTML = '<div style="min-width:120px; font-size:10.5px; color:#e8c56a;"><b>'+stageN+'차 · '+pk.n+'</b><br><span style="opacity:0.7; color:#aeb0b2;">['+kit.t+'의 길] '+depth+'/3</span></div>';
      nodes.forEach((nd, ni)=>{
        const state2 = ni<depth ? 'done' : (ni===depth ? 'next' : 'far');
        const b2 = document.createElement('button');
        b2.style.cssText = 'flex:1; min-width:0; padding:5px 6px; border-radius:7px; font-size:9.5px; line-height:1.25; cursor:pointer;'
          + 'background:'+(state2==='done'?'rgba(232,197,106,0.15)':'rgba(32,33,36,0.8)')+';'
          + 'color:'+(state2==='far'?'#5c5e61':'#e8e8e6')+';'
          + 'border:1.5px '+(state2==='done'?'solid #e8c56a':(state2==='next'?'dashed #9ecbe8':'dotted #4a4c50'))+';';
        b2.innerHTML = '<b>'+nd.n+'</b>'+(state2==='done'?' ✦':' ◈'+nd.cost);
        b2.addEventListener('mouseenter', ()=>{ if (ascInfo) ascInfo.innerHTML = '<b>'+nd.n+'</b> (◈'+nd.cost+') — '+nd.d+(state2==='far'?' · 앞 노드부터':''); });
        b2.addEventListener('click', ()=>{
          if (ni!==depth){ if (ascInfo) ascInfo.innerHTML = '<b>'+nd.n+'</b> — '+nd.d+(ni<depth?' (습득함)':' (앞 노드부터 습득)'); SFX.play('hit'); return; }
          const selKey = 'jb'+stageN+'_'+ni;
          if (IS_TOUCH && ascSel!==selKey){ ascSel=selKey; if (ascInfo) ascInfo.innerHTML='<b>'+nd.n+'</b> (◈'+nd.cost+') — '+nd.d+'<br><span style="opacity:0.7;">한 번 더 탭하면 습득</span>'; SFX.play('tele'); return; }
          ascSel = null;
          if ((player.ascStones||0) < nd.cost){ toast('승천석 부족 (◈'+nd.cost+')'); SFX.play('hit'); return; }
          player.ascStones -= nd.cost;
          player.jobBr[stageN] = depth+1;
          nd.f(player);
          toast('⚜ ['+pk.n+'] 가지 성장: '+nd.n);
          SFX.play('evolve');
          renderAscDial();
        });
        row.appendChild(b2);
      });
      box.appendChild(row);
    });
    if (!(player.jobPicks||[]).length){
      box.innerHTML = '<div style="text-align:center; font-size:10px; color:#8f9194;">전직을 하면 — 고른 전직마다 전용 가지가 여기에 자란다</div>';
    }
  }
  // 전직 문장 — 2차·3차 전직 순간 열리는 각인석: 내가 고른 전직의 이름이 그대로 새겨진다
  function ascSealEffect(p, stage){
    const g = classResGroup(p.classKey);
    if (stage===2){
      p.dmgMult *= 1.06;
      if (g==='war'){ p.thorns=(p.thorns||0)+0.25; }
      else if (g==='rng'||g==='rog'){ p.critChance=Math.min(0.9,p.critChance+0.05); }
      else { p.cdr*=0.95; }
    } else {
      p.dmgMult *= 1.08; p.maxHp = Math.round(p.maxHp*1.06); p.hp = Math.min(p.maxHp, p.hp+15);
      if (g==='war'){ p.dmgTaken*=0.95; }
      else if (g==='rng'||g==='rog'){ p.critMult+=0.3; }
      else { p.procBonus=(p.procBonus||0)+0.05; }
    }
  }
  const ascBoxEl = $('ascBox'), ascDial = $('ascDial'), ascInfo = $('ascInfo');
  let ascSel = null; // 터치 2탭: 첫 탭 = 정보 보기, 같은 버튼 재탭 = 습득
  function renderAscDial(){
    if (!ascDial || !player) return;
    ascDial.innerHTML = '';
    ascDial.style.width = '420px'; ascDial.style.height = '420px';
    const cx=210, cy=210;
    // 범용 링 렌더러 — 미개방 링도 잠긴 모습으로 항상 표시 (다음 목표가 보이게)
    function ring(dirs, takenKey, radius, size, offset, unlocked, unlockMsg){
      dirs.forEach((dir, di)=>{
        const a = -Math.PI/2 + di*(Math.PI*2/dirs.length) + offset;
        const bx = cx + Math.cos(a)*radius, by = cy + Math.sin(a)*radius;
        const arr = player[takenKey] = player[takenKey]||dirs.map(()=>0);
        const depth = arr[di]||0;
        const next = dir.nodes[depth];
        const done = !next;
        const btn = document.createElement('button');
        btn.style.cssText = 'position:absolute; left:'+(bx-size/2)+'px; top:'+(by-size/2)+'px; width:'+size+'px; height:'+size+'px; border-radius:50%;'
          + 'background:rgba(24,25,28,'+(unlocked?(done?'0.95':'0.75'):'0.45')+'); color:'+(unlocked?'#e8e8e6':'#5c5e61')+'; cursor:pointer;'
          + 'border:2px '+(unlocked?(done?'solid':'dashed'):'dotted')+' '+(unlocked?dir.c:'#4a4c50')+';'
          + 'font-size:'+(size>70?'10.5':'9')+'px; line-height:1.2; font-family:"IBM Plex Sans KR",sans-serif;'
          + (done&&unlocked?'box-shadow:0 0 12px '+dir.c+';':'');
        btn.innerHTML = unlocked
          ? '<b style="color:'+dir.c+';">'+dir.n+'</b><br>'+depth+'/'+dir.nodes.length+(done?'<br>✦':'<br>◈'+next.cost)
          : '🔒<br><span style="font-size:8px;">'+dir.n+'</span>';
        const showInfo = ()=>{ if (ascInfo) ascInfo.innerHTML = !unlocked
          ? '🔒 '+unlockMsg+' — 첫 스톤 미리보기: <b>'+dir.nodes[0].n+'</b> ('+dir.nodes[0].d+')'
          : (done ? '<b>'+dir.n+'</b> — 완성' : '<b>'+next.n+'</b> (◈'+next.cost+') — '+next.d
             + (IS_TOUCH?'<br><span style="opacity:0.7;">한 번 더 탭하면 습득</span>':'')); };
        btn.addEventListener('mouseenter', showInfo);
        btn.addEventListener('click', ()=>{
          if (!unlocked){ showInfo(); toast(unlockMsg); SFX.play('hit'); return; }
          const selKey = takenKey+'_'+di;
          if (IS_TOUCH && ascSel !== selKey){ ascSel = selKey; showInfo(); SFX.play('tele'); return; } // 터치: 첫 탭 = 정보
          ascSel = null;
          const dep = arr[di]||0;
          const nd = dir.nodes[dep];
          if (!nd){ SFX.play('hit'); return; }
          if ((player.ascStones||0) < nd.cost){ toast('승천석 부족 (◈'+nd.cost+')'); SFX.play('hit'); return; }
          player.ascStones -= nd.cost;
          arr[di] = dep+1;
          nd.f(player);
          toast('승천: ['+dir.n+'] '+nd.n);
          SFX.play('evolve');
          renderAscDial();
        });
        ascDial.appendChild(btn);
      });
    }
    ring(ASC_DIRS2, 'ascTaken2', 158, 58, Math.PI/6, player.jobs&&player.jobs.length>=2, '2차 전직에서 열린다');
    ring(ASC_DIRS3, 'ascTaken3', 196, 52, 0, player.jobs&&player.jobs.length>=3, '3차 전직에서 열린다');
    // 전직 문장 2·3차: 고른 전직의 이름이 새겨지는 각인석 (중앙 좌우 아래)
    [[2,'ascSeal2',-76],[3,'ascSeal3',76]].forEach(([stage, key, ox])=>{
      const unlocked = player.jobs && player.jobs.length>=stage;
      const taken = !!player[key];
      const jobName = unlocked ? (player.jobs[stage-1]||(stage+'차')) : stage+'차 전직';
      const cost = stage===2?2:3;
      const btn = document.createElement('button');
      btn.style.cssText = 'position:absolute; left:'+(cx+ox-27)+'px; top:'+(cy+72)+'px; width:54px; height:54px; border-radius:50%;'
        + 'background:rgba(26,30,40,'+(unlocked?'0.9':'0.45')+'); color:'+(unlocked?'#9ecbe8':'#5c5e61')+';'
        + 'border:2px '+(taken?'solid':'dashed')+' '+(unlocked?'#5a8cc8':'#4a4c50')+'; font-size:8.5px; cursor:pointer; line-height:1.2;'
        + (taken?'box-shadow:0 0 12px #5a8cc8;':'');
      btn.innerHTML = unlocked ? (taken?'✦<br>'+jobName:'📜<br>'+jobName+'<br>◈'+cost) : '🔒<br><span style="font-size:8px;">'+stage+'차 문장</span>';
      btn.addEventListener('mouseenter', ()=>{ if (ascInfo) ascInfo.innerHTML = !unlocked
        ? '🔒 '+stage+'차 전직 문장 — '+stage+'차 전직을 마치면 그 전직의 이름이 새겨진다'
        : (taken ? '<b>['+jobName+'] 문장</b> — 새겨짐' : '<b>['+jobName+'] 문장</b> (◈'+cost+') — 걷는 길을 각인: 피해 강화 + 계열 보너스'); });
      btn.addEventListener('click', ()=>{
        if (!unlocked){ toast(stage+'차 전직을 마쳐야 새길 수 있다'); SFX.play('hit'); return; }
        if (player[key]){ SFX.play('hit'); return; }
        const selKey = 'seal'+stage;
        if (IS_TOUCH && ascSel !== selKey){ ascSel = selKey; if (ascInfo) ascInfo.innerHTML = '<b>['+jobName+'] 문장</b> (◈'+cost+') — 한 번 더 탭하면 각인'; SFX.play('tele'); return; }
        ascSel = null;
        if ((player.ascStones||0) < cost){ toast('승천석 부족 (◈'+cost+')'); SFX.play('hit'); return; }
        player.ascStones -= cost;
        player[key] = true;
        ascSealEffect(player, stage);
        toast('📜 ['+jobName+'] 문장이 새겨졌다');
        SFX.play('evolve');
        renderAscDial();
      });
      ascDial.appendChild(btn);
    });
    // 각성 문장: 각성한 자만 — 중앙 위
    {
      const aw = ASC_AWAKEN;
      const unlocked = !!player.awakening;
      const taken = !!player.ascAwakenTaken;
      const btn = document.createElement('button');
      btn.style.cssText = 'position:absolute; left:'+(cx-27)+'px; top:'+(cy-96)+'px; width:54px; height:54px; border-radius:50%;'
        + 'background:rgba(30,26,40,'+(unlocked?'0.9':'0.45')+'); color:'+(unlocked?'#e8c56a':'#5c5e61')+';'
        + 'border:2px '+(taken?'solid':'dashed')+' '+(unlocked?'#e8c56a':'#4a4c50')+'; font-size:9px; cursor:pointer;'
        + (taken?'box-shadow:0 0 14px #e8c56a;':'');
      btn.innerHTML = unlocked ? (taken?'✦<br>각성 문장':'🌌<br>각성 문장<br>◈'+aw.cost) : '🔒<br><span style="font-size:8px;">각성 문장</span>';
      btn.addEventListener('mouseenter', ()=>{ if (ascInfo) ascInfo.innerHTML = unlocked ? (taken?'<b>각성 문장</b> — 새겨짐':'<b>'+aw.n+'</b> (◈'+aw.cost+') — '+aw.d) : '🔒 각성한 자만 새길 수 있다'; });
      btn.addEventListener('click', ()=>{
        if (!unlocked){ toast('각성한 자만 새길 수 있다'); SFX.play('hit'); return; }
        if (player.ascAwakenTaken){ SFX.play('hit'); return; }
        if ((player.ascStones||0) < aw.cost){ toast('승천석 부족 (◈'+aw.cost+')'); SFX.play('hit'); return; }
        player.ascStones -= aw.cost;
        player.ascAwakenTaken = true;
        aw.f(player);
        toast('🌌 각성 문장이 새겨졌다');
        SFX.play('evolve');
        renderAscDial();
      });
      ascDial.appendChild(btn);
    }
    const core = document.createElement('div');
    core.style.cssText = 'position:absolute; left:'+(cx-46)+'px; top:'+(cy-46)+'px; width:92px; height:92px; border-radius:50%;'
      + 'background:rgba(32,33,36,0.9); color:#e8e8e6; display:flex; flex-direction:column; align-items:center; justify-content:center;'
      + 'font-family:"IBM Plex Mono",monospace; font-size:11px; border:2px solid #8f9194;';
    core.innerHTML = '<div style="font-size:9px;opacity:0.7;">근본석</div><div>'+(player.jobs[0]||CLASSES[player.classKey].name)+'</div><div style="font-size:14px;">◈ '+(player.ascStones||0)+'</div>';
    ascDial.appendChild(core);
    ASC_DIRS.forEach((dir, di)=>{
      const a = -Math.PI/2 + di*(Math.PI*2/6);
      const bx = cx + Math.cos(a)*118, by = cy + Math.sin(a)*118;
      const depth = (player.ascTaken&&player.ascTaken[di])||0;
      const next = dir.nodes[depth];
      const done = !next;
      const btn = document.createElement('button');
      btn.style.cssText = 'position:absolute; left:'+(bx-42)+'px; top:'+(by-42)+'px; width:84px; height:84px; border-radius:50%;'
        + 'background:rgba(32,33,36,'+(done?'0.95':'0.75')+'); color:#e8e8e6; cursor:pointer;'
        + 'border:2.5px solid '+dir.c+'; font-size:10.5px; line-height:1.25; font-family:"IBM Plex Sans KR",sans-serif;'
        + (done?'box-shadow:0 0 14px '+dir.c+';':'');
      btn.innerHTML = '<b style="color:'+dir.c+';">'+dir.n+'</b><br>'+depth+'/'+dir.nodes.length + (done?'<br>✦완성':'<br>◈'+next.cost);
      btn.addEventListener('mouseenter', ()=>{ if (ascInfo) ascInfo.innerHTML = done ? '<b>'+dir.n+'</b> — 이 방위는 완성되었다' : '<b>'+next.n+'</b> (◈'+next.cost+') — '+next.d; });
      btn.addEventListener('click', ()=>{
        const dep = (player.ascTaken&&player.ascTaken[di])||0;
        const nd = dir.nodes[dep];
        if (!nd){ SFX.play('hit'); return; }
        const selKey = 'inner_'+di;
        if (IS_TOUCH && ascSel !== selKey){
          ascSel = selKey;
          if (ascInfo) ascInfo.innerHTML = '<b>'+nd.n+'</b> (◈'+nd.cost+') — '+nd.d+'<br><span style="opacity:0.7;">한 번 더 탭하면 습득</span>';
          SFX.play('tele');
          return;
        }
        ascSel = null;
        if ((player.ascStones||0) < nd.cost){ toast('승천석 부족 (◈'+nd.cost+' 필요)'); SFX.play('hit'); return; }
        player.ascStones -= nd.cost;
        player.ascTaken = player.ascTaken||[0,0,0,0,0,0];
        player.ascTaken[di] = dep+1;
        nd.f(player);
        toast('승천: ['+dir.n+'] '+nd.n);
        SFX.play('quest');
        renderAscDial();
      });
      ascDial.appendChild(btn);
    });
    renderAscJobBranches(); // 전직 선택지별 전용 가지
    // 모바일 맞춤: 다이얼이 화면보다 크면 통째로 축소 — 폰에서도 전체가 보이고 탭 가능
    const sc2 = Math.min(1, (window.innerWidth - 48) / 430);
    ascDial.style.transform = 'scale('+sc2+')';
    ascDial.style.transformOrigin = 'top center';
    ascDial.style.marginBottom = sc2<1 ? (-(420*(1-sc2)))+'px' : '0';
  }
  function openAsc(){
    if (state!=='playing' || !player) return;
    if (!player.jobs || !player.jobs.length){ toast('승천반은 1차 전직 후에 열린다'); return; }
    state = 'inv';
    renderAscDial();
    if (ascInfo) ascInfo.textContent = '방위를 클릭해 승천석을 사용하라 — 승천석은 레벨 3마다·보스 처치로 얻는다';
    ascBoxEl.style.display = 'flex';
    overlay.classList.remove('hidden');
  }
  const ascCB = $('ascCloseBtn');
  if (ascCB) ascCB.addEventListener('click', ()=>{ ascBoxEl.style.display='none'; closeInv(); });

  // ---------- 인게임 장비창 (I) ----------
  function openInv(){
    if (state!=='playing') return;
    state = 'inv';
    titleText.innerHTML = '장비 <span class="lite">(변경은 다음 런부터 적용)</span>';
    subText.style.display='none';
    mapRow.style.display='none';
    goldRow.style.display='none';
    classBox.style.display='none';
    shopBox.style.display='none'; questBox.style.display='none'; $('achBox').style.display='none'; $('starBox').style.display='none';
    levelupBox.style.display='none';
    eventBox.style.display='none';
    resultBox.style.display='none';
    btn.style.display='none'; btn2.style.display='none';
    bestSub.style.display='none';
    equipBox.style.display='flex';
    equipClassTab = player.classKey; // 인게임에서는 현재 직업 로드아웃 표시
    renderEquip();
    overlay.classList.remove('hidden');
  }
  function closeInv(){
    if (state!=='inv') return;
    overlay.classList.add('hidden');
    equipBox.style.display='none';
    const ab = $('ascBox'); if (ab) ab.style.display='none';
    state = 'playing';
    last = performance.now();
    resumeGrace();
  }
  // 모바일 보조 메뉴: 터치로 스킬북/테크/장비 열기 (키보드 없는 환경 대응)
  const mobK = $('mobKBtn'), mobT = $('mobTBtn'), mobI = $('mobIBtn');
  if (mobK) mobK.addEventListener('click', (e)=>{ e.stopPropagation(); if (state==='playing') openSkillBook(); });
  if (mobT) mobT.addEventListener('click', (e)=>{ e.stopPropagation(); if (state==='playing') openTechView(); });
  if (mobI) mobI.addEventListener('click', (e)=>{ e.stopPropagation(); if (state==='playing') openInv(); else if (state==='inv') closeInv(); });
  const mobJ = $('mobJBtn');
  if (mobJ) mobJ.addEventListener('click', (e)=>{ e.stopPropagation(); if (state==='playing') openAsc(); else if (state==='inv') closeInv(); });

  // ---------- NPC 의뢰인 (런 중 퀘스트) ----------
  let clients = [], clientCount = 0, runQuest = null;
  let pendingSkills = [], pendingAwaken = false, pendingJobs = [];
  let dailyPending = false, dailyRun = false, origRandom = Math.random;
  let waveModePending = true, waveModeRun = true, runFinalAt = 380, sprintWave = 0; // 기본 = 웨이브 모드
  function openClientQuest(){
    const D = player.dmgMult;
    const offers = [
      { l:'섬멸 의뢰', d:'60초 안에 40마리 처치 → 80G + 보물상자',
        q:{ type:'kill', goal:40, t:60, start:killCount, gold:80, chest:true } },
      { l:'열광 의뢰', d:'45초 안에 콤보 30 달성 → 100G',
        q:{ type:'combo', goal:30, t:45, gold:100, chest:false } },
      { l:'생존 의뢰', d:'40초 무피격 생존 → 보물상자 + 60G',
        q:{ type:'nohit', goal:0, t:40, gold:60, chest:true } },
    ];
    const pick2 = [];
    while (pick2.length<2 && offers.length){ pick2.push(offers.splice((Math.random()*offers.length)|0,1)[0]); }
    const opts = pick2.map(o=>({ l:o.l, d:o.d, fx:()=>{
      runQuest = o.q;
      runQuest.start = killCount;
      toast('의뢰 수락: '+o.l);
      SFX.play('quest');
    } }));
    opts.push({ l:'거절한다', d:'의뢰를 받지 않는다', fx:null });
    openEvent({ t:'수상한 의뢰인', d:'"부탁 하나 함세. 보수는 두둑히 주지."', opts });
  }
  // 떠돌이 대장장이 — 3단계 영구 퀘스트 (완주 시 무명검, 진행도는 런을 넘어 보존)
  function openGwQuest(){
    const st = DB.gwq.stage||0;
    if (st===0){
      openEvent({ t:'떠돌이 대장장이', d:'"...이름 없는 검을 좇는 눈이군. 세 가지를 증명하면 내 마지막 작품을 주지. 첫째 — 담금질."', opts:[
        { l:'담금질의 증명 (1/3)', d:'이번 런에서 1000마리 처치', fx:()=>{
            runQuest = { type:'gwkill', goal:1000, t:99999, gold:0, chest:false, start:killCount };
            toast('대장장이의 시험: 이번 런 1000처치'); SFX.play('quest');
          } },
        { l:'다음에 하겠다', d:'그는 연기처럼 사라질 것이다', fx:null },
      ]});
    } else if (st===1){
      openEvent({ t:'떠돌이 대장장이', d:'"살아 돌아왔군. 둘째 — 격(格)이다. 우두머리들의 피를 보여라."', opts:[
        { l:'격의 증명 (2/3)', d:'이번 런에서 보스 8기 처치', fx:()=>{
            runQuest = { type:'gwboss', goal:8, t:99999, gold:0, chest:false, bstart:(DB.prog.boss||0) };
            toast('대장장이의 시험: 이번 런 보스 8처치'); SFX.play('quest');
          } },
        { l:'다음에 하겠다', d:'...', fx:null },
      ]});
    } else {
      openEvent({ t:'떠돌이 대장장이', d:'"마지막이다. 위험도 15 이상의 세계를 완주해라. 그 끝에서 완성품을 건네지."', opts:[
        { l:'알겠다 (3/3)', d:'위험도 15+ 맵 클리어 시 무명검을 얻는다', fx:()=>{ toast('마지막 시험: 위험도 15+ 클리어'); } },
      ]});
    }
  }
  function tickRunQuest(dt){
    if (!runQuest) return;
    runQuest.t -= dt;
    let done = false, fail = false;
    if (runQuest.type==='kill'){
      if (killCount - runQuest.start >= runQuest.goal) done = true;
      else if (runQuest.t<=0) fail = true;
    } else if (runQuest.type==='combo'){
      if (combo >= runQuest.goal) done = true;
      else if (runQuest.t<=0) fail = true;
    } else if (runQuest.type==='nohit'){
      if (runQuest.t<=0) done = true; // 실패는 playerHit에서 처리
    } else if (runQuest.type==='gwkill'){
      if (killCount - runQuest.start >= runQuest.goal) done = true; // 실패 없음 — 런이 끝나면 무효
    } else if (runQuest.type==='gwboss'){
      if ((DB.prog.boss||0) - runQuest.bstart >= runQuest.goal) done = true;
    }
    if (done){
      if (runQuest.type==='gwkill' || runQuest.type==='gwboss'){
        DB.gwq.stage = (DB.gwq.stage||0)+1;
        saveDB();
        toast('⚒ 대장장이의 시험 통과 ('+DB.gwq.stage+'/3) — 그를 다시 만나야 한다');
        SFX.play('win');
        effects.push({ type:'rays', x:player.x, y:player.y, life:0.6, age:0 });
        runQuest = null;
        return;
      }
      questAdd('client', 1);
      const g = gainGold(runQuest.gold);
      addTextNum(player.x, player.y-30, '의뢰 완수! +'+g+'G');
      if (runQuest.chest) dropItem(player.x+40, player.y, 'chest');
      toast('의뢰 완수!');
      effects.push({ type:'rays', x:player.x, y:player.y, life:0.6, age:0 });
      SFX.play('win');
      runQuest = null;
    } else if (fail){
      toast('의뢰 실패...');
      SFX.play('hit');
      runQuest = null;
    }
  }

  // ---------- game flow ----------
  function showIdle(){
    state = 'idle';
    Math.random = origRandom; // 일일 시드 해제
    resize();
    resetWorld();
    draw(0);
    titleText.innerHTML = 'GRAYSCALE <span class="lite">// SURVIVOR v3</span>';
    subText.style.display='block';
    subText.innerHTML = '무한히 펼쳐지는 필드에서 버텨내세요. <b>무기 3개 + 테크트리(속성 3계열 제한)</b>로 빌드를 만들고,<br>장비·퀘스트로 강해진 뒤 <b>맵마다 기다리는 각성 최종보스</b>를 잡으면 클리어 — 다음 맵이 해금됩니다.<br><kbd>WASD</kbd> 이동 · <kbd>SPACE</kbd> 대시 · 필드의 <b>? 조사 지점</b>을 밟으면 선택 이벤트 · 폰은 드래그+대시 버튼';
    mapRow.style.display='flex';
    goldRow.style.display='flex';
    showPanel('class');
    resultBox.style.display='none';
    levelupBox.style.display='none';
    eventBox.style.display='none';
    btn.style.display='none'; btn2.style.display='none';
    bestSub.style.display='block';
    bestSub.textContent = DB.best[selMap] ? ('이 맵 최고 기록 ' + fmtTime(DB.best[selMap])) : '';
    checkHiddenUnlocks();
    renderMapRow();
    renderClassCards();
    overlay.classList.remove('hidden');
  }

  function startGame(classKey){
    if (!isClassUnlocked(classKey)) return;
    grabFocus();
    resize();
    // 일일 도전: 날짜 시드로 Math.random 고정 (같은 날 = 같은 전개)
    dailyRun = dailyPending;
    if (dailyRun){
      let seed = 0;
      const ds = todayStr();
      for (let i=0;i<ds.length;i++) seed = (seed*31 + ds.charCodeAt(i))|0;
      Math.random = mulberry32(seed);
    } else {
      Math.random = origRandom;
    }
    // 랜덤 출격: 해금된 맵 중 무작위
    const unlockedMaps = MAP_ORDER.filter(mapUnlocked);
    selMap = unlockedMaps[(Math.random()*unlockedMaps.length)|0];
    resetWorld();
    toast((dailyRun?'📅 일일 도전 — ':'')+'출격: '+MAP.name+' (위험도 '+(DB.peril||0)+')');
    player.classKey = classKey;
    DB.lastClass = classKey; saveDB(); // 직업 대성단 해금 기준 — 이 직업의 별을 밝힐 자격
    // 히든캐릭 파워 커브: 초반 유리형(강하게 시작→서서히 식음) vs 후반 왕귀형(약하게 시작→분마다 커짐)
    const CURVE_EARLY = ['glitch','contributor','exhero'];
    const CURVE_LATE = ['slime','collector','mumyeong','madman'];
    if (CURVE_EARLY.includes(classKey)){
      player.curveType='early';
      setTimeout(()=>toast('⏱ 초반 유리형 — 지금이 전성기다. 시간이 갈수록 서서히 식는다 (시작 피해 +12%)'), 1200);
    } else if (CURVE_LATE.includes(classKey)){
      player.curveType='late';
      setTimeout(()=>toast('🌙 후반 왕귀형 — 약하게 시작하지만 1분마다 강해진다 (시작 피해 -10%)'), 1200);
    }
    const cls = CLASSES[classKey];
    if (cls){
      cls.apply(player);
      if (cls.weapon==='random2' || cls.weapon==='random3'){
        // 무작위 무기 (기본 무기 풀에서)
        const keys = Object.keys(WEAPONS).filter(k=>!['fusion','gbow','gtome','gblade','nameless'].includes(k));
        const n3 = cls.weapon==='random3' ? 3 : 2;
        const picked = [];
        while (picked.length<n3){
          const k2 = keys[(Math.random()*keys.length)|0];
          if (!picked.includes(k2)) picked.push(k2);
        }
        picked.forEach(k2=>addWeapon(k2));
      } else {
        addWeapon(cls.weapon);
      }
    }
    // 무명자: 모든 직업 스킬 풀에서 무작위 4개 (레벨 3/8/15/25 재배정)
    if (player.randomSkills){
      const allSkills = [];
      for (const ck2 in SKILL_POOLS){ if (ck2!=='cheolhyeol') for (const sk2 of SKILL_POOLS[ck2]) allSkills.push(sk2); }
      const lvs = [3,8,15,25];
      player.customPool = [];
      for (let k=0;k<4 && allSkills.length;k++){
        const sk2 = allSkills.splice((Math.random()*allSkills.length)|0,1)[0];
        player.customPool.push(Object.assign({}, sk2, { lv:lvs[k] }));
      }
    }
    // 장비탭에서 장착한 유일·성장무기: 런 시작부터 들고 나간다
    const gwSel = loadoutFor(classKey).gw;
    const gwFound = { nameless: DB.growth.found, gbow: DB.gweps.bow.found, gtome: DB.gweps.tome.found, gblade: DB.gweps.blade.found };
    if (gwSel && gwFound[gwSel] && !ownedWeapon(gwSel)){
      addWeapon(gwSel);
      toast('장착 무기와 함께 출전: '+WEAPONS[gwSel].name);
    }
    applyEquipBonuses(player, classKey);
    applyStarBonuses(player);
    // 소모품 사용 (리롤 토큰·부활 보험)
    if (DB.consum.reroll>0){ rerollsLeft += DB.consum.reroll; DB.consum.reroll = 0; saveDB(); }
    if (DB.consum.revive>0){ player.reviveLeft += DB.consum.revive; DB.consum.revive = 0; saveDB(); }
    state = 'playing';
    overlay.classList.add('hidden');
    btn.style.display='none'; btn2.style.display='none';
    BGM.start();
    last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    openArcanaChoice(); // 런 계약 선택으로 시작
  }

  function bankRun(){
    DB.gold += runGold;
    // 운명 포인트: 도달 레벨 4당 1P
    const starGain = Math.floor(Math.min(player.level, player.winLevel||player.level)/6); // 운명 수급 하향 — 무한 모드 레벨 미산입
    if (starGain>0){
      DB.star.pts = (DB.star.pts||0) + starGain;
      toast('운명 포인트 +'+starGain+'P');
    }
    questAdd('survive', Math.floor(elapsed));
    if (DB.gold >= 5000) unlockAch('gold5k');
    if (elapsed >= 1200) unlockAch('survive20');
    const isNew = elapsed > (DB.best[selMap]||0);
    if (isNew) DB.best[selMap] = elapsed;
    saveDB();
    return isNew;
  }

  function endGame(){
    state = 'dead';
    shake = 14;
    const isNew = bankRun();
    setTimeout(()=>{
      titleText.innerHTML = 'TERMINATED';
      subText.style.display='none';
      mapRow.style.display='none';
      goldRow.style.display='none';
      classBox.style.display='none';
      shopBox.style.display='none'; equipBox.style.display='none'; questBox.style.display='none';
      levelupBox.style.display='none';
      eventBox.style.display='none';
      resultBox.style.display='flex';
      finalTime.textContent = fmtTime(elapsed);
      finalKills.textContent = killCount;
      finalLv.textContent = player.level;
      finalGold.textContent = runGold;
      $('finalDmg').textContent = totalDmg>=10000 ? (totalDmg/10000).toFixed(1)+'만' : totalDmg;
      newBestRow.style.display = isNew ? 'block' : 'none';
      btn.textContent = '다시 시작';
      btn.style.display='inline-block';
      btn2.style.display='inline-block';
      bestSub.style.display='block';
      bestSub.textContent = DB.best[selMap] ? ('이 맵 최고 기록 ' + fmtTime(DB.best[selMap])) : '';
      overlay.classList.remove('hidden');
    }, 420);
  }

  function winGame(){
    state = 'win';
    if (waveModeRun) unlockAch('wave1');
    player.winLevel = player.level; // 무한 모드에서 올린 레벨은 운명 포인트에 미산입
    const isNew = bankRun();
    const firstClear = !DB.mapCleared[selMap];
    DB.mapCleared[selMap] = true;
    unlockAch('clear_'+selMap);
    DB.star.pts = (DB.star.pts||0) + 3; // 일반 클리어는 기본 3P — 큰 별은 관문에서 쏟아진다
    toast('클리어 보너스: 운명 포인트 +3P');
    // 대장장이 최종 시험: 위험도 15+ 완주 → 무명검
    if (DB.gwq && DB.gwq.stage===2 && (DB.peril||0)>=15 && !DB.growth.found){
      DB.gwq.stage = 3;
      DB.growth.found = true;
      toast('⚒ "약속은 지킨다." — 무명검이 손에 들어왔다');
      SFX.play('evolve');
    }
    // 위험도 해금: 현재 위험도로 클리어 시 다음 단계 개방
    if ((DB.peril||0) >= (DB.perilMax||0) && (DB.perilMax||0) < 60){
      DB.perilMax = (DB.perilMax||0) + 1;
      toast('위험도 '+DB.perilMax+' 해금!');
    }
    if ((DB.peril||0) >= 5) unlockAch('peril5');
    if ((DB.peril||0) >= 10) unlockAch('peril10');
    if ((DB.peril||0) >= 20) unlockAch('peril20');
    if (MAP_ORDER.every(k=>DB.mapCleared[k])) unlockAch('allmaps');
    saveDB();
    runGold = 0;
    SFX.play('win');
    setTimeout(()=>{
      titleText.innerHTML = 'ACCESS <span class="lite">GRANTED</span>';
      subText.style.display='block';
      const nextIdx = MAP_ORDER.indexOf(selMap)+1;
      const nextMap = nextIdx < MAP_ORDER.length ? MAPS[MAP_ORDER[nextIdx]] : null;
      subText.innerHTML = '각성한 최종 보스를 쓰러뜨렸습니다. <b>'+MAP.name+' 클리어!</b>'
        + (firstClear && nextMap ? '<br>★ 새로운 맵 <b>'+nextMap.name+'</b> 해금! ★' : '')
        + '<br>계속 진행하면 더 강한 무한 모드가 이어집니다.';
      mapRow.style.display='none';
      goldRow.style.display='none';
      classBox.style.display='none';
      shopBox.style.display='none'; equipBox.style.display='none'; questBox.style.display='none';
      levelupBox.style.display='none';
      eventBox.style.display='none';
      resultBox.style.display='flex';
      finalTime.textContent = fmtTime(elapsed);
      finalKills.textContent = killCount;
      finalLv.textContent = player.level;
      finalGold.textContent = runGold;
      $('finalDmg').textContent = totalDmg>=10000 ? (totalDmg/10000).toFixed(1)+'만' : totalDmg;
      newBestRow.style.display = isNew ? 'block' : 'none';
      btn.textContent = '무한 모드 계속';
      btn.style.display='inline-block';
      btn2.style.display='inline-block';
      bestSub.style.display='none';
      overlay.classList.remove('hidden');
    }, 500);
  }

  btn.addEventListener('click', (e)=>{
    e.stopPropagation(); grabFocus();
    if (state==='win'){
      endless = true;
      toast('♾ 무한 모드 — 보상 체감 적용 (골드 -70%, 상위 장비·재료 봉인, 운명 포인트 미산입)');
      state = 'playing';
      overlay.classList.add('hidden');
      resultBox.style.display='none';
      btn.style.display='none'; btn2.style.display='none';
      last = performance.now();
    } else {
      showIdle();
    }
  });
  btn.addEventListener('pointerdown', (e)=> e.stopPropagation());
  btn2.addEventListener('click', (e)=>{ e.stopPropagation(); grabFocus(); showIdle(); });
  btn2.addEventListener('pointerdown', (e)=> e.stopPropagation());

  // 결과 공유 (Wordle식 성적표 복사 — 친구들과 기록 경쟁)
  const shareBtn = document.createElement('button');
  shareBtn.className = 'miniBtn';
  shareBtn.textContent = '📋 결과 복사';
  shareBtn.style.display = 'none';
  resultBox.parentNode.insertBefore(shareBtn, resultBox.nextSibling);
  shareBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const cleared = state==='win' ? '✅ 클리어' : '💀 사망';
    const txt = 'GRAYSCALE//SURVIVOR '+cleared
      + (dailyRun ? '\n📅 일일 도전 '+todayStr() : '')
      + '\n🗺 '+MAP.name+' · 위험도 '+(DB.peril||0)
      + '\n⏱ '+fmtTime(elapsed)+' · ⚔ '+killCount+'킬 · Lv'+player.level
      + '\n💥 총 피해 '+(totalDmg>=10000?(totalDmg/10000).toFixed(1)+'만':totalDmg)
      + '\n▶ https://daneweb.github.io/game/';
    try{
      navigator.clipboard.writeText(txt);
      toast('결과가 복사됐다 — 친구에게 자랑하자!');
      SFX.play('coin');
    }catch(err){ toast('복사 실패'); }
  });
  // 결과 화면에서만 표시
  const _origEndFlow = { show:()=>{ shareBtn.style.display='inline-block'; }, hide:()=>{ shareBtn.style.display='none'; } };
  new MutationObserver(()=>{
    shareBtn.style.display = (resultBox.style.display==='flex') ? 'inline-block' : 'none';
  }).observe(resultBox, { attributes:true, attributeFilter:['style'] });

  // 이스터에그: 타이틀 로고 10회 클릭
  titleText.addEventListener('click', ()=>{
    if (state!=='idle' || DB.egg1) return;
    window.__logoClicks = (window.__logoClicks||0)+1;
    if (window.__logoClicks>=10){
      DB.egg1 = true;
      DB.gold += 100;
      saveDB();
      toast('이스터에그 발견! +100G');
      SFX.play('win');
      goldVal.textContent = DB.gold;
    }
  });

  // ---------- drawing: world ----------
  function hash2(ix, iy){
    let h = ix*374761393 + iy*668265263;
    h = (h ^ (h>>13)) * 1274126177;
    return ((h ^ (h>>16)) >>> 0) / 4294967295;
  }
  function drawGrid(){
    ctx.save();
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    const step = 34;
    const x0 = Math.floor((player.x-W/2)/step)*step;
    const y0 = Math.floor((player.y-H/2)/step)*step;
    for (let x=x0; x<player.x+W/2+step; x+=step){
      ctx.beginPath(); ctx.moveTo(x, player.y-H/2); ctx.lineTo(x, player.y+H/2); ctx.stroke();
    }
    for (let y=y0; y<player.y+H/2+step; y+=step){
      ctx.beginPath(); ctx.moveTo(player.x-W/2, y); ctx.lineTo(player.x+W/2, y); ctx.stroke();
    }
    // 지역 명암 패치 — 큰 단위로 미묘한 톤 변화를 줘서 이동감을 살린다
    const zone = 380;
    const zx0 = Math.floor((player.x-W/2)/zone), zx1 = Math.ceil((player.x+W/2)/zone);
    const zy0 = Math.floor((player.y-H/2)/zone), zy1 = Math.ceil((player.y+H/2)/zone);
    for (let zx=zx0; zx<=zx1; zx++){
      for (let zy=zy0; zy<=zy1; zy++){
        const zh = hash2(zx*13+7, zy*17+3);
        if (zh > 0.28) continue;
        ctx.fillStyle = MAP.key==='abyss' ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.022)';
        ctx.beginPath();
        ctx.ellipse(zx*zone+zone/2, zy*zone+zone/2, zone*0.62, zone*0.5, zh*6, 0, Math.PI*2);
        ctx.fill();
      }
    }
    // 맵별 장식 소품 (결정적 해시로 배치)
    const cell = 190;
    const cx0 = Math.floor((player.x-W/2)/cell), cx1 = Math.ceil((player.x+W/2)/cell);
    const cy0 = Math.floor((player.y-H/2)/cell), cy1 = Math.ceil((player.y+H/2)/cell);
    ctx.fillStyle = PAL.deco;
    ctx.strokeStyle = PAL.deco;
    for (let cx=cx0; cx<=cx1; cx++){
      for (let cy=cy0; cy<=cy1; cy++){
        const h = hash2(cx,cy);
        if (h > 0.30) continue;
        const px = cx*cell + hash2(cx+7,cy)*cell;
        const py = cy*cell + hash2(cx,cy+7)*cell;
        if (MAP.key==='field'){
          ctx.fillRect(px-1.5, py-8, 3, 16);
          ctx.fillRect(px-8, py-1.5, 16, 3);
        } else if (MAP.key==='archive'){
          ctx.fillRect(px-12, py-16, 24, 32);
          ctx.lineWidth = 1;
          ctx.strokeRect(px-12, py-16, 24, 32);
          for (let k=1;k<4;k++){ ctx.fillRect(px-10, py-16+k*8, 20, 1.5); }
        } else {
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px-14, py); ctx.lineTo(px, py); ctx.lineTo(px, py-14);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py-14, 2.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px-14, py, 2.5, 0, Math.PI*2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  let radarAngle = 0;
  function drawRadar(dt){
    radarAngle += dt*0.6;
    const R2 = Math.max(W,H);
    ctx.save();
    const grad = ctx.createLinearGradient(player.x, player.y, player.x+Math.cos(radarAngle)*R2, player.y+Math.sin(radarAngle)*R2);
    grad.addColorStop(0, MAP.key==='abyss' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(player.x, player.y, R2, radarAngle-0.35, radarAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }
  function drawShadow(x, y, rx){
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx*0.35, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 인간형 캐릭터 ----------
  // 옆모습 치비: 다리(걷기 스윙) + 몸통 + 머리 + 직업 장비
  function drawHumanoid(x, y, o){
    const s = o.scale||1;
    const face = o.face||1;
    const ink = o.ink || PAL.ink;
    const walk = o.walk||0;
    const swing = Math.sin(walk)*3.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face*s, s);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = 'round';

    if (o.robe){
      // 로브 (사신 등): 다리 대신 펄럭이는 자락
      ctx.beginPath();
      ctx.moveTo(-5,-5);
      ctx.lineTo(5,-5);
      ctx.lineTo(7,12+Math.sin(walk)*1.5);
      ctx.lineTo(2,10);
      ctx.lineTo(-3,12-Math.sin(walk)*1.5);
      ctx.lineTo(-7,10);
      ctx.closePath();
      ctx.fill();
    } else {
      // legs
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(-1,4); ctx.lineTo(-2+swing, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1,4); ctx.lineTo(2-swing, 12); ctx.stroke();
      // body
      roundRect(-4.5,-6,9,11,3);
      ctx.fill();
    }
    // head
    ctx.beginPath(); ctx.arc(1,-11,5.6,0,Math.PI*2); ctx.fill();
    // eye
    ctx.fillStyle = MAP.key==='abyss' ? '#232427' : '#f6f6f4';
    ctx.beginPath(); ctx.arc(3.4,-11.6,1.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = ink;

    const g = o.gear;
    ctx.lineWidth = 2;
    if (g==='manager'){
      ctx.beginPath(); ctx.moveTo(-5,-15); ctx.lineTo(7,-15); ctx.lineTo(2,-25); ctx.closePath(); ctx.fill();
      ctx.fillRect(-7,-16.5,14,2.5);
      ctx.beginPath(); ctx.moveTo(7,-2); ctx.lineTo(7,-20); ctx.stroke();
      ctx.beginPath(); ctx.arc(7,-21.5,2.6,0,Math.PI*2); ctx.fill();
    } else if (g==='sniper'){
      ctx.fillRect(-5,-17,11,3);
      ctx.fillRect(3,-17,6,2);
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(2,-2); ctx.lineTo(16,-4); ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(9,-3.4); ctx.lineTo(9,0); ctx.stroke();
    } else if (g==='rusher'){
      ctx.beginPath(); ctx.arc(1,-13,6.2,Math.PI,0); ctx.fill();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(5,-1); ctx.lineTo(16,-8); ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(7.5,-5.5); ctx.lineTo(10,-1.5); ctx.stroke();
    } else if (g==='archer'){
      ctx.beginPath(); ctx.arc(0,-12,6.4,Math.PI*0.9,Math.PI*0.1); ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(10,-9); ctx.quadraticCurveTo(15,-2,10,5); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10,-9); ctx.lineTo(10,5); ctx.stroke();
    } else if (g==='ninja'){
      ctx.fillRect(-5,-14,12,2.6);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-5,-13); ctx.quadraticCurveTo(-11,-11+Math.sin(walk*2)*2,-13,-8); ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(4,0); ctx.lineTo(11,-3); ctx.stroke();
    } else if (g==='engineer'){
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-1,-13,2.4,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(4,-13.4,2.4,0,Math.PI*2); ctx.stroke();
      roundRect(-9,-6,4,9,1.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-7,-6); ctx.lineTo(-7,-16); ctx.stroke();
      ctx.beginPath(); ctx.arc(-7,-17.5,1.8,0,Math.PI*2); ctx.fill();
    } else if (g==='paladin'){
      ctx.beginPath(); ctx.arc(1,-12,6.6,Math.PI*0.95,Math.PI*0.05); ctx.fill();
      ctx.fillRect(-1,-19,4,4);
      ctx.save();
      ctx.translate(10,-1);
      roundRect(-3,-6,6,12,3);
      ctx.fill();
      ctx.strokeStyle = MAP.key==='abyss' ? '#232427' : '#f6f6f4';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0,-3.5); ctx.lineTo(0,3.5); ctx.stroke();
      ctx.restore();
    } else if (g==='reaper'){
      ctx.beginPath(); ctx.arc(0,-12,6.8,Math.PI*0.85,Math.PI*0.15); ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(6,6); ctx.lineTo(12,-18); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(12,-18); ctx.quadraticCurveTo(4,-24,-1,-20); ctx.stroke();
    } else if (g==='pilot'){
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(1,-12,6.4,Math.PI,0); ctx.stroke();
      ctx.fillRect(-5.4,-13,3,4);
      ctx.fillRect(4.6,-13,3,4);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(5.5,-10); ctx.quadraticCurveTo(8,-8,7,-6); ctx.stroke();
    } else if (g==='glitch'){
      // 지지직거리는 노이즈 파편
      for (let k=0;k<3;k++){
        const gx = (Math.random()-0.5)*16, gy = -6+(Math.random()-0.5)*16;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(gx, gy, 4+Math.random()*4, 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(-7,-12+Math.sin(performance.now()/90)*3, 3, 2);
    } else if (g==='returner'){
      // 후드 + 회중시계
      ctx.beginPath(); ctx.arc(0,-12,6.8,Math.PI*0.85,Math.PI*0.15); ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(8,0,3.4,0,Math.PI*2); ctx.stroke();
      const ca = performance.now()/500;
      ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(8+Math.cos(ca)*2.4, Math.sin(ca)*2.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5,-4); ctx.quadraticCurveTo(6,-2,8,-3.2); ctx.stroke();
    } else if (g==='debug'){
      // 깜빡이는 커서 + 괄호
      if (Math.floor(performance.now()/400)%2===0){
        ctx.fillRect(6,-16,4,8);
      }
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-7,-16); ctx.lineTo(-10,-12); ctx.lineTo(-7,-8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(11,-16); ctx.lineTo(14,-12); ctx.lineTo(11,-8); ctx.stroke();
    } else if (g==='cheol'){
      // 풀페이스 투구 + 어깨 갑주
      ctx.beginPath(); ctx.arc(1,-11,6.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = MAP.key==='abyss' ? '#232427' : '#f6f6f4';
      ctx.fillRect(2,-12.5,4.5,2);
      ctx.fillStyle = ink;
      roundRect(-8,-7,6,5,2); ctx.fill();
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(6,1); ctx.lineTo(15,-10); ctx.stroke();
    } else if (g==='voidc'){
      // 눈 가린 두건 + 부유하는 공허 구슬
      ctx.beginPath(); ctx.arc(0,-12,6.6,Math.PI*0.9,Math.PI*0.1); ctx.fill();
      ctx.fillRect(-4.5,-12.5,11,2.6);
      const va2 = performance.now()/300;
      ctx.beginPath(); ctx.arc(9+Math.cos(va2)*2, -16+Math.sin(va2)*2, 3, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(9+Math.cos(va2)*2, -16+Math.sin(va2)*2, 5.4, 0, Math.PI*2); ctx.stroke();
    } else if (g==='necro'){
      // 목자의 챙 넓은 모자 + 랜턴 지팡이
      ctx.fillRect(-9,-14.5,20,2.4);
      ctx.beginPath(); ctx.moveTo(-4,-14.5); ctx.lineTo(1,-21); ctx.lineTo(6,-14.5); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8,6); ctx.lineTo(8,-14); ctx.stroke();
      ctx.strokeRect(6.4,-19,3.2,4);
      if (Math.floor(performance.now()/500)%2===0){
        ctx.fillRect(7,-18,2,2);
      }
    } else if (g==='bard'){
      // 깃털 모자 + 류트
      ctx.beginPath(); ctx.arc(1,-13,6,Math.PI,0); ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(5,-16); ctx.quadraticCurveTo(10,-22,13,-19); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(9,0,4,5.5,-0.5,0,Math.PI*2); ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(11,-4); ctx.lineTo(14,-9); ctx.stroke();
    }
    ctx.restore();
  }

  // 직업 악센트 컬러 — 목도리와 전용기 링에 반영
  const CLASS_COLORS = {
    manager:'#8b5cf6', sniper:'#3b82c4', rusher:'#c94f4f', archer:'#4c9a55',
    ninja:'#6d5cc4', engineer:'#d9a53f', paladin:'#d9b23d', reaper:'#7a4fa8',
    pilot:'#4fa8c4', glitch:'#3aa895', returner:'#e08a2e',
    cheol:'#a8433c', voidc:'#5c4a8a', necro:'#6a8a7a', bard:'#c9895a', debug:'#3aa895',
    tourist:'#e0a94f', slime:'#5db06a', gambler:'#c94f8a', collector:'#8a6a4f', contributor:'#d9a53f',
    baeksu:'#9aa0a6', blackcat:'#3a3b40', stonks:'#3fa85f', gymbro:'#c96a3f', exhero:'#b8a03f', shadow:'#55486a',
    madman:'#c9403a', monk:'#b8956a', commander:'#4a6a8a', tombraider:'#8a7a4f', mumyeong:'#7a7a82'
  };
  function drawPlayerChar(){
    drawShadow(player.x, player.y+15, 11);
    const moving = Math.hypot(player.vx,player.vy) > 10 || player.dashTime>0;
    const walk = moving ? performance.now()/70 : 0;
    if (player.invuln>0 && Math.floor(performance.now()/90)%2===0){
      ctx.globalAlpha = 0.5;
    }
    // 슬라임: 체력이 높을수록 몸집이 커진다
    const bodyScale = player.slimeBody ? Math.min(2.0, 1.15 + player.maxHp/800) : 1.15;
    // 장비 외형: 망토는 몸 뒤에 (희귀도 색)
    const RARITY_TINT = ['#8f9194','#4c9a55','#3b82c4','#8b5cf6','#e08a2e','#b8362e','#d9a53f'];
    const lo0 = loadoutFor(player.classKey);
    const eqItem = (slot)=>{ const id=lo0[slot]; return id ? DB.inv.find(i=>i.id===id) : null; };
    const cloakIt = eqItem('cloak');
    if (cloakIt){
      ctx.save();
      ctx.fillStyle = RARITY_TINT[cloakIt.r]||'#8f9194';
      ctx.globalAlpha = 0.85;
      const flap = Math.sin(performance.now()/160)*2.5 + (moving?2:0);
      ctx.beginPath();
      ctx.moveTo(player.x-4, player.y-8);
      ctx.lineTo(player.x+4, player.y-8);
      ctx.lineTo(player.x+6-player.faceX*8, player.y+13+flap*0.4);
      ctx.lineTo(player.x-player.faceX*11, player.y+9+flap);
      ctx.lineTo(player.x-6-player.faceX*8, player.y+13-flap*0.4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    drawHumanoid(player.x + (player.recoilX||0), player.y + (player.recoilY||0), { face:player.faceX, walk, gear:player.classKey, scale:bodyScale, robe:player.classKey==='reaper' });
    // 장비 외형: 투구 밴드 / 흉갑 라인 (희귀도 색)
    const headIt = eqItem('head');
    if (headIt){
      ctx.fillStyle = RARITY_TINT[headIt.r]||'#8f9194';
      ctx.fillRect(player.x-6, player.y-19, 12, 2.6);
      if (headIt.r>=4){ ctx.fillRect(player.x-1.2, player.y-23, 2.4, 4); } // 상급: 깃 장식
    }
    const bodyIt = eqItem('body');
    if (bodyIt){
      ctx.strokeStyle = RARITY_TINT[bodyIt.r]||'#8f9194';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(player.x-5, player.y-1); ctx.lineTo(player.x+5, player.y-1); ctx.stroke();
      if (bodyIt.wt==='heavy'){ // 중갑: 어깨 패드
        ctx.fillStyle = RARITY_TINT[bodyIt.r];
        ctx.fillRect(player.x-8.5, player.y-8, 3.4, 3); ctx.fillRect(player.x+5.1, player.y-8, 3.4, 3);
      }
    }
    // 직업 목도리
    const cc = CLASS_COLORS[player.classKey];
    if (cc){
      ctx.fillStyle = cc;
      ctx.fillRect(player.x-6, player.y-7, 12, 3);
      ctx.beginPath();
      ctx.moveTo(player.x-6, player.y-6);
      ctx.lineTo(player.x-10-player.faceX*2, player.y+1+Math.sin(performance.now()/150)*2);
      ctx.lineTo(player.x-5, player.y-3);
      ctx.closePath(); ctx.fill();
    }
    // 칭호: 머리 위에 금빛으로 떠오른다
    if (player.comboTitle){
      ctx.save();
      const tp = 0.75 + 0.25*Math.sin(performance.now()/400);
      ctx.globalAlpha = tp;
      ctx.font = "700 9.5px 'IBM Plex Sans KR', sans-serif";
      ctx.textAlign = 'center';
      const de2 = dominantElemColor();
      ctx.fillStyle = de2 || '#d9a53f';
      ctx.shadowColor = de2 || '#d9a53f';
      ctx.shadowBlur = 6;
      ctx.fillText('『'+player.comboTitle+'』', player.x, player.y - 36);
      ctx.restore();
    }
    // 전직 표식: 1차 이상 = 머리 위 별, 2차 이상 = 별 2개
    if (player.jobs && player.jobs.length>0 && cc){
      ctx.fillStyle = cc;
      const starN = Math.min(2, player.jobs.length);
      for (let k=0;k<starN;k++){
        const sx = player.x + (starN===1 ? 0 : (k===0?-5:5));
        const sy = player.y - 26 + Math.sin(performance.now()/300 + k)*1.5;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(performance.now()/900);
        ctx.beginPath();
        for (let s2=0;s2<4;s2++){ const a2=(Math.PI/2)*s2; ctx.lineTo(Math.cos(a2)*3.4, Math.sin(a2)*3.4); ctx.lineTo(Math.cos(a2+Math.PI/4)*1.4, Math.sin(a2+Math.PI/4)*1.4); }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // 각성 오라: 발밑 맥동 링 (직업색)
    if (player.awakening && cc){
      const ap = 0.35 + 0.2*Math.sin(performance.now()/220);
      ctx.strokeStyle = cc;
      ctx.globalAlpha = ap;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(player.x, player.y+15, 16+Math.sin(performance.now()/220)*2, 6, 0, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 에고 무기 말풍선 — 검(오른손 쪽)에서 직접 말한다
    if (egoBubble && ownedWeapon('nameless')){
      const alpha = Math.min(1, egoBubble.t / 0.6);
      const bx = player.x + player.faceX*14, by = player.y - 30;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "500 10.5px 'IBM Plex Sans KR', sans-serif";
      // 줄바꿈 (한 줄 최대 ~18자)
      const words = egoBubble.text;
      const lines = [];
      for (let i2=0;i2<words.length;i2+=18) lines.push(words.slice(i2,i2+18));
      const bw2 = Math.min(200, Math.max(...lines.map(l=>ctx.measureText(l).width)) + 16);
      const bh2 = lines.length*14 + 10;
      const dark = MAP.key==='abyss';
      ctx.fillStyle = dark ? 'rgba(35,36,42,0.94)' : 'rgba(255,255,255,0.94)';
      ctx.strokeStyle = dark ? '#8f9194' : '#45474a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const rx = bx - bw2/2, ry = by - bh2;
      ctx.moveTo(rx+7, ry);
      ctx.lineTo(rx+bw2-7, ry); ctx.quadraticCurveTo(rx+bw2, ry, rx+bw2, ry+7);
      ctx.lineTo(rx+bw2, ry+bh2-7); ctx.quadraticCurveTo(rx+bw2, ry+bh2, rx+bw2-7, ry+bh2);
      ctx.lineTo(bx+6, ry+bh2); ctx.lineTo(bx+player.faceX*3, ry+bh2+7); ctx.lineTo(bx-6, ry+bh2); // 꼬리 → 검 방향
      ctx.lineTo(rx+7, ry+bh2); ctx.quadraticCurveTo(rx, ry+bh2, rx, ry+bh2-7);
      ctx.lineTo(rx, ry+7); ctx.quadraticCurveTo(rx, ry, rx+7, ry);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark ? '#e8e8e6' : '#202124';
      ctx.textAlign = 'left';
      lines.forEach((l,li)=> ctx.fillText(l, rx+8, ry+15+li*14));
      ctx.restore();
    }
    // 3차 전직 (초월/멸살/불멸): 회전 광륜
    if (player.jobs && player.jobs.length>=3 && cc){
      ctx.strokeStyle = cc;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.6;
      const ha = performance.now()/400;
      ctx.beginPath(); ctx.ellipse(player.x, player.y-24, 10, 3.2, ha%(Math.PI*2), 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;

    if (player.confuseT>0){
      ctx.save();
      ctx.fillStyle = PAL.ink;
      ctx.font = "700 11px 'IBM Plex Mono', monospace";
      ctx.textAlign='center';
      ctx.fillText('?？?', player.x, player.y-30);
      ctx.restore();
    }
    // 방벽 표시
    if (player.shieldReady){
      ctx.save();
      ctx.strokeStyle = PAL.ink2;
      ctx.setLineDash([5,4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(player.x, player.y-3, 19, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // 전용기 쿨다운 링 (직업 색)
    if (player.ultReady){
      const t = Math.min(1, Math.max(0, 1 - player.ultCooldown/player.ultCooldownMax));
      ctx.save();
      ctx.strokeStyle = CLASS_COLORS[player.classKey] || PAL.ink2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y-3, 24, -Math.PI/2, -Math.PI/2 + Math.PI*2*t);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- 몬스터 스킨 ----------
  // 몹 타입별 잉크워시 틴트 — 종류가 색으로 구분된다
  const ENEMY_TINTS = {
    swarm:'#7a94b8', normal:'#b89a7a', brute:'#b87a7a', shooter:'#7ab894',
    splitter:'#a87ab8', binder:'#b8a87a', kamikaze:'#c9705a', fish:'#7ab0c9', clone:'#b08ab0'
  };
  function drawEnemy(e){
    ctx.save();
    ctx.translate(e.x, e.y);
    drawShadow(0, e.r*0.95, e.r*0.85);
    // 타입 틴트 오라
    if (e.blessed){
      const bp = 0.25 + 0.15*Math.sin(performance.now()/150);
      ctx.fillStyle = 'rgba(232,197,106,'+bp+')';
      ctx.beginPath(); ctx.arc(0,0,e.r*1.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#e8c56a';
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(0,0,e.r*1.3,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 몹 희귀도 표시: 악몽 = 보라 오라, 베테랑 = 붉은 이중 윤곽
    if (e.grade===2){
      ctx.fillStyle = 'rgba(92,74,138,0.30)';
      ctx.beginPath(); ctx.arc(0,0,e.r*1.45,0,Math.PI*2); ctx.fill();
    } else if (e.grade===1){
      ctx.strokeStyle = 'rgba(201,79,79,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0,0,e.r*1.2,0,Math.PI*2); ctx.stroke();
    }
    if (e.elite){
      ctx.fillStyle = 'rgba(217,165,63,0.22)';
      ctx.beginPath(); ctx.arc(0,0,e.r*1.35,0,Math.PI*2); ctx.fill();
      if (e.name){
        ctx.fillStyle = 'rgba(32,33,36,0.9)';
        ctx.font = "700 9px 'IBM Plex Sans KR', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(e.name, 0, -e.r-9);
      }
      // 엘리트 왕관
      ctx.fillStyle = '#d9a53f';
      ctx.strokeStyle = '#8a6428';
      ctx.lineWidth = 0.8;
      const cy2 = -e.r-20 + Math.sin(performance.now()/280)*1.5;
      ctx.beginPath();
      ctx.moveTo(-6, cy2+4); ctx.lineTo(-6, cy2); ctx.lineTo(-3, cy2+2.5); ctx.lineTo(0, cy2-1.5);
      ctx.lineTo(3, cy2+2.5); ctx.lineTo(6, cy2); ctx.lineTo(6, cy2+4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (ENEMY_TINTS[e.type]){
      ctx.globalAlpha = 0.20;
      ctx.fillStyle = ENEMY_TINTS[e.type];
      ctx.beginPath(); ctx.arc(0,0,e.r*1.18,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const t = performance.now()/1000;
    const ink = PAL.ink, ink2 = PAL.ink2, mid = PAL.mid, soft = PAL.soft;
    ctx.strokeStyle = ink2;
    ctx.lineWidth = 1.4;
    const flap = Math.sin(t*10 + e.x*0.05);
    const sk = e.skin;

    if (sk==='moth'){
      ctx.fillStyle = soft;
      ctx.beginPath(); ctx.ellipse(-4,0,5,2.6+flap*1.6,-0.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4,0,5,2.6-flap*1.6,0.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = mid;
      ctx.beginPath(); ctx.ellipse(0,0,2.4,5,0,0,Math.PI*2); ctx.fill();
    } else if (sk==='book'){
      ctx.fillStyle = soft;
      ctx.save(); ctx.rotate(flap*0.2);
      ctx.fillRect(-7,-5,7,10);
      ctx.fillStyle = mid;
      ctx.fillRect(0,-5,7,10);
      ctx.strokeRect(-7,-5,14,10);
      ctx.restore();
    } else if (sk==='bug'){
      ctx.fillStyle = soft;
      ctx.beginPath(); ctx.arc(0,0,e.r*0.8,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1.2;
      for (let k=0;k<3;k++){
        const ly = -3+k*3;
        ctx.beginPath(); ctx.moveTo(-e.r*0.7,ly); ctx.lineTo(-e.r*1.3, ly+flap*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e.r*0.7,ly); ctx.lineTo(e.r*1.3, ly-flap*2); ctx.stroke();
      }
    } else if (sk==='ghost'){
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.arc(0,-2,e.r*0.85,Math.PI,0);
      const w = e.r*0.85;
      ctx.lineTo(w, 6);
      for (let k=0;k<3;k++) ctx.quadraticCurveTo(w - w*2*(k*2+1)/6, 9+flap*1.5, w - w*2*(k+1)/3, 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.bg;
      ctx.beginPath(); ctx.arc(-3,-4,1.6,0,Math.PI*2); ctx.arc(3,-4,1.6,0,Math.PI*2); ctx.fill();
    } else if (sk==='wisp'){
      ctx.fillStyle = mid;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(0,0,e.r*0.8,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(-e.r*0.6,e.r*0.5,e.r*0.45,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.bg;
      ctx.beginPath(); ctx.arc(2,-2,1.8,0,Math.PI*2); ctx.fill();
    } else if (sk==='glitch'){
      ctx.fillStyle = mid;
      const j = ()=> (Math.random()-0.5)*3;
      ctx.fillRect(-e.r*0.7+j(), -e.r*0.7+j(), e.r*1.4, e.r*0.5);
      ctx.fillRect(-e.r*0.7+j(), -e.r*0.15+j(), e.r*1.4, e.r*0.5);
      ctx.fillRect(-e.r*0.7+j(), e.r*0.4+j(), e.r*1.4, e.r*0.5);
    } else if (sk==='golem'){
      ctx.fillStyle = ink2;
      roundRect(-e.r*0.85,-e.r*0.7,e.r*1.7,e.r*1.5,4);
      ctx.fill(); ctx.stroke();
      ctx.fillRect(-e.r*0.4,-e.r*1.05,e.r*0.8,e.r*0.5);
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(-e.r*0.25,-e.r*0.95,e.r*0.16,e.r*0.16);
      ctx.fillRect(e.r*0.1,-e.r*0.95,e.r*0.16,e.r*0.16);
    } else if (sk==='tome'){
      ctx.fillStyle = ink2;
      for (let k=0;k<3;k++){
        const wRect = e.r*(1.6-k*0.25);
        ctx.fillRect(-wRect/2, e.r*0.5-k*e.r*0.55, wRect, e.r*0.5);
        ctx.strokeRect(-wRect/2, e.r*0.5-k*e.r*0.55, wRect, e.r*0.5);
      }
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(-e.r*0.3,-e.r*0.4,e.r*0.14,e.r*0.14);
      ctx.fillRect(e.r*0.14,-e.r*0.4,e.r*0.14,e.r*0.14);
    } else if (sk==='firewall'){
      ctx.fillStyle = ink2;
      roundRect(-e.r*0.9,-e.r*0.55,e.r*1.8,e.r*1.2,3);
      ctx.fill(); ctx.stroke();
      for (let k=-1;k<=1;k++){
        ctx.beginPath();
        ctx.moveTo(k*e.r*0.5-4,-e.r*0.55);
        ctx.lineTo(k*e.r*0.5, -e.r*1.1 - flap*2);
        ctx.lineTo(k*e.r*0.5+4,-e.r*0.55);
        ctx.closePath(); ctx.fill();
      }
    } else if (sk==='drone'){
      ctx.fillStyle = mid;
      roundRect(-e.r*0.6,-e.r*0.6,e.r*1.2,e.r*1.2,3);
      ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.rotate(t*12);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-e.r,0); ctx.lineTo(e.r,0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-e.r); ctx.lineTo(0,e.r); ctx.stroke();
      ctx.restore();
    } else if (sk==='inkbow'){
      ctx.fillStyle = mid;
      ctx.beginPath(); ctx.arc(0,-2,e.r*0.55,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-e.r*0.5,e.r); ctx.lineTo(0,-2); ctx.lineTo(e.r*0.5,e.r); ctx.closePath(); ctx.fill();
      const aim = Math.atan2(player.y-e.y, player.x-e.x);
      ctx.save(); ctx.rotate(aim);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.r*0.8,0,e.r*0.6,-1.2,1.2); ctx.stroke();
      ctx.restore();
    } else if (sk==='turret'){
      ctx.fillStyle = mid;
      roundRect(-e.r*0.7,-e.r*0.45,e.r*1.4,e.r*1.1,2);
      ctx.fill(); ctx.stroke();
      const aim = Math.atan2(player.y-e.y, player.x-e.x);
      ctx.save(); ctx.rotate(aim);
      ctx.fillRect(0,-2,e.r*1.2,4);
      ctx.restore();
      ctx.fillStyle = PAL.bg;
      ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
    } else if (sk==='slime' || sk==='inkslime' || sk==='virus'){
      ctx.fillStyle = sk==='virus' ? ink2 : (sk==='inkslime' ? ink2 : soft);
      if (sk==='virus'){
        ctx.beginPath();
        for (let k=0;k<10;k++){
          const a=(Math.PI*2/10)*k;
          const rr = e.r*(k%2? 0.6:1);
          ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
        }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 2, e.r, e.r*0.8+flap*0.8, 0, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        if (sk==='inkslime'){
          ctx.fillRect(-e.r*0.3, e.r*0.6, 2, 4+flap*2);
          ctx.fillRect(e.r*0.3, e.r*0.5, 2, 3-flap*2);
        }
      }
      ctx.fillStyle = PAL.bg;
      ctx.beginPath(); ctx.arc(-3,-1,1.6,0,Math.PI*2); ctx.arc(3,-1,1.6,0,Math.PI*2); ctx.fill();
    } else if (sk==='binder'){
      ctx.fillStyle = ink2;
      ctx.beginPath(); ctx.moveTo(-e.r*0.7,e.r); ctx.lineTo(0,-e.r); ctx.lineTo(e.r*0.7,e.r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.bg;
      ctx.beginPath(); ctx.arc(0,-e.r*0.3,1.7,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = soft;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0,0,e.r+4+flap*2,0.3,1.2); ctx.stroke();
    } else if (sk==='kamikaze'){
      ctx.fillStyle = e.fuse>=0 && Math.floor(t*10)%2===0 ? ink : mid;
      ctx.beginPath(); ctx.arc(0,0,e.r*0.85,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(e.r*0.4,-e.r*0.7); ctx.quadraticCurveTo(e.r*0.9,-e.r*1.3,e.r*1.2,-e.r*1.1); ctx.stroke();
      if (e.fuse>=0){
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.arc(e.r*1.25,-e.r*1.1,2.2,0,Math.PI*2); ctx.fill();
      }
    } else if (sk==='fish'){
      const aim = Math.atan2(player.y-e.y, player.x-e.x);
      ctx.save(); ctx.rotate(aim);
      ctx.fillStyle = soft;
      ctx.beginPath(); ctx.ellipse(0,0,e.r,e.r*0.6,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-e.r,0); ctx.lineTo(-e.r-5, -4-flap*2); ctx.lineTo(-e.r-5, 4+flap*2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.bg;
      ctx.beginPath(); ctx.arc(e.r*0.45,-1,1.4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    } else if (sk==='treasure'){
      // 보물 골렘 — 반짝이는 황금 골렘
      ctx.fillStyle = '#ecd9a0';
      ctx.strokeStyle = '#a87c28';
      ctx.lineWidth = 2;
      roundRect(-e.r*0.85,-e.r*0.7,e.r*1.7,e.r*1.5,4);
      ctx.fill(); ctx.stroke();
      ctx.fillRect(-e.r*0.4,-e.r*1.05,e.r*0.8,e.r*0.5);
      ctx.strokeRect(-e.r*0.4,-e.r*1.05,e.r*0.8,e.r*0.5);
      // 가슴의 보석
      ctx.fillStyle = COLORS.gold;
      ctx.save();
      ctx.rotate(Math.PI/4);
      const gs = 4 + Math.sin(t*6)*1.2;
      ctx.fillRect(-gs/2,-gs/2,gs,gs);
      ctx.restore();
      // 반짝임
      if (Math.sin(t*8+e.x)>0.7){
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(e.r*0.6,-e.r*0.9); ctx.lineTo(e.r*0.9,-e.r*1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e.r*0.9,-e.r*0.9); ctx.lineTo(e.r*0.6,-e.r*1.2); ctx.stroke();
      }
      ctx.fillStyle = ink;
      ctx.font = "600 9px 'IBM Plex Sans KR', sans-serif";
      ctx.textAlign='center';
      ctx.fillText(Math.ceil(e.fleeT)+'초', 0, -e.r-14);
    } else if (sk==='jieun' || e.type==='clone'){
      drawHumanoid(0, 0, { face: player.x>e.x?1:-1, walk:t*9, gear:null, scale:0.95, ink:mid });
      ctx.strokeStyle = mid;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-4,-16); ctx.lineTo(-8,-20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4,-16); ctx.lineTo(8,-20); ctx.stroke();
    } else {
      ctx.fillStyle = mid;
      ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    }

    // 엘리트 마커 + 특성 이름
    if (e.elite){
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.setLineDash([6,5]);
      ctx.lineDashOffset = -performance.now()/60;
      ctx.beginPath();
      ctx.arc(0,0,e.r+8,0,Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink;
      ctx.font = "600 9px 'IBM Plex Sans KR', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('['+ELITE_AFFIXES[e.affix]+'] 엘리트', 0, -e.r-14);
    }
    // 빙결 표시
    if (e.frozenT>0){
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-3,-e.r-6); ctx.lineTo(-3,-e.r-1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1,-e.r-6); ctx.lineTo(1,-e.r-1); ctx.stroke();
    }
    // 원소 상태이상 표시 (색으로 한눈에)
    // Pixi 3단계: 상태이상 WebGL 모트 (확률적 미세 파티클)
    if (FX.enabled){
      if (e.burnT>0 && Math.random()<0.06) FX.burst(e.x, e.y-e.r*0.5, 0xe2603f, 1, 45, 0.35);
      if (e.corrodeS>0 && Math.random()<0.05) FX.burst(e.x, e.y, 0x6faa4e, 1, 30, 0.4);
      if ((e.chillS>0||e.frozenT>0) && Math.random()<0.04) FX.burst(e.x, e.y-e.r*0.6, 0x7ec8e3, 1, 25, 0.45);
    }
    if (e.burnT>0){
      ctx.fillStyle = COLORS.fire;
      const ff = Math.sin(performance.now()/70+e.x)*1.5;
      ctx.beginPath();
      ctx.moveTo(e.r*0.5-3, -e.r-2); ctx.lineTo(e.r*0.5, -e.r-8-ff); ctx.lineTo(e.r*0.5+3, -e.r-2);
      ctx.closePath(); ctx.fill();
    }
    if (e.chillS>0 && e.frozenT<=0){
      ctx.fillStyle = COLORS.frost;
      for (let k=0;k<e.chillS;k++){
        ctx.beginPath(); ctx.arc(-e.r*0.6+k*5, -e.r-4, 1.8, 0, Math.PI*2); ctx.fill();
      }
    }
    if (e.corrodeS>0){
      ctx.strokeStyle = COLORS.acid;
      ctx.lineWidth = 1.6;
      for (let k=0;k<e.corrodeS;k++){
        const ca = 0.6+k*0.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ca)*e.r*0.5, Math.sin(ca)*e.r*0.5);
        ctx.lineTo(Math.cos(ca)*e.r*0.95, Math.sin(ca)*e.r*0.95);
        ctx.stroke();
      }
    }
    if (e.frozenT>0){
      ctx.strokeStyle = COLORS.frost;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0,0,e.r+3,0,Math.PI*2); ctx.stroke();
    }
    // hp bar
    if (e.maxHp>20*MAP.mult.ehp){
      const dmgT = 1 - Math.max(0,e.hp)/e.maxHp;
      ctx.fillStyle = 'rgba(127,127,127,0.25)';
      ctx.fillRect(-e.r, -e.r-9, e.r*2, 3);
      ctx.fillStyle = ink;
      ctx.fillRect(-e.r, -e.r-9, e.r*2*(1-dmgT), 3);
    }
    ctx.restore();
  }

  // ---------- 보스 위엄 연출 ----------
  const BOSS_TITLES = {
    oseojin:'차원 포격수', parktaeyoung:'멈추지 않는 돌진', wonGeun:'심연의 소환술사', minGi:'절단하는 시선',
    seulgi:'어장의 지배자', byungWoo:'포화의 지휘관', jiEun:'천 개의 그림자', eunJae:'피에 굶주린 자',
    yuJinKong:'폭풍을 부르는 콩', jungWoo:'등 뒤의 배신자', seonJeong:'지뢰밭의 공병', spaceStar:'추락한 별',
    nukNukEX:'정신을 부수는 자', goDokGeun:'고독한 심연의 군체',
    monday:'영원히 돌아오는 재앙', deadline:'모든 것을 불태우는 최후 통첩', gatekeeper:'차원의 파수꾼',
    overtime:'끝나지 않는 잔업의 화신', rentday:'매달 강림하는 징수자', aiface:'감정 없는 심판자',
    gkShield:'관문의 수문장', gkTwin:'관문의 수문장', gkTrain:'관문의 수문장',
    teamleadEx:'관문 — 사직서를 찢는 자', relativesEx:'관문 — 명절의 심문관들', burnoutEx:'관문 — 거울 속의 나',
    jealousEx:'관문 — 최병우를 놓지 못한 자',
    protestEx:'관문 — 출근길을 멈춘 자',
    heatwaveEx:'관문 — 재난문자의 주인',
    blinddateEx:'관문 — 만남을 주선하는 자',
    upstairsEx:'관문 — 천장 위에 사는 자',
    jeonseEx:'관문 — 보증금을 삼키는 자',
    aialgoEx:'관문 — 너를 학습하는 것',
    chinaEx:'관문 — 대륙의 세 얼굴', tariffEx2:'관문 — 벽을 세우는 자',
    warzoneEx:'관문 — 전쟁 그 자체', yeongkkeulEx:'관문 — 도로와 이자의 무법자',
    awakenOseojin:'각성 — 차원의 종결자', awakenEunJae:'각성 — 광기의 화신', abyssGoDokGeun:'심연 그 자체'
  };
  function showBossBanner(title, name, color){
    $('bossBannerTitle').textContent = title;
    const bn = $('bossBannerName');
    bn.textContent = name;
    bn.style.color = color || 'var(--ink-900)';
    const banner = $('bossBanner');
    banner.style.opacity = '1';
    setTimeout(()=>{ banner.style.opacity = '0'; }, 2200);
  }
  // 보스별 시그니처 색
  const BOSS_ACCENTS = {
    oseojin:'#3b82c4', parktaeyoung:'#c94f4f', wonGeun:'#8b5cf6', minGi:'#e0b73d',
    seulgi:'#d97ba8', byungWoo:'#e2823f', jiEun:'#b06ab0', eunJae:'#b8362e',
    yuJinKong:'#4fa8c4', jungWoo:'#7a8a99', seonJeong:'#e2823f', spaceStar:'#e0b73d',
    nukNukEX:'#9a6fc4', goDokGeun:'#3aa895',
    monday:'#5c6a8a', deadline:'#c9403a', gatekeeper:'#5c4a8a',
    overtime:'#4a5568', rentday:'#8a6a3f', aiface:'#5ab8c9', jealousEx:'#c94f8a',
    protestEx:'#3f7a5c', heatwaveEx:'#d4772e', blinddateEx:'#b85c8a', upstairsEx:'#7a6a52',
    jeonseEx:'#8a7a3f', aialgoEx:'#5ab8c9',
    chinaEx:'#c9a13f', tariffEx2:'#d4772e', warzoneEx:'#5c6652', yeongkkeulEx:'#8a6a3f',
    teamleadEx:'#4a5568', relativesEx:'#a3653f', burnoutEx:'#555058',
    gkShield:'#6a7a8a', gkTwin:'#7a5ca3', gkTrain:'#8a5c42',
    xiPingping:'#c9a13f', maoJu:'#b8362e', eggRice:'#e2b23f', trumpTariff:'#d4772e',
    moscowBear:'#7a5c52', kyivDrone:'#4c7ab8', kickboard:'#6a6c70', loanRate:'#8a6a3f',
    awakenOseojin:'#3b82c4', awakenEunJae:'#b8362e', abyssGoDokGeun:'#3aa895'
  };
  function drawBoss(b){
    const t = performance.now()/1000;
    const face = player.x > b.x ? 1 : -1;
    const ink = PAL.ink, ink2 = PAL.ink2, mid = PAL.mid;
    // 시그니처 악센트 외곽 링: 평시 은은, 분노 시 붉게 맥동
    if (!b.ghost){
      const ac = BOSS_ACCENTS[b.key] || '#b8362e';
      ctx.save();
      if (b.enraged){
        const ep = 0.45 + 0.3*Math.sin(performance.now()/110);
        ctx.strokeStyle = '#c9403a';
        ctx.globalAlpha = ep;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r+7+Math.sin(performance.now()/110)*2, 0, Math.PI*2); ctx.stroke();
      }
      ctx.strokeStyle = ac;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r+4, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // 돌진 텔레그래프
    if ((b.kind==='charger'||b.kind==='root') && b.chargeState==='telegraph'){
      const len = Math.max(W,H)*1.3;
      const ang = Math.atan2(b.chargeDir.y, b.chargeDir.x);
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.rotate(ang);
      const pulse = 0.28 + 0.2*Math.sin(performance.now()/55);
      ctx.fillStyle = MAP.key==='abyss' ? 'rgba(255,255,255,'+pulse.toFixed(2)+')' : 'rgba(0,0,0,'+pulse.toFixed(2)+')';
      ctx.fillRect(0, -b.r*0.9, len, b.r*1.8);
      ctx.restore();
    }
    // 빔 (이민기)
    if (b.kind==='beam' && (b.beamState==='warm'||b.beamState==='fire')){
      const len = 300;
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.rotate(b.beamA);
      if (b.beamState==='warm'){
        ctx.strokeStyle = MAP.key==='abyss' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
        ctx.setLineDash([8,6]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = MAP.key==='abyss' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)';
        ctx.fillRect(0,-7,len,14);
        ctx.fillStyle = MAP.key==='abyss' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
        ctx.fillRect(0,-12,len,24);
      }
      ctx.restore();
    }

    ctx.save();
    if (b.ghost) ctx.globalAlpha = 0.22;
    if (b.kind!=='centipede') drawShadow(b.x, b.y + b.r*0.85, b.r*0.95);

    if (b.kind==='centipede'){
      // 고독근 — 소울풍 지네
      for (let i=b.segs.length-1;i>=0;i--){
        const s = b.segs[i];
        const rr = 13 - i*0.5;
        ctx.fillStyle = i%2===0 ? ink2 : ink;
        ctx.globalAlpha = (b.ghost?0.22:1) * (0.55 + 0.45*(1-i/b.segs.length));
        ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(6,rr), 0, Math.PI*2); ctx.fill();
        if (i%2===0){
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.2;
          const la = Math.atan2(s.y-(b.segs[i-1]?b.segs[i-1].y:b.y), s.x-(b.segs[i-1]?b.segs[i-1].x:b.x)) + Math.PI/2;
          ctx.beginPath();
          ctx.moveTo(s.x+Math.cos(la)*rr, s.y+Math.sin(la)*rr);
          ctx.lineTo(s.x+Math.cos(la)*(rr+7), s.y+Math.sin(la)*(rr+7));
          ctx.moveTo(s.x-Math.cos(la)*rr, s.y-Math.sin(la)*rr);
          ctx.lineTo(s.x-Math.cos(la)*(rr+7), s.y-Math.sin(la)*(rr+7));
          ctx.stroke();
        }
      }
      ctx.globalAlpha = b.ghost?0.22:1;
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(b.x, b.y, 16, 0, Math.PI*2); ctx.fill();
      const ha = Math.atan2(player.y-b.y, player.x-b.x);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(b.x+Math.cos(ha-0.5)*16, b.y+Math.sin(ha-0.5)*16, 7, ha-1.6, ha+0.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x+Math.cos(ha+0.5)*16, b.y+Math.sin(ha+0.5)*16, 7, ha-0.5, ha+1.6); ctx.stroke();
      ctx.fillStyle = MAP.key==='abyss' ? '#232427' : '#f6f6f4';
      ctx.beginPath();
      ctx.arc(b.x+Math.cos(ha-0.4)*9, b.y+Math.sin(ha-0.4)*9, 2.2, 0, Math.PI*2);
      ctx.arc(b.x+Math.cos(ha+0.4)*9, b.y+Math.sin(ha+0.4)*9, 2.2, 0, Math.PI*2);
      ctx.fill();

    } else if (b.kind==='meteor'){
      // 우주별 — 별 모양
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.rotate(t*0.8);
      ctx.fillStyle = ink2;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k=0;k<10;k++){
        const a=(Math.PI*2/10)*k - Math.PI/2;
        const rr = k%2===0 ? b.r*1.15 : b.r*0.5;
        ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = MAP.key==='abyss' ? '#232427' : '#f6f6f4';
      ctx.beginPath(); ctx.arc(b.x-5,b.y-3,2.4,0,Math.PI*2); ctx.arc(b.x+5,b.y-3,2.4,0,Math.PI*2); ctx.fill();

    } else if (b.kind==='wind'){
      // 유진콩 — 콩 모양 몸체 + 바람
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.fillStyle = ink2;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r*0.75, b.r*1.05, face*0.2, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = MAP.key==='abyss' ? '#232427' : '#f6f6f4';
      ctx.beginPath(); ctx.arc(face*5,-6,2.4,0,Math.PI*2); ctx.arc(face*11,-5,2.4,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = mid;
      ctx.lineWidth = 1.8;
      for (let k=0;k<3;k++){
        const a = t*3 + k*(Math.PI*2/3);
        ctx.beginPath();
        ctx.arc(Math.cos(a)*(b.r+10), Math.sin(a)*(b.r+10), 7, a, a+2.2);
        ctx.stroke();
      }
      ctx.restore();

    } else {
      // 인간형 보스들
      const scale = 1.9 * (b.emp?1.1:1) * (b.finale?1.5:1);
      const walk = t*8;
      let robe = (b.kind==='backstab'||b.kind==='esper'||b.kind==='summoner'||b.kind==='root');
      drawHumanoid(b.x, b.y-4, { face, walk, gear:null, scale, ink: b.emp? ink : ink2, robe });
      ctx.save();
      ctx.translate(b.x, b.y-4);
      ctx.scale(face*scale, scale);
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.6;

      if (b.kind==='root'){ // 각성 오서진: 안경 + 왕관 + 궤도 구슬 3개
        ctx.beginPath(); ctx.arc(-1,-11,2.6,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(4.6,-11,2.6,0,Math.PI*2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5,-16); ctx.lineTo(-3,-21); ctx.lineTo(0,-17); ctx.lineTo(2,-22); ctx.lineTo(4,-17); ctx.lineTo(7,-21); ctx.lineTo(8,-16);
        ctx.closePath(); ctx.fill();
        for (let k=0;k<3;k++){
          const oa = t*3 + k*(Math.PI*2/3);
          ctx.beginPath(); ctx.arc(Math.cos(oa)*16, -6+Math.sin(oa)*7, 2.8, 0, Math.PI*2); ctx.fill();
        }
      } else if (b.kind==='ranged'){ // 오서진: 안경 + 마법 구슬
        ctx.beginPath(); ctx.arc(-1,-11,2.6,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(4.6,-11,2.6,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1.6,-11); ctx.lineTo(2,-11); ctx.stroke();
        const oa = t*4;
        ctx.beginPath(); ctx.arc(11+Math.cos(oa)*2, -14+Math.sin(oa)*2, 3.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(11+Math.cos(oa)*2, -14+Math.sin(oa)*2, 5.6, 0, Math.PI*2); ctx.stroke();
      } else if (b.kind==='charger'){ // 박태영: 뿔 투구 + 주먹
        ctx.beginPath(); ctx.moveTo(-4,-15); ctx.lineTo(-8,-22); ctx.lineTo(-1,-16); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(6,-15); ctx.lineTo(10,-22); ctx.lineTo(3,-16); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(8,2,3.4,0,Math.PI*2); ctx.fill();
        if (b.chargeState==='idle'){
          const def = BOSS_TYPES.parktaeyoung;
          const tg = Math.min(1, b.gauge/def.gaugeTime);
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(1,-2,14,-Math.PI/2,-Math.PI/2+Math.PI*2*tg); ctx.stroke();
        }
      } else if (b.kind==='summoner'){ // 이원근: 지팡이 + 소환진
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(8,6); ctx.lineTo(8,-18); ctx.stroke();
        ctx.beginPath(); ctx.arc(8,-20,2.6,0,Math.PI*2); ctx.fill();
        if (b.summonT < 1.2){
          ctx.strokeStyle = mid;
          ctx.setLineDash([4,4]);
          ctx.beginPath(); ctx.arc(0,10,14+Math.sin(t*8)*2,0,Math.PI*2); ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (b.kind==='beam'){ // 이민기: 외눈 렌즈
        ctx.beginPath(); ctx.arc(2,-11,4.4,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(2,-11,1.8,0,Math.PI*2); ctx.fill();
      } else if (b.kind==='fickle'){ // 슬기짱: 긴 머리 + 하트
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-4,-14); ctx.quadraticCurveTo(-9,-6,-7,4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2,-16); ctx.quadraticCurveTo(-11,-8,-10,6); ctx.stroke();
        const hb = 1+Math.sin(t*5)*0.15;
        ctx.save();
        ctx.translate(11,-16); ctx.scale(hb,hb);
        ctx.beginPath();
        ctx.arc(-1.6,0,2,0,Math.PI*2); ctx.arc(1.6,0,2,0,Math.PI*2);
        ctx.moveTo(-3.4,0.8); ctx.lineTo(0,4.6); ctx.lineTo(3.4,0.8);
        ctx.fill();
        ctx.restore();
      } else if (b.kind==='mortar'){ // 최병우: 등 뒤 박격포
        ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(-12,-14); ctx.stroke();
        ctx.fillRect(-14.5,-18,5,5);
      } else if (b.kind==='clones'){ // 지은이: 리본
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-3,-15); ctx.lineTo(-7,-20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5,-15); ctx.lineTo(9,-20); ctx.stroke();
      } else if (b.kind==='berserk'){ // 은재: 대검 + 분노
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(6,2); ctx.lineTo(18,-14); ctx.stroke();
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(9.5,-3.5); ctx.lineTo(13,0); ctx.stroke();
        if (b.frenzy>0 || b.hp<b.maxHp*0.5){
          ctx.beginPath(); ctx.moveTo(-6,-18); ctx.lineTo(-3,-21); ctx.moveTo(-8,-14); ctx.lineTo(-11,-16); ctx.stroke();
        }
      } else if (b.kind==='backstab'){ // 정우팍: 단검 + 능글눈
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(12,-5); ctx.stroke();
        ctx.fillStyle = MAP.key==='abyss' ? '#232427' : '#f6f6f4';
        ctx.fillRect(1.5,-12.6,4,1.6);
      } else if (b.kind==='mines'){ // 선정팩: 공병 헬멧 + 가방
        ctx.beginPath(); ctx.arc(1,-13,6.4,Math.PI,0); ctx.fill();
        roundRect(-10,-4,5,8,2); ctx.fill();
        ctx.fillStyle = MAP.key==='abyss' ? '#232427' : '#f6f6f4';
        ctx.beginPath(); ctx.arc(-7.5,0,1.4,0,Math.PI*2); ctx.fill();
      } else if (b.kind==='esper'){ // 눅눅근EX: 긴 머리 + 염동 링
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-3,-15); ctx.quadraticCurveTo(-10,-4,-8,8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5,-15); ctx.quadraticCurveTo(12,-4,10,8); ctx.stroke();
        ctx.strokeStyle = mid;
        ctx.lineWidth = 1.4;
        ctx.save();
        ctx.rotate(t*2);
        ctx.beginPath(); ctx.ellipse(1,-6,14,5,0,0,Math.PI*2); ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.rotate(-t*1.5);
        ctx.beginPath(); ctx.ellipse(1,-6,11,4,Math.PI/3,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      } else if (b.kind==='jealous'){ // 의부증 전여친 은재: 긴 생머리 + 빛나는 핸드폰
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-4,-15); ctx.quadraticCurveTo(-9,-2,-8,10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6,-15); ctx.quadraticCurveTo(11,-2,10,10); ctx.stroke();
        const glow = 0.5+Math.sin(t*6)*0.3;
        ctx.fillStyle = 'rgba(201,79,138,'+glow+')';
        ctx.fillRect(9,-6,5,8);
        ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
        ctx.strokeRect(9,-6,5,8);
      } else if (b.kind==='protest'){ // 시위대장: 붉은 머리띠 + 피켓
        ctx.strokeStyle = '#b8362e'; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(-5,-14); ctx.lineTo(9,-14); ctx.stroke();
        ctx.strokeStyle = ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(10,4); ctx.lineTo(10,-22); ctx.stroke();
        ctx.fillStyle = MAP.key==='abyss' ? '#3a3b40' : '#e8e6e0';
        ctx.fillRect(4,-30,13,9);
        ctx.strokeRect(4,-30,13,9);
        ctx.strokeStyle = '#b8362e'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(6,-25.5); ctx.lineTo(15,-25.5); ctx.stroke();
      } else if (b.kind==='heatwave'){ // 폭염: 태양 광배 — 방사 광선이 고동친다
        ctx.strokeStyle = 'rgba(212,119,46,0.85)';
        ctx.lineWidth = 2;
        const pulse = 1+Math.sin(t*4)*0.12;
        for (let k=0;k<8;k++){
          const a2 = t*0.8 + k*(Math.PI/4);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a2)*14*pulse, -6+Math.sin(a2)*14*pulse);
          ctx.lineTo(Math.cos(a2)*21*pulse, -6+Math.sin(a2)*21*pulse);
          ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(1,-6,12*pulse,0,Math.PI*2); ctx.stroke();
      } else if (b.kind==='blinddate'){ // 주선자: 나비넥타이 + 명함 다발
        ctx.fillStyle = '#b85c8a';
        ctx.beginPath(); ctx.moveTo(1,-7); ctx.lineTo(-4,-10); ctx.lineTo(-4,-4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1,-7); ctx.lineTo(6,-10); ctx.lineTo(6,-4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
        ctx.fillStyle = MAP.key==='abyss' ? '#3a3b40' : '#f0eee8';
        for (let k=0;k<3;k++){ ctx.fillRect(8+k*1.5, -2+k*1.5, 8, 5); ctx.strokeRect(8+k*1.5, -2+k*1.5, 8, 5); }
      } else if (b.kind==='upstairs'){ // 윗집: 실내화 + 진동 아크
        ctx.strokeStyle = '#7a6a52'; ctx.lineWidth = 2;
        const th2 = Math.sin(t*10)*2;
        for (let k=0;k<3;k++){
          ctx.beginPath(); ctx.arc(1, -20-k*4+th2, 7+k*3, -Math.PI*0.8, -Math.PI*0.2); ctx.stroke();
        }
        ctx.fillStyle = '#7a6a52';
        ctx.beginPath(); ctx.ellipse(-4, 9, 5, 2.6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, 9, 5, 2.6, 0, 0, Math.PI*2); ctx.fill();
      } else if (b.kind==='jeonse'){ // 전세 사기꾼: 서류가방 + 도망갈 준비된 선글라스
        ctx.fillStyle = '#8a7a3f';
        roundRect(6,-2,10,8,2); ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth=1.2; ctx.strokeRect(6,-2,10,8);
        ctx.fillStyle = ink;
        ctx.fillRect(-4,-13,5,3); ctx.fillRect(2.5,-13,5,3);
        ctx.beginPath(); ctx.moveTo(1,-11.5); ctx.lineTo(2.5,-11.5); ctx.stroke();
      } else if (b.kind==='aialgo'){ // AI 알고리즘: 모니터 두상 + 로딩 스피너
        ctx.fillStyle = MAP.key==='abyss' ? '#1a2c30' : '#dff2f5';
        ctx.fillRect(-6,-17,15,11);
        ctx.strokeStyle = '#5ab8c9'; ctx.lineWidth=1.6; ctx.strokeRect(-6,-17,15,11);
        ctx.beginPath(); ctx.arc(1.5,-11.5,3.2, t*4, t*4+Math.PI*1.4); ctx.stroke();
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    // 보스 시그니처 색 링 (분노 시 고동친다)
    const accent = BOSS_ACCENTS[b.key];
    if (accent && !b.ghost){
      ctx.strokeStyle = accent;
      if (b.enraged){
        const ep = 1 + Math.sin(performance.now()/110)*0.12;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, (b.r+14)*ep, 0, Math.PI*2); ctx.stroke();
      }
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y+b.r*0.85, b.r*0.95, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 강화형 오라 (붉은 위협 표시)
    if (b.emp && !b.ghost){
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3,6]);
      ctx.lineDashOffset = performance.now()/40;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r+16, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // 이름표 (시그니처 색)
    ctx.fillStyle = BOSS_ACCENTS[b.key] || PAL.ink;
    ctx.font = "700 11px 'IBM Plex Sans KR', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(b.name, b.x, b.y-b.r-20);
    ctx.restore();
  }

  // ---------- 이펙트/오브젝트 렌더링 ----------
  function drawAura(){
    if (!auraState.on) return;
    ctx.save();
    const pulse = 1 + Math.sin(performance.now()/300)*0.02;
    const r = auraState.r * pulse;
    const dark = MAP.key==='abyss';
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(32,33,36,0.05)';
    ctx.beginPath(); ctx.arc(player.x, player.y, r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = dark ? (auraState.ev?'rgba(255,255,255,0.4)':'rgba(255,255,255,0.2)') : (auraState.ev?'rgba(0,0,0,0.35)':'rgba(0,0,0,0.18)');
    ctx.lineWidth = auraState.ev ? 2 : 1.2;
    ctx.beginPath(); ctx.arc(player.x, player.y, r, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  function drawSatellites(){
    if (!satPos.length) return;
    ctx.save();
    const orbitR = satPos[0].orbitR;
    ctx.strokeStyle = satPos[0].ev ? PAL.ink : PAL.soft;
    ctx.lineWidth = satPos[0].ev ? 2.5 : 1;
    ctx.beginPath(); ctx.arc(player.x, player.y, orbitR, 0, Math.PI*2); ctx.stroke();
    for (const sp of satPos){
      ctx.fillStyle = sp.ev ? PAL.ink : PAL.ink2;
      ctx.beginPath(); ctx.arc(sp.x,sp.y, sp.ev?8:6, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  function drawDrones(){
    for (const dr of dronePos){
      ctx.save();
      ctx.translate(dr.x, dr.y);
      ctx.fillStyle = PAL.ink2;
      roundRect(-5,-3,10,6,2); ctx.fill();
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 1.4;
      ctx.save();
      ctx.rotate(performance.now()/40);
      ctx.beginPath(); ctx.moveTo(-7,0); ctx.lineTo(7,0); ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
  }
  function drawZones(){
    // Pixi 3단계: 장판의 '빛' 자체는 WebGL 광원 디스크로 (형태 요소는 캔버스 유지)
    if (FX.enabled){
      const fxZones = [];
      for (const z of zones){
        if (z.type==='shade' || z.type==='mirage') continue; // 그늘·신기루는 빛이 아니라 어둠 — 캔버스에서만
        const tt = Math.min(1, z.t/z.maxT);
        const tint = z.type==='fire' ? 0xe2603f : z.type==='void' ? 0x9a6fc4 : z.type==='grav' ? 0x6a5acd : z.type==='frost' ? 0x3fa8c9 : z.type==='block' ? 0xb8362e : 0x6faa4e;
        fxZones.push({ x:z.x, y:z.y, r:z.r, tint, alpha:(z.type==='block'?0.12:0.22)*tt });
      }
      // Pixi 4단계: 보스 오라 — 시그니처 색 광원 (분노 시 강렬하게)
      for (const b of bosses){
        if (b.ghost) continue;
        const ac = BOSS_ACCENTS[b.key];
        const tint = ac ? parseInt(ac.slice(1),16) : 0xb8362e;
        fxZones.push({ x:b.x, y:b.y, r:b.r*2.1, tint, alpha: b.enraged ? 0.30 : 0.16 });
      }
      // 주력 속성 오라: 3P 이상 투자한 원소 색으로 은은한 개인 광원
      const de = dominantElemColor();
      if (de && player){
        fxZones.push({ x:player.x, y:player.y, r:30, tint:parseInt(de.slice(1),16), alpha:0.10 });
      }
      FX.drawZones(fxZones);
    }
    for (const z of zones){
      const tt = Math.min(1, z.t/z.maxT);
      ctx.save();
      ctx.translate(z.x, z.y);
      if (z.type==='fire'){
        const flick = 0.9 + Math.sin(performance.now()/60 + z.x)*0.1;
        if (!FX.enabled){
          ctx.fillStyle = 'rgba(226,96,63,'+(0.16*tt)+')';
          ctx.beginPath(); ctx.arc(0,0,z.r*flick,0,Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(226,96,63,'+(0.6*tt)+')';
        ctx.lineWidth = 1.5;
        for (let k=0;k<3;k++){
          const a = performance.now()/300 + k*2.1 + z.x;
          const fx2 = Math.cos(a)*z.r*0.5, fy2 = Math.sin(a)*z.r*0.5;
          ctx.beginPath();
          ctx.moveTo(fx2, fy2+3); ctx.quadraticCurveTo(fx2+2, fy2-4, fx2, fy2-7);
          ctx.stroke();
        }
      } else if (z.type==='frost'){
        // 눈보라: 흩날리는 눈송이
        if (!FX.enabled){
          ctx.fillStyle = 'rgba(63,168,201,'+(0.14*tt)+')';
          ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(63,168,201,'+(0.55*tt)+')';
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle = 'rgba(220,240,248,'+(0.8*tt)+')';
        for (let k=0;k<5;k++){
          const st = (performance.now()/600 + k*0.37) % 1;
          const sa = k*1.9 + z.x*0.01;
          ctx.beginPath();
          ctx.arc(Math.cos(sa)*z.r*0.6, Math.sin(sa)*z.r*0.6 - 10 + st*20, 2, 0, Math.PI*2);
          ctx.fill();
        }
      } else if (z.type==='grav'){
        // 중력 우물: 안으로 빨려드는 궤도선
        if (!FX.enabled){
          ctx.fillStyle = 'rgba(106,90,205,'+(0.20*tt)+')';
          ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(106,90,205,'+(0.65*tt)+')';
        ctx.lineWidth = 1.4;
        const gr2 = performance.now()/500;
        for (let k=0;k<3;k++){
          const rr = z.r * (1 - ((gr2 + k/3) % 1));
          ctx.globalAlpha = (rr/z.r)*0.7*tt;
          ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#241d3a';
        ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
      } else if (z.type==='void'){
        if (!FX.enabled){
          ctx.fillStyle = 'rgba(92,74,138,'+(0.22*tt)+')';
          ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(154,111,196,'+(0.7*tt)+')';
        ctx.lineWidth = 2;
        ctx.save();
        ctx.rotate(performance.now()/400);
        ctx.beginPath(); ctx.ellipse(0,0,z.r*0.8,z.r*0.4,0,0,Math.PI*2); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#1a1420';
        ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
      } else if (z.type==='block'){
        // 시위 바리케이드: 줄무늬 통제선 원통 — 통행 불가
        ctx.fillStyle = MAP.key==='abyss' ? 'rgba(60,44,46,'+(0.85*tt)+')' : 'rgba(200,180,168,'+(0.9*tt)+')';
        ctx.strokeStyle = 'rgba(184,54,46,'+(0.85*tt)+')';
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // 경고 사선 줄무늬
        ctx.save();
        ctx.beginPath(); ctx.arc(0,0,z.r-3,0,Math.PI*2); ctx.clip();
        ctx.strokeStyle = 'rgba(184,54,46,'+(0.5*tt)+')';
        ctx.lineWidth = 4;
        for (let k=-3;k<=3;k++){
          ctx.beginPath(); ctx.moveTo(k*10-z.r, z.r); ctx.lineTo(k*10+z.r, -z.r); ctx.stroke();
        }
        ctx.restore();
      } else if (z.type==='silence'){
        // 어색한 침묵: 잿빛 정적 — 안에서는 스킬이 나가지 않는다
        ctx.fillStyle = 'rgba(120,118,114,0.16)';
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(90,88,84,'+(0.6*tt)+')';
        ctx.setLineDash([2,7]);
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(90,88,84,0.7)';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.textAlign='center';
        ctx.fillText('. . .', 0, 3);
      } else if (z.type==='shade'){
        // 폭염 속 한 뼘의 그늘: 유일한 안식처
        ctx.fillStyle = 'rgba(30,36,52,0.30)';
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(90,140,200,0.55)';
        ctx.setLineDash([6,6]);
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (z.type==='mirage'){
        // 신기루: 그늘과 닮았지만 테두리가 불그스름하게 아른거린다 — 관찰력이 생명
        const wob = Math.sin(performance.now()/180 + z.x)*0.08;
        ctx.fillStyle = 'rgba(38,34,46,'+(0.26+wob)+')';
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(190,110,90,0.5)';
        ctx.setLineDash([6,6]);
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        if (!FX.enabled){
          ctx.fillStyle = 'rgba(111,170,78,'+(0.13*tt)+')';
          ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(111,170,78,'+(0.55*tt)+')';
        ctx.setLineDash([4,5]);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0,0,z.r,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        // 거품
        for (let k=0;k<3;k++){
          const bt = (performance.now()/500 + k*0.37 + z.x*0.01) % 1;
          const ba = k*2.4 + z.x;
          ctx.globalAlpha = (1-bt)*0.4*tt;
          ctx.beginPath();
          ctx.arc(Math.cos(ba)*z.r*0.5, Math.sin(ba)*z.r*0.5 - bt*14, 2.5, 0, Math.PI*2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }
  }
  function drawGhosts(){
    for (const gh of (player.ghosts||[])){
      ctx.save();
      ctx.globalAlpha = 0.55 * Math.min(1, gh.t/2);
      ctx.fillStyle = '#8fa89a';
      ctx.beginPath();
      ctx.arc(gh.x, gh.y-4, 7, Math.PI, 0);
      ctx.lineTo(gh.x+7, gh.y+5);
      const wob = Math.sin(performance.now()/120+gh.x)*2;
      ctx.quadraticCurveTo(gh.x+3.5, gh.y+8+wob, gh.x, gh.y+5);
      ctx.quadraticCurveTo(gh.x-3.5, gh.y+8-wob, gh.x-7, gh.y+5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#232427';
      ctx.beginPath(); ctx.arc(gh.x-2,gh.y-5,1.3,0,Math.PI*2); ctx.arc(gh.x+2,gh.y-5,1.3,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
  function drawShadows(){
    for (const sh of (player.shadows||[])){
      ctx.save();
      ctx.globalAlpha = 0.35 * Math.min(1, sh.t/1);
      drawHumanoid(sh.x, sh.y, { face:player.faceX, walk:performance.now()/90, gear:player.classKey, scale:1.1, ink:'#8b5cf6' });
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
  function drawTurrets(){
    for (const tu of (player.turrets||[])){
      ctx.save();
      ctx.translate(tu.x, tu.y);
      ctx.fillStyle = PAL.ink2;
      roundRect(-6,-4,12,9,2); ctx.fill();
      ctx.fillStyle = PAL.ink;
      const t2 = nearestTarget();
      const aim = t2 ? Math.atan2(t2.y-tu.y, t2.x-tu.x) : 0;
      ctx.save(); ctx.rotate(aim);
      ctx.fillRect(0,-1.6,11,3.2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(0,-6,2.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  function drawItems(){
    for (const it of items){
      const blink = it.age>16 && it.type!=='chest' && (Math.floor(it.age*6)%2===0);
      if (blink) continue;
      ctx.save();
      ctx.translate(it.x, it.y + Math.sin(performance.now()/280 + it.x)*2);
      ctx.strokeStyle = PAL.ink2;
      ctx.lineWidth = 1.5;
      if (it.type==='chest'){
        const pulse = 1 + Math.sin(performance.now()/200)*0.06;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = COLORS.chest;
        ctx.strokeStyle = '#8a6428';
        roundRect(-10,-8,20,16,3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#f4e6c8';
        ctx.beginPath(); ctx.moveTo(-10,-2); ctx.lineTo(10,-2); ctx.stroke();
        ctx.fillStyle = COLORS.gold;
        ctx.fillRect(-2,-4,4,5);
      } else if (it.type==='gold'){
        ctx.fillStyle = COLORS.gold;
        ctx.strokeStyle = '#a87c28';
        ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(6,0); ctx.lineTo(0,7); ctx.lineTo(-6,0); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (it.type==='heal'){
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = COLORS.hp;
        ctx.fillRect(-1.7,-5,3.4,10); ctx.fillRect(-5,-1.7,10,3.4);
      } else if (it.type==='magnet'){
        ctx.strokeStyle = COLORS.frost;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0,0,6.5, Math.PI*0.15, Math.PI*0.85, true); ctx.stroke();
        ctx.fillStyle = COLORS.danger;
        ctx.fillRect(-8.2,2,4,4); ctx.fillRect(4.2,2,4,4);
      } else if (it.type==='freeze'){
        ctx.strokeStyle = COLORS.frost;
        ctx.lineWidth = 1.6;
        for (let k=0;k<3;k++){
          const a=(Math.PI/3)*k;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a)*-7, Math.sin(a)*-7);
          ctx.lineTo(Math.cos(a)*7, Math.sin(a)*7);
          ctx.stroke();
        }
      } else if (it.type==='bomb'){
        ctx.fillStyle = PAL.ink;
        ctx.beginPath(); ctx.arc(0,1,7,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3,-4); ctx.quadraticCurveTo(7,-9,10,-8); ctx.stroke();
      } else if (it.type==='whet'){
        // 강화석 (모루 모양, 주황)
        ctx.fillStyle = '#e08a2e';
        ctx.strokeStyle = '#8a5418';
        ctx.beginPath(); ctx.moveTo(-8,-2); ctx.lineTo(8,-2); ctx.lineTo(5,3); ctx.lineTo(-5,3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(-3,3,6,4);
        ctx.fillStyle = '#f4d9a8';
        ctx.fillRect(-6,-6,12,3);
      } else if (it.type==='scroll'){
        // 리롤 두루마리 (보라)
        ctx.fillStyle = '#f4ecd8';
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 1.6;
        roundRect(-7,-9,14,18,3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#8b5cf6';
        ctx.beginPath(); ctx.moveTo(-4,-4); ctx.lineTo(4,-4); ctx.moveTo(-4,0); ctx.lineTo(4,0); ctx.moveTo(-4,4); ctx.lineTo(2,4); ctx.stroke();
      } else if (it.type==='stamp'){
        // 제외 도장 (빨강 금지 마크)
        ctx.strokeStyle = COLORS.danger;
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4.5,4.5); ctx.lineTo(4.5,-4.5); ctx.stroke();
      }
      ctx.restore();
    }
    // 차원 균열 포탈
    for (const rf of rifts){
      ctx.save();
      ctx.translate(rf.x, rf.y);
      ctx.rotate(performance.now()/600);
      ctx.strokeStyle = '#5c4a8a';
      ctx.lineWidth = 2.2;
      for (let k=0;k<3;k++){
        ctx.globalAlpha = 0.35 + 0.25*Math.sin(performance.now()/200 + k*2);
        ctx.beginPath(); ctx.arc(0,0, rf.r+4+k*6, k*2, k*2+Math.PI*1.4); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5c4a8a';
      ctx.beginPath();
      ctx.moveTo(0,-10); ctx.lineTo(8,0); ctx.lineTo(0,10); ctx.lineTo(-8,0); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // 조사 지점
    for (const s of surveys){
      ctx.save();
      ctx.translate(s.x, s.y + Math.sin(performance.now()/300)*3);
      const pulse = 0.7 + Math.sin(performance.now()/250)*0.3;
      ctx.strokeStyle = PAL.ink;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0,0,s.r+5,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.ink;
      roundRect(-9,-13,18,26,4); ctx.fill();
      ctx.fillStyle = PAL.bg;
      ctx.font = "700 15px 'IBM Plex Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, 6);
      ctx.restore();
    }
    // NPC 의뢰인 — 머리 위 노란 느낌표
    for (const cl of clients){
      ctx.save();
      drawShadow(cl.x, cl.y+15, 11);
      drawHumanoid(cl.x, cl.y, { face: player.x>cl.x?1:-1, walk:0, gear:null, scale:1.1, ink:PAL.ink2 });
      ctx.translate(cl.x, cl.y);
      // 서류가방
      ctx.fillStyle = PAL.ink;
      roundRect(6,-2,9,7,2); ctx.fill();
      // 퀘스트 마커 !
      const qb = Math.sin(performance.now()/300)*3;
      ctx.fillStyle = '#e8c56a';
      ctx.font = "700 18px 'IBM Plex Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -28+qb);
      ctx.fillStyle = PAL.ink;
      ctx.font = "600 9px 'IBM Plex Sans KR', sans-serif";
      ctx.fillText('의뢰인 '+Math.ceil(35-cl.age)+'초', 0, 26);
      ctx.restore();
    }
    // 떠돌이 상인
    for (const mc of merchants){
      ctx.save();
      drawShadow(mc.x, mc.y+15, 11);
      drawHumanoid(mc.x, mc.y, { face: player.x>mc.x?1:-1, walk: performance.now()/140, gear:null, scale:1.1, ink:PAL.ink2 });
      ctx.translate(mc.x, mc.y);
      // 봇짐
      ctx.fillStyle = COLORS.chest;
      ctx.strokeStyle = '#8a6428';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(-9,-6,7,0,Math.PI*2); ctx.fill(); ctx.stroke();
      // 골드 코인 표시
      const cb = Math.sin(performance.now()/250)*3;
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath(); ctx.moveTo(0,-30+cb); ctx.lineTo(5,-24+cb); ctx.lineTo(0,-18+cb); ctx.lineTo(-5,-24+cb); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.ink;
      ctx.font = "600 9px 'IBM Plex Sans KR', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('상인 '+Math.ceil(40-mc.age)+'초', 0, 26);
      ctx.restore();
    }
    // 시련의 제단
    for (const al of altars){
      ctx.save();
      ctx.translate(al.x, al.y);
      const pulse2 = 0.6 + Math.sin(performance.now()/220)*0.4;
      ctx.strokeStyle = PAL.ink;
      ctx.globalAlpha = pulse2;
      ctx.setLineDash([5,5]);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0,0,al.r+8,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // 제단 기둥 + 불꽃
      ctx.fillStyle = PAL.ink2;
      ctx.beginPath();
      ctx.moveTo(-10,14); ctx.lineTo(-6,-8); ctx.lineTo(6,-8); ctx.lineTo(10,14);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(-12,12,24,4);
      const ff2 = Math.sin(performance.now()/90)*2;
      ctx.fillStyle = COLORS.fire;
      ctx.beginPath();
      ctx.moveTo(-5,-8); ctx.quadraticCurveTo(-3,-16-ff2,0,-20-ff2);
      ctx.quadraticCurveTo(3,-14+ff2,5,-8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.ink;
      ctx.font = "600 9px 'IBM Plex Sans KR', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('시련', 0, 28);
      ctx.restore();
    }
    // 보스 지뢰 (위험 = 빨강)
    for (const m of bossMines){
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = m.armT>0 ? PAL.mid : COLORS.danger;
      ctx.beginPath(); ctx.arc(0,0,m.r*0.8,0,Math.PI*2); ctx.fill();
      if (m.armT<=0 && Math.floor(performance.now()/300)%2===0){
        ctx.fillStyle = '#fff0ee';
        ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    // 아군 지뢰 (폭발 테크 = 주황)
    for (const m of fmines){
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.strokeStyle = COLORS.boom;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = m.armT>0 ? PAL.soft : COLORS.boom;
      ctx.beginPath(); ctx.arc(0,0,3.4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  function drawHazards(){
    for (const h of hazards){
      const tt = 1 - h.timer/h.maxT;
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.friendly){
        // 아군 폭격: 잉크색
        const dark = MAP.key==='abyss';
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0,0,h.r,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle = dark ? 'rgba(255,255,255,'+(0.10+tt*0.16)+')' : 'rgba(0,0,0,'+(0.08+tt*0.14)+')';
        ctx.beginPath(); ctx.arc(0,0,h.r*tt,0,Math.PI*2); ctx.fill();
      } else {
        // 적 폭격: 위험은 빨강
        ctx.strokeStyle = 'rgba(201,79,79,0.75)';
        ctx.setLineDash([6,5]);
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(0,0,h.r,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(201,79,79,'+(0.10+tt*0.20)+')';
        ctx.beginPath(); ctx.arc(0,0,h.r*tt,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawEffects(){
    const dark = MAP.key==='abyss';
    for (const fx of effects){
      const tt = 1 - fx.age/fx.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0,tt);
      ctx.strokeStyle = PAL.ink;
      if (fx.type==='bolt' || fx.type==='chain') ctx.strokeStyle = COLORS.volt;
      if (fx.type==='psywave') ctx.strokeStyle = COLORS.psi;
      if (fx.type==='bolt'){
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(fx.x + (Math.random()*8-4), fx.y-150);
        for (let k=1;k<=5;k++){
          ctx.lineTo(fx.x + (k===5?0:(Math.random()*24-12)), fx.y - 150*(1-k/5));
        }
        ctx.stroke();
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(32,33,36,0.4)';
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 8*tt, 0, Math.PI*2); ctx.fill();
      } else if (fx.type==='chain'){
        ctx.lineWidth = 2;
        const mx = (fx.x1+fx.x2)/2 + (Math.random()*14-7);
        const my = (fx.y1+fx.y2)/2 + (Math.random()*14-7);
        ctx.beginPath(); ctx.moveTo(fx.x1, fx.y1); ctx.lineTo(mx, my); ctx.lineTo(fx.x2, fx.y2); ctx.stroke();
      } else if (fx.type==='ring'){
        const r = fx.r0 + (fx.r1-fx.r0)*(fx.age/fx.life);
        ctx.lineWidth = 2.5*tt+0.5;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, Math.PI*2); ctx.stroke();
      } else if (fx.type==='psywave'){
        ctx.lineWidth = 3;
        ctx.setLineDash([10,8]);
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (fx.type==='arc'){
        const sweep = fx.arc >= Math.PI*2 ? Math.PI*2 : fx.arc;
        const start = fx.a - sweep/2 + (fx.age/fx.life)*0.4;
        ctx.fillStyle = dark ? 'rgba(255,255,255,'+(0.25*tt)+')' : 'rgba(32,33,36,'+(0.22*tt)+')';
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.arc(fx.x, fx.y, fx.r, start, start+sweep);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r*(0.9+0.1*tt), start, start+sweep); ctx.stroke();
      } else if (fx.type==='rays'){
        ctx.lineWidth = 2;
        for (let k=0;k<7;k++){
          const a = (Math.PI*2/7)*k - Math.PI/2;
          const r0 = 12 + (1-tt)*30;
          ctx.beginPath();
          ctx.moveTo(fx.x+Math.cos(a)*r0, fx.y+Math.sin(a)*r0);
          ctx.lineTo(fx.x+Math.cos(a)*(r0+14*tt), fx.y+Math.sin(a)*(r0+14*tt));
          ctx.stroke();
        }
      } else if (fx.type==='muzzle'){
        ctx.fillStyle = PAL.ink;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 4*tt, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }
  // 주력 속성: 가장 많이 투자한 원소 — 내 탄환·오라·스킬 이펙트가 이 색으로 물든다
  function dominantElemColor(){
    if (!player) return null;
    let best=null, bp=0; // 1포인트만 투자해도 즉시 발현
    for (const tk of SPEC_TREES){ const p2=player.tech[tk]||0; if (p2>bp){ bp=p2; best=tk; } }
    return best ? COLORS[best] : null;
  }
  let fxBulletFrame = [];
  function drawProjectiles(){
    fxBulletFrame = [];
    const fxBullets = fxBulletFrame;
    for (const p of projectiles){
      if (p.mega){
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 2;
        ctx.fillStyle = PAL.ink;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
      } else if (p.kind==='shuriken'){
        ctx.save();
        ctx.translate(p.x,p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = PAL.ink;
        const rr = p.r;
        ctx.beginPath();
        for (let k=0;k<4;k++){
          const a=(Math.PI/2)*k;
          ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
          ctx.lineTo(Math.cos(a+Math.PI/4)*rr*0.4, Math.sin(a+Math.PI/4)*rr*0.4);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.kind==='wave'){
        // 무명검 검기 — 은빛 초승달
        ctx.save();
        ctx.translate(p.x,p.y);
        ctx.rotate(Math.atan2(p.vy,p.vx));
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.arc(-6,0,p.r, -1.15, 1.15); ctx.stroke();
        ctx.strokeStyle = '#e8e8ec';
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(-6,0,p.r, -1.1, 1.1); ctx.stroke();
        ctx.restore();
      } else if (p.arrow){
        ctx.save();
        ctx.translate(p.x,p.y);
        ctx.rotate(Math.atan2(p.vy,p.vx));
        const ac2 = (p.imbue && COLORS[p.imbue]) || dominantElemColor() || CLASS_COLORS[player.classKey] || PAL.ink;
        ctx.strokeStyle = ac2;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.stroke();
        ctx.fillStyle = ac2;
        ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(2,-3); ctx.lineTo(2,3); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        // 투사체 색: 각인 원소 > 주력 속성 > 직업 악센트
        const pc = p.kind==='fireball' ? COLORS.fire
                 : p.kind==='icelance' ? COLORS.frost
                 : (p.imbue && COLORS[p.imbue]) ? COLORS[p.imbue]
                 : dominantElemColor() || (CLASS_COLORS[player.classKey] || PAL.ink);
        // 탄환 = 캔버스 솔리드 코어(모든 맵에서 확실히 보임) + WebGL 글로우(어두운 맵에서 빛남)
        if (FX.enabled && !p.kind){
          fxBullets.push({ x:p.x, y:p.y, r:p.r, tint: parseInt((pc[0]==='#'?pc.slice(1):'ffffff'),16) });
          ctx.fillStyle = pc;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.r*0.85,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle = 'rgba(32,33,36,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.r*0.85,0,Math.PI*2); ctx.stroke();
          continue;
        }
        // 글로우 헤일로 (폴백: WebGL 미지원)
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = pc;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.1,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pc;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        // 각인 속성: 원소색 꼬리 잔상
        if (p.imbue){
          const vl = Math.hypot(p.vx||0,p.vy||0)||1;
          ctx.globalAlpha = 0.28;
          for (let k=1;k<=2;k++){
            ctx.beginPath();
            ctx.arc(p.x-(p.vx/vl)*k*7, p.y-(p.vy/vl)*k*7, Math.max(1,p.r*(1-0.3*k)), 0, Math.PI*2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        if (p.kind==='fireball'){
          ctx.strokeStyle = 'rgba(226,96,63,0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.r+3,0,Math.PI*2); ctx.stroke();
        }
        // 궤적
        ctx.strokeStyle = pc;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = p.r*0.8;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx*0.03, p.y - p.vy*0.03);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawHostileShots(){
    for (const p of hostileShots){
      // 적탄 WebGL 글로우 (위험 적색) — 어두운 맵에서 시인성↑
      if (FX.enabled && !p.kind) fxBulletFrame.push({ x:p.x, y:p.y, r:p.r*0.9, tint:0xe25a4f });
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.kind==='tornado'){
        ctx.strokeStyle = PAL.ink2;
        ctx.lineWidth = 1.8;
        const sp2 = performance.now()/80;
        for (let k=0;k<2;k++){
          ctx.beginPath();
          ctx.arc(0,0,p.r*(0.5+k*0.45), sp2+k*2, sp2+k*2+4);
          ctx.stroke();
        }
      } else if (p.kind==='heart'){
        ctx.fillStyle = COLORS.heart;
        ctx.strokeStyle = '#a8547e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-2.6,-1,3,0,Math.PI*2); ctx.arc(2.6,-1,3,0,Math.PI*2);
        ctx.moveTo(-5.4,0.6); ctx.lineTo(0,6.6); ctx.lineTo(5.4,0.6);
        ctx.fill();
      } else if (p.kind==='psyorb'){
        ctx.strokeStyle = COLORS.psi;
        ctx.fillStyle = COLORS.psi;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0,0,p.r*0.8,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0,0,p.r*1.3,p.r*0.5, performance.now()/300, 0, Math.PI*2); ctx.stroke();
      } else if (p.kind==='web'){
        ctx.strokeStyle = PAL.ink2;
        ctx.lineWidth = 1.2;
        for (let k=0;k<4;k++){
          const a=(Math.PI/4)*k;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a)*-p.r, Math.sin(a)*-p.r);
          ctx.lineTo(Math.cos(a)*p.r, Math.sin(a)*p.r);
          ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(0,0,p.r*0.6,0,Math.PI*2); ctx.stroke();
      } else {
        // 적 탄막: 붉은 테두리 + 밝은 코어 (슈팅게임식 — 위험을 색으로 표시)
        ctx.fillStyle = COLORS.danger;
        ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff0ee';
        ctx.beginPath(); ctx.arc(0,0,p.r*0.45,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawDmgNums(){
    ctx.save();
    ctx.textAlign = 'center';
    for (const n of dmgNums){
      const tt = 1 - n.age/n.life;
      ctx.globalAlpha = Math.min(1, tt*1.6);
      if (n.label){
        ctx.font = "700 12px 'IBM Plex Sans KR', sans-serif";
        ctx.fillStyle = PAL.ink;
      } else if (n.crit){
        ctx.font = "700 14px 'IBM Plex Mono', monospace";
        ctx.fillStyle = COLORS.crit;
      } else {
        ctx.font = "600 10.5px 'IBM Plex Mono', monospace";
        ctx.fillStyle = PAL.mid;
      }
      ctx.fillText(n.text + (n.crit && !n.label ? '!' : ''), n.x, n.y);
    }
    ctx.restore();
  }

  // ---------- draw ----------
  function draw(dt){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0,0,W,H);

    // 시간이 흐를수록 필드가 서서히 어두워진다 (밤이 온다)
    if (state!=='idle' && MAP.key!=='abyss'){
      const dark = Math.min(0.10, elapsed/900*0.10);
      if (dark>0.01){
        ctx.fillStyle = 'rgba(0,0,0,'+dark.toFixed(3)+')';
        ctx.fillRect(0,0,W,H);
      }
    }

    let ox=0, oy=0;
    if (shake>0){ ox=(Math.random()-0.5)*shake; oy=(Math.random()-0.5)*shake; }
    ctx.save();
    ctx.translate(Math.round(W/2 - player.x + ox), Math.round(H/2 - player.y + oy));

    drawGrid();
    drawRadar(dt);
    drawAura();
    drawZones();
    drawGateObjs();
    drawHazards();

    // 경험치 보석 — 청록 다이아몬드 (탄막과 확실히 구분)
    ctx.lineWidth = 1.6;
    for (const o of orbs){
      ctx.save();
      ctx.translate(o.x,o.y);
      ctx.rotate(Math.PI/4);
      const rr = o.r*0.85;
      if (o.value>=5){
        ctx.fillStyle = '#8b5cf6'; // 고가치 보석은 보라
        ctx.strokeStyle = '#8b5cf6';
        ctx.fillRect(-rr,-rr,rr*2,rr*2);
        ctx.strokeRect(-rr-2,-rr-2,rr*2+4,rr*2+4);
      } else {
        ctx.strokeStyle = COLORS.xp;
        ctx.strokeRect(-rr,-rr,rr*2,rr*2);
        ctx.fillStyle = COLORS.xp;
        ctx.fillRect(-1.2,-1.2,2.4,2.4);
      }
      ctx.restore();
    }
    drawItems();

    for (const p of particles){
      const a = Math.max(0, 1-p.age/p.life);
      if (p.ghost){
        ctx.globalAlpha = a*0.25;
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke();
      } else if (p.shard){
        ctx.globalAlpha = a*0.75;
        ctx.fillStyle = PAL.ink2;
        ctx.save();
        ctx.translate(p.x,p.y);
        ctx.rotate(p.rot + p.age*p.vr);
        ctx.fillRect(-p.r,-p.r*0.6,p.r*2,p.r*1.2);
        ctx.restore();
      } else {
        ctx.globalAlpha = a*0.5;
        ctx.fillStyle = PAL.ink;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    drawProjectiles();
    drawHostileShots();
    for (const e of enemies) drawEnemy(e);
    for (const b of bosses) drawBoss(b);
    drawSatellites();
    drawDrones();
    drawTurrets();
    drawShadows();
    drawGhosts();
    drawEffects();
    drawPlayerChar();
    drawDmgNums();

    ctx.restore();

    // 화면 밖 오브젝트 방향 표시 (상자·조사 지점·보스)
    if (state!=='idle'){
      const edge = 26;
      const targets = [];
      for (const it of items){ if (it.type==='chest') targets.push({x:it.x, y:it.y, icon:'▣'}); }
      for (const s of surveys) targets.push({x:s.x, y:s.y, icon:'?'});
      for (const rf of rifts) targets.push({x:rf.x, y:rf.y, icon:'◈'});
      for (const al of altars) targets.push({x:al.x, y:al.y, icon:'△'});
      for (const mc of merchants) targets.push({x:mc.x, y:mc.y, icon:'￦'});
      for (const e of enemies){ if (e.type==='treasure') targets.push({x:e.x, y:e.y, icon:'$'}); }
      for (const b of bosses){ if (!b.ghost) targets.push({x:b.x, y:b.y, icon:'!'}); }
      for (const tg of targets){
        const dxs = tg.x-player.x, dys = tg.y-player.y;
        if (Math.abs(dxs) < W/2-30 && Math.abs(dys) < H/2-30) continue;
        const sx = Math.max(edge, Math.min(W-edge, W/2+dxs));
        const sy = Math.max(edge+40, Math.min(H-edge, H/2+dys));
        const a = Math.atan2(dys,dxs);
        ctx.save();
        ctx.translate(sx,sy);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = PAL.ink;
        ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(2,-5); ctx.lineTo(2,5); ctx.closePath(); ctx.fill();
        ctx.rotate(-a);
        ctx.font = "700 10px 'IBM Plex Mono', monospace";
        ctx.textAlign='center';
        ctx.fillText(tg.icon, -6, 4);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // 가상 조이스틱 시각화 (터치)
    if (touchOrigin && touchCur && state==='playing'){
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(touchOrigin.x, touchOrigin.y, 34, 0, Math.PI*2); ctx.stroke();
      const dx = touchCur.x-touchOrigin.x, dy = touchCur.y-touchOrigin.y;
      const d = Math.min(34, Math.hypot(dx,dy));
      const a = Math.atan2(dy,dx);
      ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.arc(touchOrigin.x+Math.cos(a)*d, touchOrigin.y+Math.sin(a)*d, 13, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // 다크 라이팅: 어두운 맵일수록 앰비언트 암막 — WebGL 광원(오라·장판·탄환)이 어둠을 뚫는다
    if (FX.enabled && state!=='idle'){
      const amb = MAP.key==='abyss' ? 0.26 : MAP.key==='archive' ? 0.10 : 0;
      if (amb>0){
        ctx.fillStyle = 'rgba(4,5,12,'+amb+')';
        ctx.fillRect(0,0,W,H);
      }
    }
    // 보스 등장 암전
    if (screenDimT>0){
      screenDimT = Math.max(0, screenDimT - dt*1.1);
      ctx.fillStyle = 'rgba(0,0,0,'+(0.28*screenDimT).toFixed(3)+')';
      ctx.fillRect(0,0,W,H);
    }
    // low-HP vignette
    if (player && player.hp>0 && player.hp/player.maxHp < 0.3 && state!=='idle'){
      const a = 0.10 + 0.06*Math.sin(performance.now()/220);
      ctx.save();
      ctx.strokeStyle = MAP.key==='abyss' ? 'rgba(255,255,255,'+a.toFixed(2)+')' : 'rgba(0,0,0,'+a.toFixed(2)+')';
      ctx.lineWidth = 26;
      ctx.strokeRect(-6,-6,W+12,H+12);
      ctx.restore();
    }
    // WebGL 탄환 프레임 확정 (플레이어 탄 + 적탄 글로우)
    if (FX.enabled) FX.drawBullets(fxBulletFrame);
    // 맵 앰비언트 파티클: 심연 = 청록 글리치 불꽃, 서고 = 먼지
    if (FX.enabled && state==='playing' && player){
      if (MAP.key==='abyss' && Math.random()<0.06){
        FX.burst(player.x+(Math.random()-0.5)*W, player.y+(Math.random()-0.5)*H, 0x3aa895, 1, 20, 1.2);
      } else if (MAP.key==='archive' && Math.random()<0.04){
        FX.burst(player.x+(Math.random()-0.5)*W, player.y+(Math.random()-0.5)*H, 0xaaa08b, 1, 12, 1.5);
      }
    }
  }

  // ---------- main loop ----------
  function loop(now){
    let dt = Math.min(0.033, (now-last)/1000);
    last = now;
    if (!isFinite(dt) || dt<0) dt = 0.016;
    if (freeze>0){ freeze -= dt; dt = 0; }
    if (!isFinite(freeze)) freeze = 0;
    if (slowmoT>0){ slowmoT -= dt; dt *= 0.45; } // 위기 슬로모션
    // 워치독: 한 프레임의 예외가 게임 전체를 멈추지 않도록 — 프레임만 스킵하고 계속
    try {
      if (state==='playing' && dt>0){ update(dt); }
      if (state!=='idle'){ draw(dt); }
      if (FX.enabled){ FX.sync(player?player.x:0, player?player.y:0); FX.update(Math.max(dt, state==='playing'?dt:0.016)); }
    } catch(err){
      window.__gameErr = String(err && err.stack || err);
      console.error('[frame skipped]', err);
    }
    if (state==='playing'||state==='paused'||state==='levelup'||state==='event'||state==='dead'||state==='win'||state==='inv'){
      raf = requestAnimationFrame(loop);
    }
  }

  showIdle();
  window.addEventListener('resize', ()=>{
    if (state==='idle'){ resetWorld(); draw(0); }
    else if (state!=='playing'){ draw(0); }
  });

