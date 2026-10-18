const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runUntil } = require('./harness');

// Estrada em S que atravessa o mapa: 34 casas, sobra bastante espaço para torres
const ROUTE = [[0, 2], [6, 2], [6, 8], [12, 8], [12, 3], [16, 3], [16, 6], [19, 6]];

const { TD, G } = loadGame({
  seed: 8,
  storage: { 'bastiao-campo': JSON.stringify({ name: 'Trilha do Lobo', points: ROUTE }) },
});

test('regras do editor: início, trechos retos, sem cruzamentos e saída na muralha', () => {
  assert.equal(TD.validateRoute([]).ok, true);
  assert.match(TD.validateRoute([[3, 2]]).error, /coluna da esquerda/);
  assert.match(TD.validateRoute([[0, 0]]).error, /longe dos cantos/);
  assert.match(TD.validateRoute([[0, 2], [5, 6]]).error, /reto/);
  assert.match(TD.validateRoute([[0, 2], [5, 2], [5, 4], [2, 4], [2, 1]]).error, /cima de si mesma/);
  assert.match(TD.validateRoute([[0, 2], [19, 2], [19, 5]]).error, /termina/);
  assert.match(TD.validateRoute([[0, 5], [10, 5], [10, 0], [19, 0]]).error, /muralha/);
  const ok = TD.validateRoute(ROUTE);
  assert.equal(ok.ok, true);
  assert.equal(ok.complete, true);
  assert.equal(ok.len, 34);
});

test('só salva estradas completas, longas o bastante e com espaço para torres', () => {
  assert.match(TD.editor.saveProblem([[0, 5], [19, 5]]), /curta demais/);
  assert.match(TD.editor.saveProblem([[0, 5], [10, 5]]), /coluna da direita/);
  assert.equal(TD.editor.saveProblem(ROUTE), null);
  // serpentina que desce e sobe em todas as colunas: quase não sobra gramado
  const tight = [[0, 1]];
  for (let c = 1; c < 19; c++) tight.push([c, c % 2 ? 1 : 10], [c, c % 2 ? 10 : 1]);
  tight.push([19, 1]);
  assert.equal(TD.validateRoute(tight).ok, true, 'a serpentina é uma estrada válida');
  assert.match(TD.editor.saveProblem(tight), /pouco espaço/);
});

test('o campo salvo aparece entre os campos e dá para jogar nele', () => {
  const custom = TD.MAPS.find(m => m.custom);
  assert.ok(custom, 'o campo salvo foi carregado');
  assert.equal(custom.name, 'Trilha do Lobo');
  assert.deepEqual(custom.way[0], [-1, 2]);
  assert.deepEqual(custom.way[custom.way.length - 1], [TD.COLS, 6]);
  G.newGame('custom', 'facil');
  assert.equal(G.md.map.name, 'Trilha do Lobo');
  G.S.gold = 500;
  G.build('archer', 5, 4);
  G.startWave();
  runUntil(G, () => !G.S.waveActive, 300);
  assert.equal(G.S.waveActive, false);
  assert.equal(G.S.lives > 0, true);
});

test('o campo do jogador fica fora do desafio do dia e da conquista dos 6 campos', () => {
  assert.equal(TD.officialMaps().length, 6);
  for (let d = 1; d <= 60; d++) assert.notEqual(TD.dailyFor(new Date(2026, 0, d)).map, 'custom');
});

test('uma gravação de campo corrompida é ignorada', () => {
  const bad = loadGameIsolated({ 'bastiao-campo': JSON.stringify({ name: 'x', points: [[3, 3], [9, 9]] }) });
  assert.equal(bad, false);
});

// Carrega o jogo em um processo filho para não misturar com o estado deste arquivo
function loadGameIsolated(storage) {
  const { execFileSync } = require('child_process');
  const code = `const { loadGame } = require(${JSON.stringify(require.resolve('./harness'))});
    const { TD } = loadGame({ storage: ${JSON.stringify(storage)} });
    process.stdout.write(String(TD.MAPS.some(m => m.custom)));`;
  return execFileSync(process.execPath, ['-e', code]).toString() === 'true';
}

test('código de compartilhamento: ida e volta, e códigos inválidos recusados', () => {
  const code = TD.encodeRoute('Trilha do Lobo', ROUTE);
  assert.match(code, /^BV1:/);
  assert.deepEqual(TD.decodeRoute(code), { name: 'Trilha do Lobo', points: ROUTE });
  assert.deepEqual(TD.decodeRoute(`  ${code}  `).points, ROUTE, 'espaços em volta não atrapalham');
  for (const bad of ['', 'oi', 'BV2:x:0202', 'BV1:x:02a', 'BV1:x:0Z', 'BV1:%E0%A4%A:0202', null]) {
    assert.equal(TD.decodeRoute(bad), null, String(bad));
  }
});
