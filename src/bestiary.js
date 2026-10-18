// Bestiário dos ambientes: cada campo oficial tem sua própria versão dos 12 inimigos clássicos.
// A versão temática troca nome, cores e enfeites, mas mantém os números e a habilidade do papel (role)
// que ela ocupa. As ondas continuam sorteando papéis (makeWave); spawn os troca pelo inimigo do campo.
(() => {
  const TD = window.TD;
  const { ENEMIES, ENEMY_INFO } = TD;

  TD.ROLE_ORDER = ['soldier', 'scout', 'brute', 'healer', 'flyer', 'stalker', 'necro', 'skeleton', 'boss', 'witch', 'colossus', 'dragon'];

  // look: enfeites desenhados sobre o corpo (render.js); 'square' e 'bigsquare' dão corpo quadrado
  const CLASSIC_LOOK = {
    soldier: ['spear'], scout: ['dagger'], brute: ['square', 'visor'], healer: ['cross'], flyer: [], stalker: ['eye'],
    necro: ['hood'], skeleton: ['spear', 'bones'], boss: ['crown'], witch: ['hat'], colossus: ['bigsquare', 'cracks'], dragon: [],
  };
  for (const role of TD.ROLE_ORDER) Object.assign(ENEMIES[role], { role, look: CLASSIC_LOOK[role] });

  // [id, nome, plural, cor, sombra, enfeites, frase de ambiente], na ordem de ROLE_ORDER
  const ROSTERS = {
    rio: [
      ['frogman', 'Homem-Sapo', 'Homens-Sapo', '#5f8f4a', '#22381a', ['spear', 'bulge'], 'Sobe da margem com a lança em punho.'],
      ['newt', 'Salamandra', 'Salamandras', '#d9823b', '#5a2c0c', ['dagger', 'stripes'], 'Escorrega pelas pedras molhadas mais rápido do que se espera.'],
      ['crab', 'Caranguejo de Casco', 'Caranguejos de Casco', '#b5533c', '#4a1a10', ['square', 'claws'], 'Carapaça grossa como escudo.'],
      ['naiad', 'Náiade', 'Náiades', '#5aa7b5', '#1d4a52', ['drop'], 'Espírito da água que fecha as feridas dos aliados.'],
      ['heron', 'Garça de Guerra', 'Garças de Guerra', '#c9d2d6', '#4a5458', ['beak'], 'Plana sobre o rio sem tocar a estrada.'],
      ['reedlurker', 'Espreita-Juncos', 'Espreita-Juncos', '#5c7a4e', '#1f2c1a', ['eye', 'leaf'], 'Coberto de juncos, some entre a vegetação.'],
      ['tidecaller', 'Sacerdote das Marés', 'Sacerdotes das Marés', '#3f5f7a', '#16242f', ['hood'], 'Chama os afogados de volta do leito do rio.'],
      ['drowned', 'Afogado', 'Afogados', '#8fa89a', '#3b4a42', ['spear', 'wraps'], 'Corpo encharcado que voltou a andar.'],
      ['crocking', 'Rei Crocodilo', 'Reis Crocodilo', '#4f7a3a', '#1c2e12', ['crown', 'tusks'], 'Couraça de escamas e mandíbula de ferro.'],
      ['riverwitch', 'Bruxa do Rio', 'Bruxas do Rio', '#4a8a8f', '#173638', ['hat'], 'Ergue escudos de água ao redor dos aliados.'],
      ['turtle', 'Tartaruga Colossal', 'Tartarugas Colossais', '#6a7d4f', '#262f1a', ['bigsquare', 'shell'], 'Uma ilha que anda.'],
      ['hydra', 'Hidra Alada', 'Hidras Aladas', '#3d7a6a', '#123028', ['horns'], 'Sobrevoa o vale com três bocas famintas.'],
    ],
    deserto: [
      ['nomad', 'Nômade', 'Nômades', '#c08a4e', '#5a3a18', ['spear', 'turban'], 'Guerreiro das dunas, de turbante e lança.'],
      ['jackal', 'Chacal', 'Chacais', '#c9a061', '#5e4520', ['ears'], 'Corre em matilha pela areia quente.'],
      ['scarab', 'Escaravelho', 'Escaravelhos', '#3f6a7a', '#122a33', ['square', 'shell'], 'Casca dura de besouro sagrado.'],
      ['alchemist', 'Alquimista', 'Alquimistas', '#8f6aa8', '#382448', ['drop'], 'Unguentos do oásis que fecham feridas.'],
      ['vulture', 'Abutre', 'Abutres', '#7a5a48', '#2c1d14', ['beak'], 'Desce do céu atrás de quem cai.'],
      ['cobra', 'Naja', 'Najas', '#b8a24a', '#4a3e12', ['eye', 'stripes'], 'Rasteja enterrada na areia, quase invisível.'],
      ['embalmer', 'Embalsamador', 'Embalsamadores', '#5e4a3a', '#221810', ['hood'], 'Sacerdote dos túmulos que conhece o caminho de volta da morte.'],
      ['mummy', 'Múmia', 'Múmias', '#d8ccaa', '#5e5640', ['wraps'], 'Enrolada em faixas antigas, arrasta os pés.'],
      ['pharaoh', 'Faraó', 'Faraós', '#d6a547', '#5a3e10', ['crown', 'turban'], 'Senhor das areias, coberto de ouro.'],
      ['djinn', 'Gênio do Deserto', 'Gênios do Deserto', '#4a7ac0', '#1a2c4e', ['turban'], 'Envolve os aliados num redemoinho que absorve golpes.'],
      ['sphinx', 'Esfinge', 'Esfinges', '#c9a46a', '#5a4220', ['bigsquare', 'ears'], 'Leão de pedra com rosto de rei.'],
      ['roc', 'Pássaro Roca', 'Pássaros Roca', '#a8603a', '#45200e', ['beak'], 'Ave gigante que tapa o sol.'],
    ],
    neve: [
      ['frostman', 'Guerreiro do Gelo', 'Guerreiros do Gelo', '#6a8aa8', '#22303e', ['spear', 'fur'], 'Vem das geleiras vestindo peles.'],
      ['wolf', 'Lobo Cinzento', 'Lobos Cinzentos', '#8a8e96', '#34373c', ['ears'], 'Caça em matilha na neve funda.'],
      ['walrus', 'Morsa de Guerra', 'Morsas de Guerra', '#8a6a55', '#33241a', ['square', 'tusks'], 'Couro grosso e presas de marfim.'],
      ['shaman', 'Xamã', 'Xamãs', '#7a9a8a', '#2a3a32', ['cross', 'fur'], 'Canta para fechar as feridas dos guerreiros.'],
      ['owl', 'Coruja das Neves', 'Corujas das Neves', '#e4e8ec', '#5a6470', ['beak'], 'Voa baixo e sem barulho.'],
      ['whitehunter', 'Caçador Branco', 'Caçadores Brancos', '#c8d4dc', '#4e5a64', ['eye', 'fur'], 'Pele branca contra a neve: só se vê o brilho dos olhos.'],
      ['frostlich', 'Lich do Gelo', 'Liches do Gelo', '#4a5a8a', '#181e36', ['hood'], 'Mago morto que congela os caídos e os faz levantar.'],
      ['frostbone', 'Morto Gelado', 'Mortos Gelados', '#cfe4f0', '#56707e', ['spear', 'bones'], 'Ossos cobertos de geada.'],
      ['yeti', 'Yeti Ancião', 'Yetis Anciões', '#dfe6ea', '#5e6a74', ['crown', 'fur'], 'O mais velho das montanhas, coberto de pelo branco.'],
      ['icequeen', 'Rainha do Gelo', 'Rainhas do Gelo', '#8fc4e0', '#244a5e', ['hat'], 'Ergue escudos de gelo sobre os aliados.'],
      ['icegolem', 'Gigante de Gelo', 'Gigantes de Gelo', '#9fc8dc', '#38566a', ['bigsquare', 'cracks'], 'Um bloco de geleira que aprendeu a andar.'],
      ['frostwyrm', 'Serpe Glacial', 'Serpes Glaciais', '#7aa8c8', '#1e3a4e', ['horns'], 'Asas de gelo e hálito que paralisa.'],
    ],
    floresta: [
      ['warant', 'Formiga Guerreira', 'Formigas Guerreiras', '#8a3a2a', '#33120c', ['spear', 'antennae'], 'Marcha em colunas sem fim.'],
      ['spider', 'Aranha Saltadora', 'Aranhas Saltadoras', '#4a3a3a', '#1a1212', ['legs'], 'Pula de galho em galho, rápida demais para o olho.'],
      ['boar', 'Javali Blindado', 'Javalis Blindados', '#6a5040', '#281c14', ['square', 'tusks'], 'Couro grosso e cascos de pedra.'],
      ['dryad', 'Dríade', 'Dríades', '#6aa85a', '#244a1e', ['leaf'], 'Espírito das árvores que cura com seiva.'],
      ['bat', 'Morcego Gigante', 'Morcegos Gigantes', '#4a3a4e', '#1a121e', ['ears'], 'Sai das copas ao anoitecer.'],
      ['mantis', 'Louva-a-deus', 'Louva-a-deus', '#7aa84a', '#2a3e14', ['eye', 'antennae'], 'Imóvel entre as folhas até a hora do bote.'],
      ['druid', 'Druida Sombrio', 'Druidas Sombrios', '#3e5a3a', '#141e12', ['hood', 'leaf'], 'Faz brotar raízes dos que caíram no brejo.'],
      ['bogdead', 'Morto do Brejo', 'Mortos do Brejo', '#7a8a5a', '#2e3420', ['wraps'], 'Coberto de lodo e raízes.'],
      ['trollking', 'Rei Troll', 'Reis Troll', '#5a7a5a', '#1e2e1e', ['crown', 'tusks'], 'Pele de musgo e força de dez homens.'],
      ['hag', 'Bruxa do Brejo', 'Bruxas do Brejo', '#6a5a8a', '#241c36', ['hat'], 'Cobre os aliados com uma névoa que absorve golpes.'],
      ['treant', 'Árvore Anciã', 'Árvores Anciãs', '#6a5038', '#261a10', ['bigsquare', 'leaf'], 'O carvalho mais velho do pântano, de pé e em marcha.'],
      ['wyvern', 'Serpe do Pântano', 'Serpes do Pântano', '#4a6a3a', '#182812', ['horns'], 'Cospe fogo de dentro da névoa.'],
    ],
    vulcao: [
      ['cultist', 'Cultista da Chama', 'Cultistas da Chama', '#a8402c', '#40140c', ['spear', 'flame'], 'Fanático que adora o fogo da montanha.'],
      ['imp', 'Diabrete de Fogo', 'Diabretes de Fogo', '#e0702a', '#5a220a', ['dagger', 'horns'], 'Pequeno, risonho e muito rápido.'],
      ['obsidian', 'Guarda de Obsidiana', 'Guardas de Obsidiana', '#3a3440', '#141018', ['square', 'visor'], 'Armadura de vidro vulcânico.'],
      ['firepriest', 'Sacerdote do Fogo', 'Sacerdotes do Fogo', '#c8582a', '#4a1c0a', ['cross', 'flame'], 'Cauteriza as feridas dos aliados.'],
      ['firebat', 'Morcego de Brasa', 'Morcegos de Brasa', '#8a3a2a', '#30100a', ['flame'], 'Deixa um rastro de faíscas no céu.'],
      ['ashwraith', 'Espectro de Cinza', 'Espectros de Cinza', '#6a6460', '#242220', ['eye'], 'Feito de fumaça, some no ar quente.'],
      ['pyromancer', 'Piromante', 'Piromantes', '#7a2a3a', '#2c0c14', ['hood', 'flame'], 'Reacende as brasas dos que caíram.'],
      ['cinder', 'Morto em Brasa', 'Mortos em Brasa', '#5a4a44', '#1e1614', ['bones', 'flame'], 'Ossos que ainda fumegam.'],
      ['demon', 'Lorde Demônio', 'Lordes Demônio', '#8a1e1e', '#300808', ['crown', 'horns'], 'Saiu da cratera para reinar sobre a horda.'],
      ['lavawitch', 'Bruxa da Lava', 'Bruxas da Lava', '#c0462a', '#481608', ['hat', 'flame'], 'Cobre os aliados com uma crosta de magma.'],
      ['magmagolem', 'Golem de Magma', 'Golens de Magma', '#4a3a34', '#180e0a', ['bigsquare', 'cracks', 'flame'], 'Rocha negra com lava correndo nas rachaduras.'],
      ['elderdragon', 'Dragão Ancião', 'Dragões Anciões', '#c8401e', '#4a1006', ['horns', 'flame'], 'O primeiro dos dragões, nascido dentro do vulcão.'],
    ],
  };

  // Como o papel age, com os nomes do próprio ambiente (o Colosso do deserto se parte em Escaravelhos)
  const n = (roster, role, plural = false) => roster[TD.ROLE_ORDER.indexOf(role)][plural ? 2 : 1];
  const HOW = {
    soldier: () => 'A infantaria comum: sem armadura nem truques, vem em grande número.',
    scout: () => 'Corre quase o dobro da infantaria, mas cai com poucos golpes. Arqueiros e Geada dão conta.',
    brute: () => 'Armadura 4 reduz o dano de cada golpe. Balestra e veneno ignoram a armadura.',
    healer: () => 'A cada 2 s cura os inimigos ao redor. Derrube primeiro, com a mira em "Mais forte" ou "Primeiro".',
    flyer: () => 'Voa em linha reta da caverna até a muralha, ignorando a estrada. O Canhão e o Cavaleiro não alcançam.',
    stalker: () => 'Camuflado: as torres só enxergam no alcance de uma Geada ou de um Arcano. Explosões e Chuva de flechas acertam mesmo assim.',
    necro: r => `A cada 3 s levanta como ${n(r, 'skeleton', true)} até 2 inimigos que caíram perto. Derrube antes de a estrada encher.`,
    skeleton: r => `Levantado por um ${n(r, 'necro')}. Fraco e rende só 1 de ouro.`,
    boss: () => 'Chefe blindado e lento que custa 5 vidas se passar. Lentidão funciona pela metade nele.',
    witch: () => 'Chefe que protege os aliados próximos com escudos. O escudo absorve dano antes da vida.',
    colossus: r => `Chefe enorme com armadura 8. Ao cair, se parte em 4 ${n(r, 'brute', true)} no mesmo lugar.`,
    dragon: () => 'Chefe voador. Cospe fogo na torre mais próxima, que para de atirar por 3 s.',
  };

  const rosterIds = {};
  for (const [biome, rows] of Object.entries(ROSTERS)) {
    rosterIds[biome] = rows.map(([id, name, plural, color, dark, look, flavor], i) => {
      const role = TD.ROLE_ORDER[i];
      ENEMIES[id] = { ...ENEMIES[role], role, name, plural, color, dark, look };
      ENEMY_INFO[id] = `${flavor} ${HOW[role](rows)}`;
      return id;
    });
  }

  const biomeOf = mapId => (TD.MAPS.find(m => m.id === mapId) || {}).biome;
  // Os 12 inimigos do campo; o Vale e os campos do editor usam os clássicos
  TD.rosterOf = mapId => rosterIds[biomeOf(mapId)] || TD.ROLE_ORDER;
  // type pode ser um papel ('brute') ou o inimigo de outro ambiente: vira a versão deste campo
  TD.enemyFor = (mapId, type) => {
    const role = (ENEMIES[type] && ENEMIES[type].role) || type;
    const i = TD.ROLE_ORDER.indexOf(role);
    return i < 0 ? type : TD.rosterOf(mapId)[i];
  };
  TD.enemyName = (mapId, type, count = 1) => {
    const d = ENEMIES[TD.enemyFor(mapId, type)];
    return count > 1 ? d.plural : d.name;
  };
})();
