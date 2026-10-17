const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame({ seed: 12 });
const { T } = TD;

// No Vale: (3,4) e (3,5) ficam lado a lado no gramado; (12,6) fica longe dos dois
function setup() {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.gold = 99999;
  G.build('archer', 3, 4);
  G.build('archer', 12, 6);
  return { near: G.towerAt(3, 4), far: G.towerAt(12, 6) };
}
const baseDmg = () => G.towerStats({ type: 'archer', level: 1, spec: null, c: 0, r: 0, x: -999, y: -999 }).dmg;

test('o Estandarte não ataca e dá +15% de dano só às torres vizinhas', () => {
  const { near, far } = setup();
  G.build('banner', 3, 5);
  const banner = G.towerAt(3, 5);
  assert.ok(Math.abs(near.s.dmg - baseDmg() * 1.15) < 1e-9, 'vizinha ganha 15%');
  assert.equal(far.s.dmg, baseDmg(), 'torre longe não muda');
  assert.equal(banner.s.buff, 0, 'o Estandarte não fortalece a si mesmo');

  G.S.waveActive = true;
  G.spawn('soldier', 60);
  runUntil(G, () => false, 2);
  assert.ok(!G.S.shots.some(s => s.src === banner), 'o Estandarte não atira');
  assert.equal(banner.dmgDone, 0);
});

test('vender o Estandarte tira o bônus', () => {
  const { near } = setup();
  G.build('banner', 3, 5);
  G.sell(G.towerAt(3, 5));
  assert.equal(near.s.dmg, baseDmg());
});

test('dois Estandartes não se somam: vale o mais forte', () => {
  const { near } = setup();
  G.build('banner', 3, 5);
  G.build('banner', 2, 4);
  assert.ok(Math.abs(near.s.dmg - baseDmg() * 1.15) < 1e-9, 'dois de nível 1 seguem em +15%');
  G.upgrade(G.towerAt(2, 4));
  assert.ok(near.s.dmg > baseDmg() * 1.15 + 1e-9, 'o melhorado passa a valer');
});

test('especializações: Trompa acelera as vizinhas; Oráculo dá alcance e revela camuflados', () => {
  let { near } = setup();
  G.build('banner', 3, 5);
  let banner = G.towerAt(3, 5);
  const rate = near.s.rate;
  G.upgrade(banner); G.upgrade(banner);
  G.specialize(banner, 'warhorn');
  assert.ok(near.s.rate < rate * 0.81, 'Trompa de Guerra: 20% mais rápido');

  ({ near } = setup());
  G.build('banner', 3, 5);
  banner = G.towerAt(3, 5);
  const range = near.s.range;
  G.upgrade(banner); G.upgrade(banner);
  G.specialize(banner, 'oracle');
  assert.ok(near.s.range > range * 1.14, 'Olho do Oráculo: mais alcance');
  G.S.waveActive = true;
  const p = G.md.paths[0];
  let best = 0, bestD = Infinity;
  for (let d = 0; d < p.len; d += 4) { const q = p.posAt(d), dd = Math.hypot(q.x - banner.x, q.y - banner.y); if (dd < bestD) { bestD = dd; best = d; } }
  G.spawn('stalker', best, p);
  const s = G.S.enemies[G.S.enemies.length - 1];
  s.frozenT = 99;
  G.update(1 / 60);
  assert.equal(s.revealed, true, 'o Oráculo revela o camuflado ao alcance');
});

test('o bônus volta ao continuar uma partida salva', () => {
  setup();
  G.build('banner', 3, 5);
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  G.newGame('rio', 'facil');
  assert.equal(G.restore(snap), true);
  assert.ok(Math.abs(G.towerAt(3, 4).s.dmg - baseDmg() * 1.15) < 1e-9);
});
