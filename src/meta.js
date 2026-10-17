// Forja do Bastião: estrelas ganhas nas vitórias compram melhorias permanentes.
// Tudo fica no navegador do jogador; sem armazenamento, a Forja simplesmente começa vazia.
(() => {
  const TD = window.TD;
  const KEY = 'bastiao-forja';

  function readPerks() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch { return {}; }
  }
  function writePerks(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* armazenamento indisponível */ } }
  function readNum(key) { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } }

  let perks = readPerks();

  const level = id => {
    const def = TD.PERKS.find(p => p.id === id);
    return def ? Math.min(Number(perks[id]) || 0, def.costs.length) : 0;
  };

  function totalStars() {
    let n = 0;
    // só campos oficiais: um campo desenhado fácil de propósito não pode render estrelas
    for (const m of TD.officialMaps()) for (const d of TD.DIFF_ORDER) n += readNum(`bastiao-estrelas-${m.id}-${d}`);
    return n;
  }

  function spent() {
    return TD.PERKS.reduce((sum, p) => sum + p.costs.slice(0, level(p.id)).reduce((a, b) => a + b, 0), 0);
  }

  const available = () => Math.max(0, totalStars() - spent());
  const nextCost = id => {
    const def = TD.PERKS.find(p => p.id === id);
    return def && level(id) < def.costs.length ? def.costs[level(id)] : null;
  };

  function buy(id) {
    const cost = nextCost(id);
    if (cost === null || available() < cost) return false;
    perks = { ...perks, [id]: level(id) + 1 };
    writePerks(perks);
    return true;
  }

  function reset() {
    perks = {};
    writePerks(perks);
  }

  // Cópia congelada no início de cada partida
  const current = () => Object.fromEntries(TD.PERKS.map(p => [p.id, level(p.id)]));

  TD.meta = { level, totalStars, spent, available, nextCost, buy, reset, current };
})();
