/* solar-system.html から Artifact 公開用の solar-system.artifact.html を作る。
   Artifact は <!DOCTYPE>/<html>/<head>/<body> を publish 時に自前で付けるため、
   こちらの外側のラッパーを外し、中身だけを出す必要がある。
   使い方: node make-artifact.js   （先に node build.js を済ませておくこと） */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'solar-system.html');
const OUT = path.join(__dirname, 'solar-system.artifact.html');

const html = fs.readFileSync(SRC, 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));

/* <body> 内に置いてもブラウザが解釈してくれるものだけ拾う。
   charset は Artifact 側が付けるので持ち込まない */
const KEEP = [
  /<title>[\s\S]*?<\/title>/,
  /<meta name="viewport"[^>]*>/,
  /<meta name="theme-color"[^>]*>/,
  /<meta name="color-scheme"[^>]*>/,
  /<meta name="apple-mobile-web-app-capable"[^>]*>/,
  /<meta name="mobile-web-app-capable"[^>]*>/,
  /<meta name="apple-mobile-web-app-status-bar-style"[^>]*>/,
  /<meta name="apple-mobile-web-app-title"[^>]*>/,
  /<link rel="apple-touch-icon"[^>]*>/,
  /<link rel="icon"[^>]*>/
];

const kept = KEEP.map(re => (head.match(re) || [''])[0]).filter(Boolean);
const styles = head.match(/<style>[\s\S]*?<\/style>/g) || [];

/* Artifact 側の CSS リセットは body に余白を残さないが、
   このアプリは全画面前提なので高さと overflow を明示的に押さえておく */
const reset = '<style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#05060c;}</style>';

const out = [reset, kept.join('\n'), styles.join('\n'), body.trim(), ''].join('\n');

const leftovers = out.match(/<(?:!DOCTYPE|\/?html|\/?head|\/?body)[^>]*>/gi);
if (leftovers) throw new Error('ラッパーが残っている: ' + leftovers.join(', '));
if (!/<script>/.test(out)) throw new Error('script が落ちている');

fs.writeFileSync(OUT, out);
console.log('made solar-system.artifact.html :', out.length, 'bytes');
