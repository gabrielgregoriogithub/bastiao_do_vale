const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame({ seed: 3 });
const THEMED = ['vale', 'rio', 'serpente', 'encruzilhada', 'pantano', 'costa', 'cemiterio', 'vulcao', 'ruinas', 'minas'];
const CLASSIC = TD.ROLE_ORDER;

test('dez campos oficiais, cada um com seu ambiente e seu capítulo', () => {
  const maps = TD.officialMaps();
  assert.deepEqual(maps.map(m => m.id), THEMED);
  assert.deepEqual(maps.map(m => m.biome), ['amazonia', 'rio', 'deserto', 'neve', 'floresta', 'costa', 'cripta', 'vulcao', 'templo', 'cristal']);
  for (const m of maps) assert.ok(TD.CHRONICLE[m.id], `capítulo de ${m.id}`);
});

test('o Vulcão é um campo jogável: estrada até a muralha e espaço para torres', () => {
  G.newGame('vulcao', 'normal');
  const md = G.md;
  assert.ok(md.pathLen > 800);
  const free = md.blocked.flat().filter(v => v === 0).length;
  assert.ok(free >= 80, `${free} casas livres`);
  assert.ok(md.map.water.length > 0 && md.map.lava, 'poças de lava');
  assert.equal(md.bridges.length, 0, 'a estrada não passa por cima da lava');
});

test('cada ambiente tem sua própria versão de cada inimigo, sem repetir os de outro', () => {
  const all = new Set();
  for (const id of THEMED) {
    const roster = TD.rosterOf(id);
    assert.equal(roster.length, CLASSIC.length, id);
    for (const [i, type] of roster.entries()) {
      const d = TD.ENEMIES[type], base = TD.ENEMIES[CLASSIC[i]];
      assert.ok(!CLASSIC.includes(type), `${id} usa um inimigo clássico (${type})`);
      assert.ok(!all.has(type), `${type} repetido em outro ambiente`);
      all.add(type);
      assert.equal(d.role, CLASSIC[i]);
      assert.ok(d.name && d.plural && Array.isArray(d.look), type);
      assert.ok(TD.ENEMY_INFO[type] && TD.ENEMY_INFO[type].length > 30, `descrição de ${type}`);
      for (const k of ['hp', 'speed', 'armor', 'gold', 'flying', 'boss', 'stealth', 'lives']) assert.equal(d[k], base[k], `${type}.${k}`);
    }
  }
  assert.deepEqual(TD.rosterOf('custom'), CLASSIC, 'os campos do editor usam os clássicos');
});

test('as ondas trazem os inimigos do ambiente, inclusive os que nascem de outros', () => {
  G.newGame('serpente', 'normal');
  G.S.waveActive = true;
  for (const role of ['soldier', 'scout', 'flyer', 'colossus', 'necro']) G.spawn(role, 300);
  const types = G.S.enemies.map(e => e.type);
  assert.deepEqual(types, ['nomad', 'jackal', 'vulture', 'sphinx', 'embalmer']);
  // a Esfinge se parte em Escaravelhos, não em Blindados
  G.hurt(G.S.enemies[3], 1e9, true, null);
  assert.equal(G.S.enemies.filter(e => e.type === 'scarab').length, 4);
  assert.ok(!G.S.enemies.some(e => e.type === 'brute'));
});

test('o Embalsamador ergue Múmias, não Esqueletos', () => {
  G.newGame('serpente', 'normal');
  G.S.waveActive = true;
  G.spawn('soldier', 300);
  G.spawn('necro', 320);
  const [victim, necro] = G.S.enemies;
  necro.frozenT = victim.frozenT = 99;
  G.hurt(victim, 1e9, true, null);
  runUntil(G, () => G.S.enemies.some(e => e.d.role === 'skeleton'), 5);
  assert.ok(G.S.enemies.some(e => e.type === 'mummy'));
});

test('o Vale Amazônico tem os bichos e lendas da mata; os campos do editor usam os clássicos', () => {
  G.newGame('vale', 'normal');
  G.spawn('soldier', 100);
  assert.equal(G.S.enemies[0].type, 'garimpeiro');
  assert.equal(TD.enemyFor('vale', 'boss'), 'curupira');
  assert.equal(TD.enemyFor('campo-do-jogador', 'brute'), 'brute');
});

test('nomes das ondas e dos chefes seguem o ambiente', () => {
  assert.equal(TD.enemyName('encruzilhada', 'boss'), 'Yeti Ancião');
  assert.equal(TD.enemyName('vale', 'boss'), 'Curupira');
  assert.equal(TD.enemyName('custom', 'boss'), 'Senhor da Guerra');
  assert.equal(TD.enemyName('vulcao', 'scout', 3), 'Diabretes de Fogo');
});

test('derrotar a versão temática do Dragão ou do Colosso também libera a conquista', () => {
  G.newGame('vulcao', 'normal');
  G.S.waveActive = true;
  G.spawn('dragon', 200);
  G.spawn('colossus', 200);
  for (const e of G.S.enemies.slice()) G.hurt(e, 1e9, true, null);
  assert.ok(TD.achievements.has('dragon'));
  assert.ok(TD.achievements.has('colossus'));
});

test('o glossário da fase lista os inimigos do campo', () => {
  G.newGame('pantano', 'normal');
  const list = TD.codex.glossary();
  assert.equal(list.length, TD.ROLE_ORDER.length);
  assert.equal(list[0].type, 'warant');
  assert.ok(list.every(r => r.name && r.desc));
});

test('cada ambiente desenha seu campo e seus inimigos sem erros', () => {
  const ctx = document.getElementById('game').getContext('2d');
  for (const m of TD.officialMaps()) {
    G.newGame(m.id, 'normal');
    TD.scene.setup(ctx, 1);
    G.S.waveActive = true;
    TD.ROLE_ORDER.forEach((role, i) => G.spawn(role, 40 + i * 30));
    for (let i = 0; i < 10; i++) { G.update(1 / 60); TD.scene.draw(1 / 60); }
    assert.doesNotThrow(() => { TD.codex.show(); TD.codex.hide(); }, m.id);
  }
});
