/* 太陽系リアルタイムビューア — PWA版のビルド
   使い方: プロジェクト直下で
       node src/mkicon.js     （アイコンを更新したいときだけ）
       node build.js
       node make-pwa.js
   出力: dist/ 以下一式

   設計の要点:
   ・すべて相対パス。ルート配信でもサブパス配信でも同じものが動く。
     manifest の start_url / scope は "./"、SW の登録も "./sw.js"。
   ・キャッシュ名にビルドのハッシュを埋め、activate で古いものを消す。
     ここを間違えると更新が二度と届かなくなるので、ハッシュは
     index.html・manifest・アイコンの中身から機械的に計算する。
   ・SW は自分のアセットしか触らない。外部通信は一切しない。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assemble, checkConstraints } = require('./src/assemble.js');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ICONS = path.join(DIST, 'icons');

const ICON_FILES = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

/* ---- アイコンの存在確認 ---- */
fs.mkdirSync(ICONS, { recursive: true });
const missing = ICON_FILES.filter(f => !fs.existsSync(path.join(ICONS, f)));
if (missing.length) {
  throw new Error('アイコンがありません: ' + missing.join(', ') + '\n先に node src/mkicon.js を実行してください。');
}

/* ---- manifest ----
   start_url と scope は必ず相対で書く。絶対パスにするとサブパス配信で壊れる。
   orientation は指定しない（横向きでも見たいので固定しない）。 */
