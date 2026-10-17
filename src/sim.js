// Estado e simulação: ações do jogador, ondas, inimigos, torres, especializações e poderes.
// Não toca no DOM; a interface (ui.js) lê TD.game.S e chama as ações expostas.
(() => {
  const TD = window.TD;
  const { T, COLS, ROWS, W, H, MAX_WAVES, MAX_LVL, TOWERS, ENEMIES, DIFFICULTIES, TARGETING, MAPS, SPECS, POWERS } = TD;
  const sfx = TD.audio;
  const AUTO_DELAY = 4;
  const RALLY_MUL = 0.66;

  // ---------- Armazenamento local (opcional) ----------
  const store = {
    load(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
    save(key, v) { try { localStorage.setItem(key, String(v)); } catch { /* armazenamento indisponível */ } },
  };
  const bestKey = (m, d) => `bastiao-recorde-${m}-${d}`;
  const starsKey = (m, d) => `bastiao-estrelas-${m}-${d}`;
  const readBest = (m, d) => Number(store.load(bestKey(m, d), 0)) || 0;
  const readStars = (m, d) => Number(store.load(starsKey(m, d), 0)) || 0;
  const challengeKey = (m, d) => `bastiao-desafios-${m}-${d}`;
  const readChallenges = (m, d) => Number(store.load(challengeKey(m, d), 0)) || 0;
  const SWIFT_MUL = 1.2, POOR_MUL = 0.7;
  const INTEREST_RATE = 0.05, INTEREST_MAX = 30;

  const G = (TD.game = { S: null, md: null, onEnd: () => {}, onWaveEnd: () => {} });
  // Vida dos inimigos por onda. Os comuns crescem mais rápido que os chefes (curva da dificuldade): sem isso só
  // as ondas de chefe tiravam vidas e as outras 16 eram de graça. Depois da onda 20 (modo sem fim) tudo cresce
  // 4% por onda, senão o ouro acumulado vence a curva e o bastião nunca cai.
  const BOSS_CURVE = 0.012, ENDLESS_GROWTH = 1.04;
  const hpCurve = (n, curve, boss = false) => (1 + (n - 1) * 0.2 + (n - 1) ** 2 * (boss ? BOSS_CURVE : curve))
    * ENDLESS_GROWTH ** Math.max(0, n - MAX_WAVES);
  // As colunas ficam mais densas a cada onda (3% menos espaço entre inimigos, até a metade)
  const gapMul = n => Math.max(0.5, 1 - 0.03 * (n - 1));
  let nextId = 1, nextRun = 1;

  function freshState(mapId, diffId) {
    const diff = DIFFICULTIES[diffId];
    const perks = TD.meta.current();
    const lives = diff.lives + 3 * perks.walls;
    return {
      mapId, diffId, diff, perks, gold: diff.gold + 25 * perks.gold, lives, maxLives: lives,
      wave: 0, kills: 0, best: readBest(mapId, diffId), hero: null, heroSel: false, mods: {}, history: [], corpses: [], clock: 0,
      blessings: [], offer: null,
      towers: [], enemies: [], shots: [], fx: [], strikes: [],
      queue: [], spawnT: 0, waveActive: false, next: TD.makeWave(1), seed: null, daily: null,
      speed: 1, paused: false, over: false, halted: false, endless: false, auto: false, autoT: null,
      inGame: false, menuOpen: false,
      build: null, sel: null, aim: null, hover: null, hoverPx: null, banner: null,
      shake: 0, hurtFlash: 0, iceFlash: 0, rallyT: 0,
      cooldowns: Object.fromEntries(POWERS.map(p => [p.id, 0])),
    };
  }

  function prepare(mapId, diffId) {
    G.S = freshState(mapId, diffId);
    G.md = TD.buildMap(MAPS.find(m => m.id === mapId) || MAPS[0]);
  }

  // mods: ids de desafios ativos nesta partida
  function newGame(mapId, diffId, mods = [], heroKind = 'knight') {
    prepare(mapId, diffId);
    const S = G.S;
    S.inGame = true;
    S.runId = `${Date.now().toString(36)}-${nextRun++}`; // identifica a partida em "Suas melhores partidas"
    S.mods =Object.fromEntries(TD.CHALLENGES.filter(c => mods.includes(c.id)).map(c => [c.id, true]));
    S.hero = S.mods.nohero ? null : TD.hero.create(S.perks.veteran ? 3 : 1, heroKind);
    S.history = [{ wave: 0, gold: S.gold, lives: S.lives }];
  }

  // Um ponto por onda vencida (e um no fim da partida), para o gráfico do fim de jogo
  const HISTORY_MAX = 500;
  function recordHistory() {
    const S = G.S;
    const last = S.history[S.history.length - 1];
    const point = { wave: S.wave, gold: S.gold, lives: S.lives };
    if (last && last.wave === S.wave) S.history = [...S.history.slice(0, -1), point];
    else S.history = [...S.history, point].slice(-HISTORY_MAX);
  }
  const modCount = () => Object.keys(G.S.mods || {}).length;

  // Bênção escolhida nesta partida (blessings.js)
  const blessed = id => !!G.S?.blessings?.includes(id);

  // Efeitos das bênçãos sobre as torres, depois da especialização
  function blessStats(t, s) {
    if (blessed('fireArrows') && t.type === 'archer' && !s.dot) { s.dot = s.dmg * 0.6; s.dotDur = 3; s.dotKind = 'burn'; }
    if (blessed('powder') && t.type === 'cannon') s.splash *= 1.3;
    if (blessed('deepFrost') && t.type === 'frost') { s.slowDur *= 2; s.slow = Math.min(0.8, s.slow + 0.1); s.dmg *= 2; }
    if (blessed('sharpBolts') && t.type === 'ballista') s.dmg *= 1.35;
    if (blessed('resonance') && s.chain) s.chain += 2;
    if (blessed('drill') && s.units) { s.units += 1; s.unitHp *= 1.25; }
    if (blessed('eagle')) s.range *= 1.12;
    if (blessed('fury')) s.rate *= 0.9;
  }

  // ---------- Torres ----------
  function towerStats(t) {
    const d = TOWERS[t.type], L = t.level - 1;
    const s = {
      dmg: d.dmg * Math.pow(1.6, L),
      range: (d.range + 0.3 * L) * T,
      rate: d.rate * Math.pow(0.88, L),
      slow: d.slow ? d.slow + 0.1 * L : 0,
      slowDur: d.slowDur || 0,
      splash: d.splash ? (d.splash + 0.15 * L) * T : 0,
      targets: 1, dot: 0, dotDur: 0, dotKind: null, freezeChance: 0, armoredMul: 1,
      chain: d.chain || 0, chainRange: (d.chainRange || 0) * T, chainFalloff: d.chainFalloff || 1, weakDur: 0,
      units: d.units || 0, unitHp: (d.unitHp || 0) * Math.pow(1.4, L), unitArmor: 0, regen: d.regen || 0, pierce: false,
      aura: d.support ? d.aura + AURA_PER_LVL * L : 0, buff: 0,
    };
    switch (t.spec) {
      case 'volley': s.dmg *= 1.1; s.targets = 3; break;
      case 'poison': s.dmg *= 1.2; s.dot = s.dmg * 0.6; s.dotDur = 3; s.dotKind = 'poison'; break;
      case 'mortar': s.dmg *= 1.8; s.range = 5 * T; s.splash *= 1.5; s.rate *= 1.35; break;
      case 'fire': s.dmg *= 1.25; s.dot = s.dmg * 0.35; s.dotDur = 3; s.dotKind = 'burn'; break;
      case 'blizzard': s.dmg = 8; s.rate = 1.2; s.slow = 0.5; s.slowDur = 1.5; s.range *= 1.15; break;
      case 'freeze': s.dmg *= 4; s.freezeChance = 0.25; break;
      case 'pierce': s.dmg *= 1.3; break;
      case 'hunter': s.dmg *= 1.3; s.range += T; s.armoredMul = 3; break;
      case 'storm': s.chain = 6; s.chainRange *= 1.3; s.range += 0.3 * T; break;
      case 'hex': s.dmg *= 1.1; s.weakDur = 3; break;
      case 'guard': s.units = 3; s.unitHp *= 1.6; s.unitArmor = 0.35; break;
      case 'templar': s.dmg *= 1.5; s.pierce = true; s.regen *= 3; break;
      default: break;
    }
    blessStats(t, s);
    s.dmg *= 1 + 0.05 * (G.S?.perks?.aim || 0);
    if (!d.support) applyAura(t, s);
    return s;
  }

  // Estandarte mais forte ao alcance da torre (vários não se somam: evita cercar uma torre de estandartes)
  const AURA_PER_LVL = 0.05, WARHORN_MUL = 0.8, ORACLE_MUL = 1.15;
  function bannerFor(t) {
    let best = null;
    for (const b of G.S?.towers || []) {
      if (!TOWERS[b.type].support || !b.s || Math.hypot(b.x - t.x, b.y - t.y) > b.s.range) continue;
      if (!best || b.s.aura > best.s.aura) best = b;
    }
    return best;
  }
  function applyAura(t, s) {
    const b = bannerFor(t);
    if (!b) return;
    s.buff = b.s.aura;
    s.dmg *= 1 + b.s.aura;
    if (b.spec === 'warhorn') s.rate *= WARHORN_MUL;
    if (b.spec === 'oracle') s.range *= ORACLE_MUL;
  }

  // O bônus de cada torre depende dos estandartes vizinhos: depois de construir, vender, melhorar
  // ou ganhar uma bênção, refaz as contas de todas (primeiro os estandartes, que as outras consultam)
  function refreshStats() {
    const S = G.S;
    for (const t of S.towers) if (TOWERS[t.type].support) t.s = towerStats(t);
    for (const t of S.towers) if (!TOWERS[t.type].support) t.s = towerStats(t);
  }

  const specOf = t => (t.spec && SPECS[t.type].find(x => x.id === t.spec)) || null;
  const costOf = type => Math.round(TOWERS[type].cost * (1 - 0.05 * (G.S?.perks?.masons || 0)));
  const powerCd = p => p.cd * (1 - 0.1 * (G.S?.perks?.tactics || 0)) * (blessed('tactician') ? 0.7 : 1);
  // Mestres Artesãos barateia só as especializações: desconto em toda melhoria se acumulava e valia ondas a mais
  const upCost = t => Math.round(TOWERS[t.type].cost * 0.8 * t.level);
  const specCost = t => Math.round(TOWERS[t.type].cost * TD.SPEC_COST_MUL * (blessed('artisans') ? 0.6 : 1));
  // Torre que ainda não atirou nem viu uma onda começar devolve o preço cheio: desfaz cliques errados
  const refund = t => (t.fresh ? t.spent : Math.floor(t.spent * 0.7));
  const towerAt = (c, r) => G.S.towers.find(t => t.c === c && t.r === r) || null;
  const canBuild = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS && !G.md.blocked[r][c] && !towerAt(c, r);
  const canHit = (t, e) => !(e.d.flying && TOWERS[t.type].ground);
  const waveBonus = n => 15 + n * 4;
  const earlyBonus = () => 10 + G.S.wave;
  const canCallEarly = () => G.S.waveActive && !G.S.queue.length && (G.S.endless || G.S.wave < MAX_WAVES);

  function makeTower({ type, c, r, level = 1, spent = TOWERS[type].cost, target = 'first', spec = null, kills = 0, dmgDone = 0 }) {
    const t = { id: nextId++, type, c, r, x: (c + 0.5) * T, y: (r + 0.5) * T, level, spent, target, spec, kills, dmgDone, cd: 0, ang: Math.PI };
    const tower = { ...t, s: towerStats(t) };
    if (TOWERS[type].melee) TD.units.attach(tower);
    return tower;
  }

  function addFx(f) { G.S.fx.push({ t: 0, ...f }); }

  const dailyKey = key => `bastiao-diario-${key}`;
  const readDaily = key => Number(store.load(dailyKey(key), 0)) || 0;

  function recordBest(n) {
    const S = G.S;
    if (n > S.best) { S.best = n; store.save(bestKey(S.mapId, S.diffId), n); }
    if (S.daily && n > readDaily(S.daily)) store.save(dailyKey(S.daily), n);
  }

  // Começa o desafio do dia: campo, dificuldade e desafios vêm da data; as ondas, da semente
  function newDaily(date, heroKind = 'knight') {
    const d = TD.dailyFor(date);
    newGame(d.map, d.diff, d.mods, heroKind);
    G.S.daily = d.key;
    G.S.seed = d.seed;
    G.S.next = TD.makeWave(1, d.seed);
    return d;
  }

  // ---------- Ações do jogador ----------
  function build(type, c, r) {
    const S = G.S, cost = costOf(type);
    if (!canBuild(c, r) || S.gold < cost) return;
    S.gold -= cost;
    S.towers = [...S.towers, { ...makeTower({ type, c, r, spent: cost }), fresh: true }];
    refreshStats();
    addFx({ kind: 'ring', x: (c + 0.5) * T, y: (r + 0.5) * T, r: T * 0.7, color: '#d6a547', life: 0.4 });
    sfx.play('build');
  }

  function upgrade(t) {
    const S = G.S;
    if (!t || t.level >= MAX_LVL || S.gold < upCost(t)) return;
    const cost = upCost(t);
    S.gold -= cost;
    t.spent += cost;
    t.level += 1;
    refreshStats();
    if (t.units) TD.units.refresh(t);
    addFx({ kind: 'ring', x: t.x, y: t.y, r: T * 0.9, color: '#d6a547', life: 0.5 });
    sfx.play('upgrade');
  }

  function specialize(t, specId) {
    const S = G.S;
    if (!t || t.spec || t.level < MAX_LVL || S.gold < specCost(t)) return;
    if (!SPECS[t.type].some(x => x.id === specId)) return;
    const cost = specCost(t);
    S.gold -= cost;
    t.spent += cost;
    t.spec = specId;
    refreshStats();
    if (t.units) TD.units.refresh(t);
    addFx({ kind: 'ring', x: t.x, y: t.y, r: T * 1.2, color: specOf(t).color, life: 0.7 });
    sfx.play('spec');
  }

  function sell(t) {
    const S = G.S;
    if (!t) return;
    S.gold += refund(t);
    S.towers = S.towers.filter(x => x.id !== t.id);
    refreshStats();
    addFx({ kind: 'text', x: t.x, y: t.y - 10, txt: '+' + refund(t), color: '#d6a547', life: 1 });
    S.sel = null;
    sfx.play('sell');
  }

  function cycleTarget(t) {
    if (!t || t.spec === 'blizzard') return;
    const i = TARGETING.findIndex(x => x.id === t.target);
    t.target = TARGETING[(i + 1) % TARGETING.length].id;
  }

  function toggleAuto() {
    const S = G.S;
    S.auto = !S.auto;
    if (!S.auto) S.autoT = null;
    else if (!S.waveActive && S.wave > 0 && !S.halted) S.autoT = AUTO_DELAY;
  }

  function continueEndless() {
    const S = G.S;
    S.endless = true;
    S.halted = false;
    if (S.auto) S.autoT = AUTO_DELAY;
  }

  const canUsePower = id => {
    const S = G.S;
    return S.inGame && !S.over && !S.halted && S.waveActive && S.cooldowns[id] <= 0 && !S.mods?.nopower;
  };

  function usePower(id, x, y) {
    const S = G.S, p = POWERS.find(q => q.id === id);
    if (!p || !canUsePower(id)) return false;
    if (id === 'rain') {
      const r = p.radius * T;
      S.strikes.push({ x, y, r, dmg: 120 + 30 * S.wave, t: 0.55 });
      addFx({ kind: 'rain', x, y, r, life: 0.55 });
      sfx.play('rain');
    } else if (id === 'freeze') {
      for (const e of S.enemies) e.frozenT = Math.max(e.frozenT, e.d.boss ? 1 : p.dur);
      S.iceFlash = 0.7;
      sfx.play('freeze');
    } else if (id === 'rally') {
      S.rallyT = p.dur;
      for (const t of S.towers) addFx({ kind: 'ring', x: t.x, y: t.y, r: T * 0.8, color: '#e8bd5c', life: 0.6 });
      sfx.play('rally');
    }
    S.cooldowns[id] = powerCd(p);
    S.wavePowers = { ...S.wavePowers, [id]: true };
    return true;
  }

  // ---------- Ondas ----------
  function startWave() {
    const S = G.S;
    if (!S.inGame || S.over || S.halted || S.menuOpen) return;
    if (S.waveActive) {
      if (!canCallEarly()) return;
      const b = waveBonus(S.wave) + earlyBonus();
      S.gold += b;
      recordBest(S.wave);
      addFx({ kind: 'text', x: W / 2, y: H / 2 + 30, txt: `Chamada antecipada · +${b} de ouro`, color: '#d6a547', life: 1.8, big: true });
      S.earlyCalls = (S.earlyCalls || 0) + 1;
    }
    // Ponto de salvamento: o estado sem inimigos logo antes da onda. Na chamada antecipada a onda anterior
    // ainda tem inimigos vivos, então vale o ponto do começo dela.
    if (!S.waveActive) S.checkpoint = snapshot();
    S.wavePowers = {};
    S.wave += 1;
    for (const t of S.towers) t.fresh = false;
    S.queue = S.next.slice();
    S.next = TD.makeWave(S.wave + 1, S.seed);
    S.waveActive = true;
    S.spawnT = 0.3;
    S.autoT = null;
    const tag = S.wave % 5 === 0 ? ` · ${ENEMIES[TD.bossFor(S.wave)].name}` : TD.isSwarm(S.wave) ? ' · revoada' : '';
    S.banner = { text: `Onda ${S.wave}${tag}`, t: 0, life: 2 };
    sfx.play('wave');
  }

  function starsFor(lives, max) {
    const k = lives / max;
    return k >= 0.9 ? 3 : k >= 0.5 ? 2 : 1;
  }

  function endWave() {
    const S = G.S;
    S.waveActive = false;
    // juros sobre o ouro guardado antes do bônus da onda
    const interest = blessed('interest') ? Math.min(INTEREST_MAX, Math.floor(S.gold * INTEREST_RATE)) : 0;
    const bonus = waveBonus(S.wave);
    S.gold += bonus + interest;
    if (interest) addFx({ kind: 'text', x: W / 2, y: H / 2 + 26, txt: `Juros do Tesouro · +${interest}`, color: '#e8c56e', life: 1.8 });
    if (blessed('livingWall') && S.lives < S.maxLives) {
      S.lives += 1;
      addFx({ kind: 'text', x: W - T * 1.4, y: (G.md.exitRow + 0.5) * T - 18, txt: '+1', color: '#86b46f', life: 1 });
    }
    recordHistory();
    addFx({ kind: 'text', x: W / 2, y: H / 2, txt: `Onda concluída · +${bonus} de ouro`, color: '#d6a547', life: 1.8, big: true });
    recordBest(S.wave);
    if (S.wave === MAX_WAVES && !S.endless) {
      S.halted = true;
      const stars = starsFor(S.lives, S.maxLives);
      if (stars > readStars(S.mapId, S.diffId)) store.save(starsKey(S.mapId, S.diffId), stars);
      const mods = modCount();
      if (mods > readChallenges(S.mapId, S.diffId)) store.save(challengeKey(S.mapId, S.diffId), mods);
      const modText = mods ? ` e ${mods} ${mods === 1 ? 'desafio' : 'desafios'}` : '';
      TD.achievements?.onVictory();
      sfx.play('win');
      G.onEnd({
        title: 'O vale está a salvo', stars,
        text: `Você segurou ${MAX_WAVES} ondas com ${S.lives} de ${S.maxLives} vidas${modText}, derrotando ${S.kills} inimigos. Continue para ver até onde o bastião aguenta: daqui em diante cada onda vem mais forte.`,
        canContinue: true,
      });
      return;
    }
    sfx.play('waveEnd');
    TD.achievements?.onWaveEnd();
    TD.blessings?.check();
    if (S.auto) S.autoT = AUTO_DELAY;
    G.onWaveEnd();
  }

  function gameOver() {
    const S = G.S;
    S.over = true;
    recordHistory();
    recordBest(S.wave - 1);
    TD.achievements?.flushKills();
    sfx.play('lose');
    G.onEnd({
      title: 'O bastião caiu', stars: 0,
      text: `A muralha cedeu na onda ${S.wave}, depois de ${S.kills} inimigos derrotados. Seu recorde neste campo é de ${S.best} ondas.`,
      canContinue: false,
    });
  }

  // ---------- Combate ----------
  // Em mapas com várias cavernas, os inimigos se alternam entre as estradas
  function nextPath() {
    const paths = G.md.paths;
    G.S.spawnIdx = (G.S.spawnIdx || 0) + 1;
    return paths[G.S.spawnIdx % paths.length];
  }

  const lenOf = e => (e.d.flying ? e.path.flyLen : e.path.len);
  const posOf = (e, d) => (e.d.flying ? e.path.flyAt(d) : e.path.posAt(d));

  function spawn(type, dist = 0, path = null) {
    const S = G.S, d = ENEMIES[type];
    const hp = Math.round(d.hp * hpCurve(S.wave, S.diff.curve, d.boss) * S.diff.hp);
    const route = path || nextPath();
    const len = d.flying ? route.flyLen : route.len;
    const p = d.flying ? route.flyAt(dist) : route.posAt(dist);
    if (d.boss && dist === 0) S.shake = Math.max(S.shake, 0.3);
    S.enemies.push({
      type, d, path: route, weakT: 0, hp, maxHp: hp, dist, prog: dist / len, x: p.x, y: p.y,
      slowT: 0, slowF: 0, frozenT: 0, flash: 0, healT: 1, abilT: 2, shield: 0, blocked: false,
      dots: { poison: null, burn: null }, wob: Math.random() * 6, dead: false,
    });
  }

  function hurt(e, dmg, pierce, src, quiet = false) {
    if (e.dead) return;
    const S = G.S;
    let real = pierce ? dmg : Math.max(dmg * 0.25, dmg - e.d.armor);
    if (e.weakT > 0) real *= TD.WEAK_MUL;
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, real);
      e.shield -= absorbed;
      real -= absorbed;
    }
    if (src) src.dmgDone += Math.min(real, e.hp);
    e.hp -= real;
    if (!quiet) e.flash = 0.08;
    if (e.hp > 0) return;
    e.dead = true;
    S.kills += 1;
    if (src) src.kills += 1;
    if (src && src.isHero) TD.hero.onKill(src, e);
    TD.achievements?.onKill(e);
    TD.foes.onDeath(e);
    const vault = e.d.boss && blessed('kingsVault') ? 4 : 1;
    const g = Math.floor((e.d.gold + Math.floor(S.wave / 5)) * (S.mods?.poor ? POOR_MUL : 1)) * vault;
    S.gold += g;
    const py = e.d.flying ? e.y - 10 : e.y;
    addFx({ kind: 'puff', x: e.x, y: py, r: e.d.r, color: e.d.color, life: 0.45 });
    if (!e.d.flying) addFx({ kind: 'stain', x: e.x, y: e.y + 2, r: e.d.r * 0.9, color: e.d.dark, life: 4 });
    const shards = e.d.boss ? 14 : 5;
    for (let i = 0; i < shards; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * (e.d.boss ? 160 : 90);
      addFx({ kind: 'shard', x: e.x, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, color: i % 2 ? e.d.color : e.d.dark, life: 0.5 + Math.random() * 0.3 });
    }
    if (e.d.boss) S.shake = Math.max(S.shake, 0.4);
    addFx({ kind: 'text', x: e.x, y: e.y - 8, txt: '+' + g, color: '#e8c56e', life: 0.9 });
    sfx.play('kill');
  }

  function applySlow(e, slow, dur) {
    const s = e.d.boss ? slow * 0.5 : slow;
    if (e.slowT <= 0 || s >= e.slowF) e.slowF = s;
    e.slowT = Math.max(e.slowT, dur);
  }

  function applyDot(e, kind, dps, dur, src) {
    const cur = e.dots[kind];
    if (!cur || dps >= cur.dps) e.dots[kind] = { dps, t: dur, src };
    else cur.t = Math.max(cur.t, dur);
  }

  const TARGET_SCORE = {
    first: e => e.prog,
    last: e => -e.prog,
    strong: e => e.hp,
    close: (e, t) => -Math.hypot(e.x - t.x, e.y - t.y),
  };

  // Roda para cada torre a cada quadro: compara distâncias ao quadrado e, com um alvo só (quase sempre),
  // guarda o melhor numa passada em vez de montar e ordenar uma lista
  function findTargets(t, n) {
    const score = TARGET_SCORE[t.target] || TARGET_SCORE.first;
    const r2 = t.s.range * t.s.range;
    const inRange = e => !e.dead && canHit(t, e) && !(e.d.stealth && !e.revealed) && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= r2;
    if (n === 1) {
      let best = null, bestSc = -Infinity;
      for (const e of G.S.enemies) {
        if (!inRange(e)) continue;
        const sc = score(e, t);
        if (sc > bestSc) { best = e; bestSc = sc; }
      }
      return best ? [best] : [];
    }
    const list = [];
    for (const e of G.S.enemies) if (inRange(e)) list.push({ e, sc: score(e, t) });
    list.sort((a, b) => b.sc - a.sc);
    return list.slice(0, n).map(x => x.e);
  }

  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const k = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(px - (ax + vx * k), py - (ay + vy * k));
  }

  // Raio em cadeia: salta para o inimigo mais próximo ainda não atingido, perdendo força a cada salto
  function fireArcane(t, first) {
    const s = t.s, hit = new Set(), points = [{ x: t.x, y: t.y - 7 }];
    let cur = first, dmg = s.dmg;
    for (let i = 0; i < s.chain && cur; i++) {
      hit.add(cur);
      points.push({ x: cur.x, y: cur.d.flying ? cur.y - 10 : cur.y });
      hurt(cur, dmg, false, t);
      if (s.weakDur && !cur.dead) cur.weakT = Math.max(cur.weakT, s.weakDur);
      dmg *= s.chainFalloff;
      let next = null, best = s.chainRange;
      for (const o of G.S.enemies) {
        if (o.dead || hit.has(o)) continue;
        const d = Math.hypot(o.x - cur.x, o.y - cur.y);
        if (d <= best) { next = o; best = d; }
      }
      cur = next;
    }
    addFx({ kind: 'bolt', points, color: t.spec === 'hex' ? '#d9a0f0' : '#bcd4ff', life: 0.22 });
  }

  function fireBallista(t, e) {
    const S = G.S;
    if (t.spec === 'pierce') {
      const ex = t.x + Math.cos(t.ang) * t.s.range, ey = t.y + Math.sin(t.ang) * t.s.range;
      const hit = S.enemies.filter(o => !o.dead && segDist(o.x, o.y, t.x, t.y, ex, ey) <= o.d.r + 6);
      for (const o of hit) hurt(o, t.s.dmg, true, t);
      addFx({ kind: 'line', x: t.x, y: t.y, x2: ex, y2: ey, life: 0.3 });
      return;
    }
    addFx({ kind: 'spark', x: e.x, y: e.d.flying ? e.y - 10 : e.y, ang: t.ang, color: '#f3ead2', life: 0.2 });
    hurt(e, t.s.dmg * (e.d.armor > 0 ? t.s.armoredMul : 1), true, t);
    addFx({ kind: 'line', x: t.x, y: t.y, x2: e.x, y2: e.y, life: 0.25 });
  }

  function fire(t, e) {
    t.fresh = false;
    sfx.play(t.type);
    t.kick = 1;
    if (t.type === 'cannon' || t.type === 'ballista') {
      addFx({ kind: 'flash', x: t.x + Math.cos(t.ang) * 17, y: t.y + Math.sin(t.ang) * 17, r: t.type === 'cannon' ? 7 : 4, life: 0.09 });
    }
    if (t.type === 'ballista') { fireBallista(t, e); return; }
    if (t.type === 'arcane') { fireArcane(t, e); return; }
    const s = t.s;
    G.S.shots.push({
      kind: t.type, spec: t.spec, src: t, x: t.x, y: t.y, tx: e.x, ty: e.y, vx: 0, vy: 0, target: e,
      speed: t.spec === 'mortar' ? 210 : TOWERS[t.type].speed,
      dmg: s.dmg, splash: s.splash, slow: s.slow, slowDur: s.slowDur,
      dot: s.dot, dotDur: s.dotDur, dotKind: s.dotKind, freezeChance: s.freezeChance, done: false,
    });
  }

  function pulseBlizzard(t) {
    const hit = G.S.enemies.filter(e => !e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= t.s.range);
    if (!hit.length) return false;
    for (const e of hit) {
      hurt(e, t.s.dmg, false, t);
      if (!e.dead) applySlow(e, t.s.slow, t.s.slowDur);
    }
    addFx({ kind: 'ring', x: t.x, y: t.y, r: t.s.range, color: '#bfe9f5', life: 0.5 });
    sfx.play('frost');
    return true;
  }

  function impact(s) {
    const tg = s.target;
    if (s.kind === 'cannon') {
      // alvos escolhidos antes do dano: quem nasce da explosão (Blindados do Colosso) não leva o mesmo golpe
      const hit = G.S.enemies.filter(e => !e.dead && !e.d.flying && Math.hypot(e.x - s.tx, e.y - s.ty) <= s.splash);
      for (const e of hit) {
        hurt(e, s.dmg, false, s.src);
        if (s.dot && !e.dead) applyDot(e, s.dotKind, s.dot, s.dotDur, s.src);
      }
      addFx({ kind: 'blast', x: s.tx, y: s.ty, r: s.splash, fire: s.spec === 'fire', life: 0.45 });
      addFx({ kind: 'scorch', x: s.tx, y: s.ty, r: s.splash * 0.5, life: 5 });
      for (let i = 0; i < 3; i++) {
        addFx({ kind: 'smoke', x: s.tx + (Math.random() - 0.5) * s.splash * 0.6, y: s.ty + (Math.random() - 0.5) * s.splash * 0.4, r: 6 + Math.random() * 5, life: 0.9 + Math.random() * 0.5 });
      }
      sfx.play('boom');
      return;
    }
    if (tg.dead) return;
    addFx({ kind: 'spark', x: tg.x, y: tg.d.flying ? tg.y - 10 : tg.y, ang: Math.atan2(s.vy, s.vx), color: s.kind === 'frost' ? '#d8f4fc' : '#f3ead2', life: 0.18 });
    hurt(tg, s.dmg, false, s.src);
    if (tg.dead) return;
    if (s.kind === 'frost') {
      applySlow(tg, s.slow, s.slowDur);
      if (s.freezeChance && Math.random() < s.freezeChance) tg.frozenT = Math.max(tg.frozenT, tg.d.boss ? 0.4 : 1.2);
    }
    if (s.dot) applyDot(tg, s.dotKind, s.dot, s.dotDur, s.src);
  }

  function tickDots(e, dt) {
    for (const k of ['poison', 'burn']) {
      const d = e.dots[k];
      if (!d) continue;
      d.t -= dt;
      hurt(e, d.dps * dt, true, d.src, true);
      if (d.t <= 0) e.dots[k] = null;
      if (e.dead) return;
    }
  }

  function leak(e) {
    const S = G.S, lost = e.d.lives || 1;
    e.dead = true;
    S.lives = Math.max(0, S.lives - lost);
    S.shake = 0.35;
    S.hurtFlash = 0.6;
    addFx({ kind: 'text', x: W - T * 1.4, y: (G.md.exitRow + 0.5) * T - 18, txt: '-' + lost, color: '#e0715a', life: 1 });
    sfx.play('leak');
    if (S.lives <= 0 && !S.over) gameOver();
  }

  const CALTROPS_MUL = 0.88;
  function moveEnemies(dt) {
    const md = G.md, caltrops = blessed('caltrops');
    for (const e of G.S.enemies) {
      if (e.dead) continue;
      e.slowT = Math.max(0, e.slowT - dt);
      e.frozenT = Math.max(0, e.frozenT - dt);
      e.flash = Math.max(0, e.flash - dt);
      e.weakT = Math.max(0, e.weakT - dt);
      e.stunT = Math.max(0, (e.stunT || 0) - dt);
      tickDots(e, dt);
      if (e.dead) continue;
      let f = e.frozenT > 0 || e.stunT > 0 || e.blocked ? 0 : e.slowT > 0 ? 1 - e.slowF : 1;
      if (!e.d.flying && md.mudAt(e.x, e.y)) f *= TD.MUD_SLOW;
      if (!e.d.flying && caltrops) f *= CALTROPS_MUL;
      const len = lenOf(e);
      e.dist += e.d.speed * (G.S.mods?.swift ? SWIFT_MUL : 1) * T * f * dt;
      e.prog = e.dist / len;
      e.wob += dt * 9 * f;
      if (e.dist >= len) {
        leak(e);
        if (G.S.over) return;
        continue;
      }
      const p = posOf(e, e.dist);
      e.x = p.x; e.y = p.y;
      TD.foes.tick(e, dt);
    }
  }

  function updateTowers(dt) {
    const S = G.S, mul = S.rallyT > 0 ? RALLY_MUL : 1;
    TD.foes.updateReveal();
    for (const t of S.towers) {
      t.cd -= dt;
      t.kick = Math.max(0, (t.kick || 0) - dt * 7);
      if (t.stunT > 0) { t.stunT = Math.max(0, t.stunT - dt); continue; }
      if (TOWERS[t.type].melee || TOWERS[t.type].support) continue; // o quartel luta pelos soldados (units.js); o estandarte não ataca
      if (t.spec === 'blizzard') {
        if (t.cd <= 0 && pulseBlizzard(t)) t.cd = t.s.rate * mul;
        continue;
      }
      const targets = findTargets(t, t.s.targets);
      if (!targets.length) continue;
      t.ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
      if (t.cd > 0) continue;
      for (const e of targets) fire(t, e);
      t.cd = t.s.rate * mul;
    }
  }

  function moveShots(dt) {
    for (const s of G.S.shots) {
      if (!s.target.dead) { s.tx = s.target.x; s.ty = s.target.y; }
      const dx = s.tx - s.x, dy = s.ty - s.y, dist = Math.hypot(dx, dy), step = s.speed * dt;
      if (dist <= step + 2) { impact(s); s.done = true; continue; }
      s.vx = dx / dist; s.vy = dy / dist;
      s.x += s.vx * step; s.y += s.vy * step;
    }
  }

  function updateStrikes(dt) {
    const S = G.S;
    for (const k of S.strikes) {
      k.t -= dt;
      if (k.t > 0) continue;
      const hit = S.enemies.filter(e => !e.dead && Math.hypot(e.x - k.x, e.y - k.y) <= k.r);
      for (const e of hit) hurt(e, k.dmg, false, null);
      addFx({ kind: 'ring', x: k.x, y: k.y, r: k.r, color: '#f3ead2', life: 0.35 });
      sfx.play('boom');
    }
    S.strikes = S.strikes.filter(k => k.t > 0);
  }

  function update(dt) {
    const S = G.S;
    if (S.waveActive && S.queue.length) {
      S.spawnT -= dt;
      if (S.spawnT <= 0) {
        const type = S.queue.shift();
        spawn(type);
        S.spawnT = ENEMIES[type].gap * gapMul(S.wave);
      }
    }
    if (!S.waveActive && S.autoT !== null) {
      S.autoT -= dt;
      if (S.autoT <= 0) startWave();
    }
    if (S.waveActive) for (const p of POWERS) S.cooldowns[p.id] = Math.max(0, S.cooldowns[p.id] - dt);
    S.rallyT = Math.max(0, S.rallyT - dt);
    S.clock += dt;

    TD.hero.update(dt);
    TD.units.update(dt);
    moveEnemies(dt);
    if (S.over) return;
    updateTowers(dt);
    moveShots(dt);
    updateStrikes(dt);

    for (const f of S.fx) {
      f.t += dt;
      if (f.kind === 'shard') { f.vy += 420 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    }
    if (S.banner) { S.banner.t += dt; if (S.banner.t >= S.banner.life) S.banner = null; }
    S.shake = Math.max(0, S.shake - dt);
    S.hurtFlash = Math.max(0, S.hurtFlash - dt);
    S.iceFlash = Math.max(0, S.iceFlash - dt);

    S.enemies = S.enemies.filter(e => !e.dead);
    S.shots = S.shots.filter(s => !s.done);
    S.fx = S.fx.filter(f => f.t < f.life);
    if (S.sel && !S.towers.includes(S.sel)) S.sel = null;

    if (S.waveActive && !S.queue.length && !S.enemies.length) endWave();
  }

  // ---------- Recarga ao vivo do artifact ----------
  // No meio de uma onda devolve o ponto de salvamento do começo dela: guardar o ouro e os abates já ganhos
  // e depois jogar a mesma onda de novo dava ouro sem fim a quem fechasse e reabrisse a página
  function snapshot() {
    const S = G.S;
    if (!S || !S.inGame || S.over) return {};
    if (S.waveActive && S.checkpoint) return S.checkpoint;
    return {
      mapId: S.mapId, diffId: S.diffId, gold: S.gold, lives: S.lives, kills: S.kills, mods: Object.keys(S.mods || {}),
      daily: S.daily, seed: S.seed, history: S.history, runId: S.runId, blessings: S.blessings,
      wave: S.waveActive ? S.wave - 1 : S.wave, endless: S.endless, auto: S.auto,
      hero: S.hero ? { kind: S.hero.kind, level: S.hero.level, xp: S.hero.xp, kills: S.hero.kills } : null,
      towers: S.towers.map(t => ({ type: t.type, c: t.c, r: t.r, level: t.level, spent: t.spent, target: t.target, spec: t.spec, kills: t.kills, dmgDone: t.dmgDone })),
    };
  }

  // Números vindos do armazenamento: inteiros dentro de [min, max], ou o valor padrão
  const intIn = (v, min, max, fallback) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  // A gravação pode estar corrompida ou ser de uma versão antiga: tudo é validado antes de entrar no jogo
  function restore(data) {
    if (!data || !MAPS.some(m => m.id === data.mapId) || !DIFFICULTIES[data.diffId] || !Array.isArray(data.towers)) return false;
    const heroKind = data.hero && TD.HEROES[data.hero.kind] ? data.hero.kind : 'knight';
    newGame(data.mapId, data.diffId, Array.isArray(data.mods) ? data.mods : [], heroKind);
    const S = G.S;
    S.gold = intIn(data.gold, 0, 1e7, S.gold);
    S.lives = intIn(data.lives, 1, S.maxLives, S.lives);
    S.kills = intIn(data.kills, 0, 1e9, 0);
    S.wave = intIn(data.wave, 0, 10000, 0);
    S.endless = !!data.endless;
    S.auto = !!data.auto;
    if (typeof data.runId === 'string' && data.runId.length <= 40) S.runId = data.runId;
    if (typeof data.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.daily) && Number.isFinite(data.seed)) {
      S.daily = data.daily;
      S.seed = data.seed >>> 0;
    }
    S.next = TD.makeWave(S.wave + 1, S.seed);
    // antes das torres: as bênçãos entram no cálculo delas
    if (Array.isArray(data.blessings)) {
      const valid = data.blessings.filter(id => TD.BLESSINGS.some(b => b.id === id));
      S.blessings = [...new Set(valid)].slice(0, Math.floor(S.wave / TD.blessings.EVERY));
    }
    if (Array.isArray(data.history)) {
      const hist = data.history.slice(-HISTORY_MAX).filter(p => p && typeof p === 'object')
        .map(p => ({ wave: intIn(p.wave, 0, 10000, 0), gold: intIn(p.gold, 0, 1e7, 0), lives: intIn(p.lives, 0, 1e6, 0) }))
        .filter(p => p.wave <= S.wave);
      if (hist.length) S.history = hist;
    }
    for (const raw of data.towers) {
      if (!raw || !TOWERS[raw.type]) continue;
      const c = intIn(raw.c, -1, COLS, -1), r = intIn(raw.r, -1, ROWS, -1);
      if (!canBuild(c, r)) continue;
      const level = intIn(raw.level, 1, MAX_LVL, 1);
      const spec = level === MAX_LVL && SPECS[raw.type].some(s => s.id === raw.spec) ? raw.spec : null;
      const target = TARGETING.some(x => x.id === raw.target) ? raw.target : 'first';
      S.towers = [...S.towers, makeTower({
        type: raw.type, c, r, level, spec, target,
        spent: intIn(raw.spent, 0, 1e6, TOWERS[raw.type].cost), kills: intIn(raw.kills, 0, 1e9, 0), dmgDone: Math.max(0, Number(raw.dmgDone) || 0),
      })];
    }
    if (S.hero && data.hero) {
      S.hero = TD.hero.create(intIn(data.hero.level, 1, TD.HERO.maxLevel, 1), heroKind);
      S.hero.xp = intIn(data.hero.xp, 0, 1e6, 0);
      S.hero.kills = intIn(data.hero.kills, 0, 1e9, 0);
    }
    refreshStats(); // torres restauradas antes do estandarte vizinho ainda não tinham o bônus
    TD.blessings.check(); // escolha que ficou pendente ao salvar
    return true;
  }

  Object.assign(G, {
    store, readBest, readStars, readChallenges, readDaily, newDaily, towerStats, prepare, newGame, hurt, addFx, spawn, costOf, powerCd,
    build, upgrade, specialize, sell, cycleTarget, toggleAuto, continueEndless, startWave, usePower, canUsePower, update,
    towerAt, canBuild, upCost, specCost, refund, specOf, waveBonus, earlyBonus, canCallEarly, snapshot, restore, blessed, refreshStats,
  });
})();
