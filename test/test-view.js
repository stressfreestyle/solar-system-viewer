/* =====================================================================
   人物理解の「描画された実出力」に対する構造検査（第9フェーズ）
   -------------------------------------------------------------------
   第7〜第8フェーズまで、この検査はブラウザを開いて手で走らせていた。
   第9フェーズで描画層を src/reading-view.js へ分離したので、
   node から実出力そのものを検査できるようになった。

   第9フェーズで表（読み解きの散文）と裏（法則）に分けたため、
   「根拠なしの断定が0件」の検査は次の形に作り直してある。

     旧: 断定文（.say / .beat）は必ず .rd > .src の中にある
     新: 断定文は必ず .rd の中にあり、その .rd は必ず「法則」チップを持ち、
         チップの指す先（laws[data-law] の data-ev="n"）に、
         タグチップ付きの根拠が実在する

   つまり検査するのは「断定と根拠の対応が切れていないか」。
   根拠がポップアップ側に移っても成立する。
   ===================================================================== */
global.CAL = require('../src/calendar-core.js');
global.RC  = require('../src/reading-content.js');
const READ  = require('../src/reading-core.js');
const RVIEW = require('../src/reading-view.js');
RVIEW.bind(global.RC, READ);
const RC = global.RC;

let fails = 0;
function eq(label, got, want) {
  const ok = got === want; if (!ok) fails++;
  console.log('  ' + (ok ? 'OK  ' : 'NG  ') + label + ': ' + got + (ok ? '' : '  ← 期待 ' + want));
}

