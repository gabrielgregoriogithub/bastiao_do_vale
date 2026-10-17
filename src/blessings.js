// Bênçãos: a cada 3 ondas vencidas o jogador escolhe 1 de 3, e ela vale até o fim da partida.
// Os efeitos ficam nos pontos da simulação que cada uma muda (sim.js consulta G.blessed);
// aqui ficam a lista, o sorteio das ofertas, a escolha e a janela que as apresenta.
// A janela pausa só a tela (ui.js para o laço enquanto há oferta); a simulação não espera por ela.
(() => {
  const TD = window.TD;
  const G = TD.game;
  const sfx = TD.audio;
  const EVERY = 3, CHOICES = 3;

  // tag: a quem a bênção se aplica, mostrado no cartão
  TD.BLESSINGS = [
    { id: 'fireArrows', tag: 'Arqueiro', name: 'Flechas Ígneas', desc: 'Arqueiros incendeiam o alvo, que queima por 3 s.' },
    { id: 'powder', tag: 'Canhão', name: 'Pólvora Fina', desc: 'As explosões dos Canhões ficam 30% maiores.' },
    { id: 'deepFrost', tag: 'Geada', name: 'Inverno Profundo', desc: 'A Geada causa o dobro de dano, e sua lentidão é mais forte e dura o dobro.' },
    { id: 'sharpBolts', tag: 'Balestra', name: 'Virotes Afiados', desc: 'Balestras causam 35% mais dano.' },
    { id: 'resonance', tag: 'Arcano', name: 'Cristal Ressonante', desc: 'O raio do Arcano salta para 2 inimigos a mais.' },
    { id: 'drill', tag: 'Quartel', name: 'Disciplina de Ferro', desc: 'Cada Quartel ganha mais um soldado, e todos 25% mais vida.' },
    { id: 'eagle', tag: 'Todas as torres', name: 'Olhos de Águia', desc: 'Todas as torres alcançam 12% mais longe.' },
    { id: 'fury', tag: 'Todas as torres', name: 'Tambores de Guerra', desc: 'Todas as torres atacam 10% mais rápido.' },
    { id: 'kingsVault', tag: 'Ouro', name: 'Cofre do Rei', desc: 'Chefes derrotados rendem quatro vezes mais ouro.' },
    { id: 'interest', tag: 'Ouro', name: 'Juros do Tesouro', desc: 'Ao fim de cada onda, ganhe 5% do ouro guardado (até 30).' },
    { id: 'artisans', tag: 'Ouro', name: 'Mestres Artesãos', desc: 'Especializações custam 40% menos.' },
    { id: 'livingWall', tag: 'Muralha', name: 'Muralha Viva', desc: 'Recupere 1 vida ao fim de cada onda.' },
    { id: 'caltrops', tag: 'Estrada', name: 'Estrepes', desc: 'Inimigos que andam pela estrada ficam 12% mais lentos.' },
    { id: 'tactician', tag: 'Poderes', name: 'Estrategista', desc: 'Chuva, Congelar e Chamado recarregam 30% mais rápido.' },
  ];
  const byId = id => TD.BLESSINGS.find(b => b.id === id) || null;

  // Sorteio com semente no desafio do dia, para todos verem as mesmas ofertas
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeOffer(S) {
    const pool = TD.BLESSINGS.filter(b => !S.blessings.includes(b.id)).map(b => b.id);
    const rnd = S.seed !== null ? seeded(S.seed ^ Math.imul(S.blessings.length + 1, 0x9e3779b1)) : Math.random;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, CHOICES);
  }

  // Abre uma oferta se o jogador já venceu ondas suficientes para mais uma bênção.
  // Conta pelas ondas, não por evento: chamar a próxima onda antes da hora não faz perder a escolha.
  function check() {
    const S = G.S;
    if (!S || !S.inGame || S.offer || Math.floor(S.wave / EVERY) <= S.blessings.length) return;
    const offer = makeOffer(S);
    if (offer.length) S.offer = offer;
  }

  function choose(id) {
    const S = G.S;
    if (!S.offer || !S.offer.includes(id)) return false;
    S.blessings = [...S.blessings, id];
    S.offer = null;
    G.refreshStats();
    for (const t of S.towers) if (t.units) TD.units.refresh(t);
    sfx.play('spec');
    check(); // pode haver outra pendente (partida salva no meio de duas)
    return true;
  }

  // ---------- Janela de escolha e lista no painel ----------
  const $ = id => document.getElementById(id);
  const modal = $('blessModal'), list = $('blessList'), kicker = $('blessKicker');
  const box = $('blessBox'), owned = $('blessOwned'), ownedDesc = $('blessDesc');
  let shownOffer = null, shownOwned = '', explained = null;

  function card(b, i) {
    return `<button class="bless-card" data-bless="${b.id}">
      <span class="bless-key">${i + 1}</span>
      <span class="bless-tag">${b.tag}</span>
      <span class="bless-nm">${b.name}</span>
      <span class="bless-ds">${b.desc}</span>
    </button>`;
  }

  function open(offer) {
    shownOffer = offer;
    kicker.textContent = `Onda ${G.S.wave} vencida`;
    list.innerHTML = offer.map((id, i) => card(byId(id), i)).join('');
    modal.hidden = false;
    list.querySelector('button')?.focus({ preventScroll: true });
  }

  function close() {
    shownOffer = null;
    modal.hidden = true;
  }

  function renderOwned() {
    const S = G.S, key = S.blessings.join(',');
    if (key === shownOwned) return;
    shownOwned = key;
    box.hidden = !S.blessings.length;
    owned.innerHTML = S.blessings.map(byId).filter(Boolean)
      .map(b => `<li><button class="bless-chip" data-explain="${b.id}" aria-pressed="false" title="${b.tag}: ${b.desc}">${b.name}</button></li>`).join('');
    explain(null);
  }

  // Tocar numa etiqueta mostra o que a bênção faz (no celular não há o texto que aparece ao passar o mouse)
  function explain(id) {
    explained = id;
    const b = id && byId(id);
    ownedDesc.hidden = !b;
    ownedDesc.textContent = b ? `${b.name} (${b.tag}): ${b.desc}` : '';
    for (const el of owned.querySelectorAll('[data-explain]')) el.setAttribute('aria-pressed', String(el.dataset.explain === id));
  }
  owned.addEventListener('click', ev => {
    const id = ev.target.closest('[data-explain]')?.dataset.explain;
    if (id) explain(explained === id ? null : id);
  });

  // Etiquetas das bênçãos da partida, para o relatório do fim
  const chips = S => S.blessings.map(byId).filter(Boolean).map(b => `<li title="${b.tag}: ${b.desc}">${b.name}</li>`).join('');

  // Chamado a cada quadro pelo laço principal
  function sync() {
    const S = G.S;
    const offer = S.inGame && !S.over && !S.menuOpen ? S.offer : null;
    if (offer && offer !== shownOffer) open(offer);
    else if (!offer && shownOffer) close();
    renderOwned();
  }

  list.addEventListener('click', ev => {
    const id = ev.target.closest('[data-bless]')?.dataset.bless;
    if (id) choose(id);
  });

  TD.blessings = {
    EVERY, check, choose, sync, byId, chips,
    isOpen: () => !!shownOffer,
    // teclas 1 a 3 na janela aberta
    chooseIndex: i => (shownOffer && shownOffer[i] ? choose(shownOffer[i]) : false),
  };
})();
