// Desenho do quadro: fundo do mapa em cache, torres, inimigos, herói, tiros, efeitos e sobreposições.
// Só lê o estado da partida (TD.game); quem chama é o laço principal em ui.js.
(() => {
  const TD = window.TD;
  const { T, COLS, ROWS, W, H, TOWERS, POWERS } = TD;
  const G = TD.game;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ctx = null, dpr = 1, bg = null, bgFor = null;

  // Chamado quando o canvas muda de resolução; o fundo é refeito no próximo quadro
  function setup(context, ratio) {
    ctx = context;
    dpr = ratio;
    bg = null;
  }

  // Entre as ondas, setas mostram por onde a próxima onda vai passar; voadores ganham uma linha tracejada
  const CHEVRON_GAP = 56;
  function drawPathPreview(time) {
    const S = G.S;
    if (!S.inGame || S.waveActive || S.over || S.halted) return;
    const shift = reducedMotion ? 0 : (time * 40) % CHEVRON_GAP;
    ctx.strokeStyle = 'rgba(245,232,190,.6)';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const path of G.md.paths) {
      for (let d = shift; d < path.len - 10; d += CHEVRON_GAP) {
        const a = path.posAt(d), b = path.posAt(d + 1);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(3, 0); ctx.lineTo(-4, 6); ctx.stroke();
        ctx.restore();
      }
    }
    if (S.next.some(t => TD.ENEMIES[t].flying)) {
      ctx.strokeStyle = 'rgba(190,200,240,.55)'; ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]); ctx.lineDashOffset = -shift;
      for (const path of G.md.paths) {
        const a = path.flyAt(0), b = path.flyAt(path.flyLen);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    ctx.lineCap = 'butt';
  }

  function ensureBg() {
    if (bgFor === G.md && bg) return;
    bg = TD.buildBg(G.md, dpr);
    bgFor = G.md;
  }

  function drawShots() {
    for (const s of G.S.shots) {
      if (s.kind === 'archer') {
        ctx.strokeStyle = s.spec === 'poison' ? '#a6d86a' : '#f3ead2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.lineTo(s.x, s.y); ctx.stroke();
      } else if (s.kind === 'cannon') {
        if (s.spec === 'fire') { ctx.fillStyle = 'rgba(255,120,40,.45)'; TD.circle(ctx, s.x, s.y, 8); ctx.fill(); }
        ctx.fillStyle = '#1d1e20'; TD.circle(ctx, s.x, s.y, s.spec === 'mortar' ? 6.5 : 4.5); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(143,211,232,.35)'; TD.circle(ctx, s.x, s.y, 7); ctx.fill();
        ctx.fillStyle = s.spec === 'freeze' ? '#ffffff' : '#e4f7fc'; TD.circle(ctx, s.x, s.y, 3.5); ctx.fill();
      }
    }
  }

  function drawFx() {
    for (const f of G.S.fx) {
      const k = f.t / f.life;
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (f.kind === 'text') {
        ctx.fillStyle = f.color;
        ctx.font = f.big ? '600 22px "Barlow Semi Condensed", sans-serif' : '700 13px "Barlow Semi Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,20,15,.7)';
        const yy = f.y - k * (f.big ? 14 : 22);
        ctx.strokeText(f.txt, f.x, yy); ctx.fillText(f.txt, f.x, yy);
      } else if (f.kind === 'puff') {
        ctx.fillStyle = f.color; TD.circle(ctx, f.x, f.y, f.r * (1 + k * 1.2)); ctx.fill();
      } else if (f.kind === 'ring') {
        ctx.strokeStyle = f.color; ctx.lineWidth = 3; TD.circle(ctx, f.x, f.y, Math.max(1, f.r * (0.4 + k * 0.6))); ctx.stroke();
      } else if (f.kind === 'line') {
        ctx.strokeStyle = '#f3ead2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      } else if (f.kind === 'bolt') {
        // raio em zigue-zague entre os pontos da cadeia
        ctx.strokeStyle = f.color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(f.points[0].x, f.points[0].y);
        for (let i = 1; i < f.points.length; i++) {
          const a = f.points[i - 1], b = f.points[i];
          const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
          for (const kk of [0.33, 0.66]) {
            const j = (Math.random() - 0.5) * 12;
            ctx.lineTo(a.x + (b.x - a.x) * kk + nx / nl * j, a.y + (b.y - a.y) * kk + ny / nl * j);
          }
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      } else if (f.kind === 'shard') {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3);
      } else if (f.kind === 'flash') {
        ctx.fillStyle = '#ffe9a8'; TD.circle(ctx, f.x, f.y, f.r * (1 - k * 0.5)); ctx.fill();
      } else if (f.kind === 'fire') {
        ctx.strokeStyle = 'rgba(255,130,40,.9)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + (f.x2 - f.x) * Math.min(1, k * 2), f.y + (f.y2 - f.y) * Math.min(1, k * 2)); ctx.stroke();
        ctx.lineCap = 'butt';
      } else if (f.kind === 'rain') {
        ctx.globalAlpha = 1;
        TD.drawRange(ctx, f.x, f.y, f.r, true);
        ctx.strokeStyle = '#f3ead2'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * f.r;
          const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d - (1 - k) * 30;
          ctx.beginPath(); ctx.moveTo(x - 3, y - 9); ctx.lineTo(x, y); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPlacement() {
    const S = G.S;
    if (S.aim && S.hoverPx) {
      const p = POWERS.find(q => q.id === S.aim);
      TD.drawRange(ctx, S.hoverPx.x, S.hoverPx.y, p.radius * T, true);
      return;
    }
    if (!S.build || !S.hover) return;
    const { c, r } = S.hover;
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const ok = G.canBuild(c, r) && S.gold >= G.costOf(S.build);
    const x = (c + 0.5) * T, y = (r + 0.5) * T;
    TD.drawRange(ctx, x, y, TOWERS[S.build].range * T, ok);
    ctx.globalAlpha = 0.65;
    TD.drawTower(ctx, S.build, x, y, 1, Math.PI);
    ctx.globalAlpha = 1;
  }

  function drawBigText(text, y, size, color) {
    ctx.font = `${size}px "Pirata One", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,18,12,.75)';
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
  }

  // Barra de vida do chefe no topo do mapa, com a fatia de escudo em lilás
  function drawBossBar() {
    const boss = G.S.enemies.find(e => e.d.boss && !e.dead);
    if (!boss) return;
    const w = 320, x = (W - w) / 2, y = 14;
    const k = Math.max(0, boss.hp / boss.maxHp), sk = Math.min(1 - k, boss.shield / boss.maxHp);
    ctx.fillStyle = 'rgba(15,14,10,.78)';
    TD.rr(ctx, x - 10, y - 6, w + 20, 34, 6); ctx.fill();
    ctx.font = '600 13px "Barlow Semi Condensed", sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = '#ede5cf';
    ctx.fillText(boss.d.name, x, y + 8);
    ctx.textAlign = 'right'; ctx.fillStyle = '#a8a28c';
    ctx.fillText(Math.ceil(boss.hp).toLocaleString('pt-BR'), x + w, y + 8);
    ctx.fillStyle = '#3b4334'; ctx.fillRect(x, y + 14, w, 6);
    ctx.fillStyle = k > 0.25 ? '#c0503c' : '#e0715a'; ctx.fillRect(x, y + 14, w * k, 6);
    if (sk > 0) { ctx.fillStyle = '#b48be0'; ctx.fillRect(x + w * k, y + 14, w * sk, 6); }
  }

  function drawOverlays() {
    const S = G.S;
    if (S.hurtFlash > 0) {
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.65);
      grad.addColorStop(0, 'rgba(200,40,30,0)');
      grad.addColorStop(1, `rgba(200,40,30,${S.hurtFlash * 0.6})`);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    }
    if (S.iceFlash > 0) {
      ctx.fillStyle = `rgba(200,238,252,${S.iceFlash * 0.35})`; ctx.fillRect(0, 0, W, H);
    }
    if (S.rallyT > 0) {
      ctx.strokeStyle = `rgba(232,189,92,${0.35 + 0.25 * Math.sin(performance.now() / 120)})`;
      ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
    }
    drawBossBar();
    if (S.banner) {
      const b = S.banner, a = b.t < 0.3 ? b.t / 0.3 : b.t > 1.4 ? 1 - (b.t - 1.4) / 0.6 : 1;
      ctx.globalAlpha = Math.max(0, a);
      drawBigText(b.text, H * 0.36, 52, '#e8bd5c');
      ctx.globalAlpha = 1;
    }
    if (S.paused && S.inGame && !S.over && !S.halted && !S.menuOpen) {
      ctx.fillStyle = 'rgba(15,18,13,.45)'; ctx.fillRect(0, 0, W, H);
      drawBigText('Pausado', H / 2, 48, '#ede5cf');
    }
  }

  function drawStunned(t) {
    ctx.fillStyle = 'rgba(20,14,10,.55)';
    TD.rr(ctx, t.x - 15, t.y - 15, 30, 30, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,130,40,.85)';
    for (let i = 0; i < 3; i++) {
      TD.circle(ctx, t.x + (Math.random() - 0.5) * 18, t.y - 6 - Math.random() * 12, 2 + Math.random() * 2);
      ctx.fill();
    }
  }

  function draw(frameDt) {
    const S = G.S;
    ensureBg();
    const m = reducedMotion ? 0 : S.shake * 12;
    const ox = m ? (Math.random() - 0.5) * m : 0, oy = m ? (Math.random() - 0.5) * m : 0;
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
    ctx.drawImage(bg, 0, 0, W, H);
    drawPathPreview(performance.now() / 1000);

    if (S.sel) TD.drawRange(ctx, S.sel.x, S.sel.y, S.sel.s.range, true);
    const hovered = !S.build && !S.aim && S.hover ? G.towerAt(S.hover.c, S.hover.r) : null;
    if (hovered && hovered !== S.sel) TD.drawRange(ctx, hovered.x, hovered.y, hovered.s.range, true);
    for (const t of S.towers) {
      TD.drawTowerCached(ctx, dpr, t.type, t.x, t.y, t.level, t.ang, G.specOf(t)?.color || null, reducedMotion ? 0 : t.kick || 0);
      if (t.stunT > 0) drawStunned(t);
    }
    if (S.sel) {
      ctx.strokeStyle = '#d6a547'; ctx.lineWidth = 2;
      TD.rr(ctx, S.sel.x - 18, S.sel.y - 18, 36, 36, 7); ctx.stroke();
    }
    for (const e of S.enemies) if (!e.d.flying) TD.drawEnemy(ctx, e, reducedMotion);
    TD.units.draw(ctx, reducedMotion);
    if (S.hero) TD.drawHero(ctx, S.hero, S.heroSel, reducedMotion);
    for (const e of S.enemies) if (e.d.flying) TD.drawEnemy(ctx, e, reducedMotion);
    drawShots();
    TD.ambience.draw(ctx, G.md, frameDt, performance.now() / 1000, reducedMotion);
    drawFx();
    drawPlacement();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawOverlays();
  }

  TD.scene = { setup, draw };
})();
