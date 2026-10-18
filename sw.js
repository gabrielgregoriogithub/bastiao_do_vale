// Jogo sem internet: na instalação guarda todos os arquivos do jogo; depois, rede primeiro.
// Com internet o jogador sempre recebe a versão mais nova (e a cópia guardada é atualizada);
// sem internet, usa a cópia. Ao criar um arquivo novo no jogo, inclua-o em FILES
// (tests/offline.test.js confere se a lista bate com o que o index.html usa).
const CACHE = 'bastiao-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'src/data.js',
  'src/bestiary.js',
  'src/audio.js',
  'src/render.js',
  'src/creatures.js',
  'src/towers-art.js',
  'src/meta.js',
  'src/sim.js',
  'src/foes.js',
  'src/hero.js',
  'src/units.js',
  'src/tutorial.js',
  'src/codex.js',
  'src/editor.js',
  'src/achievements.js',
  'src/blessings.js',
  'src/dock.js',
  'src/device.js',
  'src/ambience.js',
  'src/lighting.js',
  'src/scene.js',
  'src/chart.js',
  'src/menu.js',
  'src/ui.js',
];
// as fontes do Google também ficam guardadas depois que a página as usa uma vez
const FONT_HOSTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || (url.origin !== self.location.origin && !FONT_HOSTS.includes(url.origin))) return;
  ev.respondWith(fetch(req)
    .then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        ev.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)));
      }
      return res;
    })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || Response.error())));
});
