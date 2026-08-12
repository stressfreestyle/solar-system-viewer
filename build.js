/* 太陽系リアルタイムビューア — 単一ファイル版のビルド
   使い方: プロジェクト直下で  node build.js
   出力  : solar-system.html（全部入り1枚。AirDrop やメール添付で配れる）
   solar-system.html は生成物なので直接編集しないこと。 */
const fs = require('fs');
const path = require('path');
const { assemble, checkConstraints } = require('./src/assemble.js');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'solar-system.html');

const icon = fs.readFileSync(path.join(ROOT, 'src', 'icon.png')).toString('base64');

/* 単一ファイル版はアイコンも data URI で埋め込む。
   manifest と Service Worker は使わない（file:// でも動くことを優先する）。 */
const headLinks =
  '<link rel="apple-touch-icon" href="data:image/png;base64,' + icon + '">\n' +
  '<link rel="icon" href="data:image/png;base64,' + icon + '">';

const h = assemble({ headLinks: headLinks, pwaBoot: '' });
checkConstraints(h);

fs.writeFileSync(OUT, h);
console.log('built solar-system.html :', Buffer.byteLength(h), 'bytes =',
  (Buffer.byteLength(h) / 1024).toFixed(1), 'KB');
