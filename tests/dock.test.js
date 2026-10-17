const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const { TD, G } = loadGame({ seed: 4 });

test('a barra do celular acompanha torre, herói e mira sem erros', () => {
  G.newGame('vale', 'normal');
  G.S.gold = 9999;
  G.build('archer', 3, 4);
  const t = G.S.towers[0];
  const states = [
    () => {},
    () => { G.S.sel = t; },
    () => { G.upgrade(t); G.upgrade(t); },
    () => { G.specialize(t, 'volley'); },
    () => { G.S.sel = null; G.S.heroSel = true; },
    () => { G.S.heroSel = false; G.startWave(); TD.ui.triggerPower('rain'); },
  ];
  for (const set of states) {
    set();
    assert.doesNotThrow(() => TD.dock.sync());
  }
});

test('ativar a Chuva de flechas desmarca a torre selecionada', () => {
  G.newGame('vale', 'normal');
  G.S.gold = 9999;
  G.build('archer', 3, 4);
  G.S.sel = G.S.towers[0];
  G.startWave();
  TD.ui.triggerPower('rain');
  assert.equal(G.S.aim, 'rain');
  assert.equal(G.S.sel, null);
});
