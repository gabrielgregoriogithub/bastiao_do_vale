// Compêndio de inimigos e torres, e o cartão que apresenta cada inimigo na primeira vez que ele aparece.
// Os inimigos já vistos ficam no navegador; sem armazenamento, todos parecem novos a cada visita.
(() => {
  const TD = window.TD;
  const G = TD.game;
  const { ENEMIES, ENEMY_INFO, TOWERS, ORDER, SPECS } = TD;
  const SEEN_KEY = 'bastiao-vistos';
  const CARD_SECONDS = 7;
  const fmt = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  function readSeen() {
    try {
      const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  function writeSeen(set) { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])); } catch { /* armazenamento indisponível */ } }
  const seen = new Set(readSeen());

  const $ = id => document.getElementById(id);
  const card = $('discover'), cardIcon = $('discoverIcon'), cardName = $('discoverName'), cardText = $('discoverText');
  const modal = $('codexModal'), enemyList = $('codexEnemies'), towerList = $('codexTowers');
  let cardT = 0, open = false, prevMenuOpen = false;

  // Desenha o inimigo centralizado num quadro de 48 unidades; silhueta escura quando ainda não foi visto
  function enemyIcon(canvas, type, silhouette = false) {
    const g = canvas.getContext('2d'), d = ENEMIES[type], k = canvas.width / 48;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, 48, 48);
    g.translate(24, 27);
    const s = Math.min(1, 15 / d.r);
    g.scale(s, s);
    TD.drawEnemy(g, {
      type, d, x: 0, y: d.flying ? 10 : 0, hp: 1, maxHp: 1, flash: 0, slowT: 0, frozenT: 0,
      shield: 0, weakT: 0, dots: {}, wob: 0, revealed: true, // no ícone o camuflado aparece inteiro
    }, true);
    if (silhouette) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#0f120d';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.globalCompositeOperation = 'source-over';
    }
  }

  function towerIcon(canvas, type) {
    const g = canvas.getContext('2d'), k = canvas.width / 48;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, 48, 48);
    TD.drawTower(g, type, 24, 33, 1, -Math.PI / 4, 0.72);
  }

  function showCard(type) {
    cardName.textContent = `Novo inimigo: ${ENEMIES[type].name}`;
    cardText.textContent = ENEMY_INFO[type];
    enemyIcon(cardIcon, type);
    card.hidden = false;
    cardT = CARD_SECONDS;
  }
  // vários inimigos novos na mesma onda viram uma fila de cartões, um de cada vez
  let queue = [];
  function nextCard() {
    card.hidden = true;
    cardT = 0;
    const type = queue[0];
    queue = queue.slice(1);
    if (type) showCard(type);
  }
  $('discoverClose').addEventListener('click', nextCard);

  function sync(dt) {
    const S = G.S;
    if (S.inGame && !S.over) {
      for (const e of S.enemies) {
        if (seen.has(e.type)) continue;
        seen.add(e.type);
        writeSeen(seen);
        queue = [...queue, e.type];
      }
    }
    if (cardT > 0) {
      cardT -= dt;
      if (cardT <= 0) nextCard();
    } else if (queue.length) nextCard();
  }

  function enemyRow(type) {
    const d = ENEMIES[type], known = seen.has(type);
    const tags = [d.flying ? 'Voa' : null, d.stealth ? 'Camuflado' : null, d.boss ? 'Chefe' : null, d.enrage ? 'Fúria' : null, d.burrowEvery ? 'Cava' : null].filter(Boolean).map(t => `<span class="tag">${t}</span>`).join('');
    const stats = `Vida ${d.hp} · Velocidade ${fmt(d.speed)} · Armadura ${d.armor} · Custa ${d.lives || 1} ${d.lives > 1 ? 'vidas' : 'vida'}`;
    return `<li class="codex-row${known ? '' : ' unknown'}">
      <canvas width="96" height="96" data-enemy="${type}" aria-hidden="true"></canvas>
      <div class="codex-txt">
        <span class="codex-nm">${known ? d.name : '???'} ${known ? tags : ''}</span>
        <span class="codex-stats">${known ? stats : 'Ainda não encontrado. Aparece em ondas futuras.'}</span>
        ${known ? `<span class="codex-ds">${ENEMY_INFO[type]}</span>` : ''}
      </div>
    </li>`;
  }

  function towerRow(type) {
    const d = TOWERS[type];
    const specs = SPECS[type].map(s => s.name).join(' ou ');
    const extras = [d.ground ? 'Não acerta voadores' : null, d.pierce || d.puddle ? 'Ignora armadura' : null, d.chain ? `Salta entre ${d.chain} inimigos` : null].filter(Boolean).join(' · ');
    return `<li class="codex-row">
      <canvas width="96" height="96" data-tower="${type}" aria-hidden="true"></canvas>
      <div class="codex-txt">
        <span class="codex-nm">${d.name} <span class="tag gold">${d.cost} de ouro</span></span>
        <span class="codex-stats">${d.economy
          ? `Não ataca · ${d.income} de ouro por onda no nível 1, ${Math.round(d.income * 2.4)} no nível 3`
          : d.support
          ? `Não ataca · +${Math.round(d.aura * 100)}% de dano às torres a até ${fmt(d.range)} casas (vários não se somam)`
          : `Dano ${d.dmg} · Alcance ${fmt(d.range)} casas · ${fmt(1 / d.rate)} ${d.melee ? 'golpes' : 'disparos'} por segundo${d.units ? ` · ${d.units} soldados de ${d.unitHp} de vida` : ''}${extras ? ` · ${extras}` : ''}`}</span>
        <span class="codex-ds">${d.desc} No nível 3: ${specs}.</span>
      </div>
    </li>`;
  }

  // Os inimigos do campo da partida (ou do escolhido no menu), na ordem dos papéis
  const mapId = () => (G.S.inGame ? G.S.mapId : TD.menu?.sel?.map) || G.S.mapId;
  const glossary = () => TD.rosterOf(mapId()).map(type => ({ type, name: ENEMIES[type].name, desc: ENEMY_INFO[type] }));

  // Campo cujos inimigos o Compêndio mostra: abre no da partida e o jogador troca pelas abas
  let view = null;
  const tabs = $('codexMaps');
  function renderTabs() {
    const views = [...TD.officialMaps(), { id: 'custom', name: 'Campos do editor' }];
    tabs.innerHTML = views.map(m => {
      const found = TD.rosterOf(m.id).filter(t => seen.has(t)).length;
      return `<button class="btn small${m.id === view ? ' on' : ''}" data-map="${m.id}" aria-pressed="${m.id === view}">${m.name} <small>${found}/${TD.ROLE_ORDER.length}</small></button>`;
    }).join('');
  }
  tabs.addEventListener('click', ev => {
    const b = ev.target.closest('[data-map]');
    if (!b) return;
    view = b.dataset.map;
    render();
  });

  function render() {
    const roster = TD.rosterOf(view);
    renderTabs();
    enemyList.innerHTML = roster.map(enemyRow).join('');
    towerList.innerHTML = ORDER.map(towerRow).join('');
    for (const c of enemyList.querySelectorAll('canvas')) enemyIcon(c, c.dataset.enemy, !seen.has(c.dataset.enemy));
    for (const c of towerList.querySelectorAll('canvas')) towerIcon(c, c.dataset.tower);
    const all = Object.keys(ENEMIES);
    const viewName = view === 'custom' ? 'Campos do editor' : (TD.MAPS.find(m => m.id === view) || G.md.map).name;
    $('codexCount').textContent = `${viewName}: ${roster.filter(t => seen.has(t)).length} de ${roster.length} encontrados · ${all.filter(t => seen.has(t)).length} de ${all.length} em todos os campos`;
    const best = TD.achievements.runs();
    $('codexRuns').innerHTML = best.length ? `<table>
      <thead><tr><th scope="col">#</th><th scope="col">Campo</th><th scope="col">Herói</th><th scope="col">Ondas</th><th scope="col">Abates</th><th scope="col">Quando</th></tr></thead>
      <tbody>${best.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td><span class="run-map"></span><span class="muted run-meta"></span></td>
        <td class="run-hero"></td>
        <td>${Math.floor(Number(r.wave)) || 0}${r.victory ? ' ★' : ''}</td>
        <td>${(Math.floor(Number(r.kills)) || 0).toLocaleString('pt-BR')}</td>
        <td>${Number.isFinite(Number(r.at)) ? new Date(Number(r.at)).toLocaleDateString('pt-BR') : ''}</td>
      </tr>`).join('')}</tbody></table>` : '<p class="muted">Termine uma partida para ela aparecer aqui.</p>';
    // nomes de campo e herói vêm do armazenamento: entram como texto, nunca como HTML
    $('codexRuns').querySelectorAll('tbody tr').forEach((tr, i) => {
      tr.querySelector('.run-map').textContent = best[i].map;
      tr.querySelector('.run-hero').textContent = best[i].hero;
      const r = best[i], mods = Math.floor(Number(r.mods)) || 0;
      tr.querySelector('.run-meta').textContent = ` · ${r.diff}${mods ? ` · ${mods} desafio${mods > 1 ? 's' : ''}` : ''}${r.daily ? ' · do dia' : ''}`;
    });
    const ach = TD.achievements.list();
    $('achCount').textContent = `${ach.filter(a => a.done).length} de ${ach.length} · ${TD.achievements.totalKills().toLocaleString('pt-BR')} inimigos derrotados ao todo`;
    $('codexAch').innerHTML = ach.map(a => `<li class="ach${a.done ? ' done' : ''}">
      <span class="ach-mark" aria-hidden="true">${a.done ? '★' : '☆'}</span>
      <span class="ach-txt"><span class="ach-nm">${a.name}</span><span class="ach-ds">${a.desc}</span></span>
      <span class="sr-only">${a.done ? 'Conquistada' : 'Ainda não conquistada'}</span>
    </li>`).join('');
  }

  function show() {
    if (open) return;
    open = true;
    prevMenuOpen = G.S.menuOpen;
    G.S.menuOpen = true;
    // campos do editor usam os inimigos clássicos, que têm aba própria
    view = TD.officialMaps().some(m => m.id === mapId()) ? mapId() : 'custom';
    render();
    modal.hidden = false;
    modal.scrollTop = 0;
    $('codexClose').focus({ preventScroll: true });
  }

  function hide() {
    if (!open) return;
    open = false;
    G.S.menuOpen = prevMenuOpen;
    modal.hidden = true;
  }
  $('codexClose').addEventListener('click', hide);

  TD.codex = { sync, show, hide, glossary, enemyIcon, isOpen: () => open };
})();
