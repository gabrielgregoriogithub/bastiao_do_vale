// Tropas do Quartel: cada quartel mantém soldados num ponto da estrada (o posto).
// Cada soldado segura um inimigo terrestre por vez, como o Cavaleiro, e apanha dele.
// Quando cai, volta pelo quartel depois de alguns segundos. Não alcançam voadores.
(() => {
  const TD = window.TD;
  const { T, TOWERS } = TD;
  const G = TD.game;
  const sfx = TD.audio;
  const SPEED = 1.8 * T, MELEE = 0.7 * T, LEASH = 1.4 * T, ARRIVE = 3, SPREAD = 11;
  const RALLY_MUL = 0.66;

  // Ponto da estrada mais próximo do quartel dentro do alcance dele; sem estrada perto, o próprio quartel
  function rallyPoint(t) {
    let best = null, bestD = Infinity;
    for (const p of G.md.paths) {
      for (let d = 0; d < p.len; d += 8) {
        const q = p.posAt(d), dd = Math.hypot(q.x - t.x, q.y - t.y);
        if (dd < bestD && dd <= t.s.range) { best = q; bestD = dd; }
      }
    }
    return best || { x: t.x, y: t.y };
  }

  // Os soldados ficam em volta do posto, um pouco afastados entre si
  function homeFor(t, i, n) {
    if (n <= 1) return t.rally;
    const a = (i / n) * Math.PI * 2 + 0.6;
    return { x: t.rally.x + Math.cos(a) * SPREAD, y: t.rally.y + Math.sin(a) * SPREAD };
  }

  const makeUnit = t => ({ x: t.x, y: t.y, hp: t.s.unitHp, deadT: 0, target: null, cd: 0, ang: 0, swing: 0, walk: 0 });

  function attach(t) {
    t.rally = rallyPoint(t);
    t.units = Array.from({ length: t.s.units }, () => makeUnit(t));
  }

  // Depois de melhorar ou especializar: ajusta a quantidade e cura quem está de pé
  function refresh(t) {
    t.rally = rallyPoint(t);
    const units = (t.units || []).slice(0, t.s.units);
    while (units.length < t.s.units) units.push(makeUnit(t));
    for (const u of units) if (u.deadT <= 0) u.hp = t.s.unitHp;
    t.units = units;
  }

  function step(u, x, y, dt) {
    const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy), s = SPEED * dt;
    if (d <= Math.max(s, ARRIVE)) { u.x = x; u.y = y; return; }
    u.x += dx / d * s; u.y += dy / d * s;
    u.ang = Math.atan2(dy, dx);
    u.walk += dt;
  }

  // Prefere um inimigo que nenhum outro soldado já está segurando
  function pick(home, engaged) {
    let free = null, freeD = Infinity, any = null, anyD = Infinity;
    for (const e of G.S.enemies) {
      if (e.dead || e.d.flying || e.under) continue;
      const d = Math.hypot(e.x - home.x, e.y - home.y);
      if (d > LEASH) continue;
      if (!engaged.has(e) && d < freeD) { free = e; freeD = d; }
      if (d < anyD) { any = e; anyD = d; }
    }
    return free || any;
  }

  function fight(t, u, e, dt) {
    const S = G.S;
    if (Math.hypot(e.x - u.x, e.y - u.y) > MELEE) { step(u, e.x, e.y, dt); return; }
    e.blocked = true;
    u.ang = Math.atan2(e.y - u.y, e.x - u.x);
    if (u.cd <= 0) {
      G.hurt(e, t.s.dmg, t.s.pierce, t);
      u.cd = t.s.rate * (S.rallyT > 0 ? RALLY_MUL : 1);
      u.swing = 0.18;
      sfx.play('hit');
    }
    u.hp -= (e.d.atk || 0) * (1 + S.wave * 0.05) * S.diff.hp * (1 - t.s.unitArmor) * dt;
  }

  function updateUnit(t, u, home, engaged, dt) {
    u.cd = Math.max(0, u.cd - dt);
    u.swing = Math.max(0, u.swing - dt);
    if (u.deadT > 0) {
      u.deadT -= dt;
      if (u.deadT <= 0) Object.assign(u, { hp: t.s.unitHp, x: t.x, y: t.y, target: null });
      return;
    }
    if (t.stunT > 0) return; // quartel em chamas: os soldados recuam e esperam
    if (u.target && (u.target.dead || u.target.under || Math.hypot(u.target.x - home.x, u.target.y - home.y) > LEASH * 1.4)) u.target = null;
    if (!u.target) u.target = pick(home, engaged);
    if (u.target) {
      engaged.add(u.target);
      fight(t, u, u.target, dt);
    } else {
      u.hp = Math.min(t.s.unitHp, u.hp + t.s.regen * dt);
      step(u, home.x, home.y, dt);
    }
    if (u.hp <= 0) {
      u.hp = 0;
      u.deadT = TOWERS[t.type].respawn;
      u.target = null;
      G.addFx({ kind: 'puff', x: u.x, y: u.y, r: 7, color: '#5a7aa0', life: 0.5 });
    }
  }

  function update(dt) {
    const engaged = new Set();
    for (const t of G.S.towers) {
      if (!t.units) continue;
      t.units.forEach((u, i) => updateUnit(t, u, homeFor(t, i, t.units.length), engaged, dt));
    }
  }

  // ---------- Desenho ----------
  // Aliados são azuis, como o herói (o vermelho é dos inimigos); a Guarda real usa armadura e os Templários, branco
  const SOLDIER = { main: '#5a7aa0', dark: '#1f2b3a', accent: '#5a7aa0' };
  const GUARD = { main: '#4a6a94', dark: '#1a2434', accent: '#b0473b', armored: true };
  const TEMPLAR = { main: '#efe6cf', dark: '#4a4434', accent: '#c43b2f' };
  const LOOKS = { soldier: ['spear', 'shield'], guard: ['spear', 'shield'], templar: ['sword', 'shield', 'cross'] };
  function drawUnit(g, t, u, reducedMotion) {
    const kind = t.spec === 'templar' ? 'templar' : t.spec === 'guard' ? 'guard' : 'soldier';
    const colors = kind === 'templar' ? TEMPLAR : kind === 'guard' ? GUARD : SOLDIER;
    if (Math.abs(Math.cos(u.ang)) > 0.3) u.face = Math.cos(u.ang) < 0 ? -1 : 1;
    const attack = u.swing > 0 ? 1 - u.swing / 0.18 : 0;
    TD.drawPerson(g, u.x, u.y - 2, 7, colors, LOOKS[kind], reducedMotion ? 0 : u.walk * 14, u.face || 1, attack);
    if (u.hp < t.s.unitHp) {
      const w = 14, k = Math.max(0, u.hp / t.s.unitHp), x = u.x, y = u.y - 17;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
      g.fillStyle = k > 0.4 ? '#86b46f' : '#e0715a'; g.fillRect(x - w / 2, y, w * k, 2);
    }
  }

  // Bandeirinha no posto do quartel selecionado
  function drawRally(g, t) {
    const { x, y } = t.rally;
    g.strokeStyle = '#3a2b0c'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 18); g.stroke();
    g.fillStyle = '#d6a547';
    g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 10, y - 14); g.lineTo(x, y - 10); g.fill();
  }

  function draw(g, reducedMotion) {
    const S = G.S;
    for (const t of S.towers) {
      if (!t.units) continue;
      if (S.sel === t) drawRally(g, t);
      for (const u of t.units) if (u.deadT <= 0) drawUnit(g, t, u, reducedMotion);
    }
  }

  TD.units = { attach, refresh, update, draw };
})();
