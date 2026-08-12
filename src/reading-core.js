/* =====================================================================
   生年月日サイクル読解 — 計算層
   -------------------------------------------------------------------
   指示書 birth-cycle-reflection に従う。この層は「再現可能な計算」と
   「採用流派の固定対応」だけを出す。解釈文は reading-content.js。

   守っている原則:
     ・本人の生命・履歴・環境・選択・行動が躰＝主。暦記号は用＝従
     ・生年月日から見えない本質・未来・魂の目的を断定しない
     ・確信をもって固定できない表は推測で埋めず fudo（[不能]）に入れる
     ・的中率・確率・スコアの類は一切出さない
   ===================================================================== */
var READ = (function () {
'use strict';

/* ---- 基本テーブル --------------------------------------------------- */
var STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var ELEM = ['木','火','土','金','水'];
var STEM_ELEM   = [0,0,1,1,2,2,3,3,4,4];   // 甲乙木 丙丁火 戊己土 庚辛金 壬癸水
var STEM_YIN    = [0,1,0,1,0,1,0,1,0,1];   // 0=陽 1=陰
var BRANCH_ELEM = [4,2,0,0,2,1,1,2,3,3,2,4]; // 子水丑土寅木卯木辰土巳火午火未土申金酉金戌土亥水
var BRANCH_YIN  = [0,1,0,1,0,1,0,1,0,1,0,1]; // 子寅辰午申戌=陽 丑卯巳未酉亥=陰

/* 蔵干表（本気・中気・余気の順）。採用表として明示する。 */
var HIDDEN = {
  '子':['癸'], '丑':['己','癸','辛'], '寅':['甲','丙','戊'], '卯':['乙'],
  '辰':['戊','乙','癸'], '巳':['丙','庚','戊'], '午':['丁','己'], '未':['己','丁','乙'],
  '申':['庚','壬','戊'], '酉':['辛'], '戌':['戊','辛','丁'], '亥':['壬','甲']
};

/* 十神 → 五軸（指示書4.2） */
var TENGOD_AXIS = {
  '比肩':'同類','劫財':'同類',
  '正印':'生我','偏印':'生我',
  '食神':'我生','傷官':'我生',
  '正財':'我剋','偏財':'我剋',
  '正官':'剋我','偏官':'剋我'
};
var AXES5 = ['同類','生我','我生','我剋','剋我'];
var AXIS_LABEL = {
  '同類':'自律（自立・同調・仲間との境界）',
  '生我':'受容（受け取る・学ぶ・意味づける）',
  '我生':'表出（表現・創造・伝達）',
  '我剋':'成果（資源を価値へ変える）',
  '剋我':'制約（規律・責任・外圧）'
};

/* 十大主星（高尾学館系の十神対応） */
var JUDAI = {
  '比肩':'貫索星','劫財':'石門星','食神':'鳳閣星','傷官':'調舒星',
  '偏財':'禄存星','正財':'司禄星','偏官':'車騎星','正官':'牽牛星',
  '偏印':'龍高星','正印':'玉堂星'
};
/* 十二運 → 十二大従星 */
var STAGES = ['長生','沐浴','冠帯','建禄','帝旺','衰','病','死','墓','絶','胎','養'];
var JUJUSEI = {
  '長生':'天貴星','沐浴':'天恍星','冠帯':'天南星','建禄':'天禄星','帝旺':'天将星',
  '衰':'天堂星','病':'天胡星','死':'天極星','墓':'天庫星','絶':'天馳星',
  '胎':'天報星','養':'天印星'
};
/* 十二運の長生位と巡行方向（陽干＝順行、陰干＝逆行） */
var CHOSEI = {
  '甲':['亥',1], '乙':['午',-1], '丙':['寅',1], '丁':['酉',-1], '戊':['寅',1],
  '己':['酉',-1], '庚':['巳',1], '辛':['子',-1], '壬':['申',1], '癸':['卯',-1]
};
/* 十二運を「周期のどこか」の3群へ（中立軸「周期位置」用） */
var STAGE_PHASE = {
  '胎':'始','養':'始','長生':'始','沐浴':'始',
  '冠帯':'盛','建禄':'盛','帝旺':'盛',
  '衰':'収','病':'収','死':'収','墓':'収','絶':'収'
};

/* 二十七宿（宿曜経の並び。昴宿を起点とする） */
var SHUKU27 = ['昴','畢','觜','参','井','鬼','柳','星','張','翼','軫','角','亢','氐',
               '房','心','尾','箕','斗','女','虚','危','室','壁','奎','婁','胃'];
/* 旧暦月ごとの朔日宿（伝統暦方式の参照表）*/
var SAKUJITSU = ['室','奎','胃','畢','参','鬼','張','角','氐','心','斗','虚'];
/* 三九の関係名。d = (相手宿 - 本命宿) mod 27 に対し d mod 9 で決まる並びを採用。
   ※ この並びは流派差があるため UI で「要確認」として出す。 */
var SANKU = ['命','栄','衰','安','危','成','壊','友','親'];
var SANKU_DIST = ['近距離','中距離','遠距離'];

/* ---- 干支の基本演算 ------------------------------------------------- */
function gz(i) { i = ((i % 60) + 60) % 60; return STEMS[i % 10] + BRANCHES[i % 12]; }
function gzStem(i) { return ((i % 60) + 60) % 60 % 10; }
function gzBranch(i) { return ((i % 60) + 60) % 60 % 12; }

/* 十神（日干から見た対象干） */
function tenGod(dm, t) {
  var de = STEM_ELEM[dm], te = STEM_ELEM[t];
  var same = STEM_YIN[dm] === STEM_YIN[t];
  if (te === de) return same ? '比肩' : '劫財';
  if (te === (de + 1) % 5) return same ? '食神' : '傷官';
  if (te === (de + 2) % 5) return same ? '偏財' : '正財';
  if (te === (de + 3) % 5) return same ? '偏官' : '正官';
  return same ? '偏印' : '正印';
}
/* 十二運（日干 × 地支） */
function juniun(dmStem, branchIdx) {
  var c = CHOSEI[STEMS[dmStem]];
  var start = BRANCHES.indexOf(c[0]), dir = c[1];
  var k = (((branchIdx - start) * dir) % 12 + 12) % 12;
  return STAGES[k];
}
/* 天中殺（一旬の十干支に現れない二支）— 算術事実のみ */
function tenchusatsu(pillarIdx) {
  var jun = Math.floor((((pillarIdx % 60) + 60) % 60) / 10);
  var a = (10 * jun + 10) % 12, b = (10 * jun + 11) % 12;
  return { junStart: gz(jun * 10), branches: [BRANCHES[a], BRANCHES[b]],
           name: BRANCHES[a] + BRANCHES[b] + '天中殺' };
}

/* =====================================================================
   四柱を組む
   採用規約:
     ・タイムゾーン: 日本標準時 (UTC+9) 固定
     ・日界: JST 0時
     ・年柱: 立春の瞬間で切る
     ・月柱: 十二節（立春・啓蟄・清明・立夏・芒種・小暑・立秋・白露・
             寒露・立冬・大雪・小寒）の境界で切る。旧暦月は使わない
     ・日柱: JDN からの連続日数を六十干支へ写像 ((JDN + 49) mod 60)
     ・時柱: 出生時刻がある場合のみ。23:00〜23:59 は子刻とするが
             日柱は繰り上げない（夜子時を採らない扱い）
     ・真太陽時の補正: 出生地がある場合のみ経度差で概算。無ければ省略
   ===================================================================== */
function buildPillars(input) {
  var fudo = [];                       // [不能] に入れる項目
  var jstMs = Date.UTC(input.y, input.m - 1, input.d,
                       input.hasTime ? input.hh : 12,
                       input.hasTime ? input.mi : 0) - 9 * 3600000;
  var jd = CAL.msToJd(jstMs);
  var dayNum = CAL.jstDay(jd);

  /* 年柱 */
  var risshun = CAL.solveSunLongitude(315, CAL.msToJd(Date.UTC(input.y, 1, 4)));
  var solarYear = jd >= risshun ? input.y : input.y - 1;
  var risshunUsed = jd >= risshun ? risshun
    : CAL.solveSunLongitude(315, CAL.msToJd(Date.UTC(input.y - 1, 1, 4)));
  var yearIdx = (((solarYear - 4) % 60) + 60) % 60;

  /* 立春・節入りの境界に近いか（時刻不明なら判定不能） */
  var nearRisshun = Math.abs(jd - risshun) < 1.5;

  /* 月柱 */
  var lam = CAL.sunApparentLongitude(jd);
  var mIdx = Math.floor(CAL.norm360(lam - 315) / 30);       // 0=寅月
  var monthBranch = (mIdx + 2) % 12;
  var yearStem = yearIdx % 10;
  var tigerStem = ((yearStem % 5) * 2 + 2) % 10;            // 五虎遁
  var monthStem = (tigerStem + mIdx) % 10;
  var monthIdx = 0;                                          // 60干支の通し番号
  while (monthIdx < 60 && !(monthIdx % 10 === monthStem && monthIdx % 12 === monthBranch)) monthIdx++;
  /* その月の節入り時刻 */
  var setsuLon = CAL.norm360(315 + mIdx * 30);
  var setsuJd = CAL.solveSunLongitude(setsuLon,
    jd - CAL.norm360(lam - setsuLon) / 0.9856473);
  var nextSetsuJd = CAL.solveSunLongitude(CAL.norm360(setsuLon + 30), setsuJd + 30 / 0.9856473);
  var nearSetsu = (jd - setsuJd) < 1.0 || (nextSetsuJd - jd) < 1.0;

  /* 日柱 */
  var dayIdx = ((dayNum + 49) % 60 + 60) % 60;

  /* 時柱 */
  var hourIdx = null, hourBranch = null, hourStem = null;
  if (input.hasTime) {
    hourBranch = Math.floor(((input.hh + 1) % 24) / 2);
    hourStem = ((dayIdx % 10 % 5) * 2 + hourBranch) % 10;
    var k = 0;
    while (k < 60 && !(k % 10 === hourStem && k % 12 === hourBranch)) k++;
    hourIdx = k;
  } else {
    fudo.push({ what: '時柱', why: '出生時刻の入力がないため。推測値は作っていない。' });
  }
  /* 真太陽時は出生地の有無にかかわらず未算出。あるのに補正しないまま
     黙っているのは不誠実なので、必ず [不能] に出す。 */
  fudo.push({
    what: '真太陽時（出生地の経度による時刻補正）',
    why: input.place
      ? '出生地の入力はあるが、経度から真太陽時へ補正する処理はこの版では実装していない。'
        + '標準時（UTC+9）のまま扱っているので、時柱が刻の境目に近いときはずれる可能性がある。'
      : '出生地の入力がないため。標準時（UTC+9）のまま扱っている。'
  });
  if (!input.hasTime && (nearRisshun || nearSetsu)) {
    fudo.push({ what: '節入り境界の確定',
                why: '出生日が節入りの前後1日以内で、かつ出生時刻が不明なため、'
                   + '年柱・月柱がどちら側になるか確定できない。' });
  }

  var pillars = [
    { name: '年柱', idx: yearIdx, stem: yearIdx % 10, branch: yearIdx % 12 },
    { name: '月柱', idx: monthIdx, stem: monthStem, branch: monthBranch },
    { name: '日柱', idx: dayIdx, stem: dayIdx % 10, branch: dayIdx % 12 }
  ];
  if (hourIdx !== null) {
    pillars.push({ name: '時柱', idx: hourIdx, stem: hourStem, branch: hourBranch });
  }
  var dm = dayIdx % 10;

  pillars.forEach(function (p) {
    p.gz = STEMS[p.stem] + BRANCHES[p.branch];
    p.stemName = STEMS[p.stem];
    p.branchName = BRANCHES[p.branch];
    p.stemElem = ELEM[STEM_ELEM[p.stem]];
    p.branchElem = ELEM[BRANCH_ELEM[p.branch]];
    p.hidden = HIDDEN[p.branchName].slice();
    p.tenGodStem = (p.name === '日柱') ? '（日主）' : tenGod(dm, p.stem);
    p.tenGodHidden = p.hidden.map(function (h) { return tenGod(dm, STEMS.indexOf(h)); });
    p.juniun = juniun(dm, p.branch);
    p.jujusei = JUJUSEI[p.juniun];
  });

  return {
    jd: jd, dayNum: dayNum, dm: dm, dmName: STEMS[dm],
    dmElem: ELEM[STEM_ELEM[dm]], dmYin: STEM_YIN[dm] ? '陰' : '陽',
    pillars: pillars, hasTime: input.hasTime,
    solarYear: solarYear, risshunJd: risshunUsed,
    setsuJd: setsuJd, nextSetsuJd: nextSetsuJd, monthIndexFromTiger: mIdx,
    sunLon: lam, fudo: fudo
  };
}

/* =====================================================================
   構造の集計（十神の五軸・五行）
   ※ ここで出す個数は「命式というモデルの中に記号がいくつ現れたか」で
     あって、性格の強さの数値でも的中率でもない。
   ===================================================================== */
function analyze(P) {
  var axis = {}, i, j;
  AXES5.forEach(function (a) { axis[a] = { count: 0, from: [] }; });
  var elemCount = [0, 0, 0, 0, 0];

  P.pillars.forEach(function (p) {
    // 天干（日柱の干＝日主自身は除く）
    if (p.name !== '日柱') {
      var a = TENGOD_AXIS[p.tenGodStem];
      axis[a].count++; axis[a].from.push(p.name + 'の' + p.stemName + '（' + p.tenGodStem + '）');
    }
    elemCount[STEM_ELEM[p.stem]]++;
    // 蔵干
    p.hidden.forEach(function (h, k) {
      var g = p.tenGodHidden[k], ax = TENGOD_AXIS[g];
      axis[ax].count++;
      axis[ax].from.push(p.name + '蔵干の' + h + '（' + g + '）');
    });
    elemCount[BRANCH_ELEM[p.branch]]++;
  });

  var axisList = AXES5.map(function (a) {
    return { axis: a, label: AXIS_LABEL[a], count: axis[a].count, from: axis[a].from };
  });
  // 決定的な並び（個数降順→AXES5の並び順）
  var ranked = axisList.slice().sort(function (x, y) {
    return y.count - x.count || AXES5.indexOf(x.axis) - AXES5.indexOf(y.axis);
  });

  var elems = ELEM.map(function (e, k) { return { elem: e, count: elemCount[k] }; });
  var elemRanked = elems.slice().sort(function (x, y) {
    return y.count - x.count || ELEM.indexOf(x.elem) - ELEM.indexOf(y.elem);
  });

  // 月令（生まれた季節）
  var seasonIdx = Math.floor(P.monthIndexFromTiger / 3);     // 0=春(寅卯辰)
  var season = ['春', '夏', '秋', '冬'][seasonIdx];

  // 周期位置（日支の十二運がどの群か）
  var dayPillar = P.pillars[2];
  var phase = STAGE_PHASE[dayPillar.juniun];

  return {
    axes: axisList, axesRanked: ranked,
    elems: elems, elemsRanked: elemRanked,
    total: axisList.reduce(function (s, a) { return s + a.count; }, 0),
    season: season, seasonIdx: seasonIdx,
    dayStage: dayPillar.juniun, dayJusei: dayPillar.jujusei, phase: phase
  };
}

/* =====================================================================
   算命学の層
   -------------------------------------------------------------------
   ・十大主星は十神の再命名として写像する（採用: 高尾学館系の対応）
   ・十二大従星は十二運から写像する
   ・天中殺は「一旬に現れない二支」という算術事実のみを計算とする
   ・人体星図の配置（どの星が頭・胸・腹・左手・右手・肩・足に入るか）は
     確信をもって固定できなかったため [不能] とし、配置は出さない
   ===================================================================== */
function sanmei(P) {
  var fudo = [];
  var stars = [];
  P.pillars.forEach(function (p) {
    if (p.name !== '日柱') {
      stars.push({ src: p.name + '天干 ' + p.stemName, tenGod: p.tenGodStem, star: JUDAI[p.tenGodStem] });
    }
    stars.push({ src: p.name + '蔵干（本気）' + p.hidden[0], tenGod: p.tenGodHidden[0],
                 star: JUDAI[p.tenGodHidden[0]] });
  });
  var jusei = P.pillars.map(function (p) {
    return { src: p.name + ' ' + p.branchName, stage: p.juniun, star: p.jujusei };
  });
  fudo.push({
    what: '人体星図の配置（頭・胸・腹・左手・右手・肩・足のどこにどの星が入るか）',
    why: '流派ごとの配置表を確信をもって固定できなかったため。'
       + '推測で埋めると誤った構造を事実として出すことになるので、配置は出していない。'
       + '星そのもの（十大主星・十二大従星）は上に出している。'
  });
  fudo.push({
    what: '大運の順逆（進む向き）',
    why: '旧来の男女二分法を前提とする流派規則のため、既定の読みでは使わない。'
  });
  var dayTcs = tenchusatsu(P.pillars[2].idx);
  var yearTcs = tenchusatsu(P.pillars[0].idx);
  return { stars: stars, jusei: jusei, dayTenchusatsu: dayTcs, yearTenchusatsu: yearTcs, fudo: fudo };
}

/* =====================================================================
   宿曜道の層
   -------------------------------------------------------------------
   指示書4.4により、伝統暦方式と天文方式を混ぜない。
   本命宿は伝統暦方式を正とする:
       本命宿 = (旧暦月の朔日宿 + 旧暦日 - 1) mod 27
   閏月は、直前の通常月と同じ朔日宿を使う（閏6月なら6月の朔日宿＝鬼）。
   天文方式（月の恒星黄経／ラヒリ）は比較資料として別枠に出す。
   ===================================================================== */
function shukuyo(P, jd) {
  var L = CAL.lunarDate(jd);
  var sakuName = SAKUJITSU[L.month - 1];
  var sakuIdx = SHUKU27.indexOf(sakuName);
  var idx = (sakuIdx + L.day - 1) % 27;

  // 比較資料としての天文方式
  var astro = CAL.nakshatra(jd);

  return {
    method: '伝統暦方式',
    formula: '本命宿 =（旧暦' + L.month + '月の朔日宿「' + sakuName + '」の番号 '
           + (sakuIdx + 1) + ' ＋ 旧暦' + L.day + '日 − 1）mod 27',
    lunarMonth: L.month, lunarDay: L.day, leap: L.leap,
    leapNote: L.leap ? '閏月のため、直前の通常月（' + L.month + '月）と同じ朔日宿を使った。'
                     : null,
    sakujitsu: sakuName, index: idx, no: idx + 1, name: SHUKU27[idx] + '宿',
    astro: { name: astro.name, no: astro.no, sidLon: astro.sidLon, ayanamsha: astro.ayanamsha },
    agrees: (SHUKU27[idx] + '宿') === astro.name
  };
}
/* 三九の関係（相手の宿が分かるときだけ意味を持つ参照表） */
function sanku(selfIdx, otherIdx) {
  var d = ((otherIdx - selfIdx) % 27 + 27) % 27;
  return { d: d, name: SANKU[d % 9], dist: SANKU_DIST[Math.floor(d / 9)] };
}

/* =====================================================================
   中立軸への変換（指示書5）
   三術の結果を直接合算せず、いったんこの7軸へ移してから比べる。
   ===================================================================== */
function neutralAxes(P, A, S, K, cal) {
  var out = [];
  out.push({
    key: '周期位置', observed: '生月の節気は' + A.season + '（' + P.pillars[1].branchName + '月）。'
      + '日支の十二運は' + A.dayStage + '（' + A.dayJusei + '）で、周期の「' + A.phase + '」の群。'
      + '生まれた日の月相は' + cal.moon.name + '（月齢' + cal.moon.age.toFixed(1) + '日）。',
    question: '開始・展開・収束・休止のどの局面で動きやすいか。'
  });
  var top = A.axesRanked[0], bottom = A.axesRanked[A.axesRanked.length - 1];
  out.push({
    key: '集中と分散',
    observed: '命式の記号は' + top.axis + '（' + top.label + '）に最も多く現れ、'
      + bottom.axis + '（' + bottom.label + '）が最も少ない。'
      + '五行では' + A.elemsRanked[0].elem + 'が多く、'
      + A.elemsRanked[A.elemsRanked.length - 1].elem + 'が少ない。',
    question: '専門化しやすいか、切替えに外部の支援が要るか。'
  });
  out.push({
    key: '支援と表出',
    observed: '生我（受け取る）' + cnt(A, '生我') + '、我生（外へ出す）' + cnt(A, '我生') + '。',
    question: '受け取ることと外へ出すことの配分は実際どうなっているか。'
  });
  out.push({
    key: '自律と制約',
    observed: '同類（自分の基準）' + cnt(A, '同類') + '、剋我（外の規律）' + cnt(A, '剋我') + '。',
    question: '自分の基準と外部の規律をどう調整しているか。'
  });
  out.push({
    key: '資源と成果',
    observed: '我剋（資源を価値へ変える）' + cnt(A, '我剋') + '。',
    question: '時間・物・関係を何にどう変えてきたか。'
  });
  out.push({
    key: '関係距離',
    observed: '宿曜（伝統暦方式）の本命宿は' + K.name + '。'
      + '三九の関係表は相手の宿が分かって初めて使える。',
    question: '接近・競合・補完・離隔のどれが起きやすいか。'
  });
  out.push({
    key: '時間変化',
    observed: '天中殺（一旬に現れない二支）は日柱で' + S.dayTenchusatsu.name
      + '、年柱で' + S.yearTenchusatsu.name + '。これは並びの算術であって吉凶ではない。',
    question: '予言ではなく、観察する期間をどう区切るか。'
  });
  return out;
}
function cnt(A, name) {
  for (var i = 0; i < A.axes.length; i++) if (A.axes[i].axis === name) return 'は' + A.axes[i].count + '個';
  return '';
}

/* =====================================================================
   仮説の組み立て
   構造 → reading-content.js のテンプレート を決定的に選ぶ。
   同じ入力からは必ず同じ出力になる（乱数を使わない）。
   ===================================================================== */
function buildHypotheses(P, A, S, K, cal) {
  var H = [], seen = {};
  function push(id) {
    var t = RC.hypotheses[id];
    if (!t || seen[id]) return;
    seen[id] = 1;
    H.push({
      id: id, theme: t.theme, traditional_basis: t.traditional_basis,
      possible_strength: t.possible_strength, overload_pattern: t.overload_pattern,
      enabling_conditions: t.enabling_conditions, counter_hypothesis: t.counter_hypothesis,
      reality_check: t.reality_check, status: 'untested'
    });
  }
  // 五軸: 多い/少ない
  A.axesRanked.forEach(function (a, rank) {
    if (a.count >= 3) push('axis.' + a.axis + '.multi');
    if (a.count === 0) push('axis.' + a.axis + '.none');
  });
  // 五行: 多い/無い
  A.elemsRanked.forEach(function (e) {
    if (e.count >= 4) push('elem.' + e.elem + '.multi');
    if (e.count === 0) push('elem.' + e.elem + '.none');
  });
  // 季節・周期位置
  push('season.' + A.season);
  push('phase.' + A.phase);
  // 月相
  push('moon.' + moonBand(cal.moon.elongation));
  // 天中殺（算術のみ）
  push('tenchusatsu.general');
  return H;
}
function moonBand(el) {
  if (el < 45 || el >= 315) return '朔';
  if (el < 135) return '上弦';
  if (el < 225) return '望';
  return '下弦';
}

/* 結論に出す「検証する価値のあるテーマ」上位3件（決定的な順序） */
function topThemes(H, A) {
  var order = H.slice();
  return order.slice(0, 3);
}

/* =====================================================================
   まとめ
   ===================================================================== */
function read(input) {
  var P = buildPillars(input);
  var A = analyze(P);
  var S = sanmei(P);
  var K = shukuyo(P, P.jd);
  var cal = CAL.snapshot(P.jd);
  var N = neutralAxes(P, A, S, K, cal);
  var H = buildHypotheses(P, A, S, K, cal);
  var fudo = P.fudo.concat(S.fudo);
  fudo.push({ what: '「魂の目的」「前世」「使命」の断定',
              why: '生年月日から確定できる種類の事柄ではない。本人が選び、継続した行動で'
                 + '意味を与えたテーマだけが、その人の目的として扱える。' });
  fudo.push({ what: '性別・ジェンダーからの性格・能力・役割・運勢の算出',
              why: 'この読みでは行わない。入力は呼称と、本人が確認する文脈の質問にのみ使う。' });
  return {
    input: input, pillars: P, analysis: A, sanmei: S, shukuyo: K,
    calendar: cal, neutral: N, hypotheses: H, themes: topThemes(H, A), fudo: fudo,
    conventions: conventions(input, P)
  };
}

function conventions(input, P) {
  var c = [];
  c.push(['使用暦', 'グレゴリオ暦。旧暦は太陰太陽暦（定気法）']);
  c.push(['タイムゾーン', '日本標準時 UTC+9 固定']);
  c.push(['日界', 'JST 0時（暦・日柱ともこの境界で切る）']);
  c.push(['太陽黄経・節入りの出典',
    'Meeus『Astronomical Algorithms』第25章の視黄経（精度 約0.01°）。'
    + 'ΔT は Espenak & Meeus (2006)']);
  c.push(['月の位置', 'Meeus 第47章の簡略月理論（黄経の誤差 約10秒角）']);
  c.push(['年柱の境界', '立春の瞬間']);
  c.push(['月柱の境界', '十二節（立春・啓蟄・清明・立夏・芒種・小暑・立秋・白露・寒露・立冬・大雪・小寒）。旧暦月は使わない']);
  c.push(['日柱の写像', '(JDN + 49) mod 60。JDN は JST の暦日']);
  c.push(['時柱', input.hasTime
    ? '出生時刻から算出。23:00〜23:59 は子刻とするが日柱は繰り上げない（夜子時を採らない扱い）'
    : '出生時刻がないため算出していない']);
  c.push(['蔵干表', '本気・中気・余気の三分表（子=癸／丑=己癸辛／寅=甲丙戊／卯=乙／辰=戊乙癸／巳=丙庚戊／午=丁己／未=己丁乙／申=庚壬戊／酉=辛／戌=戊辛丁／亥=壬甲）']);
  c.push(['算命学の表', '十大主星は十神の再命名として写像（高尾学館系の対応）。十二大従星は十二運から写像。人体星図の配置は未採用（[不能]）']);
  c.push(['宿曜道の方式', '伝統暦方式を正とする。本命宿 =（旧暦月の朔日宿 + 旧暦日 − 1）mod 27。閏月は直前の通常月と同じ朔日宿。天文方式は比較資料']);
  c.push(['七十二候', '日本の本朝七十二候（明治7年・略本暦の系統）。中国の宣明暦系とは名称が異なる']);
  c.push(['真太陽時', '未算出。標準時（UTC+9）のまま扱っている'
    + (input.place ? '（出生地の入力はあるが経度補正は未実装）' : '（出生地の入力なし）')]);
  return c;
}

return {
  STEMS: STEMS, BRANCHES: BRANCHES, ELEM: ELEM, HIDDEN: HIDDEN,
  SHUKU27: SHUKU27, SAKUJITSU: SAKUJITSU, SANKU: SANKU,
  JUDAI: JUDAI, JUJUSEI: JUJUSEI, STAGES: STAGES,
  gz: gz, tenGod: tenGod, juniun: juniun, tenchusatsu: tenchusatsu,
  buildPillars: buildPillars, analyze: analyze, sanmei: sanmei,
  shukuyo: shukuyo, sanku: sanku, read: read, moonBand: moonBand
};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = READ;
