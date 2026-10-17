const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame({ seed: 5 });

// Inimigo parado na estrada, a d pixels do ponto onde o herói começa
function enemyNearHero(type, d = 0) {
  const p = G.md.paths[0], start = G.md.pathLen * (G.md.map.heroAt ?? 0.55);
  G.spawn(type, start + d, p);
  const e = G.S.enemies[G.S.enemies.length - 1];
  e.frozenT = 999;
  return e;
}

test('o Mago é o terceiro herói e começa a partida no lugar do Cavaleiro', () => {
  assert.deepEqual(TD.HERO_ORDER, ['knight', 'ranger', 'mage']);
  G.newGame('vale', 'normal', [], 'mage');
  assert.equal(G.S.hero.kind, 'mage');
  assert.equal(TD.hero.defOf(G.S.hero).name, 'Mago');
});

test('o orbe do Mago explode em área', () => {
  G.newGame('vale', 'normal', [], 'mage');
  G.S.waveActive = true;
  const a = enemyNearHero('soldier', 30);
  const b = enemyNearHero('soldier', 40);
  for (const e of [a, b]) { e.hp = e.maxHp = 5000; }
  runUntil(G, () => a.hp < 5000 && b.hp < 5000, 6);
  assert.ok(a.hp < 5000 && b.hp < 5000, 'a explosão pega os dois soldados');
  assert.ok(G.S.hero.dmgDone > 0);
});

test('o orbe do Mago acerta voadores', () => {
  G.newGame('vale', 'normal', [], 'mage');
  G.S.waveActive = true;
  // a gárgula voa em linha reta, fora da estrada: o Mago vai até perto da rota dela
  const p = G.md.paths[0];
  G.spawn('flyer', p.flyLen * 0.5, p);
  const f = G.S.enemies[0];
  f.frozenT = 999; f.hp = f.maxHp = 5000;
  const h = G.S.hero;
  h.x = f.x - 40; h.y = f.y; h.home = { x: h.x, y: h.y };
  runUntil(G, () => f.hp < 5000, 6);
  assert.ok(f.hp < 5000);
});

test('Meteoro cai depois de um instante, fere em área e deixa os atingidos queimando', () => {
  G.newGame('vale', 'normal', [], 'mage');
  G.S.waveActive = true;
  assert.equal(TD.hero.useAbility(), false, 'sem inimigo ao alcance, não gasta a habilidade');
  const a = enemyNearHero('brute', 50);
  const b = enemyNearHero('brute', 60);
  for (const e of [a, b]) { e.hp = e.maxHp = 9000; }
  G.S.hero.cd = 999; // só o meteoro causa dano neste teste
  assert.equal(TD.hero.useAbility(), true);
  assert.equal(a.hp, 9000, 'o meteoro ainda está caindo');
  runUntil(G, () => a.hp < 9000, 2);
  assert.ok(a.hp < 9000 && b.hp < 9000, 'os dois blindados são atingidos');
  assert.ok(a.dots.burn && b.dots.burn, 'e ficam queimando');
  assert.ok(G.S.hero.abilityCd > 0);
});

test('o Mago volta ao continuar uma partida salva', () => {
  G.newGame('rio', 'normal', [], 'mage');
  G.S.hero.level = 3;
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  G.newGame('vale', 'facil');
  assert.equal(G.restore(snap), true);
  assert.equal(G.S.hero.kind, 'mage');
  assert.equal(G.S.hero.level, 3);
});
