const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

// uma estrela no Vale libera a Barricada
const { TD, G, store } = loadGame({ seed: 11, storage: { 'bastiao-estrelas-vale-normal': '1' } });
const { T } = TD;

// Partida parada na onda, sem herói, para testar uma coisa de cada vez
function fresh(map) {
  G.newGame(map, 'normal', ['nohero']);
  G.S.waveActive = true;
  G.S.queue = [];
  return G.S;
}

test('Ruínas do Sol e Minas de Cristal são jogáveis, com espaço para torres', () => {
  for (const id of ['ruinas', 'minas']) {
    G.newGame(id, 'normal');
    const md = G.md;
    assert.ok(md.pathLen > 800, `${id}: estrada de ${md.pathLen}`);
    const free = md.blocked.flat().filter(v => v === 0).length;
    assert.ok(free >= 80, `${id}: ${free} casas livres`);
    assert.ok(TD.CHRONICLE[id], `capítulo de ${id}`);
  }
  G.newGame('ruinas', 'normal');
  assert.equal(G.md.portals.length, 1);
  assert.ok(G.md.portals[0].db - G.md.portals[0].da > 5 * T, 'o portal pula um bom trecho');
  G.newGame('minas', 'normal');
  assert.equal(G.md.crystals.length, TD.MAPS.find(m => m.id === 'minas').crystals.length, 'todo veio fica numa casa livre');
  for (const [c, r] of G.md.crystals) assert.ok(G.canBuild(c, r));
});

test('o portal aberto leva o inimigo adiante; selado, ele dá a volta inteira', () => {
  const S = fresh('ruinas'), p = G.md.portals[0];
  G.spawn('soldier', p.da - 10);
  const e = S.enemies[0];
  runUntil(G, () => e.dist > p.da, 3);
  assert.ok(e.dist >= p.db, 'saiu na outra boca');

  const S2 = fresh('ruinas');
  S2.gold = 100;
  assert.ok(TD.world.seal(0));
  assert.equal(S2.gold, 100 - TD.world.sealCost());
  assert.equal(TD.world.seal(0), false, 'não sela duas vezes');
  G.spawn('soldier', p.da - 10);
  const f = S2.enemies[0];
  runUntil(G, () => f.dist > p.da + 20, 3);
  assert.ok(f.dist < p.db, 'com o selo, segue pela estrada');
});

test('o selo do portal acaba, espera a recarga e o tempo só corre durante as ondas', () => {
  const S = fresh('ruinas');
  S.gold = 500;
  TD.world.seal(0);
  S.waveActive = false;
  runUntil(G, () => false, 20);
  assert.ok(S.seals[0].t > 0, 'parado entre as ondas');
  S.waveActive = true;
  S.queue = ['soldier']; // inimigo na fila que não sai: a onda não termina sozinha
  S.spawnT = 999;
  runUntil(G, () => S.seals[0].t <= 0, 20);
  assert.ok(S.seals[0].cd > 0, 'recarga do selo');
  assert.equal(TD.world.canSeal(0), false);
  runUntil(G, () => S.seals[0].cd <= 0, 10);
  assert.ok(TD.world.canSeal(0));
});

test('torre sobre um veio de cristal bate mais forte e alcança mais longe', () => {
  const S = fresh('minas');
  S.gold = 1000;
  const [c, r] = G.md.crystals[0];
  G.build('archer', c, r);
  let free = null;
  for (let rr = 0; rr < TD.ROWS && !free; rr++) for (let cc = 0; cc < TD.COLS && !free; cc++) if (G.canBuild(cc, rr) && !G.md.crystalAt(cc, rr)) free = [cc, rr];
  G.build('archer', ...free);
  const [onVein, plain] = S.towers;
  assert.ok(onVein.s.crystal && !plain.s.crystal);
  assert.ok(Math.abs(onVein.s.dmg / plain.s.dmg - TD.CRYSTAL_DMG) < 1e-9);
  assert.ok(onVein.s.range > plain.s.range);
});

test('o Saltador salta adiante, mas congelado não sai do lugar', () => {
  const S = fresh('vale');
  G.spawn('blinker', 100);
  G.spawn('blinker', 300);
  const [a, b] = S.enemies;
  b.frozenT = 99;
  runUntil(G, () => a.dist > 100 + 1.4 * T + 1.1 * T * 3, 4);
  assert.ok(a.dist - 100 > 1.1 * T * 3 + T, 'andou mais do que a pé');
  assert.equal(b.dist, 300);
});

