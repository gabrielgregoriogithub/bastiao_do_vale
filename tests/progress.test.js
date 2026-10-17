const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G, store } = loadGame({ seed: 7 });

test('salvar e restaurar preserva torres, herói, ouro e desafios', () => {
  G.newGame('rio', 'normal', ['swift']);
  G.S.gold = 900;
  G.build('archer', 5, 5);
  G.upgrade(G.S.towers[0]);
  G.S.hero.level = 4; G.S.hero.xp = 300;
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  G.newGame('vale', 'facil');
  assert.equal(G.restore(snap), true);
  assert.equal(G.S.mapId, 'rio');
  assert.equal(G.S.gold, snap.gold);
  assert.equal(G.S.towers[0].level, 2);
  assert.equal(G.S.hero.level, 4);
  assert.equal(G.S.mods.swift, true);
  assert.equal(G.restore({}), false, 'dados inválidos são recusados');
});

test('uma gravação corrompida é limpa ao restaurar', () => {
  const ok = G.restore({
    mapId: 'vale', diffId: 'normal', gold: -500, lives: 9999, wave: 'abc', kills: null,
    hero: { kind: 'dragao', level: 99, xp: -4 },
    towers: [
      { type: 'archer', c: 0, r: 2, level: 3 }, // em cima da estrada
      { type: 'archer', c: 0, r: 0, level: 7, spec: 'inventada', target: 'lua' },
      { type: 'archer', c: 0, r: 0, level: 1 }, // casa repetida
      { type: 'catapulta', c: 5, r: 5 },
      null,
    ],
  });
  assert.equal(ok, true);
  const S = G.S;
  assert.equal(S.gold, 0);
  assert.equal(S.lives, S.maxLives);
  assert.equal(S.wave, 0);
  assert.equal(S.towers.length, 1, 'só a torre válida entra');
  assert.deepEqual([S.towers[0].level, S.towers[0].spec, S.towers[0].target], [3, null, 'first']);
  assert.equal(S.hero.kind, 'knight');
  assert.equal(S.hero.level, TD.HERO.maxLevel);
  assert.equal(S.hero.xp, 0);
  assert.equal(G.restore({ mapId: 'atlantida', diffId: 'normal', towers: [] }), false, 'campo inexistente');
});

test('desafios: sem herói, sem poderes e cofres vazios', () => {
  G.newGame('vale', 'normal', ['nohero', 'nopower', 'poor']);
  assert.equal(G.S.hero, null);
  G.startWave();
  runUntil(G, () => G.S.enemies.length > 0, 10);
  assert.equal(G.usePower('freeze'), false);
  const e = G.S.enemies[0], gold = G.S.gold;
  G.hurt(e, 1e6, true, null);
  assert.equal(G.S.gold - gold, Math.floor(TD.ENEMIES[e.type].gold * 0.7));
});

test('Forja: estrelas compram melhorias que valem na próxima partida', () => {
  store.clear();
  store.set('bastiao-estrelas-vale-facil', '3');
  assert.equal(TD.meta.available(), 3);
  assert.equal(TD.meta.buy('gold'), true);
  assert.equal(TD.meta.buy('gold'), true);
  assert.equal(TD.meta.buy('veteran'), false, 'faltam estrelas');
  assert.equal(TD.meta.available(), 0);
  G.newGame('vale', 'normal');
  assert.equal(G.S.gold, TD.DIFFICULTIES.normal.gold + 50);
  TD.meta.reset();
  assert.equal(TD.meta.available(), 3);
});

test('uma partida completa no Fácil termina em vitória com estrelas', () => {
  store.clear();
  let ended = null;
  G.onEnd = info => { ended = info; };
  G.newGame('vale', 'facil');
  const S = G.S;
  const spots = [[3, 4], [5, 5], [8, 6], [10, 4], [6, 3], [13, 5], [12, 7], [15, 7], [3, 7], [11, 2], [16, 3], [7, 9]];
  const plan = ['archer', 'archer', 'frost', 'cannon', 'arcane', 'ballista', 'archer', 'cannon', 'ballista', 'arcane', 'archer', 'cannon'];
  for (let w = 0; w < 20 && !S.over && !ended; w++) {
    for (;;) {
      const i = S.towers.length;
      if (i < spots.length && S.gold >= G.costOf(plan[i])) { G.build(plan[i], ...spots[i]); continue; }
      const up = S.towers.filter(t => t.level < 3).sort((a, b) => a.level - b.level)[0];
      if (up && S.gold >= G.upCost(up)) { G.upgrade(up); continue; }
      break;
    }
    G.startWave();
    runUntil(G, () => !S.waveActive || S.over, 600);
  }
  assert.ok(ended, 'a partida deveria terminar');
  assert.equal(ended.title, 'O vale está a salvo');
  assert.ok(ended.stars >= 1);
  assert.equal(G.readStars('vale', 'facil'), ended.stars);
});

test('o histórico guarda vidas e ouro ao fim de cada onda e sobrevive a salvar', () => {
  G.newGame('vale', 'facil');
  G.S.gold = 500;
  G.build('archer', 5, 5);
  for (let i = 0; i < 3; i++) { G.startWave(); runUntil(G, () => !G.S.waveActive, 300); }
  const h = G.S.history;
  assert.deepEqual(h.map(p => p.wave), [0, 1, 2, 3]);
  assert.equal(h[3].gold, G.S.gold);
  assert.equal(h[3].lives, G.S.lives);
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  snap.history.push({ wave: 99, gold: -5, lives: 'x' }); // ponto inválido vindo de uma gravação estragada
  G.restore(snap);
  assert.deepEqual(G.S.history.map(p => p.wave), [0, 1, 2, 3], 'pontos depois da onda atual são descartados');
  assert.equal(TD.chart.niceMax(730), 1000);
  assert.equal(TD.chart.niceMax(18), 20);
});

test('salvar no meio de uma onda guarda o começo dela: o ouro dos abates não se repete', () => {
  G.newGame('vale', 'normal');
  const S = G.S;
  S.gold = 500;
  G.build('archer', 5, 5);
  G.build('archer', 3, 3);
  const atStart = { gold: S.gold, towers: S.towers.length };
  G.startWave();
  runUntil(G, () => S.kills >= 3, 120);
  G.build('archer', 8, 6); // construída no meio da onda
  assert.ok(S.gold !== atStart.gold, 'a onda já rendeu ou custou ouro');
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  assert.equal(G.restore(snap), true);
  assert.equal(G.S.wave, 0, 'a onda interrompida volta a ser jogada');
  assert.equal(G.S.gold, atStart.gold, 'o ouro volta ao do começo da onda');
  assert.equal(G.S.kills, 0, 'os abates também');
  assert.equal(G.S.towers.length, atStart.towers, 'a torre feita no meio da onda não fica de graça');
});

test('na chamada antecipada o salvamento volta ao começo da onda que ainda tinha inimigos', () => {
  G.newGame('vale', 'normal');
  const S = G.S;
  S.gold = 300;
  G.build('archer', 5, 5);
  const goldBefore = S.gold;
  G.startWave();
  runUntil(G, () => !S.queue.length, 120); // todos já saíram da caverna, alguns ainda vivos
  assert.ok(S.enemies.length > 0 && G.canCallEarly());
  G.startWave(); // chama a onda 2 antes da hora
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  assert.equal(snap.wave, 0, 'a onda 1 ainda não tinha terminado');
  assert.equal(snap.gold, goldBefore);
});
