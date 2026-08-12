const C = require('../src/calendar-core.js');
const p=n=>String(n).padStart(2,'0');
const jstS=jd=>{const d=new Date(C.jdToMs(jd)+9*3600000);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;};

console.log('=== 七十二候: 構造チェック ===');
console.log('  候の数:', C.KOU.length, '(72であること)');
const dup = new Set(C.KOU.map(k=>k[0]));
console.log('  漢文表記の重複なし:', dup.size===72, '('+dup.size+'種)');
const bad = C.KOU.filter(k=>k.length!==3 || !k[0] || !k[1] || !k[2]);
console.log('  3要素そろっていない候:', bad.length);
const ascii = C.KOU.filter(k=>/[A-Za-z]/.test(k.join('')));
console.log('  英字混入:', ascii.length, ascii.map(k=>k[0]).join(','));

console.log('\n=== 2026年の七十二候（立春初候から一巡）===');
let jd = C.solveSunLongitude(315, C.msToJd(Date.UTC(2026,1,4)));
let prevEnd=null, minLen=99, maxLen=0, errs=[];
for (let i=0;i<72;i++){
  const k = C.kouAt(jd+0.001);
  if (i<9 || i%12===0 || i>69) {
    console.log('  第'+String(k.no).padStart(2)+'候 '+k.sekkiName+k.pos+'  '+k.kanji+'（'+k.yomi+'）  入り '+jstS(k.startJd)+'  '+k.imi);
  }
  if (k.no !== i+1) errs.push('番号ずれ i='+i+' got '+k.no);
  if (prevEnd!==null && Math.abs(k.startJd-prevEnd)>1e-6) errs.push('不連続 i='+i);
  minLen=Math.min(minLen,k.lenDays); maxLen=Math.max(maxLen,k.lenDays);
  prevEnd = k.endJd; jd = k.endJd;
}
console.log('  ...');
console.log('  一巡後の日時:', jstS(jd), ' 次の立春との差:',
  ((jd - C.solveSunLongitude(315, C.msToJd(Date.UTC(2027,1,4))))*86400).toFixed(1), '秒');
console.log('  候の長さ 最小', minLen.toFixed(3), '日 / 最大', maxLen.toFixed(3), '日 (約4.7〜5.1日のはず)');
console.log('  エラー:', errs.length, errs.slice(0,3).join(' / '));

console.log('\n=== 節気との整合 (候の入り日が節気の入り日と一致するか) ===');
// 各節気の初候は、その節気の入りと同時刻でなければならない
let mism=0;
for (let s=0;s<24;s++){
  const lon = s*15;
  const t = C.solveSunLongitude(lon, C.msToJd(Date.UTC(2026,2,20)) + ((lon-0+360)%360)/0.9856473);
  const k = C.kouAt(t+0.0005);
  if (k.posIndex!==0) { mism++; if(mism<4) console.log('   NG', C.SEKKI[s], '-> pos', k.pos); }
  if (k.sekkiName!==C.SEKKI[s]) { mism++; if(mism<4) console.log('   NG 節気名', C.SEKKI[s], 'vs', k.sekkiName); }
}
console.log('  節気の入り = 初候の入り になっていない件数:', mism, '/ 24');

console.log('\n=== 実際の暦と照合すべき候（2026年）===');
for (const [name,lon] of [['立春初候 東風解凍',315],['春分初候 雀始巣',0],['夏至初候 乃東枯',90],['半夏生(夏至末候)',100],['秋分初候 雷乃収声',180],['冬至初候 乃東生',270]]) {
  const t = C.solveSunLongitude(lon, C.msToJd(Date.UTC(2026,2,20)) + ((lon+360)%360)/0.9856473);
  const k = C.kouAt(t+0.0005);
  console.log('  '+name.padEnd(18), jstS(k.startJd), ' 第'+k.no+'候', k.kanji);
}
