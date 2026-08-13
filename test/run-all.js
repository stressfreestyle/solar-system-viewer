/* 全テストを順に走らせる:  node test/run-all.js  */
const { execFileSync } = require('child_process');
const path = require('path');

const files = [
  'test-astro.js',        // 惑星位置（Standish・ケプラー方程式）
  'test-calendar-1.js',   // 月・50音歴・二十四節気・旧暦・二十七宿
  'test-calendar-2.js',   // 閏月・連続性・キャッシュ整合・性能
  'test-kou.js',          // 七十二候
  'test-reading.js',      // 四柱推命・算命学・宿曜・文面チェック
  'test-truth.js',        // 真理構造から見る（導出の木・閏月・[不能]・禁止語）
  'test-view.js'          // 人物理解の描画（表と裏の分離・断定と根拠の対応・到達可能性）
];

let bad = 0;
for (const f of files) {
  console.log('\n##### ' + f + ' #####');
  try {
    process.stdout.write(execFileSync('node', [path.join(__dirname, f)], { encoding: 'utf8' }));
  } catch (e) {
    bad++;
    process.stdout.write((e.stdout || '') + (e.stderr || ''));
    console.log('>>> ' + f + ' 失敗');
  }
}
console.log('\n===== ' + (bad ? bad + ' ファイル失敗' : '全ファイル成功') + ' =====');
process.exit(bad ? 1 : 0);
