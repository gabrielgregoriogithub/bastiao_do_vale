// Luz e hora do dia: a cada ciclo de 5 ondas o dia passa (manhã, tarde dourada, crepúsculo) e as ondas de
// chefe chegam à noite. No escuro só enxerga quem está perto de uma luz: tochas e cristais das torres, lava,
// portão do castelo, herói, explosões, raios e inimigos em chamas. De dia, sombras de nuvens cruzam o campo.
// Puramente visual: não muda a simulação.
(() => {
  const TD = window.TD;
  const { T, W, H, mix } = TD;
  const G = TD.game;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // dark: quanto o campo escurece (0 a 1); tint: cor que multiplica a cena, com força ta
  const PHASES = {
    day: { dark: 0, tint: '#ffffff', ta: 0 },
    golden: { dark: 0.06, tint: '#ffd49a', ta: 0.3 },
    dusk: { dark: 0.3, tint: '#e0846a', ta: 0.34 },
    night: { dark: 0.62, tint: '#5a6aa8', ta: 0.4 },
  };
  const CYCLE = ['night', 'day', 'day', 'golden', 'dusk']; // índice: onda % 5 (as ondas 5, 10, 15... são de noite)
  const CAPTION = { golden: 'A tarde cai', dusk: 'Crepúsculo', night: 'A noite chega', day: 'Amanhece' };
  // Campos com clima próprio: escuridão mínima e tom
  const BIOME = {
    cripta: { dark: 0.32, tint: '#7a86a8', ta: 0.28 }, vulcao: { dark: 0.14, tint: '#e0805a', ta: 0.24 },
    templo: { dark: 0.04, tint: '#ffd89a', ta: 0.16 }, cristal: { dark: 0.5, tint: '#6a74c0', ta: 0.32 },
  };

  function phaseOf(wave) { return wave <= 0 ? 'day' : CYCLE[wave % 5]; }
  function targetFor(S, md) {
    const p = PHASES[phaseOf(S.wave)], b = BIOME[md.map.biome];
    const base = !b || p.dark >= b.dark ? p : { dark: b.dark, tint: p.ta > b.ta ? p.tint : b.tint, ta: Math.max(p.ta, b.ta) };
    // tempestade: céu fechado, mais escuro e azulado
    return S.storm ? { dark: Math.min(0.75, base.dark + 0.22), tint: '#6a7a98', ta: Math.max(base.ta, 0.3) } : base;
  }

  // ---------- Luzes: manchas suaves pré-desenhadas e reaproveitadas ----------
  const SPRITE = 64;
  const spots = new Map();
  function spot(color) {
    let c = spots.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = SPRITE;
      const g = c.getContext('2d'), grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
      grad.addColorStop(0, color); grad.addColorStop(0.35, color.replace(/rgb\((.*)\)/, 'rgba($1,.55)'));
      grad.addColorStop(1, color.replace(/rgb\((.*)\)/, 'rgba($1,0)'));
      g.fillStyle = grad; g.fillRect(0, 0, SPRITE, SPRITE);
      spots.set(color, c);
    }
    return c;
  }
  const rgb = hex => mix(hex, hex, 0); // '#rrggbb' para 'rgb(r,g,b)', o formato que spot entende

  const WARM = '#ffb35a';
  const TOWER_LIGHT = {
    archer: [WARM, 46], cannon: [WARM, 42], frost: ['#8fe0ff', 60], ballista: [WARM, 40], arcane: ['#b48cff', 66],
    barracks: [WARM, 52], banner: ['#ffcf7a', 44], cauldron: ['#9ae05a', 58], mine: ['#ffd27a', 48],
  };
  const SHOT_LIGHT = { mage: ['#b79cff', 32], frost: ['#8fe0ff', 18], cauldron: ['#9ae05a', 16] };

  // Junta as luzes do quadro: [x, y, raio, cor]
  function collect(S, md, time) {
    const out = [];
    const flick = id => (reducedMotion ? 1 : 1 + 0.05 * Math.sin(time * 9 + id * 1.7) + 0.03 * Math.sin(time * 23 + id));
    for (const t of S.towers) {
      const [color, r] = TOWER_LIGHT[t.type] || [WARM, 40];
      out.push([t.x, t.y + TD.towerHeadY(t.type, t.level) * 0.6, r * (1 + 0.12 * (t.level - 1)) * (color === WARM ? flick(t.id) : 1), color]);
    }
    if (md.map.lava) for (const [c, r] of md.map.water) out.push([(c + 0.5) * T, (r + 0.5) * T, 34 * flick(c * 7 + r), '#ff7a2a']);
    out.push([W - T * 0.6, (md.exitRow + 0.5) * T, 70 * flick(99), WARM]);
    for (const p of md.paths) out.push([T * 0.2, (p.startRow + 0.5) * T, 30, '#ff8a4a']);
    if (S.hero && S.hero.deadT <= 0) out.push([S.hero.x, S.hero.y, 74, '#ffe6a8']);
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.dots.burn || (e.d.look && e.d.look.includes('flame'))) out.push([e.x, e.y - e.d.r, 26 + e.d.r, '#ff8a3a']);
      else if (e.frozenT > 0) out.push([e.x, e.y, 22, '#bfe9ff']);
    }
    for (const s of S.shots) {
      const l = SHOT_LIGHT[s.kind] || (s.spec === 'fire' ? ['#ff8a3a', 26] : null);
      if (l) out.push([s.x, s.y, l[1], l[0]]);
    }
    for (const p of S.puddles) out.push([p.x, p.y, p.r * 1.4, p.acid ? '#d8e05a' : '#9ae05a']);
    for (const l of TD.ambience.lights()) out.push(l);
    for (const l of TD.world.lights()) out.push(l);
    for (const f of S.fx) {
      const k = 1 - f.t / f.life;
      if (f.kind === 'blast') out.push([f.x, f.y, f.r * 2.6 * k, f.fire ? '#ff7a30' : '#ffb060']);
      else if (f.kind === 'flash') out.push([f.x, f.y, 48 * k, '#ffd890']);
      else if (f.kind === 'fire') out.push([f.x2, f.y2, 44 * k, '#ff8a3a']);
      else if (f.kind === 'ember') out.push([f.x, f.y, 20 * k, f.color]);
      else if (f.kind === 'bolt') for (const p of f.points) out.push([p.x, p.y, 40 * k, '#bcd4ff']);
      else if (f.kind === 'meteor') out.push([f.x, f.y, 60 * (1 - k), '#ff9a4a']);
    }
    return out;
  }

  // ---------- Estado e desenho ----------
  let cur = { ...PHASES.day }, curTint = '#ffffff', layer = null, lastPhase = 'day', caption = null, lastMap = null, rain = 0, lastStorm = false;

  // Chuva em traços diagonais (ou neve grossa na nevasca); rain vai de 0 a 1 ao começar e acabar
  const DROPS = Array.from({ length: 140 }, (_, i) => [(i * 97.3) % 1, (i * 61.7) % 1, 0.6 + ((i * 13) % 10) / 25]);
  function drawRain(g, time, snow) {
    if (rain < 0.02) return;
    g.globalAlpha = rain * (snow ? 0.8 : 0.45);
    g.strokeStyle = snow ? '#ffffff' : '#c8d8f0'; g.fillStyle = '#ffffff'; g.lineWidth = 1;
    g.beginPath();
    for (const [fx, fy, sp] of DROPS) {
      const speed = snow ? 60 * sp : 520 * sp, drift = snow ? 30 : 140;
      const y = ((fy * (H + 40) + time * speed) % (H + 40)) - 20, x = ((fx * (W + 80) + time * drift * sp) % (W + 80)) - 40;
      if (snow) { g.moveTo(x + 1.6, y); g.arc(x, y, 1.6 * sp, 0, Math.PI * 2); }
      else { g.moveTo(x, y); g.lineTo(x - 4, y - 13 * sp); }
    }
    if (snow) g.fill(); else g.stroke();
    g.globalAlpha = 1;
  }

  function update(dt, S, md) {
    const target = targetFor(S, md);
    if (md !== lastMap) { cur = { ...target }; curTint = target.tint; lastMap = md; lastPhase = phaseOf(S.wave); caption = null; }
    const k = Math.min(1, dt * 0.45);
    cur.dark += (target.dark - cur.dark) * k;
    cur.ta += (target.ta - cur.ta) * k;
    curTint = mixHex(curTint, target.tint, k);
    const ph = phaseOf(S.wave);
    if (ph !== lastPhase && S.inGame) { caption = { text: CAPTION[ph], t: 0 }; lastPhase = ph; }
    const storming = S.storm && S.waveActive;
    if (storming && !lastStorm) caption = { text: md.map.biome === 'neve' ? 'Nevasca' : md.map.biome === 'cristal' ? 'Tremor de terra' : 'Tempestade', t: 0 };
    lastStorm = storming;
    rain += ((storming ? 1 : 0) - rain) * Math.min(1, dt * 0.8);
    if (caption) { caption.t += dt; if (caption.t > 3) caption = null; }
  }
  // mistura que devolve hexadecimal, para poder misturar de novo no quadro seguinte
  function mixHex(a, b, k) {
    const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
    const A = h(a), B = h(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }

  // Sombras de nuvens que cruzam o campo de dia
  const CLOUDS = [[0.1, 0.2, 140], [0.55, 0.65, 180], [0.85, 0.3, 120], [0.35, 0.9, 160]];
  function drawClouds(g, time, strength) {
    if (strength <= 0.01) return;
    const s = spot(rgb('#0a1410'));
    g.globalAlpha = 0.09 * strength;
    for (const [fx, fy, r] of CLOUDS) {
      const x = ((fx * (W + 400) + time * 9) % (W + 400)) - 200, y = fy * H + Math.sin(time * 0.05 + fx * 6) * 20;
      g.drawImage(s, x - r, y - r * 0.6, r * 2, r * 1.2);
    }
    g.globalAlpha = 1;
  }

  // Desenha a cor do momento, a escuridão com as luzes recortadas e o brilho colorido das luzes
  function draw(g, frameDt, time) {
    const S = G.S, md = G.md;
    if (!S || !md) return;
    update(frameDt, S, md);
    drawClouds(g, reducedMotion ? 0 : time, 1 - cur.dark * 3);
    if (cur.ta > 0.01) {
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = cur.ta; g.fillStyle = curTint; g.fillRect(0, 0, W, H);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (cur.dark > 0.02) {
      if (!layer) { layer = document.createElement('canvas'); layer.width = W / 2; layer.height = H / 2; }
      const l = layer.getContext('2d');
      l.setTransform(0.5, 0, 0, 0.5, 0, 0);
      l.globalCompositeOperation = 'source-over';
      l.clearRect(0, 0, W, H);
      l.fillStyle = `rgba(6,10,28,${cur.dark.toFixed(3)})`; l.fillRect(0, 0, W, H);
      const lights = collect(S, md, time);
      l.globalCompositeOperation = 'destination-out';
      const white = spot(rgb('#ffffff'));
      for (const [x, y, r] of lights) if (r > 1) l.drawImage(white, x - r, y - r, r * 2, r * 2);
      // o clarão do relâmpago apaga a escuridão por um instante
      g.globalAlpha = 1 - Math.min(1, (S.flashT || 0) / 0.3) * 0.85;
      g.drawImage(layer, 0, 0, W, H);
      g.globalAlpha = 1;
      // brilho colorido somado por cima, mais forte quanto mais escuro
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.min(0.5, cur.dark * 0.7);
      for (const [x, y, r, color] of lights) if (r > 1) g.drawImage(spot(rgb(color)), x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (md.map.biome !== 'cristal') drawRain(g, reducedMotion ? 0 : time, md.map.biome === 'neve');
    if (S.flashT > 0) { g.fillStyle = `rgba(230,240,255,${(S.flashT / 0.3 * 0.35).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    if (caption) {
      const a = Math.min(1, caption.t / 0.5, (3 - caption.t) / 0.8);
      g.globalAlpha = Math.max(0, a) * 0.9;
      g.font = '28px "Pirata One", Georgia, serif'; g.textAlign = 'center';
      g.lineWidth = 5; g.strokeStyle = 'rgba(10,10,20,.7)'; g.strokeText(caption.text, W / 2, H - 28);
      g.fillStyle = '#e8dcc0'; g.fillText(caption.text, W / 2, H - 28);
      g.globalAlpha = 1;
    }
  }

  TD.lighting = { draw, phaseOf, darkness: () => cur.dark };
})();
