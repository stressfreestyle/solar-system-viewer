/* アイコン生成（依存ライブラリなし・PNGエンコーダも自前）
   使い方: node src/mkicon.js
   出力:
     src/icon.png                        180px  単一ファイル版に data URI で埋め込む用
     dist/icons/apple-touch-icon.png     180px  iOS のホーム画面用
     dist/icons/icon-192.png             192px  purpose="any"
     dist/icons/icon-512.png             512px  purpose="any"
     dist/icons/icon-maskable-512.png    512px  purpose="maskable"
                                                中央80%の円（セーフゾーン）に収める別デザイン
*/
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ---- 最小の PNG エンコーダ ---- */
function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---- 図柄 ----
   すべての半径は「画像の半幅」に対する割合。k を掛けると内側へ縮む。
   maskable では k=0.78 にして、中央80%の円のセーフゾーンに収める。 */
const ORBITS = [0.20, 0.285, 0.375, 0.47, 0.63, 0.79, 0.93];
const PLANETS = [
  [0.20,  2.1, 0.020, [170, 158, 148]],
  [0.285, 4.4, 0.024, [232, 205, 158]],
  [0.375, 0.7, 0.025, [90, 150, 215]],
  [0.47,  3.3, 0.022, [205, 105, 70]],
  [0.63,  5.4, 0.040, [220, 190, 150]],
  [0.79,  1.5, 0.036, [225, 205, 150]],
  [0.93,  2.6, 0.030, [150, 210, 220]]
];

function makeIcon(S, k, opt) {
  opt = opt || {};
  const SS = S <= 192 ? 3 : 2;               // 大きい画像は倍率を落として時間を抑える
  const N = S * SS, cx = N / 2, cy = N / 2, H = N / 2;
  const acc = new Float64Array(N * N * 3);

  function set(i, r, g, b, a) {
    acc[i * 3]     = acc[i * 3]     * (1 - a) + r * a;
    acc[i * 3 + 1] = acc[i * 3 + 1] * (1 - a) + g * a;
    acc[i * 3 + 2] = acc[i * 3 + 2] * (1 - a) + b * a;
  }

  /* 背景。maskable は角まで塗りつぶす（透明を残さない） */
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const d = Math.hypot((x - cx) / H, (y - cy) / H);
      const bg = Math.max(0, 1 - d * 0.55);
      acc[i * 3] = 6 + 10 * bg; acc[i * 3 + 1] = 8 + 12 * bg; acc[i * 3 + 2] = 18 + 22 * bg;
    }
  }
  /* 星 */
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const nStars = Math.round(90 * (S / 180));
  for (let s = 0; s < nStars; s++) {
    const sx = rnd() * N, sy = rnd() * N, br = 90 + rnd() * 140;
    const rad = (0.7 + rnd() * 1.1) * SS * (S / 180) * 0.9;
    for (let y = Math.max(0, (sy - rad) | 0); y < Math.min(N, sy + rad + 1); y++)
      for (let x = Math.max(0, (sx - rad) | 0); x < Math.min(N, sx + rad + 1); x++) {
        const a = Math.max(0, 1 - Math.hypot(x - sx, y - sy) / rad);
        if (a > 0) set(y * N + x, br, br, br * 1.05, a * a * 0.85);
      }
  }
  /* 軌道 */
  /* 180px・3倍サンプリングのときに 2.2 になるよう、寸法に比例させる */
  const lw = 2.2 * (SS / 3) * (S / 180);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot((x - cx) / H, (y - cy) / H);
    for (const o of ORBITS) {
      const a = Math.max(0, 1 - Math.abs(d - o * k) / (lw / H));
      if (a > 0) set(y * N + x, 120, 150, 195, a * 0.38);
    }
  }
  /* 太陽 */
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot((x - cx) / H, (y - cy) / H);
    const core = Math.max(0, 1 - d / (0.105 * k));
    const glow = Math.exp(-d / (0.10 * k)) * 0.75;
    if (glow > 0.002) set(y * N + x, 255, 190, 90, Math.min(1, glow));
    if (core > 0) set(y * N + x, 255, 246, 214, Math.min(1, core * 3.2));
  }
  /* 惑星 */
  for (const [orb, ang, sz, col] of PLANETS) {
    const px = cx + Math.cos(ang) * orb * k * H, py = cy + Math.sin(ang) * orb * k * H;
    const rad = sz * k * H;
    for (let y = Math.max(0, (py - rad * 2.4) | 0); y < Math.min(N, py + rad * 2.4); y++)
      for (let x = Math.max(0, (px - rad * 2.4) | 0); x < Math.min(N, px + rad * 2.4); x++) {
        const dd = Math.hypot(x - px, y - py) / rad;
        if (dd < 2.4) set(y * N + x, col[0], col[1], col[2], Math.exp(-dd * dd * 2.0) * 0.42);
        if (dd < 1.0) {
          const sh = 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - dd * dd));
          set(y * N + x, col[0] * sh, col[1] * sh, col[2] * sh, Math.min(1, (1 - dd) * 5));
        }
      }
  }

  /* ダウンサンプル */
  const out = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < SS; j++) for (let i2 = 0; i2 < SS; i2++) {
      const kk = ((y * SS + j) * N + x * SS + i2) * 3;
      r += acc[kk]; g += acc[kk + 1]; b += acc[kk + 2];
    }
    const n = SS * SS, o = (y * S + x) * 4;
    out[o] = Math.min(255, r / n) | 0; out[o + 1] = Math.min(255, g / n) | 0;
    out[o + 2] = Math.min(255, b / n) | 0; out[o + 3] = 255;
  }
  return png(S, S, out);
}

/* セーフゾーン検査。maskable は中央80%の円（＝半径0.80）だけが必ず見える。
   図柄の最外周（一番外側の軌道 + 惑星の半径）がその内側に収まるかを確かめる。 */
function safeZoneEdge(k) {
  const last = PLANETS[PLANETS.length - 1];
  const outer = Math.max(ORBITS[ORBITS.length - 1], last[0] + last[2] * 2.4);
  return outer * k;
}

const ROOT = path.join(__dirname, '..');
const DIST_ICONS = path.join(ROOT, 'dist', 'icons');
fs.mkdirSync(DIST_ICONS, { recursive: true });

const jobs = [
  [path.join(__dirname, 'icon.png'),                       180, 1.00, '単一ファイル版の埋め込み用'],
  [path.join(DIST_ICONS, 'apple-touch-icon.png'),          180, 1.00, 'iOS ホーム画面'],
  [path.join(DIST_ICONS, 'icon-192.png'),                  192, 1.00, 'purpose=any'],
  [path.join(DIST_ICONS, 'icon-512.png'),                  512, 1.00, 'purpose=any'],
  [path.join(DIST_ICONS, 'icon-maskable-512.png'),         512, 0.78, 'purpose=maskable（セーフゾーン内）']
];

for (const [file, size, k, note] of jobs) {
  const buf = makeIcon(size, k);
  fs.writeFileSync(file, buf);
  console.log(String(size).padStart(3) + 'px  k=' + k.toFixed(2) + '  ' +
    String(buf.length).padStart(6) + ' bytes  ' + path.relative(ROOT, file) + '  — ' + note);
}
const edge = safeZoneEdge(0.78);
console.log('maskable のセーフゾーン: 図柄の最外周 = 半径 ' + edge.toFixed(3) +
  '（上限 0.80）→ ' + (edge <= 0.80 ? 'OK' : 'NG'));
if (edge > 0.80) process.exit(1);
