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

console.log('\n=== 11. 文面データの禁止事項チェック（第7フェーズ：断定調）===');
// 文面データを全部たどって [id, text] の配列にする
function collect(){
  const out=[];
  const walk=(prefix,v)=>{
    if(typeof v==='string'){ out.push([prefix,v]); return; }
    if(Array.isArray(v)){ v.forEach((x,i)=>walk(prefix+'['+i+']',x)); return; }
    if(v && typeof v==='object'){ for(const k of Object.keys(v)) walk(prefix+'.'+k, v[k]); }
  };
  for(const key of ['STEM10','YINYANG','ELEM_WORK','ELEM_SHORT','REL_NAME','LACK','HEAVY',
                    'TENGOD_MEAN','STAGE_MEAN','JUDAI_MEAN','JUJUSEI_MEAN','PILLAR_ROLE',
                    'COMMAND_MEAN','TCS_OVERLAP','SECTION_CHECK','PURPOSE_QUESTIONS',
                    'BA_AXIS','NOTES']) walk(key, RC[key]);
  return out;
}
{
  const texts=collect();
  console.log('  文面の総数:', texts.length);
  const banned = [
    [/[0-9０-９]\s*[%％]/, 'パーセンテージ'],
    [/的中|確率|スコア|点数|偏差値/, '的中率・確率・スコア'],
    [/死ぬ|寿命|病気になる|癌|事故|逮捕|犯罪|離婚|結婚できる|妊娠|出産|破産|金運/, '高リスク予測'],
    [/あなたは必ず|間違いなく|絶対に.*です|運命づけ|宿命的に|生まれ持った才能/, '運命論的な言い切り'],
    [/魂の目的|前世|使命は/, '魂の目的の断定'],
    [/向いている職業|天職は/, '職業の直結'],
    // 三層構造にしたことで禁止したもの:
    // 法則を優先するからといって、本人を否定する形にしてはならない
    [/気づいていない|自覚がない|自分を分かって|本当は.*はずだ|認めたくない|受け入れられていない/, '本人の否定'],
    [/あなたが間違|思い込み|勘違いして/, '本人を誤りとする表現'],
    // 第7フェーズで追加:
    [/医師|看護|弁護士|会計士|税理士|教師|教員|技術者|技術職|営業職|公務員|経営者|研究職|警察|自衛|コンサル|デザイナ|プログラマ|エンジニア/, '職業名の列挙'],
    [/(頭|胸|腹|左手|右手|肩|足)\s*(に|＝|=|は)\s*[^。]{0,8}星/, '人体星図の配置の断定'],
    // 四柱推命の五行を、同じ字を使う別の体系（火と水の二元）と同一視しない
    [/火水|二元|陰陽五行対応|対応表/, '別体系との同一視'],
    [/(五行|命式)の?[火水木土金].{0,6}(と同じ|にあたる|に対応|そのもので)/, '別体系との対応づけ'],
  ];
  let hit=0;
  for(const [id,t] of texts) for(const [re,name] of banned)
    if(re.test(t)){ hit++; console.log('   NG ['+name+'] '+id+': '+t.slice(0,60)); }
  eq('禁止表現の混入', hit, 0);
  // 英字の混入（書きかけの検出）
  const ascii = texts.filter(([id,t])=>/[A-Za-z]{2,}/.test(t));
  eq('英単語の混入', ascii.length, 0);
  if(ascii.length) ascii.slice(0,5).forEach(([id,t])=>console.log('   ',id,':',t.slice(0,60)));
}

