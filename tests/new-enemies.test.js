const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame({ seed: 13 });
const { T } = TD;

// Inimigo parado (congelado) num ponto da estrada, fora da fila da onda
function place(type, dist = 400, extra = {}) {
  const path = G.md.paths[0];
  const e = {
    type, d: TD.ENEMIES[type], path, hp: 200, maxHp: 200, dist, prog: dist / path.len, ...path.posAt(dist),
    slowT: 0, slowF: 0, frozenT: 999, stunT: 0, flash: 0, healT: 99, abilT: 99, shield: 0, weakT: 0, blocked: false,
    dots: { poison: null, burn: null }, wob: 0, dead: false, ...extra,
  };
  G.S.enemies.push(e);
  return e;
}

function freeCellNear(e) {
  for (let d = 1; d <= 2; d++) {
    for (const [dc, dr] of [[0, d], [0, -d], [d, 0], [-d, 0]]) {
      const c = Math.floor(e.x / T) + dc, r = Math.floor(e.y / T) + dr;
      if (G.canBuild(c, r)) return [c, r];
    }
  }
  throw new Error('sem casa livre');
}

test('Espreitador: o Arqueiro sozinho não o enxerga; com uma Geada perto, sim', () => {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.gold = 9999;
  G.S.waveActive = true;
  const s = place('stalker');
  G.build('archer', ...freeCellNear(s));
  runUntil(G, () => false, 3);
  assert.equal(s.hp, 200, 'camuflado: o Arqueiro não atira');
  assert.equal(s.revealed, false);
  G.build('frost', ...freeCellNear(s));
  runUntil(G, () => s.hp < 200, 3);
  assert.equal(s.revealed, true, 'a Geada revela');
  assert.ok(s.hp < 200);
});

test('Espreitador: explosões acertam mesmo sem revelar', () => {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.waveActive = true;
  const s = place('stalker');
  const decoy = place('soldier', 400);
  G.S.gold = 9999;
  G.build('cannon', ...freeCellNear(decoy));
  runUntil(G, () => s.hp < 200, 4);
  assert.ok(s.hp < 200, 'o respingo do Canhão atinge o camuflado');
});

test('Necromante levanta até 2 Esqueletos de quem caiu perto, e esqueletos não viram corpo', () => {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.waveActive = true;
  const necro = place('necro', 300, { raiseT: 0.1 });
  for (const dist of [290, 300, 310]) G.hurt(place('soldier', dist), 1e6, true, null);
  assert.equal(G.S.corpses.length, 3);
  runUntil(G, () => G.S.enemies.some(e => e.d.role === 'skeleton'), 1);
  const skeletons = G.S.enemies.filter(e => e.d.role === 'skeleton');
  assert.equal(skeletons.length, 2, 'no máximo 2 por vez');
  assert.equal(G.S.corpses.length, 1);
  G.hurt(skeletons[0], 1e6, true, null);
  assert.equal(G.S.corpses.length, 1, 'esqueleto derrotado não deixa corpo');
  assert.ok(!necro.dead);
});

test('Colosso morto por explosão: os Blindados que saem dele não levam o mesmo golpe', () => {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.wave = 15;
  G.S.waveActive = true;
  const c = place('colossus', 400, { hp: 1, maxHp: 1 });
  G.S.strikes.push({ x: c.x, y: c.y, r: 2 * T, dmg: 50, t: 0 });
  G.update(1 / 60);
  const brutes = G.S.enemies.filter(e => e.d.role === 'brute');
  assert.equal(brutes.length, 4);
  for (const b of brutes) assert.equal(b.hp, b.maxHp, 'Blindado nasce com a vida cheia');
});

test('sorteio das ondas: nas ondas altas todos os tipos aparecem e ainda há soldados', () => {
  const counts = {};
  let total = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const t of TD.makeWave(20, seed)) { counts[t] = (counts[t] || 0) + 1; total++; }
  }
  for (const t of ['soldier', 'scout', 'brute', 'healer', 'flyer', 'stalker', 'necro']) assert.ok(counts[t] > 0, `falta ${t}`);
  assert.ok(counts.soldier / total > 0.08, `soldados: ${Math.round(counts.soldier / total * 100)}%`);
  assert.ok(!counts.skeleton, 'esqueletos só nascem do Necromante');
  assert.deepEqual(TD.makeWave(3, 5).filter(t => t !== 'soldier' && t !== 'scout'), [], 'ondas iniciais continuam simples');
});

test('suas melhores partidas: guarda as 10 melhores, por ondas e depois abates', () => {
  for (let i = 0; i < 14; i++) {
    G.newGame('rio', 'normal');
    G.S.wave = 3 + (i % 7);
    G.S.kills = i * 10;
    G.S.inGame = true;
    TD.achievements.recordRun(false);
  }
  const best = TD.achievements.runs();
  assert.equal(best.length, 10);
  for (let i = 1; i < best.length; i++) {
    const a = best[i - 1], b = best[i];
    assert.ok(a.wave > b.wave || (a.wave === b.wave && a.kills >= b.kills), 'ordenado');
  }
  assert.equal(best[0].map, 'Passo do Rio');
});

test('vencer e cair depois no modo sem fim vira uma partida só em suas melhores partidas', () => {
  G.newGame('vale', 'normal');
  G.S.wave = 20;
  G.S.kills = 4321;
  TD.achievements.recordRun(true);
  G.continueEndless();
  G.S.wave = 26;
  TD.achievements.recordRun(false);
  const mine = TD.achievements.runs().filter(r => r.kills === 4321);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].wave, 25);
  assert.equal(mine[0].victory, true, 'continua marcada como vitória');
});
