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

  // Espreitador: só pode ser mirado quando está no alcance de uma torre que detecta (Geada ou Arcano)
  function updateReveal() {
    const S = G.S;
    for (const e of S.enemies) {
      if (!e.d.stealth) continue;
      e.revealed = S.towers.some(t => TOWERS[t.type].detects && Math.hypot(e.x - t.x, e.y - t.y) <= t.s.range);
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
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * e.d.heal);
      healed = true;
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

  function onDeath(e) {
    if (e.d.splitInto) split(e);
    addCorpse(e);
  }

  // Chamado a cada quadro para cada inimigo vivo, depois de ele andar
  function tick(e, dt) {
    bossAbilities(e, dt);
    if (e.d.raiseEvery) raiseDead(e, dt);
    if (e.d.heal) healAround(e, dt);
  }

  TD.foes = { onDeath, tick, updateReveal };
})();
