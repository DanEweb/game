export const SLOT_NAMES = { head:'머리', body:'몸통', hand:'장갑', foot:'신발', cloak:'망토', acc1:'악세서리 I', acc2:'악세서리 II', relic:'전용 유물' };
export const SLOT_KEYS = ['head','body','hand','foot','cloak','acc1','acc2','relic'];
export const NORMAL_SLOTS = ['head','body','hand','foot','cloak','acc1','acc2'];
export const HEAVY_OK = { rusher:true, paladin:true, cheol:true }; // 중갑 착용 가능 직업
export const RARITY_NAMES = ['일반','고급','희귀','에픽','전설','유니크','태초'];
export const RARITY_PREFIX = ['낡은','견고한','정밀한','영웅의','전설의','유일한','태초의'];
export const SELL_PRICE = [5,15,40,100,250,600,1500];
  // 유니크 고정 장비 (r5) — 보스 상자·뽑기에서 낮은 확률. v6.42 전수조사: 전설(r4)을 확실히 상회하도록 상향
export const UNIQUE_POOL = [
    { slot:'head',  name:'왕관 없는 자의 관', stats:[{k:'atk',v:20},{k:'crit',v:12}], affix:'execute' },
    { slot:'body',  name:'맥동하는 심장갑',   stats:[{k:'hp',v:100},{k:'regen',v:1.8}], affix:'firstaid' },
    { slot:'hand',  name:'번개를 쥔 장갑',    stats:[{k:'cdr',v:15},{k:'crit',v:10}], affix:'overdrive' },
    { slot:'foot',  name:'바람도둑의 장화',   stats:[{k:'spd',v:16},{k:'magnet',v:45}], affix:'overdrive' },
    { slot:'cloak', name:'그림자 재단사의 망토', stats:[{k:'spd',v:11},{k:'atk',v:12}], affix:'thorns' },
    { slot:'acc1',  name:'탐식가의 인장',     stats:[{k:'gold',v:32},{k:'hp',v:45}], affix:'blast' },
    { slot:'acc2',  name:'시계태엽 부적',     stats:[{k:'cdr',v:16},{k:'regen',v:1.2}], affix:'firstaid' },
    { slot:'head',  name:'포식자의 두개골',   stats:[{k:'atk',v:24},{k:'hp',v:-20}], affix:'execute' },
    { slot:'body',  name:'잿불 코트',        stats:[{k:'atk',v:14},{k:'cdr',v:11}], affix:'blast' },
    { slot:'acc1',  name:'첫 번째 동전',      stats:[{k:'gold',v:42}], affix:'blast' },
    // v6.42 신규 유니크
    { slot:'head',  name:'심연을 본 눈가리개', stats:[{k:'crit',v:15},{k:'spd',v:8}], affix:'execute' },
    { slot:'body',  name:'용린 흉갑',         stats:[{k:'hp',v:130},{k:'atk',v:8}], affix:'thorns' },
    { slot:'hand',  name:'거인 학살자의 건틀릿', stats:[{k:'atk',v:18},{k:'hp',v:40}], affix:'giantkill' },
    { slot:'foot',  name:'지평선 도약자',     stats:[{k:'spd',v:20},{k:'crit',v:6}], affix:'overdrive' },
    { slot:'cloak', name:'왕을 삼킨 그림자',  stats:[{k:'atk',v:15},{k:'cdr',v:8}], affix:'kingslayer' },
    { slot:'acc2',  name:'영원히 도는 나침반', stats:[{k:'magnet',v:60},{k:'cdr',v:10}], affix:'firstaid' },
  ];
  // 세트 장비 — 같은 세트를 모으면 보너스. v6.42: 세트 개별 스탯 상향(r4급)
export const SET_DEFS = {
    pilgrim: { name:'심연 순례자', bonus2:'모든 피해 +10%', bonus3:'원소 발동 +8%p, 쿨다운 -8%',
      items:[
        { slot:'head', name:'순례자의 두건', stats:[{k:'atk',v:11},{k:'cdr',v:7}] },
        { slot:'body', name:'순례자의 장삼', stats:[{k:'hp',v:65},{k:'atk',v:8}] },
        { slot:'foot', name:'순례자의 짚신', stats:[{k:'spd',v:11},{k:'regen',v:0.8}] },
      ] },
    king: { name:'황금 왕', bonus2:'골드 +25%', bonus3:'행운 +30%, 골드 100당 투사체 피해 +3%',
      items:[
        { slot:'hand',  name:'황금 왕의 반지장갑', stats:[{k:'gold',v:19},{k:'atk',v:8}] },
        { slot:'cloak', name:'황금 왕의 어깨망토', stats:[{k:'gold',v:16},{k:'hp',v:50}] },
        { slot:'acc1',  name:'황금 왕의 옥새',    stats:[{k:'gold',v:22},{k:'magnet',v:35}] },
      ] },
    reaperset: { name:'창백한 수확자', bonus2:'처형 임계 +5%p', bonus3:'처치 시 회복 +1, 치명 배율 +0.4',
      items:[
        { slot:'head',  name:'수확자의 조면', stats:[{k:'crit',v:9},{k:'atk',v:8}] },
        { slot:'cloak', name:'수확자의 수의', stats:[{k:'atk',v:10},{k:'spd',v:7}] },
        { slot:'acc2',  name:'수확자의 모래시계', stats:[{k:'cdr',v:10},{k:'crit',v:7}] },
      ] },
  };
