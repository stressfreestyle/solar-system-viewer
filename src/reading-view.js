/* =====================================================================
   人物理解の描画層（第9フェーズ）
   -------------------------------------------------------------------
   表 = 一般向けの読み解きの散文。
   裏 = その裏に走っている法則（アルゴリズム）と、断定を支える記号。

   DOM を触らない純粋な文字列組み立て。RC（文面）と READ（計算）を受け取り、
   { sub, html, faceIds, laws } を返す。
   laws は id → { title, html }。ポップアップ側はこれを流し込むだけで、
   節が増えてもポップアップ用の DOM は増えない。

   分離した理由: 「断定と根拠の対応が切れていないか」などの構造検査を、
   ブラウザを起動せずに node のテストから実出力に直接かけられるようにするため。

   節を足すときの作法（次フェーズで宿曜の項目が増える予定）:
     1. L.sec('law.xxx', '◯. 見出しの法則') で裏の入れ物を作る
     2. H.push(sec('◯. 見出し', '副題', 'law.xxx')) で表の見出しを出す
        （見出しの脇に「法則」チップが自動で付く）
     3. 断定は必ず rd(L, 'law.xxx', 根拠, [say(...)]) で書く
        （根拠は裏へ入り、ブロックには根拠へ1タップで行くチップが付く）
     4. アルゴリズムは L.rule / 言葉は L.term / 但し書きは L.guard へ
   ===================================================================== */
