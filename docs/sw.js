/* 太陽系リアルタイムビューア — Service Worker
   自動生成。編集しないこと（make-pwa.js が作る）。

   ・install で全アセットをプリキャッシュする
   ・fetch は cache-first。同一オリジンのものしか扱わない
   ・ナビゲーションはオフライン時 index.html にフォールバックする
   ・キャッシュ名にビルドのハッシュが入っている。activate で
     接頭辞が同じで名前の違う古いキャッシュを消す
   ・skipWaiting は install では呼ばない。ページから
     {type:'SKIP_WAITING'} が来たときだけ実行する（更新バナー用） */
'use strict';

var VERSION = '995681051ab5';
var PREFIX = 'solar-';
var CACHE = PREFIX + VERSION;
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

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