test('o Guardião dá armadura aos vizinhos e resiste a flechas, mas não à magia', () => {
  const S = fresh('vale');
  G.spawn('soldier', 200);
  G.spawn('warder', 210);
  G.spawn('soldier', 600);
  const [near, ward, far] = S.enemies;
  for (const e of S.enemies) e.frozenT = 99;
  G.update(1 / 60);
  assert.ok(near.warded && !far.warded && !ward.warded);
  const hp = e => e.maxHp - e.hp;
  G.hurt(near, 10, false, null);
  G.hurt(far, 10, false, null);
  assert.ok(hp(near) < hp(far), 'o vizinho do Guardião sofre menos');
  const archer = { type: 'archer', dmgDone: 0, kills: 0, s: {} }, arcane = { type: 'arcane', dmgDone: 0, kills: 0, s: {} };
  assert.equal(G.resistMul(ward, archer), 0.6);
  assert.equal(G.resistMul(ward, arcane), 1.4);
  assert.match(TD.ENEMY_INFO.warder, /Resiste a golpes físicos/);
});

test('o Sabotador joga uma bomba que para a torre mais próxima', () => {
  const S = fresh('vale');
  S.gold = 1000;
  G.spawn('saboteur', 160);
  const e = S.enemies[0];
  // torre numa casa livre ao lado dele; a lentidão total o deixa parado (atordoado não arremessaria)
  const c0 = Math.floor(e.x / T), r0 = Math.floor(e.y / T);
  const spot = [[0, -1], [0, 1], [1, -1], [1, 1], [-1, -1], [-1, 1]].map(([dc, dr]) => [c0 + dc, r0 + dr]).find(([c, r]) => G.canBuild(c, r));
  G.build('archer', ...spot);
  const t = S.towers[0];
  Object.assign(e, { bombT: 0, slowT: 99, slowF: 1 });
  runUntil(G, () => t.stunT > 0, 3);
  assert.ok(t.stunT > 0, 'torre parada');
});

test('o Titã vira pedra, chama Saltadores do campo e faz as torres tremerem', () => {
  const S = fresh('ruinas');
  S.gold = 1000;
  G.spawn('titan', 300);
  const boss = S.enemies[0];
  assert.equal(boss.type, 'suncolossus');
  G.build('archer', Math.floor(boss.x / T) + 1, Math.floor(boss.y / T) - 1);
  boss.frozenT = 99;
  G.hurt(boss, boss.maxHp * 0.4, true, null);
  G.update(1 / 60);
  assert.ok(boss.shellT > 0, 'casca de pedra');
  assert.equal(S.enemies.filter(e => e.type === 'portalspirit').length, 3);
  assert.ok(S.towers.every(t => Math.hypot(t.x - boss.x, t.y - boss.y) > TD.ENEMIES.titan.quakeRange * T || t.stunT > 0));
  const hp = boss.hp;
  G.hurt(boss, 500, true, null);
  assert.equal(boss.hp, hp, 'nada fere a pedra');
  runUntil(G, () => boss.shellT <= 0, 4);
  G.hurt(boss, 500, true, null);
  assert.ok(boss.hp < hp);
});

test('a onda 20 das Ruínas e das Minas traz o Titã; os outros campos mantêm o rodízio', () => {
  assert.ok(TD.makeWave(20, 1, 'ruinas').includes('titan'));
  assert.ok(TD.makeWave(20, 1, 'minas').includes('titan'));
  assert.ok(TD.makeWave(20, 1, 'vale').includes('dragon'));
  assert.equal(TD.enemyName('minas', TD.bossFor(20, 'minas')), 'Coração da Montanha');
  assert.equal(TD.bossFor(25), 'titan', 'no modo sem fim o Titã entra no rodízio');
});

test('o Ladrão de Ouro foge sem custar vidas e, derrubado, deixa um baú com ouro', () => {
  const S = fresh('vale');
  G.spawn('thief', G.md.pathLen - 5);
  const lives = S.lives;
  runUntil(G, () => !S.enemies.length, 2);
  assert.equal(S.lives, lives);

  G.spawn('thief', 300);
  const thief = S.enemies[0];
  G.hurt(thief, 1e9, true, null);
  assert.equal(S.chests.length, 1);
  assert.ok(TD.achievements.has('thief'));
  const gold = S.gold, k = S.chests[0];
  assert.ok(TD.world.tap(k.x, k.y));
  assert.ok(S.gold > gold);
  assert.equal(S.chests.length, 0);
});

