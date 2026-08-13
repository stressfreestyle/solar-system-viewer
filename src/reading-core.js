/* =====================================================================
   生年月日サイクル読解 — 計算層
   -------------------------------------------------------------------
   この層は「再現可能な計算」と「採用流派の固定対応」だけを出す。
   解釈文は reading-content.js。

   主従の構造（三層）:
     主  = 法則（真理構造）
     従1 = 生年月日・暦記号・星の配置       ← 法則が現れた一つの面
     従2 = 生活・履歴・環境・選択・行動     ← 法則が展開したもう一つの面
   法則を従1に照らし、従2に何が展開しているかを読み解く。
   従1と従2はどちらも法則の展開した面であり、対等な「従」。

   読みと実際の出来事が食い違って見えるときは、法則が外れたのではなく、
   展開が別の面に出ているか、まだその面が見えていないものとして扱う。
   ずれているのは法則ではなく「どの面を見ているか」である、という書き方をする。
   本人に向かって「あなたが間違っている」「気づいていないだけだ」とは書かない。

   ※ この三層構造は、指示書 birth-cycle-reflection の中心規定
     （躰・主＝本人の生命・履歴・環境／反証不能にしない）とは意図的に異なる。
     経緯と、逸脱していない安全側の規定については README の
     「指示書からの意図的な逸脱」を参照。指示書のファイル自体は書き換えていない。

   第7フェーズで文面を断定調へ書き換えた。主＝法則である以上、読みは
   「かもしれない」ではなく断定で書く。ただし断定してよいのは、採用した
   象意と生剋の関係から導けることだけで、導けないものは fudo（[不能]）に入れる。

   主従とは別に、次の安全側の原則はそのまま維持している:
     ・未来の出来事と「魂の目的」を断定しない
     ・死・病気・事故・犯罪・妊娠出産・離婚・財産などの高リスク事項を予測しない
     ・医療・法律・採用・信用・結婚などの判断へ誘導しない
     ・確信をもって固定できない表は推測で埋めず fudo（[不能]）に入れる
     ・的中率・確率・スコア・パーセンテージの類は一切出さない
     ・性別・ジェンダーから性格・能力・役割・運勢を算出しない
     ・出生時刻が不明なら時柱を出さない。推測値を作らない
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
   構造の抽出（第7フェーズ）
   -------------------------------------------------------------------
   文面を断定調で組み立てるために、命式から「何を根拠に断定できるか」を
   すべて取り出しておく層。ここで出すのは記号の関係だけで、
   意味づけの文言は reading-content.js が持つ。
   乱数は使わない。同じ入力からは必ず同じ構造が出る。
   ===================================================================== */

/* 日主の五行から見た他の五行の関係 */
function relOf(dmE, otherE) {
  var d = ((otherE - dmE) % 5 + 5) % 5;
  return ['同', '我生', '我剋', '剋我', '生我'][d];
}
/* 月令に対する日主の位置（旺相休囚死）。
   採用: 当令者旺・令生者相・生令者休・剋令者囚・令剋者死（標準）。
   ※ 身強／身弱の判定はしない。数え方が流派で違うため。 */
function commandState(dmE, monthE) {
  if (dmE === monthE) return '旺';
  if (dmE === (monthE + 1) % 5) return '相';
  if (monthE === (dmE + 1) % 5) return '休';
  if (monthE === (dmE + 2) % 5) return '囚';
  return '死';
}

