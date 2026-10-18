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
    lose: () => [330, 262, 196, 131].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'sawtooth', vol: 0.12, delay: i * 0.18 })),
  };

  // ---------- Música ambiente ----------
  // Bordão em ré com melodia em passeio aleatório pelo modo dórico; fica mais ativa durante as ondas.
  const SCALE = [146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0];
  const BEAT = 0.5, LOOKAHEAD = 0.6, TICK_MS = 200;
  let musicGain = null, musicTimer = null, nextBeat = 0, beat = 0, step = 4, intensity = 0;

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
      note(73.42, t, BEAT * 8.4, 'triangle', 0.5);
      note(110, t, BEAT * 8.4, 'sine', 0.22);
    }
    if (Math.random() < 0.35 + intensity * 0.35) {
      step = Math.max(0, Math.min(SCALE.length - 1, step + Math.floor(Math.random() * 5) - 2));
      note(SCALE[step], t, b % 2 ? 0.4 : 0.75, 'triangle', 0.3);
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
  };
})();
