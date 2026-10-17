// Menu e sessão: escolha de campo, dificuldade, herói e desafios, Desafio do dia, Forja,
// partida salva e introdução dos capítulos. A partida em si (painel, entrada, laço) fica em ui.js.
(() => {
  const TD = window.TD;
  const { MAPS, DIFFICULTIES, DIFF_ORDER } = TD;
  const G = TD.game;
  const sfx = TD.audio;
  const store = G.store;
  const SAVE_KEY = 'bastiao-partida';
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  const $ = id => document.getElementById(id);
  const ui = {
    end: $('endModal'), menu: $('menuModal'), mapList: $('mapList'), diffList: $('diffList'), btnStart: $('btnStart'), btnResume: $('btnResume'),
    forgeStars: $('forgeStars'), forgeList: $('forgeList'), forgeReset: $('forgeReset'), forgeHint: $('forgeHint'),
    heroList: $('heroList'), story: $('storyModal'), storyChapter: $('storyChapter'), storyTitle: $('storyTitle'),
    storyText: $('storyText'), storyGo: $('storyGo'), challengeList: $('challengeList'), challengeNote: $('challengeNote'),
    dailyText: $('dailyText'), btnDaily: $('btnDaily'), foldChallenges: $('foldChallenges'), foldForge: $('foldForge'),
    resumeCard: $('resumeCard'), resumeText: $('resumeText'), btnContinueSave: $('btnContinueSave'),
  };

  const menuSel = { map: store.load('bastiao-mapa', 'vale'), diff: store.load('bastiao-dificuldade', 'normal'), mods: readMods(), hero: store.load('bastiao-heroi', 'knight') };
  if (!TD.HEROES[menuSel.hero]) menuSel.hero = 'knight';
  function readMods() {
    try {
      const v = JSON.parse(localStorage.getItem('bastiao-desafios-escolhidos') || '[]');
      return Array.isArray(v) ? v.filter(id => TD.CHALLENGES.some(c => c.id === id)) : [];
    } catch { return []; }
  }
  if (!MAPS.some(m => m.id === menuSel.map)) menuSel.map = 'vale';
  if (!DIFFICULTIES[menuSel.diff]) menuSel.diff = 'normal';


  function startGame(mapId, diffId, mods = [], heroKind = 'knight') {
    G.newGame(mapId, diffId, mods, heroKind);
    afterStart();
  }

  function afterStart() {
    ui.end.hidden = true;
    ui.menu.hidden = true;
    TD.menu.onStart();
    TD.tutorial.start();
    showStory();
  }

  // ---------- Crônica do Vale ----------
  const storyKey = id => `bastiao-cronica-${id}`;
  function showStory() {
    const S = G.S, ch = TD.CHRONICLE[S.mapId];
    if (!ch || store.load(storyKey(S.mapId), '0') === '1') return;
    ui.storyChapter.textContent = ch.chapter;
    ui.storyTitle.textContent = G.md.map.name;
    ui.storyText.textContent = ch.text;
    S.menuOpen = true;
    ui.story.hidden = false;
    ui.storyGo.focus({ preventScroll: true });
  }
  function closeStory() {
    store.save(storyKey(G.S.mapId), 1);
    ui.story.hidden = true;
    G.S.menuOpen = false;
  }

  // ---------- Partida salva ----------
  function readSave() {
    try {
      const v = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return v && v.snap && v.snap.mapId && DIFFICULTIES[v.snap.diffId] ? v : null;
    } catch { return null; }
  }
  function writeSave() {
    const S = G.S;
    if (!S.inGame || S.over || S.halted) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), snap: G.snapshot() })); } catch { /* armazenamento indisponível */ }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* armazenamento indisponível */ } }
  G.onWaveEnd = writeSave;

  function continueSaved() {
    const save = readSave();
    if (!save || !G.restore(save.snap)) { clearSave(); syncMenu(); return; }
    afterStart();
  }

  // ---------- Menu ----------
  function buildMenu() {
    ui.mapList.innerHTML = '';
    for (const m of MAPS) {
      const b = document.createElement('button');
      b.className = 'mapcard';
      b.id = 'map-' + m.id;
      b.dataset.map = m.id;
      const ch = TD.CHRONICLE[m.id];
      const label = ch ? ch.chapter : m.custom ? 'Seu campo' : '';
      b.innerHTML = `<canvas width="400" height="240"></canvas>${label ? `<span class="chapter">${label}</span>` : ''}<span class="nm">${m.name}</span><span class="ds">${m.desc}</span><span class="rec"></span>`;
      const prev = TD.buildBg(TD.buildMap(m), 1);
      b.querySelector('canvas').getContext('2d').drawImage(prev, 0, 0, 400, 240);
      b.addEventListener('click', () => { menuSel.map = m.id; syncMenu(); });
      ui.mapList.appendChild(b);
    }
    ui.diffList.innerHTML = '';
    for (const id of DIFF_ORDER) {
      const d = DIFFICULTIES[id];
      const b = document.createElement('button');
      b.className = 'btn';
      b.id = 'diff-' + id;
      b.dataset.diff = id;
      b.innerHTML = `${d.name}<small>${d.hint}</small>`;
      b.addEventListener('click', () => { menuSel.diff = id; syncMenu(); });
      ui.diffList.appendChild(b);
    }
    ui.heroList.innerHTML = '';
    for (const id of TD.HERO_ORDER) {
      const d = TD.HEROES[id];
      const b = document.createElement('button');
      b.className = 'btn';
      b.id = 'hero-' + id;
      b.dataset.hero = id;
      b.innerHTML = `${d.name}<small>${d.summary} Habilidade: ${d.ability.name}.</small>`;
      b.addEventListener('click', () => { menuSel.hero = id; syncMenu(); });
      ui.heroList.appendChild(b);
    }
    ui.challengeList.innerHTML = '';
    for (const c of TD.CHALLENGES) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.id = 'challenge-' + c.id;
      b.dataset.mod = c.id;
      b.innerHTML = `${c.name}<small>${c.desc}</small>`;
      b.addEventListener('click', () => {
        menuSel.mods = menuSel.mods.includes(c.id) ? menuSel.mods.filter(x => x !== c.id) : [...menuSel.mods, c.id];
        syncMenu();
      });
      ui.challengeList.appendChild(b);
    }
  }

  function syncMenu() {
    const S = G.S;
    for (const b of ui.mapList.children) {
      b.setAttribute('aria-pressed', String(b.dataset.map === menuSel.map));
      const rec = G.readBest(b.dataset.map, menuSel.diff), stars = G.readStars(b.dataset.map, menuSel.diff);
      const recText = rec ? `Recorde: ${rec} ondas` : 'Ainda sem recorde';
      const ch = G.readChallenges(b.dataset.map, menuSel.diff);
      const chText = ch ? ` · vencido com ${ch} ${ch === 1 ? 'desafio' : 'desafios'}` : '';
      b.querySelector('.rec').textContent = `${starText(stars)} · ${recText}${chText}`;
    }
    for (const b of ui.diffList.children) b.setAttribute('aria-pressed', String(b.dataset.diff === menuSel.diff));
    for (const b of ui.challengeList.children) b.setAttribute('aria-pressed', String(menuSel.mods.includes(b.dataset.mod)));
    for (const b of ui.heroList.children) b.setAttribute('aria-pressed', String(b.dataset.hero === menuSel.hero));
    ui.btnResume.hidden = !(S.inGame && !S.over);
    const save = !(S.inGame && !S.over) ? readSave() : null;
    ui.resumeCard.hidden = !save;
    if (save) {
      const m = MAPS.find(x => x.id === save.snap.mapId);
      const done = save.snap.wave;
      ui.resumeText.textContent = `${m ? m.name : 'Campo'} · ${DIFFICULTIES[save.snap.diffId].name} · ${done} ${done === 1 ? 'onda concluída' : 'ondas concluídas'} · ${save.snap.lives} vidas · ${save.snap.towers.length} torres`;
    }
    const n = menuSel.mods.length;
    ui.challengeNote.textContent = n ? `${n} ${n === 1 ? 'ativo' : 'ativos'}` : '';
    renderDaily();
    renderForge();
  }

  function renderDaily() {
    const d = TD.dailyFor(new Date());
    const map = MAPS.find(m => m.id === d.map);
    const mods = d.mods.map(id => TD.CHALLENGES.find(c => c.id === id).name).join(' e ');
    const best = G.readDaily(d.key);
    ui.dailyText.textContent = `${map.name} · ${DIFFICULTIES[d.diff].name} · ${mods}. As ondas são iguais para todos hoje. ${best ? `Seu melhor hoje: onda ${best}.` : 'Você ainda não jogou hoje.'}`;
  }

  function startDaily() {
    store.save('bastiao-heroi', menuSel.hero);
    clearSave();
    G.newDaily(new Date(), menuSel.hero);
    afterStart();
  }

  function renderForge() {
    const meta = TD.meta, total = meta.totalStars(), avail = meta.available();
    ui.forgeStars.textContent = `${avail} de ${total} ★ disponíveis`;
    ui.forgeList.innerHTML = TD.PERKS.map(p => {
      const lvl = meta.level(p.id), cost = meta.nextCost(p.id);
      const pips = p.costs.map((_, i) => `<span class="pip${i < lvl ? ' on' : ''}"></span>`).join('');
      const btn = cost === null
        ? '<span class="perk-max">Completo</span>'
        : `<button class="btn small" id="perk-${p.id}" data-perk="${p.id}" ${avail < cost ? 'disabled' : ''}>Forjar · ${cost} ★</button>`;
      return `<div class="perk"><div class="perk-txt"><span class="perk-nm">${p.name}</span><span class="perk-ds">${p.desc}</span><span class="pips" aria-label="nível ${lvl} de ${p.costs.length}">${pips}</span></div>${btn}</div>`;
    }).join('');
    ui.forgeReset.hidden = meta.spent() === 0;
    ui.forgeHint.hidden = total > 0;
  }

  function openMenu() {
    G.S.menuOpen = true;
    ui.end.hidden = true;
    syncMenu();
    // seções recolhidas abrem sozinhas quando há algo para ver nelas
    ui.foldChallenges.open = menuSel.mods.length > 0;
    ui.foldForge.open = TD.meta.available() > 0;
    ui.menu.hidden = false;
    ui.menu.scrollTop = 0;
    ui.btnStart.focus({ preventScroll: true });
  }

  function closeMenu() {
    const S = G.S;
    if (!S.inGame || S.over) return;
    S.menuOpen = false;
    ui.menu.hidden = true;
  }


  // ---------- Botões do menu ----------
  ui.btnStart.addEventListener('click', () => {
    store.save('bastiao-mapa', menuSel.map);
    store.save('bastiao-dificuldade', menuSel.diff);
    clearSave();
    store.save('bastiao-desafios-escolhidos', JSON.stringify(menuSel.mods));
    store.save('bastiao-heroi', menuSel.hero);
    startGame(menuSel.map, menuSel.diff, menuSel.mods, menuSel.hero);
  });
  ui.btnContinueSave.addEventListener('click', continueSaved);
  ui.btnDaily.addEventListener('click', startDaily);
  $('btnEditor').addEventListener('click', () => {
    TD.editor.show(mapId => {
      buildMenu();
      menuSel.map = mapId;
      syncMenu();
      $('map-' + mapId)?.scrollIntoView({ block: 'nearest' });
    });
  });
  ui.btnResume.addEventListener('click', closeMenu);
  ui.forgeList.addEventListener('click', ev => {
    const id = ev.target.closest('[data-perk]')?.dataset.perk;
    if (id && TD.meta.buy(id)) { sfx.play('spec'); renderForge(); }
  });
  ui.forgeReset.addEventListener('click', () => { TD.meta.reset(); renderForge(); });
  ui.storyGo.addEventListener('click', closeStory);

  const menu = {
    sel: menuSel, onStart: () => {},
    startGame, startDaily, build: buildMenu, sync: syncMenu, open: openMenu, close: closeMenu,
    isStoryOpen: () => !ui.story.hidden, closeStory, readSave, writeSave, clearSave,
  };
  TD.menu = menu;
})();
