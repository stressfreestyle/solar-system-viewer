global.CAL = require('../src/calendar-core.js');
global.RC  = require('../src/reading-content.js');
const READ = require('../src/reading-core.js');
const C = global.CAL;
const p=n=>String(n).padStart(2,'0');
const jstS=jd=>{const d=new Date(C.jdToMs(jd)+9*3600000);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;};
function inp(y,m,d,hh,mi){ return {y,m,d,hasTime:hh!==undefined, hh:hh||0, mi:mi||0, place:null}; }
let fails=0;
function eq(label, got, want){ const ok = got===want; if(!ok) fails++;
  console.log('  '+(ok?'OK  ':'NG  ')+label+': '+got+(ok?'':'  ← 期待 '+want)); }

console.log('=== 1. 日柱（六十干支）を既知の日付で検算 ===');
// (JDN + 49) mod 60。JDN は JST の暦日
// 1984-02-02 は年柱が甲子であって日柱ではない（取り違えやすい）。
// 日柱の外部基準としては 1949-10-01 = 甲子日 を使う。
const known = [
  ['1949-10-01','甲子'],  // 広く知られた日柱の基準日
  ['2000-01-01','戊午'],
  ['1900-01-01','甲戌'],
  ['1984-02-02','丙寅'],  // 1984年の年柱は甲子だが、この日の日柱は丙寅
  ['2026-08-12', null],
];
for (const [ds, want] of known) {
  const [y,m,d] = ds.split('-').map(Number);
  const P = READ.buildPillars(inp(y,m,d));
  const got = P.pillars[2].gz;
  if (want) eq('日柱 '+ds, got, want); else console.log('       日柱 '+ds+': '+got);
}
// 連続性: 日柱は毎日1つずつ進み、60日で戻る
{
  let prev=null, bad=0;
  for(let k=0;k<70;k++){
    const t = new Date(Date.UTC(2026,0,1)+k*86400000);
    const P = READ.buildPillars(inp(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate()));
    const i = P.pillars[2].idx;
    if(prev!==null && i!==(prev+1)%60) bad++;
    prev=i;
  }
  eq('日柱が毎日1つずつ進む（70日連続）', bad, 0);
}

console.log('\n=== 2. 年柱が立春で切り替わるか（境界の前後1分）===');
for (const y of [1984, 2000, 2026]) {
  const r = C.solveSunLongitude(315, C.msToJd(Date.UTC(y,1,4)));
  const rp = C.jstParts(r);
  const before = new Date(C.jdToMs(r)+9*3600000 - 60000);
  const after  = new Date(C.jdToMs(r)+9*3600000 + 60000);
  const Pb = READ.buildPillars(inp(before.getUTCFullYear(),before.getUTCMonth()+1,before.getUTCDate(),before.getUTCHours(),before.getUTCMinutes()));
  const Pa = READ.buildPillars(inp(after.getUTCFullYear(),after.getUTCMonth()+1,after.getUTCDate(),after.getUTCHours(),after.getUTCMinutes()));
  const wantAfter = READ.gz(((y-4)%60+60)%60);
  const wantBefore = READ.gz(((y-1-4)%60+60)%60);
  console.log('  立春 '+y+' = '+jstS(r));
  eq('  1分前の年柱', Pb.pillars[0].gz, wantBefore);
  eq('  1分後の年柱', Pa.pillars[0].gz, wantAfter);
}
eq('1984年の年柱が甲子', READ.gz(((1984-4)%60+60)%60), '甲子');
eq('2026年の年柱が丙午', READ.gz(((2026-4)%60+60)%60), '丙午');

console.log('\n=== 3. 月柱が節入りで切り替わるか（境界の前後1分）===');
// 2026年の啓蟄(黄経345度)前後
for (const [name, lon] of [['立春',315],['啓蟄',345],['立夏',45],['立秋',135],['立冬',225]]) {
  const t = C.solveSunLongitude(lon, C.msToJd(Date.UTC(2026,2,20)) + ((lon+360)%360)/0.9856473);
  const b = new Date(C.jdToMs(t)+9*3600000 - 60000);
  const a = new Date(C.jdToMs(t)+9*3600000 + 60000);
  const Pb = READ.buildPillars(inp(b.getUTCFullYear(),b.getUTCMonth()+1,b.getUTCDate(),b.getUTCHours(),b.getUTCMinutes()));
  const Pa = READ.buildPillars(inp(a.getUTCFullYear(),a.getUTCMonth()+1,a.getUTCDate(),a.getUTCHours(),a.getUTCMinutes()));
  const changed = Pb.pillars[1].gz !== Pa.pillars[1].gz;
  if(!changed) fails++;
  console.log('  '+(changed?'OK  ':'NG  ')+name+' '+jstS(t)+': 月柱 '+Pb.pillars[1].gz+' → '+Pa.pillars[1].gz);
}

