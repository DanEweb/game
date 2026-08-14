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
    //  🔴 v6.166 『전조(前兆)』 — 37직업 전원. 하나의 서사로 묶었다(사용자 지시).
    //   설정: **성물(絶名)이 되기 전, 이름이 지워지기 시작한 물건.**
    //   그래서 유물은 전부 '부서진 것·남겨진 것·멎은 것'이고, 각자 그 직업 성물의 앞 이야기다
    //   (예: 사무라이 성물 '잔심의 도' ← 유물 '이 빠진 칼집' / 궁수 '침묵하는 활' ← '소리를 잃은 시위')
    //   ⚠ 이전에는 **13직업분뿐이라 24직업이 유물 자체가 없었다** — 성물과 같은 종류의 구멍이었다
    samurai:     { name:'이 빠진 칼집', desc:'치명 피해 +12%, 공격속도 +5%' },
    sniper:      { name:'남겨진 탄피 하나', desc:'치명타 확률 +10%' },
    archer:      { name:'소리를 잃은 시위', desc:'공격속도 +10%, 관통 +1' },
    rusher:      { name:'부러진 창끝', desc:'이동속도 +8%, 흡혈 +1' },
    paladin:     { name:'그을린 심지', desc:'받는 피해 -8%, 최대체력 +30' },
    manager:     { name:'멎은 관측 기록', desc:'쿨다운 -8%, 피해 +5%' },
    ninja:       { name:'지워진 인장', desc:'회피 +8%' },
    engineer:    { name:'멈춘 태엽 조각', desc:'골드 +15%, 쿨다운 -5%' },
    reaper:      { name:'녹슨 낫날', desc:'처형 임계 +5%p, 흡혈 +1' },
    pilot:       { name:'찢어진 비행 일지', desc:'소환물 피해 +20%, 공격속도 +5%' },
    cheol:       { name:'식은 쇳조각', desc:'받는 피해 -6%, 최대체력 +20' },
    voidc:       { name:'찢겨나간 한 장', desc:'모든 원소 발동 +6%p' },
    necro:       { name:'주인 잃은 종', desc:'유령 지속 +4초, 최대 수 +1' },
    bard:        { name:'끊어진 현', desc:'콤보 유지 +1초, 골드 +10%' },
    duelist:     { name:'한 짝뿐인 장갑', desc:'보스·엘리트 피해 +12%' },
    monk:        { name:'흩어진 염주알', desc:'공격속도 +12%' },
    gymbro:      { name:'휘어진 바벨 봉', desc:'최대체력 +12%' },
    baeksu:      { name:'눌린 방석 자국', desc:'받는 피해 -7%, 재생 +0.6' },
    madman:      { name:'금 간 가면 조각', desc:'피해 +10% / 받는 피해 +4%' },
    exhero:      { name:'녹슨 손잡이', desc:'피해 +8%, 최대체력 +25' },
    shadow:      { name:'그림자만 남은 칼집', desc:'치명타 확률 +8%, 이동속도 +5%' },
    blackcat:    { name:'여덟 번째 방울', desc:'회피 +7%, 행운 +12%' },
    tombraider:  { name:'깨진 봉인 조각', desc:'아이템 드랍 +20%, 수집 +40' },
    mumyeong:    { name:'이름이 지워진 명패', desc:'피해 +6%, 쿨다운 -6%' },
    glitch:      { name:'깨진 세이브 파일', desc:'카드 상위 등급 확률 +25%' },
    debug:       { name:'끊긴 로그 한 줄', desc:'리롤 +1, 쿨다운 -6%' },
    returner:    { name:'멈춘 손목시계', desc:'쿨다운 -10%' },
    druid:       { name:'마른 나뭇가지', desc:'재생 +1.2, 회복 +20%' },
    tourist:     { name:'빛바랜 엽서', desc:'이동속도 +10%, 골드 +12%' },
    stonks:      { name:'찢어진 차트', desc:'골드 +25%' },
    gambler:     { name:'한 닢의 칩', desc:'행운 +20%, 치명 피해 +10%' },
    collector:   { name:'빈 진열장 열쇠', desc:'아이템 드랍 +25%' },
    slime:       { name:'굳은 점액 한 방울', desc:'최대체력 +10%, 받는 피해 -4%' },
    contributor: { name:'삭제된 브랜치', desc:'카드 +1장, 피해 +6%' },
    specialist:  { name:'용도를 잃은 부품', desc:'쿨다운 -7%, 공격속도 +6%' },
    runeknight:  { name:'지워진 룬 한 획', desc:'원소 발동 +8%p' },
    commander:   { name:'부러진 지휘봉', desc:'소환물 피해 +25%' },
  };
