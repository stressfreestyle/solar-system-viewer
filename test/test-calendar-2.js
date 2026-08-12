const C = require('../src/calendar-core.js');
const p = n => String(n).padStart(2,'0');
const jstStr = jd => { const d=new Date(C.jdToMs(jd)+9*3600000);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };

console.log('=== A. 閏月のある年 (2025年は閏6月のはず) ===');
for (const t of ['2025-07-24','2025-07-25','2025-08-01','2025-08-22','2025-08-23']) {
  const jd = C.msToJd(Date.parse(t+'T03:00:00Z'));
  const L = C.lunarDate(jd);
  console.log('  '+t+' ->', (L.leap?'閏':'')+L.month+'月'+L.day+'日',
    '(旧暦'+L.year+'年,'+(L.big?'大':'小')+' '+L.monthLength+'日)',
    L.leapInCycle?'[周期の閏月='+L.leapInCycle+'月]':'[閏なし]');
}
console.log('  期待: 07-25から閏6月が始まり、08-23から7月1日');

console.log('\n=== B. 旧暦の連続性チェック (2025-01-01から900日、日ごとに検証) ===');
let prev=null, errs=[], leapMonths=new Set();
for (let k=0;k<900;k++){
  const jd = C.msToJd(Date.UTC(2025,0,1,3,0)) + k;
  const L = C.lunarDate(jd);
  if (L.leap) leapMonths.add(L.year+'年閏'+L.month+'月');
  if (L.day<1 || L.day>30) errs.push('day out of range at k='+k+' '+JSON.stringify(L));
  if (prev){
    const okSame = (L.month===prev.month && L.leap===prev.leap && L.day===prev.day+1);
    const okNew  = (L.day===1 && prev.day===prev.monthLength);
    if(!okSame && !okNew) errs.push('discontinuity k='+k+' prev='+(prev.leap?'閏':'')+prev.month+'/'+prev.day+'(len'+prev.monthLength+') cur='+(L.leap?'閏':'')+L.month+'/'+L.day);
  }
  prev=L;
}
console.log('  エラー数:', errs.length); errs.slice(0,5).forEach(e=>console.log('   ',e));
console.log('  検出した閏月:', [...leapMonths].join(', '));

console.log('\n=== C. 朔日が必ず1日になっているか (2025-2028の全朔) ===');
let bad=0, n=0;
let nm = C.newMoonAfter(C.msToJd(Date.UTC(2025,0,1)));
while (nm < C.msToJd(Date.UTC(2028,0,1))) {
  const L = C.lunarDate(C.jstDayToJd(C.jstDay(nm))+0.5);
  n++; if (L.day!==1){ bad++; if(bad<4) console.log('   NG', jstStr(nm), '->', L.month+'月'+L.day+'日'); }
  nm = C.solveElongation(0, nm+29.53);
}
console.log('  朔の数:', n, ' 1日でなかった数:', bad);

console.log('\n=== D. 50音歴：50区切りが必ず冬至に閉じるか (2020-2035) ===');
let worst=0;
for (let y=2020;y<2035;y++){
  const ws0=C.solveSunLongitude(270, C.msToJd(Date.UTC(y,11,22)));
  const ws1=C.solveSunLongitude(270, C.msToJd(Date.UTC(y+1,11,22)));
  let acc=ws0;
  for(let k=0;k<50;k++){ acc = C.gojuon(acc+0.0005).endJd; }
  const err=Math.abs(acc-ws1)*86400;
  if(err>worst) worst=err;
}
console.log('  50区間積み上げ後の冬至との最大誤差:', worst.toFixed(2), '秒');

console.log('\n=== E. snapshot のキャッシュ整合性（キャッシュ有無で同じ結果か）===');
const times=[]; for(let i=0;i<200;i++) times.push(C.msToJd(Date.UTC(2026,0,1))+i*3.7);
const withCache = times.map(t=>{const s=C.snapshot(t); return [s.gojuon.sound,s.sekki.name,s.lunar.month+'/'+s.lunar.day,s.nakshatra.name,s.moon.age.toFixed(3)].join('|');});
const fresh = times.map(t=>{C.resetCaches(); const s=C.snapshot(t); return [s.gojuon.sound,s.sekki.name,s.lunar.month+'/'+s.lunar.day,s.nakshatra.name,s.moon.age.toFixed(3)].join('|');});
let mism=0; for(let i=0;i<times.length;i++) if(withCache[i]!==fresh[i]){ if(mism<3) console.log('   差異 i='+i, withCache[i],'vs',fresh[i]); mism++; }
console.log('  200点中の不一致:', mism);

console.log('\n=== F. 性能 ===');
C.resetCaches();
let t0=process.hrtime.bigint();
for(let i=0;i<200;i++) C.snapshot(C.msToJd(Date.UTC(2026,0,1))+i*1.0);   // 1日ずつ進める
let t1=process.hrtime.bigint();
console.log('  1日刻み200回 (キャッシュ有効):', Number(t1-t0)/1e6/200, 'ms/回');
C.resetCaches();
t0=process.hrtime.bigint();
for(let i=0;i<100;i++) C.snapshot(C.msToJd(Date.UTC(2026,0,1))+i*365.25); // 1年ずつ = 全キャッシュミス
t1=process.hrtime.bigint();
console.log('  1年刻み100回 (毎回キャッシュミス):', Number(t1-t0)/1e6/100, 'ms/回');

console.log('\n=== G. 広い期間で壊れないか (1900-2100を1年刻み) ===');
let crash=0;
for(let y=1900;y<=2100;y++){
  try{ const s=C.snapshot(C.msToJd(Date.UTC(y,6,15,3,0)));
    if(!(s.lunar.day>=1&&s.lunar.day<=30)||!(s.gojuon.no>=1&&s.gojuon.no<=50)||!(s.nakshatra.no>=1&&s.nakshatra.no<=27)) {crash++; if(crash<4)console.log('   異常',y,JSON.stringify(s.lunar));}
  }catch(e){ crash++; if(crash<4) console.log('   例外',y,e.message); }
}
console.log('  異常/例外の年数:', crash, '/ 201年');
