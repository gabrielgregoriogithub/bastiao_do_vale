// Barra de comando do celular: torres, poderes, onda e as ações da torre selecionada ficam ao alcance
// do polegar, sem rolar a página. Só aparece em telas pequenas (o CSS decide); no computador fica escondida.
// Usa as mesmas ações do painel (TD.ui) e da simulação, então não muda nenhuma regra do jogo.
(() => {
  const TD = window.TD;
  const { TOWERS, ORDER, POWERS, MAX_LVL, SPECS, TARGETING } = TD;
  const G = TD.game;
  const $ = id => document.getElementById(id);
  const dock = $('dock'), buildRow = $('dockBuild'), selRow = $('dockSel'), actRow = $('dockAct');
  const stat = { gold: $('dGold'), lives: $('dLives'), wave: $('dWave') };
  const SHORT = { rain: 'Chuva', freeze: 'Congelar', rally: 'Chamado' };

  // ---------- Montagem ----------
  function buildTowers() {
    buildRow.innerHTML = '';
    buildRow.style.setProperty('--towers', ORDER.length);
    for (const type of ORDER) {
      const b = document.createElement('button');
      b.className = 'dbtn dtower';
      b.dataset.type = type;
      b.innerHTML = `<canvas width="72" height="72" aria-hidden="true"></canvas><span class="dcost"></span>`;
      const g = b.querySelector('canvas').getContext('2d');
      g.scale(2, 2);
      TD.drawTower(g, type, 18, 24, 1, -Math.PI / 4, 0.6);
      b.addEventListener('click', () => TD.ui.toggleBuild(type));
      buildRow.appendChild(b);
    }
  }

  function buildActions() {
    actRow.innerHTML = '';
    for (const p of POWERS) {
      const b = document.createElement('button');
      b.className = 'dbtn dpower';
      b.dataset.power = p.id;
      b.innerHTML = `<span class="dnm">${SHORT[p.id] || p.name}</span><span class="dcd"></span><span class="dbar"></span>`;
      b.addEventListener('click', () => TD.ui.triggerPower(p.id));
      actRow.appendChild(b);
    }
    const hb = document.createElement('button');
    hb.className = 'dbtn dpower dability';
    hb.innerHTML = '<span class="dnm"></span><span class="dcd"></span><span class="dbar"></span>';
    hb.addEventListener('click', () => TD.hero.useAbility());
    actRow.appendChild(hb);
    const wb = document.createElement('button');
    wb.className = 'dbtn dwave';
    wb.addEventListener('click', () => G.startWave());
    actRow.appendChild(wb);
  }

  // ---------- Ações da torre, do herói ou da mira selecionados ----------
  function towerSel(t) {
    const S = G.S, d = TOWERS[t.type], sp = G.specOf(t);
    const title = sp ? `${d.name}<small>${sp.name}</small>` : `${d.name}<small>nível ${t.level} de ${MAX_LVL}</small>`;
    let main = '';
    if (t.level < MAX_LVL) {
      const cost = G.upCost(t);
      main = `<button class="dbtn dact primary" data-act="up" ${S.gold < cost ? 'disabled' : ''}>Melhorar<small>${cost} de ouro</small></button>`;
    } else if (!t.spec) {
      const cost = G.specCost(t);
      main = SPECS[t.type].map(s => `<button class="dbtn dact dspec" data-act="spec" data-spec="${s.id}" style="--spec:${s.color}" ${S.gold < cost ? 'disabled' : ''}>${s.name}<small>${cost} de ouro</small></button>`).join('');
    }
    const aim = t.spec === 'blizzard' || d.melee || d.support || d.economy ? '' : `<button class="dbtn dact" data-act="target">Mira<small>${(TARGETING.find(x => x.id === t.target) || TARGETING[0]).name}</small></button>`;
    const sell = `<button class="dbtn dact danger" data-act="sell">Vender<small>${G.refund(t)} de ouro</small></button>`;
    return `<span class="dsel-nm">${title}</span>${main}${aim}${sell}<button class="dbtn dact dclose" data-act="close" aria-label="Fechar">✕</button>`;
  }

  function selHtml() {
    const S = G.S;
    if (S.heroSel && S.hero) {
      const def = TD.hero.defOf(S.hero);
      return `<span class="dsel-nm">${def.name}<small>nível ${S.hero.level} · toque no mapa para mover</small></span><button class="dbtn dact dclose" data-act="close" aria-label="Fechar">✕</button>`;
    }
    if (S.sel) return towerSel(S.sel);
    if (S.aim) return `<span class="dsel-nm">Chuva de flechas<small>toque duas vezes onde ela deve cair</small></span><button class="dbtn dact" data-act="close">Cancelar</button>`;
    if (S.inspect && !S.build) {
      const d = S.inspect.d;
      return `<span class="dsel-nm">${d.name}<small>vida ${Math.ceil(S.inspect.hp)} de ${S.inspect.maxHp} · armadura ${d.armor}${d.flying ? ' · voa' : ''}</small></span><button class="dbtn dact dclose" data-act="close" aria-label="Fechar">✕</button>`;
    }
    return '';
  }

  // muda só quando algo que aparece na fileira muda, para não refazer os botões a cada quadro
  function selKey() {
    const S = G.S, t = S.sel;
    if (S.heroSel && S.hero) return `h${S.hero.level}`;
    if (t) {
      const price = t.level < MAX_LVL ? G.upCost(t) : G.specCost(t);
      return `t${t.id}-${t.level}-${t.spec}-${t.target}-${S.gold >= price}-${G.refund(t)}`;
    }
    if (S.aim) return 'aim';
    // vida em décimos: a ficha do inimigo acompanha os golpes sem refazer a fileira a cada quadro
    return S.inspect && !S.build ? `e${S.inspect.type}-${Math.ceil(S.inspect.hp / S.inspect.maxHp * 10)}` : '';
  }

  selRow.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const S = G.S, act = el.dataset.act;
    if (act === 'up') G.upgrade(S.sel);
    else if (act === 'spec') G.specialize(S.sel, el.dataset.spec);
    else if (act === 'target') G.cycleTarget(S.sel);
    else if (act === 'sell') G.sell(S.sel);
    else if (act === 'close') TD.ui.cancel();
  });

  // ---------- Sincronização a cada quadro ----------
  let lastSel = null, lastStats = '';
  function syncStats() {
    const S = G.S, key = `${S.gold}|${S.lives}|${S.wave}|${S.endless}`;
    if (key === lastStats) return;
    lastStats = key;
    stat.gold.textContent = S.gold;
    stat.lives.textContent = S.lives;
    stat.lives.classList.toggle('low', S.lives <= Math.max(3, S.maxLives / 4));
    stat.wave.textContent = S.endless || S.wave > TD.MAX_WAVES ? S.wave : `${S.wave}/${TD.MAX_WAVES}`;
  }

  function syncPowers() {
    const S = G.S;
    for (const b of actRow.children) {
      if (b.dataset.power) {
        const p = POWERS.find(q => q.id === b.dataset.power), cd = S.cooldowns[p.id];
        b.disabled = !G.canUsePower(p.id);
        b.classList.toggle('aiming', S.aim === p.id);
        b.style.setProperty('--p', S.mods.nopower ? '0' : String(1 - cd / G.powerCd(p)));
        b.querySelector('.dcd').textContent = S.mods.nopower ? 'Bloqueado' : cd > 0 ? `${Math.ceil(cd)} s` : S.waveActive ? 'Pronto' : 'Na onda';
      } else if (b.classList.contains('dability')) {
        const h = S.hero, ab = h ? TD.hero.defOf(h).ability : null;
        b.querySelector('.dnm').textContent = ab ? ab.name : 'Sem herói';
        b.disabled = !TD.hero.canUseAbility();
        b.style.setProperty('--p', ab ? String(1 - h.abilityCd / ab.cd) : '0');
        b.querySelector('.dcd').textContent = !h ? '—' : h.deadT > 0 ? 'Caído' : h.abilityCd > 0 ? `${Math.ceil(h.abilityCd)} s` : S.waveActive ? 'Pronto' : 'Na onda';
      } else {
        const label = TD.ui.waveLabel();
        if (b.textContent !== label) b.textContent = label;
        b.disabled = !S.inGame || S.over || S.halted || !!S.offer || (S.waveActive && !G.canCallEarly());
      }
    }
  }

  function sync() {
    const S = G.S;
    syncStats();
    const key = selKey();
    if (key !== lastSel) {
      lastSel = key;
      selRow.innerHTML = key ? selHtml() : '';
      selRow.hidden = !key;
      buildRow.hidden = !!key;
    }
    for (const b of buildRow.children) {
      const cost = G.costOf(b.dataset.type);
      b.classList.toggle('active', S.build === b.dataset.type);
      b.classList.toggle('poor', S.gold < cost);
      const c = b.querySelector('.dcost');
      if (c.textContent !== String(cost)) {
        c.textContent = cost;
        b.setAttribute('aria-label', `${TOWERS[b.dataset.type].name}, ${cost} de ouro`);
      }
    }
    syncPowers();
  }

  // a página reserva embaixo (ou ao lado) o espaço que a barra ocupa
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      const r = dock.getBoundingClientRect();
      document.documentElement.style.setProperty('--dock-h', `${Math.ceil(r.height)}px`);
      document.documentElement.style.setProperty('--dock-w', `${Math.ceil(r.width)}px`);
    }).observe(dock);
  }

  buildTowers();
  buildActions();
  TD.dock = { sync };
})();
