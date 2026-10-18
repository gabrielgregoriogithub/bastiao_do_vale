const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const { TD, G } = loadGame({ seed: 41 });

function fresh() {
  G.newGame('vale', 'normal', ['nohero']);
  G.S.gold = 99999;
  G.S.waveActive = true;
}

test('a torre ganha patente com os abates e passa a bater mais forte', () => {
  fresh();
  G.build('archer', 3, 4);
  const t = G.S.towers[0], base = t.s.dmg;
  assert.equal(G.rankOf(t), 0);
  assert.equal(G.nextRankAt(t), 30);
  for (let i = 0; i < 30; i++) {
    G.spawn('soldier', 100);
    G.hurt(G.S.enemies[G.S.enemies.length - 1], 1e9, true, t);
  }
  assert.equal(G.rankOf(t), 1);
  assert.ok(Math.abs(t.s.dmg - base * (1 + G.RANK_BONUS)) < 1e-9, 'Veterana: +8% de dano');
  assert.ok(G.S.fx.some(f => f.kind === 'text' && f.txt === 'Veterana'));
});

test('uma sequência de 5 ou mais abates rende ouro extra; abates espaçados não', () => {
  fresh();
  for (let i = 0; i < 6; i++) { G.spawn('soldier', 100 + i); G.hurt(G.S.enemies[G.S.enemies.length - 1], 1e9, true, null); }
  G.S.enemies = [];
  G.S.waveActive = false; // sem isso a onda vazia termina e soma o bônus dela
  const gold = G.S.gold;
  G.update(1);
  assert.equal(G.S.gold - gold, 12, '6 abates x 2 de ouro');
  assert.equal(G.S.bestCombo, 6);

  fresh();
  for (let i = 0; i < 6; i++) {
    G.spawn('soldier', 100);
    G.hurt(G.S.enemies[G.S.enemies.length - 1], 1e9, true, null);
    G.S.enemies = [];
    G.update(1);
  }
  assert.equal(G.S.bestCombo, 0);
});

test('a festa da vitória solta fogos e termina sozinha', () => {
  fresh();
  G.S.celebrateT = 1.5;
  let frames = 0;
  while (G.celebrate(1 / 30)) frames++;
  assert.ok(frames > 30 && frames < 60);
  assert.equal(G.S.celebrateT <= 0, true);
});

test('a música troca de modo e ritmo conforme o ambiente, sem erro em ambiente desconhecido', () => {
  for (const m of TD.officialMaps()) assert.doesNotThrow(() => TD.audio.setTheme(m.biome));
  assert.doesNotThrow(() => TD.audio.setTheme('inexistente'));
});

test('torres de precisão às vezes acertam um crítico de dano dobrado, com número dourado', () => {
  fresh();
  G.build('ballista', 3, 4);
  const t = G.S.towers[0];
  t.s.crit = 1; // força o crítico
  G.spawn('soldier', 100);
  const e = G.S.enemies[0];
  e.hp = e.maxHp = 1000;
  G.hurt(e, 50, true, t);
  assert.equal(1000 - e.hp, 100);
  assert.ok(G.S.fx.some(f => f.kind === 'dmg' && f.crit && f.txt === '100!'));
});

test('os golpes comuns viram um número só a cada instante; a cura aparece em verde', () => {
  fresh();
  G.spawn('soldier', 100);
  const e = G.S.enemies[0];
  e.hp = e.maxHp = 1000; e.frozenT = 99;
  for (let i = 0; i < 4; i++) G.hurt(e, 10, true, null);
  G.S.fx = [];
  G.update(0.5);
  const nums = G.S.fx.filter(f => f.kind === 'dmg');
  assert.equal(nums.length, 1);
  assert.equal(nums[0].txt, '40');
});

test('quem cai deixa o corpo animado conforme a forma', () => {
  fresh();
  G.spawn('colossus', 100);
  const e = G.S.enemies[0];
  G.hurt(e, 1e9, true, null);
  const death = G.S.fx.find(f => f.kind === 'death');
  assert.ok(death && death.type === e.type);
  assert.equal(TD.enemyForm(death.type, death.d), 'golem');
});

test('na tempestade os relâmpagos atingem inimigos; deserto e vulcão nunca têm chuva', () => {
  G.newGame('rio', 'normal', ['nohero']);
  G.S.waveActive = true; G.S.storm = true; G.S.boltT = 0;
  G.spawn('brute', 200);
  const e = G.S.enemies[0];
  e.frozenT = 99;
  const hp = e.hp;
  G.update(1 / 60);
  assert.ok(e.hp < hp, 'o raio feriu');
  assert.ok(G.S.fx.some(f => f.kind === 'lightning'));
  for (const map of ['serpente', 'vulcao']) {
    G.newGame(map, 'normal', ['nohero']);
    for (let w = 0; w < 30; w++) { G.startWave(); assert.equal(G.S.storm, false, `${map} sem chuva`); G.S.waveActive = false; G.S.queue = []; }
  }
});
