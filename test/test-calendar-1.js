const C = require('../src/calendar-core.js');

function jstStr(jd) {
  const d = new Date(C.jdToMs(jd) + 9 * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} JST`;
}
function utcStr(jd) {
  const d = new Date(C.jdToMs(jd));
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

console.log('=== 1. 月：2026-08-12 の皆既日食で検証 ===');
console.log('（既知の事実: 2026-08-12 に皆既日食。食の最大はおよそ 17:46 UTC）');
const jdAug12 = C.msToJd(Date.UTC(2026, 7, 12, 12, 0, 0));
const nm = C.solveElongation(0, jdAug12);
const mAtNm = C.moonPosition(nm);
console.log('  計算した朔(新月)     :', utcStr(nm), '/', jstStr(nm));
console.log('  そのときの月の黄緯   :', mAtNm.lat.toFixed(4), '度  (日食なら |緯度| は小さいはず)');
console.log('  そのときの離角       :', C.elongation(nm).toFixed(6), '度');
console.log('  月の地心距離         :', Math.round(mAtNm.dist), 'km');
const ph = C.moonPhase(C.msToJd(Date.UTC(2026, 7, 12, 5, 47, 0)));
console.log('  2026-08-12 14:47JST の月齢:', ph.age.toFixed(2), '日  輝面比:', (ph.illum * 100).toFixed(1) + '%', ph.name);

console.log('\n=== 2. 月の黄経：独立した簡易式との突き合わせ ===');
// Meeus 第47章の「主要4項だけ」の粗い式（独立実装）
function moonLonCrude(jd) {
  const T = (jd - 2451545.0) / 36525.0, r = Math.PI / 180;
  const Lp = 218.316 + 481267.8813 * T;
  const M = 357.529 + 35999.0503 * T;
  const Mp = 134.963 + 477198.8676 * T;
  const D = 297.850 + 445267.1115 * T;
  const F = 93.272 + 483202.0175 * T;
  return ((Lp + 6.289 * Math.sin(Mp * r) - 1.274 * Math.sin((Mp - 2 * D) * r)
        + 0.658 * Math.sin(2 * D * r) + 0.214 * Math.sin(2 * Mp * r)
        - 0.186 * Math.sin(M * r) - 0.114 * Math.sin(2 * F * r)) % 360 + 360) % 360;
}
for (const t of [Date.UTC(2026, 7, 12), Date.UTC(2026, 0, 1), Date.UTC(2027, 5, 15)]) {
  const jd = C.msToJd(t);
  const a = C.moonPosition(jd).lon, b = moonLonCrude(jd);
  let d = a - b; if (d > 180) d -= 360; if (d < -180) d += 360;
  console.log(' ', new Date(t).toISOString().slice(0, 10),
    'full=' + a.toFixed(4), 'crude=' + b.toFixed(4), 'diff=' + d.toFixed(3) + '度 (粗い式の誤差 ~0.3度なので妥当)');
}

console.log('\n=== 3. 2026-08-28 の部分月食で検証（望・黄緯小） ===');
const fm = C.solveElongation(180, C.msToJd(Date.UTC(2026, 7, 28, 4, 0, 0)));
console.log('  計算した望(満月):', utcStr(fm), '/ 月の黄緯', C.moonPosition(fm).lat.toFixed(4), '度');

console.log('\n=== 4. 50音歴 ===');
const ws2025 = C.solveSunLongitude(270, C.msToJd(Date.UTC(2025, 11, 22)));
const ws2026 = C.solveSunLongitude(270, C.msToJd(Date.UTC(2026, 11, 22)));
console.log('  冬至 2025:', jstStr(ws2025));
console.log('  冬至 2026:', jstStr(ws2026));
const gAtWs = C.gojuon(ws2025 + 1e-6);
console.log('  冬至直後の音:', gAtWs.sound, '(' + gAtWs.no + '番目)  ← 1番目「ホ」であるべき');
const gBeforeWs = C.gojuon(ws2025 - 1e-4);
console.log('  冬至直前の音:', gBeforeWs.sound, '(' + gBeforeWs.no + '番目)  ← 50番目「マ」であるべき');
// 50区間を積み上げてちょうど次の冬至に戻るか
let acc = ws2025, lens = [];
for (let k = 0; k < 50; k++) {
  const g = C.gojuon(acc + 0.001);
  lens.push({ no: g.no, s: g.sound, len: g.lenDays, start: g.startJd });
  acc = g.endJd;
}
console.log('  50区間の合計後の日時:', jstStr(acc), ' 次の冬至との差:', ((acc - ws2026) * 86400).toFixed(1), '秒');
console.log('  区間長 最小:', Math.min(...lens.map(l => l.len)).toFixed(3), '日 / 最大:',
  Math.max(...lens.map(l => l.len)).toFixed(3), '日');
console.log('  冬至まわり(1番目ホ):', lens[0].len.toFixed(3), '日  ← 約7.0日のはず');
console.log('  夏至まわり(25番目前後):', lens[24].len.toFixed(3), lens[25].len.toFixed(3), '日  ← 約7.6日のはず');
const gNow = C.gojuon(C.msToJd(Date.UTC(2026, 7, 12, 5, 47)));
console.log('  2026-08-12 現在の音:', gNow.sound, '(' + gNow.no + '/50)',
  jstStr(gNow.startJd), '〜', jstStr(gNow.endJd), '経過', gNow.elapsedDays.toFixed(2), '日');
console.log('  50音の並び:', C.GOJUON.join(''), '(' + C.GOJUON.length + '音)');

console.log('\n=== 5. 二十四節気 2026 (JST) ===');
const want = { '立春': '02-04', '春分': '03-20', '夏至': '06-21', '秋分': '09-23', '冬至': '12-22', '立秋': '08-07', '大暑': '07-23' };
for (const name of ['立春', '春分', '立夏', '夏至', '大暑', '立秋', '秋分', '立冬', '冬至']) {
  const k = C.SEKKI.indexOf(name);
  const approx = C.msToJd(Date.UTC(2026, 2, 20)) + ((k * 15 - 0 + 360) % 360) / 0.9856473;
  const jd = C.solveSunLongitude(k * 15, approx);
  const s = jstStr(jd);
  const mark = want[name] ? (s.slice(5, 10) === want[name] ? ' OK' : ' <<< 期待 ' + want[name]) : '';
  console.log('  ' + name.padEnd(3), s, '(黄経' + (k * 15) + '度)' + mark);
}

console.log('\n=== 6. 旧暦 ===');
for (const t of [Date.UTC(2026, 7, 12, 3, 0), Date.UTC(2026, 7, 13, 3, 0), Date.UTC(2026, 1, 17, 3, 0)]) {
  const jd = C.msToJd(t), L = C.lunarDate(jd);
  console.log('  ' + new Date(t + 9 * 3600000).toISOString().slice(0, 10) + ' JST ->',
    (L.leap ? '閏' : '') + L.month + '月' + L.day + '日',
    '(旧暦' + L.year + '年, ' + (L.big ? '大' : '小') + 'の月 ' + L.monthLength + '日)',
    L.leapInCycle ? '[この周期の閏月: ' + L.leapInCycle + '月]' : '[閏月なし]');
}
console.log('  期待: 2026-08-12 -> 6月30日 / 2026-08-13 -> 7月1日 / 2026-02-17 -> 1月1日');

console.log('\n=== 7. 二十七宿 ===');
const nk = C.nakshatra(C.msToJd(Date.UTC(2026, 7, 12, 5, 47)));
console.log('  アヤナムシャ(ラヒリ):', nk.ayanamsha.toFixed(4), '度  ← 2026年で約24.22度のはず');
console.log('  月の回帰黄経:', nk.tropLon.toFixed(3), '/ 恒星黄経:', nk.sidLon.toFixed(3));
console.log('  宿:', nk.name, '(' + nk.sanskrit + ')', nk.no + '/27', '第' + nk.pada + 'パーダ');
console.log('  入宿:', jstStr(nk.enterJd), ' 出宿:', jstStr(nk.leaveJd),
  ' 滞在', (nk.leaveJd - nk.enterJd).toFixed(2), '日 (平均約1.01日)');
console.log('  宿数:', C.NAKSHATRA.length);

console.log('\n=== 8. 雑節 2026 ===');
for (const z of C.zassetsu(C.msToJd(Date.UTC(2026, 5, 1)))) {
  console.log('  ' + z.name.padEnd(14), jstStr(z.jd));
}
