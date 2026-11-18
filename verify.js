const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const { permutation } = require('./aichan-recommend.js');
const { songs } = require('./songlist.json');

const seeds = Array.from({ length: 40 }, (_, i) => 17000 + i * 113)
  .concat(20774, 20775, 20776);
const javaOutput = execFileSync(
  process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java',
  [join(__dirname, 'AichanFloatCheck.java'), ...seeds.map(String)],
  { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
).trim().split(/\r?\n/);
assert.equal(javaOutput.length, seeds.length);
for (const [i, seed] of seeds.entries()) {
  assert.deepEqual(permutation(seed), JSON.parse(javaOutput[i]), `Shuffle mismatch at seed ${seed}`);
}

assert.equal(songs.length, 570);
assert.equal(new Set(songs.map(song => song.idx)).size, songs.length);
for (const [date, seed, ids] of [
  ['2026-11-18T04:59:59.999+09:00', 20774, ['mantis', 'callmyname', 'diode']],
  ['2026-11-18T05:00:00.000+09:00', 20775, ['unknownnum', 'ddd', 'syriana']]
]) {
  const output = execFileSync(process.execPath, [
    join(__dirname, 'aichan-recommend.js'), '--date', date
  ], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.day_index, seed);
  assert.deepEqual(result.songs.map(song => song.id), ids);
}

console.log('Verified 43 shuffles (215,000 indices), 570 unique song indices, and both sides of the 05:00 KST boundary.');