const manifest = {
  name: '太陽系リアルタイムビューア',
  short_name: '太陽系',
  description: '8惑星の現在位置を黄道面の北から見たリアルタイム図。中心天体の切替、暦、生年月日からの読み。完全オフラインで動作します。',
  lang: 'ja',
  dir: 'ltr',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#05060c',
  theme_color: '#05060c',
  icons: [
    { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
};
const manifestText = JSON.stringify(manifest, null, 2) + '\n';

/* ---- head のリンク（すべて相対パス）----
   iOS は manifest を見ないので apple-touch-icon が別途要る。 */
const headLinks = [
  '<link rel="manifest" href="./manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">',
  '<link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png">',
  '<link rel="icon" type="image/png" sizes="512x512" href="./icons/icon-512.png">'
].join('\n');

/* ---- 起動処理（Service Worker の登録と更新バナー）----
   file:// で開かれたときは登録に失敗するが、握りつぶして通常動作を続ける。 */
const pwaBoot = String.raw`
/* Service Worker の登録。
   ・登録は相対パス。サブパス配信でもその階層が scope になる
   ・新しい版を見つけたら画面にバナーを出し、押されたら差し替える
   ・file:// では登録できないので、失敗しても通常動作を続ける */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var hadController = !!navigator.serviceWorker.controller;   // 初回インストールと更新を区別する
  var reloading = false;
  var barShown = false;

  function showUpdateBar(reg) {
    if (barShown) return;
    barShown = true;
    var bar = document.createElement('div');
    bar.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);' +
      'bottom:calc(env(safe-area-inset-bottom,0px) + 158px);z-index:99;' +
      'display:flex;align-items:center;gap:10px;white-space:nowrap;' +
      'background:rgba(24,32,58,.95);border:1px solid rgba(140,170,240,.4);' +
      'border-radius:22px;padding:9px 10px 9px 15px;color:#dce7ff;' +
      'font:600 12.5px/1.3 -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.6);backdrop-filter:blur(10px);' +
      '-webkit-backdrop-filter:blur(10px);max-width:92vw';
    var msg = document.createElement('span');
    msg.textContent = '新しい版があります';
    /* font の短縮記法に inherit は書けない（宣言ごと捨てられる）ので分けて指定する */
    var btn = document.createElement('button');
    btn.textContent = '再読み込み';
    btn.style.cssText =
      'border:0;background:#3a63c8;color:#fff;border-radius:15px;padding:10px 15px;' +
      'font-weight:700;font-size:12.5px;line-height:1;font-family:inherit;cursor:pointer;flex:none';
    var no = document.createElement('button');
    no.textContent = '後で';
    no.style.cssText =
      'border:0;background:transparent;color:#93a2bd;border-radius:15px;padding:10px 8px;' +
      'font-weight:600;font-size:12.5px;line-height:1;font-family:inherit;cursor:pointer;flex:none';
    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = '更新中…';
      var w = reg.waiting || reg.installing;
      if (w) w.postMessage({ type: 'SKIP_WAITING' });
      /* controllerchange が来ないまま固まる環境への保険 */
      setTimeout(function () { if (!reloading) { reloading = true; location.reload(); } }, 2500);
    });
    no.addEventListener('click', function () { bar.remove(); barShown = false; });
    bar.appendChild(msg); bar.appendChild(btn); bar.appendChild(no);
    document.body.appendChild(bar);
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController) return;      // 初回インストール時は再読み込みしない
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  try {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      if (reg.waiting && hadController) showUpdateBar(reg);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && hadController) showUpdateBar(reg);
        });
      });
    }, function () { /* 登録できなくても通常動作を続ける */ });
  } catch (e) { /* file:// など。握りつぶす */ }
})();
`;

/* ---- index.html を組み立てる ---- */
const html = assemble({ headLinks: headLinks, pwaBoot: pwaBoot });
checkConstraints(html, { allowLocalLinks: true });

/* 相対パスであることを機械的に確かめる（サブパス配信で壊れないため） */
const hrefs = (html.match(/(?:href|src)="([^"]+)"/g) || [])
  .map(s => s.replace(/^(?:href|src)="/, '').replace(/"$/, ''))
  .filter(u => !u.startsWith('data:'));
const absolute = hrefs.filter(u => u.startsWith('/') || /^[a-z]+:/i.test(u));
if (absolute.length) throw new Error('絶対パス参照が混入（サブパス配信で壊れる）: ' + absolute.join(', '));

/* ---- ハッシュ（キャッシュ名に埋める版番号）----
   index.html・manifest・全アイコンの中身から計算する。
   どれか1バイトでも変われば別のキャッシュ名になり、古い方は activate で消える。 */
const hash = crypto.createHash('sha256');
hash.update(html);
hash.update(manifestText);
for (const f of ICON_FILES.slice().sort()) hash.update(fs.readFileSync(path.join(ICONS, f)));
const VERSION = hash.digest('hex').slice(0, 12);

/* ---- Service Worker ---- */
const ASSETS = ['./', './index.html', './manifest.webmanifest']
  .concat(ICON_FILES.map(f => './icons/' + f));

const sw = `/* 太陽系リアルタイムビューア — Service Worker
   自動生成。編集しないこと（make-pwa.js が作る）。

   ・install で全アセットをプリキャッシュする
   ・fetch は cache-first。同一オリジンのものしか扱わない
   ・ナビゲーションはオフライン時 index.html にフォールバックする
   ・キャッシュ名にビルドのハッシュが入っている。activate で
     接頭辞が同じで名前の違う古いキャッシュを消す
   ・skipWaiting は install では呼ばない。ページから
     {type:'SKIP_WAITING'} が来たときだけ実行する（更新バナー用） */
'use strict';

var VERSION = '${VERSION}';
var PREFIX = 'solar-';
var CACHE = PREFIX + VERSION;
var ASSETS = ${JSON.stringify(ASSETS, null, 2).replace(/\n/g, '\n')};

function abs(p) { return new URL(p, self.location).href; }

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ASSETS.map(abs));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf(PREFIX) === 0 && k !== CACHE) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;    // 自分のアセットだけ扱う

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function (err) {
        if (req.mode === 'navigate') {
          return caches.match(abs('./index.html')).then(function (f) {
            if (f) return f;
            throw err;
          });
        }
        throw err;
      });
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
`;

/* ---- 書き出し ---- */
fs.writeFileSync(path.join(DIST, 'index.html'), html);
fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'), manifestText);
fs.writeFileSync(path.join(DIST, 'sw.js'), sw);

const list = [
  ['index.html', Buffer.byteLength(html)],
  ['manifest.webmanifest', Buffer.byteLength(manifestText)],
  ['sw.js', Buffer.byteLength(sw)]
].concat(ICON_FILES.map(f => ['icons/' + f, fs.statSync(path.join(ICONS, f)).size]));

console.log('built dist/  version = ' + VERSION);
var total = 0;
for (const [f, n] of list) {
  total += n;
  console.log('  ' + f.padEnd(30) + String(n).padStart(8) + ' bytes');
}
console.log('  ' + '合計'.padEnd(28) + String(total).padStart(8) + ' bytes = ' + (total / 1024).toFixed(1) + ' KB');

/* ---- docs/ へ同期 ----
   docs/ が GitHub Pages の公開ディレクトリ（git 管理下。dist/ は .gitignore 済み）。
   ここを手作業のコピーに頼ると、修正が公開版に届かないまま放置されるので、
   ビルドの一部として必ず同期する。.nojekyll は消さずに残す。 */
const DOCS = path.join(ROOT, 'docs');
if (fs.existsSync(DOCS)) {
  fs.mkdirSync(path.join(DOCS, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(DOCS, 'index.html'), html);
  fs.writeFileSync(path.join(DOCS, 'manifest.webmanifest'), manifestText);
  fs.writeFileSync(path.join(DOCS, 'sw.js'), sw);
  for (const f of ICON_FILES) {
    fs.copyFileSync(path.join(ICONS, f), path.join(DOCS, 'icons', f));
  }
  if (!fs.existsSync(path.join(DOCS, '.nojekyll'))) {
    fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');
  }
  console.log('synced docs/  （GitHub Pages の公開ディレクトリ。コミットは行っていない）');
} else {
  console.log('docs/ が無いので同期をとばした');
}
