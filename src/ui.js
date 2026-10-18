// Interface da partida: painel, avisos, entrada do jogador e laço principal.
// O desenho do quadro fica em scene.js; o menu e as partidas salvas, em menu.js.
(() => {
  const TD = window.TD;
  const { T, COLS, ROWS, W, H, MAX_WAVES, MAX_LVL, TOWERS, ORDER, ENEMIES, DIFFICULTIES, DIFF_ORDER, TARGETING, MAPS, SPECS, POWERS } = TD;
  const G = TD.game;
  const sfx = TD.audio;
  const store = G.store;

  const fmt = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    gold: $('sGold'), lives: $('sLives'), wave: $('sWave'), kills: $('sKills'), best: $('sBest'), subline: $('subline'),
    towerList: $('towerList'), powerList: $('powerList'), info: $('infoBox'), next: $('nextInfo'),
    btnWave: $('btnWave'), btnAuto: $('btnAuto'), btnSpeed: $('btnSpeed'), btnPause: $('btnPause'), btnSound: $('btnSound'), btnMenu: $('btnMenu'),
    end: $('endModal'), endTitle: $('endTitle'), endStars: $('endStars'), endText: $('endText'),
    endRestart: $('endRestart'), endMenu: $('endMenu'), endContinue: $('endContinue'),
    endEpilogue: $('endEpilogue'),
    btnMusic: $('btnMusic'), btnCodex: $('btnCodex'),
    endReport: $('endReport'), endChart: $('endChart'),
  };
  const MUSIC_KEY = 'bastiao-musica';

  let dpr = 0;
  let lastHud = '', lastInfo = '';
  TD.menu.onStart = () => {
    lastHud = ''; lastInfo = '';
    lastWaveActive = false; lowLivesWarned = false;
  };

  // ---------- Relatório do fim da partida ----------
  function renderReport() {
    const rows = {};
    for (const t of G.S.towers) {
      const sp = G.specOf(t);
      const key = sp ? `${TOWERS[t.type].name} · ${sp.name}` : TOWERS[t.type].name;
      const r = rows[key] || (rows[key] = { name: key, dmg: 0, kills: 0, count: 0 });
      r.dmg += t.dmgDone; r.kills += t.kills; r.count += 1;
    }
    const h = G.S.hero;
    if (h) rows.hero = { name: `${TD.hero.defOf(h).name} · nível ${h.level}`, dmg: h.dmgDone, kills: h.kills, count: 1 };
    // quem não causou dano nem abateu ninguém fica de fora: uma tabela de zeros não conta nada
    const list = Object.values(rows).filter(r => r.dmg > 0 || r.kills > 0).sort((a, b) => b.dmg - a.dmg).slice(0, 6);
    const blessings = TD.blessings.chips(G.S);
    ui.endReport.hidden = !list.length && !blessings;
    ui.endReport.innerHTML = (list.length ? `<h3>Quem mais segurou a estrada</h3><table>
      <thead><tr><th scope="col">Defensor</th><th scope="col">Dano</th><th scope="col">Abates</th></tr></thead>
      <tbody>${list.map(r => `<tr><td>${r.name}${r.count > 1 ? ` <span class="muted">×${r.count}</span>` : ''}</td><td>${Math.round(r.dmg).toLocaleString('pt-BR')}</td><td>${r.kills}</td></tr>`).join('')}</tbody>
    </table>` : '') + (blessings ? `<h3 class="report-sub">Bênçãos desta partida</h3><ul class="bless-owned">${blessings}</ul>` : '');
  }

  G.onEnd = ({ title, text, stars, canContinue }) => {
    TD.menu.clearSave();
    TD.achievements.recordRun(canContinue);
    renderReport();
    TD.chart.render(ui.endChart, G.S.history);
    ui.endTitle.textContent = title;
    ui.endText.textContent = text;
    const finale = canContinue && G.S.mapId === TD.officialMaps().slice(-1)[0].id; // campos do editor entram no fim da lista
    ui.endEpilogue.hidden = !finale;
    ui.endEpilogue.textContent = finale ? TD.EPILOGUE : '';
    ui.endStars.hidden = !stars;
    ui.endStars.textContent = stars ? starText(stars) : '';
    ui.endStars.setAttribute('aria-label', `${stars} de 3 estrelas`);
    ui.endContinue.hidden = !canContinue;
    ui.end.hidden = false;
    announce(`${title}. ${text}`);
    (canContinue ? ui.endContinue : ui.endRestart).focus();
  };

  // ---------- Painel ----------
  function buildTowerButtons() {
    ui.towerList.innerHTML = '';
    ORDER.forEach((type, i) => {
      const d = TOWERS[type];
      const b = document.createElement('button');
      b.className = 'tbtn';
      b.id = 'tower-' + type;
      b.dataset.type = type;
      b.title = `${d.desc} Atalho: ${i + 1}`;
      b.innerHTML = `<canvas width="72" height="72"></canvas><span class="nm">${d.name}</span><span class="cost"><span class="cost-n">${d.cost}</span><span class="cost-u"> de ouro</span></span><span class="key">${i + 1}</span>`;
      const g = b.querySelector('canvas').getContext('2d');
      g.scale(2, 2);
      TD.drawTower(g, type, 18, 17, 1, -Math.PI / 4, 1);
      b.addEventListener('click', () => toggleBuild(type));
      ui.towerList.appendChild(b);
    });
  }

  function buildPowerButtons() {
    ui.powerList.innerHTML = '';
    for (const p of POWERS) {
      const b = document.createElement('button');
      b.className = 'pbtn';
      b.id = 'power-' + p.id;
      b.dataset.power = p.id;
      b.title = p.desc;
      b.innerHTML = `<span class="nm">${p.name}</span><span class="cd"></span><span class="key">${p.key.toUpperCase()}</span><span class="bar"></span>`;
      b.addEventListener('click', () => triggerPower(p.id));
      ui.powerList.appendChild(b);
    }
    const hb = document.createElement('button');
    hb.className = 'pbtn hero-ability';
    hb.id = 'power-ability';
    hb.dataset.power = 'ability';
    hb.innerHTML = '<span class="nm"></span><span class="cd"></span><span class="key">R</span><span class="bar"></span>';
    hb.addEventListener('click', () => TD.hero.useAbility());
    ui.powerList.appendChild(hb);
  }

  function syncAbilityButton(b) {
    const S = G.S, h = S.hero;
    const ab = h ? TD.hero.defOf(h).ability : null;
    b.querySelector('.nm').textContent = ab ? ab.name : 'Sem herói';
    b.title = ab ? ab.desc : 'O desafio Sem herói está ativo.';
    b.disabled = !TD.hero.canUseAbility();
    const cd = h ? h.abilityCd : 0;
    b.style.setProperty('--p', ab ? String(1 - cd / ab.cd) : '0');
    b.querySelector('.cd').textContent = !h ? 'Indisponível' : h.deadT > 0 ? 'Herói caído' : cd > 0 ? `${Math.ceil(cd)} s` : S.waveActive ? 'Pronto' : 'Na onda';
  }

  function syncPowers() {
    const S = G.S;
    for (const b of ui.powerList.children) {
      if (b.dataset.power === 'ability') { syncAbilityButton(b); continue; }
      const p = POWERS.find(q => q.id === b.dataset.power), cd = S.cooldowns[p.id];
      const ready = G.canUsePower(p.id);
      b.disabled = !ready;
      b.classList.toggle('aiming', S.aim === p.id);
      b.style.setProperty('--p', S.mods.nopower ? '0' : String(1 - cd / G.powerCd(p)));
      b.querySelector('.cd').textContent = S.mods.nopower ? 'Bloqueado' : cd > 0 ? `${Math.ceil(cd)} s` : S.waveActive ? 'Pronto' : 'Na onda';
    }
  }

  function toggleBuild(type) {
    const S = G.S;
    if (!S.inGame) return;
    S.build = S.build === type ? null : type;
    S.sel = null;
    S.aim = null;
    S.heroSel = false;
  }

  function toggleHero() {
    const S = G.S;
    if (!S.inGame || !S.hero || S.hero.deadT > 0) return;
    S.heroSel = !S.heroSel;
    S.sel = null; S.build = null; S.aim = null;
  }

  function triggerPower(id) {
    const S = G.S;
    if (!G.canUsePower(id)) return;
    if (id === 'rain') {
      S.aim = S.aim === 'rain' ? null : 'rain';
      S.build = null;
      S.sel = null; // com uma torre marcada, o painel e a barra seguiam mostrando a torre em vez da mira
      S.heroSel = false;
      return;
    }
    G.usePower(id);
  }

  function waveSummary(list) {
    const counts = {};
    for (const t of list) counts[t] = (counts[t] || 0) + 1;
    return Object.keys(ENEMIES).filter(k => counts[k])
      .map(k => `${counts[k]} ${TD.enemyName(G.S.mapId, k, counts[k])}`).join(', ');
  }

  function towerExtras(t) {
    const s = t.s, d = TOWERS[t.type];
    const rows = [];
    if (s.splash) rows.push(['Raio da explosão', `${fmt(s.splash / T)} casas`]);
    if (s.slow) rows.push(['Lentidão', `${Math.round(s.slow * 100)}% por ${fmt(s.slowDur)} s`]);
    if (s.targets > 1) rows.push(['Alvos por disparo', s.targets]);
    if (s.dot) rows.push([s.dotKind === 'poison' ? 'Veneno' : 'Queimadura', `${fmt(s.dot)} por segundo`]);
    if (s.freezeChance) rows.push(['Congelar', `${Math.round(s.freezeChance * 100)}% de chance`]);
    if (s.armoredMul > 1) rows.push(['Contra blindados', `${s.armoredMul}× dano`]);
    if (s.chain) rows.push(['Saltos do raio', `até ${s.chain} inimigos`]);
    if (s.units) {
      const up = t.units.filter(u => u.deadT <= 0).length;
      rows.push(['Soldados', `${up} de ${s.units} em campo`]);
      rows.push(['Vida de cada um', fmt(Math.round(s.unitHp))]);
      if (s.unitArmor) rows.push(['Armadura', `${Math.round(s.unitArmor * 100)}% menos dano`]);
      if (s.pierce) rows.push(['Golpes', 'Ignoram armadura']);
    }
    if (s.weakDur) rows.push(['Runa de fraqueza', `+${Math.round((TD.WEAK_MUL - 1) * 100)}% de dano por ${fmt(s.weakDur)} s`]);
    if (d.pierce) rows.push(['Armadura', 'Ignorada']);
    if (d.ground) rows.push(['Voadores', 'Não acerta']);
    if (s.buff) rows.push(['Estandarte', `+${Math.round(s.buff * 100)}% de dano`]);
    return rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  }

  function towerActions(t) {
    const S = G.S;
    const mode = TARGETING.find(x => x.id === t.target) || TARGETING[0];
    const target = t.spec === 'blizzard' || TOWERS[t.type].melee || TOWERS[t.type].support ? '' : `<button class="btn wide" id="btnTarget" data-act="target">Mira: ${mode.name}</button>`;
    const sellBtn = `<button class="btn danger" id="btnSell" data-act="sell" title="${t.fresh ? 'Ainda não atirou: devolve o preço cheio.' : 'Devolve 70% do que foi gasto.'}">Vender · ${G.refund(t)}${t.fresh ? ' (preço cheio)' : ''}</button>`;
    if (t.level < MAX_LVL) {
      const cost = G.upCost(t);
      return `<div class="controls">${target}<button class="btn primary" id="btnUp" data-act="up" ${S.gold < cost ? 'disabled' : ''}>Melhorar · ${cost} de ouro</button>${sellBtn}</div>`;
    }
    if (t.spec) return `<div class="controls">${target}${sellBtn}</div>`;
    const cost = G.specCost(t);
    const opts = SPECS[t.type].map(sp => `
      <button class="spec" id="spec-${sp.id}" data-act="spec" data-spec="${sp.id}" ${S.gold < cost ? 'disabled' : ''} style="--spec:${sp.color}">
        <span class="spec-nm">${sp.name}</span><span class="spec-ds">${sp.desc}</span>
      </button>`).join('');
    return `<h3>Especializar · ${cost} de ouro</h3><div class="specs">${opts}</div><div class="controls">${target}${sellBtn}</div>`;
  }

  function heroInfo(h) {
    const def = TD.hero.defOf(h), next = TD.hero.xpToNext(h);
    const status = h.deadT > 0 ? `Caído. Volta em <span id="hDead">${Math.ceil(h.deadT)}</span> s.` : `Toque no mapa para mover. ${def.summary}`;
    return `<h3>${def.name} · nível ${h.level} de ${def.maxLevel}</h3>
      <p>${status}</p>
      <p><strong>${def.ability.name} (R):</strong> ${def.ability.desc}</p>
      <dl class="statgrid">
        ${def.melee ? `<dt>Vida</dt><dd id="hHp">${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}</dd>` : ''}
        <dt>Dano</dt><dd>${fmt(h.dmg)} a cada ${fmt(def.rate)} s</dd>
        ${def.melee ? '' : `<dt>Alcance</dt><dd>${fmt(def.range)} casas</dd>`}
        <dt>Experiência</dt><dd id="hXp">${next === null ? 'Nível máximo' : `${h.xp} / ${next}`}</dd>
        <dt>Abates</dt><dd id="hKills">${h.kills}</dd>
      </dl>`;
  }

  // Valor do próximo nível ao lado do atual, para o jogador ver o que a melhoria compra
  let nextStat = () => '';
  function setNextPreview(t) {
    if (!t || t.level >= MAX_LVL) { nextStat = () => ''; return; }
    const n = G.towerStats({ ...t, level: t.level + 1 });
    nextStat = (pick, unit = '') => `<span class="next" aria-label="no próximo nível">→ ${fmt(pick(n))}${unit}</span>`;
  }

  function renderInfo() {
    setNextPreview(G.S.sel);
    const S = G.S, t = S.sel;
    ui.info.classList.toggle('focus', !!t || (S.heroSel && !!S.hero));
    if (S.heroSel && S.hero) {
      ui.info.innerHTML = heroInfo(S.hero);
    } else if (t) {
      const d = TOWERS[t.type], s = t.s, sp = G.specOf(t);
      const title = sp ? `${d.name} · ${sp.name}` : `${d.name} · nível ${t.level} de ${MAX_LVL}`;
      const range = `<dt>Alcance</dt><dd>${fmt(s.range / T)} casas${nextStat(n => n.range / T)}</dd>`;
      // o Estandarte não ataca: mostra o bônus que dá e quantas torres estão ao alcance dele
      const rows = d.support
        ? `<dt>Bônus às vizinhas</dt><dd>+${Math.round(s.aura * 100)}% de dano${nextStat(n => n.aura * 100, '%')}</dd>${range}
          <dt>Torres ao alcance</dt><dd>${S.towers.filter(o => !TOWERS[o.type].support && Math.hypot(o.x - t.x, o.y - t.y) <= s.range).length}</dd>`
        : `<dt>Dano</dt><dd>${fmt(s.dmg)}${nextStat(n => n.dmg)}</dd>${range}
          <dt>${t.spec === 'blizzard' ? 'Pulsos' : TOWERS[t.type].melee ? 'Golpes' : 'Disparos'}</dt><dd>${fmt(1 / s.rate)} por segundo${nextStat(n => 1 / n.rate)}</dd>${towerExtras(t)}
          <dt>Abates</dt><dd id="iKills">${t.kills}</dd>
          <dt>Dano causado</dt><dd id="iDmg">${Math.round(t.dmgDone)}</dd>`;
      ui.info.innerHTML = `<h3>${title}</h3>
        ${sp ? `<p class="spec-line" style="--spec:${sp.color}">${sp.desc}</p>` : ''}
        <dl class="statgrid">${rows}</dl>
        ${towerActions(t)}`;
    } else if (S.aim) {
      ui.info.innerHTML = `<h3>Chuva de flechas</h3>
        <p>Clique no mapa onde as flechas devem cair. No celular, toque duas vezes no mesmo ponto. Esc cancela.</p>`;
    } else if (S.build) {
      const d = TOWERS[S.build];
      const armor = S.build === 'ballista' || d.support ? '' : ' Blindados e chefes absorvem parte do dano.';
      ui.info.innerHTML = `<h3>Construindo: ${d.name}</h3>
        <p><strong>${d.desc}</strong>${armor}</p>
        <p>Clique numa casa de gramado para construir. No celular, o primeiro toque mostra o alcance e o segundo confirma. Esc ou clique direito cancela.</p>`;
    } else {
      ui.info.innerHTML = `<h3>Como jogar</h3>
        <p>Escolha uma torre e toque no <strong>gramado</strong> para construir. Toque numa torre para melhorar, vender ou mudar a mira. No nível 3 ela ganha uma <strong>especialização</strong>.</p>
        <p>Toque no seu <strong>herói</strong> (ou tecle H) e depois no mapa para movê-lo. Ele sobe de nível com os abates, e a tecla R usa a habilidade dele.</p>
        <p><strong>${TD.enemyName(S.mapId, 'flyer', 2)}</strong> voam em linha reta e o canhão não os acerta. A cada 5 ondas chega um chefe diferente: ${TD.BOSS_ROTATION.map(b => TD.enemyName(S.mapId, b)).join(', ').replace(/, ([^,]*)$/, ' e $1')}.</p>`;
    }
  }

  function waveButtonLabel(remaining) {
    const S = G.S;
    if (S.waveActive && G.canCallEarly()) return `Chamar próxima · +${G.waveBonus(S.wave) + G.earlyBonus()}`;
    if (S.waveActive) return `Onda em andamento · ${remaining}`;
    if (S.autoT !== null) return `Próxima onda em ${Math.ceil(S.autoT)}`;
    return 'Iniciar onda';
  }

  // ---------- Avisos para leitor de tela ----------
  // O jogo acontece num canvas; estes textos contam em voz os momentos que só apareceriam na imagem
  const announcer = $('announcer');
  let lastWaveActive = false, lowLivesWarned = false;
  function announce(text) {
    announcer.textContent = '';
    // troca em dois tempos para o leitor repetir mensagens iguais
    setTimeout(() => { announcer.textContent = text; }, 30);
  }

  function announceChanges() {
    const S = G.S;
    if (!S.inGame) { lastWaveActive = false; lowLivesWarned = false; return; }
    if (S.waveActive && !lastWaveActive) {
      const bossText = S.wave > 0 && S.wave % 5 === 0 ? ` Chefe a caminho: ${TD.enemyName(S.mapId, TD.bossFor(S.wave))}.` : '';
      announce(`Onda ${S.wave} começou, com ${S.queue.length + S.enemies.length} inimigos.${bossText}`);
    } else if (!S.waveActive && lastWaveActive && !S.over && !S.halted) {
      announce(`Onda ${S.wave} vencida. Ouro: ${S.gold}. Vidas: ${S.lives}.`);
    }
    lastWaveActive = S.waveActive;
    if (!lowLivesWarned && S.lives > 0 && S.lives <= Math.max(3, S.maxLives / 4)) {
      lowLivesWarned = true;
      announce(`Atenção: restam só ${S.lives} vidas.`);
    }
  }

  function syncHud() {
    const S = G.S, md = G.md;
    announceChanges();
    const remaining = S.queue.length + S.enemies.length;
    const autoSec = S.autoT === null ? -1 : Math.ceil(S.autoT);
    const hud = [S.runId, S.mapId, S.gold, S.lives, S.wave, S.kills, S.best, S.waveActive, remaining, autoSec, S.speed, S.paused, S.auto, sfx.isMuted(), S.build, S.aim, S.over, S.halted, S.inGame, G.canCallEarly(), !!S.offer].join('|');
    if (hud !== lastHud) {
      lastHud = hud;
      ui.gold.textContent = S.gold;
      ui.lives.textContent = S.lives;
      ui.lives.classList.toggle('low', S.lives <= Math.max(3, S.maxLives / 4));
      ui.wave.textContent = S.endless || S.wave > MAX_WAVES ? S.wave : `${S.wave}/${MAX_WAVES}`;
      ui.kills.textContent = S.kills;
      ui.best.textContent = S.best;
      const modNames = TD.CHALLENGES.filter(c => S.mods[c.id]).map(c => c.name);
      const modText = modNames.length ? ` · Desafios: ${modNames.join(', ')}` : '';
      ui.subline.textContent = `${S.daily ? 'Desafio do dia · ' : ''}${md.map.name} · ${S.diff.name}${modText} · segure a estrada até a muralha por ${MAX_WAVES} ondas.`;
      const swarm = TD.isSwarm(S.wave + 1) ? ' Revoada: dois terços voam.' : '';
      ui.next.textContent = `A seguir, onda ${S.wave + 1}: ${waveSummary(S.next)}.${swarm}`;
      ui.btnWave.disabled = !S.inGame || S.over || S.halted || !!S.offer || (S.waveActive && !G.canCallEarly());
      ui.btnWave.textContent = waveButtonLabel(remaining);
      ui.btnAuto.setAttribute('aria-pressed', String(S.auto));
      ui.btnSpeed.textContent = `${S.speed}×`;
      ui.btnPause.textContent = S.paused ? 'Continuar' : 'Pausar';
      ui.btnPause.setAttribute('aria-pressed', String(S.paused));
      ui.btnSound.textContent = sfx.isMuted() ? 'Mudo' : 'Som';
      ui.btnSound.setAttribute('aria-pressed', String(!sfx.isMuted()));
      ui.btnMusic.setAttribute('aria-pressed', String(musicWanted()));
      for (const b of ui.towerList.children) {
        const cost = G.costOf(b.dataset.type);
        b.classList.toggle('active', S.build === b.dataset.type);
        b.classList.toggle('poor', S.gold < cost);
        b.querySelector('.cost-n').textContent = cost;
      }
    }
    syncPowers();
    const t = S.sel, h = S.hero;
    const afford = t ? (t.level < MAX_LVL ? S.gold >= G.upCost(t) : S.gold >= G.specCost(t)) : false;
    const info = S.heroSel && h ? `h${h.level}-${h.deadT > 0}`
      : t ? `t${t.id}-${t.level}-${t.spec}-${t.target}-${afford}-${!!t.fresh}-${t.s.buff}-${S.towers.length}` : S.aim ? 'aim' : S.build ? 'b' + S.build : 'none';
    if (info !== lastInfo) { lastInfo = info; renderInfo(); }
    if (t) {
      const k = $('iKills'), d = $('iDmg');
      if (k) k.textContent = t.kills;
      if (d) d.textContent = Math.round(t.dmgDone);
    }
    if (S.heroSel && h) syncHeroInfo(h);
  }

  function syncHeroInfo(h) {
    const hp = $('hHp'), xp = $('hXp'), kills = $('hKills'), dead = $('hDead');
    const next = TD.hero.xpToNext(h);
    if (hp) hp.textContent = `${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`;
    if (xp) xp.textContent = next === null ? 'Nível máximo' : `${h.xp} / ${next}`;
    if (kills) kills.textContent = h.kills;
    if (dead) dead.textContent = Math.ceil(h.deadT);
  }

  // ---------- Entrada ----------
  function pointFrom(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
  }

  // No toque as casas ficam pequenas: o primeiro toque mostra a prévia e o segundo, no mesmo lugar, confirma
  let pending = null;
  const AIM_CONFIRM_PX = 24;

  function confirmTouch(kind, p, c, r) {
    const same = pending && pending.kind === kind &&
      (kind === 'aim' ? Math.hypot(pending.x - p.x, pending.y - p.y) <= AIM_CONFIRM_PX : pending.c === c && pending.r === r);
    pending = same ? null : { kind, x: p.x, y: p.y, c, r };
    return same;
  }

  function onPoint(p, isTouch) {
    const S = G.S;
    if (!S.inGame || S.over || S.halted) return;
    const c = Math.floor(p.x / T), r = Math.floor(p.y / T);
    if (S.aim) {
      if (isTouch && !confirmTouch('aim', p, c, r)) return;
      if (G.usePower(S.aim, p.x, p.y)) S.aim = null;
      return;
    }
    const t = G.towerAt(c, r);
    if (!S.build && TD.hero.heroAt(p.x, p.y, isTouch ? 28 : 18)) { toggleHero(); return; }
    if (t) { S.sel = t; S.build = null; S.heroSel = false; return; }
    if (S.heroSel) { TD.hero.order(p.x, p.y); S.heroSel = false; return; }
    if (S.build) {
      if (isTouch && G.canBuild(c, r) && !confirmTouch('build', p, c, r)) return;
      G.build(S.build, c, r);
      return;
    }
    S.sel = null;
  }

  // Teclado: as setas movem um cursor de casa em casa; Enter constrói ou manda o herói para lá
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  function moveCursor(dc, dr) {
    const S = G.S;
    const cur = S.hover && S.hover.c >= 0 && S.hover.c < COLS && S.hover.r >= 0 && S.hover.r < ROWS ? S.hover : { c: 9, r: 5 };
    const c = Math.max(0, Math.min(COLS - 1, cur.c + dc)), r = Math.max(0, Math.min(ROWS - 1, cur.r + dr));
    S.hover = { c, r };
    S.hoverPx = { x: (c + 0.5) * T, y: (r + 0.5) * T };
    const t = !S.build && !S.heroSel ? G.towerAt(c, r) : null;
    if (t) S.sel = t;
  }

  function cancel() { const S = G.S; S.build = null; S.sel = null; S.aim = null; S.heroSel = false; }
  function cycleSpeed() { const S = G.S; S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; }
  function toggleSound() { sfx.setMuted(!sfx.isMuted()); store.save('bastiao-mudo', sfx.isMuted() ? 1 : 0); }

  canvas.addEventListener('pointermove', ev => {
    const p = pointFrom(ev);
    G.S.hoverPx = p;
    G.S.hover = { c: Math.floor(p.x / T), r: Math.floor(p.y / T) };
  });
  canvas.addEventListener('pointerleave', ev => {
    if (ev.pointerType === 'touch') return;
    G.S.hover = null; G.S.hoverPx = null;
  });
  canvas.addEventListener('pointerdown', ev => {
    if (ev.button === 2) { cancel(); return; }
    const p = pointFrom(ev);
    G.S.hoverPx = p;
    G.S.hover = { c: Math.floor(p.x / T), r: Math.floor(p.y / T) };
    onPoint(p, ev.pointerType === 'touch' || ev.pointerType === 'pen');
  });
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());

  ui.info.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const S = G.S, act = el.dataset.act;
    if (act === 'up') G.upgrade(S.sel);
    if (act === 'sell') G.sell(S.sel);
    if (act === 'target') G.cycleTarget(S.sel);
    if (act === 'spec') G.specialize(S.sel, el.dataset.spec);
  });
  ui.btnWave.addEventListener('click', () => G.startWave());
  ui.btnAuto.addEventListener('click', () => G.toggleAuto());
  ui.btnSpeed.addEventListener('click', cycleSpeed);
  ui.btnPause.addEventListener('click', () => { G.S.paused = !G.S.paused; });
  ui.btnSound.addEventListener('click', toggleSound);
  ui.btnMenu.addEventListener('click', () => TD.menu.open());
  ui.btnMusic.addEventListener('click', toggleMusic);
  ui.endRestart.addEventListener('click', () => TD.menu.restart());
  ui.btnCodex.addEventListener('click', () => TD.codex.show());

  // ---------- Janela de atalhos ----------
  const help = $('helpModal');
  let helpPrevMenu = false;
  function openHelp() {
    if (!help.hidden) return;
    helpPrevMenu = G.S.menuOpen;
    G.S.menuOpen = true;
    help.hidden = false;
    $('helpClose').focus({ preventScroll: true });
  }
  function closeHelp() {
    if (help.hidden) return;
    help.hidden = true;
    G.S.menuOpen = helpPrevMenu;
  }
  $('btnHelp').addEventListener('click', openHelp);
  $('helpClose').addEventListener('click', closeHelp);
  ui.endMenu.addEventListener('click', () => TD.menu.open());
  ui.endContinue.addEventListener('click', () => { G.continueEndless(); ui.end.hidden = true; });

  // O áudio só pode começar depois de um gesto do jogador
  const musicWanted = () => store.load(MUSIC_KEY, '1') === '1';
  function unlockAudio() {
    if (!sfx.unlock()) return;
    if (musicWanted() && !sfx.isMusicPlaying()) sfx.startMusic();
  }
  function toggleMusic() {
    const on = !musicWanted();
    store.save(MUSIC_KEY, on ? '1' : '0');
    if (on) { sfx.unlock(); sfx.startMusic(); } else sfx.stopMusic();
    lastHud = '';
  }
  window.addEventListener('pointerdown', unlockAudio, { capture: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });

  window.addEventListener('keydown', ev => {
    const S = G.S;
    if (TD.editor.isOpen()) {
      if (ev.key === 'Escape') TD.editor.close();
      return;
    }
    if (TD.menu.isStoryOpen()) {
      if (ev.key === 'Escape' || ev.key === 'Enter') { ev.preventDefault(); TD.menu.closeStory(); }
      return;
    }
    if (!help.hidden) {
      if (ev.key === 'Escape' || ev.key === '?') closeHelp();
      return;
    }
    if (TD.codex.isOpen()) {
      if (ev.key === 'Escape' || ev.key.toLowerCase() === 'c') TD.codex.hide();
      return;
    }
    if (S.menuOpen) {
      if (ev.key === 'Escape') TD.menu.close();
      return;
    }
    // escolha de bênção aberta: só as teclas 1 a 3 (e o Tab/Enter dos botões) valem
    if (TD.blessings.isOpen()) {
      if (ev.key >= '1' && ev.key <= '3') { ev.preventDefault(); TD.blessings.chooseIndex(Number(ev.key) - 1); }
      return;
    }
    if (!S.inGame || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const k = ev.key.toLowerCase();
    const power = POWERS.find(p => p.key === k);
    if (k >= '1' && k <= String(ORDER.length)) toggleBuild(ORDER[Number(k) - 1]);
    else if (power) triggerPower(power.id);
    else if (k === ' ') { ev.preventDefault(); G.startWave(); }
    else if (k === 'h') toggleHero();
    else if (k === 'u') G.upgrade(S.sel);
    else if (k === 'v') G.sell(S.sel);
    else if (k === 't') G.cycleTarget(S.sel);
    else if (k === 'p') S.paused = !S.paused;
    else if (k === 'f') cycleSpeed();
    else if (k === 'a') G.toggleAuto();
    else if (k === 'm') toggleSound();
    else if (k === 'n') toggleMusic();
    else if (k === 'c') TD.codex.show();
    else if (ev.key === '?') openHelp();
    else if (k === 'r') TD.hero.useAbility();
    else if (ARROWS[ev.key] && (S.build || S.heroSel || S.sel)) { ev.preventDefault(); moveCursor(...ARROWS[ev.key]); }
    else if (k === 'enter' && S.hover && (S.build || S.heroSel)) { ev.preventDefault(); onPoint({ x: (S.hover.c + 0.5) * T, y: (S.hover.r + 0.5) * T }, false); }
    else if (k === 'escape') cancel();
  });

  document.addEventListener('visibilitychange', () => {
    const S = G.S;
    if (!document.hidden || !S.inGame || S.over) return;
    S.paused = true;
    TD.menu.writeSave();
  });
  window.addEventListener('pagehide', () => { TD.menu.writeSave(); TD.achievements.flushKills(); });

  // ---------- Laço principal ----------
  function fit() {
    const next = Math.min(2, window.devicePixelRatio || 1);
    if (next === dpr) return;
    dpr = next;
    canvas.width = W * dpr; canvas.height = H * dpr;
    TD.scene.setup(ctx, dpr);
  }
  window.addEventListener('resize', fit);

  let last = performance.now();
  function frame(now) {
    const S = G.S;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const running = S.inGame && !S.paused && !S.over && !S.halted && !S.menuOpen && !TD.blessings.isOpen();
    if (running) for (let i = 0; i < S.speed && !G.S.over; i++) G.update(dt);
    TD.scene.draw(dt);
    syncHud();
    TD.tutorial.sync();
    TD.codex.sync(dt);
    TD.achievements.sync(dt);
    TD.blessings.sync();
    TD.dock.sync();
    TD.device.sync();
    sfx.setIntensity(running && S.waveActive ? 1 : 0);
    requestAnimationFrame(frame);
  }

  // Ações do painel, usadas também pela barra de comando do celular (dock.js)
  TD.ui = {
    toggleBuild, triggerPower, cancel,
    waveLabel: () => waveButtonLabel(G.S.queue.length + G.S.enemies.length),
  };

  function start(data) {
    sfx.setMuted(store.load('bastiao-mudo', '0') === '1');
    fit();
    buildTowerButtons();
    buildPowerButtons();
    TD.menu.build();
    if (!G.restore(data)) {
      G.prepare(TD.menu.sel.map, TD.menu.sel.diff);
      TD.menu.open();
    }
    window.claude?.hot?.snapshot?.(G.snapshot);
    requestAnimationFrame(t => { last = t; frame(t); });
  }

  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
