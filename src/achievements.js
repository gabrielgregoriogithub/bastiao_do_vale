// Conquistas: metas que valem entre partidas. Cada uma é verificada por um evento do jogo
// (abate, fim de onda, vitória) ou por uma checagem leve do estado a cada quadro.
// Ficam no navegador do jogador; sem armazenamento, valem só durante a visita.
(() => {
  const TD = window.TD;
  const G = TD.game;
  const KEY = 'bastiao-conquistas';
  const KILLS_KEY = 'bastiao-abates-total';
  const TOAST_SECONDS = 4;

  const LIST = [
    { id: 'first_win', name: 'Primeira vitória', desc: 'Vença as 20 ondas de qualquer campo.' },
    { id: 'flawless', name: 'Muralha intacta', desc: 'Vença sem perder nenhuma vida.' },
    { id: 'all_maps', name: 'Guardião do reino', desc: `Vença os ${TD.officialMaps().length} campos, em qualquer dificuldade.` },
    { id: 'hard_win', name: 'Veterano de guerra', desc: 'Vença um campo no Difícil.' },
    { id: 'dragon', name: 'Caçador de dragões', desc: 'Derrote um Dragão.' },
    { id: 'colossus', name: 'Gigante tombado', desc: 'Derrote um Colosso.' },
    { id: 'specs', name: 'Mestre de obras', desc: 'Tenha 4 torres especializadas ao mesmo tempo.' },
    { id: 'hero_max', name: 'Lenda viva', desc: 'Leve um herói ao nível 5.' },
    { id: 'no_hero_win', name: 'Sozinho na muralha', desc: 'Vença com o desafio Sem herói.' },
    { id: 'all_challenges', name: 'Provação total', desc: 'Vença com os 4 desafios ativos.' },
    { id: 'kills_1000', name: 'Mil inimigos', desc: 'Derrote 1.000 inimigos somando todas as partidas.' },
    { id: 'endless_30', name: 'Além da lenda', desc: 'Chegue à onda 30 no modo sem fim.' },
    { id: 'rush', name: 'Pressa na batalha', desc: 'Chame 10 ondas antes da hora numa mesma partida.' },
    { id: 'commander', name: 'Comandante', desc: 'Use 3 poderes diferentes durante uma mesma onda.' },
    { id: 'blessed', name: 'Abençoado', desc: 'Reúna 6 bênçãos numa mesma partida.' },
    { id: 'archmage', name: 'Arquimago', desc: 'Derrote 5 inimigos com um único Meteoro do Mago.' },
    { id: 'banner_six', name: 'Sob a Bandeira', desc: 'Tenha 6 torres fortalecidas por Estandartes ao mesmo tempo.' },
    { id: 'hero_trio', name: 'Trio Lendário', desc: 'Vença uma partida com cada herói: Cavaleiro, Arqueira e Mago.' },
    { id: 'tycoon', name: 'Magnata', desc: 'Receba 500 de ouro das Minas numa mesma partida.' },
    { id: 'alchemist', name: 'Mestre Alquimista', desc: 'Tenha 15 inimigos dentro de poças do Caldeirão ao mesmo tempo.' },
    { id: 'reaper', name: 'Ceifador', desc: 'Faça uma sequência de 20 abates.' },
    { id: 'legend_tower', name: 'Torre Lendária', desc: 'Leve uma torre à patente Lendária (250 abates).' },
    { id: 'titan', name: 'Quebra-selos', desc: 'Derrote um Titã Ancestral, em qualquer versão.' },
    { id: 'sealer', name: 'Senhor dos Portais', desc: 'Sele portais 5 vezes numa mesma partida.' },
    { id: 'thief', name: 'Pega ladrão', desc: 'Derrube um Ladrão de Ouro antes que ele fuja.' },
    { id: 'relics_all', name: 'Colecionador', desc: `Encontre as ${TD.RELICS.length} relíquias nos baús de tesouro.` },
    { id: 'heart', name: 'Coração partido', desc: 'Vença o último capítulo, as Minas de Cristal.' },
  ];
  // heróis com que o jogador já venceu, entre partidas (para o Trio Lendário)
  const HEROES_KEY = 'bastiao-herois-vitoriosos';

  function readJson(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; }
  }
  function writeJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* armazenamento indisponível */ } }

  let unlocked = readJson(KEY, {});
  if (!unlocked || typeof unlocked !== 'object') unlocked = {};
  let totalKills = Number(readJson(KILLS_KEY, 0)) || 0;
  let pendingKills = 0;

  const toast = document.getElementById('achToast');
  const toastName = document.getElementById('achToastName');
  let queue = [], toastT = 0;

  const has = id => !!unlocked[id];

  function unlock(id) {
    if (has(id) || !LIST.some(a => a.id === id)) return;
    unlocked = { ...unlocked, [id]: Date.now() };
    writeJson(KEY, unlocked);
    queue = [...queue, id];
    TD.audio.play('spec');
  }

  function flushKills() {
    if (!pendingKills) return;
    totalKills += pendingKills;
    pendingKills = 0;
    writeJson(KILLS_KEY, totalKills);
    if (totalKills >= 1000) unlock('kills_1000');
  }

  // ---------- Eventos vindos da simulação ----------
  function onKill(e) {
    pendingKills += 1;
    // vale também a versão de cada ambiente (Dragão Ancião, Esfinge...)
    if (e.d.role === 'dragon') unlock('dragon');
    if (e.d.role === 'colossus') unlock('colossus');
    if (e.d.role === 'titan') unlock('titan');
  }

  // Eventos dos portais, baús e ladrões (world.js)
  function onSeal(n) { if (n >= 5) unlock('sealer'); }
  function onThief() { unlock('thief'); }
  function onRelic() { if (!TD.relics.missing().length) unlock('relics_all'); }

  function onWaveEnd() {
    flushKills();
    const S = G.S;
    if (S.endless && S.wave >= 30) unlock('endless_30');
  }

  function onVictory() {
    flushKills();
    const S = G.S;
    unlock('first_win');
    if (S.mapId === 'minas') unlock('heart');
    if (S.lives >= S.maxLives) unlock('flawless');
    if (S.diffId === 'dificil') unlock('hard_win');
    if (S.mods.nohero) unlock('no_hero_win');
    if (TD.CHALLENGES.every(c => S.mods[c.id])) unlock('all_challenges');
    const wonAll = TD.officialMaps().every(m => TD.DIFF_ORDER.some(d => G.readStars(m.id, d) > 0));
    if (wonAll) unlock('all_maps');
    if (S.hero) {
      const saved = readJson(HEROES_KEY, []);
      const won = new Set([...(Array.isArray(saved) ? saved : []), S.hero.kind]);
      writeJson(HEROES_KEY, [...won]);
      if (TD.HERO_ORDER.every(k => won.has(k))) unlock('hero_trio');
    }
  }

  // Chamado quando uma sequência de abates termina, com o tamanho dela
  function onCombo(n) {
    if (n >= 20) unlock('reaper');
  }

  // Chamado quando um Meteoro cai, com quantos inimigos ele derrotou
  function onMeteor(killed) {
    if (killed >= 5) unlock('archmage');
  }

  // ---------- Checagens por quadro ----------
  function sync(dt) {
    const S = G.S;
    if (S.inGame && !S.over) {
      if (S.towers.filter(t => t.spec).length >= 4) unlock('specs');
      if (S.hero && S.hero.level >= TD.HERO.maxLevel) unlock('hero_max');
      if ((S.earlyCalls || 0) >= 10) unlock('rush');
      if (S.wavePowers && Object.keys(S.wavePowers).length >= 3) unlock('commander');
      if (S.blessings.length >= 6) unlock('blessed');
      if (S.towers.filter(t => t.s.buff > 0).length >= 6) unlock('banner_six');
      if (S.mined >= 500) unlock('tycoon');
      if (S.towers.some(t => G.rankOf(t) >= 3)) unlock('legend_tower');
      if (S.puddles.length && S.enemies.filter(e => !e.d.flying && S.puddles.some(p => Math.hypot(e.x - p.x, e.y - p.y) <= p.r)).length >= 15) unlock('alchemist');
    }
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) toast.hidden = true;
    } else if (queue.length) {
      const a = LIST.find(x => x.id === queue[0]);
      queue = queue.slice(1);
      toastName.textContent = a.name;
      toast.hidden = false;
      toastT = TOAST_SECONDS;
    }
  }

  const list = () => LIST.map(a => ({ ...a, done: has(a.id) }));

  // ---------- Suas melhores partidas ----------
  const RUNS_KEY = 'bastiao-melhores';
  const RUNS_MAX = 10;
  const better = (a, b) => b.wave - a.wave || b.kills - a.kills;

  function runs() {
    const v = readJson(RUNS_KEY, []);
    return Array.isArray(v) ? v.filter(r => r && Number.isFinite(r.wave)).sort(better).slice(0, RUNS_MAX) : [];
  }

  // Guarda a partida que acabou, se ela entrar entre as 10 melhores (mais ondas; no empate, mais abates).
  // Quem vence e segue no modo sem fim registra de novo ao cair: o novo registro substitui o da vitória.
  function recordRun(victory) {
    const S = G.S;
    if (!S.inGame) return;
    const run = {
      at: Date.now(), runId: S.runId, map: G.md.map.name, diff: S.diff.name, hero: S.hero ? TD.hero.defOf(S.hero).name : 'Sem herói',
      wave: victory ? S.wave : Math.max(0, S.wave - 1), kills: S.kills, victory: !!victory || !!S.endless, daily: !!S.daily,
      mods: Object.keys(S.mods || {}).length,
    };
    const others = runs().filter(r => r.runId !== S.runId);
    writeJson(RUNS_KEY, [...others, run].sort(better).slice(0, RUNS_MAX));
  }

  TD.achievements = { onSeal, onThief, onRelic, onKill, onWaveEnd, onVictory, onMeteor, onCombo, flushKills, sync, list, has, totalKills: () => totalKills + pendingKills, runs, recordRun };
})();