test('baús escondidos aparecem no cenário em algumas ondas e somem depois de duas', () => {
  const S = fresh('vale');
  S.waveActive = false;
  S.wave = 2;
  S.next = ['soldier'];
  G.startWave();
  assert.equal(S.wave, 3);
  assert.equal(S.chests.length, 1);
  const k = S.chests[0];
  assert.equal(G.md.blocked[k.r][k.c], 2, 'escondido numa casa de cenário');
  S.wave = 5;
  TD.world.onWaveStart();
  assert.equal(S.chests.length, 1, 'ainda dá tempo');
  S.wave = 6;
  TD.world.onWaveStart();
  assert.equal(S.chests.length, 0);
});

test('relíquias: o baú pode trazer uma, ela é guardada, equipada e muda o herói', () => {
  TD.relics.reset();
  G.newGame('vale', 'normal');
  const base = G.S.hero.maxHp;
  const random = Math.random;
  Math.random = () => 0; // o baú sempre traz relíquia, e a primeira que falta
  TD.world.dropChest(100, 100, 'hidden');
  TD.world.openChest(G.S.chests[0]);
  Math.random = random;
  assert.deepEqual(TD.relics.owned(), ['amulet']);
  assert.deepEqual(TD.relics.equipped(), ['amulet'], 'equipa sozinha quando há espaço');
  assert.ok(store.get('bastiao-reliquias').includes('amulet'));
  G.newGame('vale', 'normal');
  assert.ok(Math.abs(G.S.hero.maxHp - base * 1.3) < 1e-6);
  // espaços limitados
  TD.relics.grant('blade');
  TD.relics.grant('idol');
  assert.equal(TD.relics.equipped().length, TD.RELIC_SLOTS);
  assert.equal(TD.relics.toggle('idol'), false);
  assert.ok(TD.relics.toggle('amulet'));
  assert.ok(TD.relics.toggle('idol'));
  G.newGame('vale', 'normal');
  assert.ok(Math.abs(G.S.hero.dmg - TD.HEROES.knight.dmg * 1.25) < 1e-6);
  TD.relics.reset();
});

test('a Barricada só sobe na estrada e segura os inimigos terrestres', () => {
  const S = fresh('vale');
  assert.ok(G.canUsePower('barricade'));
  assert.equal(G.usePower('barricade', 2, 2), false, 'longe da estrada não sobe');
  const p = G.md.posAt(300);
  assert.ok(G.usePower('barricade', p.x, p.y));
  assert.equal(S.barricades.length, 1);
  G.spawn('soldier', 200);
  const e = S.enemies[0];
  runUntil(G, () => false, 3);
  assert.ok(e.dist < 300, `parado na barricada (${Math.round(e.dist)})`);
  assert.ok(S.barricades[0].hp < S.barricades[0].maxHp, 'a barricada apanha');
});

test('sem estrelas a Barricada fica trancada', () => {
  store.delete('bastiao-estrelas-vale-normal');
  fresh('vale');
  assert.equal(G.powerLocked(TD.POWERS.find(p => p.id === 'barricade')), true);
  assert.equal(G.canUsePower('barricade'), false);
  assert.ok(G.canUsePower('rain'), 'os outros poderes seguem livres');
  store.set('bastiao-estrelas-vale-normal', '1');
});

test('nas Minas, o tremor derruba pedras do teto no lugar dos raios', () => {
  const S = fresh('minas');
  S.storm = true;
  S.boltT = 0;
  G.spawn('soldier', 300);
  G.update(1 / 60);
  assert.ok(S.fx.some(f => f.kind === 'rockfall'));
  assert.ok(!S.fx.some(f => f.kind === 'lightning'));
});

test('cada inimigo novo tem versão em todos os ambientes e aparece nas ondas altas', () => {
  for (const m of TD.officialMaps()) {
    for (const role of ['blinker', 'warder', 'saboteur', 'titan']) {
      const type = TD.enemyFor(m.id, role);
      assert.equal(TD.ENEMIES[type].role, role, `${m.id}/${role}`);
    }
  }
  const seen = new Set();
  for (let n = 10; n <= 20; n++) for (let s = 0; s < 6; s++) for (const t of TD.makeWave(n, s * 101 + n)) seen.add(t);
  for (const role of ['blinker', 'warder', 'saboteur']) assert.ok(seen.has(role), role);
});

