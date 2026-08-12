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
    }
  };
export const MAP_ORDER = ['field','archive','abyss'];
