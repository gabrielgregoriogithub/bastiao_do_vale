// Carrega o jogo no Node com um DOM falso, armazenamento em memória e sorteio com semente fixa.
// Cada arquivo de teste roda em seu próprio processo (node --test), então o estado global não vaza entre arquivos.
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const MODULES = ['data', 'bestiary', 'audio', 'render', 'creatures', 'towers-art', 'meta', 'sim', 'foes', 'hero', 'units', 'tutorial', 'codex', 'editor', 'achievements', 'blessings', 'dock', 'device', 'ambience', 'lighting', 'scene', 'chart', 'menu', 'ui'];

// Objeto que aceita qualquer acesso ou chamada: substitui elementos do DOM e o contexto 2D do canvas
function stub() {
  return new Proxy(function noop() {}, {
    get: (_t, key) => {
      if (key === 'children') return [];
      if (key === 'dataset') return {};
      if (key === 'classList') return { toggle() {}, add() {}, remove() {} };
      if (key === 'style') return { setProperty() {} };
      if (key === Symbol.toPrimitive) return () => 0;
      if (key === 'width' || key === 'height') return 800;
      return stub();
    },
    apply: () => stub(),
    set: () => true,
  });
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// storage: dados que já estão no navegador antes de o jogo carregar
function loadGame({ seed = 1, storage = {} } = {}) {
  const store = new Map(Object.entries(storage));
  const elements = {};
  global.window = { matchMedia: () => ({ matches: false }), addEventListener() {}, devicePixelRatio: 1 };
  global.document = {
    getElementById: id => elements[id] || (elements[id] = stub()),
    createElement: () => stub(),
    createElementNS: () => stub(),
    createTextNode: () => stub(),
    addEventListener() {},
    hidden: false,
  };
  global.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };
  global.performance = { now: () => 0 };
  global.requestAnimationFrame = () => {};
  Math.random = seededRandom(seed);
  for (const m of MODULES) require(path.join(SRC, `${m}.js`));
  return { TD: global.window.TD, G: global.window.TD.game, store };
}

// Avança a simulação em passos de 1/60 s até a condição ser verdadeira ou o limite acabar
function runUntil(G, done, maxSeconds = 600) {
  for (let i = 0; i < maxSeconds * 60 && !done(); i++) G.update(1 / 60);
}

module.exports = { loadGame, runUntil };
