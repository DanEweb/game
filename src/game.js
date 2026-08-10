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
    equipped: {},        // slot -> item id
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
    muted: false
  };
  function loadDB(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw){
        const d = JSON.parse(raw);
        if (d && typeof d==='object'){
          DB.best = d.best||{}; DB.gold = d.gold||0;
          DB.meta = Object.assign(DB.meta, d.meta||{});
          DB.unlocked = d.unlocked||{};
          DB.mapCleared = d.mapCleared||{};
          DB.inv = Array.isArray(d.inv) ? d.inv : [];
          DB.equipped = d.equipped||{};
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
  let touchOrigin = null, touchVec = {x:0,y:0}, touchCur = null;
  function relPos(e){
    const rect = wrap.getBoundingClientRect();
    return { x:e.clientX-rect.left, y:e.clientY-rect.top };
  }
  wrap.addEventListener('pointerdown', (e)=>{
    grabFocus(); SFX.unlock();
    if (state!=='playing') return;
    touchOrigin = relPos(e);
    touchCur = relPos(e);
  });
  wrap.addEventListener('pointermove', (e)=>{
    if (!touchOrigin) return;
    touchCur = relPos(e);
    const dx = touchCur.x-touchOrigin.x, dy = touchCur.y-touchOrigin.y;
    const d = Math.hypot(dx,dy)||1;
    const m = Math.min(1, d/36);
    touchVec = { x: dx/d*m, y: dy/d*m };
  });
  function endTouch(){ touchOrigin=null; touchCur=null; touchVec={x:0,y:0}; }
  wrap.addEventListener('pointerup', endTouch);
  wrap.addEventListener('pointercancel', endTouch);
  wrap.addEventListener('contextmenu', (e)=> e.preventDefault());

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
      let build = '일시정지 · 클릭해서 계속';
      try{
        build += '<br><span style="font-size:9.5px;opacity:0.8;">'+statsSummary()+'</span>';
      }catch(e){}
      pausedTag.innerHTML = build;
      pausedTag.style.display='block';
    }
    else if (!p && state==='paused'){ state='playing'; pausedTag.style.display='none'; last=performance.now(); }
  }
  wrap.addEventListener('click', ()=>{ if (state==='paused') setPaused(false); });

  // ---------- maps ----------
  let selMap = 'field';
  let MAP = MAPS.field, PAL = MAP.pal;

  // "잉크 위에 떨어진 물감" — 세계는 잉크, 이펙트와 보상에만 색을 입힌다
  const COLORS = {
    fire:'#e2603f', frost:'#3fa8c9', volt:'#e0b73d', acid:'#6faa4e',
    boom:'#e2823f', mech:'#7a8a99', psi:'#9a6fc4',
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
      + '<div class="ds">유니크 '+uniqNames.size+'/'+UNIQUE_POOL.length+' 종 · 태초 '+primalN+'개 · 세트 조각 '+setN+'/6 · 업적 '+achCount()+'/'+ACHIEVEMENTS.length+'</div></div>';
    list.appendChild(col);
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
  function genUnique(){
    const u = UNIQUE_POOL[(Math.random()*UNIQUE_POOL.length)|0];
    return { id:DB.nextId++, slot:u.slot, r:5, name:u.name, stats:u.stats.map(s=>({k:s.k,v:s.v})), affix:u.affix, unique:true };
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
    return it;
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
      const equippedIds = Object.values(DB.equipped);
      let worst=null, wi=-1;
      DB.inv.forEach((it,i)=>{ if (!equippedIds.includes(it.id) && (worst===null || it.r<worst.r)){ worst=it; wi=i; } });
      if (wi>=0){ DB.gold += SELL_PRICE[worst.r]; DB.inv.splice(wi,1); toast('가방이 가득! '+worst.name+' 자동 판매'); }
    }
    DB.inv.push(item);
    toast('장비 획득: ['+RARITY_NAMES[item.r]+'] '+item.name);
    // 초희귀 획득: 전광판 연출 (자랑 타임)
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
  function equippedBonuses(classKey){
    const out = { atk:0, hp:0, spd:0, cdr:0, crit:0, gold:0, magnet:0, regen:0, affixes:{}, curses:[], relic:null, inactive:0, sets:{} };
    for (const slot of SLOT_KEYS){
      const id = DB.equipped[slot];
      if (!id) continue;
      const item = DB.inv.find(i=>i.id===id);
      if (!item) continue;
      if (item.slot==='relic'){
        if (item.classKey===classKey) out.relic = item.classKey;
        else out.inactive += 1;
        continue;
      }
      if (item.wt==='heavy' && !HEAVY_OK[classKey] && !starHasName('중갑 숙련')){ out.inactive += 1; continue; }
      const plusMult = 1 + (item.plus||0)*0.06; // 강화 보너스
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
  function renderEquip(){
    slotGrid.innerHTML = '';
    SLOT_KEYS.forEach((slot)=>{
      const id = DB.equipped[slot];
      const item = id ? DB.inv.find(i=>i.id===id) : null;
      const cell = document.createElement('div');
      cell.className = 'slotCell' + (item?' filled':'');
      if (item){
        cell.innerHTML = SLOT_NAMES[slot]+'<b><span class="rbadge r'+item.r+'">'+RARITY_NAMES[item.r]+'</span>'+item.name+'</b>'
          + '<span style="font-size:9px;">'+item.stats.map(statLine).join(' · ')+'</span>';
        cell.style.cursor = 'pointer';
        cell.title = '클릭하여 해제';
        cell.addEventListener('click', ()=>{ delete DB.equipped[slot]; saveDB(); renderEquip(); });
      } else {
        cell.innerHTML = SLOT_NAMES[slot]+'<b>비어 있음</b>';
      }
      slotGrid.appendChild(cell);
    });
    invList.innerHTML = '';
    const equippedIds = Object.values(DB.equipped);
    const sorted = DB.inv.slice().sort((a,b)=> b.r-a.r);
    if (!sorted.length){
      invList.innerHTML = '<div style="font-size:11px;color:var(--ink-500);padding:10px;">보유 장비가 없습니다. 보스와 엘리트를 처치해 장비를 모으세요.</div>';
    }
    sorted.forEach((item)=>{
      const isEq = equippedIds.includes(item.id);
      const row = document.createElement('div');
      row.className = 'shopItem';
      row.innerHTML = '<div class="info"><div class="nm"><span class="rbadge r'+item.r+'">'+RARITY_NAMES[item.r]+'</span>'
        + item.name + (isEq?' <span style="font-size:9px;color:var(--ink-500);">[장착중]</span>':'') + '</div>'
        + '<div class="ds">'+equipDesc(item)+'</div></div>';
      const eqBtn = document.createElement('button');
      eqBtn.className = 'buy';
      eqBtn.textContent = isEq ? '해제' : '장착';
      eqBtn.addEventListener('click', ()=>{
        if (isEq){ delete DB.equipped[item.slot]; }
        else { DB.equipped[item.slot] = item.id; SFX.play('equip'); }
        saveDB(); renderEquip();
      });
      row.appendChild(eqBtn);
      // 강화 (+9까지, 3강마다 별의 조각 필요)
      if (item.slot!=='relic' && (item.plus||0)<9){
        const plus = item.plus||0;
        const cost = (item.r+1)*30 + plus*25;
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
      if (!isEq){
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

    // 무명검 연마 (발견한 경우)
    if (DB.growth.found){
      const gr = document.createElement('div');
      gr.className = 'shopItem';
      const need = 20 + DB.growth.lv*15;
      gr.innerHTML = '<div class="info"><div class="nm">무명검 연마 <span class="rbadge r4">유일</span></div>'
        + '<div class="ds">현재 Lv'+DB.growth.lv+' ('+DB.growth.xp+'/'+need+' 경험치) — 골드를 갈아 넣어 성장시킨다</div></div>';
      const gBuy2 = document.createElement('button');
      gBuy2.className = 'buy';
      gBuy2.textContent = '60G (+40xp)';
      gBuy2.disabled = DB.gold < 60;
      gBuy2.addEventListener('click', ()=>{
        if (DB.gold < 60) return;
        DB.gold -= 60;
        DB.growth.xp += 40;
        while (DB.growth.xp >= 20 + DB.growth.lv*15){
          DB.growth.xp -= (20 + DB.growth.lv*15);
          DB.growth.lv += 1;
          toast('무명검이 성장했다 — Lv'+DB.growth.lv);
          growthTierToast(DB.growth.lv);
        }
        saveDB(); SFX.play('quest');
        renderShop();
      });
      gr.appendChild(gBuy2);
      shopList.appendChild(gr);
    }
  }

  // ---------- idle panel switching ----------
  function showPanel(name){
    classBox.style.display = name==='class' ? 'flex':'none';
    shopBox.style.display  = name==='shop' ? 'flex':'none';
    equipBox.style.display = name==='equip' ? 'flex':'none';
    questBox.style.display = name==='quest' ? 'flex':'none';
    $('achBox').style.display = name==='ach' ? 'flex':'none';
    $('starBox').style.display = name==='star' ? 'flex':'none';
    shopBtn.classList.toggle('on', name==='shop');
    equipBtn.classList.toggle('on', name==='equip');
    questBtn.classList.toggle('on', name==='quest');
    $('achBtn').classList.toggle('on', name==='ach');
    $('starBtn').classList.toggle('on', name==='star');
    if (name==='shop') renderShop();
    if (name==='equip') renderEquip();
    if (name==='quest') renderQuests();
    if (name==='ach') renderAch();
    if (name==='star'){ setTimeout(()=>{ resizeStarCanvas(); drawStarTree(); }, 30); }
    goldVal.textContent = DB.gold;
  }
  shopBtn.addEventListener('click', ()=> showPanel(shopBox.style.display==='flex'?'class':'shop'));
  equipBtn.addEventListener('click', ()=> showPanel(equipBox.style.display==='flex'?'class':'equip'));
  questBtn.addEventListener('click', ()=> showPanel(questBox.style.display==='flex'?'class':'quest'));
  $('achBtn').addEventListener('click', ()=> showPanel($('achBox').style.display==='flex'?'class':'ach'));
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
    });
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
  })();
  function starAllocated(id){ return id==='center' || !!(DB.star && DB.star.nodes[id]); }
  function starSpent(){ return Object.keys(DB.star.nodes||{}).length; }
  function starAvailPts(){ return (DB.star.pts||0) - starSpent(); }
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
    war:['rusher','paladin','cheol'],
    rng:['archer','sniper','pilot'],
    mag:['manager','voidc'],
    rog:['ninja','reaper','glitch'],
    pri:['necro','bard','returner'],
    mer:['engineer','debug','tourist','slime','gambler','collector'],
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
      const canBuy = !alloc && starAvailPts()>0 && n.links.some(l=>starAllocated(l));
      const R2 = (n.tier==='key'?13 : n.tier==='notable'?9.5 : n.tier==='start'?11 : 6) * starView.scale;
      // 글로우
      if (alloc){
        starCtx.fillStyle = n.color;
        starCtx.globalAlpha = 0.22;
        starCtx.beginPath(); starCtx.arc(p.x,p.y,R2*1.9,0,Math.PI*2); starCtx.fill();
        starCtx.globalAlpha = 1;
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
      if (starHover===id){
        starCtx.strokeStyle = '#fff';
        starCtx.lineWidth = 2;
        starCtx.beginPath(); starCtx.arc(p.x,p.y,R2+6,0,Math.PI*2); starCtx.stroke();
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
    const canBuy = !alloc && starAvailPts()>0 && n.links.some(l=>starAllocated(l));
    const tierName = n.tier==='key' ? '★ 키스톤' : n.tier==='notable' ? '◆ 노터블' : n.tier==='start' ? '기원' : '· 소형';
    const prefix = id.split('_')[0];
    const resCls = RESONANCE[prefix] ? RESONANCE[prefix].map(k=>CLASSES[k]?CLASSES[k].name:k).join('·') : '';
    info.innerHTML = '<b style="color:'+n.color+';">'+tierName+' — '+n.name+'</b><br>'+n.desc
      + (resCls ? '<br><span style="opacity:0.75;">공명 직업: '+resCls+' (공명 시 추가 보너스)</span>' : '')
      + '<br><span style="opacity:0.7;">'+(alloc?'습득 완료':(canBuy?'클릭하여 습득 (1P)':'연결된 노드를 먼저 습득하세요'))+'</span>';
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
      const n = STAR_NODES[hit];
      const canBuy = !starAllocated(hit) && starAvailPts()>0 && n.links.some(l=>starAllocated(l));
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
  $('starResetBtn').addEventListener('click', ()=>{
    if (starSpent()===0) return;
    if (DB.gold < 200){ toast('리스펙 비용 200G 부족'); SFX.play('hit'); return; }
    DB.gold -= 200;
    DB.star.nodes = {};
    saveDB();
    toast('운명 성도 리스펙 완료');
    SFX.play('coin');
    goldVal.textContent = DB.gold;
    drawStarTree();
  });

  // ---------- classes (9) ----------
  const CLASSES = {
    manager: {
      name:'관리자', tag:'위성 & 쿨감',
      desc:'[위성]으로 시작. 모든 쿨다운 -10%.',
      weapon:'satellite',
      apply:(p)=>{ p.cdr*=0.90; }
    },
    sniper: {
      name:'저격수', tag:'치명타',
      desc:'[추적 탄환]으로 시작. 20% 확률 3배 치명타.',
      weapon:'missile',
      apply:(p)=>{ p.critChance=0.20; p.critMult=3.0; }
    },
    rusher: {
      name:'돌격병', tag:'속도 & 흡혈',
      desc:'[역장]으로 시작. 이동 +20%, 처치 시 회복. [중갑 가능]',
      weapon:'aura',
      apply:(p)=>{ p.speed*=1.2; p.lifesteal=2; }
    },
    archer: {
      name:'궁수', tag:'관통',
      desc:'[화살]로 시작. 관통 +1, 공격속도 +15%.',
      weapon:'arrow',
      apply:(p)=>{ p.pierce+=1; p.rateMult*=1.15; }
    },
    ninja: {
      name:'닌자', tag:'대시 특화', cost:250,
      desc:'[수리검]으로 시작. 대시 쿨다운 -40%, 회피 10%.',
      weapon:'shuriken',
      apply:(p)=>{ p.dashCdMax*=0.6; p.dodge=0.10; }
    },
    engineer: {
      name:'기술자', tag:'골드 & 행운', cost:400,
      desc:'[낙뢰]로 시작. 골드 +25%, 아이템 드랍 2배.',
      weapon:'lightning',
      apply:(p)=>{ p.goldMult*=1.25; p.luck*=2; }
    },
    paladin: {
      name:'성기사', tag:'방어', cost:600,
      desc:'[역장]으로 시작. 받는 피해 -20%, 최대체력 +25. [중갑 가능]',
      weapon:'aura',
      apply:(p)=>{ p.dmgTaken=0.8; p.maxHp+=25; p.hp+=25; }
    },
    reaper: {
      name:'사신', tag:'처형', cost:800,
      desc:'[낫]으로 시작. 체력 12% 이하 일반 적 즉사, 흡혈 1.',
      weapon:'scythe',
      apply:(p)=>{ p.execThresh=Math.max(p.execThresh,0.12); p.lifesteal+=1; }
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
      desc:'무작위 무기 2개로 시작. 아이템 드랍 2배, 상자에서 나오는 모든 것이 한 단계 좋아진다.',
      weapon:'random2',
      apply:(p)=>{ p.luck*=2; p.chestPlus=true; }
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
      apply:(p)=>{ p.luck*=1.8; p.jackpotMult=3; p.dodge=0.05; }
    },
    returner: {
      name:'회귀자', tag:'히든', hidden:true,
      condDesc:'업적 12개 달성 시 해금',
      cond:()=> achCount()>=12,
      desc:'모든 것을 기억한 채 돌아왔다. 속성을 4계열까지 선택 가능, 리롤 +2.',
      weapon:'missile',
      apply:(p)=>{ p.attrLimit=4; rerollsLeft+=2; }
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
  function openJobChoice(tier){
    if (tier===1){
      const list = JOB_TREES[player.classKey] || JOB_TREES.manager;
      // 성도 공명 연동: 공명 노드 10개 이상이면 전직이 '공명 강화'로 진화 (같은 전직도 성도에 따라 달라진다)
      const rc = resonantCount(player.classKey);
      const resonant = rc >= 10;
      const opts = list.map(j=>({
        l:'전직: '+(resonant?'✦ ':'')+j.n,
        d:j.d + (resonant ? ' — 공명 강화: 추가 피해 +'+(rc*0.4).toFixed(0)+'%' : ''),
        fx:()=>{
          j.fx(player); player.jobs.push(j.n);
          if (resonant){ player.dmgMult *= 1 + 0.004*rc; }
          toast('1차 전직 — '+j.n+'!'+(resonant?' (성도 공명 ×'+rc+')':''));
          effects.push({ type:'rays', x:player.x, y:player.y, life:0.7, age:0 });
          SFX.play('win');
        }
      }));
      openEvent({ t:'1차 전직'+(resonant?' — 성도가 공명한다':''), d:'길이 갈라진다. 이 런에서 걸어갈 길을 선택하세요.', opts });
    } else if (tier===2){
      const base = player.jobs[0] || '';
      const opts = JOB2_OPTIONS.map(j=>({ l:'2차 전직: '+base+' · '+j.n, d:j.d, fx:()=>{
        j.fx(player); player.jobs.push(j.n);
        toast('2차 전직 — '+base+' · '+j.n+'!');
        SFX.play('win');
      } }));
      openEvent({ t:'2차 전직', d:'선택한 길이 깊어진다.', opts });
    } else {
      const rc = resonantCount(player.classKey);
      const opts = JOB3_OPTIONS.map(j=>({ l:'3차 전직: '+j.n, d:j.d, fx:()=>{
        j.fx(player, rc);
        player.jobs.push(j.n==='초월'?'초월':j.n);
        toast('3차 전직 — '+j.n+'! (공명 ×'+rc+')');
        freeze=Math.max(freeze,0.25);
        SFX.play('win');
      } }));
      openEvent({ t:'3차 전직 — 정점', d:'모든 길의 끝. 존재가 한 단계 올라선다.', opts });
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
    for (const g in RESONANCE) if (RESONANCE[g].includes(classKey)) return g;
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
        const gl = DB.gweps.bow.lv||1;
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
        const gl = DB.gweps.tome.lv||1;
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
        const gl = DB.gweps.blade.lv||1;
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
        const gl = DB.growth.lv||1;
        const g = 2 + gl*1.1; // 성장 완만화 (난이도 급감 방지)
        const t = [1,1.25,1.55,1.9,2.3][w.lv-1];
        // 성장 단계 진화 보너스: Lv10 각성 / Lv20 해방 / Lv35 진명검 / Lv60 초월 / Lv100 귀일
        const tier = gl>=100?1.7 : gl>=60?1.5 : gl>=35?1.35 : gl>=20?1.2 : gl>=10?1.1 : 1;
        const branch = (player&&player.growthBranch==='slash') ? 1.18 : 1;
        return g * t * tier * branch * ((player&&player.gwDmg)||1) * (w.evolved?1.5:1);
      },
      count:(w)=> 1 + (DB.growth.lv>=15?1:0) + (DB.growth.lv>=30?1:0) + ((player&&player.growthBranch==='gale')?1:0) + ((player&&player.gwCount)||0) + (w.evolved?1:0)
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
    { n:'고급', w:28,  m:1.5, cls:'r1' },
    { n:'희귀', w:12,  m:2.0, cls:'r2' },
    { n:'영웅', w:4,   m:3.0, cls:'r3' },
    { n:'전설', w:1.0, m:4.5, cls:'r4' },
    { n:'신화', w:0,   m:6.0, cls:'r5m' },  // 일반 롤에선 안 나옴 — 신화 노드 전용 (트리당 유일)
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
      { key:'f_inferno',name:'대화재',     tier:3, max:1, desc:(m)=>'[궁극] 12초마다 대폭염 (피해 '+R(60*m)+') + 모든 화상 즉시 폭발', apply:(p,m)=>{ p.inferno=60*m; } },
      { key:'f_myth',   name:'겁화의 군주', tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 화상 피해 2배, 화상 확률 +20%p, 대화재 쿨다운 -30%', apply:(p)=>{ p.burnDps=(p.burnDps||6)*2; p.burnChance=Math.min(0.95,(p.burnChance||0)+0.2); p.infernoCdMult=0.7; } },
    ]},
    frost: { name:'서리', nodes:[
      { key:'i_chill',  name:'냉기 부여',  tier:1, max:3, desc:(m)=>'타격 시 냉기 중첩 — 중첩당 이속 -'+R((0.15+0.03*m)*100)+'% (최대 3중첩)', apply:(p,m)=>{ p.chillOn=true; p.chillPower=Math.min(0.28,(p.chillPower||0.12)+0.03*m); } },
      { key:'i_lance',  name:'얼음창',     tier:1, max:3, desc:(m)=>'4초마다 관통 얼음창 — 25% 확률 1초 빙결 (피해 +'+R(10*m)+')', apply:(p,m)=>{ if(!p.lanceLv) p.lanceDmg=16; p.lanceLv+=1; p.lanceDmg+=10*m; } },
      { key:'i_armor',  name:'서리 갑옷',  tier:2, max:2, desc:(m)=>'피격 시 주변 적 빙결 1.2초, 받는 피해 -'+R(6*m)+'%', apply:(p,m)=>{ p.frostArmor=(p.frostArmor||0)+1; p.dmgTaken*=1-0.06*m; } },
      { key:'i_deep',   name:'혹한',       tier:2, max:2, desc:(m)=>'빙결·냉기 상태의 적에게 피해 +'+R(10*m)+'%', apply:(p,m)=>{ p.frozenAmp+=0.10*m; } },
      { key:'i_calm',   name:'냉정',       tier:1, max:3, desc:(m)=>'쿨다운 -'+R(3*m)+'%, 냉기 효과 +'+R(2*m)+'%p', apply:(p,m)=>{ p.cdr*=1-0.03*m; p.chillPower=Math.min(0.32,(p.chillPower||0.12)+0.02*m); p.chillOn=true; } },
      { key:'i_shatter',name:'분쇄',       tier:2, max:2, desc:(m)=>'빙결·냉기 상태의 적 피해 +'+R(8*m)+'%', apply:(p,m)=>{ p.frozenAmp+=0.08*m; } },
      { key:'i_abszero',name:'절대영도',   tier:3, max:1, desc:(m)=>'[궁극] 14초마다 화면 전체 2초 빙결 + 피해 '+R(40*m), apply:(p,m)=>{ p.absZero=40*m; } },
      { key:'i_myth',   name:'영원한 겨울', tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 빙결·냉기 적 피해 +35%, 냉기 최대 효과, 서리 갑옷 강화', apply:(p)=>{ p.frozenAmp+=0.35; p.chillPower=0.32; p.chillOn=true; p.frostArmor=(p.frostArmor||0)+1; } },
    ]},
    volt: { name:'번개', nodes:[
      { key:'l_shock',  name:'감전',       tier:1, max:4, desc:(m)=>'타격 시 '+R(8*m)+'% 확률 연쇄 번개 (피해 +'+R(5*m)+')', apply:(p,m)=>{ p.shockChance=Math.min(0.6,p.shockChance+0.08*m); p.shockDmg=(p.shockDmg||10)+5*m; } },
      { key:'l_charge', name:'축전',       tier:1, max:3, desc:(m)=>'공격속도 +'+R(6*m)+'%, 대시 후 2초간 감전 확률 100%', apply:(p,m)=>{ p.rateMult*=1+0.06*m; p.chargeBoost=true; if(!p.shockDmg) p.shockDmg=10; } },
      { key:'l_field',  name:'자기장',     tier:2, max:2, desc:(m)=>'4초마다 주변에 감전 펄스 (피해 +'+R(6*m)+')', apply:(p,m)=>{ p.magfieldLv+=1; p.magfieldDmg=(p.magfieldDmg||9)+6*m; } },
      { key:'l_over',   name:'과전압',     tier:2, max:1, desc:(m)=>'감전 연쇄가 한 번 더 튄다', apply:(p,m)=>{ p.chainPlus=1; } },
      { key:'l_cap',    name:'축전기',     tier:1, max:3, desc:(m)=>'쿨다운 -'+R(3*m)+'%, 감전 피해 +'+R(4*m), apply:(p,m)=>{ p.cdr*=1-0.03*m; p.shockDmg=(p.shockDmg||10)+4*m; } },
      { key:'l_flash',  name:'전광석화',   tier:2, max:2, desc:(m)=>'이동속도 +'+R(4*m)+'%, 공격속도 +'+R(4*m)+'%', apply:(p,m)=>{ p.speed*=1+0.04*m; p.rateMult*=1+0.04*m; } },
      { key:'l_thor',   name:'뇌신 강림',  tier:3, max:1, desc:(m)=>'[궁극] 11초마다 거대 낙뢰 8연타 (피해 '+R(30*m)+')', apply:(p,m)=>{ p.thor=30*m; } },
      { key:'l_myth',   name:'천둥의 심장', tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 감전 연쇄 +2회, 감전 확률 +15%p, 감전 피해 +15', apply:(p)=>{ p.chainPlus=(p.chainPlus||0)+2; p.shockChance=Math.min(0.8,(p.shockChance||0)+0.15); p.shockDmg=(p.shockDmg||10)+15; } },
    ]},
    acid: { name:'부식', nodes:[
      { key:'a_shred',  name:'방어 붕괴',  tier:1, max:4, desc:(m)=>'타격 시 '+R(10*m)+'% 확률 부식 — 중첩당 받는 피해 +15% (5초)', apply:(p,m)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.10*m); } },
      { key:'a_melt',   name:'용해',       tier:1, max:3, desc:(m)=>'부식된 적은 초당 '+R(3*m)+' 추가 피해', apply:(p,m)=>{ p.dissolveDps=(p.dissolveDps||0)+3*m; } },
      { key:'a_cloud',  name:'산성 구름',  tier:2, max:2, desc:(m)=>'7초마다 산성 구름 장판 (초당 피해 +'+R(5*m)+', 부식 부여)', apply:(p,m)=>{ p.acidLv+=1; p.acidDps=(p.acidDps||7)+5*m; } },
      { key:'a_burst',  name:'침식 폭발',  tier:2, max:1, desc:(m)=>'부식 2중첩 이상 적이 죽으면 산성 폭발이 퍼진다', apply:(p,m)=>{ p.acidBurst=true; } },
      { key:'a_blood',  name:'맹독 혈액',  tier:1, max:3, desc:(m)=>'부식 확률 +'+R(6*m)+'%p, 재생 +'+R1(0.2*m), apply:(p,m)=>{ p.corrodeChance=Math.min(0.7,p.corrodeChance+0.06*m); p.regen+=0.2*m; } },
      { key:'a_endur',  name:'내성',       tier:2, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%, 용해 피해 +'+R(2*m)+'/초', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; p.dissolveDps=(p.dissolveDps||0)+2*m; } },
      { key:'a_collapse',name:'완전 붕괴', tier:3, max:1, desc:(m)=>'[궁극] 부식 최대 4중첩·효과 강화, 15초마다 전 화면 부식', apply:(p,m)=>{ p.collapse=true; p.corrodeMaxS=4; p.corrodeAmp=0.22; } },
      { key:'a_myth',   name:'만물 분해',  tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 부식 중첩당 받는 피해 +30%로 강화, 용해 피해 2배', apply:(p)=>{ p.corrodeAmp=0.30; p.dissolveDps=(p.dissolveDps||3)*2; } },
    ]},
    boom: { name:'폭발', nodes:[
      { key:'e_boom',   name:'유폭',       tier:1, max:4, desc:(m)=>'처치 시 '+R(10*m)+'% 확률 폭발 (피해 +'+R(10*m)+')', apply:(p,m)=>{ p.explodeChance=Math.min(0.6,(p.explodeChance||0)+0.10*m); p.explodeDmg=(p.explodeDmg||18)+10*m; } },
      { key:'e_dash',   name:'돌파 폭발',  tier:1, max:3, desc:(m)=>'대시할 때 주변 폭발 (피해 +'+R(18*m)+')', apply:(p,m)=>{ if(!p.dashBlast) p.dashBlast=20; p.dashBlast+=18*m; } },
      { key:'e_mines',  name:'지뢰 살포',  tier:2, max:2, desc:(m)=>'5초마다 지뢰 2개 설치 (피해 +'+R(10*m)+')', apply:(p,m)=>{ p.mineLv+=1; p.mineDmg=(p.mineDmg||22)+10*m; } },
      { key:'e_chain2', name:'연쇄 기폭',  tier:2, max:2, desc:(m)=>'유폭·지뢰 피해 +'+R(15*m)+'%', apply:(p,m)=>{ p.explodeDmg=(p.explodeDmg||18)*(1+0.15*m); p.mineDmg=(p.mineDmg||30)*(1+0.15*m); } },
      { key:'e_pack',   name:'추가 화약',  tier:1, max:3, desc:(m)=>'유폭 확률 +'+R(8*m)+'%p, 폭발 피해 +'+R(6*m), apply:(p,m)=>{ p.explodeChance=Math.min(0.6,(p.explodeChance||0)+0.08*m); p.explodeDmg=(p.explodeDmg||18)+6*m; } },
      { key:'e_vest',   name:'폭발 조끼',  tier:2, max:2, desc:(m)=>'받는 피해 -'+R(3*m)+'%, 돌파 폭발 피해 +'+R(10*m), apply:(p,m)=>{ p.dmgTaken*=1-0.03*m; p.dashBlast=(p.dashBlast||20)+10*m; } },
      { key:'e_carpet', name:'융단 폭격',  tier:3, max:1, desc:(m)=>'[궁극] 16초마다 8발 폭격 (피해 '+R(45*m)+')', apply:(p,m)=>{ p.orbital=45*m; } },
      { key:'e_myth',   name:'메가톤',     tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 모든 폭발 피해 +40%, 유폭 확률 +15%p', apply:(p)=>{ p.explodeDmg=(p.explodeDmg||18)*1.4; p.mineDmg=(p.mineDmg||30)*1.4; p.explodeChance=Math.min(0.75,(p.explodeChance||0)+0.15); } },
    ]},
    mech: { name:'기계', nodes:[
      { key:'m_turret', name:'자동 터렛',  tier:1, max:2, desc:(m)=>'자동 사격 터렛 +1기 (피해 +'+R(4*m)+')', apply:(p,m)=>{ p.turretLv+=1; p.turretDmg=(p.turretDmg||7)+4*m; } },
      { key:'m_tune',   name:'정비',       tier:1, max:4, desc:(m)=>'모든 쿨다운 -'+R(4*m)+'%, 재생 +'+R1(0.25*m), apply:(p,m)=>{ p.cdr*=1-0.04*m; p.regen+=0.25*m; } },
      { key:'m_ammo',   name:'강화 탄자',  tier:2, max:3, desc:(m)=>'관통 +'+(m<2?1:2)+', 투사체 피해 +'+R(8*m)+'%', apply:(p,m)=>{ p.pierce+=(m<2?1:2); p.projMult*=1+0.08*m; } },
      { key:'m_heat',   name:'포탑 과열',  tier:2, max:2, desc:(m)=>'터렛 공격속도 +'+R(15*m)+'%', apply:(p,m)=>{ p.turretRate*=1+0.15*m; } },
      { key:'m_repair', name:'자가 수리',  tier:1, max:3, desc:(m)=>'재생 +'+R1(0.4*m)+', 쿨다운 -'+R(2*m)+'%', apply:(p,m)=>{ p.regen+=0.4*m; p.cdr*=1-0.02*m; } },
      { key:'m_scrap',  name:'재활용',     tier:2, max:2, desc:(m)=>'골드 +'+R(6*m)+'%, 터렛 피해 +'+R(4*m), apply:(p,m)=>{ p.goldMult*=1+0.06*m; p.turretDmg=(p.turretDmg||10)+4*m; } },
      { key:'m_od',     name:'오버드라이브',tier:3, max:1, desc:(m)=>'[궁극] 15초마다 5초간 공격속도 +'+R((0.3+0.1*m)*100)+'%·이동속도 +20%', apply:(p,m)=>{ p.odCd=15; p.odPower=0.3+0.1*m; } },
      { key:'m_myth',   name:'기계 반란',  tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 터렛 +2기, 터렛 공격속도 +30%, 관통 +1', apply:(p)=>{ p.turretLv=(p.turretLv||0)+2; if(!p.turretDmg) p.turretDmg=12; p.turretRate*=1.3; p.pierce+=1; } },
    ]},
    psi: { name:'염동', nodes:[
      { key:'p_pulse',  name:'염동 파동',   tier:1, max:4, desc:(m)=>'7초마다 주변을 밀쳐내는 파동 (피해 +'+R(8*m)+')', apply:(p,m)=>{ if(!p.pulseLv) p.pulseDmg=14; p.pulseLv+=1; p.pulseDmg+=8*m; } },
      { key:'p_shield', name:'사이오닉 방벽', tier:1, max:2, desc:(m)=>'주기적으로 피해 1회 무효 (충전 '+R1(Math.max(5,12-1.5*m))+'초)', apply:(p,m)=>{ const cd=Math.max(5,12-1.5*m); p.shieldCdMax = p.shieldCdMax? Math.min(p.shieldCdMax,cd) : cd; p.shieldT=0; } },
      { key:'p_slow',   name:'정신 압박',   tier:2, max:3, desc:(m)=>'모든 적 이동속도 -'+R(4*m)+'%', apply:(p,m)=>{ p.slowAll*=1-0.04*m; } },
      { key:'p_grav',   name:'중력 붕괴',   tier:2, max:1, desc:(m)=>'염동 파동이 적을 끌어당기며 피해 +30%', apply:(p,m)=>{ p.pulsePull=true; } },
      { key:'p_focus',  name:'정신 집중',   tier:1, max:3, desc:(m)=>'모든 피해 +'+R(4*m)+'%, 파동 피해 +'+R(5*m), apply:(p,m)=>{ p.dmgMult*=1+0.04*m; if(p.pulseLv) p.pulseDmg+=5*m; else { p.pulseLv=1; p.pulseDmg=20+5*m; } } },
      { key:'p_ward',   name:'결계',        tier:2, max:2, desc:(m)=>'받는 피해 -'+R(4*m)+'%, 방벽 충전 -1초', apply:(p,m)=>{ p.dmgTaken*=1-0.04*m; if(p.shieldCdMax) p.shieldCdMax=Math.max(4,p.shieldCdMax-1); } },
      { key:'p_blink',  name:'점멸',        tier:3, max:1, desc:(m)=>'[궁극] 대시가 순간이동이 되고 도착 지점에 대폭발 (피해 '+R(55*m)+')', apply:(p,m)=>{ p.blink=55*m; } },
      { key:'p_myth',   name:'초월자',      tier:4, max:1, myth:true, desc:()=>'[신화 · 유일] 파동 피해 +60%·적을 끌어당김, 모든 적 이속 -8%', apply:(p)=>{ if(!p.pulseLv){ p.pulseLv=1; p.pulseDmg=20; } p.pulseDmg=Math.round(p.pulseDmg*1.6); p.pulsePull=true; p.slowAll*=0.92; } },
    ]}
  };
  const SPEC_TREES = ['fire','frost','volt','acid','boom','mech','psi'];
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
    if (player.weapons.length < (player.weaponCap||MAX_WEAPONS)){
      Object.keys(WEAPONS).forEach((key)=>{
        if (key==='nameless' && !DB.growth.found) return; // 유일 무기: 발견해야 등장
        if (key==='gbow' && !DB.gweps.bow.found) return;
        if (key==='gtome' && !DB.gweps.tome.found) return;
        if (key==='gblade' && !DB.gweps.blade.found) return;
        if (!ownedWeapon(key) && !banned.has('wn_'+key)){
          const def = WEAPONS[key];
          pool.push({
            key:'wn_'+key, kind:'weaponnew',
            name: key==='nameless' ? def.name+' Lv'+DB.growth.lv : def.name,
            tag: key==='nameless' ? '유일 무기' : '새 무기',
            desc:def.desc,
            apply:()=>{ addWeapon(key); }
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
    const actives = activeSpecTrees();
    const lockOthers = actives.length >= (player.attrLimit||3);
    const candidates = lockOthers ? actives : SPEC_TREES.slice();
    if (focusOverride && candidates.includes(focusOverride)){ focusTree = focusOverride; }
    else focusTree = candidates.length ? candidates[(Math.random()*candidates.length)|0] : null;
    focusOverride = null;
    const SLOT_LIMIT = 5; // 트리당 하위테크 종류 슬롯 (신화 제외)
    Object.keys(TREES).forEach((tkey)=>{
      const tree = TREES[tkey];
      if (!tree.common && tkey !== focusTree) return;
      const pts = player.tech[tkey]||0;
      // 슬롯: 한 트리에서 서로 다른 테크는 5종까지 — 그 후엔 찍은 것만 성장
      const distinct = tree.common ? 0 : tree.nodes.filter(n=>(player.techPicks[n.key]||0)>0).length;
      for (const node of tree.nodes){
        if (banned.has(node.key)) continue;
        const picks = player.techPicks[node.key]||0;
        if (picks >= node.max) continue;
        if (!tree.common && !node.myth && picks===0 && distinct>=SLOT_LIMIT) continue;
        const gate = tree.common ? COMMON_GATE : TIER_GATE;
        if (node.tier>=2 && pts < (gate[node.tier]||99)) continue;
        // 신화 노드: 등급 고정 (트리당 유일한 빌드 정점)
        let ri = node.myth ? 5 : rollCardRarity();
        // 숙련: 이미 찍은 테크는 35% 확률로 한 등급 위로 등장
        let honed = false;
        if (!node.myth && picks>0 && ri<4 && Math.random()<0.35){ ri+=1; honed=true; }
        // 수확 체감: 같은 테크를 반복해서 찍을수록 효율이 70%씩 감소 (무한 성장 차단)
        const m = node.myth ? 1 : CARD_RARITY[ri].m * Math.pow(0.7, picks);
        const cat = node.myth ? '신화' : node.tier===3 ? '전용기' : (NODE_CAT[node.key]||'전술');
        pool.push({
          key:node.key, kind:'tech', tkey, node, rarity:ri, myth:!!node.myth,
          name:node.name, tag:(tree.common ? tree.name : tree.name+' · '+cat) + (honed?' · 숙련':''),
          desc:node.desc(m), cap:node.tier===3,
          apply:()=>{
            node.apply(player, m);
            player.tech[tkey] = (player.tech[tkey]||0) + 1;
            player.techPicks[node.key] = picks + 1;
            renderTreeRow();
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
        const ri = rollCardRarity();
        const m = CARD_RARITY[ri].m * Math.pow(0.7, picks); // 수확 체감
        pool.push({
          key:ct.key, kind:'ctech', rarity:ri, ctag:true,
          name:ct.name, tag:CLASSES[player.classKey].name+' 전용',
          desc:ct.desc(m),
          apply:()=>{ ct.apply(player, m); player.techPicks[ct.key] = picks+1; }
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
        const ri = rollCardRarity();
        const m = CARD_RARITY[ri].m * Math.pow(0.7, picks); // 수확 체감
        pool.push({
          key:gt.key, kind:'gwtech', rarity:ri, ctag:true,
          name:gt.name, tag:'무명검 전용',
          desc:gt.desc(m),
          apply:()=>{ gt.apply(player, m); player.techPicks[gt.key] = picks+1; }
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
  ];
  function openArcanaChoice(){
    const pool = ARCANA.slice();
    const opts = [];
    for (let i=0;i<3;i++){
      const a = pool.splice((Math.random()*pool.length)|0,1)[0];
      opts.push({ l:a.n, d:a.d, fx:()=>{ a.fx(player); toast('계약 체결: '+a.n); SFX.play('quest'); } });
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
    // 유일 무기: 아직 발견 못했다면 상인이 녹슨 검을 판다 (50%)
    if (!DB.growth.found && Math.random()<0.5){
      const cost0 = Math.round(150 * (player.merchantDisc||1));
      opts.push({
        l:'녹슨 검 ('+cost0+'G)', d:'[유일 무기] 형편없는 검. 하지만 벨수록 성장한다는 소문이...',
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
      const cost = Math.round(of.cost * (player.merchantDisc||1)); // 운명 '큰손' 할인
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
    // 스킬바 (플레이 중 표시)
    const sb = $('skillBar');
    sb.style.display = (state==='playing'||state==='paused') ? 'flex' : 'none';
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
      nv.textContent = (rift.mode==='kill' ? (killCount-rift.kills0)+'/'+rift.need+' ' : rift.mode==='elite' ? '정예 '+enemies.filter(e=>e.riftElite).length+'기 ' : '생존 ')+Math.ceil(rift.t)+'s';
    } else if (runQuest){
      nk.textContent = '의뢰';
      const prog = runQuest.type==='kill' ? (killCount-runQuest.start)+'/'+runQuest.goal
                 : runQuest.type==='combo' ? combo+'/'+runQuest.goal
                 : '무피격';
      nv.textContent = prog+' '+Math.ceil(runQuest.t)+'s';
    } else if (trialT>0){
      nk.textContent = '시련'; nv.textContent = fmtTime(Math.ceil(trialT));
    } else if (bosses.length>0){
      nk.textContent = 'BOSS'; nv.textContent = '전투!';
    } else if (!rootDefeated && MAP.finalAt - elapsed <= (bossSpawnedOnce ? BOSS_INTERVAL - bossTimer : BOSS_FIRST_AT - elapsed)){
      nk.textContent = 'FINAL'; nv.textContent = fmtTime(Math.max(0, MAP.finalAt - elapsed));
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
    const g = Math.max(1, Math.round(v * player.goldMult * MAP.mult.reward * perilR() * (feverTimer>0?2:1)));
    runGold += g;
    return g;
  }

  // ---------- enemies ----------
  // 위험도 (디아블로식 난이도): 적 강화 ×(1+0.35n), 보상 ×(1+0.25n)
  // 위험도 60단계: 20까지는 급하게, 그 이후는 완만하게 (하지만 끝없이) 오른다
  function perilE(){ const p=DB.peril||0; return 1 + 0.35*Math.min(p,20) + 0.22*Math.max(0,p-20); }
  function perilR(){ const p=DB.peril||0; return 1 + 0.25*Math.min(p,20) + 0.12*Math.max(0,p-20); }
  // v4.4 난이도 재설계: 시간 + 플레이어 파워(레벨·테크·성장무기)에 함께 반응하는 적응형 곡선
  function powerScale(){
    if (!player) return 1;
    let pw = Math.max(0, player.level - 8) * 0.022;              // 레벨이 오를수록
    let tpts = 0; for (const k in player.tech) tpts += player.tech[k];
    pw += Math.max(0, tpts - 6) * 0.012;                          // 테크를 찍을수록
    if (ownedWeapon('nameless')) pw += (DB.growth.lv||0) * 0.006; // 성장무기가 강할수록
    return 1 + Math.min(1.2, pw);                                 // 최대 +120%
  }
  function hpScale(){ return (1 + elapsed*0.019 + Math.pow(Math.max(0,elapsed-270)*0.0052,1.7)) * MAP.mult.ehp * perilE() * powerScale(); }
  function dmgScale(){ const p=DB.peril||0; return (1 + elapsed*0.0026 + Math.max(0,elapsed-360)*0.0012) * MAP.mult.edmg * (1 + 0.25*Math.min(p,20) + 0.15*Math.max(0,p-20)) * (0.85 + powerScale()*0.15); }
  function spdScale(){ return 1 + Math.min(0.45, elapsed*0.0011); }
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
    rift = { mode:mode.key, t:(mode.key==='live'?25:mode.key==='elite'?40:35), need, kills0:killCount, elite0:0, returnX:player.x, returnY:player.y };
    // 아득히 먼 별공간으로 이동 (무한 필드의 외딴 좌표)
    player.x += 50000; player.y += 50000;
    trialT = Math.max(trialT, rift.t); // 시련 스폰 2배 재활용
    for (let k=0;k<10;k++){ const a=(Math.PI*2/10)*k; enemies.push(makeEnemy(Math.random()<0.3?'fish':'swarm', player.x+Math.cos(a)*260, player.y+Math.sin(a)*260, false)); }
    if (mode.key==='elite'){ for (let k=0;k<2;k++){ const a=Math.random()*Math.PI*2; const e=makeEnemy('brute', player.x+Math.cos(a)*320, player.y+Math.sin(a)*320, true); e.riftElite=true; enemies.push(e); rift.elite0++; } }
    showBossBanner('차원 균열 — '+mode.name, '시련: '+mode.d(need), '#5c4a8a');
    toast('◈ 시련 시작! 성공 시 보물과 재료를 얻는다');
    screenDimT = Math.max(screenDimT||0, 0.4);
    SFX.play('warn');
  }
  function exitRift(success){
    player.x = rift.returnX; player.y = rift.returnY;
    player.invuln = Math.max(player.invuln, 1.5);
    if (success){
      dropItem(player.x+40, player.y, 'chest');
      DB.mats.shard += 1; saveDB();
      const g = gainGold(40+(DB.peril||0)*5);
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
      if (r<0.50) type='gold';
      else if (r<0.66) type='heal';
      else if (r<0.78) type='magnet';
      else if (r<0.86) type='bomb';
      else if (r<0.90) type='freeze';
      else if (r<0.915) type='scroll';   // 리롤 두루마리 (1.5%)
      else if (r<0.925) type='stamp';    // 제외 도장 (1%)
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
      const eqs = Object.values(DB.equipped).map(id=>DB.inv.find(v=>v.id===id)).filter(v=>v && (v.plus||0)<9);
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
    // 유일 무기 발견 (4%)
    if (!DB.growth.found && Math.random()<0.04){
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
    if (roll < 0.45){
      // 장비 드랍 테이블: 유물 > 유니크 > 세트 > 태초 > 일반 생성
      const pr = DB.peril||0;
      let r2 = Math.random();
      if (player.chestPlus) r2 *= 0.6;
      // 희귀도 재설계: 유니크·태초는 극악 (위험도가 올려주는 구조)
      if (r2 < 0.04) addEquip(genRelic());
      else if (r2 < 0.04 + 0.012 + pr*0.004) addEquip(genUnique());
      else if (r2 < 0.04 + 0.012 + pr*0.004 + 0.05) addEquip(genSetItem());
      else if (pr>=5 && r2 < 0.04 + 0.012 + pr*0.004 + 0.05 + 0.006 + pr*0.002) addEquip(genPrimal());
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
    burst(e.x,e.y, e.elite?20:(e.type==='brute'?16:8), e.elite?230:(e.type==='brute'?200:130));
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
    if (player.lifesteal>0){ player.hp = Math.min(player.maxHp, player.hp + player.lifesteal*player.healMult); }

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
      dropItem(e.x, e.y, 'chest');
      if (Math.random()<0.16) dropItem(e.x+30, e.y, 'whet'); // 강화석: 런 중 장비를 즉석 강화 (희귀)
      const g = gainGold(15 + ((Math.random()*10)|0));
      addTextNum(e.x, e.y-16, '+'+g+'G');
      freeze = Math.max(freeze, 0.05);
      SFX.play('boom');
    } else if (Math.random() < 0.013*player.luck){
      dropItem(e.x, e.y);
    } else if (Math.random() < 0.05*player.luck*(player.goldDropMod||1)){
      dropItem(e.x, e.y, 'gold');
    }
    enemies.splice(idx,1);
  }

  // ---------- bosses (15) ----------
  let bossPool = []; // 셔플된 보스 순서 (매판 랜덤)
  function nextBossKey(){
    const list = MAP.bosses;
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
    const comic = (!def.finale && cpool && Math.random()<0.4) ? cpool[(Math.random()*cpool.length)|0] : null;
    const comicMult = comic ? 1.35 : 1;
    const hp = def.hp * encScale * empMult * comicMult * MAP.mult.ehp;
    const b = {
      isBoss:true, key, kind:def.kind,
      name: (comic ? '『'+comic+'』 ' : '') + (emp?'강화 ':'') + def.name,
      comic: !!comic,
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
    showBossBanner(BOSS_TITLES[key]||'', b.name, BOSS_ACCENTS ? BOSS_ACCENTS[key] : null);
    shake = Math.min(20, shake+10);
    SFX.play('warn');
  }

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
    burst(b.x,b.y, 34, 240, 0xe8c56a);
    FX.ring(b.x, b.y, 0xe8c56a, 22);
    effects.push({ type:'ring', x:b.x, y:b.y, life:0.5, age:0, r0:20, r1:220 });
    const n = 5;
    for (let i=0;i<n;i++){
      const a = (Math.PI*2/n)*i;
      orbs.push({ x:b.x+Math.cos(a)*14, y:b.y+Math.sin(a)*14, value:Math.ceil(b.xpValue/n), r:6 });
    }
    dropItem(b.x, b.y, 'chest');
    const essN = (b.finale ? 1 : (Math.random()<0.5?1:0)) + Math.floor((DB.peril||0)/4); // 정수 드랍 하향 (일반 보스 50%)
    DB.mats.essence += essN;
    toast('◆ 보스의 정수 +'+essN+' ('+DB.mats.essence+')');
    let goldBase = b.finale ? 200 : 45;
    if (b.emp) goldBase = Math.round(goldBase*1.6);
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

  // ---------- boss AI (returns true if the player died) ----------
  function updateBoss(b, dt){
    const def = BOSS_TYPES[b.key];
    const bx = player.x-b.x, by = player.y-b.y;
    const bd = Math.hypot(bx,by)||1;
    const ds = dmgScale();
    const empN = b.emp ? 1 : 0;

    // 시간 초과 기믹 — 90초 안에 못 잡으면 보스가 '초조'해진다 (단계적 강화)
    b.aliveT = (b.aliveT||0) + dt;
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
    // WebGL 글로우 파티클 (Pixi 레이어) — 큰 폭발일수록 화려하게
    if (n>=14) FX.burst(x, y, fxColor||0xffffff, Math.floor(n*0.7), spread||120, 0.5);
    if (particles.length > 380) return;
    for (let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const s = (spread||120)*(0.4+Math.random()*0.8);
      particles.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.35+Math.random()*0.25, age:0, r:1.5+Math.random()*2 });
    }
  }
  function nearestTarget(){
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
    const i = n-2;
    const sk = player.skills[i];
    if (!sk || player.skCds[i] > 0) return;
    sk.fx();
    player.skCds[i] = sk.cd * player.cdr;
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
    const isCrit = Math.random()<player.critChance;
    let d = dmg * player.projMult * (isCrit?player.critMult:1);
    if (player.goldPower) d *= 1 + Math.min(0.3, runGold*0.0003); // 변혁: 황금 혈맥
    if (player.feverDmg && feverTimer>0) d *= 1.15; // 선율가: 피버 강화
    d *= buffMult('dmg'); // 스킬 버프
    if (player.gambleDmg) d *= (player.gambleFloor?0.8:0.5) + Math.random()*(player.gambleCeil?2.2:2); // 도박사: 피해가 매번 주사위
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
    const rate = player.rateMult * feverRate() * (player.dashHasteT>0 ? 1.35 : 1) * (player.odT>0 ? 1+player.odPower : 1) * (player.rageT>0 ? 1.3 : 1) * buffMult('rate');

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
      if (z.t<=0){ zones.splice(i,1); continue; }
      for (let k=enemies.length-1;k>=0;k--){
        const e = enemies[k];
        if (Math.hypot(e.x-z.x,e.y-z.y) < z.r+e.r){
          e.hp -= z.dps*dt;
          if (z.type==='fire' && Math.random()<dt*2){ e.burnT=2.5; e.burnDps=Math.max(e.burnDps||0, (player.burnDps||5)*D); }
          if (z.type==='acid' && Math.random()<dt*2){ e.corrodeS=Math.min(player.corrodeMaxS,(e.corrodeS||0)+1); e.corrodeT=5; }
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
    if (player.hitFlash>0) player.hitFlash -= dt;
    if (player.regen>0){ player.hp = Math.min(player.maxHp, player.hp + player.regen*player.healMult*dt); }
    // 무명검 흡명의 형: 검을 든 동안 처치 회복 +1
    if (player.growthBranch==='leech' && !player.__leechApplied && ownedWeapon('nameless')){
      player.lifesteal += 1; player.__leechApplied = true;
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
    if (player.hordeMod) interval /= player.hordeMod; // 물량 계약
    const cap = Math.min(150, 18 + Math.floor(elapsed/3.5));
    if (spawnTimer >= interval){
      spawnTimer = 0;
      const burstN = 1 + (elapsed>60?1:0) + (elapsed>150?1:0) + (elapsed>360?1:0);
      for (let k=0;k<burstN;k++){ if (enemies.length < cap) spawnEnemy(); }
    }
    if (elapsed >= ELITE_FIRST_AT + eliteCount*ELITE_INTERVAL){ eliteCount+=1; spawnElite(); }
    if (elapsed >= WAVE_FIRST_AT + waveCount*WAVE_INTERVAL){ waveCount+=1; spawnWave(); }
    // 시간의 압박: 60초마다 살아있는 모든 적이 강해진다 (필드에 오래 남은 몹도 위협 유지)
    eraTimer += dt;
    if (eraTimer >= 60){
      eraTimer = 0;
      for (const e of enemies){
        e.maxHp *= 1.1; e.hp *= 1.1;
        e.dmg = Math.round(e.dmg*1.08);
      }
      if (elapsed > 90) toast('⏰ 시간의 압박 — 모든 적이 강해졌다');
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
      else if (rift.mode==='live') done = false; // 시간을 버티면 성공
      if (done) exitRift(true);
      else if (rift.t <= 0) exitRift(rift.mode==='live');
    }
    tickRunQuest(dt);
    // NPC 의뢰인 스폰
    if (elapsed >= 45 + clientCount*90 && clients.length===0 && !runQuest){
      clientCount += 1;
      const cp = ringSpawnPos(240, 380);
      clients.push({ x:cp.x, y:cp.y, r:16, age:0 });
      toast('수상한 의뢰인이 나타났다 (!)');
    }
    for (let i=clients.length-1;i>=0;i--){
      const cl = clients[i];
      cl.age += dt;
      if (cl.age > 35 || Math.hypot(player.x-cl.x, player.y-cl.y) > 1400){ clients.splice(i,1); continue; }
      if (Math.hypot(player.x-cl.x, player.y-cl.y) < player.r+cl.r+6){
        clients.splice(i,1);
        openClientQuest();
        return;
      }
    }
    if (elapsed >= 90 + merchantCount*120 && merchants.length===0){
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
        // Q 수동 시전 — 4초 안에 안 누르면 자동 발동
        player.ultChargedT = (player.ultChargedT||0) + dt;
        if (player.ultFireReq || player.ultChargedT > 4){
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
    const finalAlive = bosses.some(b=>b.finale);
    if (!finalAlive && !rootDefeated && elapsed>=MAP.finalAt){
      spawnBoss(MAP.final);
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

    // bosses
    for (let i=bosses.length-1;i>=0;i--){
      const b = bosses[i];
      if (b.hitCd>0) b.hitCd -= dt;
      if (tickStatus(b, dt, true)){ defeatBoss(i); continue; }
      if (updateBoss(b, dt)) return;
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
      p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt;
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
    burst(player.x,player.y,12,160);
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
    while (player.xp >= player.xpNext){
      player.xp -= player.xpNext;
      player.level += 1;
      player.xpNext = Math.floor(10 + player.level*6.5 + player.level*player.level*0.5); // 고레벨 가속 차단 (2차 곡선)
      pendingLevelUps += 1;
    }
    if (player.level >= 30) unlockAch('lv30');
    // 스킬 습득 체크 (레벨 도달 시)
    const pool = SKILL_POOLS[player.classKey];
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
    // 전직 (레벨 10 / 25 / 40) — 3차까지
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
    const path = [CLASSES[p.classKey].name].concat(p.jobs||[]).join(' → ') + (p.awakening ? ' ★'+p.awakening : '');
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
    if (focusTree) luHint.textContent = '⚡ ['+TREES[focusTree].name+'] 속성 강림 — 하나를 선택하세요 (1~6 · R 리롤)';
    currentChoices.forEach((u,i)=>{
      const el = document.createElement('div');
      el.className = 'card' + (u.cap?' cap':'') + (u.myth?' myth':'') + (u.rarity!==undefined&&!u.myth?' rar'+u.rarity:'');
      const num = '<div class="num">0'+(i+1)+'</div>';
      const tag = u.tag ? '<div class="tag"'+(u.ctag?' style="background:var(--ink-900);color:#e8c56a;"':'')+'>'+u.tag+'</div>' : '';
      const rb = (u.rarity!==undefined) ? '<span class="rbadge '+(u.jackpot?'r4':CARD_RARITY[u.rarity].cls)+'">'+(u.jackpot?'잭팟':CARD_RARITY[u.rarity].n)+'</span>' : '';
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
      else { state='playing'; last = performance.now(); }
    }, 120);
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
    setTimeout(()=>{ state='playing'; last=performance.now(); updateHud(); }, 120);
  }

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
    renderEquip();
    overlay.classList.remove('hidden');
  }
  function closeInv(){
    if (state!=='inv') return;
    overlay.classList.add('hidden');
    equipBox.style.display='none';
    state = 'playing';
    last = performance.now();
  }

  // ---------- NPC 의뢰인 (런 중 퀘스트) ----------
  let clients = [], clientCount = 0, runQuest = null;
  let pendingSkills = [], pendingAwaken = false, pendingJobs = [];
  let dailyPending = false, dailyRun = false, origRandom = Math.random;
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
    }
    if (done){
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
    const cls = CLASSES[classKey];
    if (cls){
      cls.apply(player);
      if (cls.weapon==='random2'){
        // 글리치: 무작위 무기 2개
        const keys = Object.keys(WEAPONS);
        const first = keys[(Math.random()*keys.length)|0];
        let second = keys[(Math.random()*keys.length)|0];
        while (second===first) second = keys[(Math.random()*keys.length)|0];
        addWeapon(first); addWeapon(second);
      } else {
        addWeapon(cls.weapon);
      }
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
    const starGain = Math.floor(player.level/4);
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
    const isNew = bankRun();
    const firstClear = !DB.mapCleared[selMap];
    DB.mapCleared[selMap] = true;
    unlockAch('clear_'+selMap);
    DB.star.pts = (DB.star.pts||0) + 5;
    toast('클리어 보너스: 운명 포인트 +5P');
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
    tourist:'#e0a94f', slime:'#5db06a', gambler:'#c94f8a', collector:'#8a6a4f'
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
    drawHumanoid(player.x, player.y, { face:player.faceX, walk, gear:player.classKey, scale:bodyScale, robe:player.classKey==='reaper' });
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
    monday:'영원히 돌아오는 재앙', deadline:'모든 것을 불태우는 최후 통첩',
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
    monday:'#5c6a8a', deadline:'#c9403a',
    awakenOseojin:'#3b82c4', awakenEunJae:'#b8362e', abyssGoDokGeun:'#3aa895'
  };
  function drawBoss(b){
    const t = performance.now()/1000;
    const face = player.x > b.x ? 1 : -1;
    const ink = PAL.ink, ink2 = PAL.ink2, mid = PAL.mid;

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
        const tt = Math.min(1, z.t/z.maxT);
        const tint = z.type==='fire' ? 0xe2603f : z.type==='void' ? 0x9a6fc4 : 0x6faa4e;
        fxZones.push({ x:z.x, y:z.y, r:z.r, tint, alpha:0.22*tt });
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
  function drawProjectiles(){
    const fxBullets = [];
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
        const ac2 = (p.imbue && COLORS[p.imbue]) || CLASS_COLORS[player.classKey] || PAL.ink;
        ctx.strokeStyle = ac2;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.stroke();
        ctx.fillStyle = ac2;
        ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(2,-3); ctx.lineTo(2,3); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        // 투사체 색: 각인 원소 > 직업 악센트
        const pc = p.kind==='fireball' ? COLORS.fire
                 : p.kind==='icelance' ? COLORS.frost
                 : (p.imbue && COLORS[p.imbue]) ? COLORS[p.imbue]
                 : (CLASS_COLORS[player.classKey] || PAL.ink);
        // Pixi 2단계: 일반 탄환은 WebGL 글로우 스프라이트로 렌더 (캔버스 드로우 스킵)
        if (FX.enabled && !p.kind){
          fxBullets.push({ x:p.x, y:p.y, r:p.r, tint: parseInt((pc[0]==='#'?pc.slice(1):'ffffff'),16) });
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
    if (FX.enabled) FX.drawBullets(fxBullets);
  }
  function drawHostileShots(){
    for (const p of hostileShots){
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

