// Recursos do aparelho para jogar no celular: jogo sem internet (sw.js), tela acesa enquanto a partida
// corre, botão de tela cheia e a dica de virar o celular. Cada um só age onde o navegador oferece
// o recurso; nos outros, nada muda. (A vibração fica junto dos sons, em audio.js.)
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

  // ---------- Dica para virar o celular ----------
  // Em pé o mapa fica estreito; deitado as casas ficam maiores. Aparece uma vez por aparelho:
  // some com o Ok ou quando o jogador vira o celular (já aprendeu).
  const TIP_KEY = 'bastiao-dica-girar';
  const portrait = window.matchMedia('(max-width: 900px) and (orientation: portrait)');
  const tip = document.getElementById('rotateTip');
  let tipDone = G.store.load(TIP_KEY, '0') === '1', tipShown = false;
  function dismissTip() {
    tipDone = true;
    G.store.save(TIP_KEY, 1);
    tip.hidden = true;
  }
  document.getElementById('rotateOk').addEventListener('click', dismissTip);

  function syncTip() {
    if (tipDone) return;
    const S = G.S;
    if (tipShown && !portrait.matches) { dismissTip(); return; }
    const show = portrait.matches && S.inGame && !S.over;
    if (show === !tip.hidden) return;
    tip.hidden = !show;
    if (show) tipShown = true;
  }

  let lastWanted = null;
  function sync() {
    const S = G.S;
    syncTip();
    wanted = S.inGame && !S.over && !S.halted && !S.paused && !S.menuOpen;
    if (wanted === lastWanted) return;
    lastWanted = wanted;
    if (wanted) acquire(); else release();
  }

  // ---------- Tela cheia ----------
  // Um botão na barra do celular e outro junto dos controles do computador (o CSS mostra um de cada vez).
  // No iPhone o Safari não oferece tela cheia para páginas: lá o botão some e vale abrir pela tela de início
  const fullBtns = ['btnFull', 'btnFullDesk'].map(id => document.getElementById(id));
  const root = document.documentElement;
  const canFull = !!(document.fullscreenEnabled && root.requestFullscreen);
  for (const btn of fullBtns) {
    btn.hidden = !canFull;
    btn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen().catch(err => console.warn('Tela cheia recusada:', err));
    });
  }
  document.addEventListener('fullscreenchange', () => {
    for (const btn of fullBtns) btn.setAttribute('aria-pressed', String(!!document.fullscreenElement));
  });

  TD.device = { sync };
})();
