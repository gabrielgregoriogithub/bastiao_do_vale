// Desenho dos inimigos: personagens em visão 3/4, com contorno, luz e sombra e passos animados.
// Cada inimigo tem uma forma de corpo (FORMS) e enfeites (d.look, em bestiary.js) desenhados sobre ela.
// O desenho é feito num espaço local de ~10 unidades por raio: k = r / 10, e o corpo vira para onde anda.
(() => {
  const TD = window.TD;
  const { rr, circle, mix } = TD;
  const TAU = Math.PI * 2;

  // ---------- Formas de corpo ----------
  // hum: humanoide · robe: de manto até o chão · ghost: manto que flutua · golem: bloco enorme
  // beast: quadrúpede · bug: inseto · worm: verme · bird, bat, dragon: voadores
  const ROLE_FORM = {
    soldier: 'hum', scout: 'hum', brute: 'hum', healer: 'robe', flyer: 'bat', stalker: 'hum', necro: 'robe',
    skeleton: 'hum', boss: 'hum', witch: 'robe', colossus: 'golem', dragon: 'dragon', berserker: 'hum', burrower: 'hum',
  };
  const FORMS = {
    newt: 'beast', crab: 'bug', heron: 'bird', crocking: 'beast', turtle: 'golem', hydra: 'dragon', hippo: 'beast', mudeel: 'worm',
    jackal: 'beast', scarab: 'bug', vulture: 'bird', cobra: 'worm', djinn: 'ghost', sphinx: 'beast', roc: 'bird', scorpion: 'bug', sandworm: 'worm',
    wolf: 'beast', walrus: 'beast', owl: 'bird', polarbear: 'beast', icemole: 'beast', frostwyrm: 'dragon',
    warant: 'bug', spider: 'bug', boar: 'beast', bat: 'bat', mantis: 'bug', brownbear: 'beast', mole: 'beast', treant: 'golem', wyvern: 'dragon',
    gull: 'bird', ghostcaptain: 'ghost', siren: 'ghost', kraken: 'golem', seaserpent: 'dragon', hermit: 'bug',
    cryptrat: 'beast', vampbat: 'bat', ghost: 'ghost', banshee: 'ghost', abomination: 'golem', bonedragon: 'dragon', tombworm: 'worm',
    firebat: 'bat', ashwraith: 'ghost', magmagolem: 'golem', elderdragon: 'dragon', magmaworm: 'worm', icegolem: 'golem',
  };
  // Pele de quem não é gente comum (os demais humanoides têm pele humana; feras usam a própria cor)
  const SKIN = {
    frogman: '#7aa85a', drowned: '#9ab8a8', mummy: '#d8ccaa', bogdead: '#8a9a6a', ghoul: '#9aa88a', trollking: '#6e9a62',
    yeti: '#eef2f4', demon: '#b23a2e', imp: '#e8783a', flameogre: '#c86a44', werewolf: '#7a6a58', vampire: '#ece2e0',
    skeleton: '#e8e0c8', frostbone: '#dcecf4', oldbones: '#e8e0c8', ghostsailor: '#c8e0ea', cinder: '#5a4a44', reedlurker: '#6a8a5a',
    whitehunter: '#e8eef2', piratelord: '#d9a77c',
  };
  const HUMAN_SKIN = '#e0b08a';
  const ARMORED = new Set(['visor', 'square']);
  // Só o Senhor da Guerra e o Blindado clássicos vestem armadura completa sem ter o enfeite dela
  const ARMORED_TYPES = new Set(['boss', 'brute', 'ally-armored']);
  // Armas de chefes que não usam espada
  const WEAPONS = { yeti: 'claws', trollking: 'mace', vampire: 'claws', demon: 'axe' };
  // Enfeites que cobrem a cabeça: sem eles, o humanoide ganha cabelo
  const COVERS = new Set(['hood', 'crown', 'hat', 'turban', 'bandana', 'tricorn', 'lamp', 'fur', 'flame', 'leaf', 'bones', 'wraps', 'bulge', 'cowl']);
  const formOf = (type, d) => FORMS[type] || ROLE_FORM[d.role] || 'hum';

  // Paleta derivada das duas cores do inimigo; branca no instante em que ele leva um golpe
  const palettes = new Map();
  const FLASH = { main: '#fff4dc', dark: '#fff4dc', light: '#ffffff', shade: '#f0e4c8', skin: '#fff4dc', metal: '#fff4dc', metalLight: '#ffffff', ink: '#5a4a30', eye: '#5a4a30' };
  function paletteOf(type, d) {
    let p = palettes.get(type);
    if (!p) {
      const form = formOf(type, d);
      const skin = SKIN[type] || (form === 'hum' || form === 'robe' ? HUMAN_SKIN : d.color);
      p = {
        main: d.color, dark: d.dark, light: mix(d.color, '#ffffff', 0.35), shade: mix(d.color, d.dark, 0.5),
        skin, skinShade: mix(skin, d.dark, 0.35), metal: '#9aa4ae', metalLight: '#d4dae0', ink: mix(d.dark, '#000000', 0.45), eye: '#1a1410',
      };
      palettes.set(type, p);
    }
    return p;
  }

  // ---------- Primitivas (no espaço local) ----------
  let LW = 1; // espessura do contorno no espaço local, para dar ~1,3 px na tela

  function fillStroke(g, fill, ink) { g.fillStyle = fill; g.fill(); g.strokeStyle = ink; g.lineWidth = LW; g.stroke(); }
  // Membro grosso com contorno: traço largo escuro e, por cima, o traço da cor
  function limb(g, x1, y1, x2, y2, w, color, ink) {
    g.lineCap = 'round';
    g.strokeStyle = ink; g.lineWidth = w + LW * 2;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = color; g.lineWidth = w;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.lineCap = 'butt';
  }
  function ball(g, x, y, r, fill, ink) { circle(g, x, y, r); fillStroke(g, fill, ink); }
  function oval(g, x, y, rx, ry, fill, ink, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); fillStroke(g, fill, ink); }

  // ---------- Armas ----------
  function weapon(g, kind, P, hx, hy, swing) {
    if (kind === 'spear') {
      limb(g, hx - 4, hy + 7, hx + 5, hy - 13, 1.4, '#7a5a36', P.ink);
      g.beginPath(); g.moveTo(hx + 7.2, hy - 17.5); g.lineTo(hx + 3.4, hy - 12.4); g.lineTo(hx + 6.2, hy - 11.4); g.closePath();
      fillStroke(g, '#e4e0d4', P.ink);
    } else if (kind === 'dagger') {
      g.beginPath(); g.moveTo(hx + 1, hy - 1); g.lineTo(hx + 8, hy - 3.5); g.lineTo(hx + 1.5, hy + 1); g.closePath();
      fillStroke(g, '#e4e0d4', P.ink);
    } else if (kind === 'axe') {
      const a = -1.1 + swing * 0.15;
      const tx = hx + Math.cos(a) * 11, ty = hy + Math.sin(a) * 11;
      limb(g, hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, tx, ty, 1.5, '#7a5a36', P.ink);
      g.beginPath(); g.moveTo(tx - 1, ty + 1); g.quadraticCurveTo(tx + 6, ty - 1, tx + 4, ty + 6); g.closePath();
      fillStroke(g, '#d8d4c8', P.ink);
    } else if (kind === 'sword') {
      limb(g, hx, hy, hx + 3, hy - 15, 2.2, '#dfe4ea', P.ink);
      limb(g, hx - 2.5, hy - 1, hx + 3, hy - 2, 1.4, '#d6a547', P.ink);
    } else if (kind === 'mace') {
      limb(g, hx, hy + 2, hx + 3, hy - 9, 1.6, '#6a5036', P.ink);
      ball(g, hx + 3.4, hy - 10.5, 3, P.metal, P.ink);
    } else if (kind === 'staff') {
      limb(g, hx, hy + 10, hx + 1.5, hy - 15, 1.4, '#7a5a36', P.ink);
      g.fillStyle = mix(P.main === FLASH.main ? '#fff4dc' : P.main, '#ffffff', 0.55);
      g.globalAlpha *= 0.45; circle(g, hx + 1.6, hy - 17, 4.4); g.fill(); g.globalAlpha /= 0.45;
      ball(g, hx + 1.6, hy - 17, 2.4, P.light, P.ink);
    } else if (kind === 'bow') {
      // arco erguido à frente, com a corda puxada até soltar a flecha
      const pull = swing > 0.5 ? 0 : 3;
      g.strokeStyle = P.ink; g.lineWidth = 2.6; g.beginPath(); g.arc(hx + 1, hy - 1, 7, -1.25, 1.25); g.stroke();
      g.strokeStyle = '#a77b3c'; g.lineWidth = 1.5; g.stroke();
      const ex = hx + 1 + 7 * Math.cos(1.25), ey = 7 * Math.sin(1.25);
      g.strokeStyle = '#efe6cf'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(ex, hy - 1 - ey); g.lineTo(ex - pull, hy - 1); g.lineTo(ex, hy - 1 + ey); g.stroke();
      if (pull) { g.strokeStyle = '#8a5a2b'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(ex - pull, hy - 1); g.lineTo(hx + 10, hy - 1); g.stroke(); }
    } else if (kind === 'claws') {
      g.strokeStyle = '#f2ecd8'; g.lineWidth = 1;
      g.beginPath();
      for (const o of [-1.4, 0, 1.4]) { g.moveTo(hx + 1, hy + o); g.lineTo(hx + 4.5, hy + o - 1.2); }
      g.stroke();
    }
  }
  function weaponOf(type, d, look) {
    if (WEAPONS[type]) return WEAPONS[type];
    if (look.includes('sword')) return 'sword';
    if (look.includes('bow')) return 'bow';
    if (look.includes('spear')) return 'spear';
    if (look.includes('dagger')) return 'dagger';
    if (look.includes('axe')) return 'axe';
    if (look.includes('claws')) return 'claws';
    if (d.role === 'boss') return 'sword';
    if (d.role === 'brute') return 'mace';
    return null;
  }

  // ---------- Cabeça e acessórios ----------
  // A cabeça é um círculo em (hx, hy) de raio hr, olhando para a direita
  function head(g, P, look, hx, hy, hr, armored) {
    if (look.includes('hood')) {
      // capuz fundo: rosto na sombra e dois olhos que brilham
      g.beginPath(); g.moveTo(hx - hr * 1.15, hy + hr * 0.9); g.quadraticCurveTo(hx - hr * 1.2, hy - hr * 1.5, hx + hr * 0.3, hy - hr * 1.35);
      g.quadraticCurveTo(hx + hr * 1.4, hy - hr * 0.6, hx + hr * 1.2, hy + hr * 0.9); g.closePath();
      fillStroke(g, P.shade, P.ink);
      oval(g, hx + hr * 0.25, hy + hr * 0.1, hr * 0.75, hr * 0.7, '#120e10', P.ink);
      g.fillStyle = '#9af0a0';
      circle(g, hx + hr * 0.05, hy, hr * 0.17); g.fill(); circle(g, hx + hr * 0.6, hy, hr * 0.17); g.fill();
      return;
    }
    if (armored) {
      // elmo fechado com viseira
      g.beginPath(); g.arc(hx, hy, hr * 1.05, Math.PI * 0.9, Math.PI * 2.1); g.lineTo(hx + hr * 1.05, hy + hr * 0.95); g.lineTo(hx - hr * 1.05, hy + hr * 0.95); g.closePath();
      fillStroke(g, P.metal, P.ink);
      g.fillStyle = P.metalLight; g.beginPath(); g.ellipse(hx - hr * 0.4, hy - hr * 0.45, hr * 0.35, hr * 0.22, -0.5, 0, TAU); g.fill();
      g.fillStyle = '#1a1e22'; rr(g, hx - hr * 0.1, hy - hr * 0.1, hr * 1.1, hr * 0.32, hr * 0.12); g.fill();
      if (look.includes('crown')) crown(g, hx, hy - hr * 1.05, hr);
      return;
    }
    // rosto: pele com bochecha mais escura embaixo e um olho para a frente
    ball(g, hx, hy, hr, P.skin, P.ink);
    g.fillStyle = P.skinShade; g.beginPath(); g.arc(hx, hy, hr - LW / 2, 0.15 * Math.PI, 0.85 * Math.PI); g.fill();
    if (look.includes('bones')) {
      g.fillStyle = '#2a2620';
      circle(g, hx + hr * 0.15, hy - hr * 0.1, hr * 0.28); g.fill(); circle(g, hx + hr * 0.7, hy - hr * 0.1, hr * 0.22); g.fill();
    } else if (!look.includes('bulge')) {
      g.fillStyle = P.eye; g.beginPath(); g.ellipse(hx + hr * 0.5, hy - hr * 0.15, hr * 0.15, hr * 0.24, 0, 0, TAU); g.fill();
      g.strokeStyle = P.ink; g.lineWidth = LW * 0.8;
      g.beginPath(); g.moveTo(hx + hr * 0.25, hy - hr * 0.5); g.lineTo(hx + hr * 0.75, hy - hr * 0.42); g.stroke();
    }
    if (!look.some(k => COVERS.has(k))) {
      // cabelo curto no alto e atrás da cabeça
      g.beginPath(); g.arc(hx, hy, hr, Math.PI * 0.95, Math.PI * 1.75); g.quadraticCurveTo(hx - hr * 0.2, hy - hr * 0.55, hx - hr * 0.95, hy + hr * 0.15); g.closePath();
      fillStroke(g, P.dark, P.ink);
    }
    for (const k of look) if (HEADWEAR[k]) HEADWEAR[k](g, P, hx, hy, hr);
  }

  function crown(g, x, y, hr) {
    g.beginPath();
    g.moveTo(x - hr * 0.9, y + hr * 0.25); g.lineTo(x - hr * 0.9, y - hr * 0.6); g.lineTo(x - hr * 0.45, y - hr * 0.1);
    g.lineTo(x, y - hr * 0.8); g.lineTo(x + hr * 0.45, y - hr * 0.1); g.lineTo(x + hr * 0.9, y - hr * 0.6); g.lineTo(x + hr * 0.9, y + hr * 0.25); g.closePath();
    fillStroke(g, '#e0b44a', '#5a3e0c');
    g.fillStyle = '#c0392b'; circle(g, x, y - hr * 0.05, hr * 0.14); g.fill();
  }

  const HEADWEAR = {
    // capuz aberto que emoldura o rosto (Arqueira)
    cowl(g, P, x, y, r) {
      g.beginPath(); g.arc(x - r * 0.15, y, r * 1.18, Math.PI * 0.55, Math.PI * 1.85); g.quadraticCurveTo(x + r * 0.2, y - r * 0.6, x - r * 0.2, y + r * 0.1);
      g.quadraticCurveTo(x - r * 0.5, y + r * 0.8, x - r * 0.55, y + r * 1.1); g.closePath();
      fillStroke(g, P.shade, P.ink);
    },
    crown: (g, P, x, y, r) => crown(g, x, y - r * 0.95, r),
    hat(g, P, x, y, r) {
      oval(g, x, y - r * 0.55, r * 1.55, r * 0.38, P.dark, P.ink);
      g.beginPath(); g.moveTo(x - r * 0.75, y - r * 0.65); g.quadraticCurveTo(x - r * 0.2, y - r * 2.2, x - r * 1.2, y - r * 3.1);
      g.quadraticCurveTo(x + r * 0.4, y - r * 2.4, x + r * 0.8, y - r * 0.65); g.closePath();
      fillStroke(g, P.dark, P.ink);
      g.fillStyle = P.light; g.fillRect(x - r * 0.7, y - r * 0.95, r * 1.45, r * 0.25);
    },
    turban(g, P, x, y, r) {
      oval(g, x - r * 0.1, y - r * 0.6, r * 1.05, r * 0.7, '#ece2c8', '#6a5a3a');
      g.strokeStyle = '#c8b890'; g.lineWidth = LW;
      g.beginPath(); g.moveTo(x - r * 0.9, y - r * 0.5); g.quadraticCurveTo(x, y - r * 1.1, x + r * 0.9, y - r * 0.6); g.stroke();
      g.fillStyle = '#c0392b'; circle(g, x + r * 0.55, y - r * 0.55, r * 0.18); g.fill();
    },
    bandana(g, P, x, y, r) {
      g.beginPath(); g.arc(x, y, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); g.closePath();
      fillStroke(g, '#c0392b', P.ink);
      g.beginPath(); g.moveTo(x - r * 0.9, y - r * 0.3); g.lineTo(x - r * 1.7, y + r * 0.1); g.lineTo(x - r * 1.5, y - r * 0.6); g.closePath();
      fillStroke(g, '#a02a20', P.ink);
      g.fillStyle = '#f2ece0'; circle(g, x - r * 0.2, y - r * 0.6, r * 0.12); g.fill(); circle(g, x + r * 0.4, y - r * 0.55, r * 0.12); g.fill();
    },
    tricorn(g, P, x, y, r) {
      g.beginPath(); g.moveTo(x - r * 1.6, y - r * 0.5); g.quadraticCurveTo(x, y - r * 0.1, x + r * 1.6, y - r * 0.5);
      g.lineTo(x + r * 0.8, y - r * 1.5); g.quadraticCurveTo(x, y - r * 2, x - r * 0.8, y - r * 1.5); g.closePath();
      fillStroke(g, '#1e1a18', '#000000');
      g.strokeStyle = '#d6a547'; g.lineWidth = LW;
      g.beginPath(); g.moveTo(x - r * 1.45, y - r * 0.55); g.quadraticCurveTo(x, y - r * 0.2, x + r * 1.45, y - r * 0.55); g.stroke();
      g.fillStyle = '#f2ece0'; circle(g, x, y - r * 1.1, r * 0.2); g.fill();
    },
    horns(g, P, x, y, r) {
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x + s * r * 0.35, y - r * 0.75); g.quadraticCurveTo(x + s * r * 1.3, y - r * 0.9, x + s * r * 1.05, y - r * 1.9);
        g.quadraticCurveTo(x + s * r * 0.8, y - r * 1.1, x + s * r * 0.75, y - r * 0.55); g.closePath();
        fillStroke(g, '#ece0c4', P.ink);
      }
    },
    ears(g, P, x, y, r) {
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x + s * r * 0.15 - r * 0.2, y - r * 0.8); g.lineTo(x + s * r * 0.6 - r * 0.2, y - r * 1.9); g.lineTo(x + s * r * 0.95 - r * 0.2, y - r * 0.55); g.closePath();
        fillStroke(g, P.skin, P.ink);
      }
    },
    lamp(g, P, x, y, r) {
      g.beginPath(); g.arc(x, y - r * 0.1, r * 1.08, Math.PI, 0); g.closePath();
      fillStroke(g, '#c9a04a', P.ink);
      ball(g, x + r * 0.7, y - r * 0.7, r * 0.32, '#fff2b0', P.ink);
    },
    antennae(g, P, x, y, r) {
      g.strokeStyle = P.ink; g.lineWidth = LW;
      g.beginPath();
      for (const s of [0, 0.6]) { g.moveTo(x + r * s, y - r * 0.8); g.quadraticCurveTo(x + r * (s + 0.4), y - r * 2, x + r * (s + 1.2), y - r * 1.9); }
      g.stroke();
    },
    bulge(g, P, x, y, r) {
      for (const s of [-0.2, 0.6]) {
        ball(g, x + r * s, y - r * 0.85, r * 0.42, P.skin, P.ink);
        g.fillStyle = '#f2e9a0'; circle(g, x + r * (s + 0.08), y - r * 0.9, r * 0.25); g.fill();
        g.fillStyle = '#1a1a10'; circle(g, x + r * (s + 0.13), y - r * 0.9, r * 0.11); g.fill();
      }
    },
    fur(g, P, x, y, r) {
      g.fillStyle = mix(P.main === FLASH.main ? '#fff4dc' : P.main, '#ffffff', 0.5);
      g.beginPath(); g.moveTo(x - r, y - r * 0.2);
      for (let i = 0; i <= 6; i++) g.lineTo(x - r + i * r / 3, y - r * (i % 2 ? 1.25 : 0.9));
      g.lineTo(x + r, y - r * 0.2); g.closePath(); g.fill();
    },
    flame(g, P, x, y, r) {
      g.fillStyle = 'rgba(255,150,50,.95)';
      g.beginPath(); g.moveTo(x - r * 0.8, y - r * 0.6); g.quadraticCurveTo(x - r * 0.9, y - r * 1.9, x - r * 0.1, y - r * 2.3);
      g.quadraticCurveTo(x - r * 0.1, y - r * 1.5, x + r * 0.5, y - r * 1.9); g.quadraticCurveTo(x + r * 0.9, y - r * 1.1, x + r * 0.8, y - r * 0.6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,230,140,.95)'; g.beginPath(); g.ellipse(x, y - r * 1.05, r * 0.35, r * 0.5, 0, 0, TAU); g.fill();
    },
    leaf(g, P, x, y, r) {
      for (const [dx, a] of [[-0.5, -0.9], [0.2, -0.3], [0.8, 0.3]]) {
        g.beginPath(); g.ellipse(x + r * dx, y - r * 1.05, r * 0.55, r * 0.25, a, 0, TAU);
        fillStroke(g, '#7fb84e', '#2e5418');
      }
    },
    tusks(g, P, x, y, r) {
      g.fillStyle = '#f2ecd8'; g.strokeStyle = P.ink; g.lineWidth = LW * 0.7;
      g.beginPath(); g.moveTo(x + r * 0.55, y + r * 0.35); g.lineTo(x + r * 0.75, y - r * 0.25); g.lineTo(x + r * 0.9, y + r * 0.4); g.closePath(); g.fill(); g.stroke();
    },
    eye(g, P, x, y, r) {
      // máscara do camuflado: faixa escura e olhos amarelos
      g.fillStyle = 'rgba(20,24,20,.85)'; rr(g, x - r * 0.9, y - r * 0.45, r * 1.95, r * 0.55, r * 0.2); g.fill();
      g.fillStyle = '#f0d27a'; circle(g, x + r * 0.2, y - r * 0.18, r * 0.16); g.fill(); circle(g, x + r * 0.75, y - r * 0.18, r * 0.14); g.fill();
    },
    wraps(g, P, x, y, r) {
      g.strokeStyle = 'rgba(240,232,210,.85)'; g.lineWidth = LW * 1.2;
      g.beginPath();
      for (const k of [-0.55, 0.05, 0.55]) { g.moveTo(x - r * 0.95, y + r * k); g.lineTo(x + r * 0.95, y + r * (k - 0.25)); }
      g.stroke();
    },
  };

  // ---------- Corpo do humanoide (pernas, tronco, braços) ----------
  function torsoMarks(g, P, look, armored) {
    if (armored) {
      // ombreiras e placa do peito
      ball(g, -4.6, -5.6, 2.6, P.metal, P.ink); ball(g, 4.4, -5.6, 2.6, P.metal, P.ink);
      g.fillStyle = P.main; g.fillRect(-1.6, -3.5, 3.2, 6.5);
    }
    if (look.includes('cross')) { g.fillStyle = '#f2f7ee'; g.fillRect(-0.8, -4.2, 1.6, 5.2); g.fillRect(-2.6, -2.4, 5.2, 1.6); }
    if (look.includes('drop')) {
      g.fillStyle = '#d8f2f6';
      g.beginPath(); g.moveTo(0, -4.6); g.quadraticCurveTo(2.6, -1.2, 0, 0.4); g.quadraticCurveTo(-2.6, -1.2, 0, -4.6); g.fill();
    }
    if (look.includes('stripes')) {
      g.strokeStyle = P.dark; g.lineWidth = LW;
      g.beginPath(); for (const x of [-3, 0, 3]) { g.moveTo(x - 1, -5.5); g.lineTo(x + 1, 2.5); } g.stroke();
    }
    if (look.includes('bones')) {
      g.strokeStyle = '#2a2620'; g.lineWidth = LW;
      g.beginPath(); for (const y of [-4, -2, 0]) { g.moveTo(-3.5, y); g.lineTo(3.5, y); } g.moveTo(0, -5.5); g.lineTo(0, 2); g.stroke();
    }
    if (look.includes('wraps')) HEADWEAR.wraps(g, P, 0, -2, 5);
    if (look.includes('fur')) {
      // gola de pele
      g.fillStyle = mix(P.main === FLASH.main ? '#fff4dc' : P.main, '#ffffff', 0.5);
      g.beginPath(); g.moveTo(-5.5, -5);
      for (let i = 0; i <= 6; i++) g.lineTo(-5.5 + i * 11 / 6, i % 2 ? -3.4 : -6.8);
      g.closePath(); g.fill();
    }
  }

  function humanoid(g, P, d, look, ph, type) {
    const sw = Math.sin(ph) * 3, lift = Math.max(0, Math.cos(ph)) * 0.8;
    const armored = look.some(k => ARMORED.has(k)) || ARMORED_TYPES.has(type);
    const legColor = armored ? P.metal : P.dark;
    // perna de trás, mais escura
    limb(g, -1.2, 2, -1.2 - sw, 8.6 - lift, 3.2, mix(d.dark, '#000000', 0.25), P.ink);
    // capa do chefe (e do Cavaleiro) atrás do corpo
    if (d.boss || look.includes('cape')) {
      g.beginPath(); g.moveTo(-4.5, -6); g.quadraticCurveTo(-9 - sw * 0.4, 2, -8 - sw * 0.6, 9); g.lineTo(-1, 8); g.lineTo(2, -6); g.closePath();
      fillStroke(g, P.dark, P.ink);
    }
    if (look.includes('shell')) oval(g, -4.5, -2.5, 4.5, 6, P.shade, P.ink);
    limb(g, 1.2, 2, 1.2 + sw, 8.6 - (1 - lift), 3.2, legColor, P.ink);
    // braço de trás, com escudo redondo para quem tem
    limb(g, -2.5, -4.5, -4 - sw * 0.5, 1.2, 2.4, P.shade, P.ink);
    if (look.includes('shield')) {
      ball(g, -4.5 - sw * 0.4, -0.5, 4.4, P.accent || '#8a3a2a', P.ink);
      g.strokeStyle = '#d6a547'; g.lineWidth = LW; circle(g, -4.5 - sw * 0.4, -0.5, 3); g.stroke();
    }
    // tronco com luz à esquerda e cinto
    rr(g, -5.5, -7, 11, 10, 3.2);
    fillStroke(g, armored ? P.metal : P.main, P.ink);
    g.fillStyle = armored ? P.metalLight : P.light; g.globalAlpha *= 0.7;
    rr(g, -4.4, -6, 2.6, 7.5, 1.3); g.fill(); g.globalAlpha /= 0.7;
    g.fillStyle = P.ink; g.fillRect(-5.5, 1, 11, 1.4);
    torsoMarks(g, P, look, armored);
    head(g, P, look, 0.8, -11.4, 4.8, armored);
    // braço da frente com a arma
    const kind = weaponOf(type, d, look);
    const hx = kind ? 6.2 : 5 + sw * 0.4, hy = kind ? -1 : 0.5;
    limb(g, 2.6, -4.5, hx, hy, 2.4, armored ? P.metal : P.main, P.ink);
    if (kind) {
      // golpe: a arma gira em volta da mão (d.attack de 0 a 1, só heróis e soldados)
      const a = d.attack && kind !== 'bow' ? Math.sin(d.attack * Math.PI) * 1.3 : 0;
      g.save(); g.translate(hx, hy); g.rotate(a); g.translate(-hx, -hy);
      weapon(g, kind, P, hx, hy, kind === 'bow' ? d.attack || 0 : sw);
      g.restore();
    }
    ball(g, hx, hy, 1.6, armored ? P.metal : P.skin, P.ink);
  }

  // Manto até o chão: pés aparecem por baixo da barra e o cajado na mão
  function robed(g, P, d, look, ph) {
    const sw = Math.sin(ph) * 2;
    ball(g, -1.5 - sw, 8.5, 1.8, P.ink, P.ink); ball(g, 1.5 + sw, 8.5, 1.8, P.ink, P.ink);
    limb(g, -2.5, -4.5, -4.5, 0.5, 2.4, P.shade, P.ink);
    g.beginPath(); g.moveTo(-4.5, -7); g.lineTo(4.5, -7);
    g.lineTo(7.5, 8.5 + sw * 0.2); g.quadraticCurveTo(0, 10 - sw * 0.3, -7.5, 8.5 - sw * 0.2); g.closePath();
    fillStroke(g, P.main, P.ink);
    g.fillStyle = P.light; g.globalAlpha *= 0.55;
    g.beginPath(); g.moveTo(-3.5, -6); g.lineTo(-1.5, -6); g.lineTo(-2.5, 8); g.lineTo(-5.5, 8); g.closePath(); g.fill(); g.globalAlpha /= 0.55;
    g.strokeStyle = P.dark; g.lineWidth = LW * 1.4; g.beginPath(); g.moveTo(-4.8, 0.5); g.lineTo(4.8, 0.5); g.stroke();
    torsoMarks(g, P, look, false);
    head(g, P, look, 0.8, -11.4, 4.8, false);
    limb(g, 2.6, -4.5, 6.4, -1, 2.4, P.main, P.ink);
    weapon(g, 'staff', P, 6.4, -1, 0);
    ball(g, 6.4, -1, 1.6, P.skin, P.ink);
  }

  // Fantasma: manto translúcido que termina numa cauda ondulante, sem pés
  function ghostly(g, P, d, look, ph) {
    const w = Math.sin(ph * 0.8) * 1.5;
    g.globalAlpha *= 0.82;
    g.beginPath(); g.moveTo(-5, -7); g.lineTo(5, -7); g.quadraticCurveTo(8, 2, 6 + w, 6);
    g.quadraticCurveTo(3, 4, 1.5 - w, 9); g.quadraticCurveTo(-1, 4.5, -3 + w, 8); g.quadraticCurveTo(-6, 3, -7, 5 - w); g.closePath();
    fillStroke(g, P.main, P.ink);
    g.fillStyle = P.light; g.globalAlpha *= 0.6;
    g.beginPath(); g.moveTo(-3.5, -6); g.lineTo(-1.5, -6); g.lineTo(-3, 4); g.lineTo(-5, 3); g.closePath(); g.fill();
    g.globalAlpha /= 0.6;
    torsoMarks(g, P, look, false);
    head(g, P, look, 0.8, -11.4, 4.8, false);
    limb(g, 2.6, -4.5, 7, -2 + w, 2, P.main, P.ink);
    g.globalAlpha /= 0.82;
  }

  // Golem: tronco enorme, cabeça afundada e braços que quase arrastam no chão
  function golem(g, P, d, look, ph) {
    const sw = Math.sin(ph) * 1.8;
    if (look.includes('legs')) {
      // tentáculos do Kraken no lugar das pernas
      g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const x = -7 + i * 3.5, t = Math.sin(ph + i) * 2;
        g.strokeStyle = P.ink; g.lineWidth = 3.4 + LW * 2;
        g.beginPath(); g.moveTo(x, 2); g.quadraticCurveTo(x + t, 6, x + 2 + t, 9); g.stroke();
        g.strokeStyle = P.shade; g.lineWidth = 3.4;
        g.beginPath(); g.moveTo(x, 2); g.quadraticCurveTo(x + t, 6, x + 2 + t, 9); g.stroke();
      }
      g.lineCap = 'butt';
    } else {
      rr(g, -6.5 - sw * 0.5, 1, 5, 8.5, 1.5); fillStroke(g, P.shade, P.ink);
      rr(g, 1.5 + sw * 0.5, 1, 5, 8.5, 1.5); fillStroke(g, P.main, P.ink);
    }
    if (look.includes('shell')) oval(g, -2, -5, 11, 8.5, P.shade, P.ink);
    rr(g, -9, -12, 4.5, 13, 2); fillStroke(g, P.shade, P.ink);
    rr(g, -7.5, -14, 15, 15, 4); fillStroke(g, P.main, P.ink);
    g.fillStyle = P.light; g.globalAlpha *= 0.6; rr(g, -6.2, -12.8, 4, 11, 2); g.fill(); g.globalAlpha /= 0.6;
    if (look.includes('cracks')) {
      g.strokeStyle = look.includes('flame') ? '#ff9a3a' : P.ink; g.lineWidth = LW * 1.3;
      g.beginPath(); g.moveTo(-3, -13); g.lineTo(-1, -8); g.lineTo(-4, -4); g.moveTo(3, -10); g.lineTo(5, -5); g.lineTo(2, -1); g.stroke();
    }
    if (look.includes('wraps')) {
      g.strokeStyle = P.ink; g.lineWidth = LW;
      g.beginPath(); for (const y of [-10, -5]) { g.moveTo(-6, y); g.lineTo(6, y + 1.5); for (let x = -5; x <= 5; x += 2) { g.moveTo(x, y - 0.5); g.lineTo(x + 0.6, y + 2); } } g.stroke();
    }
    if (look.includes('leaf')) HEADWEAR.leaf(g, P, 0, -11, 7);
    // cabeça pequena, olhos acesos
    rr(g, -0.5, -18, 7.5, 6.5, 2); fillStroke(g, P.main, P.ink);
    g.fillStyle = look.includes('flame') ? '#ffb84a' : '#f0d27a';
    g.fillRect(3, -16, 1.6, 1.6); g.fillRect(5.4, -16, 1.4, 1.6);
    if (look.includes('ears')) HEADWEAR.ears(g, P, 3, -15, 3.5);
    rr(g, 5.5, -11, 5, 14 + sw * 0.3, 2.2); fillStroke(g, P.main, P.ink);
    ball(g, 8, 4 + sw * 0.3, 3, P.shade, P.ink);
  }

  // Quadrúpede de perfil: corpo, quatro patas em passo trocado, cabeça com focinho e cauda
  function beast(g, P, d, look, ph) {
    const sw = Math.sin(ph) * 2.6;
    for (const [x, s, back] of [[-6, 1, true], [4, -1, true], [-5, -1, false], [5, 1, false]]) {
      limb(g, x, 0, x + sw * s, 8.5, 2.6, back ? P.shade : P.main, P.ink);
    }
    // cauda
    g.strokeStyle = P.ink; g.lineWidth = 2 + LW * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-9, -3); g.quadraticCurveTo(-13, -4, -13 + sw * 0.3, -8); g.stroke();
    g.strokeStyle = P.main; g.lineWidth = 2; g.stroke(); g.lineCap = 'butt';
    oval(g, -0.5, -2.5, 10, 6, P.main, P.ink);
    g.fillStyle = P.light; g.globalAlpha *= 0.6; g.beginPath(); g.ellipse(-2, -5, 6.5, 2.3, 0, 0, TAU); g.fill(); g.globalAlpha /= 0.6;
    if (look.includes('fur')) {
      g.fillStyle = mix(P.main === FLASH.main ? '#fff4dc' : P.main, '#ffffff', 0.4);
      g.beginPath(); g.moveTo(-8, -6); for (let i = 0; i <= 7; i++) g.lineTo(-8 + i * 2.2, -8.3 + (i % 2) * 2); g.lineTo(7, -5); g.closePath(); g.fill();
    }
    if (look.includes('stripes')) {
      g.strokeStyle = P.dark; g.lineWidth = LW * 1.3;
      g.beginPath(); for (const x of [-5, -1.5, 2]) { g.moveTo(x, -8); g.lineTo(x + 1, -1); } g.stroke();
    }
    // cabeça e focinho
    ball(g, 9, -6.5, 4.4, P.main, P.ink);
    oval(g, 12.8, -5, 2.8, 2, P.light, P.ink);
    g.fillStyle = P.eye; circle(g, 10.4, -7.6, 0.85); g.fill();
    g.fillStyle = P.ink; circle(g, 15.2, -5.4, 0.8); g.fill();
    if (look.includes('ears') || look.includes('bigsquare')) {
      g.beginPath(); g.moveTo(7, -9.5); g.lineTo(7.8, -13.5); g.lineTo(10, -10); g.closePath(); fillStroke(g, P.shade, P.ink);
    }
    if (look.includes('tusks')) {
      g.fillStyle = '#f2ecd8'; g.beginPath(); g.moveTo(12, -3.8); g.lineTo(13.5, -8); g.lineTo(14, -3.6); g.closePath(); g.fill();
    }
    if (look.includes('horns')) HEADWEAR.horns(g, P, 9, -6.5, 3.5);
    if (look.includes('crown')) crown(g, 9, -10.5, 3.8);
  }

  // Inseto de perfil: abdômen, tórax e cabeça, seis patas finas
  function bug(g, P, d, look, ph) {
    const sw = Math.sin(ph * 1.4) * 2, many = look.includes('legs');
    g.strokeStyle = P.ink; g.lineWidth = LW * 1.4;
    g.beginPath();
    const feet = many ? [-6, -3, 0, 3] : [-4, 0, 4];
    feet.forEach((x, i) => {
      const s = (i % 2 ? 1 : -1) * sw;
      g.moveTo(x * 0.5, -2); g.lineTo(x + s - 1, -6); g.lineTo(x * 1.4 + s, 8);
      g.moveTo(x * 0.5, -2); g.lineTo(x - s + 1, 2); g.lineTo(x * 1.2 - s + 1.5, 8.5);
    });
    g.stroke();
    oval(g, -6, -2, 6.5, 5, P.main, P.ink);
    if (look.includes('stripes')) {
      g.strokeStyle = P.dark; g.lineWidth = LW * 1.3;
      g.beginPath(); for (const x of [-9, -6, -3]) { g.moveTo(x, -6.5); g.lineTo(x, 2.5); } g.stroke();
    }
    if (look.includes('shell') || look.includes('square')) {
      g.strokeStyle = P.light; g.lineWidth = LW * 1.2;
      g.beginPath(); g.moveTo(-12, -2.5); g.quadraticCurveTo(-6, -8, 0, -3); g.stroke();
    }
    oval(g, 1.5, -3, 3.5, 3, P.shade, P.ink);
    ball(g, 6.5, -4.5, 3, P.main, P.ink);
    g.fillStyle = '#f0d27a'; circle(g, 7.6, -5.2, 0.9); g.fill();
    if (look.includes('antennae')) HEADWEAR.antennae(g, P, 6.5, -4.5, 3);
    if (look.includes('claws')) {
      for (const s of [0, 1]) {
        const y = -2 + s * 2.5;
        limb(g, 7, y, 11, y - 1.5, 1.4, P.shade, P.ink);
        g.beginPath(); g.arc(12.5, y - 2, 2.4, 0.6, TAU - 0.6); g.lineTo(12.5, y - 2); g.closePath(); fillStroke(g, P.main, P.ink);
      }
    }
  }

  // Verme: segmentos em onda, cabeça na frente com boca aberta
  function worm(g, P, d, look, ph) {
    for (let i = 4; i >= 0; i--) {
      const x = -11 + i * 4.4, y = 2 + Math.sin(ph * 1.2 - i * 0.9) * 2.2, r = 3.2 + i * 0.45;
      ball(g, x, y - r * 0.4, r, i % 2 ? P.shade : P.main, P.ink);
      if (look.includes('flame') && i % 2 === 0) { g.fillStyle = 'rgba(255,170,60,.85)'; circle(g, x, y - r * 0.4, r * 0.4); g.fill(); }
    }
    const hy = 2 + Math.sin(ph * 1.2 - 4.5) * 2.2 - 2.6;
    g.fillStyle = P.light; circle(g, 6.2, hy - 1.5, 1.4); g.fill();
    g.fillStyle = '#f0d27a'; circle(g, 8.2, hy - 1.6, 1); g.fill();
    g.fillStyle = '#2a0e0e'; g.beginPath(); g.ellipse(10.4, hy + 1, 1.5, 2.2, 0, 0, TAU); g.fill();
  }

  // ---------- Voadores ----------
  function bird(g, P, d, look, flap) {
    const up = (flap - 0.5) * 9;
    g.beginPath(); g.moveTo(-1, -1); g.quadraticCurveTo(-6, -6 - up, -12, -4 - up * 1.4); g.quadraticCurveTo(-7, 0, -1, 2); g.closePath();
    fillStroke(g, P.shade, P.ink);
    g.beginPath(); g.moveTo(-7, 0); g.lineTo(-12, -2); g.lineTo(-11, 2); g.closePath(); fillStroke(g, P.dark, P.ink);
    oval(g, 0, 0, 6.5, 4, P.main, P.ink);
    ball(g, 6, -2.5, 3.2, P.main, P.ink);
    g.beginPath(); g.moveTo(8.5, -3.2); g.lineTo(13, -1.8); g.lineTo(8.5, -0.8); g.closePath(); fillStroke(g, '#e0a83a', P.ink);
    g.fillStyle = P.eye; circle(g, 6.8, -3.2, 0.8); g.fill();
    g.beginPath(); g.moveTo(1, -1); g.quadraticCurveTo(-3, -8 + up, -9, -9 + up * 1.4); g.quadraticCurveTo(-4, -2, 1, 1.5); g.closePath();
    fillStroke(g, P.main, P.ink);
  }
  function bat(g, P, d, look, flap) {
    const up = (flap - 0.5) * 10;
    const wing = (s, fill) => {
      g.beginPath(); g.moveTo(0, -1);
      g.lineTo(s * 6, -6 - up); g.lineTo(s * 13, -4 - up * 1.2);
      g.quadraticCurveTo(s * 10.5, -1, s * 11, 2 - up * 0.3); g.quadraticCurveTo(s * 8, 0.5, s * 7, 3); g.quadraticCurveTo(s * 4, 1, 0, 2.5); g.closePath();
      fillStroke(g, fill, P.ink);
    };
    wing(-1, P.dark); wing(1, P.shade);
    oval(g, 0, 0, 4.2, 4.8, P.main, P.ink);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.2, -3.8); g.lineTo(s * 2.8, -8); g.lineTo(s * 3.4, -3); g.closePath(); fillStroke(g, P.main, P.ink); }
    g.fillStyle = look.includes('flame') ? '#ffb84a' : '#f0c75a'; circle(g, -1.4, -1, 0.9); g.fill(); circle(g, 1.4, -1, 0.9); g.fill();
    if (look.includes('horns')) HEADWEAR.horns(g, P, 0, -1.5, 2.8);
    if (look.includes('flame')) HEADWEAR.flame(g, P, 0, -2, 2.6);
  }
  function dragon(g, P, d, look, flap) {
    const up = (flap - 0.5) * 9;
    const wing = (back) => {
      g.beginPath(); g.moveTo(-1, -2);
      g.lineTo(-5, -10 - up * (back ? 0.8 : 1.2)); g.lineTo(-12, -9 - up * (back ? 1 : 1.5));
      g.quadraticCurveTo(-10, -4, -12, 0); g.quadraticCurveTo(-8, -1, -6, 1.5); g.quadraticCurveTo(-3, 0, -1, 2); g.closePath();
      fillStroke(g, back ? P.dark : P.shade, P.ink);
      if (!back) {
        g.strokeStyle = P.ink; g.lineWidth = LW * 0.8;
        g.beginPath(); g.moveTo(-5, -10 - up * 1.2); g.lineTo(-6, 1.5); g.moveTo(-5, -10 - up * 1.2); g.lineTo(-10, -3); g.stroke();
      }
    };
    wing(true);
    // cauda e corpo
    g.strokeStyle = P.ink; g.lineWidth = 2.6 + LW * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-6, 1); g.quadraticCurveTo(-12, 4, -15, 1); g.stroke();
    g.strokeStyle = P.main; g.lineWidth = 2.6; g.stroke(); g.lineCap = 'butt';
    oval(g, -1, 0, 7, 4.2, P.main, P.ink);
    g.fillStyle = P.light; g.globalAlpha *= 0.7; g.beginPath(); g.ellipse(-1, 2, 5, 1.6, 0, 0, TAU); g.fill(); g.globalAlpha /= 0.7;
    // pescoço e cabeça
    limb(g, 4, -1, 8, -6, 3, P.main, P.ink);
    oval(g, 10, -6.5, 3.6, 2.6, P.main, P.ink, 0.2);
    g.fillStyle = look.includes('flame') ? '#ffb84a' : '#f0d27a'; circle(g, 10.6, -7.4, 0.8); g.fill();
    for (const s of [0, 1.6]) { g.beginPath(); g.moveTo(8 + s, -8.4); g.lineTo(6 + s, -11.5); g.lineTo(9.4 + s, -8.8); g.closePath(); fillStroke(g, '#ece0c4', P.ink); }
    wing(false);
  }

  const DRAW = { hum: humanoid, robe: robed, ghost: ghostly, golem, beast, bug, worm };
  const FLY = { bird, bat, dragon };

  // ---------- Enquadramento: posição, direção, sombra e efeitos ----------
  // Para onde o inimigo anda; no ícone do Compêndio (sem estrada), para a direita, rumo à muralha
  function heading(e) {
    if (!e.path) return 0;
    const b = e.path.posAt(Math.min(e.path.len, e.dist + 3));
    return b.x === e.x && b.y === e.y ? 0 : Math.atan2(b.y - e.y, b.x - e.x);
  }
  // Vira para a esquerda ou direita conforme anda; subindo ou descendo, mantém o último lado
  function facing(e) {
    if (e.d.flying) {
      const dx = e.path ? e.path.flyAt(e.dist + 3).x - e.x : 1;
      if (Math.abs(dx) > 0.2) e.face = dx < 0 ? -1 : 1;
    } else {
      const c = Math.cos(heading(e));
      if (Math.abs(c) > 0.3) e.face = c < 0 ? -1 : 1;
    }
    return e.face || 1;
  }

  // Tamanho do desenho: o golem e as feras grandes ocupam menos unidades por raio
  const SCALE = { golem: 11.5, beast: 11, dragon: 11, worm: 10.5 };

  function drawEnemy(g, e, reducedMotion) {
    const d = e.d, type = e.type, form = formOf(type, d);
    const P = e.flash > 0 ? FLASH : paletteOf(type, d);
    const look = d.look || [];
    const k = d.r / (SCALE[form] || 10);
    if (e.under) { drawMound(g, e, reducedMotion); return; }
    const hidden = d.stealth && !e.revealed;
    if (hidden) { g.save(); g.globalAlpha *= 0.32; }
    const dir = facing(e);
    if (d.flying) {
      const flap = reducedMotion ? 0.5 : (Math.sin(e.wob * 2.2) + 1) / 2;
      const y = e.y - 12 - (reducedMotion ? 0 : Math.sin(e.wob * 1.1) * 1.5);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(e.x + 3, e.y + 8, d.r * 0.85, d.r * 0.3, 0, 0, TAU); g.fill();
      g.save(); g.translate(e.x, y); g.scale(dir * k, k); LW = 1.3 / k;
      g.lineJoin = 'round';
      (FLY[form] || bat)(g, P, d, look, flap);
      g.restore();
      drawStatus(g, e, e.x, y, d.r * 0.8);
      drawHpBar(g, e, e.x, y - d.r * 0.9, d.r);
      if (hidden) g.restore();
      return;
    }
    const bob = reducedMotion ? 0 : Math.abs(Math.sin(e.wob)) * -0.8;
    const ph = reducedMotion || e.frozenT > 0 ? 0 : e.wob * 1.6;
    // brilho vermelho da fúria e sombra no chão
    if (e.enraged) {
      const p = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(e.wob * 2);
      g.fillStyle = `rgba(230,60,40,${0.2 + 0.15 * p})`; g.beginPath(); g.ellipse(e.x, e.y + 6 * k, d.r * 1.3, d.r * 0.6, 0, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(e.x + 1, e.y + 8.6 * k, d.r * 0.85, d.r * 0.3, 0, 0, TAU); g.fill();
    g.save(); g.translate(e.x, e.y + bob); g.scale(dir * k, k); LW = 1.3 / k;
    g.lineJoin = 'round';
    (DRAW[form] || humanoid)(g, P, d, look, ph, type);
    g.restore();
    const midY = e.y - 3.5 * k * 10 / 10;
    drawStatus(g, e, e.x, midY, d.r);
    drawHpBar(g, e, e.x, e.y - (form === 'golem' ? 19 : form === 'beast' || form === 'bug' || form === 'worm' ? 11 : 17) * k, d.r);
    if (hidden) g.restore();
  }

  // Escavador embaixo da terra: só um monte de terra andando, com a barra de vida
  function drawMound(g, e, reducedMotion) {
    const r = e.d.r, x = e.x, y = e.y + r * 0.3, w = reducedMotion ? 0 : Math.sin(e.wob * 2) * 1.5;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + 3, r * 1.1, r * 0.45, 0, 0, TAU); g.fill();
    g.fillStyle = '#6a5236'; g.beginPath(); g.ellipse(x, y, r * 1.05 + w, r * 0.55, 0, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#8a7050';
    for (const [dx, dy] of [[-0.5, -0.25], [0.2, -0.4], [0.55, -0.15]]) { circle(g, x + dx * r, y + dy * r, 1.6); g.fill(); }
    drawStatus(g, e, x, y - 2, r * 0.8);
    drawHpBar(g, e, x, y - r * 0.4, r);
  }

  function drawStatus(g, e, x, y, r) {
    if (e.shield > 0) {
      g.fillStyle = 'rgba(180,139,224,.18)'; g.strokeStyle = 'rgba(200,165,240,.9)'; g.lineWidth = 1.5;
      circle(g, x, y, r + 7); g.fill(); g.stroke();
    }
    if (e.frozenT > 0) {
      g.fillStyle = 'rgba(200,238,252,.55)'; g.strokeStyle = 'rgba(240,252,255,.95)'; g.lineWidth = 1.5;
      rr(g, x - r - 3, y - r - 4, (r + 3) * 2, (r + 4) * 2, 3); g.fill(); g.stroke();
    } else if (e.slowT > 0) {
      g.strokeStyle = 'rgba(160,225,245,.9)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y + r * 0.9, r + 2, r * 0.45, 0, 0, TAU); g.stroke();
    }
    if (e.dots.burn) {
      g.fillStyle = 'rgba(255,140,50,.85)';
      for (let i = 0; i < 3; i++) { circle(g, x + (Math.random() - 0.5) * r * 1.6, y - r * 0.4 - Math.random() * r, 1.8); g.fill(); }
    }
    if (e.stunT > 0) {
      g.fillStyle = '#f0d27a';
      for (let i = 0; i < 3; i++) {
        const a = performance.now() / 300 + i * 2.1;
        circle(g, x + Math.cos(a) * (r + 2), y - r * 1.4 + Math.sin(a) * 2, 1.8); g.fill();
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

  // Barra de vida acima da cabeça (top: altura do alto do desenho)
  function drawHpBar(g, e, x, top, r) {
    if (e.hp >= e.maxHp) return;
    const w = r * 2 + 6, k = Math.max(0, e.hp / e.maxHp), y = top - (e.d.boss ? 10 : 5);
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
    g.fillStyle = k > 0.5 ? '#86b46f' : k > 0.25 ? '#d6a547' : '#e0715a';
    g.fillRect(x - w / 2, y, w * k, 3);
  }

  // Aliados (heróis e soldados do Quartel) com as mesmas proporções dos inimigos.
  // colors: { main, dark, accent?, armored?, robe? }; attack: fase do golpe, de 0 a 1
  const people = new Map();
  function drawPerson(g, x, y, r, colors, look, ph, dir = 1, attack = 0) {
    let P = people.get(colors);
    if (!P) {
      P = {
        main: colors.main, dark: colors.dark, light: mix(colors.main, '#ffffff', 0.35), shade: mix(colors.main, colors.dark, 0.5),
        skin: HUMAN_SKIN, skinShade: mix(HUMAN_SKIN, colors.dark, 0.35), accent: colors.accent,
        metal: '#a8b2bc', metalLight: '#e0e6ec', ink: mix(colors.dark, '#000000', 0.45), eye: '#1a1410',
      };
      people.set(colors, P);
    }
    const d = { role: 'ally', color: colors.main, dark: colors.dark, boss: false, attack };
    const k = r / 10;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 1, y + 8.6 * k, r * 0.85, r * 0.3, 0, 0, TAU); g.fill();
    g.save(); g.translate(x, y); g.scale(dir * k, k); LW = 1.3 / k; g.lineJoin = 'round';
    if (colors.robe) robed(g, P, d, look, ph);
    else humanoid(g, P, d, look, ph, colors.armored ? 'ally-armored' : null);
    g.restore();
  }

  Object.assign(TD, { drawEnemy, drawPerson, enemyForm: formOf });
})();
