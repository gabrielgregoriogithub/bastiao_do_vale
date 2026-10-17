// Editor de campos: o jogador desenha a estrada clicando nas casas onde ela vira.
// Cada clique precisa estar na mesma linha ou coluna do anterior. A estrada começa na coluna da
// esquerda (a caverna) e termina ao chegar na coluna da direita (a muralha).
// O campo salvo fica no navegador e aparece no menu como mais uma opção.
(() => {
  const TD = window.TD;
  const { T, COLS, ROWS, W, H } = TD;
  const KEY = 'bastiao-campo';
  const MIN_FREE = 80; // casas livres para torres

  const $ = id => document.getElementById(id);
  const modal = $('editorModal'), canvas = $('editorCanvas'), ctx = canvas.getContext('2d');
  const statusEl = $('editorStatus'), nameEl = $('editorName');
  const btnUndo = $('editorUndo'), btnClear = $('editorClear'), btnSave = $('editorSave');
  const codeEl = $('editorCode'), btnCopy = $('editorCopy'), btnLoad = $('editorLoad');

  let points = [], hover = null, open = false, onSaved = () => {};

  // ---------- Armazenamento ----------
  function readSaved() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!v || !Array.isArray(v.points)) return null;
      const pts = v.points.filter(p => Array.isArray(p) && p.length === 2).map(([c, r]) => [Math.floor(c), Math.floor(r)]);
      const check = TD.validateRoute(pts);
      return check.ok && check.complete ? { name: String(v.name || '').slice(0, 30), points: pts } : null;
    } catch { return null; }
  }
  function writeSaved(name, pts) { try { localStorage.setItem(KEY, JSON.stringify({ name, points: pts })); } catch { /* armazenamento indisponível */ } }

  // Coloca (ou troca) o campo do jogador na lista de campos, mantendo o mesmo array que o resto do jogo usa
  function register(name, pts) {
    const map = TD.customMap(name, pts);
    const i = TD.MAPS.findIndex(m => m.custom);
    if (i >= 0) TD.MAPS.splice(i, 1, map); else TD.MAPS.push(map);
    return map;
  }

  const saved = readSaved();
  if (saved) register(saved.name, saved.points);

  // ---------- Regras ----------
  function freeCells(pts) {
    const md = TD.buildMap(TD.customMap('', pts));
    return md.blocked.flat().filter(v => v === 0).length;
  }

  // Motivo pelo qual a estrada ainda não pode ser salva, ou null se pode
  function saveProblem(pts) {
    const check = TD.validateRoute(pts);
    if (!check.ok) return check.error;
    if (!check.complete) return 'Leve a estrada até a coluna da direita, onde fica a muralha.';
    if (check.len < TD.MIN_ROUTE) return `Estrada curta demais: ${check.len} casas. O mínimo é ${TD.MIN_ROUTE}.`;
    if (freeCells(pts) < MIN_FREE) return 'Sobrou pouco espaço para torres. Use menos voltas.';
    return null;
  }

  function tryAdd(c, r) {
    const check = TD.validateRoute(points);
    if (check.complete) { setStatus('A estrada já chegou à muralha. Desfaça o último ponto para mudar o final.', true); return; }
    const next = [...points, [c, r]];
    const res = TD.validateRoute(next);
    if (!res.ok) { setStatus(res.error, true); return; }
    points = next;
    describe();
  }

  // ---------- Desenho ----------
  function draw() {
    const check = TD.validateRoute(points);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.fillStyle = '#46602f'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * T + 0.5, 0); ctx.lineTo(c * T + 0.5, H); ctx.stroke(); }
    for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * T + 0.5); ctx.lineTo(W, r * T + 0.5); ctx.stroke(); }
    // colunas de entrada e saída
    ctx.fillStyle = 'rgba(20,18,12,.28)';
    ctx.fillRect(0, 0, T, H); ctx.fillRect(W - T, 0, T, H);
    ctx.font = '600 12px "Barlow Semi Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(237,229,207,.8)';
    ctx.save(); ctx.translate(T / 2, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('ENTRADA', 0, 4); ctx.restore();
    ctx.save(); ctx.translate(W - T / 2, H / 2); ctx.rotate(Math.PI / 2); ctx.fillText('MURALHA', 0, 4); ctx.restore();

    for (const k of check.cells) {
      const [c, r] = k.split(',').map(Number);
      ctx.fillStyle = '#b49668'; ctx.fillRect(c * T + 2, r * T + 2, T - 4, T - 4);
    }
    points.forEach(([c, r], i) => {
      ctx.fillStyle = i === 0 ? '#e8bd5c' : '#7a5530';
      TD.circle(ctx, (c + 0.5) * T, (r + 0.5) * T, i === 0 ? 8 : 5); ctx.fill();
    });

    if (hover && !check.complete) {
      const [hc, hr] = hover;
      const res = TD.validateRoute([...points, [hc, hr]]);
      ctx.strokeStyle = res.ok ? 'rgba(134,180,111,.95)' : 'rgba(224,113,90,.95)';
      ctx.lineWidth = 3;
      if (points.length) {
        const [lc, lr] = points[points.length - 1];
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo((lc + 0.5) * T, (lr + 0.5) * T); ctx.lineTo((hc + 0.5) * T, (hr + 0.5) * T); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeRect(hc * T + 2, hr * T + 2, T - 4, T - 4);
    }
  }

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('err', isError);
  }

  function describe() {
    const check = TD.validateRoute(points);
    const problem = saveProblem(points);
    btnSave.disabled = !!problem;
    btnCopy.disabled = !!problem;
    if (document.activeElement !== codeEl) codeEl.value = problem ? '' : TD.encodeRoute(nameEl.value.trim(), points);
    btnUndo.disabled = !points.length;
    btnClear.disabled = !points.length;
    if (!points.length) setStatus('Clique numa casa da coluna da esquerda para abrir a caverna.');
    else if (!problem) setStatus(`Estrada pronta: ${check.len} casas. Dê um nome e salve.`);
    else setStatus(check.complete ? problem : `${check.len} casas até aqui. Clique numa casa na mesma linha ou coluna do último ponto.`, check.complete);
    draw();
  }

  // ---------- Entrada ----------
  function cellFrom(ev) {
    const r = canvas.getBoundingClientRect();
    return [Math.floor((ev.clientX - r.left) / r.width * COLS), Math.floor((ev.clientY - r.top) / r.height * ROWS)];
  }
  canvas.addEventListener('pointermove', ev => { hover = cellFrom(ev); draw(); });
  canvas.addEventListener('pointerleave', () => { hover = null; draw(); });
  canvas.addEventListener('pointerdown', ev => { hover = cellFrom(ev); tryAdd(...hover); });

  // Teclado: setas movem o cursor, Enter ou Espaço marcam a casa, Backspace desfaz
  function onKey(ev) {
    if (!open) return;
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (ev.target === nameEl) return;
    if (moves[ev.key]) {
      ev.preventDefault();
      const [c, r] = hover || (points.length ? points[points.length - 1] : [0, 5]);
      hover = [Math.max(0, Math.min(COLS - 1, c + moves[ev.key][0])), Math.max(0, Math.min(ROWS - 1, r + moves[ev.key][1]))];
      draw();
    } else if ((ev.key === 'Enter' || ev.key === ' ') && hover) {
      ev.preventDefault();
      tryAdd(...hover);
    } else if (ev.key === 'Backspace') {
      ev.preventDefault();
      undo();
    }
  }
  window.addEventListener('keydown', onKey);

  function undo() { points = points.slice(0, -1); describe(); }
  btnUndo.addEventListener('click', undo);
  btnClear.addEventListener('click', () => { points = []; describe(); });
  btnSave.addEventListener('click', () => {
    if (saveProblem(points)) return;
    const name = nameEl.value.trim().slice(0, 30) || 'Meu campo';
    writeSaved(name, points);
    const map = register(name, points);
    close();
    onSaved(map.id);
  });
  $('editorClose').addEventListener('click', () => close());

  // ---------- Compartilhar ----------
  btnCopy.addEventListener('click', () => {
    const code = TD.encodeRoute(nameEl.value.trim(), points);
    codeEl.value = code;
    const fallback = () => { codeEl.focus(); codeEl.select(); setStatus('Código selecionado: copie com Ctrl+C.'); };
    if (!navigator.clipboard) { fallback(); return; }
    navigator.clipboard.writeText(code).then(() => setStatus('Código copiado. Mande para quem quiser jogar no seu campo.'), fallback);
  });
  btnLoad.addEventListener('click', () => {
    const data = TD.decodeRoute(codeEl.value);
    if (!data) { setStatus('Esse código não é de um campo do Bastião do Vale.', true); return; }
    const problem = saveProblem(data.points);
    if (problem) { setStatus(`O código chegou, mas a estrada não vale: ${problem}`, true); return; }
    points = data.points;
    nameEl.value = data.name;
    describe();
    setStatus('Campo carregado. Salve para jogar nele.');
  });
  nameEl.addEventListener('input', () => { if (!saveProblem(points)) codeEl.value = TD.encodeRoute(nameEl.value.trim(), points); });

  function show(callback) {
    onSaved = callback || (() => {});
    const current = readSaved();
    points = current ? current.points : [];
    nameEl.value = current ? current.name : '';
    hover = null;
    open = true;
    modal.hidden = false;
    describe();
    canvas.focus({ preventScroll: true });
  }

  function close() {
    open = false;
    modal.hidden = true;
  }

  TD.editor = { show, close, isOpen: () => open, saveProblem };
})();