var RVIEW = (function () {
'use strict';

var RC, READ;
function bind(rc, read) { RC = rc; READ = read; }

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function chip(t) { return '<span class="chip c' + t + '">' + t + '</span>'; }
function row(k, v) { return '<div class="rrow"><i>' + k + '</i><b>' + v + '</b></div>'; }

/* =====================================================================
   裏（法則）の入れ物
   -------------------------------------------------------------------
   節ごとに1つ。中身は4種類:
     ev     根拠 — 命式のどの記号から出したか（断定ブロックから1タップで来る）
     rules  この節に走っている法則（アルゴリズム・採用した表・境界）
     terms  言葉の意味（表の散文に残った用語の説明）
     guards 但し書き（何を書かないと決めたか）
   =================================================================== */
function Laws() { this.map = {}; this.order = []; }
Laws.prototype.sec = function (id, title) {
  this.map[id] = { title: title, ev: [], rules: [], terms: [], guards: [] };
  this.order.push(id);
  return id;
};
Laws.prototype.ev = function (id, html) {          /* 根拠を1件足して通し番号を返す */
  this.map[id].ev.push(html); return this.map[id].ev.length;
};
Laws.prototype.rule  = function (id, k, v) { this.map[id].rules.push([k, v]); };
Laws.prototype.term  = function (id, k, v) { this.map[id].terms.push([k, v]); };
Laws.prototype.guard = function (id, html) { this.map[id].guards.push(html); };
Laws.prototype.build = function () {
  var out = {}, self = this;
  this.order.forEach(function (id) {
    var L = self.map[id], s = '';
    if (L.ev.length) {
      s += '<h5>この節の根拠 — 命式のどの記号から出したか</h5>';
      L.ev.forEach(function (e, i) {
        s += '<div class="ev" data-ev="' + (i + 1) + '">' + e + '</div>';
      });
    }
    if (L.rules.length) {
      s += '<h5>この節に走っている法則</h5>';
      L.rules.forEach(function (r) { s += '<div class="lrow"><i>' + r[0] + '</i><b>' + r[1] + '</b></div>'; });
    }
    if (L.terms.length) {
      s += '<h5>言葉の意味</h5>';
      L.terms.forEach(function (r) { s += '<div class="lrow"><i>' + r[0] + '</i><b>' + r[1] + '</b></div>'; });
    }
    if (L.guards.length) {
      s += '<h5>但し書き</h5>';
      L.guards.forEach(function (g) { s += '<div class="guard">' + g + '</div>'; });
    }
    out[id] = { title: L.title, html: s };
  });
  return out;
};

/* 表に置くチップ。見た目とラベルは全部これ1種類にそろえる。 */
function lawChip(id, n) {
  return '<button type="button" class="law" data-law="' + id + '"'
       + (n ? ' data-ev="' + n + '"' : '') + '>法則</button>';
}
/* 節の見出し。どの節にも必ずチップが1つ付く。 */
function sec(title, subtitle, id) {
  return '<div class="rsec"><h3>' + title + ' <span>' + subtitle + '</span>' + lawChip(id) + '</h3>';
}

/* 断定の畳みかけ（短い文を改行で重ねる） */
function beat(words) {
  var s = '<div class="beat">';
  for (var i = 0; i < words.length; i++) s += '<span>' + esc(words[i]) + '。</span>';
  return s + '</div>';
}
function say(t) { return '<div class="say">' + t + '</div>'; }

/* 1つの読みブロック。
   根拠（src）は裏へ入れ、ブロックには根拠へ1タップで行くチップを必ず付ける。
   src なしでは作れないので、根拠を持たない断定は構造上ありえない。 */
function rd(L, id, src, says, turn) {
  var n = L.ev(id, src);
  var s = '<div class="rd">';
  for (var i = 0; i < says.length; i++) s += says[i];
  if (turn) {
    var t = (typeof turn === 'string') ? [turn] : turn;
    for (var j = 0; j < t.length; j++) s += '<div class="turn">' + t[j] + '</div>';
  }
  s += '<div class="lawrow"><u>この断定の根拠</u>' + lawChip(id, n) + '</div>';
  return s + '</div>';
}

/* 面の見え方を記録する枠。断定した節ごとに1つ置く。
   読みの当否を採点するのではなく、いま見ている面に出ているかを本人が残す。 */
function faceBox(statusStore, id, question) {
  var st = statusStore[id] || 'untested';
  var s = '<div class="face" data-h="' + esc(id) + '">'
        + '<div class="fq"><u>この面に出ているかを見る問い</u>' + esc(question) + '</div>'
        + '<div class="stat">';
  RC.STATUS.forEach(function (x) {
    s += '<button data-s="' + x.key + '"' + (st === x.key ? ' class="on"' : '') + '>' + x.label + '</button>';
  });
  return s + '</div></div>';
}

function render(R, inp, statusStore) {
  var P = R.pillars, A = R.analysis, S = R.sanmei, K = R.shukuyo, cal = R.calendar, X = R.structure;
  var st = RC.STEM10[P.dmName];
  var H = [];
  var faceIds = [];
  var L = new Laws();
  function face(id, q) { faceIds.push(id); return faceBox(statusStore, id, q); }

  var subText =
    inp.y + '年' + inp.m + '月' + inp.d + '日' + (inp.hasTime ? ' ' + pad(inp.hh) + ':' + pad(inp.mi) : '（時刻なし）');

  /* =================== 冒頭：この読みの立て方 =================== */
  L.sec('law.stance', 'この読みの立て方');
  L.rule('law.stance', '主従', '<b>法則が主です。</b>'
    + '生年月日・暦記号・星の配置は、法則が現れた一つの面（<b>従</b>）。'
    + 'あなたの生活・履歴・環境・選択・行動も、法則が展開したもう一つの面（<b>従</b>）。'
    + 'この読みは、法則を星の配置に照らして、生活の側に何が展開しているかを読み解くものです。'
    + 'だから断定で書きます。');
  L.rule('law.stance', '断定してよい範囲',
    '断定してよいのは、命式に出た記号と、採用した象意・生剋の関係から導けることだけです。'
    + '導けないことは書かず、最後の「見えていない部分」に置いてあります。'
    + RC.NOTES.faceLead);
  L.rule('law.stance', '食い違ったとき',
    '読みと実際の出来事が食い違って見えるときは、法則が外れたのではなく、'
    + '展開が別の面に出ているか、まだその面が見えていないと考えます。'
    + 'どの面に出ているかは、あなたが実際の出来事で確かめるほかありません。'
    + '当たり外れを数値にすることはしません。');
  L.rule('law.stance', '表と裏の分け方',
    '表には読み解きの文章だけを置いています。'
    + 'その裏に走っている法則（どの表を使い、どこで区切り、何から何を導いたか）は、'
    + '各節の見出しの脇にある「法則」から開きます。'
    + '断定ブロックの下の「法則」を押すと、その断定を支えている記号がそのまま出ます。');
  Object.keys(RC.TAGS).forEach(function (t) {
    L.term('law.stance', chip(t), RC.TAGS[t].desc);
  });
  H.push('<div class="fireline">この読みの立て方は' + lawChip('law.stance')
    + '<span class="hint">タップで表示</span></div>');

  /* =================== 1. 基本命式 =================== */
  L.sec('law.meishiki', '1. 基本命式の法則');
  H.push(sec('1. 基本命式', '解釈の前に固定したもの', 'law.meishiki'));
  H.push('<div class="pill">');
  P.pillars.forEach(function (p) {
    H.push('<div><u>' + p.name + '</u><s>' + p.gz + '</s><em>' + p.stemElem + '／' + p.branchElem
      + (p.name === '日柱' ? '<br>この人自身' : '') + '</em></div>');
  });
  if (!inp.hasTime) H.push('<div><u>時柱</u><s>不明</s><em>出生時刻の入力が<br>ないため算出せず</em></div>');
  H.push('</div>');
  H.push('<p class="lead">生まれた年・月・日（と、分かれば時刻）を、'
    + 'それぞれ二文字の組み合わせに置き換えたものです。'
    + 'これから先の読み解きは、すべてこの四つの組み合わせから出しています。</p>');
  if (!inp.hasTime) {
    H.push('<p class="lead">出生時刻が不明なので、<b>時柱は出していません</b>。'
      + '正午などで埋めた推測値も作っていません。時柱から読める部分は、この読みには入っていません。</p>');
  }

  L.ev('law.meishiki', chip('計算') + '各柱の干支と、天干／地支の五行、日主から見た十神：'
    + P.pillars.map(function (p) {
        return p.name + ' ' + p.gz + '（' + p.stemElem + '／' + p.branchElem + '・'
          + (p.name === '日柱' ? '日主' : p.tenGodStem) + '）';
      }).join('／')
    + (inp.hasTime ? '' : '／時柱は出生時刻の入力がないため算出せず')
    + '。日主は' + P.dmName + '（' + P.dmYin + P.dmElem + '）。');
  L.ev('law.meishiki', chip('計算') + '生まれた日の暦の位置：'
    + '節気・候は' + cal.sekki.name + '／第' + cal.kou.no + '候 ' + cal.kou.kanji
    + '（' + cal.kou.yomi + '）。旧暦は' + (cal.lunar.leap ? '閏' : '') + cal.lunar.month + '月'
    + cal.lunar.day + '日。月相は' + cal.moon.name + '（月齢' + cal.moon.age.toFixed(1) + '日）。'
    + '50音歴は第' + cal.gojuon.no + '音「' + cal.gojuon.sound + '」。');
  L.ev('law.meishiki', chip('計算') + '入力：生年月日 ' + esc(inp.y + '-' + pad(inp.m) + '-' + pad(inp.d))
    + '／出生時刻 ' + (inp.hasTime ? esc(pad(inp.hh) + ':' + pad(inp.mi)) : '不明')
    + '／出生地 ' + (inp.place ? esc(inp.place) : '不明')
    + '／呼称・性別など ' + (inp.gender ? esc(inp.gender) : '未入力') + '。');

  L.rule('law.meishiki', '柱の対応',
    ['年柱', '月柱', '日柱', '時柱'].map(function (n) { return n + '＝' + RC.PILLAR_ROLE[n]; }).join('')
    + '年齢区分の年数は流派差が大きいため出していません。');
  L.rule('law.meishiki', '採用した流派・表・境界',
    '解釈より先に、次のものを固定しています。');
  R.conventions.forEach(function (c) { L.rule('law.meishiki', c[0], esc(c[1])); });
  L.term('law.meishiki', '干支（かんし）',
    '十干（甲乙丙丁戊己庚辛壬癸）と十二支（子丑寅卯辰巳午未申酉戌亥）を組み合わせた二文字。'
    + '60通りで一巡します。上の一文字目を天干、二文字目を地支と呼びます。');
  L.term('law.meishiki', '日主（にっしゅ）',
    '日柱の一文字目（生まれた日の十干）。この読みでは、その人の芯として扱います。'
    + '表では「この人自身」と書いてある柱の上の字がこれにあたります。');
  L.term('law.meishiki', '五行（ごぎょう）',
    '木・火・土・金・水の五つ。十干と十二支のそれぞれに、どれか一つが割り当てられています。'
    + '表の柱に「金／水」と出ているのは、天干が金、地支が水という意味です。');
  L.term('law.meishiki', '十神（じっしん）',
    '日主から見た他の干の関係につけた名前（比肩・劫財・食神・傷官・偏財・正財・偏官・正官・偏印・正印）。'
    + '算命学の十大主星は、これを別の名で呼んだものです。');
  L.term('law.meishiki', '呼称・性別など',
    '呼称と、本人が確認する文脈の質問にのみ使用。性格・能力・役割・運勢の算出には使っていません。');
  H.push('</div>');

  /* =================== 2. 四柱推命で見る本質 =================== */
  L.sec('law.shichu', '2. 四柱推命で見る本質の法則');
  H.push(sec('2. 四柱推命で見る本質', '生まれた日の字・生まれた月・重なり', 'law.shichu'));

  /* 日主 */
  H.push(rd(L, 'law.shichu',
    chip('伝統') + '日干は' + P.dmName + '。' + P.dmYin + 'の' + P.dmElem + '。象意は「' + st.metaphor + '」。',
    [ say('本質は、<em>' + st.metaphor + '</em>のような人です。'),
      say(st.core + '。'),
      say(st.logic),
      beat(st.verbs),
      say(RC.YINYANG[P.dmYin]) ],
    [ st.challenge + 'この人の本質は、<em>' + st.essence + '</em>です。',
      st.contrast ]));

  /* 月令 */
  H.push(rd(L, 'law.shichu',
    chip('計算') + '月支は' + X.monthBranch + '。' + X.monthElem + '。日主は' + X.dmElem + '。'
      + '月令に対する位置は「' + X.command + '」。',
    [ say(RC.COMMAND_PLAIN[X.command]),
      say(RC.COMMAND_MEAN[X.command]) ]));

  /* 支の重なり */
  if (X.repeats.length) {
    X.repeats.forEach(function (r) {
      var rel = READ.relOf(READ.ELEM.indexOf(X.dmElem), READ.ELEM.indexOf(r.elem));
      H.push(rd(L, 'law.shichu',
        chip('計算') + '地支に' + r.branch + 'が' + r.n + 'つ。' + r.branch + 'は' + r.yin + 'の' + r.elem
          + '（蔵干 ' + r.hidden.join('・') + '）。' + r.elem + 'は日主から見て' + RC.REL_NAME[rel] + '。',
        [ say('同じ字が重なるほど、その働きは分散せず一方向に出ます。'
            + 'この人で重なっているのは、' + RC.ELEM_WORK[r.elem] + 'です。'),
          say('厚さが何を生むかは、次の節でまとめて見ます。') ]));
    });
  } else {
    H.push(rd(L, 'law.shichu', chip('計算') + '四つの柱の下の字に、同じ字の重なりはありません。',
      [ say('働きは一方向に集まらず、それぞれ別の方向を向いています。'
          + '厚みで押すのではなく、面の広さで対応する作りです。') ]));
  }

  /* 日柱 */
  H.push(rd(L, 'law.shichu',
    chip('計算') + '日柱は' + X.day.gz + '。日支' + X.day.branch + 'の蔵干の本気は' + X.day.hiddenMain
      + 'で、日主から見て' + X.day.tenGodMain + '。十二運は' + X.day.stage + '。',
    [ say('生まれた日の柱は、その人自身を表す柱です。その足元に置いているのが'
        + X.day.tenGodMain + 'の働き。' + RC.TENGOD_MEAN[X.day.tenGodMain] + 'この働きの上に立っています。'),
      say('周期のどこにいるかで言えば「' + X.day.stage + '」の位置です。' + RC.STAGE_MEAN[X.day.stage]) ]));

  L.rule('law.shichu', '日主の決め方',
    '日柱の天干（生まれた日の十干）を、その人の芯として扱います。'
    + '年柱でも月柱でもなく、日柱の上の字です。');
  L.rule('law.shichu', '十干の象意',
    '日主に決まった比喩を当てます。'
    + '甲＝大樹／乙＝草花・蔓／丙＝太陽／丁＝灯火・炉の火／戊＝山・堤／'
    + '己＝田畑／庚＝原石・鉄／辛＝宝石・刃物・精密金属／壬＝大河・海／癸＝雨露・霧。'
    + '滴天髄・窮通宝鑑の系統で広く使われる比喩を採用しています。'
    + '比喩から先の言い換えはこの読みの表現であって、原典の文言ではありません。');
  L.rule('law.shichu', '陰陽',
    '十干は陽（甲丙戊庚壬）と陰（乙丁己辛癸）に分かれます。'
    + RC.YINYANG['陽'] + RC.YINYANG['陰']
    + 'この人の日主' + P.dmName + 'は' + P.dmYin + '干です。');
  L.rule('law.shichu', '月令に対する位置',
    '生まれ月の地支の五行（月令）と、日主の五行の関係で、旺・相・休・囚・死のどれか一つに決まります。'
    + '当令者旺（同じ五行）・令生者相（月令が日主を生む）・生令者休（日主が月令を生む）・'
    + '剋令者囚（日主が月令を剋す）・令剋者死（月令が日主を剋す）。'
    + 'この人は' + X.monthElem + '月の' + X.dmElem + '日主なので「' + X.command + '」になります。');
  L.rule('law.shichu', '重なりの数え方',
    '四つの柱の地支に同じ字が2つ以上あれば、重なりとして数えます。'
    + '重なった字の五行の働きが、分散せず一方向に出ると読みます。');
  L.rule('law.shichu', '日柱の読み方',
    '日支（日柱の下の字）の蔵干のうち本気を取り、日主から見た十神を出します。'
    + 'あわせて日主から見た十二運（周期上の位置）を出します。');
  L.term('law.shichu', '月令（げつれい）', '生まれた月の地支が持つ五行のこと。生まれた季節の気にあたります。');
  L.term('law.shichu', '蔵干（ぞうかん）',
    '地支の中に隠れているとされる十干。本気・中気・余気の三分表を採用しています。'
    + '本気はそのうち中心にあたるものです。');
  L.term('law.shichu', '十二運（じゅうにうん）',
    '胎・養・長生・沐浴・冠帯・建禄・帝旺・衰・病・死・墓・絶の十二段階。'
    + '周期のどこにいるかを表す位置の名前です。');
  L.guard('law.shichu', RC.NOTES.commandGuard
    + 'ここから身強・身弱を断定することはしていません。数え方が流派で違うためです。');
  L.guard('law.shichu', RC.NOTES.stageGuard);
  H.push(face('face.shichu', RC.SECTION_CHECK.shichu));
  H.push('</div>');

  /* =================== 3. 五行の偏り =================== */
  L.sec('law.gogyo', '3. 五行の偏りの法則');
  H.push(sec('3. 五行の偏り', '何が厚く、何が無いか', 'law.gogyo'));

  H.push(rd(L, 'law.gogyo',
    chip('計算') + '五行の記号数は '
      + A.elems.map(function (e) { return e.elem + e.count; }).join('　') + '。'
      + X.heaviest.elem + 'が' + X.heaviest.count + 'つで、この命式でいちばん多い。'
      + X.heaviest.elem + 'は日主' + X.dmElem + 'から見て' + RC.REL_NAME[X.heaviest.rel] + '。',
    [ say('この人にいちばん厚く出ているのは、' + RC.ELEM_WORK[X.heaviest.elem] + 'です。'),
      say(RC.HEAVY[X.heaviest.rel]) ]));

  if (X.lacking.length) {
    X.lacking.forEach(function (Lk) {
      var d = RC.LACK[X.dmElem][Lk.rel];
      H.push(rd(L, 'law.gogyo',
        chip('計算') + Lk.elem + 'が命式に一つも現れません。'
          + Lk.elem + 'は日主' + X.dmElem + 'から見て' + RC.REL_NAME[Lk.rel] + '。',
        [ say('この人に一つも出ていないのは、' + RC.ELEM_WORK[Lk.elem] + 'です。'),
          say(d.effect) ]));
    });
    H.push('<p class="lead">欠けている働きは、欠陥ではありません。方向です。'
      + '無い働きは内側で自動化されないので、外から入れる形になります。'
      + '何が入るとどう変わるかは、7節にまとめてあります。</p>');
  } else {
    H.push(rd(L, 'law.gogyo', chip('計算') + '五行はすべて現れています。欠けている方向はありません。',
      [ say('どの働きも出ています。だから足りないものを外から補うより、'
          + '厚い方向と薄い方向の配分をどう置くかが、この人の課題になります。') ]));
  }

  L.rule('law.gogyo', '五行の数え方', RC.NOTES.gogyoRule);
  L.rule('law.gogyo', '五行の関係',
    '相生（木生火・火生土・土生金・金生水・水生木）と、'
    + '相剋（木剋土・土剋水・水剋火・火剋金・金剋木）だけを使います。'
    + '日主から見た呼び名は次のとおり。'
    + Object.keys(RC.REL_NAME).map(function (k) { return k + '＝' + RC.REL_NAME[k]; }).join('／') + '。');
  L.rule('law.gogyo', '厚い五行の読み方',
    'いちばん多く現れた五行が、日主に対してどの関係かで、厚さの意味が変わります。'
    + Object.keys(RC.HEAVY).map(function (k) { return '【' + k + '】' + RC.HEAVY[k]; }).join(''));
  L.rule('law.gogyo', '欠けた五行の読み方',
    '［日主の五行］×［欠けた五行の日主に対する関係］の 5×4＝20 通りの表から出しています。'
    + 'この人は日主が' + X.dmElem + 'なので、'
    + (X.lacking.length
        ? X.lacking.map(function (Lk) { return Lk.elem + '（' + RC.REL_NAME[Lk.rel] + '）'; }).join('と')
          + 'の行を使いました。'
        : '欠けた五行がないため、この表は使っていません。'));
  L.rule('law.gogyo', '五行が担う働き',
    Object.keys(RC.ELEM_WORK).map(function (k) { return k + '＝' + RC.ELEM_WORK[k]; }).join('／') + '。');
  L.term('law.gogyo', '記号数',
    '四つの柱それぞれの天干と地支に割り当てられた五行を、一つずつ数えた個数です。'
    + '時柱が無ければ、その分だけ合計が減ります。');
  L.guard('law.gogyo', RC.NOTES.noYojin);
  L.guard('law.gogyo', 'この数は、命式というモデルの中に記号がいくつ現れたかであって、'
    + '性格の強さの数値ではありません。多いほど良い・少ないほど悪いという読み方はしていません。');
  H.push(face('face.gogyo', RC.SECTION_CHECK.gogyo));
  H.push('</div>');

  /* =================== 4. 算命学で見る本質 =================== */
  L.sec('law.sanmei', '4. 算命学で見る本質の法則');
  H.push(sec('4. 算命学で見る本質', '十大主星・十二大従星', 'law.sanmei'));
  H.push(rd(L, 'law.sanmei',
    chip('伝統') + '十大主星の写像：'
      + S.stars.map(function (s) { return s.src + '（' + s.tenGod + '）→ ' + s.star; }).join('／'),
    X.stars.map(function (s) {
      var m = RC.JUDAI_MEAN[s.star];
      return say('<em>' + s.star + '</em>。' + m.line
        + (s.n >= 2 ? s.star + 'は' + s.n + 'つ。この働きが重なって出ています。' : ''));
    })));
  /* 同じ星が複数の柱に出ることがあるので、どの柱のものかを平易な言葉で添える
     （柱名そのものではなく、柱が受け持つ面の呼び方で書く） */
  var juSays = S.jusei.map(function (j) {
    var pillar = j.src.split(' ')[0];
    var plain = (RC.PILLAR_ROLE[pillar] || '').split('。')[0];
    return say('<em>' + j.star + '</em>（' + plain + '）。' + RC.JUJUSEI_MEAN[j.star]);
  });
  /* 本人の柱（日柱）と、それ以外の柱で従星が違うときは、そこが対比になる */
  var dayJu = S.jusei[2].star, outerJu = [];
  S.jusei.forEach(function (j, i) {
    if (i !== 2 && outerJu.indexOf(j.star) < 0) outerJu.push(j.star);
  });
  if (outerJu.indexOf(dayJu) < 0) {
    juSays.push(say('外側の柱は' + outerJu.join('と') + '。本人の柱は' + dayJu + '。'
      + '外側と本人が、周期の別の位置に置かれています。'));
  }
  H.push(rd(L, 'law.sanmei',
    chip('伝統') + '十二大従星の写像：'
      + S.jusei.map(function (j) { return j.src + '（' + j.stage + '）→ ' + j.star; }).join('／'),
    juSays));
  H.push('<div class="warn"><b>人体星図の配置は出していません。</b>'
    + '頭・胸・腹・左手・右手・肩・足のどこにどの星が入るかという配置表は、'
    + '流派ごとに違い、確信をもって固定できませんでした。'
    + '推測で埋めると、誤った構造を事実として出すことになります。'
    + '<b>この節でここだけは断定していません。</b>星そのものは上に出しています。</div>');

  L.rule('law.sanmei', '十大主星の出し方',
    '四柱推命の十神を、算命学の名前に置き換えたものです。'
    + Object.keys(RC.JUDAI_MEAN).map(function (k) { return RC.JUDAI_MEAN[k].from + '＝' + k; }).join('／')
    + '。星の意味も、写像元の十神から導いています。');
  L.rule('law.sanmei', '十二大従星の出し方',
    '四柱推命の十二運を、算命学の名前に置き換えたものです。'
    + '胎＝天報星／養＝天印星／長生＝天貴星／沐浴＝天恍星／冠帯＝天南星／建禄＝天禄星／'
    + '帝旺＝天将星／衰＝天堂星／病＝天胡星／死＝天極星／墓＝天庫星／絶＝天馳星。');
  L.term('law.sanmei', '十大主星', '人との関わり方・力の出し方を表す十種類の星。');
  L.term('law.sanmei', '十二大従星', '周期のどこにいるかを表す十二種類の星。');
  L.guard('law.sanmei', '算命学の星は、四柱推命の十神・十二運を別の名で呼んだものです。'
    + '同じ命式を二度数えないよう、四柱推命と独立した根拠としては扱っていません。');
  L.guard('law.sanmei', '十二大従星のエネルギーの点数は出していません。'
    + 'この読みでは、点数・スコアの類を一切出さないためです。');
  L.guard('law.sanmei', RC.NOTES.stageGuard);
  H.push(face('face.sanmei', RC.SECTION_CHECK.sanmei));
  H.push('</div>');

  /* =================== 5. 天中殺 =================== */
  L.sec('law.tenchu', '5. 天中殺の法則');
  H.push(sec('5. 天中殺', '算術の事実と、そこから言えること', 'law.tenchu'));
  H.push(rd(L, 'law.tenchu',
    chip('計算') + '日柱' + X.day.gz + 'は' + S.dayTenchusatsu.junStart + 'の旬。'
      + '十干10と十二支12の差で、一旬に必ず二支が余る。この命式では'
      + X.tcs.branches.join('と') + '（' + X.tcs.elems.join('・') + '）。'
      + '年柱では' + S.yearTenchusatsu.name + '。'
      + '命式の五行の数は ' + A.elems.map(function (e) { return e.elem + e.count; }).join('　') + '。',
    [ say('十干は10、十二支は12。10ずつ区切っていくと、12のうち2つが必ず余ります。'
        + 'その余った2つを天中殺と呼びます。ここまでは算術です。'),
      say('この人で余るのは' + X.tcs.branches.join('と') + '。指しているのは'
        + X.tcs.elems.map(function (e) { return RC.ELEM_SHORT[e]; }).join('と') + 'の方向です。'),
      say(RC.TCS_OVERLAP[X.tcs.overlap]) ]));

  L.rule('law.tenchu', '天中殺の出し方',
    '六十干支を十干の10ずつで区切ると、六つの旬（甲子・甲戌・甲申・甲午・甲辰・甲寅の各旬）に分かれます。'
    + '各旬では十二支のうち二支が現れません。それが天中殺の二支です。'
    + '日柱の属する旬から出したものと、年柱の属する旬から出したものを、それぞれ出しています。');
  L.rule('law.tenchu', '算術どうしの重ね合わせ',
    '余る二支が指す五行と、命式に現れた五行の数を突き合わせます。'
    + '両方とも算術なので、ここは解釈ではありません。'
    + '一つも現れていなければ「同じ方向を指している」、'
    + 'いちばん多い五行と同じなら「力が出る場所であり入れすぎが起きる場所」と読みます。');
  L.term('law.tenchu', '旬（じゅん）', '六十干支を十干の10ずつで区切った一区切りのこと。');
  L.guard('law.tenchu', RC.NOTES.tcsGuard);
  H.push(face('face.tenchu', RC.SECTION_CHECK.tenchu));
  H.push('</div>');

  /* =================== 6. 宿曜道で見る本質 =================== */
  L.sec('law.shukuyo', '6. 宿曜道の法則');
  H.push(sec('6. 宿曜道で見る本質', '生まれた日が、月のどこにあたるか', 'law.shukuyo'));
  H.push(row('本命宿', '<b class="big">' + K.name + '</b>'));
  H.push(rd(L, 'law.shukuyo',
    chip('計算') + '旧暦' + K.lunarMonth + '月' + K.lunarDay + '日。'
      + '朔日宿は' + K.sakujitsu + '。生まれた日の月相は' + cal.moon.name
      + '（月齢' + cal.moon.age.toFixed(1) + '日）。'
      + esc(K.formula) + (K.leapNote ? esc(K.leapNote) : ''),
    [ say('本命宿は、旧暦の日付から一つに決まります。'
        + '新月から数えて' + K.lunarDay + '日目という位置を、27の区画に写したものが' + K.name + 'です。'),
      say('本命宿も月の満ち欠けも、新月からの経過を表しています。'
        + '独立した二つの根拠ではありません。ここを重ねて数えることはしません。') ]));
  H.push('<div class="warn"><b>宿から人物像は出していません。</b>'
    + RC.NOTES.shukuLimit
    + '<br><br>三九の関係表（宿番号の差から関係名を出す並び）も、並びに流派差があるため'
    + '<b>使っていません</b>。相手の生年月日が要ることもあり、単独の読みには含めていません。</div>');

  L.rule('law.shukuyo', '採用方式', '伝統暦方式を正とします。'
    + '本命宿 =（旧暦月の朔日宿 + 旧暦日 − 1）mod 27。'
    + '朔日宿表は 1月=室 2月=奎 3月=胃 4月=畢 5月=参 6月=鬼 7月=張 8月=角 9月=氐 10月=心 11月=斗 12月=虚。'
    + '閏月は直前の通常月と同じ朔日宿を使います（閏6月なら6月の朔日宿＝鬼）。');
  L.rule('law.shukuyo', '27宿の並び',
    '昴 畢 觜 参 井 鬼 柳 星 張 翼 軫 角 亢 氐 房 心 尾 箕 斗 女 虚 危 室 壁 奎 婁 胃。');
  L.rule('law.shukuyo', '（比較資料）天文方式',
    'この人の場合は' + K.astro.name + '（月の恒星黄経 ' + K.astro.sidLon.toFixed(2) + '°／ラヒリのアヤナムシャ）。'
    + (K.agrees ? '伝統暦方式とたまたま一致しました。' : '伝統暦方式とは<b>異なります</b>。')
    + '両者は別のモデルなので一致するとは限りません。'
    + '宿曜道としては伝統暦方式を正とし、天文方式は比較のためだけに出しています。混ぜて使っていません。');
  L.term('law.shukuyo', '朔日宿（さくじつしゅく）', '旧暦のその月の1日に割り当てられた宿。ここから日数を足していきます。');
  L.term('law.shukuyo', '本命宿（ほんみょうしゅく）', '生まれた日が当たる宿。二十七宿のうちの一つ。');
  L.guard('law.shukuyo', '本命宿は、新月から数えて何日目かを27区画に写したものです。'
    + '月の満ち欠けの言い換えであって、別の根拠ではありません。重ねて数えていません。');
  L.guard('law.shukuyo', RC.NOTES.shukuLimit);
  H.push('</div>');

  /* =================== 7. 真理構造からの統合 =================== */
  L.sec('law.togo', '7. 統合の法則');
  H.push(sec('7. 真理構造からの統合', '三つの見方を、一つの流れとして読む', 'law.togo'));
  var togo = [
    say('この人は<em>' + st.metaphor + '</em>のような人です。' + st.core + '。'),
    say('いちばん厚いのは' + RC.ELEM_WORK[X.heaviest.elem] + '。'
      + st.verbs.slice(0, 3).join('・') + 'という働きを、その厚さがそのまま支えています。')
  ];
  if (X.lacking.length) {
    togo.push(say('そして'
      + X.lacking.map(function (Lk) { return RC.ELEM_SHORT[Lk.elem]; }).join('と')
      + 'が、この人には出てきません。'));
    X.lacking.forEach(function (Lk) {
      togo.push(say(RC.LACK[X.dmElem][Lk.rel].supply));
    });
    if (X.tcs.overlap === 'lack') {
      togo.push(say('天中殺で余る二つの字も、同じ方向を指しています。'
        + '持っていない働きと、旬の中で欠ける字が、一つの方向に揃っている構造です。'));
    }
  }
  togo.push(say('つまりこの人は、' + st.verbs.slice(0, 2).join('・') + 'という働きで立っていて、'
    + '<em>' + st.essence + '</em>——そこへ向かうかどうかが分かれ目になります。'));
  H.push(rd(L, 'law.togo',
    chip('読み') + '2〜6節で出した記号を、一つの流れとして並べたもの。'
      + '日主' + P.dmName + '（' + P.dmElem + '）／いちばん厚いのは' + X.heaviest.elem
      + '／欠けているのは' + (X.lacking.length
          ? X.lacking.map(function (Lk) { return Lk.elem; }).join('と') : 'なし')
      + '／天中殺の二支は' + X.tcs.branches.join('と') + '。',
    togo));

  L.rule('law.togo', '足し合わせない',
    '四柱推命・算命学・宿曜道は別々のモデルです。結果をそのまま合算しません。'
    + 'ここでは、同じ命式が三つの言い方でどう見えるかを並べ、一つの流れとして読みます。'
    + '流派をまたいだ一致は「象徴が重なった」というだけで、科学的な裏づけではありません。');
  L.rule('law.togo', '二重に数えない',
    '算命学の星は、四柱推命の十神を別の名で呼んだものです。'
    + '同じ命式を二度数えないよう、ここでは独立した根拠として扱っていません。'
    + '宿曜道の本命宿も、旧暦の日付から出るもので、四柱とは別の暦を見ています。');
  L.rule('law.togo', '欠けた働きの補い方',
    '欠けた五行ごとに、何が入るとどう変わるかを 5×4 の表から出しています。'
    + '「この五行が吉」という言い方はしていません。相生相剋の関係そのものから言えることだけです。');
  L.guard('law.togo', RC.NOTES.dualNote);
  H.push(face('face.togo', RC.SECTION_CHECK.togo));
  H.push('</div>');

  /* =================== 8. 向いている場・役割 =================== */
  L.sec('law.ba', '8. 場・役割の法則');
  H.push(sec('8. 向いている場・役割', '職業名ではなく、場の条件', 'law.ba'));
  var baSays = [ say(RC.ELEM_WORK[X.dmElem] + 'が要る場で働きます。'
    + 'それが要らない場に置かれると、同じ力が使い道を失います。') ];
  var topAxis = A.axesRanked[0];
  if (RC.BA_AXIS[topAxis.axis]) {
    baSays.push(say(RC.BA_AXIS[topAxis.axis].many));
  }
  A.axes.forEach(function (a) {
    if (a.count === 0 && RC.BA_AXIS[a.axis]) {
      baSays.push(say(RC.BA_AXIS[a.axis].none));
    }
  });
  H.push(rd(L, 'law.ba', chip('読み') + '五軸の個数は '
    + A.axes.map(function (a) { return a.axis + a.count; }).join('　') + '。日主は' + P.dmName + '。'
    + 'いちばん多いのは' + topAxis.axis + '（' + topAxis.count + '個）。',
    baSays));

  L.rule('law.ba', '五軸の数え方',
    '命式に現れた十神を、日主から見た関係で五つの軸（同類・生我・我生・我剋・剋我）にまとめ、'
    + 'それぞれの個数を数えます。いちばん多い軸と、一つも無い軸から、場の条件を出しています。');
  L.rule('law.ba', '五軸ごとの条件',
    Object.keys(RC.BA_AXIS).map(function (k) {
      return '【' + k + '・多い】' + RC.BA_AXIS[k].many + '【' + k + '・無い】' + RC.BA_AXIS[k].none;
    }).join(''));
  L.term('law.ba', '五軸',
    '同類＝日主と同じ五行／生我＝日主を生む五行／我生＝日主が生む五行／'
    + '我剋＝日主が動かす五行／剋我＝日主を締める五行。');
  L.guard('law.ba', RC.NOTES.noJob);
  H.push(face('face.ba', RC.SECTION_CHECK.ba));
  H.push('</div>');

  /* =================== 9. 一言でまとめると =================== */
  L.sec('law.hitokoto', '9. まとめ方の法則');
  H.push(sec('9. 一言でまとめると', '', 'law.hitokoto'));
  H.push('<div class="one">');
  H.push('<p>' + st.metaphor + 'のような人。' + st.core + '。</p>');
  H.push('<p>本質は、' + st.essence + '。</p>');
  if (X.lacking.length) {
    H.push('<p>そのために要るのは、'
      + X.lacking.map(function (Lk) { return RC.ELEM_SHORT[Lk.elem]; }).join('と')
      + '。それは外から入れるものです。</p>');
  } else {
    H.push('<p>要るものは、すでにそろっています。'
      + 'あとは、どこにどれだけ配るかです。</p>');
  }
  H.push('</div>');
  H.push('<div class="warn" style="margin-top:12px">「魂の目的」「使命」「前世」は生年月日から'
    + '確定できる種類の事柄ではありません。以下は<b>あなたが選べる中心課題の候補</b>を'
    + '問いの形にしたものです。選んで、継続した行動で意味を与えたテーマだけが、'
    + 'あなたの目的になります。</div>');
  A.axesRanked.slice(0, 2).forEach(function (a) {
    if (RC.PURPOSE_QUESTIONS[a.axis]) {
      H.push('<div class="rlead"><p>' + esc(RC.PURPOSE_QUESTIONS[a.axis]) + '</p></div>');
    }
  });
  L.rule('law.hitokoto', 'まとめの組み立て',
    '日主の象意（' + st.metaphor + '）と、その芯（' + st.core + '）、'
    + '課題の先にある本質（' + st.essence + '）を並べたものです。'
    + '新しいことは足していません。2〜7節で出したものを短くしただけです。');
  L.rule('law.hitokoto', '中心課題の候補の出し方',
    '五軸のうち個数の多い順に2つを取り、その軸に対応する問いを出しています。'
    + '事実としてではなく、あなたが選べる候補としてのみ出します。'
    + '五軸それぞれの問いは次のとおり。'
    + Object.keys(RC.PURPOSE_QUESTIONS).map(function (k) {
        return '【' + k + '】' + esc(RC.PURPOSE_QUESTIONS[k]);
      }).join(''));
  L.guard('law.hitokoto', '「魂の目的」「使命」「前世」を断定することはしません。'
    + '生年月日から確定できる種類の事柄ではないためです。');
  H.push('</div>');

  /* =================== 10. 見えていない部分 =================== */
  L.sec('law.mienai', '10. 見えていない部分の法則');
  H.push(sec('10. 見えていない部分', '算出できないもの／記録の残し方', 'law.mienai'));
  R.fudo.forEach(function (f) {
    H.push(row(chip('不能') + esc(f.what), esc(f.why)));
  });
  H.push(row(chip('確認'), inp.self
    ? 'あなたが書いた「' + esc(inp.self.slice(0, 80)) + (inp.self.length > 80 ? '…' : '') + '」は、'
      + '上の読みと突き合わせる材料です。生活の面に出ていると見えたものを'
      + chip('確認') + 'に移してください。'
      + '<br><span class="sub">この記録はアプリではなくあなたが付けます。各節の状態ボタンで残せます。</span>'
    : 'まだありません。各節の状態ボタンで、どの面に出ているかを記録できます。'));
  H.push(row(chip('別面'), 'いま見ている面に出ていなかったものは、消さずに「別の面に出ている」として残してください。'
    + '<br><span class="sub">それは外れた記録ではなく、'
    + 'どこを探せばよいかが一つ分かった記録です。'
    + '同じ法則でも、現れる面が変われば形が変わります。'
    + 'ずれているのは法則ではなく、いまどの面を見ているかです。</span>'));
  /* 前の版で付けた記録を黙って消さない。表示できないものは、あることだけ伝える。 */
  var orphan = [];
  for (var ok in statusStore) {
    if (faceIds.indexOf(ok) < 0 && statusStore[ok] && statusStore[ok] !== 'untested') orphan.push(ok);
  }
  if (orphan.length) {
    H.push(row(chip('確認') + '前の版で付けた記録',
      orphan.length + '件あります。前の版は項目の区切り方が違ったため、この画面には出せません。'
      + '<br><span class="sub">消してはいません。端末の中にそのまま残しています。</span>'));
  }
  H.push('<p class="lead mt">'
    + 'この読みは、医療・法律・採用・信用・結婚などの判断には使えません。'
    + 'そうした判断へ誘導する内容も含めていません。'
    + '的中率・確率・スコアの類も出していません。</p>');

  L.rule('law.mienai', '[不能] に入れる決まり',
    '確信をもって固定できない表は、推測で埋めずに [不能] へ入れます。'
    + '流派ごとに記述が食い違うもの、入力が無いもの、生年月日から確定できない種類の事柄が対象です。'
    + '埋めてしまうと、誤った構造を事実として出すことになるためです。');
  L.rule('law.mienai', '記録の扱い',
    '各節の状態ボタンで付けた記録は、この端末の中だけに保存されます（保存は既定オフの選択制）。'
    + '前の版で付けた記録は、項目の区切り方が変わって画面に出せなくなっても消していません。'
    + '出せないものは件数だけをこの節に出しています。');
  Object.keys(RC.TAGS).forEach(function (t) {
    L.term('law.mienai', chip(t), RC.TAGS[t].desc);
  });
  L.guard('law.mienai', '的中率・確率・スコア・パーセンテージは出しません。'
    + '医療・法律・採用・信用・結婚などの判断へ誘導する内容も書きません。'
    + '死・病気・事故・犯罪・妊娠出産・離婚・財産についての予測もしません。');
  H.push('</div>');

  return { sub: subText, html: H.join(''), faceIds: faceIds, laws: L.build() };
}

return { bind: bind, render: render };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RVIEW;
