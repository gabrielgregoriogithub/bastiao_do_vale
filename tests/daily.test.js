const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G, store } = loadGame({ seed: 21 });

test('o desafio do dia depende só da data local', () => {
  const a = TD.dailyFor(new Date(2026, 9, 18, 0, 5));
  const b = TD.dailyFor(new Date(2026, 9, 18, 23, 55));
  const c = TD.dailyFor(new Date(2026, 9, 19, 0, 5));
  assert.equal(a.key, '2026-10-18');
  assert.deepEqual(a, b, 'o mesmo dia gera o mesmo desafio');
  assert.notEqual(a.key, c.key);
  assert.ok(TD.MAPS.some(m => m.id === a.map));
  assert.ok(a.mods.length >= 1 && a.mods.length <= 2);
  assert.ok(!a.mods.includes('nohero'), 'o herói escolhido sempre joga');
});

test('com semente, cada onda sai igual; sem semente, varia', () => {
  for (const n of [1, 7, 15, 20]) assert.deepEqual(TD.makeWave(n, 99), TD.makeWave(n, 99));
  assert.notDeepEqual(TD.makeWave(12, 1), TD.makeWave(12, 2));
});

test('desafio do dia: começa com os dados do dia, registra o melhor e sobrevive a salvar', () => {
  const date = new Date(2026, 9, 18, 12);
  const d = G.newDaily(date, 'ranger');
  const S = G.S;
  assert.equal(S.mapId, d.map);
  assert.deepEqual(Object.keys(S.mods).sort(), [...d.mods].sort());
  assert.equal(S.hero.kind, 'ranger');
  assert.deepEqual(S.next, TD.makeWave(1, d.seed));

  S.lives = 1e6;
  G.startWave();
  runUntil(G, () => !S.waveActive, 300);
  assert.equal(G.readDaily(d.key), 1, 'a onda vencida conta para o melhor do dia');
  assert.equal(Number(store.get(`bastiao-diario-${d.key}`)), 1);

  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  const expectedNext = TD.makeWave(2, d.seed);
  G.newGame('vale', 'facil');
  assert.equal(G.restore(snap), true);
  assert.equal(G.S.daily, d.key);
  assert.deepEqual(G.S.next, expectedNext, 'a próxima onda continua a mesma depois de restaurar');
});

test('a prévia mostra valores maiores no próximo nível', () => {
  G.newGame('vale', 'normal');
  G.S.gold = 999;
  G.build('archer', 0, 0);
  const t = G.S.towers[0];
  const next = G.towerStats({ ...t, level: t.level + 1 });
  assert.ok(next.dmg > t.s.dmg && next.range > t.s.range && next.rate < t.s.rate);
});

test('a prévia do caminho é desenhada entre as ondas, com a rota dos voadores', () => {
  G.newGame('encruzilhada', 'normal');
  G.S.next = ['flyer', 'soldier'];
  TD.scene.setup(document.getElementById('game').getContext('2d'), 1);
  assert.doesNotThrow(() => { for (let i = 0; i < 5; i++) TD.scene.draw(1 / 60); });
});

test('jogar de novo depois do desafio do dia começa o desafio do dia outra vez', () => {
  G.newDaily(new Date());
  const key = G.S.daily;
  TD.menu.restart();
  assert.equal(G.S.daily, key);
  assert.equal(G.S.seed, TD.dailyFor(new Date()).seed);
  G.newGame('rio', 'dificil', ['swift'], 'ranger');
  TD.menu.restart();
  assert.equal(G.S.daily, null, 'partida comum continua comum');
  assert.deepEqual([G.S.mapId, G.S.diffId, Object.keys(G.S.mods), G.S.hero.kind], ['rio', 'dificil', ['swift'], 'ranger']);
});