console.log('\n=== 11b. 文面データの完全性（断定に根拠を欠かさないための構造検査）===');
{
  const STEMS=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const ELEM=['木','火','土','金','水'];
  const REL=['生我','我生','我剋','剋我'];
  let miss=0;
  for(const s of STEMS){
    const e=RC.STEM10[s];
    if(!e){ miss++; console.log('   NG 十干欠落', s); continue; }
    for(const f of ['metaphor','core','logic','verbs','challenge','essence','contrast'])
      if(!e[f]||(f==='verbs'&&e.verbs.length<3)){ miss++; console.log('   NG', s, f); }
  }
  eq('十干10個ぶんの象意がそろっている', miss, 0);
  // 欠けた五行の帰結表: 日主の五行5種 × 関係4種
  let lm=0;
  for(const d of ELEM) for(const r of REL){
    const v=RC.LACK[d] && RC.LACK[d][r];
    if(!v||!v.effect||!v.supply){ lm++; console.log('   NG LACK', d, r); }
  }
  eq('欠けた五行の帰結表 5×4 がそろっている', lm, 0);
  // 星・十二運の意味
  const JUDAI=['貫索星','石門星','鳳閣星','調舒星','禄存星','司禄星','車騎星','牽牛星','龍高星','玉堂星'];
  const JUJU=['天報星','天印星','天貴星','天恍星','天南星','天禄星','天将星','天堂星','天胡星','天極星','天庫星','天馳星'];
  const STAGE=['長生','沐浴','冠帯','建禄','帝旺','衰','病','死','墓','絶','胎','養'];
  const TG=['比肩','劫財','食神','傷官','偏財','正財','偏官','正官','偏印','正印'];
  eq('十大主星の意味10個', JUDAI.filter(k=>RC.JUDAI_MEAN[k]&&RC.JUDAI_MEAN[k].from&&RC.JUDAI_MEAN[k].line).length, 10);
  eq('十二大従星の意味12個', JUJU.filter(k=>RC.JUJUSEI_MEAN[k]).length, 12);
  eq('十二運の意味12個', STAGE.filter(k=>RC.STAGE_MEAN[k]).length, 12);
  eq('十神の意味10個', TG.filter(k=>RC.TENGOD_MEAN[k]).length, 10);
  eq('五行の働き5個', ELEM.filter(k=>RC.ELEM_WORK[k]&&RC.ELEM_SHORT[k]).length, 5);
  eq('厚い五行の意味5個', ['同','生我','我生','我剋','剋我'].filter(k=>RC.HEAVY[k]).length, 5);
  eq('月令に対する位置5個', ['旺','相','休','囚','死'].filter(k=>RC.COMMAND_MEAN[k]).length, 5);
  eq('場・役割の断片5軸', ['同類','生我','我生','我剋','剋我']
      .filter(k=>RC.BA_AXIS[k]&&RC.BA_AXIS[k].many&&RC.BA_AXIS[k].none).length, 5);
  eq('節ごとの確認の問い6個', Object.keys(RC.SECTION_CHECK).length, 6);
  // 状態は4択のまま。旧キーの移行表も残っていること
  eq('面の見え方の状態は4択', RC.STATUS.length, 4);
  eq('旧キーの移行表が残っている', Object.keys(RC.STATUS_MIGRATE).length, 3);
  eq('タグは6種', Object.keys(RC.TAGS).length, 6);
  eq('タグに[読み]がある', !!RC.TAGS['読み'], true);
  eq('タグに[不能]がある', !!RC.TAGS['不能'], true);
  // 別体系と同一視しないという注記が実在すること
  eq('五行と別体系を切り離す注記がある',
     /別の体系/.test(RC.NOTES.dualNote) && /対応づけはしていません/.test(RC.NOTES.dualNote), true);
  eq('職業名を挙げない注記がある', /職業名は挙げません/.test(RC.NOTES.noJob), true);
  eq('用神を判定しない注記がある', /用神/.test(RC.NOTES.noYojin), true);
  eq('宿から人物像を出さない注記がある', /人物像/.test(RC.NOTES.shukuLimit), true);
}

console.log('\n=== 11c. 五行の関係の写像（断定の土台）===');
{
  const E={木:0,火:1,土:2,金:3,水:4};
  eq('金から見た火は剋我', READ.relOf(E.金, E.火), '剋我');
  eq('金から見た木は我剋', READ.relOf(E.金, E.木), '我剋');
  eq('金から見た土は生我', READ.relOf(E.金, E.土), '生我');
  eq('金から見た水は我生', READ.relOf(E.金, E.水), '我生');
  eq('木から見た木は同',   READ.relOf(E.木, E.木), '同');
  // 旺相休囚死（春＝木令のときの5五行）
  eq('木令のとき木は旺', READ.commandState(E.木, E.木), '旺');
  eq('木令のとき火は相', READ.commandState(E.火, E.木), '相');
  eq('木令のとき水は休', READ.commandState(E.水, E.木), '休');
  eq('木令のとき金は囚', READ.commandState(E.金, E.木), '囚');
  eq('木令のとき土は死', READ.commandState(E.土, E.木), '死');
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
  console.log('  月令に対する位置:', R.structure.command, '/ 欠けた五行:',
              R.structure.lacking.map(l=>l.elem+'('+l.rel+')').join(',')||'なし');
  console.log('  [不能]の数:', R.fudo.length);
  console.log('  [不能]:'); R.fudo.forEach(f=>console.log('    - '+f.what));
}

console.log('\n=== 13. 検算用の生年月日（1969-10-03・時刻不明）===');
{
  const R = READ.read({y:1969,m:10,d:3,hasTime:false,hh:0,mi:0,place:null});
  eq('四柱', R.pillars.pillars.map(p=>p.gz).join('／'), '己酉／癸酉／辛亥');
  eq('日主', R.pillars.dmName+R.pillars.dmYin+R.pillars.dmElem, '辛陰金');
  eq('十二大従星', R.sanmei.jusei.map(j=>j.star).join('／'), '天禄星／天禄星／天恍星');
  eq('天中殺(日柱)', R.sanmei.dayTenchusatsu.name, '寅卯天中殺');
  eq('旧暦', R.shukuyo.lunarMonth+'月'+R.shukuyo.lunarDay+'日', '8月22日');
  eq('本命宿(伝統暦方式)', R.shukuyo.name, '鬼宿');
  eq('時柱を出していない', R.pillars.pillars.length, 3);
  eq('欠けた五行', R.structure.lacking.map(l=>l.elem).join(','), '木,火');
  eq('天中殺の二支の五行', R.structure.tcs.elems.join(','), '木');
  eq('余る方向と欠けた五行が重なる', R.structure.tcs.overlap, 'lack');
}

console.log('\n================ 失敗: '+fails+' ================');
process.exit(fails?1:0);
