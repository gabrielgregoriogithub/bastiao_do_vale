// Bestiário dos ambientes: cada campo oficial tem sua própria versão dos 14 inimigos clássicos.
// A versão temática troca nome, cores e enfeites, mas mantém os números e a habilidade do papel (role)
// que ela ocupa. As ondas continuam sorteando papéis (makeWave); spawn os troca pelo inimigo do campo.
(() => {
  const TD = window.TD;
  const { ENEMIES, ENEMY_INFO } = TD;

  TD.ROLE_ORDER = ['soldier', 'scout', 'brute', 'healer', 'flyer', 'stalker', 'necro', 'skeleton', 'boss', 'witch', 'colossus', 'dragon', 'berserker', 'burrower'];

  // look: enfeites desenhados sobre o corpo (render.js); 'square' e 'bigsquare' dão corpo quadrado
  const CLASSIC_LOOK = {
    soldier: ['spear'], scout: ['dagger'], brute: ['square', 'visor'], healer: ['cross'], flyer: [], stalker: ['eye'],
    necro: ['hood'], skeleton: ['spear', 'bones'], boss: ['crown'], witch: ['hat'], colossus: ['bigsquare', 'cracks'], dragon: [],
    berserker: ['axe'], burrower: ['claws', 'lamp'],
  };
  for (const role of TD.ROLE_ORDER) Object.assign(ENEMIES[role], { role, look: CLASSIC_LOOK[role] });

  // [id, nome, plural, cor, sombra, enfeites, frase de ambiente], na ordem de ROLE_ORDER
  const ROSTERS = {
    // Vale Amazônico: invasores da mata e o folclore que acordou para enfrentá-los
    amazonia: [
      ['garimpeiro', 'Garimpeiro', 'Garimpeiros', '#b8642e', '#4a2410', ['axe', 'lamp'], 'Abriu as cavernas atrás de ouro e acordou a mata.'],
      ['cutia', 'Cutia', 'Cutias', '#b07a40', '#4a2e14', ['ears'], 'Pequena e ligeira, dispara pela trilha.'],
      ['tatu', 'Tatu-canastra', 'Tatus-canastra', '#8a7a62', '#3a3020', ['stripes', 'square'], 'Couraça de placas que desvia flechas.'],
      ['paje', 'Pajé Sombrio', 'Pajés Sombrios', '#7a4a2a', '#2e1a0e', ['leaf', 'drop'], 'Cura os aliados com ervas da floresta.'],
      ['gaviao', 'Gavião-real', 'Gaviões-reais', '#8a8a8e', '#2a2a2e', ['beak'], 'A maior ave de rapina da mata, cruza o céu sem seguir a trilha.'],
      ['onca', 'Onça-pintada', 'Onças-pintadas', '#d89a3a', '#4a2a0a', ['spots', 'ears'], 'Some entre as folhas e só aparece na hora do bote.'],
      ['feiticeiro', 'Feiticeiro do Igapó', 'Feiticeiros do Igapó', '#3a5a4a', '#122018', ['hood', 'leaf'], 'Chama de volta os que caem na floresta alagada.'],
      ['visagem', 'Visagem', 'Visagens', '#b8d8c8', '#4a6058', ['eye'], 'Assombração da mata que voltou para lutar.'],
      ['curupira', 'Curupira', 'Curupiras', '#3a7a3a', '#143014', ['flame', 'leaf'], 'O guardião da floresta: cabelo de fogo e pés virados para trás.'],
      ['iara', 'Iara', 'Iaras', '#3ab0a8', '#0e3e3a', ['drop'], 'Seu canto do rio envolve os aliados num escudo de água.'],
      ['mapinguari', 'Mapinguari', 'Mapinguaris', '#6a4a32', '#241608', ['bigsquare', 'cracks'], 'O gigante peludo da lenda, com a boca na barriga.'],
      ['boitata', 'Boitatá', 'Boitatás', '#e0702a', '#5a1a06', ['horns', 'flame'], 'A cobra de fogo que voa sobre a mata e incendeia as torres.'],
      ['queixada', 'Queixada', 'Queixadas', '#4a3a32', '#1a120e', ['tusks', 'fur'], 'Ferido, o porco-do-mato bate os dentes e dispara.'],
      ['sucuri', 'Sucuri', 'Sucuris', '#5a7a3a', '#1e2e12', ['spots'], 'Mergulha na lama da trilha e surge mais adiante.'],
    ],
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
      ['hippo', 'Hipopótamo Bravo', 'Hipopótamos Bravos', '#8a7a8a', '#3a2e3a', ['tusks'], 'Parece manso até levar o primeiro golpe.'],
      ['mudeel', 'Enguia do Lodo', 'Enguias do Lodo', '#5a6a4a', '#202a18', ['stripes'], 'Afunda na lama da estrada e surge mais adiante.'],
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
      ['scorpion', 'Escorpião Gigante', 'Escorpiões Gigantes', '#a8703a', '#40240c', ['claws', 'stripes'], 'Ferrão erguido e pinças abertas.'],
      ['sandworm', 'Verme da Areia', 'Vermes da Areia', '#c8a070', '#5a3e1e', ['stripes'], 'Mergulha nas dunas e reaparece sem aviso.'],
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
      ['polarbear', 'Urso Polar', 'Ursos Polares', '#eef2f4', '#6a7880', ['ears', 'fur'], 'Ferido, vira uma avalanche de garras.'],
      ['icemole', 'Toupeira Gelada', 'Toupeiras Geladas', '#8a9aa8', '#2e3a44', ['claws'], 'Cava túneis sob o gelo.'],
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
      ['brownbear', 'Urso Furioso', 'Ursos Furiosos', '#6a4a30', '#281a0e', ['ears'], 'Dono da floresta, não aceita ser ferido.'],
      ['mole', 'Toupeira Gigante', 'Toupeiras Gigantes', '#5a4a44', '#201814', ['claws'], 'Some na terra fofa e brota adiante.'],
    ],
    costa: [
      ['pirate', 'Pirata', 'Piratas', '#a8503a', '#401a10', ['spear', 'bandana'], 'Desembarcou de lança em punho e sorriso sem dentes.'],
      ['cabinboy', 'Grumete', 'Grumetes', '#d0a070', '#5a3a1a', ['dagger', 'bandana'], 'Pequeno e ligeiro, corre à frente do bando.'],
      ['corsair', 'Corsário de Couraça', 'Corsários de Couraça', '#6a7080', '#262a34', ['square', 'visor'], 'Couraça roubada de um navio de guerra.'],
      ['surgeon', 'Cirurgião de Bordo', 'Cirurgiões de Bordo', '#c8c0a8', '#4a4434', ['cross'], 'Remenda os marujos no meio da batalha.'],
      ['gull', 'Gaivota Ladra', 'Gaivotas Ladras', '#e8eaec', '#5a6068', ['beak'], 'Rouba tudo o que brilha, inclusive moedas.'],
      ['smuggler', 'Contrabandista', 'Contrabandistas', '#3a4a5a', '#141c24', ['eye', 'bandana'], 'Anda nas sombras do cais sem ser notado.'],
      ['ghostcaptain', 'Capitão Fantasma', 'Capitães Fantasmas', '#6a8aa0', '#1e2c38', ['tricorn'], 'Comanda uma tripulação que o mar não quis.'],
      ['ghostsailor', 'Marujo Fantasma', 'Marujos Fantasmas', '#a8c8d8', '#3e5868', ['spear', 'bones'], 'Um afogado que voltou para o convés.'],
      ['piratelord', 'Rei dos Piratas', 'Reis dos Piratas', '#8a2a2a', '#300c0c', ['tricorn', 'tusks'], 'O pirata mais temido dos sete mares.'],
      ['siren', 'Sereia', 'Sereias', '#4ab0a0', '#14403a', ['drop'], 'Seu canto envolve os aliados numa espuma que absorve golpes.'],
      ['kraken', 'Kraken', 'Krakens', '#7a3a5a', '#2c1020', ['bigsquare', 'legs'], 'Saiu do fundo do mar arrastando os tentáculos.'],
      ['seaserpent', 'Serpente Marinha', 'Serpentes Marinhas', '#2a7a7a', '#0c2c2c', ['horns'], 'Voa baixo sobre as ondas, cuspindo água fervente.'],
      ['buccaneer', 'Bucaneiro Furioso', 'Bucaneiros Furiosos', '#b05a2a', '#40200c', ['axe', 'bandana'], 'Ferido, larga a prudência e corre de machado em punho.'],
      ['hermit', 'Caranguejo-Ermitão', 'Caranguejos-Ermitões', '#c86a4a', '#4a2010', ['claws', 'shell'], 'Se esconde na concha e some na areia.'],
    ],
    cripta: [
      ['ghoul', 'Carniçal', 'Carniçais', '#7a8a6a', '#2a3222', ['claws'], 'Morto faminto que nunca para de andar.'],
      ['cryptrat', 'Rato da Cripta', 'Ratos da Cripta', '#6a5a5a', '#241c1c', ['ears'], 'Corre em bandos entre as lápides.'],
      ['deathknight', 'Cavaleiro Morto', 'Cavaleiros Mortos', '#4a4a5a', '#16161e', ['square', 'visor'], 'Armadura enferrujada que ainda obedece.'],
      ['acolyte', 'Acólito Sombrio', 'Acólitos Sombrios', '#5a4a6a', '#1e1626', ['cross'], 'Reza para fechar as feridas dos mortos.'],
      ['vampbat', 'Morcego Vampiro', 'Morcegos Vampiros', '#5a2a3a', '#1e0a12', ['ears'], 'Desce das torres do mausoléu ao cair da noite.'],
      ['ghost', 'Fantasma', 'Fantasmas', '#c8d4e0', '#56606e', ['eye'], 'Atravessa a névoa sem ser visto.'],
      ['lich', 'Lich', 'Liches', '#3a4a3a', '#121a12', ['hood'], 'Rei dos mortos-vivos, ergue quem cai perto dele.'],
      ['oldbones', 'Ossada', 'Ossadas', '#e0d8c0', '#605840', ['spear', 'bones'], 'Esqueleto antigo, mais pó que osso.'],
      ['vampire', 'Rei Vampiro', 'Reis Vampiros', '#6a1a2a', '#240810', ['crown'], 'Senhor da cripta, sedento e paciente.'],
      ['banshee', 'Banshee', 'Banshees', '#a8b8d8', '#3a4460', ['wraps'], 'Seu lamento envolve os aliados num escudo gelado.'],
      ['abomination', 'Abominação', 'Abominações', '#7a6a5a', '#2a2018', ['bigsquare', 'wraps'], 'Costurada com pedaços de muitos guerreiros.'],
      ['bonedragon', 'Dragão Esqueleto', 'Dragões Esqueletos', '#d8d0b8', '#5a5240', ['horns'], 'Ossos de dragão erguidos por magia negra.'],
      ['werewolf', 'Lobisomem', 'Lobisomens', '#5a4a3a', '#201810', ['ears', 'fur'], 'Ferido, a lua fala mais alto e ele dispara.'],
      ['tombworm', 'Verme da Tumba', 'Vermes da Tumba', '#8a7a6a', '#30281e', ['stripes'], 'Cava entre os caixões e sai onde ninguém espera.'],
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
      ['flameogre', 'Ogro em Chamas', 'Ogros em Chamas', '#b0482a', '#401408', ['axe', 'flame'], 'Quanto mais apanha, mais queima.'],
      ['magmaworm', 'Verme de Magma', 'Vermes de Magma', '#d0602a', '#4a1a08', ['stripes', 'flame'], 'Nada na rocha derretida sob a estrada.'],
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
    berserker: () => 'Ao perder metade da vida entra em fúria e corre quase o dobro. Derrube de uma vez, ou deixe lento antes.',
    burrower: () => 'A cada 4 s mergulha na terra e nada o acerta. Poças do Caldeirão e veneno continuam agindo.',
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
  // Os inimigos do campo, na ordem dos papéis; o Vale e os campos do editor usam os clássicos
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
