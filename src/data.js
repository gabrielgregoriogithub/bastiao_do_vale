// Dados do jogo: torres, inimigos, dificuldades, mapas e geração de ondas.
(() => {
  const TD = (window.TD = window.TD || {});
  const T = 40, COLS = 20, ROWS = 12;
  Object.assign(TD, { T, COLS, ROWS, W: COLS * T, H: ROWS * T, MAX_WAVES: 20, MAX_LVL: 3 });

  TD.TOWERS = {
    // crit: chance de acerto crítico (dano dobrado) das armas de precisão
    archer:   { name: 'Arqueiro', cost: 50,  dmg: 10, range: 2.6, rate: 0.55, speed: 430, crit: 0.1, desc: 'Disparos rápidos em um alvo. 10% de chance de acerto crítico.' },
    cannon:   { name: 'Canhão',   cost: 110, dmg: 26, range: 2.4, rate: 1.6,  speed: 260, splash: 1.1, ground: true, desc: 'Explosão que atinge grupos. Não acerta voadores.' },
    frost:    { name: 'Geada',    cost: 80,  dmg: 4,  range: 2.3, rate: 0.9,  speed: 340, slow: 0.4, slowDur: 1.6, detects: true, desc: 'Deixa os inimigos lentos e revela os camuflados.' },
    ballista: { name: 'Balestra', cost: 160, dmg: 70, range: 4.6, rate: 2.2,  pierce: true, crit: 0.15, desc: 'Longo alcance, ignora armadura. 15% de chance de acerto crítico.' },
    arcane:   { name: 'Arcano',   cost: 140, dmg: 20, range: 2.7, rate: 1.3,  chain: 3, chainRange: 1.6, chainFalloff: 0.8, detects: true, desc: 'Raio que salta entre inimigos, inclusive voadores. Revela os camuflados.' },
  };
  // Quartel: não atira; mantém soldados num ponto da estrada que seguram os inimigos (melee)
  TD.TOWERS.barracks = {
    name: 'Quartel', cost: 70, dmg: 14, range: 1.8, rate: 0.8, melee: true, ground: true,
    units: 2, unitHp: 150, regen: 6, respawn: 9,
    desc: 'Envia soldados que seguram os inimigos na estrada.',
  };
  // Estandarte: não ataca; as torres ao alcance causam mais dano (aura). Vários não se somam: vale o mais forte
  TD.TOWERS.banner = {
    name: 'Estandarte', cost: 90, dmg: 0, range: 1.6, rate: 1, support: true, aura: 0.15,
    desc: 'Não ataca: as torres vizinhas causam 15% mais dano.',
  };
  // Caldeirão: o frasco forma uma poça na estrada; dmg é o dano por segundo de quem está nela (ignora armadura)
  TD.TOWERS.cauldron = {
    name: 'Caldeirão', cost: 120, dmg: 11, range: 2.4, rate: 2.2, speed: 230, ground: true, puddle: 0.9, puddleDur: 3,
    desc: 'Arremessa ácido que forma poças na estrada: dano contínuo que ignora armadura. Não acerta voadores.',
  };
  // Mina de Ouro: não ataca; rende ouro no fim de cada onda (income cresce com o nível, em sim.js)
  TD.TOWERS.mine = {
    name: 'Mina', cost: 100, dmg: 0, range: 2.2, rate: 1, economy: true, income: 12,
    desc: 'Não ataca: rende ouro ao fim de cada onda. Quanto antes, mais ela paga.',
  };
  TD.ORDER = ['archer', 'cannon', 'frost', 'ballista', 'arcane', 'barracks', 'banner', 'cauldron', 'mine'];

  TD.ENEMIES = {
    // atk = dano por segundo contra o herói quando bloqueado
    soldier: { name: 'Soldado', plural: 'Soldados', hp: 40, speed: 1.3, armor: 0, gold: 5, r: 9, color: '#b5523b', dark: '#5e2519', gap: 0.85, atk: 6 },
    scout:   { name: 'Batedor', plural: 'Batedores', hp: 24, speed: 2.4, armor: 0, gold: 4, r: 7, color: '#e0ad48', dark: '#6b4a10', gap: 0.5, atk: 4 },
    brute:   { name: 'Blindado', plural: 'Blindados', hp: 130, speed: 0.75, armor: 4, gold: 10, r: 11, color: '#7d8c99', dark: '#333c45', gap: 1.3, atk: 12 },
    healer:  { name: 'Curandeiro', plural: 'Curandeiros', hp: 60, speed: 1.05, armor: 0, gold: 8, r: 9, color: '#5f9e5a', dark: '#23441f', gap: 1.0, atk: 3, heal: 0.08, healEvery: 2, healRange: 1.6 },
    stalker: { name: 'Espreitador', plural: 'Espreitadores', hp: 55, speed: 1.5, armor: 0, gold: 9, r: 8, color: '#55705a', dark: '#1f2b21', gap: 0.7, atk: 5, stealth: true },
    necro:   { name: 'Necromante', plural: 'Necromantes', hp: 90, speed: 0.9, armor: 1, gold: 12, r: 10, color: '#4b3f5e', dark: '#1d1726', gap: 1.2, atk: 4, raiseEvery: 3, raiseRange: 2.2, raiseMax: 2 },
    skeleton: { name: 'Esqueleto', plural: 'Esqueletos', hp: 22, speed: 1.2, armor: 0, gold: 1, r: 7, color: '#d9d3c1', dark: '#5b5648', gap: 0.6, atk: 3, raised: true },
    flyer:   { name: 'Gárgula', plural: 'Gárgulas', hp: 32, speed: 1.0, armor: 0, gold: 7, r: 9, color: '#6a6f8c', dark: '#23263a', gap: 0.7, flying: true },
    boss:    { name: 'Senhor da Guerra', plural: 'Senhores da Guerra', hp: 900, speed: 0.55, armor: 6, gold: 75, r: 16, color: '#8a3567', dark: '#3d1029', gap: 2.2, lives: 5, atk: 40, boss: true },
    witch:   { name: 'Feiticeira', plural: 'Feiticeiras', hp: 700, speed: 0.7, armor: 2, gold: 70, r: 14, color: '#7b4fb0', dark: '#2e1748', gap: 2.2, lives: 5, atk: 25, boss: true, shieldEvery: 6, shieldRange: 2, shieldPct: 0.2 },
    colossus: { name: 'Colosso', plural: 'Colossos', hp: 2200, speed: 0.4, armor: 8, gold: 120, r: 19, color: '#6e6658', dark: '#2b2720', gap: 3, lives: 8, atk: 60, boss: true, splitInto: 'brute', splitCount: 4 },
    dragon:  { name: 'Dragão', plural: 'Dragões', hp: 1100, speed: 0.5, armor: 3, gold: 150, r: 18, color: '#a8402c', dark: '#4a140c', gap: 3, lives: 6, flying: true, boss: true, burnEvery: 6, burnRange: 3, burnDur: 3 },
    // enrage: fração da vida abaixo da qual entra em fúria e anda enrageMul vezes mais rápido
    berserker: { name: 'Berserker', plural: 'Berserkers', hp: 75, speed: 1.0, armor: 1, gold: 9, r: 10, color: '#a0603a', dark: '#40200e', gap: 0.9, atk: 10, enrage: 0.5, enrageMul: 1.9 },
    // a cada burrowEvery s fica burrowDur s embaixo da terra, onde golpes e disparos não o alcançam
    burrower: { name: 'Escavador', plural: 'Escavadores', hp: 55, speed: 1.15, armor: 2, gold: 10, r: 9, color: '#7a6a50', dark: '#2e261a', gap: 0.8, atk: 5, burrowEvery: 4, burrowDur: 1.6 },
  };

  // Texto do Compêndio e do cartão de descoberta: o que o inimigo faz e como enfrentá-lo
  TD.ENEMY_INFO = {
    soldier: 'A infantaria comum. Sem armadura nem truques, vem em grande número.',
    scout: 'Corre quase o dobro dos soldados, mas cai com poucos golpes. Arqueiros e Geada dão conta.',
    brute: 'Armadura 4 reduz o dano de cada golpe. Balestra e veneno ignoram a armadura.',
    healer: 'A cada 2 s cura os inimigos ao redor. Derrube-o primeiro, com a mira em "Mais forte" ou "Primeiro".',
    flyer: 'Voa em linha reta da caverna até a muralha, ignorando a estrada. O Canhão e o Cavaleiro não a alcançam.',
    stalker: 'Camuflado: as torres não o enxergam, a não ser quando passa no alcance de uma Geada ou de um Arcano. Explosões, Nevasca e Chuva de flechas acertam mesmo assim.',
    necro: 'A cada 3 s levanta como Esqueletos até 2 inimigos que caíram perto dele. Derrube-o antes de a estrada encher.',
    skeleton: 'Inimigo levantado por um Necromante. Fraco e rende só 1 de ouro.',
    boss: 'Chefe blindado e lento que custa 5 vidas se passar. Lentidão funciona pela metade nele.',
    witch: 'Chefe que protege os aliados próximos com escudos lilás. O escudo absorve dano antes da vida.',
    colossus: 'Chefe enorme com armadura 8. Ao cair, se parte em 4 Blindados no mesmo lugar.',
    dragon: 'Chefe voador. Cospe fogo na torre mais próxima, que para de atirar por 3 s.',
    berserker: 'Ao perder metade da vida entra em fúria e corre quase o dobro. Derrube de uma vez com dano alto, ou deixe lento antes.',
    burrower: 'A cada 4 s mergulha na terra por um instante: nada o acerta enquanto está embaixo. Poças do Caldeirão e veneno continuam agindo.',
  };

  // Desafios opcionais escolhidos no menu; os efeitos são aplicados em sim.js
  TD.CHALLENGES = [
    { id: 'nohero', name: 'Sem herói', desc: 'Nem Cavaleiro nem Arqueira entram em campo.' },
    { id: 'swift', name: 'Marcha forçada', desc: 'Inimigos 20% mais rápidos.' },
    { id: 'poor', name: 'Cofres vazios', desc: 'Abates rendem 30% menos ouro.' },
    { id: 'nopower', name: 'Sem poderes', desc: 'Chuva, Congelar e Chamado ficam bloqueados.' },
  ];

  // Chefes em rodízio a cada 5 ondas
  TD.BOSS_ROTATION = ['boss', 'witch', 'colossus', 'dragon'];
  TD.bossFor = n => TD.BOSS_ROTATION[(n / 5 - 1) % TD.BOSS_ROTATION.length];

  // Herói: xpPerLevel[n] é a experiência total para passar do nível n ao n+1
  // melee: bloqueia um inimigo terrestre e recebe dano dele; ranged: atira de longe, inclusive em voadores
  TD.HEROES = {
    knight: {
      id: 'knight', name: 'Cavaleiro', melee: true, hp: 300, dmg: 18, rate: 0.8, speed: 2.2, range: 0.75, aggro: 1.6, regen: 8, respawn: 12,
      maxLevel: 5, xpPerLevel: [0, 60, 150, 280, 450],
      summary: 'Segura um inimigo terrestre por vez na estrada.',
      ability: { id: 'charge', name: 'Investida', desc: 'Atordoa e fere os inimigos terrestres ao redor do Cavaleiro.', cd: 25, radius: 1.5, stun: 1.6, mul: 2.5 },
    },
    ranger: {
      id: 'ranger', name: 'Arqueira', melee: false, hp: 200, dmg: 13, rate: 0.7, speed: 2.0, range: 3.0, aggro: 3.0, regen: 6, respawn: 12,
      maxLevel: 5, xpPerLevel: [0, 60, 150, 280, 450],
      summary: 'Atira de longe e acerta voadores, mas não segura ninguém.',
      ability: { id: 'volley', name: 'Saraivada', desc: 'Dispara 8 flechas fortes nos inimigos ao alcance da Arqueira.', cd: 20, arrows: 8, mul: 2.5 },
    },
    // shot/splash: o orbe explode numa área pequena (em casas) e acerta voadores
    mage: {
      id: 'mage', name: 'Mago', melee: false, hp: 170, dmg: 16, rate: 1.25, speed: 1.9, range: 2.7, aggro: 2.7, regen: 6, respawn: 12,
      maxLevel: 5, xpPerLevel: [0, 60, 150, 280, 450], shot: 'mage', splash: 0.8,
      summary: 'Lança orbes que explodem em área, inclusive em voadores, mas não segura ninguém.',
      ability: { id: 'meteor', name: 'Meteoro', desc: 'Um meteoro cai sobre o inimigo mais adiantado ao alcance: dano forte em área e queimadura.', cd: 24, radius: 1.3, mul: 4, delay: 0.7, burn: 0.3, burnDur: 3 },
    },
  };
  TD.HERO_ORDER = ['knight', 'ranger', 'mage'];
  TD.HERO = TD.HEROES.knight;

  // Crônica do Vale: cada campo é um capítulo; a introdução aparece na primeira partida de cada um
  TD.CHRONICLE = {
    vale: { chapter: 'Capítulo I', text: 'Garimpeiros abriram as cavernas além da floresta e acordaram o que dormia nelas. Agora queixadas, onças e até o Curupira marcham pela trilha de terra vermelha. O velho bastião é a única muralha entre a mata enfurecida e as aldeias do vale. Segure a trilha por vinte ondas.' },
    rio: { chapter: 'Capítulo II', text: 'Vencida no vale, a horda contorna as montanhas e cruza o rio pela ponte de madeira. Sem espaço nas margens, cada torre precisa valer o ouro que custa.' },
    serpente: { chapter: 'Capítulo III', text: 'A estrada antiga serpenteia pelas dunas do deserto. Nômades e múmias marcham juntos, e os abutres não seguem estradas: cortam o céu direto até a muralha.' },
    encruzilhada: { chapter: 'Capítulo IV', text: 'Nas montanhas geladas, a horda aprendeu a atacar por duas cavernas ao mesmo tempo. As colunas se encontram no meio da neve.' },
    pantano: { chapter: 'Capítulo V', text: 'Além do pântano, a floresta inteira marcha contra o bastião. Formigas, aranhas e árvores antigas abrem caminho até o mar.' },
    costa: { chapter: 'Capítulo VI', text: 'A horda tomou a costa. Piratas desembarcam dos navios e marcham pela areia até o bastião. O mar guarda um flanco, mas também rouba espaço.' },
    cemiterio: { chapter: 'Capítulo VII', text: 'No velho cemitério do reino, os mortos não descansam. Duas criptas se abriram, e o caminho até o vulcão passa entre as lápides.' },
    vulcao: { chapter: 'Capítulo VIII', text: 'A última fortaleza da horda fica na boca do vulcão. Dizem que o Dragão Ancião dorme ali, entre rios de lava. Vença aqui e o vale terá paz.' },
  };
  TD.EPILOGUE = 'O Dragão Ancião caiu na lava de onde nasceu e a horda se dispersou pelas montanhas. Nas aldeias, contam que o bastião nunca cedeu.';

  // Forja do Bastião: melhorias permanentes compradas com estrelas
  TD.PERKS = [
    { id: 'gold', name: 'Cofres cheios', desc: '+25 de ouro inicial por nível.', costs: [1, 2, 3] },
    { id: 'walls', name: 'Muralha reforçada', desc: '+3 vidas por nível.', costs: [1, 2] },
    { id: 'masons', name: 'Pedreiros', desc: 'Torres 5% mais baratas por nível.', costs: [2, 3] },
    { id: 'aim', name: 'Pontaria', desc: '+5% de dano em todas as torres por nível.', costs: [2, 3, 4] },
    { id: 'tactics', name: 'Estrategistas', desc: 'Poderes recarregam 10% mais rápido por nível.', costs: [2, 3] },
    { id: 'veteran', name: 'Veterano', desc: 'O herói começa no nível 3.', costs: [3] },
  ];

  TD.DIFFICULTIES = {
    // curve: quanto a vida dos inimigos comuns acelera a cada onda (os chefes seguem uma curva própria, em sim.js)
    facil:   { name: 'Fácil',   hint: 'Mais ouro e 30 vidas', hp: 0.8,  gold: 200, lives: 30, curve: 0.015 },
    normal:  { name: 'Normal',  hint: 'O desafio planejado',  hp: 1,    gold: 150, lives: 20, curve: 0.03 },
    dificil: { name: 'Difícil', hint: 'Inimigos mais duros',  hp: 1.25, gold: 120, lives: 12, curve: 0.03 },
  };
  TD.DIFF_ORDER = ['facil', 'normal', 'dificil'];

  // Especializações liberadas no nível máximo; os efeitos são aplicados em sim.js (towerStats)
  TD.SPEC_COST_MUL = 1.6;
  TD.SPECS = {
    archer: [
      { id: 'volley', name: 'Rajada', desc: 'Atira em até 3 inimigos de uma vez.', color: '#e0c178' },
      { id: 'poison', name: 'Flechas venenosas', desc: 'Veneno causa dano contínuo que ignora armadura.', color: '#8fc65a' },
    ],
    cannon: [
      { id: 'mortar', name: 'Morteiro', desc: 'Alcance enorme e explosão maior, porém mais lento.', color: '#c9c2b0' },
      { id: 'fire', name: 'Incendiário', desc: 'A explosão põe fogo nos inimigos atingidos.', color: '#f07a3a' },
    ],
    frost: [
      { id: 'blizzard', name: 'Nevasca', desc: 'Pulso que deixa lentos todos ao redor, inclusive voadores.', color: '#bfe9f5' },
      { id: 'freeze', name: 'Congelamento', desc: 'Mais dano e 25% de chance de congelar o alvo por um instante.', color: '#7fc8ff' },
    ],
    ballista: [
      { id: 'pierce', name: 'Perfurante', desc: 'O virote atravessa todos os inimigos em linha.', color: '#e8e2d2' },
      { id: 'hunter', name: 'Caçador de chefes', desc: 'Dano triplo em Blindados e chefes, mais alcance.', color: '#d6a547' },
    ],
    arcane: [
      { id: 'storm', name: 'Tempestade', desc: 'O raio salta entre até 6 inimigos, com alcance maior.', color: '#9fc4ff' },
      { id: 'hex', name: 'Runa de fraqueza', desc: 'Alvos atingidos sofrem 25% mais dano de tudo por 3 s.', color: '#c77be0' },
    ],
    barracks: [
      { id: 'guard', name: 'Guarda real', desc: 'Três soldados, com mais vida e armadura.', color: '#c0c8d8' },
      { id: 'templar', name: 'Templários', desc: 'Golpes que ignoram armadura e cura rápida entre as lutas.', color: '#f0e0a0' },
    ],
    banner: [
      { id: 'warhorn', name: 'Trompa de Guerra', desc: 'As vizinhas também atacam 20% mais rápido.', color: '#e0a050' },
      { id: 'oracle', name: 'Olho do Oráculo', desc: 'As vizinhas alcançam 15% mais longe, e o Estandarte revela camuflados.', color: '#9fd0e8' },
    ],
    cauldron: [
      { id: 'plague', name: 'Peste', desc: 'Poças maiores, que duram 5 s e causam mais dano.', color: '#9ad05a' },
      { id: 'acid', name: 'Ácido corrosivo', desc: 'Quem pisa na poça perde toda a armadura por 4 s.', color: '#d8e05a' },
    ],
    mine: [
      { id: 'vault', name: 'Cofre Real', desc: 'Rende 75% mais ouro a cada onda.', color: '#f0d070' },
      { id: 'bounty', name: 'Recompensa', desc: 'Cada inimigo derrotado ao alcance rende +3 de ouro.', color: '#e0a040' },
    ],
  };
  TD.WEAK_MUL = 1.25;

  // Poderes do jogador; a recarga só corre durante as ondas
  TD.POWERS = [
    { id: 'rain', key: 'q', name: 'Chuva de flechas', desc: 'Toque no mapa para cobrir uma área de flechas. Acerta voadores.', cd: 40, radius: 1.6 },
    { id: 'freeze', key: 'w', name: 'Congelar', desc: 'Congela todos os inimigos por 2,5 s (chefes por 1 s).', cd: 60, dur: 2.5 },
    { id: 'rally', key: 'e', name: 'Chamado às armas', desc: 'Todas as torres atiram 50% mais rápido por 8 s.', cd: 70, dur: 8 },
  ];

  TD.TARGETING = [
    { id: 'first', name: 'Primeiro da fila' },
    { id: 'last', name: 'Último da fila' },
    { id: 'strong', name: 'Mais forte' },
    { id: 'close', name: 'Mais próximo' },
  ];

  const river = [];
  for (let r = 0; r <= 5; r++) river.push([10, r]);
  for (let r = 5; r < ROWS; r++) river.push([11, r]);

  // Caminhos em coordenadas de casa (coluna, linha); começam fora da tela à esquerda e saem pela direita
  TD.MAPS = [
    {
      // theme: cenário desenhado à parte (render.js e ambience.js)
      // props: árvores da floresta, que ocupam casas longe da trilha como o cenário
      id: 'vale', biome: 'amazonia', theme: 'amazonia', name: 'Vale Amazônico', desc: 'Trilha de terra vermelha no coração da floresta. Bom para começar.',
      way: [[-1, 2], [4, 2], [4, 8], [9, 8], [9, 3], [14, 3], [14, 9], [17, 9], [17, 5], [20, 5]],
      water: [],
      props: [[0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [1, 10], [1, 11], [2, 11], [6, 11], [7, 11], [8, 11], [11, 11], [12, 11],
        [18, 11], [19, 11], [19, 10], [19, 9], [19, 0], [18, 0], [17, 0], [16, 0], [12, 0], [7, 0], [6, 0], [19, 1], [1, 0],
        [9, 0], [10, 0], [14, 0], [15, 0], [16, 1], [17, 1], [18, 1], [18, 2], [0, 5], [0, 6], [1, 8], [2, 10], [3, 11], [10, 11], [13, 11], [11, 10]],
      palette: { grass: '#2e5226', tufts: ['#3f7032', '#1c3418'], road: ['#8a4a2a', '#a8623a'], pebbles: ['#6a3a20', '#c48a5a'], flowers: ['#e84a5a', '#f0c040'] },
    },
    {
      id: 'rio', biome: 'rio', name: 'Passo do Rio', desc: 'Um rio corta o campo e tira espaço das torres.',
      way: [[-1, 9], [3, 9], [3, 2], [8, 2], [8, 10], [13, 10], [13, 1], [16, 1], [16, 6], [20, 6]],
      water: river,
      palette: { grass: '#3f5f36', tufts: ['#557a47', '#2d4527'], road: ['#85704c', '#ab946b'], pebbles: ['#94805a', '#c4ae86'], flowers: ['#dfe6f0', '#e9d9a0'] },
    },
    {
      id: 'serpente', biome: 'deserto', name: 'Serpente', desc: 'Estrada longa em zigue-zague pelas dunas, com retas boas para canhões.',
      way: [[-1, 1], [17, 1], [17, 4], [2, 4], [2, 7], [17, 7], [17, 10], [20, 10]],
      water: [],
      palette: { grass: '#b8975a', tufts: ['#9a7a3e', '#d1b072'], road: ['#8a6a3e', '#a8865a'], pebbles: ['#7a5e38', '#d8be8a'], flowers: ['#e8d29a', '#8a6a3a'] },
    },
    {
      id: 'encruzilhada', biome: 'neve', name: 'Encruzilhada', desc: 'Duas cavernas na neve, duas estradas que se juntam no meio. Defenda as duas frentes.',
      ways: [
        [[-1, 1], [7, 1], [7, 6], [11, 6], [11, 9], [15, 9], [15, 3], [18, 3], [18, 6], [20, 6]],
        [[-1, 10], [7, 10], [7, 6], [11, 6], [11, 9], [15, 9], [15, 3], [18, 3], [18, 6], [20, 6]],
      ],
      heroAt: 0.45,
      water: [],
      palette: { grass: '#d4dee4', tufts: ['#b4c2cc', '#eef4f8'], road: ['#7c7468', '#9a9286'], pebbles: ['#5e5850', '#c8ccd0'], flowers: ['#ffffff', '#a8c8e0'] },
    },
    {
      id: 'pantano', biome: 'floresta', name: 'Pântano Sombrio', desc: 'Lama na estrada deixa os inimigos lentos, mas as poças roubam espaço.',
      way: [[-1, 5], [3, 5], [3, 1], [9, 1], [9, 10], [13, 10], [13, 4], [16, 4], [16, 8], [20, 8]],
      mud: [[9, 3], [9, 4], [9, 5], [9, 6], [9, 7], [9, 8], [10, 10], [11, 10], [12, 10]],
      water: [[5, 7], [6, 7], [5, 8], [6, 8], [6, 9], [11, 2], [12, 2], [11, 3], [17, 1], [18, 1], [17, 2], [1, 9], [2, 9], [1, 10]],
      waterColor: '#2f5246',
      palette: { grass: '#3b4b2c', tufts: ['#52653a', '#26331d'], road: ['#7a6544', '#9c875f'], pebbles: ['#8a7550', '#b39e74'], flowers: ['#cfd8a0', '#9fb08a'] },
    },
    {
      id: 'costa', biome: 'costa', name: 'Costa dos Piratas', desc: 'O mar avança sobre a praia e deixa pouco espaço no sul do campo.',
      way: [[-1, 4], [3, 4], [3, 8], [8, 8], [8, 2], [13, 2], [13, 8], [17, 8], [17, 4], [20, 4]],
      water: [...Array.from({ length: 17 }, (_, c) => [c, 10]), ...Array.from({ length: 17 }, (_, c) => [c, 11])],
      waterColor: '#2f6f8f',
      palette: { grass: '#c9b27a', tufts: ['#a8945a', '#dcc890'], road: ['#8a7450', '#a8916a'], pebbles: ['#efe6cc', '#7a6440'], flowers: ['#f2ece0', '#e89a8a'] },
    },
    {
      // props: lápides que ocupam casas como o cenário (não se constrói nelas)
      id: 'cemiterio', biome: 'cripta', name: 'Cemitério Antigo', desc: 'Duas criptas, lápides por toda parte e névoa entre os túmulos.',
      ways: [
        [[-1, 2], [5, 2], [5, 5], [10, 5], [10, 2], [15, 2], [15, 6], [20, 6]],
        [[-1, 9], [5, 9], [5, 5], [10, 5], [10, 2], [15, 2], [15, 6], [20, 6]],
      ],
      heroAt: 0.4,
      water: [],
      props: [[2, 6], [3, 6], [7, 8], [8, 8], [12, 8], [13, 9], [17, 9], [18, 2], [7, 1], [12, 4]],
      palette: { grass: '#3a4038', tufts: ['#4c5448', '#2a2f28'], road: ['#5e5a52', '#77736a'], pebbles: ['#3e3a34', '#9a968c'], flowers: ['#b8b4c8', '#8a6a9a'] },
    },
    {
      // a lava entra em "water": tira espaço das torres como as poças do pântano, mas a estrada não passa por ela
      id: 'vulcao', biome: 'vulcao', name: 'Boca do Vulcão', desc: 'Rios de lava cortam a rocha. O último campo da horda.',
      way: [[-1, 6], [3, 6], [3, 2], [8, 2], [8, 9], [12, 9], [12, 3], [17, 3], [17, 7], [20, 7]],
      water: [[5, 4], [6, 4], [5, 5], [6, 5], [5, 6], [10, 4], [10, 5], [11, 5], [10, 6], [14, 5], [15, 5], [14, 6], [15, 6], [14, 7], [1, 10], [2, 10], [2, 11], [18, 0], [19, 0]],
      lava: true, waterColor: '#b8401c',
      palette: { grass: '#3a3230', tufts: ['#4e4440', '#28221f'], road: ['#5e5048', '#7a6a5e'], pebbles: ['#2a2220', '#8a7a6e'], flowers: ['#f08a3a', '#c8401e'] },
    },
  ];
  TD.MUD_SLOW = 0.65;

  // ---------- Campos desenhados pelo jogador ----------
  TD.MIN_ROUTE = 30; // casas de estrada para um campo poder ser salvo

  // points: casas [coluna, linha] clicadas no editor, da borda esquerda até a direita.
  // Devolve { ok, error, complete, len, cells } sem lançar erro, para o editor mostrar a mensagem.
  TD.validateRoute = points => {
    const fail = error => ({ ok: false, error, complete: false, len: 0, cells: new Set() });
    if (!points.length) return { ok: true, error: null, complete: false, len: 0, cells: new Set() };
    const [c0, r0] = points[0];
    if (c0 !== 0 || r0 < 1 || r0 > ROWS - 2) return fail('A estrada começa na coluna da esquerda, longe dos cantos.');
    const cells = new Set([`${c0},${r0}`]);
    let len = 1;
    for (let i = 1; i < points.length; i++) {
      const [a, b] = points[i - 1], [c, d] = points[i];
      if (c < 0 || c >= COLS || d < 0 || d >= ROWS) return fail('Esse ponto fica fora do mapa.');
      if (a === c && b === d) return fail('Esse ponto já é o fim da estrada.');
      if (a !== c && b !== d) return fail('Cada trecho precisa ser reto: mesma linha ou mesma coluna.');
      if (a === COLS - 1) return fail('A estrada termina ao chegar na coluna da direita.');
      const dc = Math.sign(c - a), dr = Math.sign(d - b);
      let x = a, y = b;
      while (x !== c || y !== d) {
        x += dc; y += dr;
        const k = `${x},${y}`;
        if (cells.has(k)) return fail('A estrada não pode passar por cima de si mesma.');
        cells.add(k);
        len += 1;
      }
    }
    const [cl, rl] = points[points.length - 1];
    const complete = cl === COLS - 1;
    if (complete && (rl < 1 || rl > ROWS - 2)) return fail('A muralha precisa ficar longe dos cantos.');
    return { ok: true, error: null, complete, len, cells };
  };

  // Caminho completo do jogo: entra pela caverna (fora da tela, à esquerda) e sai pela muralha (à direita)
  TD.routeToWay = points => [[-1, points[0][1]], ...points, [COLS, points[points.length - 1][1]]];

  TD.customMap = (name, points) => ({
    id: 'custom', custom: true, name: name || 'Meu campo', desc: 'Desenhado por você no editor de campos.',
    route: points, way: TD.routeToWay(points), water: [],
    palette: { grass: '#4a6332', tufts: ['#5f7f40', '#364b25'], road: ['#8b7249', '#b3976a'], pebbles: ['#9b8358', '#c9b086'], flowers: ['#f0d58c', '#c99ad6'] },
  });

  // campos oficiais: os desenhados pelo jogador ficam fora do desafio do dia e das conquistas
  TD.officialMaps = () => TD.MAPS.filter(m => !m.custom);

  // Código de compartilhamento: "BV1:nome:pontos", cada ponto em dois caracteres de base 36 (coluna, linha)
  const CODE_PREFIX = 'BV1';
  TD.encodeRoute = (name, points) =>
    `${CODE_PREFIX}:${encodeURIComponent(name || '')}:${points.map(([c, r]) => c.toString(36) + r.toString(36)).join('')}`;

  // Devolve { name, points } ou null; não valida a estrada (isso é com validateRoute)
  TD.decodeRoute = code => {
    const parts = String(code || '').trim().split(':');
    if (parts.length !== 3 || parts[0] !== CODE_PREFIX || !/^[0-9a-z]*$/.test(parts[2]) || parts[2].length % 2) return null;
    let name;
    try { name = decodeURIComponent(parts[1]).slice(0, 30); } catch { return null; }
    const points = [];
    for (let i = 0; i < parts[2].length; i += 2) points.push([parseInt(parts[2][i], 36), parseInt(parts[2][i + 1], 36)]);
    return points.length ? { name, points } : null;
  };

  // Monta uma estrada a partir dos pontos de virada; voadores da mesma caverna seguem em linha reta até a saída
  function buildPath(way) {
    const pts = way.map(([c, r]) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T }));
    const segs = [];
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ a, b, len: l, start: len });
      len += l;
    }
    const posAt = d => {
      for (const s of segs) {
        if (d <= s.start + s.len) {
          const k = (d - s.start) / s.len;
          return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k };
        }
      }
      return { ...pts[pts.length - 1] };
    };
    const startRow = way[0][1], exitRow = way[way.length - 1][1];
    const fa = { x: -20, y: (startRow + 0.5) * T }, fb = { x: COLS * T + 20, y: (exitRow + 0.5) * T };
    const flyLen = Math.hypot(fb.x - fa.x, fb.y - fa.y);
    const flyAt = d => {
      const k = Math.min(1, d / flyLen);
      return { x: fa.x + (fb.x - fa.x) * k, y: fa.y + (fb.y - fa.y) * k };
    };
    return { way, pts, segs, len, posAt, startRow, flyLen, flyAt };
  }

  // 0 = gramado livre, 1 = estrada, 2 = cenário, 3 = água
  TD.buildMap = map => {
    const ways = map.ways || [map.way];
    const paths = ways.map(buildPath);
    const exitRow = ways[0][ways[0].length - 1][1];

    const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
    const blocked = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (const way of ways) {
      for (let i = 0; i < way.length - 1; i++) {
        let [c, r] = way[i];
        const [c2, r2] = way[i + 1], dc = Math.sign(c2 - c), dr = Math.sign(r2 - r);
        for (;;) {
          if (inGrid(c, r)) blocked[r][c] = 1;
          if (c === c2 && r === r2) break;
          c += dc; r += dr;
        }
      }
    }
    const bridges = [];
    for (const [c, r] of map.water) {
      if (!inGrid(c, r)) continue;
      if (blocked[r][c] === 1) bridges.push([c, r]);
      else blocked[r][c] = 3;
    }
    const scenery = (c, r) => { if (inGrid(c, r) && !blocked[r][c]) blocked[r][c] = 2; };
    for (const [c, r] of map.props || []) scenery(c, r);
    for (let r = exitRow - 2; r <= exitRow + 2; r++) scenery(COLS - 1, r);
    for (const p of paths) { scenery(0, p.startRow - 1); scenery(0, p.startRow + 1); }

    const mudCells = map.mud || [];
    const mud = new Set(mudCells.map(([c, r]) => `${c},${r}`));
    const mudAt = (x, y) => mud.size > 0 && mud.has(`${Math.floor(x / T)},${Math.floor(y / T)}`);

    const p0 = paths[0];
    return {
      map, paths, blocked, bridges, exitRow, mudCells, mudAt,
      // atalhos para a primeira estrada (herói, prévias e testes)
      pts: p0.pts, segs: p0.segs, pathLen: p0.len, posAt: p0.posAt, flyLen: p0.flyLen, flyAt: p0.flyAt, startRow: p0.startRow,
    };
  };

  // Revoadas: ondas 9, 14, 19, 24... com dois terços de voadores
  TD.isSwarm = n => n >= 9 && n % 5 === 4;

  // Sorteio com semente: a mesma semente gera sempre a mesma sequência
  TD.seeded = seed => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Desafio do dia: campo e desafios sorteados pela data, iguais para todo mundo naquele dia
  TD.dailyFor = date => {
    const pad = n => String(n).padStart(2, '0');
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; // data local, não UTC
    let h = 2166136261;
    for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    const rnd = TD.seeded(h);
    const maps = TD.officialMaps();
    const map = maps[Math.floor(rnd() * maps.length)].id;
    const pool = TD.CHALLENGES.map(c => c.id).filter(id => id !== 'nohero');
    const first = pool[Math.floor(rnd() * pool.length)];
    const rest = pool.filter(id => id !== first);
    const mods = rnd() < 0.5 ? [first] : [first, rest[Math.floor(rnd() * rest.length)]];
    return { key, seed: h, map, diff: 'normal', mods };
  };

  // seed opcional: com ela, a onda n sai sempre igual (Desafio do dia); sem ela, é sorteada na hora
  TD.makeWave = (n, seed = null) => {
    const random = seed === null ? Math.random : TD.seeded((seed ^ Math.imul(n, 2654435761)) >>> 0);
    const list = [];
    const count = 6 + Math.floor(n * 2.2);
    const scoutP = n >= 3 ? 0.22 + Math.min(n, 15) * 0.01 : 0;
    const bruteP = n >= 5 ? 0.12 + Math.min(n, 20) * 0.012 : 0;
    const healP = n >= 7 ? 0.08 + Math.min(n, 20) * 0.004 : 0;
    const flyP = n >= 6 ? 0.05 + Math.min(n, 20) * 0.005 : 0;
    const stalkP = n >= 8 ? 0.04 + Math.min(n, 20) * 0.003 : 0;
    const necroP = n >= 11 ? 0.02 + Math.min(n, 20) * 0.002 : 0;
    const berserkP = n >= 4 ? 0.05 + Math.min(n, 20) * 0.004 : 0;
    const burrowP = n >= 9 ? 0.03 + Math.min(n, 20) * 0.003 : 0;
    // Sorteio proporcional: os soldados ficam com o que sobra, nunca menos de 15% das chances.
    // (Antes as chances somavam mais de 100% nas ondas altas e os últimos tipos eram cortados.)
    const weights = [['scout', scoutP], ['brute', bruteP], ['healer', healP], ['flyer', flyP], ['stalker', stalkP], ['necro', necroP], ['berserker', berserkP], ['burrower', burrowP]];
    const others = weights.reduce((sum, [, w]) => sum + w, 0);
    const table = [['soldier', Math.max(0.15, 1 - others)], ...weights];
    const total = table.reduce((sum, [, w]) => sum + w, 0);
    const swarm = TD.isSwarm(n);
    for (let i = 0; i < count; i++) {
      if (swarm && i % 3 !== 2) { list.push('flyer'); continue; }
      let r = random() * total, type = 'soldier';
      for (const [t, w] of table) { if (r < w) { type = t; break; } r -= w; }
      list.push(type);
    }
    if (n % 5 === 0) for (let b = 0; b < 1 + Math.floor((n - 1) / 20); b++) list.push(TD.bossFor(n));
    return list;
  };
})();
