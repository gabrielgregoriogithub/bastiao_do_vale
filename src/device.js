// Recursos do aparelho para jogar no celular: jogo sem internet (sw.js), tela acesa enquanto a partida
// corre e botão de tela cheia. Cada um só age onde o navegador oferece o recurso; nos outros, nada muda.
(() => {
  const TD = window.TD;
  const G = TD.game;

  // ---------- Sem internet ----------
  // só em http(s): aberto direto do arquivo (file://) o navegador não aceita
  if (typeof location !== 'undefined' && location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('Modo sem internet indisponível:', err));
    });
  }

  // ---------- Tela acesa durante a partida ----------
  // O sistema solta o pedido quando a aba some; ao voltar, pede de novo se a partida seguir correndo.
  const canLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  let lock = null, asking = false, wanted = false;

  async function acquire() {
    if (!canLock || lock || asking || document.visibilityState !== 'visible') return;
    asking = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
      if (!wanted) release(); // a partida parou enquanto o pedido estava em andamento
    } catch (err) {
      // o navegador pode negar (economia de bateria, por exemplo): o jogo segue, só a tela pode apagar
      lock = null;
    } finally {
      asking = false;
    }
  }

  function release() {
    if (!lock) return;
    const l = lock;
    lock = null;
    l.release();
  }

  document.addEventListener('visibilitychange', () => { if (wanted) acquire(); });

  let lastWanted = null;
  function sync() {
    const S = G.S;
    wanted = S.inGame && !S.over && !S.halted && !S.paused && !S.menuOpen;
    if (wanted === lastWanted) return;
    lastWanted = wanted;
    if (wanted) acquire(); else release();
  }

  // ---------- Tela cheia ----------
  // No iPhone o Safari não oferece tela cheia para páginas: lá o botão some e vale abrir pela tela de início
  const btn = document.getElementById('btnFull');
  const root = document.documentElement;
  btn.hidden = !(document.fullscreenEnabled && root.requestFullscreen);
  btn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.requestFullscreen().catch(err => console.warn('Tela cheia recusada:', err));
  });
  document.addEventListener('fullscreenchange', () => btn.setAttribute('aria-pressed', String(!!document.fullscreenElement)));

  TD.device = { sync };
})();
