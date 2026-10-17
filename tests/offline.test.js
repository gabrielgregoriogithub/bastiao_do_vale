const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// a lista que o modo offline guarda na instalação
const precached = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('o modo offline guarda todos os scripts, ícones e o manifesto que a página usa', () => {
  const used = [
    ...[...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="([^"]+)"/g)].map(m => m[1]),
  ];
  assert.ok(used.length > 15);
  for (const f of used) assert.ok(precached.includes(f), `sw.js não guarda ${f}`);
});

test('todo arquivo da lista do modo offline existe', () => {
  for (const f of precached) {
    if (f === './') continue;
    assert.ok(fs.existsSync(path.join(ROOT, f)), `sw.js lista ${f}, que não existe`);
  }
});
