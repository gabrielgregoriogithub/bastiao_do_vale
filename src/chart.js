// Gráficos do fim da partida: vidas e ouro ao fim de cada onda.
// Ouro e vidas têm escalas muito diferentes, então são dois gráficos lado a lado, um eixo cada.
// Cada um tem cursor que segue o ponteiro (ou as setas do teclado) e uma tabela com todos os valores.
(() => {
  const TD = window.TD;
  const NS = 'http://www.w3.org/2000/svg';
  const VW = 300, VH = 132, PAD = { l: 34, r: 34, t: 10, b: 22 };
  // cores validadas contra o fundo do painel (#22271f): faixa de luminosidade, croma, daltonismo e contraste
  const SERIES = [
    { key: 'lives', title: 'Vidas', color: '#3f88d0' },
    { key: 'gold', title: 'Ouro ao fim da onda', color: '#b98a35' },
  ];
  const fmt = n => n.toLocaleString('pt-BR');

  // Teto "redondo" para o eixo: 1, 2, 2,5 ou 5 vezes uma potência de 10
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
    return 10 * p;
  }
  const compact = n => (n >= 1000 ? `${fmt(Math.round(n / 100) / 10)} mil` : fmt(n));

  function el(name, attrs = {}, parent = null) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function chart(history, series) {
    const wrap = document.createElement('figure');
    wrap.className = 'mini-chart';
    const cap = document.createElement('figcaption');
    cap.textContent = series.title;
    wrap.appendChild(cap);

    const values = history.map(p => p[series.key]);
    const maxV = niceMax(Math.max(...values));
    const lastWave = Math.max(1, history[history.length - 1].wave);
    const x = w => PAD.l + (w / lastWave) * (VW - PAD.l - PAD.r);
    const y = v => VH - PAD.b - (v / maxV) * (VH - PAD.t - PAD.b);

    const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}`, role: 'img', tabindex: '0', 'aria-label': `${series.title} por onda. Use as setas para percorrer os valores.` });
    // eixo: três marcas limpas e grade fina
    for (const v of [0, maxV / 2, maxV]) {
      el('line', { x1: PAD.l, x2: VW - PAD.r, y1: y(v), y2: y(v), class: 'grid' }, svg);
      el('text', { x: PAD.l - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = compact(v);
    }
    for (const w of [0, lastWave]) {
      el('text', { x: x(w), y: VH - 6, class: 'tick', 'text-anchor': w ? 'end' : 'start' }, svg).textContent = w ? `onda ${w}` : 'início';
    }
    const pts = history.map(p => `${x(p.wave).toFixed(1)},${y(p[series.key]).toFixed(1)}`);
    el('polygon', { points: `${x(history[0].wave)},${y(0)} ${pts.join(' ')} ${x(lastWave)},${y(0)}`, fill: series.color, 'fill-opacity': '0.1' }, svg);
    el('polyline', { points: pts.join(' '), fill: 'none', stroke: series.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    // ponto final destacado, com anel da cor do fundo, e o valor final ao lado
    const end = history[history.length - 1];
    el('circle', { cx: x(end.wave), cy: y(end[series.key]), r: 4, fill: series.color, stroke: 'var(--panel)', 'stroke-width': 2 }, svg);
    el('text', { x: x(end.wave) + 7, y: y(end[series.key]) + 4, class: 'end-label' }, svg).textContent = compact(end[series.key]);

    // cursor: linha vertical que encosta na onda mais próxima
    const cross = el('line', { y1: PAD.t, y2: VH - PAD.b, class: 'cross', visibility: 'hidden' }, svg);
    const dot = el('circle', { r: 4, fill: series.color, stroke: 'var(--panel)', 'stroke-width': 2, visibility: 'hidden' }, svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    const tipValue = document.createElement('strong');
    const tipLabel = document.createElement('span');
    tip.append(tipValue, tipLabel);

    let idx = history.length - 1;
    function show(i) {
      idx = Math.max(0, Math.min(history.length - 1, i));
      const p = history[idx];
      const cx = x(p.wave), cy = y(p[series.key]);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
      cross.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
      tipValue.textContent = fmt(p[series.key]);
      tipLabel.textContent = p.wave ? `onda ${p.wave}` : 'início';
      tip.hidden = false;
      tip.style.left = `${(cx / VW) * 100}%`;
    }
    function hide() {
      cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    }
    svg.addEventListener('pointermove', ev => {
      const r = svg.getBoundingClientRect();
      const w = ((ev.clientX - r.left) / r.width * VW - PAD.l) / (VW - PAD.l - PAD.r) * lastWave;
      let best = 0;
      history.forEach((p, i) => { if (Math.abs(p.wave - w) < Math.abs(history[best].wave - w)) best = i; });
      show(best);
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', () => show(idx));
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); show(idx - 1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); show(idx + 1); }
    });

    const plot = document.createElement('div');
    plot.className = 'chart-plot';
    plot.append(svg, tip);
    wrap.appendChild(plot);
    return wrap;
  }

  function table(history) {
    const det = document.createElement('details');
    det.className = 'chart-table';
    const sum = document.createElement('summary');
    sum.textContent = 'Ver os valores em tabela';
    det.appendChild(sum);
    const box = document.createElement('div');
    box.className = 'chart-table-box';
    const t = document.createElement('table');
    const head = t.createTHead().insertRow();
    for (const h of ['Onda', 'Vidas', 'Ouro']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      head.appendChild(th);
    }
    const body = t.createTBody();
    for (const p of history) {
      const row = body.insertRow();
      for (const v of [p.wave ? p.wave : 'início', fmt(p.lives), fmt(p.gold)]) row.insertCell().textContent = v;
    }
    box.appendChild(t);
    det.appendChild(box);
    return det;
  }

  // Precisa de pelo menos dois pontos (início e uma onda) para desenhar uma linha
  function render(container, history) {
    container.replaceChildren();
    const ok = Array.isArray(history) && history.length >= 2;
    container.hidden = !ok;
    if (!ok) return;
    const h3 = document.createElement('h3');
    h3.textContent = 'Como a partida andou';
    const row = document.createElement('div');
    row.className = 'chart-row';
    for (const s of SERIES) row.appendChild(chart(history, s));
    container.append(h3, row, table(history));
  }

  TD.chart = { render, niceMax };
})();
