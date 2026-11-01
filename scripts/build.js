'use strict';
// Sukurta vietoje (be CDN): sutraukia JS/CSS, hash pavadinimai, ilgas cache.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(assets, { recursive: true });

const entries = {
  app: 'public/app.js',
  arcade: 'public/arcade.js',
  crash: 'public/games/crash.js',
  mines: 'public/games/mines.js',
  plinko: 'public/games/plinko.js',
  coinflip: 'public/games/coinflip.js',
  battles: 'public/games/battles.js',
  style: 'public/style.css',
};

async function emit(name, file) {
  const abs = path.join(root, file);
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [abs],
    bundle: true,
    write: false,
    minify: true,
    format: file.endsWith('.css') ? undefined : 'iife',
    loader: file.endsWith('.css') ? { '.css': 'css' } : undefined,
    outfile: file.endsWith('.css') ? 'x.css' : 'x.js',
  });
  const out = result.outputFiles[0].text;
  const hash = crypto.createHash('sha256').update(out).digest('hex').slice(0, 10);
  const ext = file.endsWith('.css') ? 'css' : 'js';
  const filename = name + '.' + hash + '.' + ext;
  fs.writeFileSync(path.join(assets, filename), out);
  return '/assets/' + filename;
}

(async () => {
  const manifest = {};
  for (const [name, file] of Object.entries(entries)) manifest[name] = await emit(name, file);
  let html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  html = html.replace('href="style.css"', 'href="' + manifest.style + '"');
  html = html.replace('src="app.js"', 'src="' + manifest.app + '"');
  html = html.replace('src="arcade.js"', 'src="' + manifest.arcade + '"');
  const asset = {
    crash: manifest.crash,
    mines: manifest.mines,
    plinko: manifest.plinko,
    coinflip: manifest.coinflip,
    kovos: manifest.battles,
  };
  html = html.replace('<script src="' + manifest.app + '"></script>', '<script>window.ASSET=' + JSON.stringify(asset) + '</script>\n  <script src="' + manifest.app + '"></script>');
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('build ok', Object.keys(manifest).join(', '));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
