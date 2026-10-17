const test = require('node:test');
const assert = require('node:assert/strict');

// celular com vibração: precisa existir antes de o jogo carregar
const buzzes = [];
Object.defineProperty(global, 'navigator', { value: { vibrate: p => { buzzes.push(p); return true; } }, configurable: true });
const { loadGame } = require('./harness');
const { TD } = loadGame({ seed: 9 });

test('perder vida vibra no celular; com o som desligado, não', () => {
  TD.audio.setMuted(false);
  TD.audio.play('leak');
  assert.equal(buzzes.length, 1);
  assert.ok(Array.isArray(buzzes[0]), 'perder vida vibra em dois pulsos');
  TD.audio.setMuted(true);
  TD.audio.play('build');
  assert.equal(buzzes.length, 1, 'Som desligado também desliga a vibração');
  TD.audio.setMuted(false);
  TD.audio.play('archer');
  assert.equal(buzzes.length, 1, 'tiros não vibram');
});
