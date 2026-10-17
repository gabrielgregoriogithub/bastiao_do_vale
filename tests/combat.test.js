const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame();
const { T } = TD;

// Coloca um inimigo parado num ponto da primeira estrada, sem passar pela fila da onda
function placeEnemy(type, dist = 400) {
  G.S.wave = Math.max(G.S.wave, 1);
  const before = G.S.enemies.length;
  const path = G.md.paths[0];
  G.S.enemies.push({
    type, d: TD.ENEMIES[type], path, hp: 100, maxHp: 100, dist, prog: dist / path.len, ...path.posAt(dist),
    slowT: 0, slowF: 0, frozenT: 0, flash: 0, healT: 1, abilT: 99, shield: 0, weakT: 0, blocked: false,
    dots: { poison: null, burn: null }, wob: 0, dead: false,
  });
  return G.S.enemies[before];
}

test('construir cobra o custo e a estrada não aceita torre', () => {
  G.newGame('vale', 'normal');
  const gold = G.S.gold;
  G.build('archer', 0, 0);
  assert.equal(G.S.gold, gold - G.costOf('archer'));
  G.build('archer', 0, 2); // (0,2) é estrada no Vale
  assert.equal(G.S.towers.length, 1);
});

test('melhorar até o nível 3, especializar e vender devolve 70%', () => {
  G.newGame('vale', 'normal');
  G.S.gold = 5000;
  G.build('archer', 0, 0);
  const t = G.S.towers[0];
  G.specialize(t, 'volley');
  assert.equal(t.spec, null, 'não especializa antes do nível 3');
  G.upgrade(t); G.upgrade(t); G.upgrade(t);
  assert.equal(t.level, 3, 'o nível máximo é 3');
  G.specialize(t, 'volley');
  assert.equal(t.spec, 'volley');
  assert.equal(t.s.targets, 3);
  G.startWave(); // depois que uma onda começa, a torre já não é "recém-construída"
  const spent = t.spent, gold = G.S.gold;
  G.sell(t);
  assert.equal(G.S.gold, gold + Math.floor(spent * 0.7));
  assert.equal(G.S.towers.length, 0);
});

test('torre recém-construída devolve o preço cheio até atirar ou a onda começar', () => {
  G.newGame('vale', 'normal');
  G.build('archer', 0, 0);
  const gold = G.S.gold, t = G.S.towers[0];
  assert.equal(t.fresh, true);
  G.sell(t);
  assert.equal(G.S.gold, gold + G.costOf('archer'), 'clique errado desfeito sem perder ouro');

  G.build('archer', 3, 1);
  const t2 = G.S.towers[0];
  G.startWave();
  assert.equal(t2.fresh, false, 'a onda começou');
  assert.equal(G.refund(t2), Math.floor(t2.spent * 0.7));
});

test('armadura reduz o dano, mas nunca abaixo de 25%', () => {
  G.newGame('vale', 'normal');
  const e = placeEnemy('brute');
  G.hurt(e, 10, false, null);
  assert.equal(e.hp, 94);
  G.hurt(e, 2, false, null);
  assert.equal(e.hp, 93.5);
  G.hurt(e, 10, true, null);
  assert.equal(e.hp, 83.5, 'dano perfurante ignora armadura');
});

test('escudo absorve antes da vida e a runa de fraqueza aumenta o dano', () => {
  G.newGame('vale', 'normal');
  const e = placeEnemy('soldier');
  e.shield = 15;
  G.hurt(e, 20, true, null);
  assert.equal(e.shield, 0);
  assert.equal(e.hp, 95);
  e.weakT = 3;
  G.hurt(e, 20, true, null);
  assert.equal(e.hp, 95 - 20 * TD.WEAK_MUL);
});

test('abate rende ouro e o Colosso se parte em 4 Blindados', () => {
  G.newGame('vale', 'normal');
  const gold = G.S.gold;
  const c = placeEnemy('colossus');
  G.hurt(c, 1e6, true, null);
  assert.ok(c.dead);
  assert.ok(G.S.gold > gold);
  assert.equal(G.S.enemies.filter(e => e.type === 'brute' && !e.dead).length, 4);
});

test('o Canhão ignora voadores e o Arcano os acerta', () => {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.gold = 5000;
  const flyer = placeEnemy('flyer');
  // na rota de voo e congelada, para ficar parada ao alcance da torre
  Object.assign(flyer, G.md.paths[0].flyAt(300), { dist: 300, frozenT: 999 });
  let c = -1, r = -1;
  for (let dc = -1; dc <= 1 && c < 0; dc++) {
    for (let dr = -1; dr <= 1 && c < 0; dr++) {
      const cc = Math.floor(flyer.x / T) + dc, rr = Math.floor(flyer.y / T) + dr;
      if (G.canBuild(cc, rr)) { c = cc; r = rr; }
    }
  }
  assert.ok(c >= 0, 'precisa de uma casa livre ao lado da Gárgula');
  G.build('cannon', c, r);
  G.S.waveActive = true;
  runUntil(G, () => false, 3);
  assert.equal(flyer.hp, 100, 'o Canhão não deveria acertar a Gárgula');
  G.sell(G.S.towers[0]);
  G.build('arcane', c, r);
  runUntil(G, () => flyer.hp < 100, 3);
  assert.ok(flyer.hp < 100, 'o Arcano deveria acertar a Gárgula');
});

test('toda especialização segura uma onda sem erros', () => {
  for (const type of TD.ORDER) {
    for (const sp of TD.SPECS[type]) {
      G.newGame('vale', 'facil');
      G.S.gold = 99999;
      for (const [c, r] of [[3, 4], [5, 5], [8, 6]]) G.build(type, c, r);
      for (const t of G.S.towers) { G.upgrade(t); G.upgrade(t); G.specialize(t, sp.id); }
      assert.ok(G.S.towers.every(t => t.spec === sp.id), `${sp.id} aplicada`);
      G.startWave();
      runUntil(G, () => !G.S.waveActive, 300);
      assert.equal(G.S.waveActive, false, `${sp.id}: a onda 1 deveria terminar`);
    }
  }
});

test('poderes: chuva fere a área, congelar para todos e a recarga bloqueia repetição', () => {
  G.newGame('vale', 'normal');
  G.startWave();
  runUntil(G, () => G.S.enemies.length >= 3, 30);
  const e = G.S.enemies[0];
  const hp = e.hp;
  assert.equal(G.usePower('rain', e.x, e.y), true);
  runUntil(G, () => G.S.strikes.length === 0, 2);
  assert.ok(e.dead || e.hp < hp);
  assert.equal(G.usePower('freeze'), true);
  assert.ok(G.S.enemies.every(x => x.frozenT > 0));
  assert.equal(G.usePower('freeze'), false, 'em recarga');
});
