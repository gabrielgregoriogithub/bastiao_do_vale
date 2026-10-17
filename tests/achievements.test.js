const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G, store } = loadGame({ seed: 11 });
const A = TD.achievements;

function bossAt(type) {
  const path = G.md.paths[0];
  const e = {
    type, d: TD.ENEMIES[type], path, hp: 10, maxHp: 10, dist: 100, prog: 0.3, ...path.posAt(100),
    slowT: 0, slowF: 0, frozenT: 0, flash: 0, healT: 9, abilT: 9, shield: 0, weakT: 0, stunT: 0, blocked: false,
    dots: { poison: null, burn: null }, wob: 0, dead: false,
  };
  G.S.enemies.push(e);
  return e;
}

test('derrotar Dragão e Colosso libera as conquistas de chefe', () => {
  G.newGame('vale', 'normal');
  assert.equal(A.has('dragon'), false);
  G.hurt(bossAt('dragon'), 1e6, true, null);
  G.hurt(bossAt('colossus'), 1e6, true, null);
  assert.equal(A.has('dragon'), true);
  assert.equal(A.has('colossus'), true);
  assert.ok(store.get('bastiao-conquistas').includes('dragon'), 'a conquista fica salva');
});

test('vitória sem perder vidas, no Difícil e com todos os desafios', () => {
  G.newGame('vale', 'dificil', TD.CHALLENGES.map(c => c.id));
  G.S.lives = G.S.maxLives;
  A.onVictory();
  for (const id of ['first_win', 'flawless', 'hard_win', 'no_hero_win', 'all_challenges']) assert.equal(A.has(id), true, id);
  assert.equal(A.has('all_maps'), false, 'só um campo vencido até aqui');
});

test('chamar 10 ondas antes da hora e usar os 3 poderes numa onda', () => {
  G.newGame('vale', 'facil');
  G.S.lives = 1e6; // sem torres a muralha cairia antes da décima chamada
  for (let i = 0; i < 11; i++) {
    G.startWave();
    runUntil(G, () => G.canCallEarly(), 120);
  }
  A.sync(0);
  assert.equal(A.has('rush'), true);
  runUntil(G, () => G.S.enemies.length > 0, 30);
  const e = G.S.enemies[0];
  G.usePower('rain', e.x, e.y); G.usePower('freeze'); G.usePower('rally');
  A.sync(0);
  assert.equal(A.has('commander'), true);
});

test('abates somam entre partidas até mil', () => {
  const before = A.totalKills();
  G.newGame('vale', 'normal');
  for (let i = 0; i < 1000; i++) G.hurt(bossAt('soldier'), 1e6, true, null);
  A.flushKills();
  assert.equal(A.totalKills(), before + 1000);
  assert.equal(A.has('kills_1000'), true);
  assert.equal(Number(store.get('bastiao-abates-total')), A.totalKills());
});
