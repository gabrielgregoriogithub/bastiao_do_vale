// Heróis que o jogador move pelo mapa.
// Cavaleiro (melee): bloqueia um inimigo terrestre por vez e apanha dele.
// Arqueira (ranged): atira de longe, inclusive em voadores, mas não bloqueia nem apanha.
// Ambos ganham experiência com os próprios abates, renascem quando caem e têm uma habilidade com recarga.
(() => {
  const TD = window.TD;
  const { T, W, H, HEROES } = TD;
  const G = TD.game;
  const sfx = TD.audio;
  const ARRIVE_PX = 3;
  const ARROW_SPEED = 460;

  const defOf = h => HEROES[h.kind] || HEROES.knight;

  const statsFor = (def, level) => {
    const k = 1 + 0.2 * (level - 1);
    return { maxHp: def.hp * k, dmg: def.dmg * k };
  };

  function homePoint() {
    const md = G.md;
    return md.posAt(md.pathLen * (md.map.heroAt ?? 0.55));
  }

  function create(level = 1, kind = 'knight') {
    const def = HEROES[kind] || HEROES.knight;
    const p = homePoint(), st = statsFor(def, level);
    return {
      isHero: true, kind: def.id, x: p.x, y: p.y, home: { x: p.x, y: p.y }, tx: null, ty: null, ordered: false,
      hp: st.maxHp, maxHp: st.maxHp, dmg: st.dmg, level, xp: 0, cd: 0, abilityCd: 0, target: null,
      deadT: 0, ang: 0, walk: 0, swing: 0, kills: 0, dmgDone: 0,
    };
  }

  const xpToNext = h => {
    const def = defOf(h);
    return h.level >= def.maxLevel ? null : def.xpPerLevel[h.level];
  };

  function onKill(h, e) {
    const def = defOf(h);
    if (h.level >= def.maxLevel) return;
    h.xp += e.d.gold * 2;
    while (h.level < def.maxLevel && h.xp >= def.xpPerLevel[h.level]) {
      h.level += 1;
      const st = statsFor(def, h.level);
      h.hp += st.maxHp - h.maxHp;
      h.maxHp = st.maxHp;
      h.dmg = st.dmg;
      G.addFx({ kind: 'ring', x: h.x, y: h.y, r: T * 0.9, color: '#e8bd5c', life: 0.6 });
      G.addFx({ kind: 'text', x: h.x, y: h.y - 22, txt: `Nível ${h.level}`, color: '#e8bd5c', life: 1.2 });
      sfx.play('upgrade');
    }
  }

  function order(x, y) {
    const h = G.S.hero;
    if (!h || h.deadT > 0) return false;
    h.tx = Math.max(10, Math.min(W - 10, x));
    h.ty = Math.max(10, Math.min(H - 10, y));
    h.ordered = true;
    h.target = null;
    G.S.heroMoved = true;
    return true;
  }

  const heroAt = (x, y, radius = 18) => {
    const h = G.S.hero;
    return !!h && h.deadT <= 0 && Math.hypot(h.x - x, h.y - y) <= radius;
  };

  function stepToward(h, x, y, dt) {
    const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy), step = defOf(h).speed * T * dt;
    if (d <= Math.max(step, ARRIVE_PX)) { h.x = x; h.y = y; return true; }
    h.x += dx / d * step;
    h.y += dy / d * step;
    h.ang = Math.atan2(dy, dx);
    h.walk += dt;
    return false;
  }

  // o Cavaleiro sente o camuflado que chega perto; a Arqueira só o vê quando uma torre o revela
  const canHit = (h, e) => (defOf(h).melee ? !e.d.flying : !(e.d.stealth && !e.revealed));

  function findTarget(h) {
    const def = defOf(h);
    // o Cavaleiro procura em volta do posto; a Arqueira, em volta de onde está
    const ox = def.melee ? h.home.x : h.x, oy = def.melee ? h.home.y : h.y;
    const reach = (def.melee ? def.aggro : def.range) * T;
    let best = null, bestScore = -Infinity;
    for (const e of G.S.enemies) {
      if (e.dead || !canHit(h, e) || Math.hypot(e.x - ox, e.y - oy) > reach) continue;
      const score = def.melee ? -Math.hypot(e.x - h.x, e.y - h.y) : e.prog;
      if (score > bestScore) { best = e; bestScore = score; }
    }
    return best;
  }

  function respawn(h) {
    const p = homePoint();
    Object.assign(h, { x: p.x, y: p.y, home: { x: p.x, y: p.y }, hp: h.maxHp, target: null, ordered: false, tx: null, ty: null });
    G.addFx({ kind: 'ring', x: h.x, y: h.y, r: T * 0.8, color: '#9fb6d6', life: 0.6 });
  }

  function shoot(h, e, dmg) {
    G.S.shots.push({
      kind: 'archer', spec: null, src: h, x: h.x, y: h.y - 6, tx: e.x, ty: e.y, vx: 0, vy: 0, target: e,
      speed: ARROW_SPEED, dmg, splash: 0, slow: 0, slowDur: 0, dot: 0, dotDur: 0, dotKind: null, freezeChance: 0, done: false,
    });
  }

  function fightMelee(h, e, dt) {
    const S = G.S, def = defOf(h);
    if (Math.hypot(e.x - h.x, e.y - h.y) > def.range * T) { stepToward(h, e.x, e.y, dt); return; }
    e.blocked = true;
    h.ang = Math.atan2(e.y - h.y, e.x - h.x);
    if (h.cd <= 0) {
      G.hurt(e, h.dmg, false, h);
      h.cd = def.rate;
      h.swing = 0.2;
      sfx.play('hit');
    }
    h.hp -= (e.d.atk || 0) * (1 + S.wave * 0.05) * S.diff.hp * dt;
  }

  function fightRanged(h, e) {
    h.ang = Math.atan2(e.y - h.y, e.x - h.x);
    if (h.cd > 0) return;
    shoot(h, e, h.dmg);
    h.cd = defOf(h).rate;
    h.swing = 0.15;
    sfx.play('archer');
  }

  // ---------- Habilidade ----------
  const abilityOf = h => defOf(h).ability;

  function canUseAbility() {
    const S = G.S, h = S.hero;
    return !!h && h.deadT <= 0 && S.inGame && !S.over && !S.halted && S.waveActive && h.abilityCd <= 0;
  }

  function useAbility() {
    if (!canUseAbility()) return false;
    const S = G.S, h = S.hero, ab = abilityOf(h);
    if (ab.id === 'charge') {
      const hit = S.enemies.filter(e => !e.dead && !e.d.flying && Math.hypot(e.x - h.x, e.y - h.y) <= ab.radius * T);
      for (const e of hit) {
        G.hurt(e, h.dmg * ab.mul, false, h);
        e.stunT = Math.max(e.stunT || 0, e.d.boss ? ab.stun / 3 : ab.stun);
      }
      G.addFx({ kind: 'ring', x: h.x, y: h.y, r: ab.radius * T, color: '#f0d27a', life: 0.45 });
      S.shake = Math.max(S.shake, 0.2);
      sfx.play('boom');
    } else if (ab.id === 'volley') {
      const inRange = S.enemies.filter(e => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) <= defOf(h).range * T)
        .sort((a, b) => b.prog - a.prog);
      if (!inRange.length) return false;
      for (let i = 0; i < ab.arrows; i++) shoot(h, inRange[i % inRange.length], h.dmg * ab.mul);
      sfx.play('rain');
    }
    h.abilityCd = ab.cd;
    return true;
  }

  // ---------- Atualização ----------
  function update(dt) {
    const S = G.S, h = S.hero;
    for (const e of S.enemies) e.blocked = false;
    if (!h) return;
    const def = defOf(h);
    h.cd = Math.max(0, h.cd - dt);
    h.swing = Math.max(0, h.swing - dt);
    if (S.waveActive) h.abilityCd = Math.max(0, h.abilityCd - dt);
    if (h.deadT > 0) {
      h.deadT -= dt;
      if (h.deadT <= 0) respawn(h);
      return;
    }

    if (h.ordered) {
      if (stepToward(h, h.tx, h.ty, dt)) {
        h.ordered = false;
        h.home = { x: h.x, y: h.y };
      }
    } else {
      const leash = (def.melee ? def.aggro * 1.5 : def.range) * T;
      const ox = def.melee ? h.home.x : h.x, oy = def.melee ? h.home.y : h.y;
      if (h.target && (h.target.dead || Math.hypot(h.target.x - ox, h.target.y - oy) > leash)) h.target = null;
      if (!h.target) h.target = findTarget(h);
      if (h.target) {
        if (def.melee) fightMelee(h, h.target, dt);
        else fightRanged(h, h.target);
      } else {
        h.hp = Math.min(h.maxHp, h.hp + def.regen * dt);
        stepToward(h, h.home.x, h.home.y, dt);
      }
    }

    if (h.hp <= 0) {
      h.hp = 0;
      h.deadT = def.respawn;
      h.target = null;
      S.heroSel = false;
      G.addFx({ kind: 'puff', x: h.x, y: h.y, r: 10, color: '#4f6d8f', life: 0.6 });
      G.addFx({ kind: 'text', x: h.x, y: h.y - 16, txt: `${def.name} caiu`, color: '#e0715a', life: 1.4 });
      sfx.play('leak');
    }
  }

  TD.hero = { create, update, onKill, order, heroAt, xpToNext, homePoint, defOf, canUseAbility, useAbility };
})();
