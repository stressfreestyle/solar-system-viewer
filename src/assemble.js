/* テンプレートに部品を差し込んで1枚のHTMLを組み立てる共通処理。
   build.js（単一ファイル版）と make-pwa.js（PWA版）の両方が使う。
   配布形態で変わるのは head のリンクと起動処理だけで、
   本体のコードは完全に同じものを使う。 */
const fs = require('fs');
const path = require('path');

const SRC = __dirname;

function read(f) { return fs.readFileSync(path.join(SRC, f), 'utf8'); }
/* node 用の export 行はブラウザでは不要なので落とす */
function stripExport(s) { return s.replace(/^if \(typeof module.*$/m, '').trimEnd(); }

/* opts.headLinks : <head> に入れるリンク群の HTML
   opts.pwaBoot   : 起動時に走らせる JS（単一ファイル版では空文字） */
function assemble(opts) {
  let h = read('index.tmpl.html');

  const parts = {
    '/*__CALENDAR_CORE__*/': stripExport(read('calendar-core.js')),
    '/*__READING_CONTENT__*/': stripExport(read('reading-content.js')),
    '/*__READING_CORE__*/': stripExport(read('reading-core.js')),
    '/*__READING_VIEW__*/': stripExport(read('reading-view.js')),
    '/*__PWA_BOOT__*/': opts.pwaBoot || '',
    '<!--__HEAD_LINKS__-->': opts.headLinks || ''
  };

  for (const key of Object.keys(parts)) {
    const n = h.split(key).length - 1;
    if (n !== 1) throw new Error('プレースホルダ ' + key + ' の数が ' + n + '（1を期待）');
    h = h.replace(key, function () { return parts[key]; });   // $& 展開を避ける
  }
  return h;
}

/* 制約チェック: 外部通信ゼロ・ライブラリ不使用。
   allowLocal を true にすると、同一オリジンの相対参照（PWA版のmanifest等）を許す。 */
function checkConstraints(h, opts) {
  opts = opts || {};
  const ext = (h.match(/https?:\/\/[^"' )]+/g) || []).filter(u => !u.includes('www.w3.org'));
  if (ext.length) throw new Error('外部参照が混入: ' + ext.join(', '));
  if (/\bfetch\s*\(|XMLHttpRequest|importScripts|WebSocket|EventSource/.test(h)) {
    throw new Error('通信APIが混入');
  }
  if (/<script[^>]+src=/i.test(h)) throw new Error('外部スクリプト参照が混入');
  if (/<link[^>]+stylesheet/i.test(h)) throw new Error('外部スタイルシート参照が混入');
  if (!opts.allowLocalLinks) {
    /* 単一ファイル版は data: 以外の href を持ってはいけない */
    const links = h.match(/<link[^>]*>/g) || [];
    const bad = links.filter(l => !/href="data:/.test(l));
    if (bad.length) throw new Error('単一ファイル版に外部ファイル参照: ' + bad.join(' '));
  }
  /* 構文チェック */
  const body = h.match(/<script>([\s\S]*?)<\/script>/);
  if (!body) throw new Error('script が見つからない');
  try { new Function(body[1]); } catch (e) { throw new Error('スクリプト構文エラー: ' + e.message); }
}

module.exports = { assemble, checkConstraints, read, stripExport, SRC };
