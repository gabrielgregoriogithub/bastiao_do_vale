// Coisas do campo com que o jogador interage além das torres:
// · Portais (Ruínas do Sol): o inimigo terrestre que pisa na boca A sai na boca B, pulando o trecho entre elas.
//   Tocar num portal o sela por um tempo, pagando ouro: a coluna tem de dar a volta inteira.
// · Baús de tesouro: aparecem escondidos no cenário em algumas ondas e quando um Ladrão de Ouro cai.
//   Tocar abre: ouro e, às vezes, uma relíquia nova (relics.js).
// · Barricadas: o poder Barricada ergue uma na estrada, que segura os inimigos terrestres até cair.
// A simulação chama update, onMove e onWaveStart; ui.js chama tap; scene.js chama draw e drawFx.
(() => {
  const TD = window.TD;
  const { T, COLS, ROWS } = TD;
  const G = TD.game;
  const sfx = TD.audio;

  // ---------- Portais ----------
  const SEAL_COST = 25, SEAL_DUR = 14, SEAL_CD = 5;
  const sealCost = () => Math.round(SEAL_COST * TD.relics.mul('sealCost', G.S.relics));
  const sealDur = () => SEAL_DUR * TD.relics.mul('sealDur', G.S.relics);
  const portalOpen = i => { const s = G.S.seals[i]; return !s || s.t <= 0; };
  const cellCenter = ([c, r]) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T });

  function canSeal(i) {
    const S = G.S, s = S.seals[i];
    return !!s && S.inGame && !S.over && !S.halted && s.t <= 0 && s.cd <= 0 && S.gold >= sealCost();
  }

  function seal(i) {
    const S = G.S, p = G.md.portals[i];
    if (!p || !canSeal(i)) return false;
    const cost = sealCost();
    S.gold -= cost;
    S.seals = S.seals.map((s, k) => (k === i ? { t: sealDur(), cd: 0 } : s));
    S.sealsUsed += 1;
    for (const end of [p.a, p.b]) {
      const q = cellCenter(end);
      G.addFx({ kind: 'ring', x: q.x, y: q.y, r: T * 0.8, color: '#e8c56e', life: 0.5 });
    }
    const q = cellCenter(p.a);
    G.addFx({ kind: 'text', x: q.x, y: q.y - 22, txt: `Portal selado · −${cost}`, color: '#e8c56e', life: 1.4 });
    sfx.play('seal');
    TD.achievements?.onSeal(S.sealsUsed);
    return true;
  }

  // Chamado depois que o inimigo anda: se cruzou a boca A de um portal aberto, sai na boca B
  function onMove(e, before) {
    if (e.d.flying || e.under || e.path !== G.md.paths[0]) return;
    G.md.portals.forEach((p, i) => {
      if (!portalOpen(i) || before >= p.da || e.dist < p.da) return;
      const from = e.path.posAt(p.da);
      e.dist = p.db + (e.dist - p.da);
      G.addFx({ kind: 'portal', x: from.x, y: from.y, life: 0.45 });
      const to = e.path.posAt(p.db);
      G.addFx({ kind: 'portal', x: to.x, y: to.y, life: 0.45, arrive: true });
      sfx.play('portal');
      if (!G.S.portalHint) {
        G.S.portalHint = true;
        G.addFx({ kind: 'text', x: from.x, y: from.y - 26, txt: `Toque no portal para selá-lo · ${sealCost()} de ouro`, color: '#d9c4ff', life: 3.2 });
      }
    });
  }

  function tickSeals(dt) {
    const S = G.S;
    if (!S.waveActive || !S.seals.length) return;
    S.seals = S.seals.map(s => {
      if (s.t > 0) { const t = s.t - dt; return t > 0 ? { t, cd: 0 } : { t: 0, cd: SEAL_CD }; }
      return s.cd > 0 ? { t: 0, cd: Math.max(0, s.cd - dt) } : s;
    });
  }

  // ---------- Baús de tesouro ----------
  const CHEST_EVERY = 4, CHEST_FIRST = 3, CHEST_WAVES = 2, CHEST_RELIC = 0.3, THIEF_RELIC = 0.5;
  // Baú escondido numa casa de cenário (árvore, ruína, lápide), longe da caverna e da muralha
  function hideChest() {
    const S = G.S, spots = [];
    for (let r = 0; r < ROWS; r++) for (let c = 1; c < COLS - 1; c++) {
      if (G.md.blocked[r][c] === 2 && !S.chests.some(k => k.c === c && k.r === r)) spots.push([c, r]);
    }
    if (!spots.length) return;
    const [c, r] = spots[Math.floor(Math.random() * spots.length)];
    S.chests = [...S.chests, { c, r, x: (c + 0.5) * T, y: (r + 0.5) * T + 6, until: S.wave + CHEST_WAVES, kind: 'hidden', born: S.clock }];
    G.addFx({ kind: 'text', x: (c + 0.5) * T, y: r * T - 4, txt: 'Um baú brilha entre o cenário!', color: '#f0d27a', life: 2.4 });
    sfx.play('chirp');
  }

  // kind: 'hidden' (do cenário), 'thief' (caiu do Ladrão de Ouro) ou 'caravan' (presente dos mercadores); os dois últimos pagam mais
  function dropChest(x, y, kind = 'thief') {
    const S = G.S;
    S.thieves += kind === 'thief' ? 1 : 0;
    S.chests = [...S.chests, { c: -1, r: -1, x, y, until: S.wave + CHEST_WAVES, kind, born: S.clock }];
    if (kind === 'thief') TD.achievements?.onThief();
  }

  function openChest(chest) {
    const S = G.S;
    S.chests = S.chests.filter(k => k !== chest);
    S.chestsOpened += 1;
    const gold = (chest.kind === 'hidden' ? 25 + 5 * S.wave : 40 + 6 * S.wave);
    S.gold += gold;
    G.addFx({ kind: 'text', x: chest.x, y: chest.y - 16, txt: `+${gold} de ouro`, color: '#f0d27a', life: 1.4 });
    G.addFx({ kind: 'ring', x: chest.x, y: chest.y, r: T * 0.7, color: '#f0d27a', life: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, sp = 70 + Math.random() * 60;
      G.addFx({ kind: 'coin', x: chest.x, y: chest.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 });
    }
    sfx.play('coins');
    const chance = chest.kind === 'hidden' ? CHEST_RELIC : THIEF_RELIC;
    if (Math.random() < chance) {
      const id = TD.relics.grantRandom();
      if (id) {
        const r = TD.RELICS.find(x => x.id === id);
        S.foundRelic = { id, t: S.clock };
        G.addFx({ kind: 'text', x: chest.x, y: chest.y - 36, txt: `Relíquia: ${r.name}!`, color: '#c8a8ff', life: 3, big: true });
        sfx.play('spec');
        TD.achievements?.onRelic();
      }
    }
    return gold;
  }

  // ---------- Barricadas ----------
  const BAR_REACH = 0.8 * T, BAR_HOLD = 0.55 * T;
  // Ponto da estrada mais perto do toque; longe da estrada não dá para erguer
  function roadPoint(x, y) {
    let best = null, bestD = BAR_REACH;
    for (const p of G.md.paths) {
      for (let d = 0; d < p.len; d += 6) {
        const q = p.posAt(d), dd = Math.hypot(q.x - x, q.y - y);
        if (dd < bestD) { best = q; bestD = dd; }
      }
    }
    return best;
  }

  function raiseBarricade(x, y, p) {
    const S = G.S, at = roadPoint(x, y);
    if (!at) {
      G.addFx({ kind: 'text', x, y: y - 14, txt: 'Só dá para erguer na estrada', color: '#e8806a', life: 1.2 });
      return false;
    }
    const hp = p.hp + p.hpPerWave * S.wave;
    S.barricades = [...S.barricades, { x: at.x, y: at.y, hp, maxHp: hp, t: p.dur, life: p.dur }];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      G.addFx({ kind: 'smoke', x: at.x + Math.cos(a) * 12, y: at.y + 8 + Math.sin(a) * 5, r: 5, life: 0.7 });
    }
    sfx.play('build');
    return true;
  }

  // Segura quem encosta e apanha dele, como um soldado; cai sem vida ou quando o tempo acaba
  function holdBarricades(dt) {
    const S = G.S;
    if (!S.barricades.length) return;
    for (const b of S.barricades) {
      b.t -= dt;
      for (const e of S.enemies) {
        if (e.dead || e.d.flying || e.under || Math.hypot(e.x - b.x, e.y - b.y) > BAR_HOLD) continue;
        e.blocked = true;
        b.hp -= (e.d.atk || 0) * (1 + S.wave * 0.05) * S.diff.hp * dt;
      }
      if (b.hp <= 0 || b.t <= 0) {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 60;
          G.addFx({ kind: 'shard', x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, color: i % 2 ? '#8a6a3e' : '#5a4224', life: 0.5 });
        }
      }
    }
    S.barricades = S.barricades.filter(b => b.hp > 0 && b.t > 0);
  }

  // ---------- Emboscada ----------
  // Algumas ondas separam um bando que se esconde no mato do meio da estrada: o aviso aparece
  // e, passados AMBUSH_DELAY s, o bando pula na estrada já adiantado (no Desafio do dia vem da semente)
  const AMBUSH_FIRST = 6, AMBUSH_CHANCE = 0.2, AMBUSH_SIZE = 4, AMBUSH_DELAY = 6, AMBUSH_AT = [0.4, 0.6];
  function ambushRoll() {
    const S = G.S;
    return S.seed === null ? Math.random() : TD.seeded((S.seed ^ Math.imul(S.wave, 3266489917)) >>> 0)();
  }
  // ponto da emboscada numa estrada, fora do trecho que o portal pula
  function ambushSpot(path, k) {
    let dist = path.len * k;
    for (const p of G.md.portals) if (dist > p.da && dist < p.db) dist = p.db + T;
    return Math.min(dist, path.len * 0.8);
  }
  function planAmbush() {
    const S = G.S;
    S.ambush = null;
    if (S.wave < AMBUSH_FIRST || S.wave % 5 === 0 || TD.isSwarm(S.wave)) return;
    const roll = ambushRoll();
    if (roll >= AMBUSH_CHANCE) return;
    // só inimigos de a pé comuns: nada de chefe, ladrão ou voador
    const picks = [];
    const rest = S.queue.filter(role => {
      const d = TD.ENEMIES[TD.enemyFor(S.mapId, role)];
      if (picks.length >= AMBUSH_SIZE || d.boss || d.thief || d.flying) return true;
      picks.push(role);
      return false;
    });
    if (picks.length < AMBUSH_SIZE) return;
    const k = roll / AMBUSH_CHANCE; // 0..1, reaproveitado para escolher estrada e ponto
    const path = G.md.paths[Math.floor(k * G.md.paths.length) % G.md.paths.length];
    const dist = ambushSpot(path, AMBUSH_AT[0] + k * (AMBUSH_AT[1] - AMBUSH_AT[0]));
    const q = path.posAt(dist);
    S.queue = rest;
    S.ambush = { path, dist, x: q.x, y: q.y, t: AMBUSH_DELAY, roles: picks };
  }
  function tickAmbush(dt) {
    const S = G.S, a = S.ambush;
    if (!a || !S.waveActive) return;
    a.t -= dt;
    if (a.t > 0) return;
    a.roles.forEach((role, i) => G.spawn(role, Math.max(0, a.dist - i * 16), a.path));
    G.addFx({ kind: 'text', x: a.x, y: a.y - 26, txt: 'Emboscada!', color: '#e8806a', life: 1.4 });
    for (let i = 0; i < 8; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 60;
      G.addFx({ kind: 'shard', x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60, color: i % 2 ? '#4a6a2a' : '#7a9a3a', life: 0.6 });
    }
    S.shake = Math.max(S.shake, 0.25);
    sfx.play('roar');
    S.ambush = null;
  }

  // ---------- Caravana ----------
  // Mercadores saem do castelo e descem a estrada na contramão até a entrada do vale. Quem encosta
  // nela a faz parar e a fere; se chega inteira, deixa um baú de tesouro no fim do caminho.
  const CARAVAN_FIRST = 4, CARAVAN_CHANCE = 0.15, CARAVAN_SPEED = 1.1, CARAVAN_REACH = 16;
  const CARAVAN_HP = 140, CARAVAN_HP_WAVE = 18, CARAVAN_END = 1.5 * T;
  function planCaravan() {
    const S = G.S;
    S.caravan = null;
    if (S.wave < CARAVAN_FIRST || S.wave % 5 === 0 || TD.isSwarm(S.wave) || S.ambush) return;
    const roll = S.seed === null ? Math.random() : TD.seeded((S.seed ^ Math.imul(S.wave, 1597334677)) >>> 0)();
    if (roll >= CARAVAN_CHANCE) return;
    const path = G.md.paths[0], dist = path.len - T, q = path.posAt(dist);
    const hp = CARAVAN_HP + CARAVAN_HP_WAVE * S.wave;
    S.caravan = { path, dist, x: q.x, y: q.y, hp, maxHp: hp, face: -1, stopped: false, roll: 0 };
  }
  function tickCaravan(dt) {
    const S = G.S, k = S.caravan;
    if (!k || !S.waveActive) return;
    // quem está encostando: inimigos de a pé, visíveis e fora da terra
    const touching = S.enemies.filter(e => !e.dead && !e.d.flying && !e.under && Math.hypot(e.x - k.x, e.y - k.y) <= CARAVAN_REACH + e.d.r);
    k.stopped = touching.length > 0;
    for (const e of touching) k.hp -= (e.d.atk || 0) * (1 + S.wave * 0.05) * S.diff.hp * dt;
    if (k.hp <= 0) {
      G.addFx({ kind: 'text', x: k.x, y: k.y - 22, txt: 'Caravana saqueada', color: '#e8806a', life: 1.6 });
      G.addFx({ kind: 'puff', x: k.x, y: k.y, r: 14, color: '#8a6a40', life: 0.6 });
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 70;
        G.addFx({ kind: 'shard', x: k.x, y: k.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, color: i % 2 ? '#8a6a40' : '#e0d2a8', life: 0.6 });
      }
      sfx.play('leak');
      S.caravan = null;
      return;
    }
    if (k.stopped) return;
    const before = k.x;
    k.dist = Math.max(CARAVAN_END, k.dist - CARAVAN_SPEED * T * dt);
    const q = k.path.posAt(k.dist);
    k.x = q.x; k.y = q.y; k.roll += CARAVAN_SPEED * dt * 6;
    if (Math.abs(q.x - before) > 0.01) k.face = q.x < before ? -1 : 1;
    if (k.dist > CARAVAN_END) return;
    S.caravans = (S.caravans || 0) + 1;
    G.addFx({ kind: 'text', x: k.x, y: k.y - 24, txt: 'Caravana a salvo!', color: '#86b46f', life: 1.6 });
    dropChest(k.x, k.y + 4, 'caravan');
    TD.achievements?.onCaravan(S.caravans);
    S.caravan = null;
  }

  // Ainda há algo da onda em andamento (bando escondido ou caravana na estrada)
  const busy = () => !!(G.S.ambush || G.S.caravan);

  // ---------- Ciclo ----------
  function update(dt) {
    tickSeals(dt);
    holdBarricades(dt);
    tickAmbush(dt);
    tickCaravan(dt);
  }

  function onWaveStart() {
    const S = G.S;
    S.chests = S.chests.filter(k => k.until >= S.wave);
    if (S.wave >= CHEST_FIRST && (S.wave - CHEST_FIRST) % CHEST_EVERY === 0) hideChest();
    planAmbush();
    planCaravan();
  }

  // Toque do jogador no campo: abre um baú ou sela um portal. Devolve true se usou o toque.
  function tap(x, y, isTouch = false) {
    const S = G.S, reach = isTouch ? 24 : 16;
    const chest = S.chests.find(k => Math.hypot(k.x - x, k.y - y) <= reach);
    if (chest) { openChest(chest); return true; }
    const i = G.md.portals.findIndex(p => [p.a, p.b].some(end => { const q = cellCenter(end); return Math.hypot(q.x - x, q.y - y) <= reach + 4; }));
    if (i < 0) return false;
    if (!seal(i)) {
      const s = S.seals[i], q = cellCenter(G.md.portals[i].a);
      const why = s.t > 0 ? 'O portal já está selado' : s.cd > 0 ? `O selo se refaz em ${Math.ceil(s.cd)} s` : `Selar custa ${sealCost()} de ouro`;
      G.addFx({ kind: 'text', x: q.x, y: q.y - 22, txt: why, color: '#e8806a', life: 1.2 });
    }
    return true;
  }

  // ---------- Desenho ----------
  // Arco de pedra em pé sobre a estrada; aberto, um redemoinho violeta; selado, pedra com a runa do sol
  function drawPortal(g, x, y, i, time) {
    const s = G.S.seals[i] || { t: 0, cd: 0 }, open = s.t <= 0;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 2, y + 15, 17, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a7466'; g.strokeStyle = '#2e2a24'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y, 16, 18, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.strokeStyle = 'rgba(30,28,24,.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 13.5); g.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 18); g.stroke();
    }
    if (open) {
      const grad = g.createRadialGradient(x, y, 1, x, y, 12);
      grad.addColorStop(0, s.cd > 0 ? 'rgba(200,180,255,.7)' : 'rgba(240,225,255,.95)');
      grad.addColorStop(0.5, s.cd > 0 ? 'rgba(110,80,170,.7)' : 'rgba(150,100,240,.9)');
      grad.addColorStop(1, 'rgba(40,20,80,.95)');
      g.fillStyle = grad; g.beginPath(); g.ellipse(x, y, 11.5, 13, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(230,210,255,.75)'; g.lineWidth = 1.4;
      for (let k = 0; k < 3; k++) {
        const a0 = time * 2.4 + k * 2.1;
        g.beginPath(); g.ellipse(x, y, 4 + k * 3, 5 + k * 3.2, 0, a0, a0 + 1.6); g.stroke();
      }
    } else {
      g.fillStyle = '#5a564c'; g.beginPath(); g.ellipse(x, y, 11.5, 13, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#f0c860'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.moveTo(x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5); g.lineTo(x + Math.cos(a) * 8.5, y + Math.sin(a) * 8.5); }
      g.stroke();
      // quanto falta para o selo cair
      g.strokeStyle = 'rgba(240,200,96,.9)'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (s.t / sealDur())); g.stroke();
    }
  }

  function drawPortals(g, time) {
    G.md.portals.forEach((p, i) => {
      const a = cellCenter(p.a), b = cellCenter(p.b);
      // fio de luz ligando as bocas abertas
      if (portalOpen(i)) {
        g.strokeStyle = 'rgba(180,140,255,.22)'; g.lineWidth = 3; g.setLineDash([3, 7]); g.lineDashOffset = -time * 20;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        g.setLineDash([]); g.lineDashOffset = 0;
      }
      drawPortal(g, a.x, a.y, i, time);
      drawPortal(g, b.x, b.y, i, time);
    });
  }

  // Veios de cristal pulsando nas casas que fortalecem torres (o desenho fixo está no fundo, render.js)
  function drawCrystals(g, time) {
    for (const [c, r] of G.md.crystals) {
      const x = (c + 0.5) * T, y = (r + 0.5) * T, k = 0.5 + 0.5 * Math.sin(time * 2 + c * 1.3 + r);
      g.strokeStyle = `rgba(140,220,255,${(0.25 + 0.3 * k).toFixed(3)})`; g.lineWidth = 1.5;
      TD.rr(g, c * T + 3, r * T + 3, T - 6, T - 6, 6); g.stroke();
    }
  }

  function drawChest(g, k, time) {
    const left = k.until - G.S.wave, blink = left <= 0 && Math.sin(time * 10) > 0.3;
    const bob = Math.sin(time * 3 + k.x) * 1.5, x = k.x, y = k.y + bob;
    if (blink) g.globalAlpha = 0.5;
    const glow = g.createRadialGradient(x, y - 4, 2, x, y - 4, 22);
    glow.addColorStop(0, 'rgba(255,220,120,.45)'); glow.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = glow; g.fillRect(x - 22, y - 26, 44, 44);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 1, y + 7, 11, 3.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a4a22'; g.strokeStyle = '#2e1a0a'; g.lineWidth = 1.4;
    TD.rr(g, x - 9, y - 4, 18, 11, 2); g.fill(); g.stroke();
    g.fillStyle = '#9a6030'; g.beginPath(); g.moveTo(x - 9, y - 4); g.quadraticCurveTo(x, y - 13, x + 9, y - 4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e0b44a'; g.fillRect(x - 9, y - 1, 18, 2); g.fillRect(x - 1.5, y - 4, 3, 6);
    g.fillStyle = '#fff2b0'; TD.circle(g, x, y + 0.5, 1.4); g.fill();
    // brilho que gira em volta
    const a = time * 3, sx = x + Math.cos(a) * 12, sy = y - 6 + Math.sin(a) * 5;
    g.fillStyle = '#fff6c8'; g.beginPath(); g.moveTo(sx, sy - 3); g.lineTo(sx + 1, sy); g.lineTo(sx, sy + 3); g.lineTo(sx - 1, sy); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }

  function drawBarricade(g, b) {
    const k = Math.max(0, b.hp / b.maxHp), x = b.x, y = b.y;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 2, y + 10, 18, 5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2e1e0e'; g.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      const sx = x + i * 6.5, top = y - 12 + Math.abs(i) * 2;
      g.fillStyle = i % 2 ? '#8a6a3e' : '#a07a48';
      g.beginPath(); g.moveTo(sx - 2.6, y + 8); g.lineTo(sx - 2.6, top + 3); g.lineTo(sx, top); g.lineTo(sx + 2.6, top + 3); g.lineTo(sx + 2.6, y + 8); g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = '#5a4224'; g.fillRect(x - 16, y - 3, 32, 3); g.fillRect(x - 16, y + 3, 32, 3);
    const w = 30;
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - w / 2 - 1, y - 21, w + 2, 5);
    g.fillStyle = k > 0.4 ? '#c8a050' : '#e0715a'; g.fillRect(x - w / 2, y - 20, w * k, 3);
  }

  // Bomba do Sabotador em arco até a torre
  function drawBombs(g) {
    for (const b of G.S.bombs) {
      const k = b.t / b.life, t = b.tower;
      const x = b.x0 + (t.x - b.x0) * k, y = b.y0 + (t.y - b.y0) * k - Math.sin(k * Math.PI) * 30;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(b.x0 + (t.x - b.x0) * k, b.y0 + 8 + (t.y - b.y0) * k, 3.5, 1.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#22201e'; TD.circle(g, x, y, 3.6); g.fill();
      g.fillStyle = '#ffd24a'; TD.circle(g, x + 2.4, y - 3, 1.4); g.fill();
    }
  }

  // Aviso da emboscada: o mato chacoalha, com um anel vermelho e a contagem
  function drawAmbush(g, a, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);
    g.strokeStyle = `rgba(232,96,74,${0.4 + 0.4 * pulse})`; g.lineWidth = 2;
    TD.circle(g, a.x, a.y, 14 + pulse * 4); g.stroke();
    for (let i = 0; i < 3; i++) {
      const bx = a.x + (i - 1) * 9, sway = Math.sin(time * 14 + i * 2) * 2;
      g.fillStyle = i % 2 ? '#3e5a22' : '#5a7a2e';
      g.beginPath(); g.moveTo(bx - 6, a.y + 6); g.quadraticCurveTo(bx + sway, a.y - 14, bx + 6, a.y + 6); g.fill();
    }
    g.fillStyle = '#e8806a'; g.font = '800 13px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
    g.fillText(`! ${Math.ceil(a.t)}`, a.x, a.y - 20);
  }

  // Carroça coberta de lona, com rodas que giram e a barra de vida por cima
  function drawCaravan(g, k, time) {
    const bob = k.stopped ? Math.sin(time * 30) * 0.8 : Math.sin(k.roll * 2) * 0.6;
    g.save();
    g.translate(k.x, k.y + bob);
    g.scale(k.face * 1.3, 1.3);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 9, 16, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a5530'; g.strokeStyle = '#3a2410'; g.lineWidth = 1.2;
    g.fillRect(-13, -2, 24, 8); g.strokeRect(-13, -2, 24, 8);
    g.strokeStyle = '#3a2410'; g.beginPath(); g.moveTo(-13, 3); g.lineTo(-20, 5); g.stroke(); // varal
    g.fillStyle = '#e8dcb8'; g.strokeStyle = '#8a7a5a';
    g.beginPath(); g.moveTo(-12, -2); g.quadraticCurveTo(-1, -18, 10, -2); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#b8a880'; g.beginPath(); g.moveTo(-4, -2); g.lineTo(-3, -11); g.moveTo(3, -2); g.lineTo(3, -10); g.stroke();
    for (const wx of [-8, 6]) {
      g.fillStyle = '#4a3218'; TD.circle(g, wx, 7, 4); g.fill();
      g.strokeStyle = '#c8a870'; g.lineWidth = 1;
      const a = k.roll;
      g.beginPath(); g.moveTo(wx + Math.cos(a) * 3.5, 7 + Math.sin(a) * 3.5); g.lineTo(wx - Math.cos(a) * 3.5, 7 - Math.sin(a) * 3.5);
      g.moveTo(wx - Math.sin(a) * 3.5, 7 + Math.cos(a) * 3.5); g.lineTo(wx + Math.sin(a) * 3.5, 7 - Math.cos(a) * 3.5); g.stroke();
    }
    g.restore();
    const w = 26, f = Math.max(0, k.hp / k.maxHp);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(k.x - w / 2 - 1, k.y - 29, w + 2, 5);
    g.fillStyle = f > 0.5 ? '#86b46f' : f > 0.25 ? '#e0b040' : '#e0604a'; g.fillRect(k.x - w / 2, k.y - 28, w * f, 3);
  }

  // Por baixo dos inimigos: cristais, portais, baús, barricadas, o mato da emboscada e a caravana
  function draw(g, time) {
    const S = G.S;
    if (S.ambush) drawAmbush(g, S.ambush, time);
    if (S.caravan) drawCaravan(g, S.caravan, time);
    if (G.md.crystals.length) drawCrystals(g, time);
    if (G.md.portals.length) drawPortals(g, time);
    for (const k of S.chests) drawChest(g, k, time);
    for (const b of S.barricades) drawBarricade(g, b);
  }

  // Por cima de tudo: bombas no ar e os efeitos novos (salto, portal, pedra caindo)
  function drawFx(g) {
    drawBombs(g);
    for (const f of G.S.fx) {
      if (f.kind !== 'blink' && f.kind !== 'portal' && f.kind !== 'rockfall') continue;
      const k = f.t / f.life;
      g.globalAlpha = Math.max(0, 1 - k);
      if (f.kind === 'rockfall') {
        // pedra que despenca do teto da mina e se espatifa no chão
        const fall = Math.min(1, k * 2.2), ry = f.y - 150 * (1 - fall);
        g.globalAlpha = 1;
        if (fall < 1) {
          g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(f.x, f.y + 6, 8 * fall + 3, 3, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#6a6070'; g.strokeStyle = '#2a2430'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(f.x - 7, ry - 4); g.lineTo(f.x + 2, ry - 8); g.lineTo(f.x + 8, ry); g.lineTo(f.x + 1, ry + 7); g.lineTo(f.x - 6, ry + 4); g.closePath(); g.fill(); g.stroke();
        } else {
          g.globalAlpha = Math.max(0, 1 - (k - 0.45) / 0.55);
          g.strokeStyle = '#c8bcd0'; g.lineWidth = 2.5; TD.circle(g, f.x, f.y, 6 + (k - 0.45) * 50); g.stroke();
        }
      } else {
        // salto e portal: anel que fecha (saída) ou abre (chegada) com faíscas
        const color = f.kind === 'portal' ? '#c8a8ff' : f.color || '#a0c0ff';
        const r = f.arrive ? 4 + k * 16 : 20 - k * 16;
        g.strokeStyle = color; g.lineWidth = 2.5; TD.circle(g, f.x, f.y, Math.max(1, r)); g.stroke();
        g.fillStyle = color;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + k * 3, d = r + 3;
          g.fillRect(f.x + Math.cos(a) * d - 1, f.y + Math.sin(a) * d - 1, 2, 2);
        }
      }
      g.globalAlpha = 1;
    }
  }

  // Luzes para a noite e para a escuridão das minas (lighting.js)
  function lights() {
    const out = [];
    if (!G.md) return out;
    for (const [c, r] of G.md.crystals) out.push([(c + 0.5) * T, (r + 0.5) * T, 46, '#8ad8ff']);
    G.md.portals.forEach((p, i) => {
      for (const end of [p.a, p.b]) { const q = cellCenter(end); out.push([q.x, q.y, portalOpen(i) ? 56 : 34, portalOpen(i) ? '#b48cff' : '#f0c860']); }
    });
    for (const k of G.S.chests) out.push([k.x, k.y, 30, '#ffd27a']);
    if (G.S.caravan) out.push([G.S.caravan.x, G.S.caravan.y, 40, '#ffc870']); // lanterna da carroça
    return out;
  }

  TD.world = {
    update, onMove, onWaveStart, busy, tap, seal, canSeal, sealCost, portalOpen, dropChest, openChest, hideChest, raiseBarricade, draw, drawFx, lights,
  };
})();