console.log('\n=== 4. 五虎遁・五鼠遁 ===');
// 年干が甲の年 → 寅月の干は丙
{
  const P = READ.buildPillars(inp(2024,2,10));   // 2024=甲辰年、2/10は寅月
  eq('甲年の寅月干が丙', P.pillars[1].gz[0], '丙');
  eq('  そのときの月支が寅', P.pillars[1].gz[1], '寅');
}
// 時柱: 日干甲 → 子刻の干は甲
{
  // 日干が甲になる日を探す
  let d=null;
  for(let k=0;k<60;k++){ const t=new Date(Date.UTC(2026,0,1)+k*86400000);
    const P=READ.buildPillars(inp(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate(),0,30));
    if(P.pillars[2].gz[0]==='甲'){ d=P; break; } }
  eq('日干甲の日の 00:30(子刻) の時干が甲', d.pillars[3].gz[0], '甲');
  eq('  その時支が子', d.pillars[3].gz[1], '子');
}
// 時支の割り当て
{
  const t=[[23,'子'],[0,'子'],[1,'丑'],[2,'丑'],[3,'寅'],[11,'午'],[12,'午'],[13,'未']];
  let bad=0;
  for(const [h,b] of t){ const P=READ.buildPillars(inp(2026,8,12,h,0));
    if(P.pillars[3].gz[1]!==b){ bad++; console.log('   NG h='+h+' got '+P.pillars[3].gz[1]+' want '+b); } }
  eq('時支の割り当て（子=23〜1時）', bad, 0);
}

console.log('\n=== 5. 時刻未入力なら時柱が出ないこと ===');
{
  const P = READ.buildPillars(inp(2026,8,12));
  eq('柱の数（年月日のみ）', P.pillars.length, 3);
  eq('時柱が無い', P.pillars.filter(x=>x.name==='時柱').length, 0);
  const hasFudo = P.fudo.some(f=>f.what==='時柱');
  eq('[不能]に時柱が入っている', hasFudo, true);
  const P2 = READ.buildPillars(inp(2026,8,12,14,30));
  eq('時刻ありなら4柱', P2.pillars.length, 4);
}

console.log('\n=== 6. 天中殺（算術）===');
{
  const t = READ.tenchusatsu(0);   // 甲子の旬
  eq('甲子旬の天中殺', t.name, '戌亥天中殺');
  const all = [0,10,20,30,40,50].map(i=>READ.tenchusatsu(i).name);
  console.log('  六旬すべて:', all.join(' / '));
  eq('六種そろっている', new Set(all).size, 6);
}

console.log('\n=== 7. 十神・十二運 ===');
{
  eq('甲から見た甲 = 比肩', READ.tenGod(0,0), '比肩');
  eq('甲から見た乙 = 劫財', READ.tenGod(0,1), '劫財');
  eq('甲から見た丙 = 食神', READ.tenGod(0,2), '食神');
  eq('甲から見た丁 = 傷官', READ.tenGod(0,3), '傷官');
  eq('甲から見た戊 = 偏財', READ.tenGod(0,4), '偏財');
  eq('甲から見た己 = 正財', READ.tenGod(0,5), '正財');
  eq('甲から見た庚 = 偏官', READ.tenGod(0,6), '偏官');
  eq('甲から見た辛 = 正官', READ.tenGod(0,7), '正官');
  eq('甲から見た壬 = 偏印', READ.tenGod(0,8), '偏印');
  eq('甲から見た癸 = 印綬(正印)', READ.tenGod(0,9), '正印');
  eq('甲の長生は亥', READ.juniun(0, 11), '長生');
  eq('丙の長生は寅', READ.juniun(2, 2), '長生');
  eq('乙の長生は午(逆行)', READ.juniun(1, 6), '長生');
  eq('甲の帝旺は卯', READ.juniun(0, 3), '帝旺');
}

console.log('\n=== 8. 宿曜: 伝統暦方式 ===');
{
  // 旧暦1日は必ずその月の朔日宿になる
  let bad=0, samples=[];
  for(let k=0;k<400;k+=1){
    const t=new Date(Date.UTC(2026,0,1)+k*86400000);
    const P=READ.buildPillars(inp(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate()));
    const K=READ.shukuyo(P,P.jd);
    if(K.lunarDay===1){
      samples.push(K.lunarMonth+'月1日→'+K.name+'(朔日宿'+K.sakujitsu+')');
      if(K.name!==K.sakujitsu+'宿') bad++;
    }
  }
  eq('旧暦1日が朔日宿と一致', bad, 0);
  console.log('  例:', samples.slice(0,6).join(' / '));
  // 連続する日で宿が1つずつ進む
  let prev=null, jump=0;
  for(let k=0;k<60;k++){
    const t=new Date(Date.UTC(2026,5,1)+k*86400000);
    const P=READ.buildPillars(inp(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate()));
    const K=READ.shukuyo(P,P.jd);
    if(prev!==null && K.index!==(prev+1)%27){
      jump++; if(jump<3) console.log('   月替わりで飛ぶ(想定内):', t.toISOString().slice(0,10), prev+'→'+K.index);
    }
    prev=K.index;
  }
  console.log('  ※ 朔日でリセットされるため月替わりで不連続になるのは方式上の正しい挙動');
}

