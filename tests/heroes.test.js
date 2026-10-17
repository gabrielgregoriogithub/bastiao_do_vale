const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame({ seed: 3 });
const { T } = TD;

// Inimigo parado (congelado) perto do herói, sem passar pela fila da onda
function enemyNear(h, type, dx = 20) {
  const path = G.md.paths[0];
  const e = {
    type, d: TD.ENEMIES[type], path, hp: 500, maxHp: 500, dist: 100, prog: 0.5, x: h.x + dx, y: h.y,
    slowT: 0, slowF: 0, frozenT: 999, flash: 0, healT: 99, abilT: 99, shield: 0, weakT: 0, stunT: 0, blocked: false,
    dots: { poison: null, burn: null }, wob: 0, dead: false,
  };
  G.S.enemies.push(e);
  return e;
}

test('o Cavaleiro bloqueia e fere inimigos terrestres, mas ignora voadores', () => {
  G.newGame('vale', 'normal', [], 'knight');
  G.S.waveActive = true;
  const h = G.S.hero;
  const flyer = enemyNear(h, 'flyer', 10);
  runUntil(G, () => false, 2);
  assert.equal(flyer.hp, 500, 'o Cavaleiro não alcança voadores');
  const soldier = enemyNear(h, 'soldier', 15);
  runUntil(G, () => soldier.hp < 500, 3);
  assert.ok(soldier.hp < 500);
  assert.equal(h.target, soldier);
});

test('a Arqueira acerta voadores de longe e nunca perde vida', () => {
  G.newGame('vale', 'normal', [], 'ranger');
  G.S.waveActive = true;
  const h = G.S.hero;
  const flyer = enemyNear(h, 'flyer', 2 * T);
  runUntil(G, () => flyer.hp < 500, 3);
  assert.ok(flyer.hp < 500, 'a Arqueira deveria acertar a Gárgula');
  assert.equal(h.hp, h.maxHp);
  assert.equal(flyer.blocked, false, 'a Arqueira não bloqueia');
});

test('Investida atordoa e fere quem está perto; chefes ficam atordoados por menos tempo', () => {
  G.newGame('vale', 'normal', [], 'knight');
  G.S.waveActive = true;
  const h = G.S.hero;
  const near = enemyNear(h, 'soldier', 20), boss = enemyNear(h, 'boss', -20), far = enemyNear(h, 'soldier', 4 * T);
  assert.equal(TD.hero.useAbility(), true);
  assert.ok(near.stunT > boss.stunT && boss.stunT > 0);
  assert.ok(near.hp < 500);
  assert.equal(far.stunT, 0);
  assert.equal(TD.hero.useAbility(), false, 'em recarga');
});

test('Saraivada dispara 8 flechas e só funciona durante as ondas', () => {
  G.newGame('vale', 'normal', [], 'ranger');
  const h = G.S.hero;
  enemyNear(h, 'soldier', 2 * T);
  assert.equal(TD.hero.useAbility(), false, 'fora da onda');
  G.S.waveActive = true;
  const before = G.S.shots.length;
  assert.equal(TD.hero.useAbility(), true);
  assert.equal(G.S.shots.length - before, TD.HEROES.ranger.ability.arrows);
});

test('o tipo de herói sobrevive a salvar e restaurar', () => {
  G.newGame('rio', 'facil', [], 'ranger');
  G.S.hero.level = 3;
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  G.newGame('vale', 'facil');
  G.restore(snap);
  assert.equal(G.S.hero.kind, 'ranger');
  assert.equal(G.S.hero.level, 3);
});