test('emboscada: um bando sai da coluna e pula no meio da estrada depois do aviso', () => {
  const S = fresh('vale');
  S.wave = 7;
  S.queue = ['soldier', 'scout', 'flyer', 'soldier', 'brute', 'soldier', 'soldier'];
  const rnd = Math.random;
  Math.random = () => 0.05;
  try { TD.world.onWaveStart(); } finally { Math.random = rnd; }
  const a = S.ambush;
  assert.ok(a, 'a emboscada foi armada');
  assert.deepEqual(a.roles, ['soldier', 'scout', 'soldier', 'brute'], 'o voador fica na coluna');
  assert.deepEqual(S.queue, ['flyer', 'soldier', 'soldier']);
  assert.ok(a.dist > a.path.len * 0.3 && a.dist < a.path.len * 0.8, 'no meio da estrada');
  S.queue = [];
  G.update(1);
  assert.equal(S.enemies.length, 0, 'ninguém sai antes do aviso acabar');
  assert.ok(S.waveActive, 'a onda não acaba com o bando escondido');
  runUntil(G, () => !S.ambush, 8);
  assert.equal(S.enemies.length, 4);
  assert.ok(S.enemies.every(e => e.dist > a.path.len * 0.3), 'o bando já começa adiantado');
});

test('emboscada não acontece em onda de chefe nem cedo demais', () => {
  const S = fresh('vale');
  const rnd = Math.random;
  Math.random = () => 0.01;
  try {
    for (const w of [3, 10]) {
      S.wave = w;
      S.queue = Array(8).fill('soldier');
      TD.world.onWaveStart();
      assert.equal(S.ambush, null, `onda ${w}`);
      assert.equal(S.queue.length, 8);
    }
  } finally { Math.random = rnd; }
});

// Caravana armada à mão no fim da estrada, para cada teste começar do mesmo jeito
function caravanOn(map) {
  const S = fresh(map);
  S.wave = 6;
  const rnd = Math.random;
  Math.random = () => 0.9; // sem emboscada nem baú escondido...
  try { TD.world.onWaveStart(); } finally { Math.random = rnd; }
  Math.random = () => 0.05; // ...mas com caravana
  try { TD.world.onWaveStart(); } finally { Math.random = rnd; }
  return S;
}

test('caravana desce a estrada na contramão e, a salvo, deixa um baú', () => {
  const S = caravanOn('vale');
  const k = S.caravan;
  assert.ok(k, 'a caravana saiu do castelo');
  const start = k.dist;
  G.update(1);
  assert.ok(k.dist < start, 'anda para a entrada do vale');
  assert.ok(S.waveActive, 'a onda espera a caravana');
  const chests = S.chests.length;
  runUntil(G, () => !S.caravan, 90);
  assert.equal(S.caravans, 1);
  assert.equal(S.chests.length, chests + 1, 'deixou o baú');
  assert.equal(S.chests[S.chests.length - 1].kind, 'caravan');
  runUntil(G, () => !S.waveActive, 2);
  assert.ok(!S.waveActive, 'sem caravana a onda termina');
});

test('inimigo que encosta para e saqueia a caravana', () => {
  const S = caravanOn('vale');
  const k = S.caravan;
  G.spawn('brute', k.dist, k.path);
  const e = S.enemies[0];
  e.frozenT = 99; // fica parado em cima da carroça
  G.update(0.1);
  assert.ok(k.stopped, 'a carroça parou');
  const at = k.dist;
  runUntil(G, () => !S.caravan, 60);
  assert.equal(S.caravan, null);
  assert.equal(S.caravans, 0, 'não chegou');
  assert.ok(at > 0);
});

test('cada novidade do campo ganha cartão de apresentação uma única vez', () => {
  const seen = () => JSON.parse(store.get('bastiao-vistos') || '[]');
  G.newGame('minas', 'normal', ['nohero']);
  TD.codex.sync(1 / 60);
  assert.ok(seen().includes('evento:crystal'), 'o veio de cristal é apresentado antes da primeira onda');
  assert.ok(!seen().includes('evento:caravan'));
  const S = caravanOn('vale');
  TD.codex.sync(1 / 60);
  assert.ok(seen().includes('evento:caravan'));
  assert.equal(seen().filter(k => k === 'evento:caravan').length, 1);
  S.caravan = null;
  const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => ((t[k] = v), true) });
  for (const id of ['ambush', 'caravan', 'chest', 'portal', 'crystal']) TD.world.icon(g, id); // nenhum ícone quebra
});
