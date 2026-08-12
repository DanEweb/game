export const MAPS = {
    field: {
      key:'field', name:'그레이 필드', tag:'표준',
      info:'표준 감시 구역 · 배율 ×1.0',
      mult:{ ehp:1, edmg:1, reward:1 },
      bosses:['oseojin','parktaeyoung','wonGeun','minGi','seulgi','monday','overtime','kickboard','eggRice','kyivDrone'],
      final:'awakenOseojin', finalAt:600,
      unlockAfter:null,
      skins:{ swarm:'moth', normal:'ghost', brute:'golem', shooter:'drone', splitter:'slime' },
      extraMob:null,
      pal:{ bg:'#eeeeec', grid:'rgba(0,0,0,0.045)', ink:'#202124', ink2:'#45474a', mid:'#75777a', soft:'#a9abac', deco:'rgba(0,0,0,0.05)' }
    },
    archive: {
      key:'archive', name:'침묵의 서고', tag:'위험',
      info:'적 강화 ×1.5 / 보상 ×1.5',
      mult:{ ehp:1.55, edmg:1.35, reward:1.5 },
      bosses:['byungWoo','jiEun','eunJae','yuJinKong','jungWoo','deadline','rentday','trumpTariff','loanRate','xiPingping'],
      final:'awakenEunJae', finalAt:720,
      unlockAfter:'field',
      skins:{ swarm:'book', normal:'wisp', brute:'tome', shooter:'inkbow', splitter:'inkslime' },
      extraMob:'binder',
      pal:{ bg:'#e7e2d5', grid:'rgba(70,55,25,0.06)', ink:'#2b251c', ink2:'#4d4436', mid:'#7d7361', soft:'#aaa08b', deco:'rgba(70,55,25,0.07)' }
    },
    abyss: {
      key:'abyss', name:'심연 회로', tag:'극한',
      info:'적 강화 ×2.2 / 보상 ×2.2',
      mult:{ ehp:2.3, edmg:1.8, reward:2.2 },
      bosses:['seonJeong','spaceStar','nukNukEX','goDokGeun','monday','deadline','aiface','maoJu','moscowBear','trumpTariff'],
      final:'abyssGoDokGeun', finalAt:900,
      unlockAfter:'archive',
      skins:{ swarm:'bug', normal:'glitch', brute:'firewall', shooter:'turret', splitter:'virus' },
      extraMob:'kamikaze',
      pal:{ bg:'#232427', grid:'rgba(255,255,255,0.05)', ink:'#e8e8e6', ink2:'#c7c8c6', mid:'#8f9194', soft:'#5c5e61', deco:'rgba(255,255,255,0.05)' }
    },
    // ---- v6.46 신규 맵 10종 — 관문 보스가 필드의 주인으로 군림하는 테마 구역 ----
    office: {
      key:'office', name:'만성 야근 사옥', tag:'사회',
      info:'적 강화 ×2.8 / 보상 ×2.8 — 퇴근이 없는 건물',
      mult:{ ehp:3.0, edmg:2.1, reward:2.8 },
      bosses:['overtime','deadline','aiface','monday','rentday','byungWoo','jungWoo','minGi','seulgi','loanRate'],
      final:'teamleadEx', finalAt:780,
      unlockAfter:'abyss',
      skins:{ swarm:'moth', normal:'ghost', brute:'golem', shooter:'drone', splitter:'slime' },
      extraMob:'kamikaze',
      pal:{ bg:'#e3e7ec', grid:'rgba(30,50,80,0.06)', ink:'#1d2530', ink2:'#3d4756', mid:'#6e7a8a', soft:'#a3adba', deco:'rgba(30,50,80,0.06)' }
    },
    market: {
      key:'market', name:'명절 대목 시장', tag:'사회',
      info:'적 강화 ×3.4 / 보상 ×3.4 — "너 결혼은 언제 하니?"',
      mult:{ ehp:3.7, edmg:2.4, reward:3.4 },
      bosses:['eggRice','rentday','maoJu','seulgi','jiEun','oseojin','wonGeun','monday','kickboard','yuJinKong'],
      final:'relativesEx', finalAt:780,
      unlockAfter:'office',
      skins:{ swarm:'book', normal:'wisp', brute:'golem', shooter:'inkbow', splitter:'slime' },
      extraMob:'binder',
      pal:{ bg:'#f0e4d0', grid:'rgba(120,80,20,0.06)', ink:'#33281a', ink2:'#554832', mid:'#83745c', soft:'#b0a288', deco:'rgba(120,80,20,0.07)' }
    },
    tariffLine: {
      key:'tariffLine', name:'관세 전선', tag:'국제',
      info:'적 강화 ×4.1 / 보상 ×4.1 — 국경 위 무역 전쟁터',
      mult:{ ehp:4.5, edmg:2.8, reward:4.1 },
      bosses:['trumpTariff','xiPingping','maoJu','eggRice','kyivDrone','moscowBear','loanRate','parktaeyoung','byungWoo','seonJeong'],
      final:'tariffEx2', finalAt:840,
      unlockAfter:'market',
      skins:{ swarm:'bug', normal:'ghost', brute:'firewall', shooter:'turret', splitter:'slime' },
      extraMob:'kamikaze',
      pal:{ bg:'#efe0dc', grid:'rgba(140,40,30,0.06)', ink:'#33201c', ink2:'#57403a', mid:'#876a63', soft:'#b59a93', deco:'rgba(140,40,30,0.07)' }
    },
    frontline: {
      key:'frontline', name:'동토의 전선', tag:'국제',
      info:'적 강화 ×4.9 / 보상 ×4.9 — 눈보라 속 동원령의 땅',
      mult:{ ehp:5.4, edmg:3.2, reward:4.9 },
      bosses:['moscowBear','kyivDrone','parktaeyoung','eunJae','goDokGeun','spaceStar','seonJeong','byungWoo','trumpTariff','jungWoo'],
      final:'warzoneEx', finalAt:840,
      unlockAfter:'tariffLine',
      skins:{ swarm:'bug', normal:'wisp', brute:'firewall', shooter:'turret', splitter:'inkslime' },
      extraMob:'kamikaze',
      pal:{ bg:'#1f2430', grid:'rgba(210,225,255,0.05)', ink:'#e6ebf5', ink2:'#c2cad8', mid:'#8b93a5', soft:'#565e6e', deco:'rgba(210,225,255,0.05)' }
    },
    towers: {
      key:'towers', name:'깡통 전세 타워', tag:'사회',
      info:'적 강화 ×5.8 / 보상 ×5.8 — 등기부가 거짓말하는 곳',
      mult:{ ehp:6.4, edmg:3.7, reward:5.8 },
      bosses:['loanRate','rentday','overtime','aiface','jiEun','wonGeun','minGi','seulgi','deadline','xiPingping'],
      final:'jeonseEx', finalAt:900,
      unlockAfter:'frontline',
      skins:{ swarm:'moth', normal:'glitch', brute:'golem', shooter:'drone', splitter:'virus' },
      extraMob:'binder',
      pal:{ bg:'#e2ece5', grid:'rgba(20,90,50,0.06)', ink:'#1c2f24', ink2:'#3c5546', mid:'#6d8578', soft:'#a2b5a9', deco:'rgba(20,90,50,0.06)' }
    },
    feed: {
      key:'feed', name:'무한 스크롤 피드', tag:'디지털',
      info:'적 강화 ×6.9 / 보상 ×6.9 — 알고리즘이 당신을 알고 있다',
      mult:{ ehp:7.6, edmg:4.3, reward:6.9 },
      bosses:['aiface','nukNukEX','spaceStar','xiPingping','kyivDrone','deadline','jiEun','minGi','seonJeong','overtime'],
      final:'aialgoEx', finalAt:900,
      unlockAfter:'towers',
      skins:{ swarm:'bug', normal:'glitch', brute:'firewall', shooter:'turret', splitter:'virus' },
      extraMob:'kamikaze',
      pal:{ bg:'#17191f', grid:'rgba(140,220,255,0.05)', ink:'#dfe8f2', ink2:'#b9c5d2', mid:'#828e9c', soft:'#4d5866', deco:'rgba(140,220,255,0.05)' }
    },
    heatisland: {
      key:'heatisland', name:'폭염 열섬', tag:'재난',
      info:'적 강화 ×8.2 / 보상 ×8.2 — 밤에도 식지 않는 도시',
      mult:{ ehp:9.0, edmg:5.0, reward:8.2 },
      bosses:['byungWoo','eggRice','monday','eunJae','yuJinKong','parktaeyoung','moscowBear','spaceStar','goDokGeun','trumpTariff'],
      final:'heatwaveEx', finalAt:900,
      unlockAfter:'feed',
      skins:{ swarm:'moth', normal:'wisp', brute:'golem', shooter:'inkbow', splitter:'slime' },
      extraMob:'kamikaze',
      pal:{ bg:'#f2ddc8', grid:'rgba(180,80,20,0.07)', ink:'#38220f', ink2:'#5c3d22', mid:'#8f6a48', soft:'#c09b76', deco:'rgba(180,80,20,0.08)' }
    },
    nightnoise: {
      key:'nightnoise', name:'소음의 밤', tag:'사회',
      info:'적 강화 ×9.8 / 보상 ×9.8 — 새벽 3시, 위층에서 무언가 구른다',
      mult:{ ehp:10.8, edmg:5.8, reward:9.8 },
      bosses:['jungWoo','seulgi','jiEun','overtime','rentday','goDokGeun','nukNukEX','eunJae','kickboard','monday'],
      final:'upstairsEx', finalAt:960,
      unlockAfter:'heatisland',
      skins:{ swarm:'bug', normal:'ghost', brute:'tome', shooter:'drone', splitter:'inkslime' },
      extraMob:'binder',
      pal:{ bg:'#211f2a', grid:'rgba(200,180,255,0.05)', ink:'#e8e4f2', ink2:'#c5c0d4', mid:'#8d879e', soft:'#575264', deco:'rgba(200,180,255,0.05)' }
    },
    exchange: {
      key:'exchange', name:'영끌 거래소', tag:'사회',
      info:'적 강화 ×11.5 / 보상 ×11.5 — 상한가와 나락 사이',
      mult:{ ehp:12.7, edmg:6.8, reward:11.5 },
      bosses:['loanRate','trumpTariff','xiPingping','aiface','rentday','moscowBear','spaceStar','nukNukEX','deadline','maoJu'],
      final:'yeongkkeulEx', finalAt:960,
      unlockAfter:'nightnoise',
      skins:{ swarm:'moth', normal:'glitch', brute:'firewall', shooter:'turret', splitter:'virus' },
      extraMob:'kamikaze',
      pal:{ bg:'#2a2620', grid:'rgba(255,215,120,0.05)', ink:'#f0e9da', ink2:'#d2c9b6', mid:'#9a917e', soft:'#5f584a', deco:'rgba(255,215,120,0.05)' }
    },
    grayend: {
      key:'grayend', name:'잿빛 끝자락', tag:'종막',
      info:'적 강화 ×14 / 보상 ×14 — 세계의 색이 바래는 곳',
      mult:{ ehp:15.5, edmg:8.0, reward:14 },
      bosses:['goDokGeun','nukNukEX','spaceStar','seonJeong','eunJae','moscowBear','trumpTariff','xiPingping','maoJu','aiface'],
      final:'grayoneEx', finalAt:1080,
      unlockAfter:'exchange',
      skins:{ swarm:'bug', normal:'glitch', brute:'firewall', shooter:'turret', splitter:'virus' },
      extraMob:'kamikaze',
      pal:{ bg:'#141416', grid:'rgba(255,255,255,0.04)', ink:'#ececea', ink2:'#cccccb', mid:'#929293', soft:'#59595b', deco:'rgba(255,255,255,0.04)' }
    }
  };
export const MAP_ORDER = ['field','archive','abyss','office','market','tariffLine','frontline','towers','feed','heatisland','nightnoise','exchange','grayend'];