function structure(P, A, S, K, cal) {
  var dmE = STEM_ELEM[P.dm];

  /* 地支の重なり */
  var bc = {}, i;
  P.pillars.forEach(function (p) { bc[p.branchName] = (bc[p.branchName] || 0) + 1; });
  var repeats = [];
  BRANCHES.forEach(function (b) {
    if (bc[b] >= 2) {
      var bi = BRANCHES.indexOf(b);
      repeats.push({ branch: b, n: bc[b], elem: ELEM[BRANCH_ELEM[bi]],
                     yin: BRANCH_YIN[bi] ? '陰' : '陽', hidden: HIDDEN[b].slice() });
    }
  });

  /* 五行の偏り */
  var lacking = [], heaviest = A.elemsRanked[0];
  A.elems.forEach(function (e) { if (e.count === 0) lacking.push(e.elem); });
  var lackRel = lacking.map(function (e) {
    return { elem: e, rel: relOf(dmE, ELEM.indexOf(e)) };
  });
  var heavyRel = relOf(dmE, ELEM.indexOf(heaviest.elem));

  /* 月令 */
  var monthE = BRANCH_ELEM[P.pillars[1].branch];
  var command = commandState(dmE, monthE);

  /* 日柱の構造 */
  var dp = P.pillars[2];
  var dayStruct = {
    gz: dp.gz, branch: dp.branchName, branchElem: dp.branchElem,
    hiddenMain: dp.hidden[0], tenGodMain: dp.tenGodHidden[0],
    stage: dp.juniun, jusei: dp.jujusei
  };

  /* 十大主星の集計（決定的な順序: 出現順） */
  var starOrder = [], starCount = {};
  S.stars.forEach(function (s) {
    if (!starCount[s.star]) { starCount[s.star] = 0; starOrder.push(s.star); }
    starCount[s.star]++;
  });
  var stars = starOrder.map(function (n) { return { star: n, n: starCount[n] }; });

  /* 天中殺の二支が指す五行と、命式の五行との重なり */
  var tb = S.dayTenchusatsu.branches;
  var tElems = [], tCounts = [];
  tb.forEach(function (b) {
    var e = ELEM[BRANCH_ELEM[BRANCHES.indexOf(b)]];
    if (tElems.indexOf(e) < 0) tElems.push(e);
  });
  tElems.forEach(function (e) {
    for (var k = 0; k < A.elems.length; k++) if (A.elems[k].elem === e) tCounts.push(A.elems[k].count);
  });
  var tSum = tCounts.reduce(function (s, v) { return s + v; }, 0);
  var overlap = tSum === 0 ? 'lack'
    : (tElems.indexOf(heaviest.elem) >= 0 ? 'heavy' : 'some');

  return {
    dmElem: ELEM[dmE], dmName: P.dmName, dmYin: P.dmYin,
    repeats: repeats,
    lacking: lackRel, heaviest: { elem: heaviest.elem, count: heaviest.count, rel: heavyRel },
    monthBranch: P.pillars[1].branchName, monthElem: ELEM[monthE], command: command,
    day: dayStruct, stars: stars,
    tcs: { name: S.dayTenchusatsu.name, branches: tb, elems: tElems,
           counts: tCounts, sum: tSum, overlap: overlap },
    axes: A.axes
  };
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
  var X = structure(P, A, S, K, cal);
  var fudo = P.fudo.concat(S.fudo);
  fudo.push({ what: '身強・身弱の判定',
              why: '月令・通根・蔵干の重みづけが流派ごとに違い、確信をもって固定できないため。'
                 + '生まれ月の気に対する日主の位置（旺相休囚死）までは出しているが、'
                 + 'そこから強弱を断定することはしていない。' });
  fudo.push({ what: '格局・用神・喜忌の判定',
              why: '何を用神とするかの決め方が流派ごとに違うため。'
                 + 'この読みで使ったのは相生相剋の関係そのものだけで、'
                 + '「この五行が吉、この五行が凶」という判定はしていない。' });
  fudo.push({ what: '宿ごとの人物像（宿曜道）',
              why: '宿から性格・相性・運勢を出す記述は流派によって大きく異なり、'
                 + '確信をもって固定できないため。本命宿そのものは暦上の位置として出している。' });
  fudo.push({ what: '「魂の目的」「前世」「使命」の断定',
              why: '生年月日から確定できる種類の事柄ではない。本人が選び、継続した行動で'
                 + '意味を与えたテーマだけが、その人の目的として扱える。' });
  fudo.push({ what: '性別・ジェンダーからの性格・能力・役割・運勢の算出',
              why: 'この読みでは行わない。入力は呼称と、本人が確認する文脈の質問にのみ使う。' });
  return {
    input: input, pillars: P, analysis: A, sanmei: S, shukuyo: K,
    calendar: cal, structure: X, fudo: fudo,
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
  c.push(['十干の象意', '滴天髄・窮通宝鑑の系統で広く使われる比喩を採用（甲＝大樹／乙＝草花／丙＝太陽／丁＝灯火／戊＝山／己＝田畑／庚＝原石／辛＝宝石・刃物／壬＝大河／癸＝雨露）。比喩から先の言い換えはこの読みの表現であって原典の文言ではない']);
  c.push(['五行の数え方', '四柱それぞれの天干と地支の五行を一つずつ数える。蔵干は数に入れない。時柱が無ければその分だけ合計が減る']);
  c.push(['五行の関係', '相生（木生火生土生金生水生木）と相剋（木剋土剋水剋火剋金剋木）のみを使う。用神・喜忌の判定はしない（[不能]）']);
  c.push(['月令に対する位置', '旺相休囚死（当令者旺・令生者相・生令者休・剋令者囚・令剋者死）。ここから身強・身弱を断定することはしない（[不能]）']);
  c.push(['柱の対応', '年柱＝生まれ育った側／月柱＝働きの場／日柱＝本人／時柱＝先の時間。年齢区分の年数は流派差が大きいため出さない']);
  c.push(['算命学の表', '十大主星は十神の再命名として写像（高尾学館系の対応）。星の意味は写像元の十神から導いている。十二大従星は十二運から写像し、エネルギーの点数は出さない。人体星図の配置は未採用（[不能]）']);
  c.push(['宿曜道の方式', '伝統暦方式を正とする。本命宿 =（旧暦月の朔日宿 + 旧暦日 − 1）mod 27。閏月は直前の通常月と同じ朔日宿。天文方式は比較資料。宿ごとの人物像は未採用（[不能]）']);
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
  shukuyo: shukuyo, sanku: sanku, read: read,
  relOf: relOf, commandState: commandState, structure: structure
};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = READ;
