const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

const { TD, G } = loadGame({ seed: 31 });
const { T } = TD;

// Vence uma onda sem esperar os inimigos andarem: limpa a fila e deixa o fim da onda acontecer
function winWave() {
  G.startWave();
  G.S.queue = [];
  G.S.enemies = [];
  G.update(1 / 60);
}

function newRun(mods = ['nohero']) {
  G.newGame('vale', 'normal', mods);
  G.S.lives = G.S.maxLives = 50;
}

test('a cada 3 ondas vencidas aparecem 3 bênçãos diferentes para escolher', () => {
  newRun();
  winWave(); winWave();
  assert.equal(G.S.offer, null, 'antes da onda 3 não há oferta');
  winWave();
  const offer = G.S.offer;
  assert.equal(offer.length, 3);
  assert.equal(new Set(offer).size, 3);
  for (const id of offer) assert.ok(TD.BLESSINGS.some(b => b.id === id));
  assert.equal(TD.blessings.choose('inventada'), false, 'só vale escolher o que foi oferecido');
  assert.equal(TD.blessings.choose(offer[1]), true);
  assert.deepEqual(G.S.blessings, [offer[1]]);
  assert.equal(G.S.offer, null);
  winWave(); winWave(); winWave();
  assert.ok(!G.S.offer.includes(offer[1]), 'bênção já escolhida não volta');
});

test('chamar a onda antes da hora não faz perder a bênção', () => {
  newRun();
  winWave(); winWave();
  G.startWave(); // onda 3 começa
  G.S.queue = [];
  G.startWave(); // chamada antecipada: a onda 3 nunca termina sozinha
  assert.equal(G.S.wave, 4);
  G.S.queue = []; G.S.enemies = [];
  G.update(1 / 60);
  assert.equal(G.S.offer.length, 3, 'a oferta da onda 3 aparece no fim da onda 4');
});

// Força uma bênção, como se tivesse sido escolhida
function bless(id) {
  G.S.offer = [id];
  assert.equal(TD.blessings.choose(id), true);
}

test('bênçãos de torre mudam as torres já construídas', () => {
  newRun();
  G.S.gold = 9999;
  G.build('archer', 3, 4);
  G.build('barracks', 5, 5);
  const archer = G.S.towers[0], barracks = G.S.towers[1];
  const range = archer.s.range;
  bless('eagle');
  assert.ok(Math.abs(archer.s.range - range * 1.12) < 1e-9, 'Olhos de Águia: +12% de alcance');
  assert.equal(archer.s.dot, 0);
  bless('fireArrows');
  assert.equal(archer.s.dotKind, 'burn', 'Flechas Ígneas: o Arqueiro passa a queimar');
  const soldiers = barracks.units.length;
  bless('drill');
  assert.equal(barracks.units.length, soldiers + 1, 'Disciplina de Ferro: mais um soldado');
});

test('bênçãos de ouro e de defesa', () => {
  newRun();
  G.S.gold = 9999;
  G.build('archer', 3, 4);
  const t = G.S.towers[0];
  const up = G.upCost(t);
  bless('artisans');
  assert.equal(G.specCost(t), Math.round(TD.TOWERS.archer.cost * TD.SPEC_COST_MUL * 0.6), 'Mestres Artesãos: especializações 40% mais baratas');
  assert.equal(G.upCost(t), up, 'melhorias comuns não mudam');

  bless('livingWall');
  bless('interest');
  G.S.lives = 40; G.S.gold = 300;
  winWave();
  assert.equal(G.S.lives, 41, 'Muralha Viva: recupera 1 vida por onda');
  const bonus = G.waveBonus(G.S.wave);
  assert.equal(G.S.gold, 300 + bonus + 15, 'Juros do Tesouro: 5% do ouro guardado');
});

test('Cofre do Rei quadruplica o ouro dos chefes e Estrepes deixam a estrada mais lenta', () => {
  newRun();
  G.S.waveActive = true;
  G.spawn('boss', 400);
  let boss = G.S.enemies[0];
  let before = G.S.gold;
  G.hurt(boss, 1e9, true, null);
  const plain = G.S.gold - before;
  bless('kingsVault');
  G.spawn('boss', 400);
  boss = G.S.enemies[G.S.enemies.length - 1];
  before = G.S.gold;
  G.hurt(boss, 1e9, true, null);
  assert.equal(G.S.gold - before, plain * 4);

  G.S.enemies = [];
  G.spawn('soldier', 100);
  const e = G.S.enemies[0];
  G.update(1);
  const free = e.dist - 100;
  bless('caltrops');
  const d0 = e.dist;
  G.update(1);
  assert.ok(Math.abs((e.dist - d0) - free * 0.88) < 0.5, 'Estrepes: 12% mais devagar');
});

test('no desafio do dia as ofertas são iguais para todos', () => {
  const offers = [];
  for (let i = 0; i < 2; i++) {
    G.newDaily(new Date(2026, 9, 18, 12));
    G.S.lives = G.S.maxLives = 50;
    winWave(); winWave(); winWave();
    offers.push(G.S.offer);
  }
  assert.deepEqual(offers[0], offers[1]);
});

test('as bênçãos sobrevivem a salvar, e uma escolha pendente volta ao continuar', () => {
  newRun();
  G.S.gold = 9999;
  G.build('archer', 3, 4);
  for (let i = 0; i < 3; i++) winWave();
  const first = G.S.offer[0];
  TD.blessings.choose(first);
  for (let i = 0; i < 3; i++) winWave();
  assert.ok(G.S.offer, 'segunda oferta aberta');
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  snap.blessings = [...snap.blessings, 'inventada', first];
  G.newGame('rio', 'facil');
  assert.equal(G.restore(snap), true);
  assert.deepEqual(G.S.blessings, [first], 'só ids válidos, sem repetir');
  assert.equal(G.S.offer.length, 3, 'a escolha pendente reaparece');
  if (first === 'eagle') assert.ok(G.S.towers[0].s.range > TD.TOWERS.archer.range * T);
});

test('com todas as bênçãos já escolhidas não há mais oferta', () => {
  newRun();
  G.S.blessings = TD.BLESSINGS.map(b => b.id);
  G.S.wave = 98;
  winWave(); // onda 99
  assert.equal(G.S.offer, null);
});

test('Abençoado: conquista ao reunir 6 bênçãos', () => {
  newRun();
  G.S.blessings = TD.BLESSINGS.slice(0, 6).map(b => b.id);
  TD.achievements.sync(0);
  assert.ok(TD.achievements.has('blessed'));
});

test('a partida inteira continua rodando com ofertas abertas (a escolha pausa só a tela)', () => {
  newRun();
  for (let i = 0; i < 4; i++) winWave();
  assert.ok(G.S.offer);
  runUntil(G, () => false, 1);
  assert.equal(G.S.wave, 4);
});
