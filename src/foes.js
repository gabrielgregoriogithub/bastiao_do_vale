// Habilidades especiais dos inimigos: divisão do Colosso, escudo da Feiticeira, fogo do Dragão,
// Necromante, camuflagem do Espreitador e cura do Curandeiro. A simulação chama tick, onDeath e updateReveal.
(() => {
  const TD = window.TD;
  const { T, TOWERS } = TD;
  const G = TD.game;
  const sfx = TD.audio;

  // Colosso: ao morrer, se parte em vários inimigos menores no mesmo ponto da estrada
  function split(e) {
    for (let i = 0; i < e.d.splitCount; i++) G.spawn(e.d.splitInto, Math.max(0, e.dist - i * 14), e.path);
    G.addFx({ kind: 'ring', x: e.x, y: e.y, r: T * 1.4, color: '#c9c2b0', life: 0.6 });
  }

  // Feiticeira: escudo que absorve parte do dano dos aliados próximos
  function castShield(e) {
    for (const o of G.S.enemies) {
      if (o === e || o.dead || Math.hypot(o.x - e.x, o.y - e.y) > e.d.shieldRange * T) continue;
      o.shield = Math.max(o.shield, o.maxHp * e.d.shieldPct);
    }
    G.addFx({ kind: 'ring', x: e.x, y: e.y, r: e.d.shieldRange * T, color: '#b48be0', life: 0.6 });
    sfx.play('heal');
  }

  // Dragão: incendeia a torre mais próxima, que para de atirar por um tempo
  function breatheFire(e) {
    let best = null, bestD = e.d.burnRange * T;
    for (const t of G.S.towers) {
      const dd = Math.hypot(t.x - e.x, t.y - e.y);
      if (dd <= bestD) { best = t; bestD = dd; }
    }
    if (!best) return;
    best.stunT = Math.max(best.stunT || 0, e.d.burnDur);
    G.addFx({ kind: 'fire', x: e.x, y: e.y - 10, x2: best.x, y2: best.y, life: 0.6 });
    sfx.play('boom');
  }

  // Necromante: levanta como Esqueletos os inimigos que caíram perto dele há pouco tempo
  const CORPSE_MAX = 30, CORPSE_SECONDS = 5;
  function raiseDead(e, dt) {
    const S = G.S;
    e.raiseT = (e.raiseT ?? 1.5) - dt;
    if (e.raiseT > 0) return;
    e.raiseT = e.d.raiseEvery;
    const near = S.corpses
      .filter(c => S.clock - c.t < CORPSE_SECONDS && Math.hypot(c.x - e.x, c.y - e.y) <= e.d.raiseRange * T)
      .slice(0, e.d.raiseMax);
    if (!near.length) return;
    for (const c of near) {
      G.spawn('skeleton', c.dist, c.path);
      G.addFx({ kind: 'puff', x: c.x, y: c.y, r: 9, color: '#7be08a', life: 0.5 });
    }
    S.corpses = S.corpses.filter(c => !near.includes(c));
    G.addFx({ kind: 'ring', x: e.x, y: e.y, r: e.d.raiseRange * T, color: '#7be08a', life: 0.5 });
    sfx.play('heal');
  }

  // Espreitador: só pode ser mirado quando está no alcance de uma torre que detecta
  // (Geada, Arcano ou o Estandarte com Olho do Oráculo)
  const detects = t => TOWERS[t.type].detects || t.spec === 'oracle';
  function updateReveal() {
    const S = G.S;
    for (const e of S.enemies) {
      if (!e.d.stealth) continue;
      e.revealed = S.towers.some(t => detects(t) && Math.hypot(e.x - t.x, e.y - t.y) <= t.s.range);
    }
  }

  function bossAbilities(e, dt) {
    if (!e.d.shieldEvery && !e.d.burnEvery) return;
    e.abilT -= dt;
    if (e.abilT > 0) return;
    if (e.d.shieldEvery) { castShield(e); e.abilT = e.d.shieldEvery; }
    if (e.d.burnEvery) { breatheFire(e); e.abilT = e.d.burnEvery; }
  }

  function healAround(e, dt) {
    e.healT -= dt;
    if (e.healT > 0) return;
    e.healT = e.d.healEvery;
    let healed = false;
    for (const o of G.S.enemies) {
      if (o === e || o.dead || o.hp >= o.maxHp) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) > e.d.healRange * T) continue;
      const gain = Math.min(o.maxHp - o.hp, o.maxHp * e.d.heal);
      o.hp += gain;
      healed = true;
      if (gain >= 1) G.addFx({ kind: 'dmg', x: o.x, y: o.y - o.d.r * 1.6, txt: `+${Math.round(gain)}`, color: '#8fe08a', life: 0.8 });
    }
    if (healed) {
      G.addFx({ kind: 'ring', x: e.x, y: e.y, r: e.d.healRange * T, color: '#8fd08a', life: 0.5 });
      sfx.play('heal');
    }
  }

  // Corpo que o Necromante pode levantar; voadores, chefes e os já levantados não deixam corpo
  function addCorpse(e) {
    if (e.d.flying || e.d.boss || e.d.raised) return;
    const S = G.S;
    S.corpses = [...S.corpses, { path: e.path, dist: e.dist, x: e.x, y: e.y, t: S.clock }].slice(-CORPSE_MAX);
  }

  // Berserker: abaixo de uma fração da vida entra em fúria (moveEnemies acelera quem está enraged)
  function checkRage(e) {
    if (e.enraged || e.hp >= e.maxHp * e.d.enrage) return;
    e.enraged = true;
    G.addFx({ kind: 'ring', x: e.x, y: e.y, r: T * 0.9, color: '#e0503a', life: 0.5 });
    sfx.play('rage');
  }

  // Escavador: alterna entre andar na superfície e mergulhar na terra
  function burrow(e, dt) {
    e.burrowT = (e.burrowT ?? e.d.burrowEvery * 0.6) - dt;
    if (e.burrowT > 0) return;
    e.under = !e.under;
    e.burrowT = e.under ? e.d.burrowDur : e.d.burrowEvery;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 50;
      G.addFx({ kind: 'shard', x: e.x, y: e.y + 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, color: i % 2 ? '#6a5236' : '#8a7050', life: 0.45 });
    }
  }

  // Saltador: some e reaparece mais adiante na estrada; preso, congelado ou atordoado não salta
  function blink(e, dt) {
    e.blinkT = (e.blinkT ?? e.d.blinkEvery * 0.7) - dt;
    if (e.blinkT > 0) return;
    if (e.frozenT > 0 || e.stunT > 0 || e.blocked) { e.blinkT = 0.3; return; }
    e.blinkT = e.d.blinkEvery;
    const to = Math.min(e.path.len - T * 0.6, e.dist + e.d.blinkDist * T);
    if (to <= e.dist) return;
    G.addFx({ kind: 'blink', x: e.x, y: e.y, color: e.d.color, life: 0.4 });
    const p = e.path.posAt(to);
    e.dist = to; e.prog = to / e.path.len; e.x = p.x; e.y = p.y;
    G.addFx({ kind: 'blink', x: e.x, y: e.y, color: e.d.color, life: 0.45, arrive: true });
    sfx.play('blink');
  }

  // Sabotador: arremessa uma bomba na torre mais próxima ao alcance; ela cai depois de BOMB_FLIGHT s (update)
  const BOMB_FLIGHT = 0.6;
  function throwBomb(e, dt) {
    e.bombT = (e.bombT ?? 2) - dt;
    if (e.bombT > 0 || e.frozenT > 0 || e.stunT > 0) return;
    let best = null, bestD = e.d.bombRange * T;
    for (const t of G.S.towers) {
      const dd = Math.hypot(t.x - e.x, t.y - e.y);
      if (dd <= bestD) { best = t; bestD = dd; }
    }
    if (!best) { e.bombT = 0.5; return; }
    e.bombT = e.d.bombEvery;
    G.S.bombs.push({ x0: e.x, y0: e.y - 8, tower: best, stun: e.d.bombStun, t: 0, life: BOMB_FLIGHT });
  }

  // Titã: ao cruzar cada fase da vida vira pedra, chama reforços e faz o chão tremer sob as torres próximas
  function titanPhases(e, dt) {
    e.shellT = Math.max(0, (e.shellT || 0) - dt);
    e.phase = e.phase || 0;
    const mark = e.d.phases[e.phase];
    if (mark === undefined || e.hp > e.maxHp * mark) return;
    e.phase += 1;
    e.shellT = e.d.shellDur;
    for (let i = 0; i < e.d.summonCount; i++) G.spawn(e.d.summon, Math.max(0, e.dist - 24 - i * 18), e.path);
    for (const t of G.S.towers) {
      if (Math.hypot(t.x - e.x, t.y - e.y) <= e.d.quakeRange * T) t.stunT = Math.max(t.stunT || 0, e.d.quakeStun);
    }
    G.addFx({ kind: 'ring', x: e.x, y: e.y, r: e.d.quakeRange * T, color: '#c8bca8', life: 0.7 });
    G.addFx({ kind: 'text', x: e.x, y: e.y - e.d.r * 2.2, txt: 'Casca de pedra!', color: '#e0d8c8', life: 1.4 });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 80;
      G.addFx({ kind: 'shard', x: e.x, y: e.y + 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, color: i % 2 ? '#8a8478' : '#5a564e', life: 0.6 });
    }
    G.S.shake = Math.max(G.S.shake, 0.5);
    sfx.play('roar');
  }

  // Guardião: quem estiver perto de um Guardião vivo (ele mesmo não) ganha armadura
  function updateWards() {
    const S = G.S, wards = S.enemies.filter(e => e.d.wardArmor && !e.dead);
    for (const e of S.enemies) {
      // warded: armadura extra que o Guardião mais próximo dá (0 sem nenhum por perto)
      const w = wards.find(o => o !== e && Math.hypot(o.x - e.x, o.y - e.y) <= o.d.wardRange * T);
      e.warded = w ? w.d.wardArmor : 0;
    }
  }

  function updateBombs(dt) {
    const S = G.S;
    for (const b of S.bombs) {
      b.t += dt;
      if (b.t < b.life) continue;
      const t = b.tower;
      if (S.towers.includes(t)) {
        t.stunT = Math.max(t.stunT || 0, b.stun);
        G.addFx({ kind: 'blast', x: t.x, y: t.y, r: T * 0.55, fire: false, life: 0.35 });
        for (let i = 0; i < 3; i++) G.addFx({ kind: 'smoke', x: t.x + (Math.random() - 0.5) * 14, y: t.y + (Math.random() - 0.5) * 10, r: 6, life: 0.9 });
        sfx.play('boom');
      }
    }
    S.bombs = S.bombs.filter(b => b.t < b.life);
  }

  // Uma vez por quadro, antes das torres atirarem
  function update(dt) {
    updateWards();
    updateBombs(dt);
  }

  function onDeath(e) {
    if (e.d.splitInto) split(e);
    if (e.d.thief) TD.world.dropChest(e.x, e.y, 'thief');
    addCorpse(e);
  }

  // Chamado a cada quadro para cada inimigo vivo, depois de ele andar
  function tick(e, dt) {
    bossAbilities(e, dt);
    if (e.d.raiseEvery) raiseDead(e, dt);
    if (e.d.heal) healAround(e, dt);
    if (e.d.enrage) checkRage(e);
    if (e.d.burrowEvery) burrow(e, dt);
    if (e.d.blinkEvery) blink(e, dt);
    if (e.d.bombEvery) throwBomb(e, dt);
    if (e.d.phases) titanPhases(e, dt);
  }

  TD.foes = { onDeath, tick, update, updateReveal };
})();
