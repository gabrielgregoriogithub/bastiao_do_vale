// Efeitos sonoros sintetizados com Web Audio; nenhum arquivo de som é carregado.
(() => {
  const TD = (window.TD = window.TD || {});
  const MIN_GAP_MS = 55;
  let ac = null, master = null, muted = false;
  const lastPlayed = {};

  function unlock() {
    if (!ac) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ac = new Ctx();
      master = ac.createGain();
      master.gain.value = 0.32;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  function tone({ freq = 440, to = null, dur = 0.1, type = 'square', vol = 0.2, delay = 0 }) {
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.3, vol = 0.3, cutoff = 800 }) {
    const t0 = ac.currentTime;
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
  }

  const SFX = {
    archer: () => tone({ freq: 900, to: 480, dur: 0.06, type: 'triangle', vol: 0.09 }),
    cannon: () => tone({ freq: 160, to: 60, dur: 0.12, type: 'sine', vol: 0.25 }),
    boom: () => noise({ dur: 0.28, vol: 0.32, cutoff: 650 }),
    frost: () => tone({ freq: 1300, to: 1900, dur: 0.12, type: 'sine', vol: 0.06 }),
    ballista: () => tone({ freq: 240, to: 90, dur: 0.16, type: 'sawtooth', vol: 0.1 }),
    hit: () => { tone({ freq: 320, to: 140, dur: 0.07, type: 'square', vol: 0.06 }); noise({ dur: 0.05, vol: 0.08, cutoff: 3000 }); },
    arcane: () => { tone({ freq: 520, to: 1400, dur: 0.12, type: 'sawtooth', vol: 0.05 }); noise({ dur: 0.12, vol: 0.06, cutoff: 6000 }); },
    kill: () => tone({ freq: 520, to: 240, dur: 0.08, type: 'square', vol: 0.05 }),
    cauldron: () => tone({ freq: 300, to: 520, dur: 0.1, type: 'triangle', vol: 0.07 }),
    splash: () => { noise({ dur: 0.18, vol: 0.12, cutoff: 1800 }); tone({ freq: 220, to: 110, dur: 0.12, type: 'sine', vol: 0.08 }); },
    coins: () => [1320, 1568, 1976].forEach((f, i) => tone({ freq: f, dur: 0.07, type: 'triangle', vol: 0.07, delay: i * 0.05 })),
    roar: () => { tone({ freq: 90, to: 45, dur: 0.9, type: 'sawtooth', vol: 0.2 }); noise({ dur: 0.7, vol: 0.14, cutoff: 500 }); },
    rage: () => tone({ freq: 180, to: 320, dur: 0.2, type: 'sawtooth', vol: 0.09 }),
    thunder: () => { noise({ dur: 1.1, vol: 0.3, cutoff: 380 }); noise({ dur: 0.12, vol: 0.2, cutoff: 5000 }); },
    chirp: () => [2200, 2600, 2100].forEach((f, i) => tone({ freq: f, to: f * 1.25, dur: 0.06, type: 'sine', vol: 0.03, delay: i * 0.09 })),
    combo: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.1, type: 'square', vol: 0.06, delay: i * 0.05 })),
    firework: () => { noise({ dur: 0.35, vol: 0.12, cutoff: 2500 }); tone({ freq: 1200, to: 300, dur: 0.3, type: 'triangle', vol: 0.05 }); },
    heal: () => tone({ freq: 660, to: 990, dur: 0.18, type: 'sine', vol: 0.05 }),
    leak: () => tone({ freq: 140, to: 55, dur: 0.4, type: 'sawtooth', vol: 0.22 }),
    build: () => { tone({ freq: 520, dur: 0.07, type: 'triangle', vol: 0.12 }); tone({ freq: 780, dur: 0.09, type: 'triangle', vol: 0.12, delay: 0.06 }); },
    upgrade: () => [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.09, type: 'triangle', vol: 0.12, delay: i * 0.06 })),
    sell: () => tone({ freq: 700, to: 350, dur: 0.12, type: 'triangle', vol: 0.1 }),
    wave: () => { tone({ freq: 196, dur: 0.25, type: 'sawtooth', vol: 0.12 }); tone({ freq: 262, dur: 0.4, type: 'sawtooth', vol: 0.12, delay: 0.22 }); },
    waveEnd: () => [392, 523].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.12, delay: i * 0.1 })),
    spec: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.13, delay: i * 0.07 })),
    rain: () => { for (let i = 0; i < 6; i++) tone({ freq: 1200 - i * 90, to: 500, dur: 0.07, type: 'triangle', vol: 0.06, delay: i * 0.05 }); },
    freeze: () => { tone({ freq: 1800, to: 2600, dur: 0.5, type: 'sine', vol: 0.09 }); noise({ dur: 0.5, vol: 0.12, cutoff: 4000 }); },
    rally: () => [262, 330, 392, 523].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'sawtooth', vol: 0.1, delay: i * 0.09 })),
    win: () => [392, 494, 587, 784].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.14, delay: i * 0.14 })),
    blink: () => tone({ freq: 1400, to: 500, dur: 0.12, type: 'sine', vol: 0.06 }),
    portal: () => { tone({ freq: 300, to: 900, dur: 0.25, type: 'sine', vol: 0.07 }); tone({ freq: 450, to: 1350, dur: 0.25, type: 'triangle', vol: 0.04, delay: 0.04 }); },
    seal: () => { tone({ freq: 180, to: 90, dur: 0.3, type: 'square', vol: 0.08 }); [660, 880].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.08, delay: 0.1 + i * 0.08 })); },
    lose: () => [330, 262, 196, 131].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'sawtooth', vol: 0.12, delay: i * 0.18 })),
  };

  // ---------- Música ambiente ----------
  // Bordão em ré com melodia em passeio aleatório por um modo; fica mais ativa durante as ondas.
  // Cada ambiente tem seu modo, andamento e timbre (THEMES); o Vale usa o dórico de sempre.
  const D3 = 146.83, LOOKAHEAD = 0.6, TICK_MS = 200;
  // intervals: semitons do modo a partir de ré; a escala sobe por uma oitava e meia
  const scaleOf = intervals => Array.from({ length: 11 }, (_, i) =>
    D3 * 2 ** ((intervals[i % intervals.length] + 12 * Math.floor(i / intervals.length)) / 12));
  const THEMES = {
    campo:    { modes: [0, 2, 3, 5, 7, 9, 10], beat: 0.5,  lead: 'triangle', vol: 0.3,  drone: 73.42, octave: 1 },
    amazonia: { modes: [0, 2, 4, 7, 9],        beat: 0.45, lead: 'sine',     vol: 0.34, drone: 73.42, octave: 2 },
    rio:      { modes: [0, 2, 4, 6, 7, 9, 11], beat: 0.55, lead: 'sine',     vol: 0.34, drone: 73.42, octave: 1 },
    deserto:  { modes: [0, 1, 4, 5, 7, 8, 10], beat: 0.45, lead: 'triangle', vol: 0.3,  drone: 73.42, octave: 1 },
    neve:     { modes: [0, 2, 4, 7, 9],        beat: 0.7,  lead: 'sine',     vol: 0.3,  drone: 73.42, octave: 2 },
    floresta: { modes: [0, 2, 3, 5, 7, 8, 10], beat: 0.55, lead: 'triangle', vol: 0.28, drone: 73.42, octave: 1 },
    costa:    { modes: [0, 2, 4, 5, 7, 9, 10], beat: 0.4,  lead: 'square',   vol: 0.12, drone: 73.42, octave: 1 },
    cripta:   { modes: [0, 1, 3, 5, 6, 8, 10], beat: 0.75, lead: 'sine',     vol: 0.32, drone: 55,    octave: 0.5 },
    vulcao:   { modes: [0, 1, 3, 5, 7, 8, 10], beat: 0.4,  lead: 'sawtooth', vol: 0.1,  drone: 55,    octave: 0.5 },
    templo:   { modes: [0, 2, 3, 7, 9],        beat: 0.5,  lead: 'triangle', vol: 0.3,  drone: 73.42, octave: 1 },
    cristal:  { modes: [0, 2, 3, 6, 7, 9, 11], beat: 0.65, lead: 'sine',     vol: 0.32, drone: 55,    octave: 1 },
  };
  let theme = THEMES.campo, SCALE = scaleOf(theme.modes).map(f => f * theme.octave), BEAT = theme.beat;
  let musicGain = null, musicTimer = null, nextBeat = 0, beat = 0, step = 4, intensity = 0;

  // Troca a música para a do ambiente; a melodia continua de onde estava, só muda o modo e o ritmo
  function setTheme(id) {
    const next = THEMES[id] || THEMES.campo;
    if (next === theme) return;
    theme = next;
    SCALE = scaleOf(theme.modes).map(f => f * theme.octave);
    BEAT = theme.beat;
  }

  function note(freq, t, dur, type, vol) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function playBeat(t, b) {
    if (b % 8 === 0) {
      note(theme.drone, t, BEAT * 8.4, 'triangle', 0.5);
      note(theme.drone * 1.5, t, BEAT * 8.4, 'sine', 0.22);
    }
    if (Math.random() < 0.35 + Math.min(intensity, 1) * 0.35) {
      step = Math.max(0, Math.min(SCALE.length - 1, step + Math.floor(Math.random() * 5) - 2));
      note(SCALE[step], t, b % 2 ? 0.4 : 0.75, theme.lead, theme.vol);
    }
    // chefe em campo (intensidade 2): caixa nos contratempos
    if (intensity > 1 && b % 2 === 1) {
      const len = Math.floor(ac.sampleRate * 0.08), buf = ac.createBuffer(1, len, ac.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; g.gain.value = 0.18;
      src.connect(g).connect(musicGain);
      src.start(t);
    }
    if (intensity > 0 && b % 2 === 0) {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.frequency.setValueAtTime(95, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      g.gain.setValueAtTime(b % 4 === 0 ? 0.55 : 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g).connect(musicGain);
      osc.start(t); osc.stop(t + 0.22);
    }
  }

  function scheduleMusic() {
    if (!ac || ac.state !== 'running') return;
    if (nextBeat < ac.currentTime) nextBeat = ac.currentTime + 0.05;
    while (nextBeat < ac.currentTime + LOOKAHEAD) {
      playBeat(nextBeat, beat);
      nextBeat += BEAT;
      beat += 1;
    }
  }

  function startMusic() {
    if (!ac || musicTimer) return;
    if (!musicGain) {
      musicGain = ac.createGain();
      musicGain.gain.value = 0.1;
      musicGain.connect(ac.destination);
    }
    nextBeat = ac.currentTime + 0.1;
    musicTimer = setInterval(scheduleMusic, TICK_MS);
  }

  function stopMusic() {
    clearInterval(musicTimer);
    musicTimer = null;
  }

  // Vibração curta no celular (Android) nos momentos que o jogador precisa sentir; desliga junto com o som
  const BUZZ = { build: 12, upgrade: 20, spec: [20, 40, 20], leak: [45, 30, 45], lose: [80, 50, 120], win: [30, 40, 30, 40, 60] };
  const canBuzz = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  function play(name) {
    if (muted) return;
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < MIN_GAP_MS) return;
    lastPlayed[name] = now;
    if (canBuzz && BUZZ[name]) navigator.vibrate(BUZZ[name]);
    if (!ac || ac.state !== 'running' || !SFX[name]) return;
    SFX[name]();
  }

  TD.audio = {
    play,
    unlock,
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
    startMusic,
    stopMusic,
    isMusicPlaying() { return !!musicTimer; },
    setIntensity(v) { intensity = v; },
    setTheme,
  };
})();
