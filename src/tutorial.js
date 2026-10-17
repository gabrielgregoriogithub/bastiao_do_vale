// Dicas da primeira partida: cada uma some sozinha quando o jogador faz o que ela pede.
(() => {
  const TD = window.TD;
  const G = TD.game;
  const KEY = 'bastiao-tutorial-ok';

  const STEPS = [
    { text: 'Escolha o Arqueiro (tecla 1) e toque no gramado perto da estrada para construir.', done: S => S.towers.length > 0 },
    { text: 'Quando estiver pronto, toque em Iniciar onda (ou aperte Espaço).', done: S => S.wave >= 1 },
    { text: 'Seu herói luta ao seu lado. Toque nele e depois no mapa para movê-lo. A tecla R usa a habilidade dele.', done: S => !S.hero || S.heroMoved || S.wave >= 3 },
    { text: 'Toque numa torre para melhorá-la. No nível 3 ela escolhe uma especialização.', done: S => S.towers.some(t => t.level > 1) || S.wave >= 4 },
    { text: 'Durante as ondas, use os poderes: Chuva de flechas (Q), Congelar (W) e Chamado às armas (E).', done: S => Object.values(S.cooldowns).some(c => c > 0) || S.wave >= 5 },
  ];

  const el = document.getElementById('tip');
  const txt = document.getElementById('tipText');
  const stepEl = document.getElementById('tipStep');
  let idx = 0, active = false;

  function finish() {
    active = false;
    el.hidden = true;
    G.store.save(KEY, 1);
  }
  document.getElementById('tipSkip').addEventListener('click', finish);

  function start() {
    active = G.store.load(KEY, '0') !== '1';
    idx = 0;
  }

  function sync() {
    const S = G.S;
    if (!active || !S.inGame || S.over || S.halted || S.menuOpen) { el.hidden = true; return; }
    while (idx < STEPS.length && STEPS[idx].done(S)) idx += 1;
    if (idx >= STEPS.length) { finish(); return; }
    const text = STEPS[idx].text;
    if (txt.textContent !== text) {
      txt.textContent = text;
      stepEl.textContent = `Dica ${idx + 1} de ${STEPS.length}`;
    }
    el.hidden = false;
  }

  TD.tutorial = { start, sync };
})();
