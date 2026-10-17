// Atmosfera de cada campo: partículas de ambiente e reflexo na água, desenhadas sobre o mapa.
// Puramente visual; não afeta a simulação. Desligada para quem pede menos movimento.
(() => {
  const TD = window.TD;
  const { T, W, H } = TD;

  // Cada campo tem um clima: quantas partículas, como nascem e como se movem
  const KINDS = {
    vale: { count: 26, spawn: r => ({ x: r() * W, y: r() * H, vx: 4 + r() * 6, vy: -6 - r() * 6, size: 1.2 + r() * 1.2, phase: r() * 6 }), color: 'rgba(250,240,190,A)' },
    rio: { count: 10, spawn: r => ({ x: r() * W, y: r() * H, vx: 6 + r() * 6, vy: 0, size: 30 + r() * 30, phase: r() * 6 }), color: 'rgba(225,235,240,A)', mist: true },
    serpente: { count: 22, spawn: r => ({ x: r() * W, y: -10 - r() * H, vx: 14 + r() * 10, vy: 18 + r() * 14, size: 2.5 + r() * 1.5, phase: r() * 6 }), color: 'rgba(214,130,54,A)', leaf: true },
    encruzilhada: { count: 18, spawn: r => ({ x: r() * W, y: r() * H, vx: 120 + r() * 80, vy: 6, size: 14 + r() * 18, phase: r() * 6 }), color: 'rgba(236,226,200,A)', streak: true },
    pantano: { count: 22, spawn: r => ({ x: r() * W, y: r() * H, vx: 0, vy: 0, size: 1.6 + r() * 1, phase: r() * 6 }), color: 'rgba(200,240,120,A)', firefly: true },
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
    g.strokeStyle = 'rgba(200,230,245,.35)';
    g.lineWidth = 1.2;
    for (const [c, r] of md.map.water) {
      if (md.blocked[r] && md.blocked[r][c] === 1) continue;
      const k = (time * 0.6 + c * 0.37 + r * 0.53) % 1;
      const x = c * T + 6 + k * (T - 12), y = r * T + 8 + ((c * 7 + r * 13) % 22);
      g.beginPath(); g.moveTo(x - 5, y); g.quadraticCurveTo(x, y - 3, x + 5, y); g.stroke();
    }
  }

  function draw(g, md, dt, time, reducedMotion) {
    if (!md || reducedMotion) return;
    if (md.map.id !== mapId) reset(md.map.id);
    drawWater(g, md, time);
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
      } else if (k.leaf) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.phase * 2);
        g.beginPath(); g.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      } else if (k.streak) {
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.size, p.y - 1); g.stroke();
      } else {
        if (k.firefly) { g.globalAlpha = 0.35; TD.circle(g, p.x, p.y, p.size * 3); g.fill(); g.globalAlpha = 1; }
        TD.circle(g, p.x, p.y, p.size); g.fill();
      }
    }
    // o pântano é mais escuro e úmido
    if (mapId === 'pantano') {
      g.fillStyle = 'rgba(10,20,15,.12)';
      g.fillRect(0, 0, W, H);
    }
  }

  TD.ambience = { draw };
})();