/* --- 検査用の生年月日（時刻あり／なしの両方を含む） --- */
const DATES = [
  [1969, 10, 3], [1990, 7, 23, 14, 30], [1984, 2, 4], [2000, 1, 1, 0, 30],
  [1955, 12, 22, 23, 10], [1972, 6, 5], [2010, 3, 21, 9, 0], [1948, 8, 15],
  [1937, 5, 5, 12, 0], [1999, 11, 30], [1963, 4, 12, 6, 45], [2026, 8, 12],
  [1901, 1, 1], [1930, 9, 9, 3, 3], [2023, 12, 31, 23, 59], [1977, 2, 3]
];
function inputOf(d) {
  return { y: d[0], m: d[1], d: d[2], hasTime: d[3] !== undefined,
           hh: d[3] || 0, mi: d[4] || 0, place: null, gender: null, self: null };
}
function renderOf(d) {
  const inp = inputOf(d);
  const R = READ.read(inp);
  return { R, inp, out: RVIEW.render(R, inp, {}) };
}
function textOf(h) {
  return String(h)
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(div|p|h3|h4|h5|li|tr|i|u)>/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
/* 表＋裏をぜんぶ繋げた「到達できる文言」。空白は落として比較する */
function reachable(out) {
  let s = textOf(out.html);
  for (const k of Object.keys(out.laws)) s += out.laws[k].title + textOf(out.laws[k].html);
  return s.replace(/\s+/g, '');
}
/* タグの入っていないただの本文（表だけ） */
function frontText(out) { return textOf(out.html).replace(/\s+/g, ''); }

/* 開いた div を数えながら、あるクラスのブロックの中身を切り出す簡易パーサ。
   （描画層が組み立てた文字列なので、これで十分に厳密に取れる） */
function blocks(html, cls) {
  const out = [];
  const re = new RegExp('<div class="' + cls + '"', 'g');
  let m;
  while ((m = re.exec(html))) {
    let i = m.index, depth = 0, j = i;
    const tag = /<\/?div\b/g; tag.lastIndex = i;
    let t;
    while ((t = tag.exec(html))) {
      if (html[t.index + 1] === '/') { depth--; if (depth === 0) { j = t.index + 6; break; } }
      else depth++;
    }
    out.push(html.slice(i, j));
  }
  return out;
}

console.log('=== 1. どの節にも「法則」チップが1つある ===');
{
  let bad = 0, secCount = 0;
  for (const d of DATES) {
    const { out } = renderOf(d);
    const secs = blocks(out.html, 'rsec');
    secCount = secs.length;
    if (secs.length < 10) { bad++; console.log('   NG 節が足りない', d.join('-'), secs.length); }
    for (const s of secs) {
      const h3 = s.slice(0, s.indexOf('</h3>') + 5);
      const chips = h3.match(/<button[^>]*class="law"[^>]*>/g) || [];
      if (chips.length !== 1) { bad++; console.log('   NG 見出しのチップ数', d.join('-'), chips.length); }
      /* ラベルは「法則」で統一 */
      if (!/>法則<\/button>/.test(h3)) { bad++; console.log('   NG チップのラベル', d.join('-')); }
    }
    /* 冒頭の「この読みの立て方」の1つを足した数だけチップの参照先がある */
    if (!/class="fireline"[\s\S]*?data-law="law\.stance"/.test(out.html)) {
      bad++; console.log('   NG 冒頭の立て方チップがない', d.join('-'));
    }
  }
  console.log('  節の数:', secCount);
  eq('見出しのチップが各節にちょうど1つ', bad, 0);
}

console.log('\n=== 2. 断定と根拠の対応が切れていないこと（バーナム対策の要）===');
{
  let sayOutside = 0, rdNoChip = 0, danglingRef = 0, evNoTag = 0, evTooShort = 0;
  let rdTotal = 0, evTotal = 0;
  for (const d of DATES) {
    const { out } = renderOf(d);
    const rds = blocks(out.html, 'rd');
    rdTotal += rds.length;

    /* (a) 断定文（.say / .beat）は .rd の外に置けない */
    const outside = out.html.split(/<div class="rd">/).map((chunk, i) => {
      if (i === 0) return chunk;
      /* .rd の中身を取り除いた残り */
      return '';
    });
    let stripped = out.html;
    for (const b of rds) stripped = stripped.replace(b, '');
    const strayS = (stripped.match(/<div class="say">/g) || []).length;
    const strayB = (stripped.match(/<div class="beat">/g) || []).length;
    if (strayS + strayB) {
      sayOutside += strayS + strayB;
      console.log('   NG 根拠ブロックの外に断定', d.join('-'), strayS, strayB);
    }

    /* (b) どの .rd も「法則」チップを1つ持ち、根拠の番号を指している */
    for (const b of rds) {
      const m = b.match(/data-law="([^"]+)" data-ev="(\d+)"/);
      if (!m) { rdNoChip++; console.log('   NG 断定ブロックに根拠への導線がない', d.join('-')); continue; }
      const law = out.laws[m[1]];
      if (!law) { danglingRef++; console.log('   NG 参照先の法則が存在しない', d.join('-'), m[1]); continue; }
      const ev = law.html.match(new RegExp('<div class="ev" data-ev="' + m[2] + '">([\\s\\S]*?)</div>'));
      if (!ev) { danglingRef++; console.log('   NG 参照先の根拠が存在しない', d.join('-'), m[1], m[2]); continue; }
      evTotal++;
      /* (c) 根拠には必ずタグチップ（計算 か 伝統 か 読み）が入っている */
      if (!/class="chip c(計算|伝統|読み)"/.test(ev[1])) {
        evNoTag++; console.log('   NG 根拠にタグチップがない', d.join('-'), m[1], m[2]);
      }
      /* (d) 根拠が空文言でない（命式の記号が実際に書かれている） */
      if (textOf(ev[1]).replace(/\s+/g, '').length < 15) {
        evTooShort++; console.log('   NG 根拠が短すぎる', d.join('-'), m[1], m[2]);
      }
    }
  }
  console.log('  断定ブロックの総数:', rdTotal, '／ 対応した根拠:', evTotal);
  eq('根拠ブロックの外にある断定', sayOutside, 0);
  eq('根拠への導線を持たない断定ブロック', rdNoChip, 0);
  eq('参照先の切れたチップ', danglingRef, 0);
  eq('タグチップのない根拠', evNoTag, 0);
  eq('中身の無い根拠', evTooShort, 0);
  eq('すべての断定ブロックに根拠が対応している', evTotal, rdTotal);
}

console.log('\n=== 3. 1タップで根拠に届くこと（2階層以上たどらせない）===');
{
  /* 断定ブロックのチップが指す先は、必ず laws の第1区画（根拠）にある。
     根拠にたどり着くのに別のチップを押す必要がない、という検査。 */
  let bad = 0;
  for (const d of DATES) {
    const { out } = renderOf(d);
    for (const b of blocks(out.html, 'rd')) {
      const m = b.match(/data-law="([^"]+)" data-ev="(\d+)"/);
      const law = out.laws[m[1]];
      const head = law.html.slice(0, law.html.indexOf('<h5>この節に走っている法則</h5>') >= 0
        ? law.html.indexOf('<h5>この節に走っている法則</h5>') : law.html.length);
      if (head.indexOf('data-ev="' + m[2] + '"') < 0) {
        bad++; console.log('   NG 根拠が第1区画にない', d.join('-'), m[1], m[2]);
      }
      /* ポップアップの中に、さらに押さないと開かないチップが無いこと */
      if (/<button[^>]*class="law"/.test(law.html)) {
        bad++; console.log('   NG 裏の中に入れ子のチップがある', d.join('-'), m[1]);
      }
    }
  }
  eq('根拠へ1タップで届かない断定', bad, 0);
}

