/* =====================================================================
   暦エンジン — 太陽の視黄経 / 月（Meeus簡略月理論）/ 50音歴 /
   二十四節気・雑節 / 旧暦（定気法・JST）/ 二十七宿
   外部データを一切引かない。端末時計だけで完結する。
   ===================================================================== */
var CAL = (function () {
'use strict';
var D2R = Math.PI / 180;

function norm360(d) { d = d % 360; return d < 0 ? d + 360 : d; }
function norm180(d) { d = norm360(d); return d > 180 ? d - 360 : d; }
function sind(d) { return Math.sin(d * D2R); }
function cosd(d) { return Math.cos(d * D2R); }

/* ---- 時刻系 ---------------------------------------------------------
   端末時計は UTC。Meeus の式は TT（地球時）を要求するので ΔT を足す。
   ΔT は Espenak & Meeus (2006) の多項式。1800年より前後は放物線近似。 */
function deltaTsec(jd) {
  var y = 2000 + (jd - 2451545.0) / 365.25, t, u;
  if (y >= 2005 && y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (y >= 1986 && y < 2005) { t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t
         + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5); }
  if (y >= 1961 && y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t * t * t / 718; }
  if (y >= 1941 && y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t * t * t / 2547; }
  if (y >= 1920 && y < 1941) { t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t * t * t; }
  if (y >= 1900 && y < 1920) { t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * Math.pow(t, 4); }
  if (y >= 1860 && y < 1900) { t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t * t * t
         - 0.0004473624 * Math.pow(t, 4) + Math.pow(t, 5) / 233174; }
  if (y >= 1800 && y < 1860) { t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t * t + 0.0041116 * t * t * t
         - 0.00037436 * Math.pow(t, 4) + 0.0000121272 * Math.pow(t, 5)
         - 0.0000001699 * Math.pow(t, 6) + 0.000000000875 * Math.pow(t, 7); }
  if (y >= 2050 && y < 2150) { return -20 + 32 * Math.pow((y - 1820) / 100, 2) - 0.5628 * (2150 - y); }
  u = (y - 1820) / 100; return -20 + 32 * u * u;
}
function jdUT2TT(jd) { return jd + deltaTsec(jd) / 86400; }

function msToJd(ms) { return ms / 86400000 + 2440587.5; }
function jdToMs(jd) { return (jd - 2440587.5) * 86400000; }

/* JST の civil day 番号（JST 深夜0時で切る）。暦の日付境界はすべてこれ。 */
function jstDay(jd) { return Math.floor(jd + 0.5 + 9 / 24); }
function jstDayToJd(n) { return n - 0.5 - 9 / 24; }          // その日の JST 0:00 の JD
function jstParts(jd) {                                       // JST の年月日時分
  var d = new Date(jdToMs(jd) + 9 * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
           hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}

/* ---- 太陽の視黄経（Meeus 第25章・精度 約0.01度）---------------------- */
function sunApparentLongitude(jdUT) {
  var T = (jdUT2TT(jdUT) - 2451545.0) / 36525.0;
  var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  var M  = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M)
        + (0.019993 - 0.000101 * T) * sind(2 * M)
        + 0.000289 * sind(3 * M);
  var trueLon = L0 + C;
  var om = 125.04 - 1934.136 * T;
  return norm360(trueLon - 0.00569 - 0.00478 * sind(om));     // 光行差＋章動
}
function sunRadiusAU(jdUT) {
  var T = (jdUT2TT(jdUT) - 2451545.0) / 36525.0;
  var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M)
        + (0.019993 - 0.000101 * T) * sind(2 * M) + 0.000289 * sind(3 * M);
  var e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  var v = M + C;
  return 1.000001018 * (1 - e * e) / (1 + e * cosd(v));
}

/* ---- 月（Meeus 第47章。黄経の誤差 約10秒角）------------------------- */
/* 各行: D, M, M', F, 黄経係数(1e-6度), 距離係数(1e-3 km) */
var MOON_LR = [
 [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],
 [0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],
 [2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],
 [2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
 [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],
 [0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],
 [4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],
 [1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
 [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],
 [0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],
 [1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],
 [0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
 [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],
 [3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],
 [0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],[2,1,-2,0,691,0],
 [2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],
 [4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],
 [0,0,2,-2,-381,-4421],[1,1,1,0,351,0],[3,0,-2,0,-340,0],
 [4,0,-3,0,330,0],[2,-1,2,0,327,0],[0,2,1,0,-323,1165],
 [1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752]
];
/* 各行: D, M, M', F, 黄緯係数(1e-6度) */
var MOON_B = [
 [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],
 [2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],
 [2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
 [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],
 [2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
 [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
 [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],
 [4,0,0,-1,1021],[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],
 [2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],
 [0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],
 [2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],
 [0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],
 [0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],
 [0,1,2,1,-177],[4,0,-2,-1,176],[4,-1,-1,-1,166],[1,0,1,-1,-164],
 [4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107]
];

function moonPosition(jdUT) {
  var T = (jdUT2TT(jdUT) - 2451545.0) / 36525.0;
  var T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  var D  = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  var M  = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  var Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  var F  = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  var A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, A3 = 313.45 + 481266.484 * T;
  var E = 1 - 0.002516 * T - 0.0000074 * T2;

  var sl = 0, sr = 0, sb = 0, i, t, arg, f;
  for (i = 0; i < MOON_LR.length; i++) {
    t = MOON_LR[i];
    arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
    f = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E * E);
    sl += t[4] * f * sind(arg);
    sr += t[5] * f * cosd(arg);
  }
  for (i = 0; i < MOON_B.length; i++) {
    t = MOON_B[i];
    arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
    f = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E * E);
    sb += t[4] * f * sind(arg);
  }
  sl += 3958 * sind(A1) + 1962 * sind(Lp - F) + 318 * sind(A2);
  sb += -2235 * sind(Lp) + 382 * sind(A3) + 175 * sind(A1 - F) + 175 * sind(A1 + F)
      + 127 * sind(Lp - Mp) - 115 * sind(Lp + Mp);

  return {
    lon: norm360(Lp + sl / 1000000),        // 地心視黄経（その時の平均分点）
    lat: sb / 1000000,                       // 地心黄緯
    dist: 385000.56 + sr / 1000              // 地心距離 km
  };
}

/* ---- 求解ユーティリティ --------------------------------------------- */
/* 太陽の視黄経が target になる瞬間（JD, UT）。反復＋収束判定つき。 */
function solveSunLongitude(target, jdGuess) {
  var jd = jdGuess, i, d;
  for (i = 0; i < 40; i++) {
    d = norm180(sunApparentLongitude(jd) - target);
    if (Math.abs(d) < 1e-9) break;
    jd -= d / 0.9856473;
  }
  return jd;
}
/* 月と太陽の離角が target(0=朔, 180=望) になる瞬間 */
function solveElongation(target, jdGuess) {
  var jd = jdGuess, i, d;
  for (i = 0; i < 60; i++) {
    d = norm180(moonPosition(jd).lon - sunApparentLongitude(jd) - target);
    if (Math.abs(d) < 1e-9) break;
    jd -= d / 12.190749;
  }
  return jd;
}
function elongation(jd) { return norm360(moonPosition(jd).lon - sunApparentLongitude(jd)); }

/* 指定 JD 以前で最も近い朔 */
function newMoonBefore(jd) {
  var g = jd - elongation(jd) / 12.190749;
  var nm = solveElongation(0, g);
  while (nm > jd) nm = solveElongation(0, nm - 29.53);
  return nm;
}
function newMoonAfter(jd) {
  var nm = newMoonBefore(jd);
  while (nm <= jd) nm = solveElongation(0, nm + 29.53);
  return nm;
}

/* =====================================================================
   50音歴 — 冬至(太陽黄経270度)起点・7.2度ごとに次の音（定気法）
   360 / 50 = 7.2 なので必ず冬至でちょうど一巡して1番目に戻る。
   ※ 各音の意味・属性・対応づけは意図的に一切持たせていない。
   ===================================================================== */
var GOJUON = ['ホ','オ','ヲ','ヘ','エ','ヱ','フ','ウ','ゥ','ヒ',
              'ミ','イ','井','ハ','ア','ワ','ヤ','ィ','ユ','ェ',
              'ヨ','ノ','ネ','ヌ','ニ','ナ','ラ','リ','ル','レ',
              'ロ','コ','ソ','ケ','セ','ク','ス','キ','カ','シ',
              'サ','タ','チ','ツ','テ','ト','モ','メ','ム','マ'];
var GOJUON_STEP = 360 / 50;                     // = 7.2 度

function gojuon(jd) {
  var lam = sunApparentLongitude(jd);
  var off = norm360(lam - 270);                 // 冬至からの経過黄経
  var idx = Math.floor(off / GOJUON_STEP);
  if (idx > 49) idx = 49;
  var startLon = 270 + idx * GOJUON_STEP;
  var start = solveSunLongitude(norm360(startLon), jd - (off - idx * GOJUON_STEP) / 0.9856473);
  var end   = solveSunLongitude(norm360(startLon + GOJUON_STEP), start + GOJUON_STEP / 0.9856473);
  return {
    index: idx, no: idx + 1, sound: GOJUON[idx],
    next: GOJUON[(idx + 1) % 50],
    startJd: start, endJd: end,
    lenDays: end - start,
    elapsedDays: jd - start,
    progress: (jd - start) / (end - start),
    sunLon: lam
  };
}

/* =====================================================================
   二十四節気・雑節
   ===================================================================== */
var SEKKI = ['春分','清明','穀雨','立夏','小満','芒種','夏至','小暑','大暑','立秋','処暑','白露',
             '秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒','立春','雨水','啓蟄'];
/* SEKKI[k] は太陽黄経 15k 度。春分=0度 から始まる。 */

function sekkiAt(jd) {
  var lam = sunApparentLongitude(jd);
  var k = Math.floor(norm360(lam) / 15);
  var cur = solveSunLongitude(k * 15, jd - norm180(lam - k * 15) / 0.9856473);
  var nk = (k + 1) % 24;
  var nxt = solveSunLongitude(nk * 15, cur + 15 / 0.9856473);
  return { index: k, name: SEKKI[k], jd: cur,
           nextIndex: nk, nextName: SEKKI[nk], nextJd: nxt, sunLon: lam };
}

/* =====================================================================
   七十二候 — 日本の「本朝七十二候」（明治7年・略本暦の系統）
   -------------------------------------------------------------------
   二十四節気を3等分し、太陽黄経5度ごとに1候。72候で一巡する。
   立春初候（黄経315度）を第1候とする。
   ※ 中国の宣明暦系（元の七十二候）とは名称が異なる。ここでは日本の
     略本暦系を採用している。両者を混ぜていない。
   各要素: [漢文表記, 読み, 現代語の意味]
   ===================================================================== */
var KOU = [
  ['東風解凍','はるかぜこおりをとく','春の風が氷を溶かしはじめる'],
  ['黄鶯睍睆','うぐいすなく','山里で鶯が鳴きはじめる'],
  ['魚上氷','うおこおりをいずる','割れた氷の間から魚が跳ねる'],
  ['土脉潤起','つちのしょううるおいおこる','雨が降って土が湿りけを含む'],
  ['霞始靆','かすみはじめてたなびく','霞がたなびきはじめる'],
  ['草木萌動','そうもくめばえいずる','草木が芽を出しはじめる'],
  ['蟄虫啓戸','すごもりむしとをひらく','冬ごもりの虫が出てくる'],
  ['桃始笑','ももはじめてさく','桃の花が咲きはじめる'],
  ['菜虫化蝶','なむしちょうとなる','青虫が羽化して蝶になる'],
  ['雀始巣','すずめはじめてすくう','雀が巣を作りはじめる'],
  ['桜始開','さくらはじめてひらく','桜の花が咲きはじめる'],
  ['雷乃発声','かみなりすなわちこえをはっす','遠くで雷の音がしはじめる'],
  ['玄鳥至','つばめきたる','燕が南から渡ってくる'],
  ['鴻雁北','こうがんかえる','雁が北へ帰っていく'],
  ['虹始見','にじはじめてあらわる','雨のあとに虹が出はじめる'],
  ['葭始生','あしはじめてしょうず','葦が芽を吹きはじめる'],
  ['霜止出苗','しもやんでなえいずる','霜が終わり稲の苗が育つ'],
  ['牡丹華','ぼたんはなさく','牡丹の花が咲く'],
  ['蛙始鳴','かわずはじめてなく','蛙が鳴きはじめる'],
  ['蚯蚓出','みみずいずる','蚯蚓が地上に出てくる'],
  ['竹笋生','たけのこしょうず','筍が生えてくる'],
  ['蚕起食桑','かいこおきてくわをはむ','蚕が桑を盛んに食べはじめる'],
  ['紅花栄','べにばなさかう','紅花が盛んに咲く'],
  ['麦秋至','むぎのときいたる','麦が熟して収穫期を迎える'],
  ['螳螂生','かまきりしょうず','螳螂が卵から孵る'],
  ['腐草為蛍','くされたるくさほたるとなる','朽ちた草から蛍が舞う'],
  ['梅子黄','うめのみきばむ','梅の実が黄色づく'],
  ['乃東枯','なつかれくさかるる','靫草が枯れていく'],
  ['菖蒲華','あやめはなさく','あやめの花が咲く'],
  ['半夏生','はんげしょうず','烏柄杓が生えはじめる'],
  ['温風至','あつかぜいたる','熱い風が吹きはじめる'],
  ['蓮始開','はすはじめてひらく','蓮の花が開きはじめる'],
  ['鷹乃学習','たかすなわちわざをならう','鷹の幼鳥が飛び方を覚える'],
  ['桐始結花','きりはじめてはなをむすぶ','桐が来年の花の実を結ぶ'],
  ['土潤溽暑','つちうるおうてむしあつし','土が湿って蒸し暑くなる'],
  ['大雨時行','たいうときどきふる','時として大雨が降る'],
  ['涼風至','すずかぜいたる','涼しい風が立ちはじめる'],
  ['寒蝉鳴','ひぐらしなく','蜩が鳴きはじめる'],
  ['蒙霧升降','ふかききりまとう','深い霧が立ちこめる'],
  ['綿柎開','わたのはなしべひらく','綿を包む萼が開く'],
  ['天地始粛','てんちはじめてさむし','暑さがようやく収まりはじめる'],
  ['禾乃登','こくものすなわちみのる','稲が実りはじめる'],
  ['草露白','くさのつゆしろし','草の露が白く光る'],
  ['鶺鴒鳴','せきれいなく','鶺鴒が鳴きはじめる'],
  ['玄鳥去','つばめさる','燕が南へ帰っていく'],
  ['雷乃収声','かみなりすなわちこえをおさむ','雷が鳴らなくなる'],
  ['蟄虫坏戸','むしかくれてとをふさぐ','虫が巣ごもりの支度をする'],
  ['水始涸','みずはじめてかるる','田の水を抜き稲刈りに備える'],
  ['鴻雁来','こうがんきたる','雁が渡ってくる'],
  ['菊花開','きくのはなひらく','菊の花が咲きはじめる'],
  ['蟋蟀在戸','きりぎりすとにあり','戸口で秋の虫が鳴く'],
  ['霜始降','しもはじめてふる','霜が降りはじめる'],
  ['霎時施','こさめときどきふる','小雨がときどき降る'],
  ['楓蔦黄','もみじつたきばむ','もみじや蔦が黄葉する'],
  ['山茶始開','つばきはじめてひらく','山茶花が咲きはじめる'],
  ['地始凍','ちはじめてこおる','大地が凍りはじめる'],
  ['金盞香','きんせんかさく','水仙の花が香りはじめる'],
  ['虹蔵不見','にじかくれてみえず','虹を見かけなくなる'],
  ['朔風払葉','きたかぜこのはをはらう','北風が木の葉を払い落とす'],
  ['橘始黄','たちばなはじめてきばむ','橘の実が黄色くなりはじめる'],
  ['閉塞成冬','そらさむくふゆとなる','天地の気が塞がって冬になる'],
  ['熊蟄穴','くまあなにこもる','熊が冬眠に入る'],
  ['鱖魚群','さけのうおむらがる','鮭が群れをなして川を上る'],
  ['乃東生','なつかれくさしょうず','靫草が芽を出す'],
  ['麋角解','さわしかのつのおつる','大鹿が角を落とす'],
  ['雪下出麦','ゆきわたりてむぎのびる','雪の下で麦が芽を伸ばす'],
  ['芹乃栄','せりすなわちさかう','芹が盛んに育つ'],
  ['水泉動','しみずあたたかをふくむ','凍った泉の水が動きはじめる'],
  ['雉始雊','きじはじめてなく','雉の雄が鳴きはじめる'],
  ['款冬華','ふきのはなさく','蕗の薹が出はじめる'],
  ['水沢腹堅','さわみずこおりつめる','沢の水が厚く凍りつく'],
  ['鶏始乳','にわとりはじめてとやにつく','鶏が卵を産みはじめる']
];
var KOU_POS = ['初候', '次候', '末候'];

/* 太陽黄経から第何候かを求める。第1候 = 立春初候 = 黄経315度。 */
function kouAt(jd) {
  var lam = sunApparentLongitude(jd);
  var off = norm360(lam - 315);
  var k = Math.floor(off / 5);
  if (k > 71) k = 71;
  var startLon = norm360(315 + k * 5);
  var start = solveSunLongitude(startLon, jd - (off - k * 5) / 0.9856473);
  var end = solveSunLongitude(norm360(startLon + 5), start + 5 / 0.9856473);
  var nk = (k + 1) % 72;
  return {
    index: k, no: k + 1,
    kanji: KOU[k][0], yomi: KOU[k][1], imi: KOU[k][2],
    pos: KOU_POS[k % 3], posIndex: k % 3,
    sekkiName: SEKKI[(Math.floor(k / 3) + 21) % 24],     // 第1候は立春(SEKKI添字21)
    startJd: start, endJd: end, lenDays: end - start,
    nextNo: nk + 1, nextKanji: KOU[nk][0], nextYomi: KOU[nk][1], nextJd: end,
    sunLon: lam
  };
}

/* その年（JST）の雑節。基準となる立春などから算出する。 */
function zassetsu(jd) {
  var p = jstParts(jd), y = p.y, out = [];
  // 立春（太陽黄経315度）: 2月上旬
  var risshun = solveSunLongitude(315, msToJd(Date.UTC(y, 1, 4)));
  if (jstDay(risshun) > jstDay(jd) + 250) risshun = solveSunLongitude(315, msToJd(Date.UTC(y - 1, 1, 4)));
  var shunbun = solveSunLongitude(0,   msToJd(Date.UTC(y, 2, 20)));
  var shubun  = solveSunLongitude(180, msToJd(Date.UTC(y, 8, 23)));
  function add(name, j, note) { out.push({ name: name, jd: j, day: jstDay(j), note: note || '' }); }
  add('節分', risshun - 1);
  add('彼岸入り(春)', shunbun - 3); add('春分', shunbun); add('彼岸明け(春)', shunbun + 3);
  add('八十八夜', jstDayToJd(jstDay(risshun) + 87));
  add('入梅', solveSunLongitude(80, msToJd(Date.UTC(y, 5, 11))));
  add('半夏生', solveSunLongitude(100, msToJd(Date.UTC(y, 6, 2))));
  add('二百十日', jstDayToJd(jstDay(risshun) + 209));
  add('二百二十日', jstDayToJd(jstDay(risshun) + 219));
  add('彼岸入り(秋)', shubun - 3); add('秋分', shubun); add('彼岸明け(秋)', shubun + 3);
  // 土用（各立の前18日間 = 太陽黄経 27/117/207/297度 から）
  add('土用入り(冬)', solveSunLongitude(297, msToJd(Date.UTC(y, 0, 17))));
  add('土用入り(春)', solveSunLongitude(27,  msToJd(Date.UTC(y, 3, 17))));
  add('土用入り(夏)', solveSunLongitude(117, msToJd(Date.UTC(y, 6, 19))));
  add('土用入り(秋)', solveSunLongitude(207, msToJd(Date.UTC(y, 9, 20))));
  out.sort(function (a, b) { return a.jd - b.jd; });
  return out;
}
/* 今日が該当する雑節（あれば）。期間ものは範囲で判定する。 */
var _zCache = {};
function zassetsuOfYear(y) {
  if (!_zCache[y]) {
    if (Object.keys(_zCache).length > 6) _zCache = {};
    _zCache[y] = zassetsu(msToJd(Date.UTC(y, 5, 1)));
  }
  return _zCache[y];
}
function zassetsuToday(jd) {
  var d = jstDay(jd), y = jstParts(jd).y, hits = [], i, L;
  var list = zassetsuOfYear(y).concat(zassetsuOfYear(y - 1));
  for (i = 0; i < list.length; i++) {
    L = list[i];
    if (L.name.indexOf('土用入り') === 0) {
      if (d >= L.day && d < L.day + 18) hits.push('土用' + L.name.slice(4) + (d === L.day ? '(入り)' : ''));
    } else if (L.day === d) hits.push(L.name);
  }
  // 彼岸は入り〜明けの7日間
  for (i = 0; i < list.length; i++) {
    L = list[i];
    if (L.name.indexOf('彼岸入り') === 0 && d > L.day && d < L.day + 6) hits.push('彼岸' + L.name.slice(4));
  }
  return hits;
}

/* =====================================================================
   まとめて取得（内部キャッシュつき）
   区切りの位置を求める計算は重いので、有効区間を覚えておき、
   区間をまたいだときだけ解き直す。早送り中でも実用的な速さになる。
   ===================================================================== */
var _gC = null, _kC = null, _lC = null, _nC = null, _koC = null;
function snapshot(jd) {
  if (!_gC || jd < _gC.startJd || jd >= _gC.endJd) _gC = gojuon(jd);
  var g = { index: _gC.index, no: _gC.no, sound: _gC.sound, next: _gC.next,
            startJd: _gC.startJd, endJd: _gC.endJd, lenDays: _gC.lenDays,
            elapsedDays: jd - _gC.startJd,
            progress: (jd - _gC.startJd) / (_gC.endJd - _gC.startJd) };

  if (!_kC || jd < _kC.jd || jd >= _kC.nextJd) _kC = sekkiAt(jd);
  if (!_koC || jd < _koC.startJd || jd >= _koC.endJd) _koC = kouAt(jd);

  if (!_lC || jd < _lC.prevNewJd || jd >= _lC.nextNewJd) {
    var pn = newMoonBefore(jd), nn = solveElongation(0, pn + 29.53);
    _lC = { prevNewJd: pn, nextNewJd: nn, fullJd: solveElongation(180, pn + 14.77) };
  }
  var el = elongation(jd);
  var nextFull = _lC.fullJd >= jd ? _lC.fullJd : solveElongation(180, _lC.nextNewJd + 14.77);
  var nameIdx = 0;
  for (var i = PHASE_NAMES.length - 1; i >= 0; i--) {
    if (el >= PHASE_NAMES[i][0] - 11.25) { nameIdx = i; break; }
  }
  var moon = moonPosition(jd);
  var phase = { elongation: el, illum: (1 - cosd(el)) / 2,
                name: el >= 348.75 ? '新月' : PHASE_NAMES[nameIdx][1],
                age: jd - _lC.prevNewJd, prevNewJd: _lC.prevNewJd,
                nextNewJd: _lC.nextNewJd, nextFullJd: nextFull,
                dist: moon.dist, lon: moon.lon, lat: moon.lat };

  var ay = ayanamshaDeg(jd), sid = norm360(moon.lon - ay);
  var raw = Math.floor(sid / NAK_SPAN);
  if (!_nC || _nC.raw !== raw || jd < _nC.enterJd || jd >= _nC.leaveJd) {
    var into0 = sid - raw * NAK_SPAN;
    var en = solveMoonSidLongitude(raw * NAK_SPAN, jd - into0 / 13.176);
    _nC = { raw: raw, enterJd: en,
            leaveJd: solveMoonSidLongitude((raw + 1) * NAK_SPAN % 360, en + NAK_SPAN / 13.176) };
  }
  var nidx = (raw + NAKSHATRA_CONFIG.startIndex) % 27, into = sid - raw * NAK_SPAN;
  var nak = { index: nidx, no: nidx + 1, name: NAKSHATRA[nidx][0], sanskrit: NAKSHATRA[nidx][1],
              sidLon: sid, tropLon: moon.lon, ayanamsha: ay, intoDeg: into,
              pada: Math.floor(into / (NAK_SPAN / 4)) + 1,
              enterJd: _nC.enterJd, leaveJd: _nC.leaveJd };

  return { jd: jd, gojuon: g, sekki: _kC, kou: _koC, moon: phase, nakshatra: nak,
           lunar: lunarDate(jd), zassetsu: zassetsuToday(jd),
           sunLon: sunApparentLongitude(jd) };
}
function resetCaches() {
  _gC = _kC = _lC = _nC = _koC = null;
  _wsCache = {}; _cycleCache = {}; _zCache = {};
}

/* =====================================================================
   旧暦（太陰太陽暦・定気法・JST基準）
   ・朔を含む日をその月の1日とする
   ・冬至を含む月を11月とする
   ・11月から次の11月までが13か月なら、中気を含まない最初の月を閏月とする
   ===================================================================== */
var _wsCache = {}, _cycleCache = {};
function winterSolsticeOfYear(y) {                    // その年12月の冬至（JD, UT）
  if (_wsCache[y] === undefined) {
    if (Object.keys(_wsCache).length > 24) _wsCache = {};
    _wsCache[y] = solveSunLongitude(270, msToJd(Date.UTC(y, 11, 22)));
  }
  return _wsCache[y];
}
function monthStartsFrom(ws) {                        // 冬至を含む月の朔から順に15個
  var first = newMoonBefore(jstDayToJd(jstDay(ws)) + 1 - 1e-9);
  var arr = [first];
  for (var i = 0; i < 14; i++) arr.push(solveElongation(0, arr[arr.length - 1] + 29.53));
  return arr;
}
/* 冬至(y年12月)から始まる1周期ぶんの月を組み立てる。重いのでキャッシュする。 */
function lunarCycle(y) {
  if (_cycleCache[y]) return _cycleCache[y];
  if (Object.keys(_cycleCache).length > 8) _cycleCache = {};
  var ws = winterSolsticeOfYear(y);
  var ms = monthStartsFrom(ws);
  var wsNext = winterSolsticeOfYear(y + 1);
  var n = 0, i;
  while (n < 14 && jstDay(ms[n + 1]) <= jstDay(wsNext)) n++;   // n = 次の11月の添字
  var leapIdx = -1;
  if (n >= 13) {
    for (i = 1; i <= 12; i++) if (!hasChuki(ms[i], ms[i + 1])) { leapIdx = i; break; }
  }
  var nums = [], leaps = [], num = 11;
  for (i = 0; i <= n; i++) {
    if (i === leapIdx) { nums.push(num === 1 ? 12 : num - 1); leaps.push(true); }
    else { nums.push(num); leaps.push(false); num = num % 12 + 1; }
  }
  return (_cycleCache[y] = { ws: ws, ms: ms, n: n, nums: nums, leaps: leaps, leapIdx: leapIdx });
}
function hasChuki(startJd, endJd) {                   // [start, end) に中気(黄経30の倍数)を含むか
  var d0 = jstDay(startJd), d1 = jstDay(endJd);
  var lam0 = sunApparentLongitude(jstDayToJd(d0));
  var k = Math.ceil(norm360(lam0) / 30) % 12;         // 次に来る中気の番号
  var target = k * 30;
  var t = solveSunLongitude(target, jstDayToJd(d0) + norm360(target - lam0) / 0.9856473);
  return jstDay(t) >= d0 && jstDay(t) < d1;
}
function lunarDate(jd) {
  var day = jstDay(jd), y = jstParts(jd).y, cyc = lunarCycle(y - 1), i;
  // この日を含む周期を選ぶ（周期は「冬至を含む11月」から次の11月の直前まで）
  if (day >= jstDay(cyc.ms[cyc.n])) cyc = lunarCycle(y);
  else if (day < jstDay(cyc.ms[0])) cyc = lunarCycle(y - 2);
  if (day >= jstDay(cyc.ms[cyc.n])) cyc = lunarCycle(jstParts(cyc.ws).y + 1);

  var mi = 0;
  for (i = 0; i <= cyc.n; i++) if (day >= jstDay(cyc.ms[i])) mi = i;
  var mStart = jstDay(cyc.ms[mi]), mEnd = jstDay(cyc.ms[mi + 1]);
  var lm = cyc.nums[mi], gp = jstParts(cyc.ms[mi]);
  // 旧暦の年 = その年の正月を含むグレゴリオ年
  var ly = gp.y;
  if (lm >= 11 && gp.m <= 3) ly -= 1;
  return {
    year: ly, month: lm, day: day - mStart + 1, leap: cyc.leaps[mi],
    monthLength: mEnd - mStart, big: (mEnd - mStart) === 30,
    monthStartJd: cyc.ms[mi], nextMonthStartJd: cyc.ms[mi + 1],
    leapInCycle: cyc.leapIdx >= 0 ? cyc.nums[cyc.leapIdx] : null
  };
}

/* =====================================================================
   月相
   ===================================================================== */
var PHASE_NAMES = [
  [0,    '新月'], [22.5, '繊月'], [45,  '三日月'], [67.5, '上弦前'],
  [90,   '上弦'], [112.5,'十日夜'],[135, '十三夜月'],[157.5,'小望月'],
  [180,  '満月'], [202.5,'十六夜月'],[225,'居待月'],[247.5,'寝待月'],
  [270,  '下弦'], [292.5,'有明月'],[315, '二十六夜月'],[337.5,'晦の月']
];
function moonPhase(jd) {
  var el = elongation(jd);
  var k = (1 - cosd(el)) / 2;                          // 輝面比
  var nmPrev = newMoonBefore(jd), nmNext = newMoonAfter(jd);
  var fm = solveElongation(180, nmPrev + 14.77);
  if (fm < jd) fm = solveElongation(180, jd + 14.77);
  var name = PHASE_NAMES[0][1];
  for (var i = PHASE_NAMES.length - 1; i >= 0; i--) {
    if (el >= PHASE_NAMES[i][0] - 11.25) { name = PHASE_NAMES[i][1]; break; }
  }
  if (el >= 348.75) name = '新月';
  return {
    elongation: el, illum: k, name: name,
    age: jd - nmPrev,
    nextNewJd: nmNext, nextFullJd: fm, prevNewJd: nmPrev
  };
}

/* =====================================================================
   二十七宿
   -------------------------------------------------------------------
   起点とアヤナムシャの流儀が複数あるため、ここで断定しない。
   既定はラヒリのアヤナムシャによる恒星黄経・恒星黄経0度＝婁宿起点。
   NAKSHATRA_CONFIG を書き換えれば流儀を変えられる:
     ayanamsha  : 'lahiri' | 数値(度) | 0（0にすれば回帰黄道そのまま）
     startIndex : 起点の宿を NAKSHATRA の添字で指定（0 = 婁宿）
   ===================================================================== */
var NAKSHATRA = [
  ['婁宿','アシュヴィニー'],['胃宿','バラニー'],['昴宿','クリッティカー'],['畢宿','ローヒニー'],
  ['觜宿','ムリガシラー'],['参宿','アールドラー'],['井宿','プナルヴァス'],['鬼宿','プシュヤ'],
  ['柳宿','アーシュレーシャー'],['星宿','マガー'],['張宿','プールヴァ・パルグニー'],
  ['翼宿','ウッタラ・パルグニー'],['軫宿','ハスタ'],['角宿','チトラー'],['亢宿','スヴァーティー'],
  ['氐宿','ヴィシャーカー'],['房宿','アヌラーダー'],['心宿','ジェーシュター'],['尾宿','ムーラ'],
  ['箕宿','プールヴァ・アーシャーダー'],['斗宿','ウッタラ・アーシャーダー'],['女宿','シュラヴァナ'],
  ['虚宿','ダニシュター'],['危宿','シャタビシャー'],['室宿','プールヴァ・バードラパダー'],
  ['壁宿','ウッタラ・バードラパダー'],['奎宿','レーヴァティー']
];
var NAKSHATRA_CONFIG = { ayanamsha: 'lahiri', startIndex: 0 };

/* ラヒリ（チトラパクシャ）のアヤナムシャ。J2000.0 で 23°51'11" とし、
   そこから一般歳差を加える。2026年で約 24.22度。 */
function ayanamshaDeg(jd) {
  var cfg = NAKSHATRA_CONFIG.ayanamsha;
  if (typeof cfg === 'number') return cfg;
  var T = (jdUT2TT(jd) - 2451545.0) / 36525.0;
  return 23.85319 + (5028.796195 * T + 1.1054348 * T * T) / 3600;
}
var NAK_SPAN = 360 / 27;                                // 13度20分
function nakshatra(jd) {
  var m = moonPosition(jd);
  var ay = ayanamshaDeg(jd);
  var sid = norm360(m.lon - ay);                        // 恒星黄経
  var raw = Math.floor(sid / NAK_SPAN);
  var idx = (raw + NAKSHATRA_CONFIG.startIndex) % 27;
  var into = sid - raw * NAK_SPAN;
  // この宿に入った/出る時刻（月は約13.2度/日）
  var enter = solveMoonSidLongitude(raw * NAK_SPAN, jd - into / 13.176);
  var leave = solveMoonSidLongitude((raw + 1) * NAK_SPAN % 360, enter + NAK_SPAN / 13.176);
  return {
    index: idx, no: idx + 1, name: NAKSHATRA[idx][0], sanskrit: NAKSHATRA[idx][1],
    sidLon: sid, tropLon: m.lon, ayanamsha: ay,
    intoDeg: into, pada: Math.floor(into / (NAK_SPAN / 4)) + 1,
    enterJd: enter, leaveJd: leave
  };
}
function solveMoonSidLongitude(target, jdGuess) {
  var jd = jdGuess, i, d;
  for (i = 0; i < 50; i++) {
    d = norm180(norm360(moonPosition(jd).lon - ayanamshaDeg(jd)) - target);
    if (Math.abs(d) < 1e-8) break;
    jd -= d / 13.176358;
  }
  return jd;
}

return {
  norm360: norm360, norm180: norm180,
  msToJd: msToJd, jdToMs: jdToMs, jstDay: jstDay, jstDayToJd: jstDayToJd, jstParts: jstParts,
  deltaTsec: deltaTsec,
  sunApparentLongitude: sunApparentLongitude, sunRadiusAU: sunRadiusAU,
  moonPosition: moonPosition, elongation: elongation,
  solveSunLongitude: solveSunLongitude, solveElongation: solveElongation,
  newMoonBefore: newMoonBefore, newMoonAfter: newMoonAfter,
  GOJUON: GOJUON, GOJUON_STEP: GOJUON_STEP, gojuon: gojuon,
  SEKKI: SEKKI, sekkiAt: sekkiAt, zassetsu: zassetsu, zassetsuToday: zassetsuToday,
  KOU: KOU, KOU_POS: KOU_POS, kouAt: kouAt,
  zassetsuOfYear: zassetsuOfYear,
  lunarDate: lunarDate, lunarCycle: lunarCycle, moonPhase: moonPhase,
  snapshot: snapshot, resetCaches: resetCaches,
  NAKSHATRA: NAKSHATRA, NAKSHATRA_CONFIG: NAKSHATRA_CONFIG,
  ayanamshaDeg: ayanamshaDeg, nakshatra: nakshatra
};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CAL;
