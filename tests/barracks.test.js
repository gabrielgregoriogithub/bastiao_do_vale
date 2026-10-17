const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame({ seed: 17 });
const { T } = TD;

// Casa livre colada na estrada do Vale, para o quartel ter onde montar o posto
const SPOT = [5, 3];

function enemyAtRally(t, type, extra = {}) {
  const path = G.md.paths[0];
  let best = 0;
  for (let d = 0; d < path.len; d += 4) {
    const q = path.posAt(d), b = path.posAt(best);
    if (Math.hypot(q.x - t.rally.x, q.y - t.rally.y) < Math.hypot(b.x - t.rally.x, b.y - t.rally.y)) best = d;
  }
  const e = {
    type, d: TD.ENEMIES[type], path, hp: 300, maxHp: 300, dist: best, prog: best / path.len, ...path.posAt(best),
    slowT: 0, slowF: 0, frozenT: 0, stunT: 0, flash: 0, healT: 99, abilT: 99, shield: 0, weakT: 0, blocked: false,
    dots: { poison: null, burn: null }, wob: 0, dead: false, ...extra,
  };
  G.S.enemies.push(e);
  return e;
}

function newBarracks() {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.gold = 9999;
  G.S.waveActive = true;
  G.build('barracks', ...SPOT);
  return G.S.towers[0];
}

test('o quartel monta o posto na estrada e põe 2 soldados; a Guarda real põe 3', () => {
  const t = newBarracks();
  assert.equal(t.units.length, 2);
  assert.ok(Math.hypot(t.rally.x - t.x, t.rally.y - t.y) <= t.s.range, 'posto dentro do alcance');
  assert.ok(G.md.blocked[Math.floor(t.rally.y / T)][Math.floor(t.rally.x / T)] === 1, 'posto em cima da estrada');
  G.upgrade(t); G.upgrade(t);
  G.specialize(t, 'guard');
  assert.equal(t.units.length, 3);
  assert.equal(t.s.unitArmor, 0.35);
});

test('os soldados seguram e ferem um inimigo terrestre que passa pelo posto', () => {
  const t = newBarracks();
  runUntil(G, () => t.units.every(u => Math.hypot(u.x - t.rally.x, u.y - t.rally.y) < 20), 5);
  const e = enemyAtRally(t, 'brute');
  const start = e.dist;
  runUntil(G, () => e.hp < 300 && e.blocked, 4);
  assert.ok(e.blocked, 'inimigo bloqueado');
  assert.ok(e.hp < 300, 'inimigo ferido');
  assert.ok(e.dist - start < 20, 'quase não andou');
  assert.ok(t.dmgDone > 0, 'o dano conta para o quartel');
});

test('voadores passam por cima dos soldados', () => {
  const t = newBarracks();
  runUntil(G, () => false, 3);
  const f = enemyAtRally(t, 'flyer');
  Object.assign(f, { x: t.rally.x, y: t.rally.y, frozenT: 999 });
  runUntil(G, () => false, 2);
  assert.equal(f.hp, 300);
  assert.ok(t.units.every(u => u.target !== f));
});

test('soldado que cai volta pelo quartel depois do tempo de recrutamento', () => {
  const t = newBarracks();
  runUntil(G, () => false, 3);
  const boss = enemyAtRally(t, 'boss', { hp: 1e9, maxHp: 1e9 });
  runUntil(G, () => t.units.some(u => u.deadT > 0), 30);
  const fallen = t.units.find(u => u.deadT > 0);
  assert.ok(fallen, 'um soldado caiu para o chefe');
  boss.dead = true;
  runUntil(G, () => fallen.deadT <= 0, TD.TOWERS.barracks.respawn + 1);
  assert.equal(fallen.hp, t.s.unitHp, 'volta com a vida cheia');
});

test('o quartel e seus soldados sobrevivem a salvar e restaurar', () => {
  const t = newBarracks();
  G.upgrade(t);
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  G.newGame('rio', 'facil');
  G.restore(snap);
  const back = G.S.towers.find(x => x.type === 'barracks');
  assert.ok(back);
  assert.equal(back.level, 2);
  assert.equal(back.units.length, 2);
  assert.ok(back.rally);
});
