const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const { TD } = loadGame({ seed: 3 });
const cam = TD.camera;
const { W, H } = TD;
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('sem zoom, o ponto da tela é o próprio ponto do mundo', () => {
  cam.start(800, false);
  assert.equal(cam.z, 1);
  const p = cam.toWorld(120, 340);
  assert.ok(near(p.x, 120) && near(p.y, 340));
  assert.equal(cam.zoomed(), false);
});

test('no computador a partida começa com o mapa inteiro; no celular estreito, aproximada', () => {
  cam.start(390, false);
  assert.equal(cam.z, 1);
  cam.start(390, true);
  assert.ok(cam.z > 1.5 && cam.z <= 1.8, `zoom ${cam.z}`);
  // centrado no meio do mapa
  const c = cam.toWorld(W / 2, H / 2);
  assert.ok(near(c.x, W / 2) && near(c.y, H / 2));
  // tela larga o bastante: nada de zoom
  cam.start(800, true);
  assert.equal(cam.z, 1);
});

test('aproximar mantém parado o ponto embaixo do dedo', () => {
  cam.start(800, false);
  const before = cam.toScreen(300, 200);
  cam.zoomAt(2, 300, 200);
  const after = cam.toScreen(300, 200);
  assert.ok(near(before.x, after.x) && near(before.y, after.y));
  const back = cam.toWorld(after.x, after.y);
  assert.ok(near(back.x, 300) && near(back.y, 200));
});

test('a vista nunca sai do mapa e o zoom fica entre 1 e o máximo', () => {
  cam.start(800, false);
  cam.zoomAt(10, 0, 0);
  assert.equal(cam.z, cam.MAX_Z);
  cam.panBy(5000, 5000);
  assert.equal(cam.x, 0); assert.equal(cam.y, 0);
  cam.panBy(-5000, -5000);
  assert.ok(near(cam.x, W - W / cam.z) && near(cam.y, H - H / cam.z));
  cam.zoomAt(0.2, 400, 240);
  assert.equal(cam.z, 1);
  assert.equal(cam.x, 0); assert.equal(cam.y, 0);
});

test('os botões aproximam aos poucos e o fundo só fica mais nítido no fim', () => {
  cam.start(800, false);
  assert.equal(cam.detail(2), 2);
  cam.step(1.4);
  cam.tick(0.05);
  assert.ok(cam.z > 1 && cam.z < 1.4);
  assert.equal(cam.detail(2), 2, 'no meio da animação o fundo não é refeito');
  cam.tick(1);
  assert.ok(near(cam.z, 1.4));
  assert.equal(cam.detail(2), 3);
  assert.equal(cam.anim, null);
});

test('tocar no mapa pequeno leva a vista para aquele ponto', () => {
  cam.start(800, false);
  assert.equal(cam.inMini(W - 20, H - 20), false, 'sem zoom não há mapa pequeno');
  cam.zoomAt(2, 400, 240);
  const m = cam.miniRect();
  assert.ok(cam.inMini(m.x + m.w / 2, m.y + m.h / 2));
  cam.jumpFromMini(m.x + m.w * 0.9, m.y + m.h * 0.1);
  const c = cam.toWorld(W / 2, H / 2);
  assert.ok(c.x > 500 && c.y < 200, `centro ${c.x}, ${c.y}`);
});

test('um quadro aproximado, com o mapa pequeno, é desenhado sem erros', () => {
  const G = TD.game;
  G.newGame('vale', 'normal', [], 'knight');
  TD.scene.setup(document.getElementById('game').getContext('2d'), 2);
  cam.start(390, true);
  cam.settle();
  G.startWave();
  for (let i = 0; i < 90; i++) { G.update(1 / 60); TD.scene.draw(1 / 60); }
  assert.ok(cam.zoomed());
});