console.log('\n=== 4. 表に残すと決めたものが表にあること ===');
{
  let noPill = 0, noFudo = 0, noFace = 0, fudoInBackOnly = 0, noSay = 0;
  for (const d of DATES) {
    const { R, out } = renderOf(d);
    const front = frontText(out);
    /* 基本命式の表 */
    if (!/class="pill"/.test(out.html)) { noPill++; }
    R.pillars.pillars.forEach(p => { if (front.indexOf(p.gz) < 0) noPill++; });
    /* [不能] は表に残す（裏へ回さない） */
    R.fudo.forEach(f => {
      if (front.indexOf(f.what.replace(/\s+/g, '')) < 0) {
        fudoInBackOnly++; console.log('   NG [不能]が表にない', d.join('-'), f.what);
      }
    });
    if ((out.html.match(/chip c不能/g) || []).length < R.fudo.length) noFudo++;
    /* 状態ボタン4択 */
    const faces = blocks(out.html, 'face');
    if (faces.length !== 6) { noFace++; console.log('   NG 記録欄の数', d.join('-'), faces.length); }
    for (const f of faces) {
      if ((f.match(/<button data-s=/g) || []).length !== 4) noFace++;
    }
    /* 読み解きの散文そのもの */
    if ((out.html.match(/<div class="say">/g) || []).length < 15) { noSay++; }
  }
  eq('基本命式の干支が表にある', noPill, 0);
  eq('[不能] が表にある', fudoInBackOnly, 0);
  eq('[不能] のタグチップが表にある', noFudo, 0);
  eq('状態ボタンが6箇所×4択', noFace, 0);
  eq('読み解きの散文が表にある', noSay, 0);
}

console.log('\n=== 5. 裏へ回すと決めたものが裏から到達できること ===');
{
  let miss = 0;
  function need(where, label, s) {
    const t = String(s).replace(/\s+/g, '');
    if (where.indexOf(t) < 0) { miss++; console.log('   NG 到達できない:', label, t.slice(0, 40)); }
  }
  for (const d of DATES) {
    const { R, out } = renderOf(d);
    const all = reachable(out);
    /* 採用した流派・表・境界の一覧まるごと */
    R.conventions.forEach(c => { need(all, '流派/' + c[0], c[0]); need(all, '流派/' + c[0], c[1]); });
    /* [不能] の理由 */
    R.fudo.forEach(f => need(all, '不能/' + f.what, f.why));
    /* 手法上の但し書き */
    Object.keys(RC.NOTES).forEach(k => need(all, 'NOTES.' + k, RC.NOTES[k]));
    /* 表の一覧（十干の象意・五行の関係・五行の働き・星の写像・場の条件・目的の問い） */
    Object.keys(RC.REL_NAME).forEach(k => need(all, 'REL_NAME.' + k, RC.REL_NAME[k]));
    Object.keys(RC.ELEM_WORK).forEach(k => need(all, 'ELEM_WORK.' + k, RC.ELEM_WORK[k]));
    Object.keys(RC.HEAVY).forEach(k => need(all, 'HEAVY.' + k, RC.HEAVY[k]));
    Object.keys(RC.JUDAI_MEAN).forEach(k => need(all, 'JUDAI.' + k, RC.JUDAI_MEAN[k].from + '＝' + k));
    Object.keys(RC.BA_AXIS).forEach(k => {
      need(all, 'BA.' + k + '.many', RC.BA_AXIS[k].many);
      need(all, 'BA.' + k + '.none', RC.BA_AXIS[k].none);
    });
    Object.keys(RC.PURPOSE_QUESTIONS).forEach(k => need(all, 'PURPOSE.' + k, RC.PURPOSE_QUESTIONS[k]));
    Object.keys(RC.TAGS).forEach(k => need(all, 'TAGS.' + k, RC.TAGS[k].desc));
    Object.keys(RC.PILLAR_ROLE).forEach(k => need(all, 'PILLAR.' + k, RC.PILLAR_ROLE[k]));
  }
  eq('裏から到達できない文言', miss, 0);
}

console.log('\n=== 6. 表から専門用語の説明に届くこと ===');
{
  /* 表の散文に残る用語は、その節の裏の「言葉の意味」か「法則」で説明されていること */
  const TERMS = ['日主', '五行', '月令', '十二運', '蔵干', '干支', '天中殺', '本命宿', '十神', '旬'];
  let miss = 0;
  for (const d of DATES) {
    const { out } = renderOf(d);
    const front = frontText(out);
    let back = '';
    for (const k of Object.keys(out.laws)) back += textOf(out.laws[k].html).replace(/\s+/g, '');
    for (const t of TERMS) {
      if (front.indexOf(t) >= 0 && back.indexOf(t) < 0) {
        miss++; console.log('   NG 表にあるのに裏で説明がない:', t, d.join('-'));
      }
    }
  }
  eq('説明のない専門用語', miss, 0);
}

