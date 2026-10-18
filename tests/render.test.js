const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

// O contexto 2D é um objeto falso que aceita qualquer chamada: estes testes pegam erros de
// execução no código de desenho (nomes errados, campos ausentes), não a aparência.
const { TD, G } = loadGame({ seed: 5 });
const ctx = document.getElementById('game').getContext('2d');

test('o fundo de todos os campos é montado sem erros', () => {
  for (const m of TD.MAPS) assert.ok(TD.buildBg(TD.buildMap(m), 1), m.id);
});

test('um quadro cheio de inimigos, torres, heróis e efeitos é desenhado sem erros', () => {
  for (const [mapId, hero] of [['encruzilhada', 'knight'], ['pantano', 'ranger']]) {
    G.newGame(mapId, 'normal', [], hero);
    TD.scene.setup(ctx, 1);
    G.S.gold = 99999;
    // duas casas por tipo de torre, na ordem de TD.ORDER
    const spots = [[2, 3], [4, 4], [6, 4], [8, 3], [10, 4], [12, 7], [14, 2], [5, 8], [3, 7], [13, 8], [16, 9], [1, 6], [5, 0], [9, 0], [17, 1], [11, 0], [2, 10], [6, 11]];
    assert.equal(spots.length, TD.ORDER.length * 2);
    TD.ORDER.forEach((type, i) => {
      for (const k of [0, 1]) {
        const [c, r] = spots[i * 2 + k];
        G.build(type, c, r);
        const t = G.S.towers[G.S.towers.length - 1];
        if (!t) continue;
        G.upgrade(t); G.upgrade(t);
        G.specialize(t, TD.SPECS[type][k].id);
      }
    });
    G.S.wave = 9;
    G.S.next = Object.keys(TD.ENEMIES);
    G.startWave();
    for (const id of ['rain', 'freeze', 'rally']) {
      runUntil(G, () => G.S.enemies.length > 2, 30);
      const e = G.S.enemies[0];
      G.usePower(id, e.x, e.y);
    }
    TD.hero.useAbility();
    G.S.heroSel = true;
    G.S.build = 'arcane';
    G.S.hover = { c: 5, r: 5 };
    G.S.paused = true;
    const kinds = new Set();
    for (let i = 0; i < 120; i++) {
      G.update(1 / 60);
      for (const f of G.S.fx) kinds.add(f.kind);
      TD.scene.draw(1 / 60);
    }
    assert.ok(kinds.size >= 5, `tipos de efeito desenhados: ${[...kinds].join(', ')}`);
  }
});

test('ícones do Compêndio e da descoberta desenham todos os inimigos', () => {
  G.newGame('vale', 'normal');
  assert.doesNotThrow(() => TD.codex.show());
  TD.codex.hide();
});

test('a janela de fim de partida (relatório e gráfico) abre sem erros', () => {
  G.newGame('vale', 'facil');
  G.S.gold = 600;
  G.build('archer', 5, 5);
  for (let i = 0; i < 3; i++) { G.startWave(); runUntil(G, () => !G.S.waveActive, 300); }
  // o G.onEnd original, instalado por ui.js: relatório, gráfico, melhores partidas
  assert.doesNotThrow(() => G.onEnd({ title: 'O bastião caiu', text: 'teste', stars: 0, canContinue: false }));
  assert.equal(TD.achievements.runs().length, 1);
});

test('no campo, a base de cada torre é desenhada uma vez e depois reaproveitada', () => {
  const create = document.createElement;
  let canvases = 0;
  document.createElement = tag => { if (tag === 'canvas') canvases += 1; return create(tag); };
  try {
    for (let i = 0; i < 5; i++) TD.drawTowerCached(ctx, 2, 'cannon', 100 + i * 40, 100, 2, i, null, 0);
    assert.equal(canvases, 2, 'uma imagem para a base e outra para as marcas');
    TD.drawTowerCached(ctx, 2, 'cannon', 100, 100, 3, 0, '#f07a3a', 0);
    assert.equal(canvases, 4, 'outro nível ou especialização ganha imagens próprias');
    TD.drawTowerCached(ctx, 1, 'cannon', 100, 100, 2, 0, null, 0);
    assert.equal(canvases, 6, 'outra densidade de tela também');
  } finally {
    document.createElement = create;
  }
});
