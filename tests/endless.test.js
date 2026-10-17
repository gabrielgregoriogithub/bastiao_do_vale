const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G, store } = loadGame();

// Vida de um inimigo recém-criado na onda n, no Normal
function hpAt(type, n) {
  G.newGame('vale', 'normal');
  G.S.wave = n;
  G.spawn(type);
  return G.S.enemies[G.S.enemies.length - 1].maxHp;
}

test('inimigos comuns endurecem mais rápido que os chefes ao longo da campanha', () => {
  const growth = type => hpAt(type, 20) / hpAt(type, 1);
  assert.ok(growth('soldier') > growth('boss') * 1.4, `soldado ${growth('soldier').toFixed(1)}× contra chefe ${growth('boss').toFixed(1)}×`);
  assert.equal(hpAt('soldier', 1), TD.ENEMIES.soldier.hp, 'a primeira onda continua igual');
});

test('no modo sem fim cada onda depois da 20 cresce além da curva da campanha', () => {
  const campaign = n => 1 + (n - 1) * 0.2 + (n - 1) ** 2 * TD.DIFFICULTIES.normal.curve;
  const extra = n => hpAt('soldier', n) / (TD.ENEMIES.soldier.hp * campaign(n));
  assert.ok(Math.abs(extra(20) - 1) < 0.02, 'até a onda 20 vale só a curva da campanha');
  assert.ok(extra(30) > 1.3, `onda 30 só ${extra(30).toFixed(2)}× a curva`);
  assert.ok(extra(40) > extra(30) * 1.3, 'o reforço continua crescendo');
});

test('as colunas de inimigos ficam mais densas nas ondas altas', () => {
  const spawnGap = n => {
    G.newGame('vale', 'normal');
    G.S.wave = n - 1;
    G.S.next = ['soldier', 'soldier'];
    G.startWave();
    runUntil(G, () => G.S.queue.length === 1, 10);
    return G.S.spawnT;
  };
  assert.ok(spawnGap(15) < spawnGap(1) * 0.7, `onda 15: ${spawnGap(15).toFixed(2)} s, onda 1: ${spawnGap(1).toFixed(2)} s`);
});

test('a Feiticeira protege os aliados, mas não a si mesma', () => {
  G.newGame('vale', 'normal');
  G.S.wave = 9;
  G.S.next = [];
  G.startWave();
  G.spawn('witch', 200);
  G.spawn('soldier', 210);
  const [witch, ally] = G.S.enemies;
  witch.abilT = 0;
  G.update(1 / 60);
  assert.ok(ally.shield > 0, 'o aliado ganha escudo');
  assert.equal(witch.shield, 0, 'ela não se protege');
});

test('estrelas de campos desenhados não contam na Forja', () => {
  store.clear();
  TD.MAPS.push(TD.customMap('Atalho', [[0, 5], [19, 5]]));
  store.set('bastiao-estrelas-custom-facil', '3');
  store.set('bastiao-estrelas-vale-facil', '2');
  assert.equal(TD.meta.totalStars(), 2);
});
