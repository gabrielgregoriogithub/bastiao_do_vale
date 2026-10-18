// Desenho: fundo do mapa (pré-renderizado), torres, inimigos e anéis de alcance.
(() => {
  const TD = window.TD;
  const { T, COLS, ROWS, W, H } = TD;

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }

  function mulberry(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Mancha suave de luz ou sombra: dá relevo ao gramado sem marcar casas
  function blot(g, x, y, r, color) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Tufo de três folhas, um pouco abertas
  function tuft(g, x, y, h, color) {
    g.strokeStyle = color;
    g.beginPath();
    g.moveTo(x - 2, y); g.lineTo(x - 3, y - h * 0.8);
    g.moveTo(x, y); g.lineTo(x + 0.5, y - h);
    g.moveTo(x + 2, y); g.lineTo(x + 3.5, y - h * 0.75);
    g.stroke();
  }

  function drawGrass(g, pal, rnd) {
    g.fillStyle = pal.grass;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 46; i++) {
      blot(g, rnd() * W, rnd() * H, 40 + rnd() * 90, rnd() > 0.5 ? 'rgba(255,245,200,.07)' : 'rgba(0,0,0,.09)');
    }
    // variação leve por casa: ajuda a ler a grade onde se constrói
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = rnd();
      g.fillStyle = v > 0.5 ? `rgba(255,250,210,${(v - 0.5) * 0.05})` : `rgba(0,0,0,${(0.5 - v) * 0.06})`;
      g.fillRect(c * T, r * T, T, T);
    }
    g.lineWidth = 1.2;
    for (let i = 0; i < 520; i++) {
      const x = rnd() * W, y = rnd() * H;
      g.strokeStyle = pal.tufts[rnd() > 0.5 ? 0 : 1];
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 2, y - 3 - rnd() * 2); g.stroke();
    }
    for (let i = 0; i < 90; i++) tuft(g, rnd() * W, rnd() * H, 4 + rnd() * 3, pal.tufts[rnd() > 0.4 ? 0 : 1]);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = pal.flowers[rnd() > 0.5 ? 0 : 1];
      circle(g, rnd() * W, rnd() * H, 1.3); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,.08)';
    g.lineWidth = 1;
    for (let c = 1; c < COLS; c++) { g.beginPath(); g.moveTo(c * T + 0.5, 0); g.lineTo(c * T + 0.5, H); g.stroke(); }
    for (let r = 1; r < ROWS; r++) { g.beginPath(); g.moveTo(0, r * T + 0.5); g.lineTo(W, r * T + 0.5); g.stroke(); }
  }

  // Margem: sombra para dentro da água e borda clara onde ela encontra a terra.
  // Fora do mapa conta como água, para o rio seguir além da borda.
  const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function drawBank(g, x, y, dc, dr, lava) {
    const sh = 9;
    const [x0, y0, w, h] = dr === -1 ? [x, y, T, sh] : dr === 1 ? [x, y + T - sh, T, sh] : dc === -1 ? [x, y, sh, T] : [x + T - sh, y, sh, T];
    const grad = dr ? g.createLinearGradient(0, dr === -1 ? y : y + T, 0, dr === -1 ? y + sh : y + T - sh)
      : g.createLinearGradient(dc === -1 ? x : x + T, 0, dc === -1 ? x + sh : x + T - sh, 0);
    grad.addColorStop(0, 'rgba(10,25,30,.45)');
    grad.addColorStop(1, 'rgba(10,25,30,0)');
    g.fillStyle = grad; g.fillRect(x0, y0, w, h);
    g.strokeStyle = lava ? 'rgba(30,22,18,.9)' : 'rgba(214,196,140,.55)'; g.lineWidth = lava ? 3 : 2;
    g.beginPath();
    if (dr) { const yy = dr === -1 ? y + 1 : y + T - 1; g.moveTo(x, yy); g.lineTo(x + T, yy); }
    else { const xx = dc === -1 ? x + 1 : x + T - 1; g.moveTo(xx, y); g.lineTo(xx, y + T); }
    g.stroke();
  }

  function drawWater(g, md, rnd) {
    const cells = new Set(md.map.water.map(([c, r]) => `${c},${r}`));
    const isWater = (c, r) => c < 0 || c >= COLS || r < 0 || r >= ROWS || cells.has(`${c},${r}`);
    const base = md.map.waterColor || '#34657f', lava = !!md.map.lava;
    for (const [c, r] of md.map.water) {
      if (md.blocked[r] && md.blocked[r][c] === 1) continue;
      const x = c * T, y = r * T;
      g.fillStyle = base; g.fillRect(x, y, T, T);
      // água: fundo mais escuro no meio; lava: miolo amarelo, mais quente
      const depth = g.createRadialGradient(x + T / 2, y + T / 2, 2, x + T / 2, y + T / 2, T * 0.8);
      depth.addColorStop(0, lava ? 'rgba(255,214,90,.55)' : 'rgba(0,15,25,.18)');
      depth.addColorStop(1, lava ? 'rgba(255,214,90,0)' : 'rgba(0,15,25,0)');
      g.fillStyle = depth; g.fillRect(x, y, T, T);
      for (const [dc, dr] of SIDES) if (!isWater(c + dc, r + dr)) drawBank(g, x, y, dc, dr, lava);
    }
    g.strokeStyle = lava ? 'rgba(255,226,140,.7)' : 'rgba(160,205,225,.55)';
    g.lineWidth = 1.2;
    for (const [c, r] of md.map.water) {
      for (let i = 0; i < 3; i++) {
        const x = c * T + 6 + rnd() * (T - 16), y = r * T + 6 + rnd() * (T - 12);
        g.beginPath(); g.arc(x, y, 4, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      }
    }
  }

  function drawRoad(g, md, rnd) {
    const pal = md.map.palette;
    // cada camada é traçada em todas as estradas antes da próxima, para os cruzamentos se fundirem
    const stroke = (color, width) => {
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'butt';
      for (const path of md.paths) {
        g.beginPath(); g.moveTo(path.pts[0].x, path.pts[0].y);
        for (const p of path.pts.slice(1)) g.lineTo(p.x, p.y);
        g.stroke();
      }
    };
    stroke('rgba(20,28,12,.22)', T + 14);
    stroke('rgba(30,40,20,.45)', T + 6);
    stroke(pal.road[0], T);
    stroke(pal.road[1], T - 8);
    // faixa gasta no meio, por onde todos passam
    stroke('rgba(255,240,200,.09)', T * 0.42);
    stroke('rgba(255,240,200,.06)', T * 0.2);
    for (const path of md.paths) {
      for (let i = 0; i < 260 / md.paths.length; i++) {
        const p = path.posAt(rnd() * path.len);
        g.fillStyle = pal.pebbles[rnd() > 0.5 ? 0 : 1];
        circle(g, p.x + (rnd() - 0.5) * T * 0.7, p.y + (rnd() - 0.5) * T * 0.7, 0.8 + rnd() * 1.4); g.fill();
      }
      // tufos de grama invadindo a beirada: a borda deixa de ser uma linha reta
      g.lineWidth = 1.2;
      for (let i = 0; i < path.len / 9; i++) {
        const d = rnd() * path.len, a = path.posAt(d), b = path.posAt(Math.min(path.len, d + 1));
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        const side = rnd() > 0.5 ? 1 : -1, off = T / 2 - 1 + rnd() * 3;
        tuft(g, a.x + nx * off * side, a.y + ny * off * side + 2, 3 + rnd() * 3, pal.tufts[rnd() > 0.5 ? 0 : 1]);
      }
    }
  }

  // Pinheiro com neve nos galhos (Encruzilhada)
  function drawPine(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x + 2, y + 12, 12, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a4030'; g.fillRect(x - 2, y + 4, 4, 8);
    for (const [dy, w] of [[6, 13], [-2, 10], [-9, 7]]) {
      g.fillStyle = '#2e4a3a'; g.beginPath(); g.moveTo(x - w, y + dy); g.lineTo(x, y + dy - 12); g.lineTo(x + w, y + dy); g.closePath(); g.fill();
      g.fillStyle = '#f2f6f8'; g.beginPath(); g.moveTo(x - w * 0.5, y + dy - 6); g.lineTo(x, y + dy - 12); g.lineTo(x + w * 0.5, y + dy - 6); g.closePath(); g.fill();
    }
  }
  // Cacto de dois braços (Serpente, no deserto)
  function drawCactus(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x + 2, y + 12, 10, 4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4e7a3a'; g.lineCap = 'round';
    g.lineWidth = 7; g.beginPath(); g.moveTo(x, y + 11); g.lineTo(x, y - 12); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x - 8, y + 2); g.lineTo(x - 8, y - 6);
    g.moveTo(x, y - 2); g.lineTo(x + 7, y - 2); g.lineTo(x + 7, y - 9); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 1.5, y + 9); g.lineTo(x - 1.5, y - 10); g.stroke();
    g.lineCap = 'butt';
  }

  // Cenário nas casas ao lado da caverna (a coluna da muralha fica coberta por ela), conforme o ambiente:
  // arbustos e pedras; no deserto, cactos; na neve, pinheiros; no vulcão, rocha negra com brasas
  const ROCK = { vulcao: ['#2e2826', '#433a36'], neve: ['#8a929a', '#a8b0b8'] };
  function drawDecor(g, md, rnd) {
    const biome = md.map.biome, rock = ROCK[biome] || ['#6f6a5e', '#868174'];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 1; c++) {
      if (md.blocked[r][c] !== 2) continue;
      const x = (c + 0.5) * T, y = (r + 0.5) * T, plant = rnd() > 0.45;
      if (plant && biome === 'neve') drawPine(g, x, y);
      else if (plant && biome === 'deserto') drawCactus(g, x, y);
      else if (plant && biome !== 'vulcao') {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + 9, 15, 6, 0, 0, Math.PI * 2); g.fill();
        for (const [dx, dy, s, col] of [[-7, 2, 9, '#2f4a22'], [6, 3, 10, '#2f4a22'], [0, -4, 11, '#3d5c2b'], [-3, -1, 6, '#4f7337'], [5, -6, 4, '#628a44']]) {
          g.fillStyle = col; circle(g, x + dx, y + dy, s); g.fill();
        }
      } else {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + 8, 13, 5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = rock[0]; g.beginPath(); g.ellipse(x - 3, y + 2, 11, 8, -0.3, 0, Math.PI * 2); g.fill();
        g.fillStyle = rock[1]; g.beginPath(); g.ellipse(x + 5, y + 4, 7, 5, 0.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = biome === 'neve' ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(x - 5, y - 1, 5, 3, -0.3, 0, Math.PI * 2); g.fill();
        if (biome === 'vulcao') {
          g.strokeStyle = '#f0782a'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(x - 9, y + 3); g.lineTo(x - 3, y + 1); g.lineTo(x + 1, y + 5); g.stroke();
        }
      }
    }
  }

  // Luz quente vinda do alto à esquerda e bordas mais escuras, para o campo ganhar profundidade
  function drawLight(g) {
    const sun = g.createLinearGradient(0, 0, W, H);
    sun.addColorStop(0, 'rgba(255,236,170,.10)');
    sun.addColorStop(0.5, 'rgba(255,236,170,0)');
    sun.addColorStop(1, 'rgba(0,10,20,.10)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    const vig = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
  }

  function drawMud(g, md, rnd) {
    for (const [c, r] of md.mudCells) {
      const x = (c + 0.5) * T, y = (r + 0.5) * T;
      g.fillStyle = 'rgba(70,52,28,.85)';
      g.beginPath(); g.ellipse(x, y, T * 0.42, T * 0.36, rnd() * Math.PI, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(120,95,60,.7)';
      for (let i = 0; i < 3; i++) { circle(g, x + (rnd() - 0.5) * T * 0.5, y + (rnd() - 0.5) * T * 0.4, 1.5 + rnd() * 1.5); g.fill(); }
    }
  }

  function drawBridges(g, md) {
    for (const [c, r] of md.bridges) {
      const horizontal = md.blocked[r][c - 1] === 1 || md.blocked[r][c + 1] === 1;
      const x = c * T, y = r * T;
      g.fillStyle = '#7a5530';
      g.fillRect(x - 3, y + 3, T + 6, T - 6);
      g.strokeStyle = '#4e3418'; g.lineWidth = 1.5;
      for (let i = 0; i <= 6; i++) {
        g.beginPath();
        if (horizontal) { g.moveTo(x - 3 + i * (T + 6) / 6, y + 3); g.lineTo(x - 3 + i * (T + 6) / 6, y + T - 3); }
        else { g.moveTo(x + 3, y + i * T / 6); g.lineTo(x + T - 3, y + i * T / 6); }
        g.stroke();
      }
      g.strokeStyle = '#3a2610'; g.lineWidth = 3;
      g.beginPath();
      if (horizontal) { g.moveTo(x - 3, y + 3); g.lineTo(x + T + 3, y + 3); g.moveTo(x - 3, y + T - 3); g.lineTo(x + T + 3, y + T - 3); }
      else { g.moveTo(x + 3, y); g.lineTo(x + 3, y + T); g.moveTo(x + T - 3, y); g.lineTo(x + T - 3, y + T); }
      g.stroke();
    }
  }

  function drawCave(g, row) {
    const cy = (row + 0.5) * T;
    g.fillStyle = '#56534b'; g.beginPath(); g.ellipse(-4, cy, T * 1.15, T * 1.45, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6c685e'; g.beginPath(); g.ellipse(-8, cy - 6, T * 0.9, T * 1.2, 0, 0, Math.PI * 2); g.fill();
    // boca da caverna com fundo que some no escuro
    const mouth = g.createRadialGradient(-6, cy + 2, 2, 0, cy + 2, T * 0.62);
    mouth.addColorStop(0, '#000000'); mouth.addColorStop(0.7, '#121210'); mouth.addColorStop(1, '#2a2824');
    g.fillStyle = mouth; g.beginPath(); g.ellipse(0, cy + 2, T * 0.55, T * 0.62, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(-10, cy - T * 0.7, T * 0.5, T * 0.22, -0.3, 0, Math.PI * 2); g.fill();
  }

  function drawCastle(g, row) {
    const x0 = W - T * 0.95, top = (row - 2) * T, bot = (row + 3) * T, gy = (row + 0.5) * T;
    g.fillStyle = '#7c766a'; g.strokeStyle = '#3e3a33'; g.lineWidth = 2;
    g.fillRect(x0, top, W - x0, bot - top); g.strokeRect(x0, top, W - x0 + 2, bot - top);
    for (let y = top + 4; y < bot - 4; y += 12) { g.fillStyle = '#8b8577'; g.fillRect(x0 - 6, y, 7, 7); g.strokeRect(x0 - 6, y, 7, 7); }
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
    for (let y = top + 10; y < bot; y += 10) { g.beginPath(); g.moveTo(x0, y); g.lineTo(W, y); g.stroke(); }
    for (const ty of [top, bot]) {
      g.fillStyle = '#6a655a'; circle(g, W - T * 0.45, ty, T * 0.55); g.fill();
      g.strokeStyle = '#3e3a33'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#857f71'; circle(g, W - T * 0.45, ty, T * 0.36); g.fill();
    }
    g.fillStyle = '#1b1712';
    g.beginPath(); g.moveTo(x0 - 1, gy + T * 0.42); g.lineTo(x0 - 1, gy - T * 0.2);
    g.arc(x0 + 10, gy - T * 0.2, 11, Math.PI, 0); g.lineTo(x0 + 21, gy + T * 0.42); g.closePath(); g.fill();
    const fx = W - T * 0.45, fy = top - T * 0.55;
    g.strokeStyle = '#3e3a33'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - T * 0.7); g.stroke();
    g.fillStyle = '#d6a547';
    g.beginPath(); g.moveTo(fx, fy - T * 0.7); g.lineTo(fx - 16, fy - T * 0.55); g.lineTo(fx, fy - T * 0.4); g.fill();
  }

  function buildBg(md, dpr) {
    const bg = document.createElement('canvas');
    bg.width = W * dpr; bg.height = H * dpr;
    const g = bg.getContext('2d');
    g.scale(dpr, dpr);
    const rnd = mulberry(md.map.id.length * 97 + 7);
    drawGrass(g, md.map.palette, rnd);
    drawWater(g, md, rnd);
    drawRoad(g, md, rnd);
    drawMud(g, md, rnd);
    drawBridges(g, md);
    for (const p of md.paths) drawCave(g, p.startRow);
    drawDecor(g, md, rnd);
    drawCastle(g, md.exitRow);
    drawLight(g);
    return bg;
  }

  const PENNANT = { archer: '#c9a45c', cannon: '#9aa0a8', frost: '#8fd3e8', ballista: '#b0743a', arcane: '#9b7be0', barracks: '#b0473b', banner: '#d6a547' };

  // Nível 2 ganha rebites de bronze; nível 3 ergue um estandarte com a cor da torre
  function drawTowerTier(g, type, level, specColor) {
    if (level >= 2) {
      g.fillStyle = '#c9a04a';
      for (const [px, py] of [[-11.5, -11.5], [11.5, -11.5], [-11.5, 11.5], [11.5, 11.5]]) { circle(g, px, py, 1.6); g.fill(); }
    }
    if (level >= 3) {
      g.strokeStyle = '#2f2b25'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-13, -12); g.lineTo(-13, -27); g.stroke();
      g.fillStyle = specColor || PENNANT[type];
      g.beginPath(); g.moveTo(-13, -27); g.lineTo(-3, -24); g.lineTo(-13, -20); g.closePath(); g.fill();
    }
  }

  // A torre em três camadas: base (sombra, pedestal, bandeirola), cabeça (gira e recua ao atirar)
  // e marcas (pontos de nível e gema da especialização), sempre nesta ordem
  function towerBase(g, type, level, specColor) {
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(2, 4, 16, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = level >= 3 ? '#736d61' : '#6b665b'; g.strokeStyle = specColor ? '#d6a547' : '#38352f'; g.lineWidth = 2;
    rr(g, -15, -15, 30, 30, 6); g.fill(); g.stroke();
    g.fillStyle = '#7f796c'; rr(g, -11, -11, 22, 22, 4); g.fill();
    drawTowerTier(g, type, level, specColor);
  }

  // time: relógio da animação parada (cristal que flutua, orbe que pulsa); 0 desliga o movimento
  function towerHead(g, type, ang, kick, time = 0) {
    const recoil = -kick * 4;

    if (type === 'archer') {
      g.rotate(ang);
      g.translate(recoil * 0.5, 0);
      const ex = -2 + 9 * Math.cos(1.2), ey = 9 * Math.sin(1.2);
      g.strokeStyle = '#e0c178'; g.lineWidth = 3;
      g.beginPath(); g.arc(-2, 0, 9, -1.2, 1.2); g.stroke();
      g.strokeStyle = '#efe6cf'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(ex, -ey); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = '#8a5a2b'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(ex - 1, 0); g.lineTo(11, 0); g.stroke();
    } else if (type === 'cannon') {
      g.rotate(ang);
      g.translate(recoil, 0);
      g.fillStyle = '#25272a'; rr(g, -2, -4.5, 17, 9, 2); g.fill();
      g.fillStyle = '#3d4045'; circle(g, 0, 0, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)'; circle(g, -2.5, -2.5, 2.6); g.fill();
    } else if (type === 'frost') {
      g.fillStyle = `rgba(143,211,232,${0.28 + 0.08 * Math.sin(time * 2.4)})`; circle(g, 0, 0, 12); g.fill();
      if (time) g.translate(0, Math.sin(time * 2.4) * 1.5 - 0.5);
      g.fillStyle = '#bfe9f5'; g.strokeStyle = '#4f9fbb'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 0); g.lineTo(0, 11); g.lineTo(-7, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(0, -5); g.lineTo(3, 0); g.lineTo(0, 5); g.lineTo(-3, 0); g.closePath(); g.fill();
    } else if (type === 'barracks') {
      // casa de guarda: telhado de madeira, porta e escudo vermelho
      g.fillStyle = '#8a6a44'; g.fillRect(-8, -3, 16, 11);
      g.fillStyle = '#6b3f22';
      g.beginPath(); g.moveTo(-11, -2); g.lineTo(0, -11); g.lineTo(11, -2); g.closePath(); g.fill();
      g.fillStyle = '#2a1d12'; g.fillRect(-2.5, 2, 5, 6);
      g.fillStyle = '#b0473b'; g.strokeStyle = '#d6a547'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-7, 0); g.lineTo(-3.5, 0); g.lineTo(-3.5, 4); g.lineTo(-5.25, 6); g.lineTo(-7, 4); g.closePath(); g.fill(); g.stroke();
    } else if (type === 'arcane') {
      // obelisco com orbe; o orbe brilha mais logo após o disparo
      g.fillStyle = '#4a3f63'; g.strokeStyle = '#231c33'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-6, 8); g.lineTo(-3.5, -4); g.lineTo(3.5, -4); g.lineTo(6, 8); g.closePath(); g.fill(); g.stroke();
      const pulse = time ? 0.1 * Math.sin(time * 3.1) : 0;
      g.fillStyle = `rgba(155,123,224,${0.3 + pulse + kick * 0.5})`; circle(g, 0, -7, 9 + pulse * 10); g.fill();
      g.fillStyle = '#c7b0ff'; circle(g, 0, -7, 4.5); g.fill();
      g.fillStyle = '#ffffff'; circle(g, -1.3, -8.3, 1.4); g.fill();
    } else if (type === 'banner') {
      // mastro com flâmula que tremula ao vento
      g.strokeStyle = '#3a2b14'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(-3, 9); g.lineTo(-3, -13); g.stroke();
      g.fillStyle = '#d6a547'; circle(g, -3, -13.5, 1.8); g.fill();
      const wave = time ? Math.sin(time * 4) * 1.5 : 0;
      g.fillStyle = '#b8432f'; g.strokeStyle = '#d6a547'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-2, -12); g.quadraticCurveTo(4, -12 + wave, 10, -10); g.lineTo(10, -2);
      g.quadraticCurveTo(4, -4 - wave, -2, -3); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#d6a547'; circle(g, 4, -7, 1.6); g.fill();
    } else if (type === 'ballista') {
      g.rotate(ang);
      g.translate(recoil, 0);
      g.strokeStyle = '#7a4f27'; g.lineWidth = 3;
      g.beginPath(); g.arc(-5, 0, 12, -1.25, 1.25); g.stroke();
      g.fillStyle = '#5e3c1d'; rr(g, -10, -2.5, 19, 5, 1.5); g.fill();
      g.strokeStyle = '#d8d2c4'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-4, 0); g.lineTo(15, 0); g.stroke();
    }
  }

  function towerMarks(g, level, specColor) {
    for (let i = 0; i < level; i++) {
      g.fillStyle = '#d6a547'; g.strokeStyle = '#3a2b0c'; g.lineWidth = 1;
      circle(g, (i - (level - 1) / 2) * 7, 12.5, 2.4); g.fill(); g.stroke();
    }
    if (specColor) {
      g.fillStyle = specColor; g.strokeStyle = '#2a1f08'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(12, -18); g.lineTo(17, -12); g.lineTo(12, -6); g.lineTo(7, -12); g.closePath();
      g.fill(); g.stroke();
    }
  }

  function drawTower(g, type, x, y, level, ang, sc = 1, specColor = null, kick = 0) {
    g.save();
    g.translate(x, y);
    g.scale(sc, sc);
    towerBase(g, type, level, specColor);
    towerHead(g, type, ang, kick);
    g.restore();

    g.save();
    g.translate(x, y);
    g.scale(sc, sc);
    towerMarks(g, level, specColor);
    g.restore();
  }

  // No campo, base e marcas não mudam de um quadro para outro: ficam guardadas como imagens por tipo,
  // nível, especialização e densidade da tela, e só a cabeça é desenhada a cada quadro.
  // Com o campo cheio, isso corta a maior parte do custo de desenho.
  // A caixa (-20..24, -32..24) cobre sombra, bandeirola e gema; os deslocamentos caem em pixels inteiros
  // nas densidades comuns (1, 1,25, 1,5 e 2), para a imagem sair idêntica ao desenho direto.
  const SPRITE = { x: 20, y: 32, w: 44, h: 56 };
  const sprites = new Map();
  function sprite(key, dpr, paint) {
    let c = sprites.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.ceil(SPRITE.w * dpr);
      c.height = Math.ceil(SPRITE.h * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, SPRITE.x * dpr, SPRITE.y * dpr);
      paint(g);
      sprites.set(key, c);
    }
    return c;
  }

  function drawTowerCached(g, dpr, type, x, y, level, ang, specColor = null, kick = 0, time = 0) {
    const key = `${type}|${level}|${specColor}|${dpr}`;
    const bx = x - SPRITE.x, by = y - SPRITE.y;
    g.drawImage(sprite('base|' + key, dpr, s => towerBase(s, type, level, specColor)), bx, by, SPRITE.w, SPRITE.h);
    g.save();
    g.translate(x, y);
    towerHead(g, type, ang, kick, time ? time + (x + y) * 0.013 : 0);
    g.restore();
    g.drawImage(sprite('marks|' + key, dpr, s => towerMarks(s, level, specColor)), bx, by, SPRITE.w, SPRITE.h);
  }

  function drawFlyer(g, e, reducedMotion) {
    const d = e.d, r = d.r, flap = reducedMotion ? 0.5 : (Math.sin(e.wob * 2.2) + 1) / 2;
    const x = e.x, y = e.y - 10;
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.beginPath(); g.ellipse(e.x + 4, e.y + 8, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = e.flash > 0 ? '#fff4dc' : d.dark;
    g.strokeStyle = mix(d.color, '#ffffff', 0.25); g.lineWidth = 1.2; g.lineJoin = 'round';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(x + side * 3, y - 2);
      g.lineTo(x + side * (r + 9), y - 4 - flap * 8);
      g.lineTo(x + side * (r + 5), y + 3);
      g.lineTo(x + side * 3, y + 3);
      g.closePath(); g.fill();
      // borda de ataque da asa pega a luz
      g.beginPath(); g.moveTo(x + side * 3, y - 2); g.lineTo(x + side * (r + 9), y - 4 - flap * 8); g.stroke();
    }
    if (e.flash > 0) {
      g.fillStyle = '#fff4dc'; g.strokeStyle = d.dark; g.lineWidth = 2;
      circle(g, x, y, r * 0.75); g.fill(); g.stroke();
    } else drawBody(g, x, y, r * 0.75, d.color, d.dark);
    g.fillStyle = '#f0c75a';
    circle(g, x - 2.5, y - 1, 1.4); g.fill();
    circle(g, x + 2.5, y - 1, 1.4); g.fill();
    // bico, chifres, orelhas ou chamas da versão de cada ambiente; voa sempre rumo à muralha, à direita
    drawLooks(g, e, x, y, r * 0.75, 0, false, false);
  }

  function drawStatus(g, e, x, y, r) {
    if (e.shield > 0) {
      g.fillStyle = 'rgba(180,139,224,.18)'; g.strokeStyle = 'rgba(200,165,240,.9)'; g.lineWidth = 1.5;
      circle(g, x, y, r + 7); g.fill(); g.stroke();
    }
    if (e.frozenT > 0) {
      g.fillStyle = 'rgba(200,238,252,.55)'; g.strokeStyle = 'rgba(240,252,255,.95)'; g.lineWidth = 1.5;
      rr(g, x - r - 3, y - r - 3, (r + 3) * 2, (r + 3) * 2, 3); g.fill(); g.stroke();
    } else if (e.slowT > 0) {
      g.strokeStyle = 'rgba(160,225,245,.9)'; g.lineWidth = 2;
      circle(g, x, y, r + 3); g.stroke();
    }
    if (e.dots.burn) {
      g.fillStyle = 'rgba(255,140,50,.85)';
      for (let i = 0; i < 3; i++) { circle(g, x + (Math.random() - 0.5) * r * 1.6, y - r * 0.4 - Math.random() * r, 1.8); g.fill(); }
    }
    if (e.stunT > 0) {
      g.fillStyle = '#f0d27a';
      for (let i = 0; i < 3; i++) {
        const a = performance.now() / 300 + i * 2.1;
        circle(g, x + Math.cos(a) * (r + 2), y - r - 4 + Math.sin(a) * 2, 1.8); g.fill();
      }
    }
    if (e.weakT > 0) {
      g.fillStyle = 'rgba(199,123,224,.9)';
      g.font = '700 10px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
      g.fillText('ᛉ', x + r + 4, y - r + 2);
    }
    if (e.dots.poison) {
      g.strokeStyle = 'rgba(150,210,90,.9)'; g.lineWidth = 1.5; g.setLineDash([3, 3]);
      circle(g, x, y, r + 5); g.stroke(); g.setLineDash([]);
    }
  }

  function drawHpBar(g, e, x, y, r) {
    if (e.hp >= e.maxHp) return;
    const w = r * 2 + 6, k = Math.max(0, e.hp / e.maxHp), top = y - r - (e.d.boss ? 18 : 8);
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - w / 2 - 1, top - 1, w + 2, 5);
    g.fillStyle = k > 0.5 ? '#86b46f' : k > 0.25 ? '#d6a547' : '#e0715a';
    g.fillRect(x - w / 2, top, w * k, 3);
  }

  // Cores do corpo com volume: luz no alto à esquerda, cor do inimigo no meio e borda puxada para o escuro
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const mixed = new Map();
  const mix = (a, b, k) => {
    const key = `${a}|${b}|${k}`;
    if (!mixed.has(key)) mixed.set(key, `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k)).join(',')})`);
    return mixed.get(key);
  };
  function bodyFill(g, color, dark, r) {
    const grad = g.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.05);
    grad.addColorStop(0, mix(color, '#ffffff', 0.35)); grad.addColorStop(0.55, color); grad.addColorStop(1, mix(color, dark, 0.55));
    return grad;
  }

  // shape: 'circle', ou o tipo do inimigo de corpo quadrado ('brute', 'colossus')
  function bodyShape(g, shape, x, y, r) {
    if (shape === 'brute' || shape === 'colossus') rr(g, x - r, y - r, r * 2, r * 2, shape === 'colossus' ? 6 : 4);
    else circle(g, x, y, r);
  }

  // Corpo com volume (degradê e contorno), desenhado uma vez por cor e tamanho, em resolução dobrada,
  // e reaproveitado: criar um degradê por figura a cada quadro custava mais que todo o resto do desenho
  const BODY_RES = 2;
  const bodies = new Map();
  function drawBody(g, x, y, r, color, dark, shape = 'circle', lw = 2) {
    const key = `${color}|${dark}|${r}|${shape}|${lw}`, s = r + 3;
    let c = bodies.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = Math.ceil(s * 2 * BODY_RES);
      const b = c.getContext('2d');
      b.setTransform(BODY_RES, 0, 0, BODY_RES, s * BODY_RES, s * BODY_RES);
      b.fillStyle = bodyFill(b, color, dark, r); b.strokeStyle = dark; b.lineWidth = lw;
      bodyShape(b, shape, 0, 0, r); b.fill(); b.stroke();
      bodies.set(key, c);
    }
    g.drawImage(c, x - s, y - s, s * 2, s * 2);
  }

  // Para onde o inimigo anda; no ícone do Compêndio (sem estrada), para a direita, rumo à muralha
  function heading(e) {
    if (!e.path) return 0;
    const b = e.path.posAt(Math.min(e.path.len, e.dist + 3));
    return b.x === e.x && b.y === e.y ? 0 : Math.atan2(b.y - e.y, b.x - e.x);
  }

  // Dois pés que se alternam no passo, aparecendo por baixo do corpo; phase avança enquanto anda
  function drawFeet(g, x, y, r, ang, phase, color) {
    const step = Math.sin(phase) * r * 0.45;
    const fx = Math.cos(ang), fy = Math.sin(ang), px = -fy, py = fx;
    g.fillStyle = color;
    g.beginPath();
    for (const side of [-1, 1]) {
      const s = step * side, cx = x + px * r * 0.55 * side + fx * s, cy = y + py * r * 0.55 * side + fy * s + r * 0.62;
      g.moveTo(cx + r * 0.34, cy); g.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
    }
    g.fill();
  }

  // Lança ou adaga (look 'spear' / 'dagger'), apontada para onde anda
  function drawWeapon(g, dagger, x, y, r, ang) {
    const len = dagger ? 7 : 15, blade = dagger ? 4 : 5;
    const fx = Math.cos(ang), fy = Math.sin(ang), px = -fy * r * 0.8, py = fx * r * 0.8;
    const bx = x + px - fx * r * 0.6, by = y + py - fy * r * 0.6, tx = x + px + fx * (r * 0.4 + len), ty = y + py + fy * (r * 0.4 + len);
    const ex = tx - fx * blade, ey = ty - fy * blade;
    g.strokeStyle = '#3d2c1a'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    // lâmina em triângulo
    g.fillStyle = '#e4dfd2';
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(ex - fy * 2.6, ey + fx * 2.6); g.lineTo(ex + fy * 2.6, ey - fx * 2.6); g.fill();
  }

  // Enfeites de cada inimigo (d.look, em bestiary.js), desenhados sobre o corpo de raio r em (x, y).
  // Os que ficam atrás do corpo (garras, patas) estão em BEHIND e são desenhados antes dele.
  const BEHIND = new Set(['claws', 'legs']);
  const LOOKS = {
    spear: (g, e, x, y, r, ang) => drawWeapon(g, false, x, y, r, ang),
    dagger: (g, e, x, y, r, ang) => drawWeapon(g, true, x, y, r, ang),
    visor(g, e, x, y, r) {
      g.fillStyle = '#1f252b'; rr(g, x - r * 0.62, y - r * 0.3, r * 1.24, r * 0.26, 1.5); g.fill();
      g.fillStyle = '#c5ccd3';
      for (const [dx, dy] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { circle(g, x + dx * r, y + dy * r, 1.3); g.fill(); }
    },
    cross(g, e, x, y) {
      g.fillStyle = '#f2f7ee';
      g.fillRect(x - 1.5, y - 5, 3, 10);
      g.fillRect(x - 5, y - 1.5, 10, 3);
    },
    hat(g, e, x, y, r) {
      g.fillStyle = e.d.dark; g.strokeStyle = mix(e.d.color, '#ffffff', 0.4); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x - 11, y - r + 4); g.lineTo(x + 3, y - r - 16); g.lineTo(x + 11, y - r + 4); g.closePath();
      g.fill(); g.stroke();
    },
    cracks(g, e, x, y, r) {
      // no Golem de Magma as rachaduras brilham com lava
      g.strokeStyle = e.d.look.includes('flame') ? '#f08a3a' : 'rgba(0,0,0,.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - r + 4, y - 3); g.lineTo(x + r - 4, y - 3); g.moveTo(x - 4, y - r + 4); g.lineTo(x - 4, y + r - 4); g.stroke();
      g.fillStyle = '#f0c75a';
      circle(g, x - 6, y - 8, 2); g.fill(); circle(g, x + 6, y - 8, 2); g.fill();
    },
    crown(g, e, x, y, r) {
      g.fillStyle = '#d6a547'; g.strokeStyle = '#3a2b0c'; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - 9, y - r + 3); g.lineTo(x - 9, y - r - 6); g.lineTo(x - 4.5, y - r - 1);
      g.lineTo(x, y - r - 8); g.lineTo(x + 4.5, y - r - 1); g.lineTo(x + 9, y - r - 6); g.lineTo(x + 9, y - r + 3);
      g.closePath(); g.fill(); g.stroke();
    },
    hood(g, e, x, y, r) {
      g.fillStyle = mix(e.d.dark, '#000000', 0.2);
      g.beginPath(); g.arc(x, y - 1, r * 0.75, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = '#7be08a';
      circle(g, x - 3, y, 1.6); g.fill(); circle(g, x + 3, y, 1.6); g.fill();
    },
    bones(g, e, x, y) {
      g.strokeStyle = e.d.dark; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x - 4, y + 1); g.lineTo(x + 4, y + 1); g.moveTo(x - 3, y + 4); g.lineTo(x + 3, y + 4); g.stroke();
      g.fillStyle = '#2b2820'; circle(g, x - 2.5, y - 3, 1.5); g.fill(); circle(g, x + 2.5, y - 3, 1.5); g.fill();
    },
    eye(g, e, x, y, r, ang, hidden) {
      if (hidden) return;
      g.strokeStyle = '#e8d07a'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(x, y - r - 6, 4, 2.4, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#e8d07a'; circle(g, x, y - r - 6, 1.2); g.fill();
    },
    // olhos saltados no alto da cabeça (Homem-Sapo)
    bulge(g, e, x, y, r) {
      for (const s of [-1, 1]) {
        g.fillStyle = e.d.color; circle(g, x + s * r * 0.45, y - r * 0.8, r * 0.32); g.fill();
        g.fillStyle = '#f2e9a0'; circle(g, x + s * r * 0.45, y - r * 0.85, r * 0.18); g.fill();
        g.fillStyle = '#1a1a10'; circle(g, x + s * r * 0.45, y - r * 0.85, r * 0.08); g.fill();
      }
    },
    stripes(g, e, x, y, r) {
      g.strokeStyle = mix(e.d.dark, e.d.color, 0.3); g.lineWidth = 1.6;
      g.beginPath();
      for (const k of [-0.45, 0, 0.45]) { g.moveTo(x + k * r - r * 0.2, y - r * 0.6); g.lineTo(x + k * r + r * 0.2, y + r * 0.6); }
      g.stroke();
    },
    claws(g, e, x, y, r, ang) {
      g.fillStyle = mix(e.d.color, '#000000', 0.15); g.strokeStyle = e.d.dark; g.lineWidth = 1.2;
      for (const s of [-1, 1]) {
        const a = ang + s * 0.75, cx = x + Math.cos(a) * r * 1.15, cy = y + Math.sin(a) * r * 1.15;
        g.beginPath(); g.arc(cx, cy, r * 0.42, a + 0.6, a + Math.PI * 2 - 0.6); g.lineTo(cx, cy); g.closePath(); g.fill(); g.stroke();
      }
    },
    legs(g, e, x, y, r, ang) {
      g.strokeStyle = e.d.dark; g.lineWidth = 1.6;
      const kick = Math.sin(e.wob * 1.6) * 0.15;
      g.beginPath();
      for (const s of [-1, 1]) for (const k of [-0.9, -0.3, 0.3, 0.9]) {
        const a = ang + s * (Math.PI / 2) + k * 0.6 + kick * s;
        const mx = x + Math.cos(a) * r * 1.2, my = y + Math.sin(a) * r * 1.2;
        g.moveTo(x, y); g.lineTo(mx, my - 3); g.lineTo(mx + Math.cos(a) * r * 0.4, my + 2);
      }
      g.stroke();
    },
    drop(g, e, x, y) {
      g.fillStyle = '#d8f2f6';
      g.beginPath(); g.moveTo(x, y - 6); g.quadraticCurveTo(x + 5, y + 1, x, y + 4); g.quadraticCurveTo(x - 5, y + 1, x, y - 6); g.fill();
    },
    wraps(g, e, x, y, r) {
      g.strokeStyle = mix(e.d.color, '#ffffff', 0.35); g.lineWidth = 1.4;
      g.beginPath();
      for (const k of [-0.5, -0.1, 0.3]) { g.moveTo(x - r * 0.85, y + k * r); g.lineTo(x + r * 0.85, y + (k + 0.25) * r); }
      g.stroke();
      g.fillStyle = '#1e1a14'; circle(g, x - 2.5, y - r * 0.55, 1.3); g.fill(); circle(g, x + 2.5, y - r * 0.55, 1.3); g.fill();
    },
    turban(g, e, x, y, r) {
      g.fillStyle = '#ece2c8'; g.strokeStyle = '#8a7a5a'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, y - r * 0.6, r * 0.8, r * 0.42, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#c0392b'; circle(g, x, y - r * 0.62, 1.6); g.fill();
    },
    ears(g, e, x, y, r) {
      g.fillStyle = e.d.dark;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x + s * r * 0.25, y - r * 0.8); g.lineTo(x + s * r * 0.75, y - r * 1.55); g.lineTo(x + s * r * 0.85, y - r * 0.5); g.closePath(); g.fill();
      }
    },
    horns(g, e, x, y, r) {
      g.fillStyle = '#e8dcc0'; g.strokeStyle = '#4a3e2a'; g.lineWidth = 1;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x + s * r * 0.3, y - r * 0.7); g.quadraticCurveTo(x + s * r * 1.05, y - r * 0.95, x + s * r * 0.9, y - r * 1.6);
        g.lineTo(x + s * r * 0.6, y - r * 0.55); g.closePath(); g.fill(); g.stroke();
      }
    },
    tusks(g, e, x, y, r) {
      g.fillStyle = '#f2ecd8';
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x + s * r * 0.25, y + r * 0.15); g.lineTo(x + s * r * 0.5, y + r * 0.85); g.lineTo(x + s * r * 0.55, y + r * 0.15); g.closePath(); g.fill();
      }
    },
    fur(g, e, x, y, r) {
      g.fillStyle = mix(e.d.color, '#ffffff', 0.45);
      g.beginPath(); g.moveTo(x - r * 0.95, y + r * 0.2);
      for (let i = 0; i <= 6; i++) g.lineTo(x - r * 0.95 + i * r * 0.32, y + r * (i % 2 ? 0.55 : 0.25));
      g.lineTo(x + r * 0.95, y + r * 0.2); g.closePath(); g.fill();
    },
    antennae(g, e, x, y, r) {
      g.strokeStyle = e.d.dark; g.lineWidth = 1.3;
      g.beginPath();
      for (const s of [-1, 1]) { g.moveTo(x + s * r * 0.2, y - r * 0.8); g.quadraticCurveTo(x + s * r * 0.4, y - r * 1.6, x + s * r * 0.9, y - r * 1.5); }
      g.stroke();
    },
    leaf(g, e, x, y, r) {
      g.fillStyle = '#7fb84e'; g.strokeStyle = '#2e5418'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(x + r * 0.45, y - r * 0.75, r * 0.5, r * 0.24, -0.6, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    beak(g, e, x, y, r, ang) {
      const fx = Math.cos(ang), fy = Math.sin(ang);
      g.fillStyle = '#e0a83a';
      g.beginPath(); g.moveTo(x + fx * (r + 6), y + fy * (r + 6)); g.lineTo(x + fx * r * 0.6 - fy * 3, y + fy * r * 0.6 + fx * 3); g.lineTo(x + fx * r * 0.6 + fy * 3, y + fy * r * 0.6 - fx * 3); g.fill();
    },
    flame(g, e, x, y, r) {
      const f = 0.8 + 0.2 * Math.sin(e.wob * 3);
      g.fillStyle = 'rgba(255,150,50,.9)';
      g.beginPath(); g.moveTo(x - r * 0.4, y - r * 0.75); g.quadraticCurveTo(x - r * 0.2, y - r * (0.75 + 0.9 * f), x, y - r * (0.9 + 0.8 * f));
      g.quadraticCurveTo(x + r * 0.25, y - r * (0.75 + 0.7 * f), x + r * 0.4, y - r * 0.75); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,230,140,.9)'; circle(g, x, y - r * 0.95, r * 0.16); g.fill();
    },
    shell(g, e, x, y, r) {
      g.strokeStyle = mix(e.d.color, '#ffffff', 0.3); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y - r * 0.85); g.lineTo(x, y + r * 0.85);
      g.moveTo(x - r * 0.75, y - r * 0.1); g.quadraticCurveTo(x, y + r * 0.25, x + r * 0.75, y - r * 0.1); g.stroke();
    },
  };
  function drawLooks(g, e, x, y, r, ang, hidden, behind) {
    for (const k of e.d.look || []) if (BEHIND.has(k) === behind && LOOKS[k]) LOOKS[k](g, e, x, y, r, ang, hidden);
  }

  function drawEnemy(g, e, reducedMotion) {
    if (e.d.flying) {
      drawFlyer(g, e, reducedMotion);
      drawStatus(g, e, e.x, e.y - 10, e.d.r * 0.75);
      drawHpBar(g, e, e.x, e.y - 14, e.d.r);
      return;
    }
    const d = e.d, r = d.r, bob = reducedMotion ? 0 : Math.sin(e.wob) * 1.2;
    const x = e.x, y = e.y + bob;
    // camuflado e não revelado: quase transparente, com um tremor de calor
    const hidden = d.stealth && !e.revealed;
    if (hidden) { g.save(); g.globalAlpha *= 0.32; }
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath(); g.ellipse(e.x + 2, e.y + r * 0.75, r, r * 0.45, 0, 0, Math.PI * 2); g.fill();
    const ang = heading(e);
    drawLooks(g, e, x, y, r, ang, hidden, true);
    drawFeet(g, x, y, r, ang, reducedMotion || e.frozenT > 0 ? 0 : e.wob * 1.6, d.dark);
    const look = d.look || [];
    const shape = look.includes('bigsquare') ? 'colossus' : look.includes('square') ? 'brute' : 'circle';
    if (e.flash > 0) {
      g.fillStyle = '#fff4dc'; g.strokeStyle = d.dark; g.lineWidth = 2;
      bodyShape(g, shape, x, y, r); g.fill(); g.stroke();
    } else drawBody(g, x, y, r, d.color, d.dark, shape);
    drawLooks(g, e, x, y, r, ang, hidden, false);
    drawStatus(g, e, x, y, r);
    drawHpBar(g, e, x, y, r);
    if (hidden) g.restore();
  }

  function drawHero(g, h, selected, reducedMotion) {
    if (h.deadT > 0) {
      const p = TD.hero.homePoint();
      g.fillStyle = 'rgba(30,30,28,.6)'; circle(g, p.x, p.y, 11); g.fill();
      g.font = '700 12px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
      g.fillStyle = '#ede5cf'; g.fillText(String(Math.ceil(h.deadT)), p.x, p.y + 4);
      return;
    }
    const bob = reducedMotion ? 0 : Math.sin(h.walk * 14) * 1.2;
    const x = h.x, y = h.y + bob;
    if (selected) {
      g.strokeStyle = '#d6a547'; g.lineWidth = 1.5; g.setLineDash([4, 3]);
      circle(g, x, y, 17); g.stroke(); g.setLineDash([]);
      if (h.ordered) {
        g.strokeStyle = '#3a2b0c'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(h.tx, h.ty); g.lineTo(h.tx, h.ty - 16); g.stroke();
        g.fillStyle = '#d6a547';
        g.beginPath(); g.moveTo(h.tx, h.ty - 16); g.lineTo(h.tx + 10, h.ty - 12); g.lineTo(h.tx, h.ty - 8); g.fill();
      }
    }
    // brilho dourado no chão: o herói se destaca no meio da multidão
    const aura = g.createRadialGradient(h.x, h.y + 6, 2, h.x, h.y + 6, 18);
    aura.addColorStop(0, 'rgba(240,200,110,.35)'); aura.addColorStop(1, 'rgba(240,200,110,0)');
    g.fillStyle = aura; g.beginPath(); g.ellipse(h.x, h.y + 6, 18, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath(); g.ellipse(h.x + 2, h.y + 8, 10, 4.5, 0, 0, Math.PI * 2); g.fill();
    if (h.kind === 'ranger') { drawRanger(g, h, x, y, reducedMotion); return; }
    if (h.kind === 'mage') { drawMage(g, h, x, y, reducedMotion); return; }
    drawFeet(g, x, y, 10, h.ang, reducedMotion ? 0 : h.walk * 9, '#1f2b3a');
    // escudo do lado oposto ao golpe
    const sa = h.ang + Math.PI * 0.7;
    g.fillStyle = '#8a3a2a'; g.strokeStyle = '#d6a547'; g.lineWidth = 1.5;
    circle(g, x + Math.cos(sa) * 9, y + Math.sin(sa) * 9, 5); g.fill(); g.stroke();
    drawBody(g, x, y, 10, '#4f6d8f', '#1f2b3a');
    g.fillStyle = '#c9ced8';
    g.beginPath(); g.arc(x, y - 1, 6.5, Math.PI, 0); g.fill();
    g.fillStyle = '#d6a547'; g.fillRect(x - 1, y - 9, 2, 5);
    // espada
    const swing = h.swing > 0 ? Math.sin((h.swing / 0.2) * Math.PI) * 1.1 : 0;
    const a = h.ang - 0.5 + swing;
    g.strokeStyle = '#eef0f5'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); g.lineTo(x + Math.cos(a) * 21, y + Math.sin(a) * 21); g.stroke();
    // vida e nível
    const w = 26, k = Math.max(0, h.hp / h.maxHp), top = y - 20;
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - w / 2 - 1, top - 1, w + 2, 5);
    g.fillStyle = k > 0.5 ? '#7fb3e0' : k > 0.25 ? '#d6a547' : '#e0715a';
    g.fillRect(x - w / 2, top, w * k, 3);
    g.fillStyle = '#d6a547'; g.strokeStyle = '#2a1f08'; g.lineWidth = 1;
    circle(g, x + w / 2 + 5, top + 1, 5.5); g.fill(); g.stroke();
    g.fillStyle = '#2a1f08'; g.font = '700 9px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
    g.fillText(String(h.level), x + w / 2 + 5, top + 4.5);
  }

  // Arqueira: capa verde com capuz e arco apontado para o alvo; nunca bloqueia, então não mostra vida
  // Mago: manto violeta, chapéu pontudo e cajado com gema que aponta para o alvo
  function drawMage(g, h, x, y, reducedMotion) {
    drawFeet(g, x, y, 9.5, h.ang, reducedMotion ? 0 : h.walk * 9, '#1d1638');
    const a = h.ang, sx = x + Math.cos(a + 0.5) * 8, sy = y + Math.sin(a + 0.5) * 8;
    const tx = sx + Math.cos(a) * 13, ty = sy + Math.sin(a) * 13;
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx - Math.cos(a) * 6, sy - Math.sin(a) * 6); g.lineTo(tx, ty); g.stroke();
    g.lineCap = 'butt';
    drawBody(g, x, y, 9.5, '#5b4aa8', '#1d1638');
    // chapéu: aba e copa pontuda, com uma estrela dourada
    g.fillStyle = '#2c2266';
    g.beginPath(); g.ellipse(x, y - 3, 9, 3.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - 6, y - 4); g.lineTo(x + 2, y - 17); g.lineTo(x + 6, y - 4); g.closePath(); g.fill();
    g.fillStyle = '#e8c56e'; circle(g, x + 0.5, y - 9, 1.4); g.fill();
    // gema do cajado: brilha mais logo depois do disparo
    g.fillStyle = `rgba(183,156,255,${0.35 + (h.swing > 0 ? 0.4 : 0)})`; circle(g, tx, ty, 5); g.fill();
    g.fillStyle = '#d9ccff'; circle(g, tx, ty, 2.4); g.fill();
    g.fillStyle = '#d6a547'; g.strokeStyle = '#2a1f08'; g.lineWidth = 1;
    circle(g, x + 12, y - 14, 5.5); g.fill(); g.stroke();
    g.fillStyle = '#2a1f08'; g.font = '700 9px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
    g.fillText(String(h.level), x + 12, y - 10.5);
  }

  function drawRanger(g, h, x, y, reducedMotion) {
    drawFeet(g, x, y, 9.5, h.ang, reducedMotion ? 0 : h.walk * 9, '#1f3320');
    drawBody(g, x, y, 9.5, '#4e7a45', '#1f3320');
    g.fillStyle = '#365c32';
    g.beginPath(); g.arc(x, y - 1, 7, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    g.fillStyle = '#e8c9a0'; circle(g, x, y + 1, 3); g.fill();
    const a = h.ang, bx = x + Math.cos(a) * 11, by = y + Math.sin(a) * 11;
    g.strokeStyle = '#a77b3c'; g.lineWidth = 2.2;
    g.beginPath(); g.arc(bx, by, 7, a - 1.3, a + 1.3); g.stroke();
    g.strokeStyle = '#efe6cf'; g.lineWidth = 1;
    const pull = h.swing > 0 ? 0 : 3;
    g.beginPath(); g.moveTo(bx + Math.cos(a - 1.3) * 7, by + Math.sin(a - 1.3) * 7);
    g.lineTo(bx - Math.cos(a) * pull, by - Math.sin(a) * pull);
    g.lineTo(bx + Math.cos(a + 1.3) * 7, by + Math.sin(a + 1.3) * 7); g.stroke();
    g.fillStyle = '#d6a547'; g.strokeStyle = '#2a1f08'; g.lineWidth = 1;
    circle(g, x + 12, y - 12, 5.5); g.fill(); g.stroke();
    g.fillStyle = '#2a1f08'; g.font = '700 9px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
    g.fillText(String(h.level), x + 12, y - 8.5);
  }

  function drawRange(g, x, y, r, ok) {
    g.fillStyle = ok ? 'rgba(214,165,71,.12)' : 'rgba(224,113,90,.14)';
    g.strokeStyle = ok ? 'rgba(214,165,71,.8)' : 'rgba(224,113,90,.85)';
    g.lineWidth = 1.5;
    g.setLineDash([5, 4]);
    circle(g, x, y, r); g.fill(); g.stroke();
    g.setLineDash([]);
  }

  Object.assign(TD, { rr, circle, buildBg, drawTower, drawTowerCached, drawEnemy, drawHero, drawRange, drawBody, drawFeet });
})();
