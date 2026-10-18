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

  // Brilho que soma luz ao que está embaixo (raios, gelo, fogo)
  function glow(x, y, r, color) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawShots() {
    for (const s of G.S.shots) {
      if (s.kind === 'archer') {
        const tail = s.spec === 'poison' ? '#a6d86a' : '#f3ead2';
        ctx.strokeStyle = 'rgba(243,234,210,.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x - s.vx * 18, s.y - s.vy * 18); ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.stroke();
        ctx.strokeStyle = tail; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.fillStyle = tail;
        ctx.beginPath(); ctx.moveTo(s.x + s.vx * 3, s.y + s.vy * 3); ctx.lineTo(s.x - s.vy * 2.5, s.y + s.vx * 2.5); ctx.lineTo(s.x + s.vy * 2.5, s.y - s.vx * 2.5); ctx.fill();
      } else if (s.kind === 'mage') {
        // orbe arcano do Mago: rastro e brilho violeta
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(183,156,255,.4)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x - s.vx * 14, s.y - s.vy * 14); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.lineCap = 'butt';
        glow(s.x, s.y, 13, 'rgba(160,120,255,.6)');
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#efe8ff'; TD.circle(ctx, s.x, s.y, 3.6); ctx.fill();
      } else if (s.kind === 'cauldron') {
        // frasco em arco: sobe e desce entre a torre e o alvo, com a sombra no chão
        const total = Math.hypot(s.tx - s.x0, s.ty - s.y0) + Math.hypot(s.x - s.x0, s.y - s.y0) || 1;
        const k = Math.hypot(s.x - s.x0, s.y - s.y0) / total, lift = Math.sin(Math.min(1, k * 2) * Math.PI) * 26;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 4, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        const fy = s.y - lift;
        ctx.fillStyle = s.spec === 'acid' ? '#d8e05a' : '#7fc84a'; TD.circle(ctx, s.x, fy, 4); ctx.fill();
        ctx.fillStyle = '#e8e2d0'; ctx.fillRect(s.x - 1.2, fy - 7, 2.4, 3.5);
        ctx.fillStyle = 'rgba(255,255,255,.5)'; TD.circle(ctx, s.x - 1.3, fy - 1.3, 1.2); ctx.fill();
      } else if (s.kind === 'cannon') {
        // rastro de fumaça atrás da bala
        for (let i = 1; i <= 3; i++) {
          ctx.fillStyle = s.spec === 'fire' ? `rgba(255,140,60,${0.35 - i * 0.09})` : `rgba(200,195,180,${0.3 - i * 0.08})`;
          TD.circle(ctx, s.x - s.vx * i * 6, s.y - s.vy * i * 6, 4 - i * 0.6); ctx.fill();
        }
        if (s.spec === 'fire') {
          ctx.globalCompositeOperation = 'lighter';
          glow(s.x, s.y, 12, 'rgba(255,120,40,.6)');
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = '#1d1e20'; TD.circle(ctx, s.x, s.y, s.spec === 'mortar' ? 6.5 : 4.5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.22)'; TD.circle(ctx, s.x - 1.5, s.y - 1.5, 1.6); ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(143,211,232,.35)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x - s.vx * 12, s.y - s.vy * 12); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.lineCap = 'butt';
        glow(s.x, s.y, 11, 'rgba(143,211,232,.55)');
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = s.spec === 'freeze' ? '#ffffff' : '#e4f7fc'; TD.circle(ctx, s.x, s.y, 3.5); ctx.fill();
      }
    }
  }

  // Marcas no chão, por baixo de torres e inimigos: queimado das explosões e mancha de quem caiu
  const GROUND_FX = new Set(['scorch', 'stain']);
  // Poças do Caldeirão: ácido que borbulha e encolhe no fim
  function drawPuddles(time) {
    for (const p of G.S.puddles) {
      const fade = Math.min(1, p.t / 0.6, (p.life - p.t) / 0.2 + 0.3), r = p.r * (0.85 + 0.15 * fade);
      const [core, rim] = p.acid ? ['rgba(216,224,90,', 'rgba(140,150,30,'] : ['rgba(127,200,74,', 'rgba(60,110,30,'];
      ctx.fillStyle = rim + (0.45 * fade) + ')'; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = core + (0.5 * fade) + ')'; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.72, r * 0.48, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const k = (time * 1.4 + i * 0.37 + p.x * 0.01) % 1;
        ctx.strokeStyle = `rgba(230,250,190,${0.6 * (1 - k) * fade})`; ctx.lineWidth = 1;
        TD.circle(ctx, p.x + Math.cos(i * 2.1) * r * 0.4, p.y + Math.sin(i * 2.1) * r * 0.25, 1 + k * 3); ctx.stroke();
      }
    }
  }

  function drawGroundFx() {
    for (const f of G.S.fx) {
      if (!GROUND_FX.has(f.kind)) continue;
      const k = f.t / f.life, a = Math.min(1, (1 - k) * 2.5);
      if (f.kind === 'scorch') {
        ctx.globalAlpha = a * 0.22;
        ctx.fillStyle = '#2a1f12';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.7, f.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a * 0.12;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 1.1, f.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = a * 0.3;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFx() {
    for (const f of G.S.fx) {
      if (GROUND_FX.has(f.kind)) continue;
      const k = f.t / f.life;
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (f.kind === 'blast') {
        // bola de fogo que cresce rápido e some, com uma onda de choque na borda
        const grow = 1 - (1 - k) ** 3, r = f.r * (0.3 + 0.75 * grow);
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        grad.addColorStop(0, `rgba(255,250,225,${1 - k})`);
        grad.addColorStop(0.15, `rgba(255,230,150,${0.95 * (1 - k)})`);
        grad.addColorStop(0.35, f.fire ? `rgba(255,110,30,${0.75 * (1 - k)})` : `rgba(250,160,70,${0.7 * (1 - k)})`);
        grad.addColorStop(1, 'rgba(120,40,10,0)');
        ctx.fillStyle = grad; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = f.fire ? '#ff7a30' : '#f0b070'; ctx.lineWidth = 2.5 * (1 - k) + 0.5;
        TD.circle(ctx, f.x, f.y, f.r * (0.5 + 0.6 * grow)); ctx.stroke();
      } else if (f.kind === 'meteor') {
        // meteoro do Mago caindo em diagonal; no chão, o círculo de onde vai cair
        ctx.globalAlpha = 0.35 + 0.5 * k;
        ctx.strokeStyle = '#ff9a4a'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        TD.circle(ctx, f.x, f.y, f.r); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        const mx = f.x + (1 - k) * 70, my = f.y - (1 - k) * 160;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,140,60,.45)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(mx + 26, my - 60); ctx.lineTo(mx, my); ctx.stroke(); ctx.lineCap = 'butt';
        glow(mx, my, 22, 'rgba(255,150,60,.75)');
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#4a2a18'; TD.circle(ctx, mx, my, 7); ctx.fill();
        ctx.fillStyle = '#ffd08a'; TD.circle(ctx, mx - 2, my - 2, 3); ctx.fill();
      } else if (f.kind === 'smoke') {
        ctx.globalAlpha = Math.max(0, 0.25 * (1 - k) * Math.min(1, k * 6));
        ctx.fillStyle = '#b8b2a4';
        TD.circle(ctx, f.x, f.y - k * 22, f.r * (1 + k * 1.3)); ctx.fill();
      } else if (f.kind === 'spark') {
        ctx.strokeStyle = f.color; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          // leque de faíscas para o lado de onde o golpe veio
          const a = f.ang + Math.PI + (i - 2) * 0.45, d0 = 3 + k * 6, d1 = d0 + 5 * (1 - k) + 2;
          ctx.moveTo(f.x + Math.cos(a) * d0, f.y + Math.sin(a) * d0);
          ctx.lineTo(f.x + Math.cos(a) * d1, f.y + Math.sin(a) * d1);
        }
        ctx.stroke(); ctx.lineCap = 'butt';
      } else if (f.kind === 'text') {
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
        // raio em zigue-zague entre os pontos da cadeia: halo largo, traço colorido e miolo branco
        const zig = [f.points[0]];
        for (let i = 1; i < f.points.length; i++) {
          const a = f.points[i - 1], b = f.points[i];
          const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
          for (const kk of [0.33, 0.66]) {
            const j = (Math.random() - 0.5) * 12;
            zig.push({ x: a.x + (b.x - a.x) * kk + nx / nl * j, y: a.y + (b.y - a.y) * kk + ny / nl * j });
          }
          zig.push(b);
        }
        const trace = () => { ctx.beginPath(); ctx.moveTo(zig[0].x, zig[0].y); for (const p of zig.slice(1)) ctx.lineTo(p.x, p.y); ctx.stroke(); };
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = f.color; ctx.globalAlpha *= 0.3; ctx.lineWidth = 8; trace();
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = f.color; ctx.lineWidth = 2.6; trace();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; trace();
        ctx.lineCap = 'butt';
        for (const p of f.points.slice(1)) {
          ctx.globalCompositeOperation = 'lighter';
          glow(p.x, p.y, 10, 'rgba(190,210,255,.5)');
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (f.kind === 'shard') {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3);
      } else if (f.kind === 'dmg') {
        // número que salta e sobe; o crítico é maior, dourado e treme
        const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4);
        const size = (f.crit ? 15 : 10) * pop, yy = f.y - k * (f.crit ? 20 : 16), xx = f.x + (f.crit ? Math.sin(f.t * 60) * (1 - k) * 1.5 : 0);
        ctx.font = `800 ${size.toFixed(1)}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center';
        ctx.lineWidth = f.crit ? 3.5 : 2.6; ctx.strokeStyle = 'rgba(20,14,8,.85)';
        ctx.strokeText(f.txt, xx, yy);
        ctx.fillStyle = f.crit ? '#ffd24a' : f.color || '#f4efe2'; ctx.fillText(f.txt, xx, yy);
      } else if (f.kind === 'death') {
        drawDeath(f, k);
      } else if (f.kind === 'lightning') {
        // raio que desce do alto da tela em zigue-zague até o alvo, com galhos
        const rnd = TD.seeded(Math.floor(f.seed));
        const pts = [{ x: f.x + (rnd() - 0.5) * 80, y: -10 }];
        for (let i = 1; i <= 7; i++) pts.push({ x: f.x + (rnd() - 0.5) * 36 * (1 - i / 8), y: -10 + (f.y + 10) * i / 7 });
        pts[pts.length - 1] = { x: f.x, y: f.y };
        const trace = (w, color) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const p of pts) ctx.lineTo(p.x, p.y); ctx.stroke(); };
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'lighter';
        trace(9, 'rgba(160,190,255,.35)'); trace(3.5, '#cfe0ff'); trace(1.4, '#ffffff');
        const b = pts[3];
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#cfe0ff';
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + 22 * (rnd() - 0.3), b.y + 26); ctx.lineTo(b.x + 30 * (rnd() - 0.2), b.y + 40); ctx.stroke();
        glow(f.x, f.y, 34, 'rgba(200,220,255,.8)');
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'ember') {
        // fagulha dos fogos: ponto brilhante com rastro curto
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x - f.vx * 0.08, f.y - f.vy * 0.08); ctx.lineTo(f.x, f.y); ctx.stroke();
        ctx.lineCap = 'butt';
        glow(f.x, f.y, 7, 'rgba(255,240,200,.55)');
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'coin') {
        // moeda girando: a largura oscila como se virasse no ar
        const w = 2.8 * Math.abs(Math.cos(f.t * 14)) + 0.6;
        ctx.fillStyle = '#e8c56e'; ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, w, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (f.kind === 'glint') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = f.color;
        const s = 2.4 * (1 - k) + 0.6;
        ctx.beginPath(); ctx.moveTo(f.x, f.y - s * 2); ctx.lineTo(f.x + s * 0.6, f.y); ctx.lineTo(f.x, f.y + s * 2); ctx.lineTo(f.x - s * 0.6, f.y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(f.x - s * 2, f.y); ctx.lineTo(f.x, f.y + s * 0.6); ctx.lineTo(f.x + s * 2, f.y); ctx.lineTo(f.x, f.y - s * 0.6); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        glow(f.x, f.y, f.r * 2.4, 'rgba(255,220,140,.7)');
        ctx.globalCompositeOperation = 'source-over';
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

  // Corpo de quem caiu, animado conforme a forma: tomba de lado, desmorona (golem), se desfaz subindo (fantasma)
  // ou despenca girando (voadores). O desenho é o do próprio inimigo (creatures.js).
  function drawDeath(f, k) {
    const form = TD.enemyForm(f.type, f.d), body = {
      type: f.type, d: f.d, x: f.x, y: f.y, hp: 1, maxHp: 1, flash: k < 0.1 ? 1 : 0, slowT: 0, frozenT: 0, shield: 0, weakT: 0,
      dots: {}, wob: f.wob, revealed: true, face: f.face,
    };
    const ease = 1 - (1 - Math.min(1, k * 1.8)) ** 2, r = f.d.r;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.45) / 0.55);
    if (f.d.flying) {
      ctx.translate(f.x, f.y - 12 + ease * 18); ctx.rotate(f.face * ease * 1.6); ctx.translate(-f.x, -f.y);
    } else if (form === 'ghost') {
      ctx.globalAlpha = Math.max(0, 0.8 - k);
      ctx.translate(f.x, f.y - k * 18); ctx.scale(1 + k * 0.6, 1 - k * 0.3); ctx.translate(-f.x, -f.y);
    } else if (form === 'golem') {
      ctx.translate(f.x, f.y + r * 0.9); ctx.scale(1 + ease * 0.15, 1 - ease * 0.7); ctx.translate(-f.x, -f.y - r * 0.9);
    } else {
      // tomba para trás, girando em volta dos pés
      ctx.translate(f.x, f.y + r * 0.8); ctx.rotate(-f.face * ease * Math.PI / 2); ctx.translate(-f.x, -f.y - r * 0.8);
    }
    TD.drawEnemy(ctx, body, true);
    ctx.restore();
  }

  // Anel dourado nas torres que um estandarte em (x, y) fortalece: ao marcá-lo ou ao posicioná-lo
  function markBuffed(x, y, range) {
    ctx.strokeStyle = 'rgba(232,189,92,.9)'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    for (const t of G.S.towers) {
      if (TOWERS[t.type].support || TOWERS[t.type].economy || Math.hypot(t.x - x, t.y - y) > range) continue;
      TD.circle(ctx, t.x, t.y, 19); ctx.stroke();
    }
    ctx.setLineDash([]);
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
    if (TOWERS[S.build].support && ok) markBuffed(x, y, TOWERS[S.build].range * T);
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
    if (S.bossWarn > 0) {
      // chefe chegando: borda vermelha que pulsa e some
      const p = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(S.bossWarn * 9);
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
      grad.addColorStop(0, 'rgba(120,10,10,0)');
      grad.addColorStop(1, `rgba(120,10,10,${Math.min(1, S.bossWarn) * (0.25 + 0.3 * p)})`);
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

  // Divisas da patente no canto da torre: uma por patente, douradas
  function drawChevrons(x, y, n) {
    ctx.strokeStyle = '#2a1f08'; ctx.lineWidth = 3.4; ctx.lineJoin = 'round';
    const path = i => { ctx.beginPath(); ctx.moveTo(x - 4, y - i * 4); ctx.lineTo(x, y - 3 - i * 4); ctx.lineTo(x + 4, y - i * 4); };
    for (let i = 0; i < n; i++) { path(i); ctx.stroke(); }
    ctx.strokeStyle = '#f0d27a'; ctx.lineWidth = 1.8;
    for (let i = 0; i < n; i++) { path(i); ctx.stroke(); }
  }

  const BUILD_RISE = 0.35;
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
    const idle = reducedMotion ? 0 : performance.now() / 1000;
    drawPuddles(idle);
    drawGroundFx();
    for (const t of S.towers) {
      // torre recém-construída sobe do chão com um pequeno quique
      const age = t.born === undefined || reducedMotion ? 1 : (S.clock - t.born) / BUILD_RISE;
      const grow = age >= 1 ? 1 : 1 - (1 - age) ** 3 + Math.sin(age * Math.PI) * 0.12;
      if (grow !== 1) { ctx.save(); ctx.translate(t.x, t.y + 12); ctx.scale(grow, grow); ctx.translate(-t.x, -t.y - 12); }
      TD.drawTowerCached(ctx, dpr, t.type, t.x, t.y, t.level, t.ang, G.specOf(t)?.color || null, reducedMotion ? 0 : t.kick || 0, idle);
      if (grow !== 1) ctx.restore();
      const rank = G.rankOf(t);
      if (rank) drawChevrons(t.x + 13, t.y + 6, rank);
      if (t.stunT > 0) drawStunned(t);
    }
    if (S.sel) {
      ctx.strokeStyle = '#d6a547'; ctx.lineWidth = 2;
      TD.rr(ctx, S.sel.x - 18, S.sel.y - 18, 36, 36, 7); ctx.stroke();
      if (TOWERS[S.sel.type].support) markBuffed(S.sel.x, S.sel.y, S.sel.s.range);
    }
    if (S.inspect) {
      // marca o inimigo tocado: anel tracejado que o acompanha
      const e = S.inspect, y = e.d.flying ? e.y - 10 : e.y;
      ctx.strokeStyle = '#e8bd5c'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      TD.circle(ctx, e.x, y, e.d.r + 7); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const e of S.enemies) if (!e.d.flying) TD.drawEnemy(ctx, e, reducedMotion);
    TD.units.draw(ctx, reducedMotion);
    if (S.hero) TD.drawHero(ctx, S.hero, S.heroSel, reducedMotion);
    for (const e of S.enemies) if (e.d.flying) TD.drawEnemy(ctx, e, reducedMotion);
    drawShots();
    // o clima vem antes da luz: de noite a névoa e os bichos também ficam no escuro
    TD.ambience.draw(ctx, G.md, frameDt, performance.now() / 1000, reducedMotion);
    TD.lighting.draw(ctx, frameDt, performance.now() / 1000);
    drawFx();
    drawPlacement();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawOverlays();
  }

  TD.scene = { setup, draw };
})();
