/* 第8フェーズ「真理構造から見る」節の検査
   ここは吉凶・意味づけの混入が一番起きやすい箇所なので、機械で縛る。 */
const C = require('../src/calendar-core.js');
const p = n => String(n).padStart(2, '0');
const jstS = jd => { const d = new Date(C.jdToMs(jd) + 9 * 3600000);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`; };
const ms = s => C.msToJd(Date.parse(s));

let bad = 0;
const ok = (label, cond, detail) => {
  console.log('  ' + (cond ? 'OK  ' : 'NG  ') + label + (detail ? '  ' + detail : ''));
  if (!cond) bad++;
};

console.log('=== 1. 次の閏月 ===');
const l2024 = C.nextLeapMonth(ms('2024-01-01T00:00:00+09:00'));
ok('2024年以降の次の閏月が 2025年 閏6月',
   l2024.gregYear === 2025 && l2024.month === 6,
   `→ ${l2024.gregYear}年 閏${l2024.month}月 ${jstS(l2024.startJd)}〜`);
ok('閏月の長さが29日か30日', l2024.lengthDays === 29 || l2024.lengthDays === 30,
   l2024.lengthDays + '日');

/* 19年に7回。40年走査して、閏月の出現数が妥当な範囲か */
let jd = ms('2000-01-01T00:00:00+09:00'), seen = [], guard = 0;
while (guard++ < 60) {
  const L = C.nextLeapMonth(jd);
  if (!L || L.gregYear > 2040) break;
  seen.push(L.gregYear + '/閏' + L.month);
  jd = L.endJd + 40;
}
const yrs = 2040 - 2000;
const expect = yrs * 7 / 19;
ok(`2000〜2040の閏月が19年7回の割合に近い（期待 約${expect.toFixed(1)}回）`,
   Math.abs(seen.length - expect) <= 2, seen.length + '回');
ok('閏月に重複がない', new Set(seen).size === seen.length);

console.log('\n=== 2. 導出の木（六つの暦は二つの回転）===');
const T = C.truthStructure(ms('2026-08-14T12:00:00+09:00'));
ok('太陽側の目盛りが3つ', T.sunCuts.length === 3,
   T.sunCuts.map(c => c.step + '°=' + c.name).join(' / '));
ok('太陽側の目盛りが全て360を割り切る',
   T.sunCuts.every(c => Math.abs(360 / c.step - Math.round(360 / c.step)) < 1e-9));
ok('割った数が 24 / 72 / 50',
   T.sunCuts.map(c => Math.round(360 / c.step)).join(',') === '24,72,50');

console.log('\n=== 3. 出さないと決めたもの（[不能]）===');
const must = ['50音歴', '火', '二十七宿', '五行'];
must.forEach(k => ok(`[不能] に「${k}」に関する項目がある`,
  T.fudo.some(f => f.what.indexOf(k) >= 0)));
ok('[不能] が4件以上', T.fudo.length >= 4, T.fudo.length + '件');

console.log('\n=== 4. 禁止語の混入 ===');
/* truthStructure が返す全文字列を集める */
const collect = o => {
  let s = '';
  if (typeof o === 'string') return o + '\n';
  if (Array.isArray(o)) { o.forEach(x => s += collect(x)); return s; }
  if (o && typeof o === 'object') { Object.keys(o).forEach(k => s += collect(o[k])); return s; }
  return '';
};
const text = collect(T);
/* 吉凶・開運の類。「吉凶を出さない」という宣言文だけは許す */
const banned = ['開運', '運勢', '幸運', '災い', '良い日', '悪い日', 'ラッキー', '縁起', '厄年'];
banned.forEach(w => ok(`「${w}」が出ない`, text.indexOf(w) < 0));

/* 「吉凶」は [不能]（出さないと決めたもの）の中でしか出てはいけない。
   節の本文に出たら、吉凶を語り始めたということなので失敗させる。 */
const kikkyoAll  = (text.match(/吉凶/g) || []).length;
const kikkyoFudo = (collect(T.fudo).match(/吉凶/g) || []).length;
ok('「吉凶」は [不能] の宣言の中だけ', kikkyoAll === kikkyoFudo,
   `全体${kikkyoAll}件 / 宣言内${kikkyoFudo}件`);

/* 火水の割り当てをしていないこと。
   「太陽＝火」「月＝水」の形が、[不能] の宣言以外に出てはいけない */
const assign = (text.match(/太陽\s*[＝=]\s*火|月\s*[＝=]\s*水/g) || []).length;
const assignInFudo = collect(T.fudo).match(/太陽\s*[＝=]\s*火|月\s*[＝=]\s*水/g) || [];
ok('火水の割り当てが [不能] の宣言以外に出ない', assign === assignInFudo.length,
   `全体${assign}件 / 宣言内${assignInFudo.length}件`);

console.log('\n=== 5. 非対称の事実（割り当てではなく計算）===');
ok('月側は還らない（12朔望月 < 1回帰年）',
   Math.abs(29.530588 * 12 - 354.367) < 0.01 && 365.2422 - 29.530588 * 12 > 10);

console.log(bad ? `\n>>> ${bad} 件失敗` : '\n全項目OK');
process.exit(bad ? 1 : 0);
