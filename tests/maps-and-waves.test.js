const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const { TD } = loadGame();
const { T, COLS, ROWS } = TD;

for (const map of TD.MAPS) {
  test(`campo "${map.name}": estradas contínuas que terminam na muralha`, () => {
    const md = TD.buildMap(map);
    assert.ok(md.paths.length >= 1);
    for (const p of md.paths) {
      for (let i = 0; i < p.way.length - 1; i++) {
        const [c1, r1] = p.way[i], [c2, r2] = p.way[i + 1];
        assert.ok(c1 === c2 || r1 === r2, `trecho diagonal em ${map.id}: ${p.way[i]} -> ${p.way[i + 1]}`);
      }
      assert.ok(p.way[0][0] < 0, 'a estrada começa fora da tela, na caverna');
      assert.ok(p.way[p.way.length - 1][0] >= COLS, 'a estrada sai pela muralha');
      assert.equal(p.way[p.way.length - 1][1], md.exitRow, 'todas as estradas saem pelo mesmo portão');
    }
  });

  test(`campo "${map.name}": água, lama e espaço livre consistentes`, () => {
    const md = TD.buildMap(map);
    const free = md.blocked.flat().filter(v => v === 0).length;
    assert.ok(free >= 150, `pouco espaço para torres: ${free} casas`);
    for (const [c, r] of md.mudCells) assert.equal(md.blocked[r][c], 1, `lama fora da estrada em ${c},${r}`);
    for (const [c, r] of md.bridges) assert.equal(md.blocked[r][c], 1, 'ponte sobre a estrada');
    assert.ok(md.mudAt((md.mudCells[0]?.[0] ?? -5) * T + 1, (md.mudCells[0]?.[1] ?? -5) * T + 1) === md.mudCells.length > 0);
  });
}

test('chefes chegam em rodízio nas ondas 5, 10, 15 e 20', () => {
  const expected = { 5: 'boss', 10: 'witch', 15: 'colossus', 20: 'dragon' };
  for (const [n, boss] of Object.entries(expected)) {
    const wave = TD.makeWave(Number(n));
    assert.ok(wave.includes(boss), `onda ${n} deveria trazer ${boss}`);
  }
  assert.ok(!TD.makeWave(4).some(t => TD.ENEMIES[t].boss), 'onda sem chefe não traz chefe');
});

test('revoadas têm maioria de voadores e as ondas crescem', () => {
  const swarm = TD.makeWave(9);
  const flyers = swarm.filter(t => t === 'flyer').length;
  assert.ok(flyers / swarm.length >= 0.6, `revoada com só ${flyers} de ${swarm.length} voadores`);
  assert.ok(TD.makeWave(20).length > TD.makeWave(1).length);
});

test('toda especialização e todo inimigo têm textos para a interface', () => {
  for (const type of TD.ORDER) assert.equal(TD.SPECS[type].length, 2, `${type} precisa de 2 especializações`);
  for (const type of Object.keys(TD.ENEMIES)) assert.ok(TD.ENEMY_INFO[type], `falta descrição para ${type}`);
  assert.ok(ROWS > 0);
});
