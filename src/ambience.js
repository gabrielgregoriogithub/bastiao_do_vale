// Atmosfera de cada campo: partículas de ambiente e reflexo na água, desenhadas sobre o mapa.
// Puramente visual; não afeta a simulação. Desligada para quem pede menos movimento.
(() => {
  const TD = window.TD;
  const { T, W, H } = TD;

  // Cada campo tem um clima: quantas partículas, como nascem e como se movem
  const KINDS = {
    vale: { count: 22, spawn: r => ({ x: r() * W, y: r() * H, vx: 4 + r() * 6, vy: -6 - r() * 6, size: 1 + r() * 1.1, phase: r() * 6 }), color: 'rgba(250,240,190,A)' },
    rio: { count: 10, spawn: r => ({ x: r() * W, y: r() * H, vx: 6 + r() * 6, vy: 0, size: 30 + r() * 30, phase: r() * 6 }), color: 'rgba(225,235,240,A)', mist: true },
    serpente: { count: 18, spawn: r => ({ x: r() * W, y: r() * H, vx: 120 + r() * 80, vy: 6, size: 14 + r() * 18, phase: r() * 6 }), color: 'rgba(236,210,150,A)', streak: true },
    encruzilhada: { count: 40, spawn: r => ({ x: r() * W, y: -10 - r() * H, vx: 8 + r() * 10, vy: 22 + r() * 18, size: 1.2 + r() * 1.4, phase: r() * 6 }), color: 'rgba(255,255,255,A)' },
    pantano: { count: 22, spawn: r => ({ x: r() * W, y: r() * H, vx: 0, vy: 0, size: 1.6 + r() * 1, phase: r() * 6 }), color: 'rgba(200,240,120,A)', firefly: true },
    costa: { count: 12, spawn: r => ({ x: r() * W, y: r() * H, vx: 10 + r() * 8, vy: 0, size: 30 + r() * 30, phase: r() * 6 }), color: 'rgba(240,248,250,A)', mist: true },
    cemiterio: { count: 16, spawn: r => ({ x: r() * W, y: r() * H, vx: 5 + r() * 6, vy: 0, size: 40 + r() * 40, phase: r() * 6 }), color: 'rgba(200,210,220,A)', mist: true },
    vulcao: { count: 30, spawn: r => ({ x: r() * W, y: r() * H, vx: 4 + r() * 8, vy: -14 - r() * 18, size: 1 + r() * 1.3, phase: r() * 6 }), color: 'rgba(255,150,60,A)' },
  };

  let mapId = null, parts = [];
  const rnd = Math.random;

  function reset(id) {
    mapId = id;
    const k = KINDS[id];
    parts = k ? Array.from({ length: k.count }, () => k.spawn(rnd)) : [];
  }

  function wrap(p, k) {
    if (p.x > W + 40) p.x = -40;
    if (p.x < -40) p.x = W + 40;
    if (p.y < -40) p.y = H + 20;
    if (p.y > H + 40) Object.assign(p, k.spawn(rnd), { y: -10 });
  }

  function drawWater(g, md, time) {
    g.strokeStyle = md.map.lava ? 'rgba(255,220,120,.5)' : 'rgba(200,230,245,.35)';
    g.lineWidth = 1.2;
    for (const [c, r] of md.map.water) {
      if (md.blocked[r] && md.blocked[r][c] === 1) continue;
      const k = (time * 0.6 + c * 0.37 + r * 0.53) % 1;
      const x = c * T + 6 + k * (T - 12), y = r * T + 8 + ((c * 7 + r * 13) % 22);
      g.beginPath(); g.moveTo(x - 5, y); g.quadraticCurveTo(x, y - 3, x + 5, y); g.stroke();
    }
  }

  // ---------- Floresta amazônica: bichos fora da trilha, raios de sol e folhagem na borda ----------
  const BIRDS = {
    arara: { body: '#d8322a', wing: '#d8322a', band: '#f0c030', tip: '#2a6ad0', tail: '#d8322a', beak: '#efe6d6', size: 1 },
    araraAzul: { body: '#2a7ad0', wing: '#2a7ad0', band: '#2a7ad0', tip: '#1a3a8a', tail: '#2a6ad0', beak: '#2a2a2a', belly: '#f0c030', size: 1 },
    tucano: { body: '#1a1a1e', wing: '#1a1a1e', band: '#1a1a1e', tip: '#1a1a1e', tail: '#1a1a1e', beak: '#f08a2a', throat: '#f4f0e0', size: 1.1, toucan: true },
  };
  let birds = [], birdT = 2, flies = [], monkeys = [];

  function resetFauna(md) {
    birds = []; birdT = 1.5;
    flies = Array.from({ length: 6 }, (_, i) => ({ x: rnd() * W, y: rnd() * H, vx: 0, vy: 0, phase: rnd() * 6, color: i % 3 ? '#3a8af0' : '#f08a2a' }));
    // macacos pendurados em duas árvores do cenário
    const trees = md.map.props || [];
    monkeys = [trees[3], trees[Math.floor(trees.length / 2) + 2]].filter(Boolean).map(([c, r], i) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T - 8, phase: i * 2 }));
  }

  function spawnFlock() {
    const kinds = ['arara', 'arara', 'araraAzul', 'tucano'];
    const kind = kinds[Math.floor(rnd() * kinds.length)], dir = rnd() < 0.5 ? 1 : -1;
    const n = kind === 'tucano' ? 1 : 2 + Math.floor(rnd() * 2), y = 30 + rnd() * (H - 60);
    for (let i = 0; i < n; i++) {
      birds.push({ kind, dir, x: dir > 0 ? -30 - i * 26 : W + 30 + i * 26, y: y + (i % 2 ? 14 : -6) * i * 0.6, base: y, vx: dir * (85 + rnd() * 30), phase: rnd() * 6 });
    }
    TD.audio.play('chirp');
  }

  function drawBird(g, b) {
    const s = BIRDS[b.kind], flap = Math.sin(b.phase * 11), k = s.size;
    g.save(); g.translate(b.x, b.y); g.scale(b.dir * k, k);
    g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(4, 26, 7, 2, 0, 0, Math.PI * 2); g.fill();
    g.lineJoin = 'round'; g.strokeStyle = '#1a1410'; g.lineWidth = 0.8;
    // cauda longa (arara) ou curta (tucano)
    g.fillStyle = s.tail;
    g.beginPath(); g.moveTo(-4, 0); g.lineTo(s.toucan ? -10 : -17, s.toucan ? 1 : 3); g.lineTo(s.toucan ? -9 : -16, 4.5); g.lineTo(-4, 2); g.closePath(); g.fill(); g.stroke();
    // asa de trás, corpo, asa da frente
    const wing = (dy, alpha) => {
      g.globalAlpha = alpha;
      g.fillStyle = s.wing; g.beginPath(); g.moveTo(-3, 0); g.quadraticCurveTo(-1, -6 * dy, 3, -11 * dy); g.lineTo(5, -1); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = s.band; g.beginPath(); g.moveTo(-1.5, -3 * dy); g.lineTo(1.8, -8 * dy); g.lineTo(3.4, -2 * dy); g.closePath(); g.fill();
      g.fillStyle = s.tip; g.beginPath(); g.moveTo(1.8, -8 * dy); g.lineTo(3, -11 * dy); g.lineTo(4, -4 * dy); g.closePath(); g.fill();
      g.globalAlpha = 1;
    };
    wing(-flap * 0.6, 0.8);
    g.fillStyle = s.body; g.beginPath(); g.ellipse(0, 0.5, 6, 3.2, -0.1, 0, Math.PI * 2); g.fill(); g.stroke();
    if (s.belly) { g.fillStyle = s.belly; g.beginPath(); g.ellipse(0.5, 2, 4, 1.4, 0, 0, Math.PI * 2); g.fill(); }
    if (s.throat) { g.fillStyle = s.throat; g.beginPath(); g.ellipse(5, 0.5, 2, 2.2, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = s.body; TD.circle(g, 6, -1.5, 2.6); g.fill(); g.stroke();
    if (!s.toucan) { g.fillStyle = '#f4f0e8'; TD.circle(g, 6.8, -1.5, 1.3); g.fill(); }
    g.fillStyle = '#1a1410'; TD.circle(g, 7, -2, 0.6); g.fill();
    g.fillStyle = s.beak;
    if (s.toucan) { g.beginPath(); g.moveTo(8, -3); g.quadraticCurveTo(15, -3.5, 16, -1); g.quadraticCurveTo(12, 0, 8, -0.3); g.closePath(); g.fill(); g.stroke(); }
    else { g.beginPath(); g.moveTo(8.2, -2.6); g.quadraticCurveTo(11, -2.6, 10.4, 0.6); g.lineTo(8.2, -0.4); g.closePath(); g.fill(); g.stroke(); }
    wing(flap, 1);
    g.restore();
  }

  // Borboleta-azul (morpho) ou laranja: asas que abrem e fecham, voo errante
  function drawFly(g, f) {
    const open = Math.abs(Math.sin(f.phase * 9));
    g.fillStyle = f.color;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(f.x + s * 2.2 * open, f.y, 2.6 * open + 0.4, 2, s * 0.4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#1a1410'; g.fillRect(f.x - 0.4, f.y - 1.5, 0.8, 3);
  }

  // Macaco-prego pendurado pelo rabo, balançando
  function drawMonkey(g, m, time) {
    const a = Math.sin(time * 1.6 + m.phase) * 0.45, len = 12;
    const bx = m.x + Math.sin(a) * len, by = m.y + Math.cos(a) * len;
    g.strokeStyle = '#4a3020'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(m.x, m.y); g.quadraticCurveTo(m.x + 4, m.y + 3, bx, by - 3); g.stroke();
    g.fillStyle = '#5a3a22'; g.strokeStyle = '#1a1008'; g.lineWidth = 0.8;
    g.beginPath(); g.ellipse(bx, by, 3.2, 4.2, a, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#5a3a22'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(bx - 2, by); g.lineTo(bx - 4 - Math.sin(time * 3) * 1.5, by + 4); g.moveTo(bx + 2, by); g.lineTo(bx + 4, by + 3); g.stroke();
    g.fillStyle = '#5a3a22'; TD.circle(g, bx, by + 5, 2.8); g.fill(); g.strokeStyle = '#1a1008'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = '#e8c8a0'; TD.circle(g, bx, by + 5.6, 1.7); g.fill();
    g.fillStyle = '#1a1008'; TD.circle(g, bx - 0.7, by + 5.2, 0.4); g.fill(); TD.circle(g, bx + 0.7, by + 5.2, 0.4); g.fill();
    g.lineCap = 'butt';
  }

  // Raios de sol atravessando a copa (só de dia) e folhas penduradas nas bordas, em primeiro plano
  const LEAVES = [[40, -4, 0.5], [130, -6, 0.9], [300, -5, 0.3], [470, -6, 1.2], [610, -4, 0.7], [760, -6, 1], [20, H + 4, 3.6], [260, H + 6, 3.3], [560, H + 5, 3], [790, H + 4, 3.5]];
  function drawCanopy(g, time) {
    const day = 1 - Math.min(1, (TD.lighting?.darkness() || 0) * 4);
    if (day > 0.05) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = 120 + i * 260 + Math.sin(time * 0.2 + i) * 30, a = (0.05 + 0.025 * Math.sin(time * 0.7 + i * 2)) * day;
        g.fillStyle = `rgba(255,240,180,${a.toFixed(3)})`;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 50, 0); g.lineTo(x + 230, H); g.lineTo(x + 120, H); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    for (const [x, y, rot] of LEAVES) {
      const sway = Math.sin(time * 1.2 + x) * 0.08;
      g.save(); g.translate(x, y); g.rotate(rot + sway);
      for (let k = -1; k <= 1; k++) {
        g.fillStyle = k ? '#1c4a1c' : '#2a6a26';
        g.beginPath(); g.ellipse(k * 7, 14, 5, 16, k * 0.35, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(120,180,90,.5)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(k * 7 - k * 2, 0); g.lineTo(k * 7 + k * 3, 28); g.stroke();
      }
      g.restore();
    }
  }

  function drawFauna(g, md, dt, time) {
    if (md !== faunaFor) { resetFauna(md); faunaFor = md; }
    birdT -= dt;
    if (birdT <= 0) { spawnFlock(); birdT = 6 + rnd() * 7; }
    for (const b of birds) { b.x += b.vx * dt; b.phase += dt; b.y = b.base + Math.sin(b.phase * 1.5) * 8; }
    birds = birds.filter(b => b.x > -80 && b.x < W + 80);
    for (const f of flies) {
      f.vx += (rnd() - 0.5) * 60 * dt; f.vy += (rnd() - 0.5) * 60 * dt;
      f.vx *= 0.97; f.vy *= 0.97; f.x += f.vx * dt; f.y += f.vy * dt; f.phase += dt;
      if (f.x < 0 || f.x > W) f.vx = -f.vx; if (f.y < 0 || f.y > H) f.vy = -f.vy;
      drawFly(g, f);
    }
    for (const m of monkeys) drawMonkey(g, m, time);
    drawCanopy(g, time);
    for (const b of birds) drawBird(g, b);
  }
  let faunaFor = null;

  // Luzes do clima para a noite (lighting.js): vaga-lumes e brasas brilham no escuro
  function lights() {
    const k = KINDS[mapId];
    if (!k || !(k.firefly || mapId === 'vulcao')) return [];
    return parts.map(p => [p.x, p.y, k.firefly ? 16 : 10, k.firefly ? '#c8f078' : '#ff9a3c']);
  }

  function draw(g, md, dt, time, reducedMotion) {
    if (!md || reducedMotion) return;
    if (md.map.id !== mapId) reset(md.map.id);
    drawWater(g, md, time);
    if (md.map.theme === 'amazonia') drawFauna(g, md, dt, time);
    const k = KINDS[mapId];
    if (!k) return;
    for (const p of parts) {
      if (k.firefly) {
        p.vx += (rnd() - 0.5) * 40 * dt; p.vy += (rnd() - 0.5) * 40 * dt;
        p.vx *= 0.97; p.vy *= 0.97;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.phase += dt;
      wrap(p, k);
      const a = k.firefly ? 0.35 + 0.65 * Math.max(0, Math.sin(p.phase * 2.2)) : k.mist ? 0.07 : k.streak ? 0.22 : 0.55 + 0.3 * Math.sin(p.phase * 3);
      g.fillStyle = k.color.replace('A', a.toFixed(2));
      g.strokeStyle = g.fillStyle;
      if (k.mist) {
        g.beginPath(); g.ellipse(p.x, p.y, p.size * 1.8, p.size * 0.6, 0, 0, Math.PI * 2); g.fill();
      } else if (k.streak) {
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.size, p.y - 1); g.stroke();
      } else {
        if (k.firefly) { g.globalAlpha = 0.35; TD.circle(g, p.x, p.y, p.size * 3); g.fill(); g.globalAlpha = 1; }
        TD.circle(g, p.x, p.y, p.size); g.fill();
      }
    }
    // o pântano é mais escuro e úmido; o vulcão, quente
    if (mapId === 'pantano' || mapId === 'cemiterio') {
      g.fillStyle = 'rgba(10,20,15,.12)';
      g.fillRect(0, 0, W, H);
    } else if (mapId === 'vulcao') {
      g.fillStyle = `rgba(255,90,30,${(0.05 + 0.02 * Math.sin(time * 1.3)).toFixed(3)})`;
      g.fillRect(0, 0, W, H);
    }
  }

  TD.ambience = { draw, lights };
})();
