// game.js(IIFE 모놀리스) → Vite ES 모듈 구조로 재구성
// - src/data/*.js 로 순수 데이터 테이블 추출
// - src/game.js 는 IIFE 래퍼 제거 + import 문 부착
import fs from 'fs';

let js = fs.readFileSync('game.js', 'utf8');
fs.mkdirSync('src/data', { recursive: true });

// IIFE 래퍼 제거
js = js.replace(/^\(function\(\)\{\s*\n\s*"use strict";\s*\n/, '');
js = js.replace(/\}\)\(\);\s*$/, '');

// [start, endMarker) 구간을 잘라 모듈 파일로 저장하고 원본에서 제거
function extract(startMarker, endMarker, file, exportNames){
  const s = js.indexOf(startMarker);
  if (s < 0) throw new Error('start not found: ' + startMarker.slice(0, 40));
  const e = js.indexOf(endMarker, s);
  if (e < 0) throw new Error('end not found: ' + endMarker.slice(0, 40));
  const chunk = js.slice(s, e);
  js = js.slice(0, s) + js.slice(e);
  const body = chunk.replace(/^  const /gm, 'export const ')
                    .replace(/^  function /gm, 'export function ')
                    .replace(/^  let /gm, 'export let ');
  fs.writeFileSync('src/data/' + file, body.trimEnd() + '\n', 'utf8');
  return exportNames;
}

const imports = [];

// 1) 맵 + 색상 팔레트
imports.push('import { MAPS, MAP_ORDER, COLORS } from "./data/maps.js";');
extract('  const MAPS = {', '  let selMap =', 'maps.js');

// 2) 보스 스펙
imports.push('import { BOSS_TYPES } from "./data/bosses.js";');
extract('  const BOSS_TYPES = {', '  function nextBossKey(){', 'bosses.js');

// 3) 장비 데이터 A (슬롯/희귀도/유니크/세트)
imports.push('import { SLOT_NAMES, SLOT_KEYS, NORMAL_SLOTS, HEAVY_OK, RARITY_NAMES, RARITY_PREFIX, SELL_PRICE, UNIQUE_POOL, SET_DEFS } from "./data/equipment.js";');
extract('  const SLOT_NAMES = {', '  function genUnique(){', 'equipment.js');

// 4) 장비 데이터 B (스탯/특성/저주/유물)
imports.push('import { EQ_STATS, EQ_AFFIX, EQ_NOUNS, EQ_CURSES, RELICS } from "./data/equipment-stats.js";');
extract('  const EQ_STATS = [', '  function genRelic(){', 'equipment-stats.js');

// 5) 운명 성도 데이터
imports.push('import { STAR_BRANCHES, TRANSFORM_KEYS } from "./data/startree.js";');
extract('  const STAR_BRANCHES = [', '  const STAR_NODES = {};', 'startree.js');

js = imports.join('\n') + '\n\n' + js;
fs.writeFileSync('src/game.js', js, 'utf8');

// 진입점 + 스타일
fs.renameSync('style.css', 'src/style.css');
fs.writeFileSync('src/main.js', 'import "./style.css";\nimport "./game.js";\n', 'utf8');

// index.html → Vite 엔트리
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', '');
html = html.replace('<script src="game.js"></script>', '<script type="module" src="/src/main.js"></script>');
fs.writeFileSync('index.html', html, 'utf8');

fs.unlinkSync('game.js');
console.log('restructure done. src/game.js:', js.length, 'bytes,', imports.length, 'data modules');