console.log('\n=== 7. 禁止事項（表・裏の両方を走査）===');
{
  const banned = [
    [/[0-9０-９]\s*[%％]/, 'パーセンテージ'],
    [/的中率|確率が|スコア|偏差値/, '的中率・確率・スコア'],
    [/死ぬ|寿命|病気になる|癌|事故に|逮捕|犯罪を|離婚す|結婚できる|妊娠|出産|破産|金運/, '高リスク予測'],
    [/あなたは必ず|間違いなく|運命づけ|宿命的に|生まれ持った才能/, '運命論的な言い切り'],
    [/向いている職業|天職は/, '職業の直結'],
    [/気づいていない|自覚がない|自分を分かって|認めたくない|あなたが間違|思い込み|勘違いして/, '本人の否定'],
    [/医師|看護|弁護士|会計士|税理士|教師|教員|技術者|技術職|営業職|公務員|経営者|研究職|警察|自衛|コンサル|デザイナ|プログラマ|エンジニア/, '職業名の列挙'],
    /* 「比肩」「不足」などの熟語の一部を体の部位と取り違えないよう、直前の字を見る */
    [/(?<![比不補])(?:頭|胸|腹|左手|右手|肩|足)\s*(?:に|＝|=|は)\s*[^。]{0,8}星/, '人体星図の配置の断定'],
    [/開運|運気が上がる|幸運|凶運|大吉|大凶/, '吉凶・開運'],
    [/undefined|NaN|\[object/, '書きかけ・未定義の混入']
  ];
  /* 「〜は出さない」という否定文脈の宣言そのものは除外する */
  const DECLARE = /(出していません|出しません|出さない|書きません|書かない|しません|使いません|禁止|類も出して)/;
  let hit = 0;
  for (const d of DATES) {
    const { out } = renderOf(d);
    let all = textOf(out.html);
    for (const k of Object.keys(out.laws)) all += textOf(out.laws[k].html);
    for (const line of all.split(/[\n。]/)) {
      if (DECLARE.test(line)) continue;
      for (const [re, name] of banned) {
        if (re.test(line)) { hit++; console.log('   NG [' + name + '] ' + d.join('-') + ': ' + line.slice(0, 60)); }
      }
    }
  }
  eq('禁止表現の混入（表＋裏）', hit, 0);
}

console.log('\n=== 8. 決定性（同じ入力から同じ描画）===');
{
  const a = JSON.stringify(renderOf([1969, 10, 3]).out);
  global.CAL.resetCaches();
  const b = JSON.stringify(renderOf([1969, 10, 3]).out);
  eq('2回描画して完全一致', a === b, true);
}

console.log('\n=== 9. 裏の入れ物に取りこぼしが無いこと ===');
{
  let bad = 0;
  for (const d of DATES) {
    const { out } = renderOf(d);
    const ids = Object.keys(out.laws);
    /* 表から参照されている id がすべて実在する */
    const refs = (out.html.match(/data-law="([^"]+)"/g) || []).map(s => s.slice(10, -1));
    refs.forEach(r => { if (ids.indexOf(r) < 0) { bad++; console.log('   NG 実在しない参照', r); } });
    /* 逆に、どこからも参照されていない裏が無い（開けない裏を作らない） */
    ids.forEach(i => { if (refs.indexOf(i) < 0) { bad++; console.log('   NG 開く導線のない裏', i, d.join('-')); } });
    /* 裏が空でない */
    ids.forEach(i => {
      if (!out.laws[i].title || textOf(out.laws[i].html).replace(/\s+/g, '').length < 30) {
        bad++; console.log('   NG 中身の薄い裏', i);
      }
    });
  }
  eq('裏の参照の取りこぼし', bad, 0);
}

console.log('\n=== 10. 1969-10-03（時刻不明）の実出力 ===');
{
  const { R, out } = renderOf([1969, 10, 3]);
  const front = frontText(out);
  eq('四柱', R.pillars.pillars.map(p => p.gz).join('／'), '己酉／癸酉／辛亥');
  eq('本命宿', R.shukuyo.name, '鬼宿');
  eq('時柱を出していない', /時柱は出していません/.test(front), true);
  eq('裏の数', Object.keys(out.laws).length, 11);
  console.log('  断定ブロック:', blocks(out.html, 'rd').length,
              '／ 表の文字数:', front.length, '／ 裏の文字数:',
              Object.keys(out.laws).reduce((s, k) => s + textOf(out.laws[k].html).replace(/\s+/g, '').length, 0));
}

console.log('\n================ 失敗: ' + fails + ' ================');
process.exit(fails ? 1 : 0);
