// Desenho das torres em visão 3/4: construções com altura, fachada iluminada à esquerda, textura e ameias.
// O nível muda o material (1: madeira, 2: pedra, 3: pedra com ouro e bandeirolas) e a altura.
// Base e marcas não mudam de um quadro para outro e ficam guardadas como imagens; só a cabeça é animada.
(() => {
  const TD = window.TD;
  const { rr, circle, mix } = TD;
  const TAU = Math.PI * 2;
  const INK = '#1e1a14';
  const BOT = 9; // linha do chão da torre, em relação ao centro da casa

  const MATS = {
    wood:  { face: '#8a6440', light: '#b48a5c', dark: '#563a22', top: '#6a4c30', line: 'rgba(40,24,10,.5)' },
    stone: { face: '#8f897c', light: '#bdb7a8', dark: '#5a554b', top: '#726c60', line: 'rgba(30,26,20,.38)' },
    rune:  { face: '#4e4466', light: '#7a6c9e', dark: '#272138', top: '#3a3250', line: 'rgba(10,6,20,.5)' },
    rock:  { face: '#6a6258', light: '#8e867a', dark: '#3e3a34', top: '#5a544a', line: 'rgba(20,16,12,.45)' },
  };
  const matOf = (type, level) => (type === 'arcane' ? MATS.rune : level === 1 ? MATS.wood : MATS.stone);
  const PENNANT = { archer: '#c9a45c', cannon: '#9aa0a8', frost: '#8fd3e8', ballista: '#b0743a', arcane: '#9b7be0', barracks: '#b0473b', banner: '#d6a547', cauldron: '#8fd05a', mine: '#e8c56e' };

  // Largura e altura do topo (por nível) de cada torre cilíndrica
  const SHAPE = {
    archer: { w: 20, top: [-14, -18, -22] },
    cannon: { w: 28, top: [-6, -9, -12] },
    frost: { w: 20, top: [-11, -14, -17] },
    arcane: { w: 22, top: [-14, -18, -22] },
  };
  // Onde a cabeça (arma, cristal, bandeira) fica em cada torre
  function headY(type, level) {
    if (SHAPE[type]) return SHAPE[type].top[level - 1] - (type === 'frost' || type === 'arcane' ? 7 : 1);
    if (type === 'ballista') return [-5, -7, -9][level - 1];
    if (type === 'banner') return [-24, -28, -32][level - 1];
    if (type === 'barracks') return -15;
    if (type === 'cauldron') return 0;
    return 0;
  }

  function face(g, mat, x0, x1) {
    const grad = g.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, mat.light); grad.addColorStop(0.35, mat.face); grad.addColorStop(1, mat.dark);
    return grad;
  }

  function shadow(g, rx, ry) {
    g.fillStyle = 'rgba(0,0,0,.32)';
    g.beginPath(); g.ellipse(3, BOT + 1, rx + 3, ry + 2, 0, 0, TAU); g.fill();
  }

  // Corpo cilíndrico: fachada da frente com textura de tijolo ou tábua, topo elíptico e ameias ou estacas
  function cylinder(g, w, top, mat, level, taper = 0) {
    const rx = w / 2, ry = w * 0.24, tx = rx - taper;
    shadow(g, rx, ry);
    const body = () => {
      g.beginPath(); g.moveTo(-tx, top); g.lineTo(-rx, BOT);
      g.ellipse(0, BOT, rx, ry, 0, Math.PI, 0, true);
      g.lineTo(tx, top); g.ellipse(0, top, tx, ry * (tx / rx), 0, 0, Math.PI, false); g.closePath();
    };
    body();
    g.fillStyle = face(g, mat, -rx, rx); g.fill();
    // textura presa à fachada
    g.save(); body(); g.clip();
    g.strokeStyle = mat.line; g.lineWidth = 0.8;
    if (mat === MATS.wood) {
      for (let x = -rx + 3.5; x < rx; x += 3.5) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, BOT + ry); g.stroke(); }
      g.lineWidth = 1.8; g.strokeStyle = 'rgba(40,24,10,.55)';
      for (const y of [top + 3, BOT - 3]) { g.beginPath(); g.ellipse(0, y, rx, ry, 0, 0, Math.PI); g.stroke(); }
    } else {
      let row = 0;
      for (let y = top + 3.5; y < BOT + ry; y += 3.6, row++) {
        g.beginPath(); g.ellipse(0, y, rx, ry, 0, 0, Math.PI); g.stroke();
        for (let x = -rx + (row % 2 ? 2.5 : 5); x < rx; x += 5) {
          const dy = ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
          g.beginPath(); g.moveTo(x, y + dy); g.lineTo(x, y + dy + 3.6); g.stroke();
        }
      }
    }
    // luz rasante na borda esquerda
    g.fillStyle = 'rgba(255,240,200,.12)'; g.fillRect(-rx, top, 2.2, BOT - top + ry);
    g.restore();
    body(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
    // topo
    const try_ = ry * (tx / rx);
    g.beginPath(); g.ellipse(0, top, tx, try_, 0, 0, TAU); g.fillStyle = mat.top; g.fill(); g.stroke();
    g.beginPath(); g.ellipse(0, top + 0.6, tx - 2.4, Math.max(1, try_ - 1.3), 0, 0, TAU); g.fillStyle = mix(mat.top, '#000000', 0.25); g.fill();
    rim(g, tx, try_, top, mat);
    if (level >= 3) {
      g.strokeStyle = '#e0b44a'; g.lineWidth = 1.8;
      g.beginPath(); g.ellipse(0, top + 4, rx - taper * 0.2, ry, 0, 0.1, Math.PI - 0.1); g.stroke();
    }
  }

  // Ameias de pedra ou estacas de madeira na borda da frente
  function rim(g, rx, ry, top, mat) {
    for (let i = 0; i <= 5; i++) {
      const a = 0.12 * Math.PI + i * 0.152 * Math.PI, x = Math.cos(a) * rx, y = top + Math.sin(a) * ry;
      g.fillStyle = x < -rx * 0.3 ? mat.light : x > rx * 0.4 ? mat.dark : mat.face;
      g.strokeStyle = INK; g.lineWidth = 1;
      if (mat === MATS.wood) {
        g.beginPath(); g.moveTo(x - 1.6, y + 1); g.lineTo(x - 1.6, y - 3); g.lineTo(x, y - 5.5); g.lineTo(x + 1.6, y - 3); g.lineTo(x + 1.6, y + 1); g.closePath();
      } else rr(g, x - 1.9, y - 4, 3.8, 4.8, 0.6);
      g.fill(); g.stroke();
    }
  }

  // Bandeirolas laterais do nível 3, na cor da especialização
  function pennants(g, rx, top, color) {
    for (const s of [-1, 1]) {
      const x = s * (rx - 0.5);
      g.strokeStyle = '#2f2b25'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(x, top + 1); g.lineTo(x, top - 11); g.stroke();
      g.fillStyle = color; g.strokeStyle = INK; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, top - 11); g.lineTo(x + s * 7, top - 9); g.lineTo(x, top - 6.5); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e0b44a'; circle(g, x, top - 11.5, 1); g.fill();
    }
  }

  // ---------- Bases de cada tipo ----------
  function arcaneBase(g, level) {
    const top = SHAPE.arcane.top[level - 1];
    cylinder(g, 22, top, MATS.rune, level, 4);
    // janelas de runa que brilham
    for (const [x, y] of [[-3, top + 6], [3.5, top + 10], [-1, BOT - 6]]) {
      g.fillStyle = 'rgba(190,150,255,.35)'; circle(g, x, y, 3.2); g.fill();
      g.fillStyle = '#c7b0ff'; rr(g, x - 1, y - 2, 2, 3.6, 1); g.fill();
    }
  }

  function frostBase(g, level, mat) {
    const top = SHAPE.frost.top[level - 1];
    cylinder(g, 20, top, mat, level);
    // gelo escorrendo da borda e runas azuis
    g.fillStyle = '#e4f6fc'; g.strokeStyle = '#7fbfd8'; g.lineWidth = 0.8;
    for (const x of [-7, -3, 2, 6]) {
      const h = 3 + ((x * 7) % 4 + 4) % 4;
      g.beginPath(); g.moveTo(x - 1.6, top + 2); g.lineTo(x, top + 2 + h); g.lineTo(x + 1.6, top + 2); g.closePath(); g.fill(); g.stroke();
    }
    g.strokeStyle = 'rgba(143,211,232,.85)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-2, BOT - 2); g.lineTo(0, BOT - 7); g.lineTo(2, BOT - 2); g.moveTo(0, BOT - 7); g.lineTo(0, BOT - 10); g.stroke();
  }

  function ballistaBase(g, level, mat) {
    const top = headY('ballista', level) + 1;
    shadow(g, 14, 5);
    // estacas cruzadas sustentando a plataforma
    g.strokeStyle = INK; g.lineWidth = 3.4;
    const posts = [[-11, 1], [11, 1], [-7, 6], [7, 6]];
    for (const [x, y] of posts) { g.beginPath(); g.moveTo(x, top + 2); g.lineTo(x, BOT + y - 3); g.stroke(); }
    g.strokeStyle = level === 1 ? '#7a5634' : '#8a8478'; g.lineWidth = 2;
    for (const [x, y] of posts) { g.beginPath(); g.moveTo(x, top + 2); g.lineTo(x, BOT + y - 3); g.stroke(); }
    g.strokeStyle = 'rgba(60,40,20,.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-11, top + 3); g.lineTo(-7, BOT + 3); g.moveTo(11, top + 3); g.lineTo(7, BOT + 3); g.stroke();
    // plataforma de tábuas
    g.beginPath(); g.ellipse(0, top, 15, 6.5, 0, 0, TAU);
    g.fillStyle = face(g, mat, -15, 15); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
    g.save(); g.beginPath(); g.ellipse(0, top, 15, 6.5, 0, 0, TAU); g.clip();
    g.strokeStyle = mat.line; g.lineWidth = 0.8;
    for (let x = -12; x < 15; x += 3.4) { g.beginPath(); g.moveTo(x, top - 7); g.lineTo(x + 2, top + 7); g.stroke(); }
    g.restore();
    if (level >= 3) { g.strokeStyle = '#e0b44a'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, top, 15, 6.5, 0, 0.15, Math.PI - 0.15); g.stroke(); }
  }

  function barracksBase(g, level, mat, specColor) {
    shadow(g, 15, 5);
    // paredes
    const wallTop = -4;
    g.beginPath(); g.rect(-13, wallTop, 26, BOT - wallTop + 2);
    g.fillStyle = face(g, mat, -13, 13); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
    g.save(); g.beginPath(); g.rect(-13, wallTop, 26, BOT - wallTop + 2); g.clip();
    g.strokeStyle = mat.line; g.lineWidth = 0.8;
    if (mat === MATS.wood) for (let x = -10; x < 13; x += 3.4) { g.beginPath(); g.moveTo(x, wallTop); g.lineTo(x, BOT + 2); g.stroke(); }
    else for (let y = wallTop + 3; y < BOT + 2; y += 3.4) { g.beginPath(); g.moveTo(-13, y); g.lineTo(13, y); g.stroke(); }
    g.restore();
    // telhado em duas águas
    const roof = level === 1 ? ['#b08a4a', '#7a5a2a'] : ['#a8452e', '#6e2a1a'];
    g.beginPath(); g.moveTo(-16, wallTop + 1); g.lineTo(-11, -15); g.lineTo(11, -15); g.lineTo(16, wallTop + 1); g.closePath();
    const rg = g.createLinearGradient(0, -15, 0, wallTop); rg.addColorStop(0, roof[0]); rg.addColorStop(1, roof[1]);
    g.fillStyle = rg; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.8;
    for (let y = -12; y < wallTop; y += 3) { g.beginPath(); g.moveTo(-15 + (y + 15) * 0.1, y); g.lineTo(15 - (y + 15) * 0.1, y); g.stroke(); }
    if (level >= 3) { g.strokeStyle = '#e0b44a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-11, -15); g.lineTo(11, -15); g.stroke(); }
    // porta em arco e escudo
    g.fillStyle = '#2a1d12'; g.beginPath(); g.moveTo(-3.5, BOT + 2); g.lineTo(-3.5, 3); g.arc(0, 3, 3.5, Math.PI, 0); g.lineTo(3.5, BOT + 2); g.closePath(); g.fill();
    g.fillStyle = specColor || '#b0473b'; g.strokeStyle = '#d6a547'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(6, 0); g.lineTo(11, 0); g.lineTo(11, 4); g.lineTo(8.5, 6.5); g.lineTo(6, 4); g.closePath(); g.fill(); g.stroke();
  }

  function bannerBase(g, level, mat) {
    shadow(g, 8, 3.5);
    g.beginPath(); g.ellipse(0, BOT, 8, 3.4, 0, 0, TAU);
    rr(g, -8, 2, 16, BOT - 2, 2);
    g.fillStyle = face(g, mat, -8, 8); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.ellipse(0, 2, 8, 3, 0, 0, TAU); g.fillStyle = mat.top; g.fill(); g.stroke();
    const top = headY('banner', level);
    g.strokeStyle = INK; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-3, 2); g.lineTo(-3, top); g.stroke();
    g.strokeStyle = '#6e4e2a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-3, 2); g.lineTo(-3, top); g.stroke();
    g.fillStyle = level >= 3 ? '#e0b44a' : '#a8a296'; circle(g, -3, top - 1.5, 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
  }

  function cauldronBase(g, level, mat) {
    shadow(g, 13, 5);
    if (level >= 2) {
      // fogareiro de pedra
      g.beginPath(); g.ellipse(0, BOT - 1, 13, 5.5, 0, 0, TAU);
      g.fillStyle = face(g, MATS.stone, -13, 13); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    }
    // brasas e lenha
    const glow = g.createRadialGradient(0, 6, 1, 0, 6, 11);
    glow.addColorStop(0, 'rgba(255,190,90,.95)'); glow.addColorStop(0.5, 'rgba(240,110,40,.55)'); glow.addColorStop(1, 'rgba(240,110,40,0)');
    g.fillStyle = glow; g.beginPath(); g.ellipse(0, 6, 11, 5, 0, 0, TAU); g.fill();
    g.strokeStyle = INK; g.lineWidth = 3.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-8, 9); g.lineTo(6, 4); g.moveTo(8, 9); g.lineTo(-6, 4); g.stroke();
    g.strokeStyle = '#7a5634'; g.lineWidth = 2.2; g.stroke(); g.lineCap = 'butt';
    // pedras em roda
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, x = Math.cos(a) * 11, y = 6 + Math.sin(a) * 4.6;
      g.beginPath(); g.ellipse(x, y, 2.6, 1.9, a, 0, TAU);
      g.fillStyle = x < 0 ? '#9a948a' : '#6a655c'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    }
    if (level >= 3) { g.strokeStyle = '#e0b44a'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(0, BOT - 1, 13.5, 5.8, 0, 0.1, Math.PI - 0.1); g.stroke(); }
  }

  function mineBase(g, level) {
    shadow(g, 16, 5);
    // morro de pedra
    g.beginPath(); g.moveTo(-16, BOT + 1); g.lineTo(-13, -2); g.lineTo(-8, -9); g.lineTo(-1, -13); g.lineTo(6, -10); g.lineTo(12, -4); g.lineTo(16, BOT + 1); g.closePath();
    g.fillStyle = face(g, MATS.rock, -16, 16); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-8, -9); g.lineTo(-6, -2); g.moveTo(6, -10); g.lineTo(9, -1); g.stroke();
    // veios de ouro (mais no nível 3)
    g.fillStyle = '#f0c75a';
    for (const [x, y] of level >= 3 ? [[-10, 0], [-4, -8], [10, -2], [12, 4], [-12, 5]] : [[-10, 1], [10, -1]]) { circle(g, x, y, 1.1); g.fill(); }
    // entrada escorada
    g.fillStyle = '#100c08'; g.beginPath(); g.moveTo(-6, BOT + 1); g.lineTo(-6, -1); g.quadraticCurveTo(0, -7, 6, -1); g.lineTo(6, BOT + 1); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(-6.5, BOT + 1); g.lineTo(-6.5, -2); g.moveTo(6.5, BOT + 1); g.lineTo(6.5, -2); g.moveTo(-8, -2.5); g.lineTo(8, -2.5); g.stroke();
    g.strokeStyle = level === 1 ? '#8a6440' : '#a07a4c'; g.lineWidth = 2.2; g.stroke();
    if (level >= 2) { g.fillStyle = '#ffd27a'; circle(g, 8.5, 0, 1.6); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke(); }
    // trilhos saindo da mina
    g.strokeStyle = '#4a4440'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-3.5, BOT + 1); g.lineTo(-5, BOT + 5); g.moveTo(3.5, BOT + 1); g.lineTo(5, BOT + 5); g.stroke();
  }

  function towerBase(g, type, level, specColor) {
    const mat = matOf(type, level);
    if (SHAPE[type] && type !== 'arcane' && type !== 'frost') cylinder(g, SHAPE[type].w, SHAPE[type].top[level - 1], mat, level);
    else if (type === 'arcane') arcaneBase(g, level);
    else if (type === 'frost') frostBase(g, level, mat);
    else if (type === 'ballista') ballistaBase(g, level, mat);
    else if (type === 'barracks') barracksBase(g, level, mat, specColor);
    else if (type === 'banner') bannerBase(g, level, mat);
    else if (type === 'cauldron') cauldronBase(g, level, mat);
    else if (type === 'mine') mineBase(g, level);
    if (level >= 3 && SHAPE[type]) pennants(g, SHAPE[type].w / 2 - (type === 'arcane' ? 4 : 0), SHAPE[type].top[2], specColor || PENNANT[type]);
  }

  // ---------- Cabeças (animadas) ----------
  // time: relógio da animação parada (cristal que flutua, orbe que pulsa); 0 desliga o movimento
  function towerHead(g, type, level, ang, kick, time = 0) {
    g.translate(0, headY(type, level));
    const recoil = -kick * 4;
    if (type === 'archer') {
      // arqueiro de capuz no alto da torre; o arco aponta para o alvo
      const dir = Math.cos(ang) < 0 ? -1 : 1;
      g.fillStyle = '#2e4a2a'; g.strokeStyle = INK; g.lineWidth = 1;
      rr(g, -3.4, -6, 6.8, 6.5, 2.4); g.fill(); g.stroke();
      circle(g, 0, -8.6, 2.7); g.fillStyle = '#e0b08a'; g.fill(); g.stroke();
      g.fillStyle = '#3e6a36'; g.beginPath(); g.arc(0, -8.9, 2.9, Math.PI * 0.95, Math.PI * 2.05); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#1a1410'; circle(g, dir * 1.2, -8.4, 0.5); g.fill();
      g.save(); g.translate(0, -3.5); g.rotate(ang); g.translate(recoil * 0.4, 0);
      g.strokeStyle = '#5a3a1a'; g.lineWidth = 2.6; g.beginPath(); g.arc(2, 0, 6.5, -1.15, 1.15); g.stroke();
      g.strokeStyle = '#e0c178'; g.lineWidth = 1.4; g.stroke();
      const ex = 2 + 6.5 * Math.cos(1.15), ey = 6.5 * Math.sin(1.15), pull = kick > 0.3 ? 0 : 2.5;
      g.strokeStyle = '#efe6cf'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(ex, -ey); g.lineTo(ex - pull, 0); g.lineTo(ex, ey); g.stroke();
      if (pull) { g.strokeStyle = '#8a5a2b'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(ex - pull, 0); g.lineTo(10, 0); g.stroke(); }
      g.restore();
    } else if (type === 'cannon') {
      // canhão de bronze sobre reparo de madeira; o cano gira e recua
      g.fillStyle = '#5a3e24'; g.strokeStyle = INK; g.lineWidth = 1;
      rr(g, -6, -2.5, 12, 5, 1.5); g.fill(); g.stroke();
      g.save(); g.rotate(ang); g.scale(1, 0.88); g.translate(recoil, 0);
      const br = g.createLinearGradient(0, -4, 0, 4);
      br.addColorStop(0, '#d8b06a'); br.addColorStop(0.45, '#9a6e34'); br.addColorStop(1, '#4e3418');
      g.fillStyle = br; rr(g, -4, -3.6, 18, 7.2, 3); g.fill(); g.stroke();
      g.fillStyle = '#3a2810'; for (const x of [2, 9]) g.fillRect(x, -3.8, 1.4, 7.6);
      g.beginPath(); g.ellipse(14, 0, 1.6, 3.6, 0, 0, TAU); g.fillStyle = '#1a120a'; g.fill(); g.stroke();
      g.restore();
      g.fillStyle = '#6a4c30'; circle(g, 0, 0, 3.4); g.fill(); g.stroke();
    } else if (type === 'frost') {
      // três cristais que flutuam sobre um halo de gelo
      const bob = time ? Math.sin(time * 2.4) * 1.5 : 0;
      g.fillStyle = `rgba(143,211,232,${0.25 + 0.1 * Math.sin(time * 2.4)})`; circle(g, 0, 0, 10); g.fill();
      g.translate(0, bob);
      for (const [x, y, s] of [[-4.5, 2, 0.6], [4.5, 2.5, 0.55], [0, 0, 1]]) {
        g.fillStyle = '#bfe9f5'; g.strokeStyle = '#3f8fab'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y - 10 * s); g.lineTo(x + 5 * s, y); g.lineTo(x, y + 6 * s); g.lineTo(x - 5 * s, y); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, y - 7 * s); g.lineTo(x + 1.6 * s, y - 1 * s); g.lineTo(x - 1.6 * s, y); g.closePath(); g.fill();
      }
    } else if (type === 'arcane') {
      // orbe com um anel de runas girando em volta
      const pulse = time ? 0.12 * Math.sin(time * 3.1) : 0, spin = time * 1.6;
      g.fillStyle = `rgba(155,123,224,${0.3 + pulse + kick * 0.5})`; circle(g, 0, 0, 9 + pulse * 10); g.fill();
      g.strokeStyle = 'rgba(199,176,255,.8)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(0, 0, 9, 3, Math.sin(spin) * 0.4, 0, TAU); g.stroke();
      g.fillStyle = '#c7b0ff'; g.strokeStyle = INK; g.lineWidth = 1; circle(g, 0, 0, 4.6); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; circle(g, -1.4, -1.5, 1.4); g.fill();
      g.fillStyle = '#e8dcff';
      for (let i = 0; i < 3; i++) { const a = spin + i * 2.1; circle(g, Math.cos(a) * 9, Math.sin(a) * 3, 1.1); g.fill(); }
    } else if (type === 'ballista') {
      g.save(); g.rotate(ang); g.scale(1, 0.9); g.translate(recoil, 0);
      g.strokeStyle = INK; g.lineWidth = 3.6; g.beginPath(); g.arc(-4, 0, 11, -1.2, 1.2); g.stroke();
      g.strokeStyle = '#8a5a2e'; g.lineWidth = 2.2; g.stroke();
      g.fillStyle = '#b8bcc0'; for (const s of [-1, 1]) { circle(g, -4 + 11 * Math.cos(1.2), s * 11 * Math.sin(1.2), 1.4); g.fill(); }
      g.fillStyle = '#5e3c1d'; g.strokeStyle = INK; g.lineWidth = 1; rr(g, -10, -2.4, 19, 4.8, 1.5); g.fill(); g.stroke();
      g.strokeStyle = '#efe6cf'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(-4 + 11 * Math.cos(1.2), -11 * Math.sin(1.2)); g.lineTo(-6, 0); g.lineTo(-4 + 11 * Math.cos(1.2), 11 * Math.sin(1.2)); g.stroke();
      g.strokeStyle = '#d8d2c4'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, 0); g.lineTo(13, 0); g.stroke();
      g.fillStyle = '#e8e4da'; g.beginPath(); g.moveTo(16, 0); g.lineTo(12, -2.2); g.lineTo(12, 2.2); g.closePath(); g.fill();
      g.restore();
    } else if (type === 'barracks') {
      // bandeirola no alto do telhado
      const wave = time ? Math.sin(time * 4) * 1.2 : 0;
      g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -9); g.stroke();
      g.fillStyle = '#b0473b'; g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(4, -9 + wave, 8, -7.5); g.lineTo(0, -5); g.closePath(); g.fill();
    } else if (type === 'banner') {
      // flâmula grande com emblema dourado, tremulando
      const wave = time ? Math.sin(time * 4) * 1.8 : 0;
      g.fillStyle = '#b8432f'; g.strokeStyle = INK; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-2, -1); g.quadraticCurveTo(5, -1 + wave, 13, 1); g.lineTo(13, 13); g.lineTo(9, 10 - wave * 0.5); g.lineTo(5, 13);
      g.quadraticCurveTo(2, 11 - wave, -2, 12); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-2, 0, 3, 11);
      g.fillStyle = '#e0b44a'; g.beginPath(); g.moveTo(5.5, 2.5); g.lineTo(8, 5.5); g.lineTo(5.5, 8.5); g.lineTo(3, 5.5); g.closePath(); g.fill();
    } else if (type === 'cauldron') {
      // caldeirão de ferro com ácido borbulhando; balança ao arremessar
      g.rotate(kick * 0.25);
      g.fillStyle = '#2b2b2e'; g.strokeStyle = INK; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(0, 0, 10, 8.5, 0, 0, Math.PI); g.lineTo(-10, -3); g.lineTo(10, -3); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(-5, 2, 2.2, 4, 0.3, 0, TAU); g.fill();
      g.fillStyle = '#7fc84a'; g.beginPath(); g.ellipse(0, -3, 10, 3.4, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#b8f07a'; g.beginPath(); g.ellipse(-2, -3.6, 5, 1.4, 0, 0, TAU); g.fill();
      const bub = time ? (time * 1.8) % 1 : 0.5;
      g.fillStyle = '#d8ffa8';
      circle(g, -4, -4 - bub * 6, 1.6 * (1 - bub) + 0.4); g.fill();
      circle(g, 3.5, -3.5 - ((bub + 0.5) % 1) * 7, 1.3); g.fill();
      g.strokeStyle = '#5a5a60'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-10.5, -3); g.lineTo(-12.5, 2.5); g.moveTo(10.5, -3); g.lineTo(12.5, 2.5); g.stroke();
    } else if (type === 'mine') {
      // carrinho cheio de ouro na boca da mina, com um brilho que pisca
      g.fillStyle = '#4a4a50'; g.strokeStyle = INK; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-5.5, 4); g.lineTo(5.5, 4); g.lineTo(4.5, 9); g.lineTo(-4.5, 9); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e8c56e'; for (const [x, y] of [[-3, 3.5], [0, 2.6], [3, 3.5], [-1.5, 1.6], [1.5, 1.8]]) { circle(g, x, y, 1.9); g.fill(); g.stroke(); }
      g.fillStyle = '#1a1a1e'; circle(g, -3, 9.5, 1.3); g.fill(); circle(g, 3, 9.5, 1.3); g.fill();
      const shine = time ? Math.max(0, Math.sin(time * 3)) : 0.5;
      g.fillStyle = `rgba(255,250,210,${0.3 + 0.7 * shine})`;
      g.beginPath(); g.moveTo(1, -1.5); g.lineTo(1.6, 1.4); g.lineTo(1, 4.3); g.lineTo(0.4, 1.4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-1.6, 1.4); g.lineTo(1, 0.8); g.lineTo(3.6, 1.4); g.lineTo(1, 2); g.closePath(); g.fill();
    }
  }

  // Pontos de nível na base e gema da especialização no alto
  function towerMarks(g, type, level, specColor) {
    for (let i = 0; i < level; i++) {
      g.fillStyle = '#e0b44a'; g.strokeStyle = '#3a2b0c'; g.lineWidth = 1;
      circle(g, (i - (level - 1) / 2) * 6, 14, 2.1); g.fill(); g.stroke();
    }
    if (specColor) {
      const y = SHAPE[type] ? SHAPE[type].top[level - 1] + 6 : -6, x = SHAPE[type] ? SHAPE[type].w / 2 - 1 : 12;
      g.fillStyle = specColor; g.strokeStyle = '#2a1f08'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(x, y - 3.5); g.lineTo(x + 1.6, y - 0.5); g.lineTo(x - 1, y - 0.5); g.closePath(); g.fill();
    }
  }

  function drawTower(g, type, x, y, level, ang, sc = 1, specColor = null, kick = 0) {
    g.save();
    g.translate(x, y); g.scale(sc, sc);
    towerBase(g, type, level, specColor);
    g.save(); towerHead(g, type, level, ang, kick); g.restore();
    towerMarks(g, type, level, specColor);
    g.restore();
  }

  // No campo, base e marcas ficam guardadas como imagens por tipo, nível, especialização e densidade da tela,
  // e só a cabeça é desenhada a cada quadro. A caixa cobre da bandeirola mais alta à sombra.
  const SPRITE = { x: 26, y: 50, w: 52, h: 78 };
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
    towerHead(g, type, level, ang, kick, time ? time + (x + y) * 0.013 : 0);
    g.restore();
    g.drawImage(sprite('marks|' + key, dpr, s => towerMarks(s, type, level, specColor)), bx, by, SPRITE.w, SPRITE.h);
  }

  Object.assign(TD, { drawTower, drawTowerCached, towerHeadY: headY });
})();
