// Standish orbital elements test harness
const DEG = Math.PI / 180;

// Table 1: 1800 AD - 2050 AD   [a, e, I, L, varpi, Omega] + rates per century
const T1 = {
  Mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
            0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  Venus:   [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
            0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  Earth:   [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
            0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  Mars:    [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
            0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  Jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
            -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  Saturn:  [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
            -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  Uranus:  [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
            -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  Neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
            0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};

// Table 2: 3000 BC - 3000 AD  (+ b,c,s,f extra terms for outer planets)
const T2 = {
  Mercury: [0.38709843, 0.20563661, 7.00559432, 252.25166724, 77.45771895, 48.33961819,
            0.00000000, 0.00002123, -0.00590158, 149472.67486623, 0.15940013, -0.12214182],
  Venus:   [0.72332102, 0.00676399, 3.39777545, 181.97970850, 131.76755713, 76.67261496,
            -0.00000026, -0.00005107, 0.00043494, 58517.81560260, 0.05679648, -0.27274174],
  Earth:   [1.00000018, 0.01673163, -0.00054346, 100.46691572, 102.93005885, -5.11260389,
            -0.00000003, -0.00003661, -0.01337178, 35999.37306329, 0.31795260, -0.24123856],
  Mars:    [1.52371243, 0.09336511, 1.85181869, -4.56813164, -23.91744784, 49.71320984,
            0.00000097, 0.00009149, -0.00724757, 19140.29934243, 0.45223625, -0.26852431],
  Jupiter: [5.20248019, 0.04853590, 1.29861416, 34.33479152, 14.27495244, 100.29282654,
            -0.00002864, 0.00018026, -0.00322699, 3034.90371757, 0.18199196, 0.13024619,
            -0.00012452, 0.06064060, -0.35635438, 38.35125000],
  Saturn:  [9.54149883, 0.05550825, 2.49424102, 50.07571329, 92.86136063, 113.63998702,
            -0.00003065, -0.00032044, 0.00451969, 1222.11494724, 0.54179478, -0.25015002,
            0.00025899, -0.13434469, 0.87320147, 38.35125000],
  Uranus:  [19.18797948, 0.04685740, 0.77298127, 314.20276625, 172.43404441, 73.96250215,
            -0.00020455, -0.00001550, -0.00180155, 428.49512595, 0.09266985, 0.05739699,
            0.00058331, -0.97731848, 0.17689245, 7.67025000],
  Neptune: [30.06952752, 0.00895439, 1.77005520, 304.22289287, 46.68158724, 131.78635853,
            0.00006447, 0.00000818, 0.00022400, 218.46515314, 0.01009938, -0.00606302,
            -0.00041348, 0.68346318, -0.10162547, 7.67025000],
};

const norm360 = d => ((d % 360) + 360) % 360;

function kepler(Mdeg, e) {
  // returns E in degrees. Newton-Raphson on M = E - e* sin E (M,E in rad)
  const M = norm360(Mdeg + 180) - 180;      // -180..180
  const Mr = M * DEG;
  let E = Mr + e * Math.sin(Mr);            // good starting guess
  let iter = 0, dE = 1;
  while (Math.abs(dE) > 1e-12 && iter < 60) {
    dE = (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
    E -= dE;
    iter++;
  }
  return { E: E, iter: iter, converged: Math.abs(dE) <= 1e-9 };
}

function heliocentric(name, T) {
  const useT2 = (T < -2.0 || T > 0.5);      // outside 1800..2050
  const el = (useT2 ? T2 : T1)[name];
  const a = el[0] + el[6] * T;
  const e = el[1] + el[7] * T;
  const I = el[2] + el[8] * T;
  const L = el[3] + el[9] * T;
  const w = el[4] + el[10] * T;             // longitude of perihelion
  const O = el[5] + el[11] * T;             // longitude of ascending node

  let M = L - w;
  if (el.length > 12) {
    const b = el[12], c = el[13], s = el[14], f = el[15];
    M += b * T * T + c * Math.cos(f * T * DEG) + s * Math.sin(f * T * DEG);
  }
  const kep = kepler(M, e);
  const E = kep.E;
  // orbital plane coords
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const wr = (w - O) * DEG, Or = O * DEG, Ir = I * DEG;
  const cw = Math.cos(wr), sw = Math.sin(wr);
  const cO = Math.cos(Or), sO = Math.sin(Or);
  const cI = Math.cos(Ir), sI = Math.sin(Ir);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = (sw * sI) * xp + (cw * sI) * yp;
  return { x, y, z, a, e, I, L, w, O, M: norm360(M), E: E / DEG,
           r: Math.hypot(x, y, z), lon: norm360(Math.atan2(y, x) / DEG),
           lat: Math.atan2(z, Math.hypot(x, y)) / DEG, iter: kep.iter, ok: kep.converged, useT2 };
}

function julian(date) { return date.getTime() / 86400000 + 2440587.5; }
function century(jd) { return (jd - 2451545.0) / 36525.0; }

// ---- verification ----
const names = ['Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune'];
const d = new Date('2026-08-12T12:00:00Z');
const jd = julian(d), T = century(jd);
console.log('Date', d.toISOString(), 'JD', jd.toFixed(5), 'T', T.toFixed(8));

const pos = {};
for (const n of names) pos[n] = heliocentric(n, T);

console.log('\n-- heliocentric (J2000 ecliptic) --');
for (const n of names) {
  const p = pos[n];
  console.log(n.padEnd(8), 'lon', p.lon.toFixed(3).padStart(8), 'lat', p.lat.toFixed(3).padStart(7),
              'r', p.r.toFixed(5).padStart(9), 'iter', p.iter, p.ok ? 'ok' : 'FAIL', p.useT2?'T2':'T1');
}

// check1: Sun geocentric longitude from our Earth vs low-precision USNO formula
const E = pos.Earth;
const sunLon = norm360(E.lon + 180);
const n_days = jd - 2451545.0;
let Ls = norm360(280.460 + 0.9856474 * n_days);
let g = norm360(357.528 + 0.9856003 * n_days) * DEG;
const lamUSNO = norm360(Ls + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)); // equinox of date
// precess our J2000 value to equinox of date
const prec = 1.396971 * T * 100 / 100; // deg/century approx general precession in longitude ~1.39697 deg/cy
const sunLonOfDate = norm360(sunLon + 1.396971 * T + 0.0003086 * T * T);
console.log('\n-- CHECK 1: Sun geocentric ecliptic longitude --');
console.log('  from model (J2000):', sunLon.toFixed(4));
console.log('  from model (of date):', sunLonOfDate.toFixed(4));
console.log('  USNO low-precision (of date):', lamUSNO.toFixed(4));
console.log('  diff (arcsec):', ((sunLonOfDate - lamUSNO) * 3600).toFixed(1));
console.log('  Earth heliocentric lon:', E.lon.toFixed(3), '(expected ~320 for mid-Aug)');
console.log('  Earth r:', E.r.toFixed(6), 'AU (expected ~1.013 in August, near aphelion)');

// check2: geocentric longitudes of outer planets (tropical, of date) vs known ephemeris
console.log('\n-- CHECK 2: geocentric ecliptic longitude, equinox of date --');
for (const n of names) {
  if (n === 'Earth') continue;
  const p = pos[n];
  const gx = p.x - E.x, gy = p.y - E.y, gz = p.z - E.z;
  const glon = norm360(norm360(Math.atan2(gy, gx) / DEG) + 1.396971 * T);
  const glat = Math.atan2(gz, Math.hypot(gx, gy)) / DEG;
  const dist = Math.hypot(gx, gy, gz);
  const signs = ['Ari','Tau','Gem','Can','Leo','Vir','Lib','Sco','Sgr','Cap','Aqu','Pis'];
  const si = Math.floor(glon / 30), sd = glon - si * 30;
  console.log(n.padEnd(8), glon.toFixed(3).padStart(8), '=', (sd.toFixed(2)+' '+signs[si]).padStart(10),
              ' lat', glat.toFixed(2).padStart(6), ' dist', dist.toFixed(4));
}

// check3: perihelion/aphelion sanity for r
console.log('\n-- CHECK 3: r within [a(1-e), a(1+e)] --');
for (const n of names) {
  const p = pos[n];
  const lo = p.a * (1 - p.e), hi = p.a * (1 + p.e);
  console.log(n.padEnd(8), (p.r >= lo - 1e-9 && p.r <= hi + 1e-9) ? 'OK' : 'FAIL',
    lo.toFixed(4), '<=', p.r.toFixed(4), '<=', hi.toFixed(4));
}

// check4: Kepler solver against known hard case (high e)
console.log('\n-- CHECK 4: Kepler solver, e=0.99 M=0.01deg --');
const k = kepler(0.01, 0.99);
console.log('  E =', (k.E/DEG).toFixed(8), 'iter', k.iter, k.ok?'converged':'FAIL',
  ' residual(deg):', ((k.E - 0.99*Math.sin(k.E))/DEG - 0.01).toExponential(3));

// check5: sidereal period recovered from L rate
console.log('\n-- CHECK 5: sidereal periods from L rate (years) --');
for (const n of names) {
  const per = 36525 / (T1[n][9] / 360) / 365.25;
  console.log(n.padEnd(8), per.toFixed(4), ' a^1.5 =', Math.pow(T1[n][0], 1.5).toFixed(4));
}