console.log('\n=== 9. 宿曜: 伝統暦方式と天文方式が実際に食い違うか ===');
{
  let same=0, diff=0, ex=[];
  for(let k=0;k<120;k++){
    const t=new Date(Date.UTC(1980,0,1)+k*97*86400000);
    const P=READ.buildPillars(inp(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate()));
    const K=READ.shukuyo(P,P.jd);
    if(K.agrees) same++; else { diff++; if(ex.length<5) ex.push(t.toISOString().slice(0,10)+': 伝統='+K.name+' / 天文='+K.astro.name); }
  }
  console.log('  120例中 一致'+same+' / 不一致'+diff);
  eq('食い違いが実際に出る（両方式が別モデルである証拠）', diff>0, true);
  ex.forEach(e=>console.log('    '+e));
}

console.log('\n=== 10. 決定性（同じ入力→同じ出力）===');
{
  const a = JSON.stringify(READ.read(inp(1990,7,23,14,30)));
  C.resetCaches();
  const b = JSON.stringify(READ.read(inp(1990,7,23,14,30)));
  eq('2回実行して完全一致', a===b, true);
}

console.log('\n=== 11. 生成文の禁止事項チェック ===');
{
  const texts=[];
  for(const k of Object.keys(RC.hypotheses)){
    const h=RC.hypotheses[k];
    for(const f of ['theme','traditional_basis','possible_strength','overload_pattern',
                    'enabling_conditions','counter_hypothesis','reality_check',
                    'experiment','metric','expected','ifnot']){
      if(h[f]) texts.push([k+'.'+f, h[f]]);
    }
  }
  console.log('  文面の総数:', texts.length);
  const banned = [
    [/[0-9０-９]\s*[%％]/, 'パーセンテージ'],
    [/的中|確率|スコア|点数|偏差値/, '的中率・確率・スコア'],
    [/死ぬ|寿命|病気になる|癌|事故|逮捕|犯罪|離婚|結婚できる|妊娠|出産|破産|金運/, '高リスク予測'],
    [/あなたは必ず|間違いなく|絶対に.*です|運命づけ|宿命的に|生まれ持った才能/, '断定'],
    [/魂の目的|前世|使命は/, '魂の目的の断定'],
    [/向いている職業|天職は/, '職業の直結'],
    // 三層構造にしたことで新たに禁止したもの:
    // 法則を優先するからといって、本人を否定する形にしてはならない
    [/気づいていない|自覚がない|自分を分かって|本当は.*はずだ|認めたくない|受け入れられていない/, '本人の否定'],
    [/あなたが間違|思い込み|勘違いして/, '本人を誤りとする表現'],
  ];
  let hit=0;
  for(const [id,t] of texts) for(const [re,name] of banned)
    if(re.test(t)){ hit++; console.log('   NG ['+name+'] '+id+': '+t.slice(0,60)); }
  eq('禁止表現の混入', hit, 0);
  // 英字の混入（書きかけの検出）
  const ascii = texts.filter(([id,t])=>/[A-Za-z]{2,}/.test(t));
  eq('英単語の混入', ascii.length, 0);
  if(ascii.length) ascii.slice(0,5).forEach(([id,t])=>console.log('   ',id,':',t.slice(0,60)));
  // 対の完全性
  let miss=0;
  for(const k of Object.keys(RC.hypotheses)){
    const h=RC.hypotheses[k];
    for(const f of ['theme','traditional_basis','possible_strength','overload_pattern',
                    'enabling_conditions','counter_hypothesis','reality_check',
                    'experiment','metric','expected','ifnot'])
      if(!h[f]){ miss++; console.log('   NG 欠落', k, f); }
  }
  eq('必須フィールドの欠落', miss, 0);
  eq('仮説テンプレートの数', Object.keys(RC.hypotheses).length, 32);
}

console.log('\n=== 12. 実例の読み ===');
{
  const R = READ.read(inp(1990,7,23,14,30));
  console.log('  四柱:', R.pillars.pillars.map(p=>p.name+' '+p.gz).join(' / '));
  console.log('  日主:', R.pillars.dmName+'（'+R.pillars.dmYin+R.pillars.dmElem+'）');
  console.log('  五軸:', R.analysis.axes.map(a=>a.axis+a.count).join(' '));
  console.log('  五行:', R.analysis.elems.map(e=>e.elem+e.count).join(' '));
  console.log('  本命宿(伝統):', R.shukuyo.name, '/ 天文:', R.shukuyo.astro.name, '/ 一致:', R.shukuyo.agrees);
  console.log('  天中殺(日柱):', R.sanmei.dayTenchusatsu.name);
  console.log('  仮説の数:', R.hypotheses.length, '/ [不能]の数:', R.fudo.length);
  console.log('  [不能]:'); R.fudo.forEach(f=>console.log('    - '+f.what));
}

console.log('\n================ 失敗: '+fails+' ================');
process.exit(fails?1:0);
