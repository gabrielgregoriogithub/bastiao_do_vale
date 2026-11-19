// Câmera do campo. No celular o mapa inteiro (20 × 12 casas) cabe na tela, mas cada casa fica com uns
// 20 px e torres e inimigos viram pontinhos. A câmera aproxima (pinça, botões + e −, roda do mouse) e
// o dedo arrasta o mapa aproximado. Tudo fica em coordenadas do mundo (W × H): scene.js aplica a
// transformação no desenho e ui.js converte o toque de volta para o mundo.
(() => {
  const TD = window.TD;
  const { W, H, COLS } = TD;

  const MAX_Z = 2.6;
  // tamanho de casa, em pixels da tela, que deixa torres e inimigos fáceis de ver e de tocar
  const COMFY_TILE = 36;
  const cam = { z: 1, x: 0, y: 0, sharp: 1, anim: null };

  const clampZ = z => Math.min(MAX_Z, Math.max(1, z));
  function clampView() {
    cam.x = Math.min(W - W / cam.z, Math.max(0, cam.x));
    cam.y = Math.min(H - H / cam.z, Math.max(0, cam.y));
  }

  // Aproxima mantendo parado, na tela, o ponto do mundo (wx, wy)
  function zoomAt(z, wx, wy) {
    const sx = (wx - cam.x) * cam.z, sy = (wy - cam.y) * cam.z;
    cam.z = clampZ(z);
    cam.x = wx - sx / cam.z;
    cam.y = wy - sy / cam.z;
    clampView();
  }

  // Arrasto em unidades da tela (W × H vale a tela inteira)
  function panBy(dx, dy) {
    cam.x -= dx / cam.z;
    cam.y -= dy / cam.z;
    clampView();
  }

  function centerOn(wx, wy) {
    cam.x = wx - W / cam.z / 2;
    cam.y = wy - H / cam.z / 2;
    clampView();
  }

  // Ponto da tela (0..W, 0..H) para o mundo, e o contrário
  const toWorld = (sx, sy) => ({ x: cam.x + sx / cam.z, y: cam.y + sy / cam.z });
  const toScreen = (wx, wy) => ({ x: (wx - cam.x) * cam.z, y: (wy - cam.y) * cam.z });

  // Resolução do fundo e das torres em cache: refeitos só quando o gesto termina, e em poucos degraus
  function settle() { cam.sharp = cam.z; }
  const detail = dpr => Math.min(3, Math.max(1, Math.ceil(dpr * cam.sharp - 0.05)));

  // Botões + e −: o zoom anda suave até o alvo, em volta do centro da tela
  function step(factor) {
    const c = toWorld(W / 2, H / 2);
    cam.anim = { from: cam.z, to: clampZ(cam.z * factor), cx: c.x, cy: c.y, t: 0 };
  }
  const ANIM_S = 0.18;
  function tick(dt) {
    const a = cam.anim;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / ANIM_S);
    const k = 1 - (1 - a.t) ** 3;
    zoomAt(a.from + (a.to - a.from) * k, a.cx, a.cy);
    if (a.t >= 1) { cam.anim = null; settle(); }
  }

  // No começo da partida, no toque: aproxima até a casa ficar confortável (no computador, nada muda)
  function start(cssWidth, touch) {
    cam.anim = null;
    cam.z = 1; cam.x = 0; cam.y = 0;
    if (touch && cssWidth > 0) {
      const z = Math.min(1.8, COMFY_TILE / (cssWidth / COLS));
      if (z >= 1.1) { cam.z = z; centerOn(W / 2, H / 2); }
    }
    settle();
  }

  // Mapa pequeno no canto quando a câmera está aproximada: mostra que há mais campo fora da tela
  const MINI_W = 132, MINI_H = MINI_W * H / W, MINI_PAD = 8;
  const zoomed = () => cam.z > 1.01;
  const miniRect = () => ({ x: W - MINI_W - MINI_PAD, y: H - MINI_H - MINI_PAD, w: MINI_W, h: MINI_H });
  function inMini(sx, sy) {
    if (!zoomed()) return false;
    const m = miniRect();
    return sx >= m.x - 6 && sx <= m.x + m.w + 6 && sy >= m.y - 6 && sy <= m.y + m.h + 6;
  }
  // toque no mapa pequeno: leva a vista para aquele ponto
  function jumpFromMini(sx, sy) {
    const m = miniRect();
    centerOn((sx - m.x) / m.w * W, (sy - m.y) / m.h * H);
  }

  TD.camera = Object.assign(cam, {
    MAX_Z, zoomAt, panBy, centerOn, toWorld, toScreen, settle, detail, step, tick, start,
    zoomed, miniRect, inMini, jumpFromMini,
  });
})();
