export const EQ_STATS = [
    { k:'atk',    n:'공격력',     min:3,  max:10, pct:true },
    { k:'hp',     n:'최대체력',   min:10, max:45 },
    { k:'spd',    n:'이동속도',   min:2,  max:7,  pct:true },
    { k:'cdr',    n:'쿨다운 감소', min:2,  max:7,  pct:true },
    { k:'crit',   n:'치명타 확률', min:2,  max:7,  pct:true },
    { k:'gold',   n:'골드 획득',   min:5,  max:16, pct:true },
    { k:'magnet', n:'수집 범위',   min:10, max:40 },
    { k:'regen',  n:'체력 재생',   min:2,  max:8,  dec:true }, // /10
  ];
export const EQ_AFFIX = [
    { k:'execute',   n:'처형',     d:'체력 15% 이하 일반 적 즉시 처치' },
    { k:'blast',     n:'폭발탄',   d:'처치 시 10% 확률 소형 폭발' },
    { k:'thorns',    n:'가시',     d:'접촉 피해의 60% 반사' },
    { k:'firstaid',  n:'응급처치', d:'피격 시 25% 확률 12 회복' },
    { k:'overdrive', n:'질주 회로', d:'대시 후 1.5초 공격속도 +35%' },
    { k:'giantkill', n:'거인 살해', d:'엘리트·악몽급에게 주는 피해 +15%' },
    { k:'kingslayer',n:'왕 시해',   d:'보스에게 주는 피해 +12%' },
  ];
export const EQ_NOUNS = {
    head:['모자','헬멧','후드','머리띠'], body:['재킷','수트','로브','조끼'],
    hand:['장갑','건틀릿','밴드','팔찌'], foot:['운동화','부츠','그리브','슬리퍼'],
    cloak:['망토','스카프','케이프','담요'],
    acc1:['배지','반지','목걸이','칩'], acc2:['부적','시계','열쇠고리','메달']
  };
  // 저주 장비 — 스탯 +50% 대신 저주가 하나 붙는다
export const EQ_CURSES = [
    { k:'noheal',   d:'회복 효과 -50%' },
    { k:'glass',    d:'받는 피해 +15%' },
    { k:'slowdash', d:'대시 쿨다운 +25%' },
    { k:'greed',    d:'획득 골드 -30%' },
    { k:'fragile',  d:'최대체력 -15%' },
  ];
  // 직업 전용 유물 — 해당 직업으로 플레이할 때만 효과 발동
export const RELICS = {
    manager:  { name:'마스터 키',      desc:'쿨다운 -8%, 공격력 +5%' },
    sniper:   { name:'정밀 스코프',    desc:'치명타 확률 +10%' },
    rusher:   { name:'전투 자극제',    desc:'이동속도 +8%, 흡혈 +1' },
    archer:   { name:'깃털 화살통',    desc:'공격속도 +10%, 관통 +1' },
    ninja:    { name:'연막 두루마리',  desc:'회피 +8%' },
    engineer: { name:'휴대용 발전기',  desc:'골드 +15%, 쿨다운 -5%' },
    paladin:  { name:'수호 문장',      desc:'받는 피해 -8%, 최대체력 +30' },
    reaper:   { name:'원혼의 램프',    desc:'처형 임계값 +5%p, 흡혈 +1' },
    pilot:    { name:'예비 드론 코어', desc:'드론 피해 +20%, 공격속도 +5%' },
    cheol:    { name:'강철 심장',     desc:'받는 피해 -6%, 최대체력 +20' },
    voidc:    { name:'공허 파편',     desc:'모든 원소 발동 +6%p' },
    necro:    { name:'양치기의 종',   desc:'유령 지속시간 +4초, 최대 수 +1' },
    bard:     { name:'낡은 현',      desc:'콤보 유지 +1초, 골드 +10%' },
  };
