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

  // ---------- Floresta amazônica (Vale) ----------
  // Samambaia em leque, folhas caídas e bromélias pelo chão: não ocupam casas, só dão textura de mata
  function drawJungleFloor(g, rnd) {
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * H, s = 5 + rnd() * 5, col = rnd() > 0.5 ? '#3e7a32' : '#2c5a26';
      g.strokeStyle = col; g.lineWidth = 1.3; g.lineCap = 'round';
      for (let k = -3; k <= 3; k++) {
        const a = -Math.PI / 2 + k * 0.38;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.9, x + Math.cos(a) * s, y + Math.sin(a) * s * 0.7); g.stroke();
      }
    }
    g.lineCap = 'butt';
    for (let i = 0; i < 90; i++) {
      g.fillStyle = ['#5a4a22', '#6a5a2a', '#3a2e18'][Math.floor(rnd() * 3)];
      g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 2.2, 1, rnd() * Math.PI, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W, y = rnd() * H;
      g.fillStyle = '#3f8a3a';
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 3, y + Math.sin(a) * 2, 3.2, 1.2, a, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e8425a'; circle(g, x, y, 1.6); g.fill();
    }
  }

  // Árvore de copa larga (sumaúma); às vezes um ipê amarelo ou roxo em flor, com cipós pendurados
  const CROWNS = [['#1c4420', '#2c6a2c', '#4a8a3a', '#6aa84a'], ['#7a5a10', '#c8961c', '#e8c040', '#f8e080'], ['#5a2a4a', '#a04a7a', '#c870a0', '#e8a0c8']];
  function drawJungleTree(g, x, y, rnd) {
    const kind = rnd() < 0.82 ? 0 : rnd() < 0.6 ? 1 : 2, [c0, c1, c2, c3] = CROWNS[kind];
    g.fillStyle = 'rgba(0,10,0,.32)'; g.beginPath(); g.ellipse(x + 5, y + 12, 24, 9, 0, 0, Math.PI * 2); g.fill();
    // tronco com sapopemas (raízes em aleta)
    g.fillStyle = '#5a4630'; g.strokeStyle = '#2a1e12'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x - 9, y + 13); g.quadraticCurveTo(x - 4, y + 9, x - 3, y - 6); g.lineTo(x + 3, y - 6);
    g.quadraticCurveTo(x + 4, y + 9, x + 10, y + 13); g.quadraticCurveTo(x + 2, y + 10, x, y + 13); g.quadraticCurveTo(x - 2, y + 10, x - 9, y + 13); g.closePath();
    g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,240,200,.15)'; g.beginPath(); g.moveTo(x - 1.5, y + 8); g.lineTo(x - 1.5, y - 4); g.stroke();
    // copa em camadas: sombra embaixo, folhagem e luz no alto à esquerda
    const blobs = Array.from({ length: 6 }, () => [(rnd() - 0.5) * 26, -14 + (rnd() - 0.5) * 14, 9 + rnd() * 6]);
    g.fillStyle = c0; for (const [dx, dy, r] of blobs) { circle(g, x + dx + 1.5, y + dy + 2.5, r); g.fill(); }
    g.fillStyle = c1; for (const [dx, dy, r] of blobs) { circle(g, x + dx, y + dy, r * 0.9); g.fill(); }
    g.fillStyle = c2; for (const [dx, dy, r] of blobs) { circle(g, x + dx - r * 0.25, y + dy - r * 0.3, r * 0.55); g.fill(); }
    g.fillStyle = c3; for (const [dx, dy, r] of blobs.slice(0, 3)) { circle(g, x + dx - r * 0.4, y + dy - r * 0.45, r * 0.22); g.fill(); }
    // cipós
    g.strokeStyle = '#2e5a22'; g.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) {
      const sx = x + (rnd() - 0.5) * 24;
      g.beginPath(); g.moveTo(sx, y - 6); g.quadraticCurveTo(sx + 3, y + 2, sx - 1, y + 8 + rnd() * 6); g.stroke();
    }
  }

  // Açaizeiro: tronco fino e curvo, palmas de folíolos finos e um cacho roxo
  function drawAcai(g, x, y, rnd) {
    const lean = (rnd() - 0.5) * 8, tx = x + lean, ty = y - 20;
    g.fillStyle = 'rgba(0,10,0,.25)'; g.beginPath(); g.ellipse(x + 6, y + 12, 15, 5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6a5a44'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(x, y + 12); g.quadraticCurveTo(x + lean * 0.2, y, tx, ty); g.stroke();
    g.strokeStyle = '#4a8a3a'; g.lineWidth = 0.9;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + 0.2 + k * (Math.PI - 0.4) / 6 + (rnd() - 0.5) * 0.2, len = 15 + rnd() * 5;
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.6 + 6;
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.5 - 3, ex, ey); g.stroke();
      for (let j = 1; j < 6; j++) {
        const px = tx + (ex - tx) * j / 6, py = ty + (ey - ty) * j / 6 - Math.sin(j / 6 * Math.PI) * 3;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + 1.5, py + 4); g.stroke();
      }
    }
    g.fillStyle = '#4a2048'; for (let k = 0; k < 5; k++) { circle(g, tx - 2 + k % 3 * 1.6, ty + 3 + Math.floor(k / 3) * 1.6, 1.1); g.fill(); }
  }

  // Helicônia: folhas largas de bananeira e flores em zigue-zague vermelhas e amarelas
  function drawHeliconia(g, x, y, rnd) {
    g.fillStyle = 'rgba(0,10,0,.25)'; g.beginPath(); g.ellipse(x + 3, y + 11, 14, 5, 0, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.55;
      g.fillStyle = k % 2 ? '#3e8a34' : '#2e6a28'; g.strokeStyle = '#1e4418'; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(x + Math.cos(a) * 8, y + 4 + Math.sin(a) * 9, 3.6, 10, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    for (let i = 0; i < 2; i++) {
      const fx = x - 4 + i * 8 + (rnd() - 0.5) * 2;
      for (let j = 0; j < 4; j++) {
        g.fillStyle = j % 2 ? '#f0c040' : '#e0402a';
        g.beginPath(); g.moveTo(fx, y - 4 + j * 3.4); g.lineTo(fx + (j % 2 ? -4 : 4), y - 6 + j * 3.4); g.lineTo(fx, y - 1.5 + j * 3.4); g.closePath(); g.fill();
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
  // Lápide com cruz ou arco (Cemitério)
  function drawGrave(g, x, y, rnd) {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + 2, y + 11, 11, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a3e30'; g.beginPath(); g.ellipse(x, y + 10, 10, 3.5, 0, 0, Math.PI * 2); g.fill();
    if (rnd() > 0.5) {
      g.fillStyle = '#7a7670'; g.strokeStyle = '#3a3834'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - 7, y + 10); g.lineTo(x - 7, y - 4); g.arc(x, y - 4, 7, Math.PI, 0); g.lineTo(x + 7, y + 10); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - 3, y - 2); g.lineTo(x + 3, y - 2); g.moveTo(x - 3, y + 2); g.lineTo(x + 3, y + 2); g.stroke();
    } else {
      g.fillStyle = '#86827a';
      g.fillRect(x - 2, y - 10, 4, 20); g.fillRect(x - 7, y - 5, 14, 4);
    }
  }
  // Coqueiro inclinado (Costa)
  function drawPalm(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x + 6, y + 12, 13, 4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7a5a36'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 3, y + 12); g.quadraticCurveTo(x - 4, y - 2, x + 3, y - 10); g.stroke();
    g.lineCap = 'butt';
    g.fillStyle = '#3e7a3a';
    for (const a of [-2.6, -1.9, -1.2, -0.5, 0.2]) {
      g.beginPath(); g.ellipse(x + 3 + Math.cos(a) * 8, y - 10 + Math.sin(a) * 5, 9, 2.6, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#5a3a1a'; circle(g, x + 2, y - 8, 2); g.fill(); circle(g, x + 5, y - 7, 2); g.fill();
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
      if (md.map.theme === 'amazonia') {
        const v = rnd();
        if (v < 0.58) drawJungleTree(g, x, y, rnd); else if (v < 0.82) drawAcai(g, x, y, rnd); else drawHeliconia(g, x, y, rnd);
      } else if (biome === 'cripta') drawGrave(g, x, y, rnd);
      else if (plant && biome === 'neve') drawPine(g, x, y);
      else if (plant && biome === 'costa') drawPalm(g, x, y);
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
    if (md.map.theme === 'amazonia') drawJungleFloor(g, rnd);
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

  // Mistura de duas cores hexadecimais (k de 0 a 1), guardada para não recalcular a cada quadro
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const mixed = new Map();
  const mix = (a, b, k) => {
    const key = `${a}|${b}|${k}`;
    if (!mixed.has(key)) mixed.set(key, `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k)).join(',')})`);
    return mixed.get(key);
  };

  // Heróis no mesmo estilo dos inimigos: Cavaleiro de armadura e capa, Arqueira de capuz, Mago de manto
  const HERO_LOOK = {
    knight: { colors: { main: '#4f6d8f', dark: '#1f2b3a', accent: '#8a3a2a', armored: true }, look: ['sword', 'shield', 'cape'] },
    ranger: { colors: { main: '#4e7a45', dark: '#1f3320' }, look: ['bow', 'cowl'] },
    mage: { colors: { main: '#5b4aa8', dark: '#1d1638', robe: true }, look: ['hat'] },
  };

  function drawHero(g, h, selected, reducedMotion) {
    if (h.deadT > 0) {
      const p = TD.hero.homePoint();
      g.fillStyle = 'rgba(30,30,28,.6)'; circle(g, p.x, p.y, 11); g.fill();
      g.font = '700 12px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
      g.fillStyle = '#ede5cf'; g.fillText(String(Math.ceil(h.deadT)), p.x, p.y + 4);
      return;
    }
    const x = h.x, y = h.y;
    if (selected) {
      g.strokeStyle = '#d6a547'; g.lineWidth = 1.5; g.setLineDash([4, 3]);
      g.beginPath(); g.ellipse(x, y + 7, 16, 7, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      if (h.ordered) {
        g.strokeStyle = '#3a2b0c'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(h.tx, h.ty); g.lineTo(h.tx, h.ty - 16); g.stroke();
        g.fillStyle = '#d6a547';
        g.beginPath(); g.moveTo(h.tx, h.ty - 16); g.lineTo(h.tx + 10, h.ty - 12); g.lineTo(h.tx, h.ty - 8); g.fill();
      }
    }
    // brilho dourado no chão: o herói se destaca no meio da multidão
    const aura = g.createRadialGradient(x, y + 7, 2, x, y + 7, 18);
    aura.addColorStop(0, 'rgba(240,200,110,.4)'); aura.addColorStop(1, 'rgba(240,200,110,0)');
    g.fillStyle = aura; g.beginPath(); g.ellipse(x, y + 7, 18, 8, 0, 0, Math.PI * 2); g.fill();
    if (Math.abs(Math.cos(h.ang)) > 0.3) h.face = Math.cos(h.ang) < 0 ? -1 : 1;
    const art = HERO_LOOK[h.kind] || HERO_LOOK.knight;
    const attack = h.swing > 0 ? 1 - h.swing / 0.2 : 0;
    TD.drawPerson(g, x, y - 2, 10, art.colors, art.look, reducedMotion ? 0 : h.walk * 14, h.face || 1, Math.max(0, attack));
    // vida (só quem segura inimigos) e nível
    const top = y - 26;
    if (h.kind === 'knight') {
      const w = 26, k = Math.max(0, h.hp / h.maxHp);
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - w / 2 - 1, top - 1, w + 2, 5);
      g.fillStyle = k > 0.5 ? '#7fb3e0' : k > 0.25 ? '#d6a547' : '#e0715a';
      g.fillRect(x - w / 2, top, w * k, 3);
    }
    g.fillStyle = '#d6a547'; g.strokeStyle = '#2a1f08'; g.lineWidth = 1;
    circle(g, x + 18, top + 1, 5.5); g.fill(); g.stroke();
    g.fillStyle = '#2a1f08'; g.font = '700 9px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
    g.fillText(String(h.level), x + 18, top + 4.5);
  }

  function drawRange(g, x, y, r, ok) {
    g.fillStyle = ok ? 'rgba(214,165,71,.12)' : 'rgba(224,113,90,.14)';
    g.strokeStyle = ok ? 'rgba(214,165,71,.8)' : 'rgba(224,113,90,.85)';
    g.lineWidth = 1.5;
    g.setLineDash([5, 4]);
    circle(g, x, y, r); g.fill(); g.stroke();
    g.setLineDash([]);
  }

  Object.assign(TD, { rr, circle, mix, buildBg, drawHero, drawRange });
})();
