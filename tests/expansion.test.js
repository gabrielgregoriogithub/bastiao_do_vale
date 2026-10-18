const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame({ seed: 21 });
const { T } = TD;

// Partida no Vale, sem herói e sem onda andando; ouro de sobra para construir
function fresh() {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.gold = 99999;
  G.S.waveActive = true;
}

// Inimigo parado (congelado) na estrada, na distância dist
function frozen(role, dist) {
  G.spawn(role, dist);
  const e = G.S.enemies[G.S.enemies.length - 1];
  e.frozenT = 999;
  return e;
}

test('o Caldeirão deixa uma poça que fere quem pisa nela, ignorando a armadura', () => {
  fresh();
  const e = frozen('brute', 200);
  e.hp = e.maxHp = 5000;
  G.build('cauldron', Math.floor(e.x / T), Math.floor(e.y / T) - 1);
  runUntil(G, () => G.S.puddles.length > 0, 5);
  assert.ok(G.S.puddles.length > 0, 'formou uma poça');
  const before = e.hp;
  runUntil(G, () => false, 1);
  // 11 de dano por segundo, armadura 4 ignorada: perto de 11 em um segundo (mais se outra poça cair)
  assert.ok(before - e.hp >= 10, `dano da poça: ${before - e.hp}`);
});

test('Ácido corrosivo tira a armadura de quem pisa na poça', () => {
  fresh();
  const e = frozen('brute', 200);
  e.hp = e.maxHp = 5000;
  G.build('cauldron', Math.floor(e.x / T), Math.floor(e.y / T) - 1);
  const t = G.S.towers[0];
  G.upgrade(t); G.upgrade(t); G.specialize(t, 'acid');
  runUntil(G, () => e.corrodeT > 0, 6);
  assert.ok(e.corrodeT > 0);
  const hp = e.hp;
  G.hurt(e, 10, false, null);
  assert.ok(hp - e.hp >= 10, 'golpe de 10 sem armadura tira 10');
});

test('a Mina de Ouro paga no fim da onda; Cofre Real paga mais e Recompensa dá ouro por abate', () => {
  fresh();
  G.S.waveActive = false;
  G.build('mine', 1, 1);
  const mine = G.S.towers[0];
  assert.equal(mine.s.income, 12);
  G.startWave();
  G.S.queue = []; G.S.enemies = [];
  const gold = G.S.gold;
  G.update(1 / 60);
  assert.equal(G.S.gold - gold, G.waveBonus(1) + 12);
  assert.equal(G.S.mined, 12);
  G.upgrade(mine); G.upgrade(mine);
  G.specialize(mine, 'vault');
  assert.equal(mine.s.income, Math.round(29 * 1.75));

  fresh();
  const e = frozen('soldier', 200);
  G.build('mine', Math.floor(e.x / T), Math.floor(e.y / T) - 1);
  const m = G.S.towers[0];
  G.upgrade(m); G.upgrade(m); G.specialize(m, 'bounty');
  const g0 = G.S.gold;
  G.hurt(e, 1e9, true, null);
  assert.equal(G.S.gold - g0, Math.floor(e.d.gold + 0) + 3);
});

test('a Mina e o Caldeirão aparecem na lista de torres, com especializações', () => {
  assert.ok(TD.ORDER.includes('cauldron') && TD.ORDER.includes('mine'));
  for (const type of ['cauldron', 'mine']) assert.equal(TD.SPECS[type].length, 2);
});

test('o Berserker entra em fúria com metade da vida e anda mais rápido', () => {
  fresh();
  G.spawn('berserker', 100);
  const e = G.S.enemies[0];
  G.update(1 / 60);
  const d0 = e.dist;
  G.update(0.5);
  const calm = e.dist - d0;
  assert.ok(!e.enraged);
  e.hp = e.maxHp * 0.4;
  G.update(1 / 60);
  assert.ok(e.enraged);
  const d1 = e.dist;
  G.update(0.5);
  assert.ok(e.dist - d1 > calm * 1.5, `furioso anda ${e.dist - d1} contra ${calm}`);
});

test('o Escavador embaixo da terra não leva golpes, mas a poça o alcança', () => {
  fresh();
  const e = frozen('burrower', 200);
  e.hp = e.maxHp = 1000;
  runUntil(G, () => e.under, 10);
  assert.ok(e.under, 'mergulhou');
  G.hurt(e, 100, true, null);
  assert.equal(e.hp, 1000, 'golpe direto não alcança');
  G.S.puddles.push({ x: e.x, y: e.y, r: T, dps: 50, t: 1, life: 1, src: null, corrode: 0 });
  G.update(0.2);
  assert.ok(e.hp < 1000, 'a poça alcança');
  runUntil(G, () => !e.under, 5);
  assert.ok(!e.under, 'volta à superfície');
});

test('as ondas mais avançadas trazem Berserkers e Escavadores', () => {
  const late = [];
  for (let n = 10; n <= 19; n++) late.push(...TD.makeWave(n, 777));
  assert.ok(late.includes('berserker'));
  assert.ok(late.includes('burrower'));
  assert.ok(!TD.makeWave(2, 777).includes('burrower'));
});

test('no Cemitério as lápides ocupam casas e as duas criptas levam à mesma muralha', () => {
  G.newGame('cemiterio', 'normal');
  assert.equal(G.md.paths.length, 2);
  for (const [c, r] of G.md.map.props) assert.equal(G.md.blocked[r][c], 2, `lápide em ${c},${r}`);
  assert.equal(TD.enemyFor('cemiterio', 'boss'), 'vampire');
  assert.equal(TD.enemyFor('costa', 'burrower'), 'hermit');
});
