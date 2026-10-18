// Relíquias: itens achados nos baús de tesouro (world.js) e guardados entre partidas.
// O jogador equipa até TD.RELIC_SLOTS no menu; a partida congela as equipadas ao começar (sim.js, S.relics).
// Cada relíquia tem multiplicadores (hp, dmg, regen, respawn, cd, xp, towerDmg, sealCost, sealDur)
// ou somas (gold, startGold), lidos por mul() e add().
(() => {
  const TD = window.TD;
  const KEY = 'bastiao-reliquias';
  const ADDITIVE = new Set(['gold', 'startGold']);

  const valid = id => TD.RELICS.some(r => r.id === id);

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '{}');
      const owned = Array.isArray(v?.owned) ? [...new Set(v.owned.filter(valid))] : [];
      const equipped = Array.isArray(v?.equipped) ? [...new Set(v.equipped.filter(id => owned.includes(id)))].slice(0, TD.RELIC_SLOTS) : [];
      return { owned, equipped };
    } catch { return { owned: [], equipped: [] }; }
  }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* armazenamento indisponível */ } }

  let state = read();

  const owned = () => state.owned.slice();
  const equipped = () => state.equipped.slice();
  const isOwned = id => state.owned.includes(id);
  const isEquipped = id => state.equipped.includes(id);
  const missing = () => TD.RELICS.filter(r => !isOwned(r.id)).map(r => r.id);

  // Ganha a relíquia (e já equipa, se houver espaço); devolve false se ela já era do jogador
  function grant(id) {
    if (!valid(id) || isOwned(id)) return false;
    const equip = state.equipped.length < TD.RELIC_SLOTS ? [...state.equipped, id] : state.equipped;
    state = { owned: [...state.owned, id], equipped: equip };
    write(state);
    return true;
  }

  // Sorteia uma relíquia que o jogador ainda não tem; null quando já tem todas
  function grantRandom(rnd = Math.random) {
    const left = missing();
    if (!left.length) return null;
    const id = left[Math.floor(rnd() * left.length)];
    grant(id);
    return id;
  }

  // Equipa ou tira; com os espaços cheios, não equipa mais uma
  function toggle(id) {
    if (!isOwned(id)) return false;
    if (isEquipped(id)) state = { ...state, equipped: state.equipped.filter(x => x !== id) };
    else if (state.equipped.length < TD.RELIC_SLOTS) state = { ...state, equipped: [...state.equipped, id] };
    else return false;
    write(state);
    return true;
  }

  function reset() {
    state = { owned: [], equipped: [] };
    write(state);
  }

  // list: ids das relíquias da partida (S.relics); sem lista, as equipadas agora
  const defsOf = list => (list || state.equipped).map(id => TD.RELICS.find(r => r.id === id)).filter(Boolean);
  const mul = (key, list) => defsOf(list).reduce((k, r) => k * (ADDITIVE.has(key) ? 1 : r[key] || 1), 1);
  const add = (key, list) => defsOf(list).reduce((n, r) => n + (r[key] || 0), 0);

  TD.relics = { owned, equipped, isOwned, isEquipped, missing, grant, grantRandom, toggle, reset, mul, add, defsOf };
})();
