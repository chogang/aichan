// Arcaea 7.3.0 skill_aichan static reproduction. No network or game execution.
const fs = require('fs');
const path = require('path');

function permutation(seed) {
  const values = Array.from({ length: 5000 }, (_, i) => i);
  let x = seed, y = seed, z = seed;
  const f = Math.fround;
  for (let i = 4999; i > 0; i--) {
    x = x * 171 % 30269;
    y = y * 172 % 30307;
    z = z * 170 % 30323;
    let r = f(f(f(f(x) / f(30269)) + f(f(y) / f(30307))) + f(f(z) / f(30323)));
    r = f(r % 1);
    const j = Math.trunc(f(r * f(i)));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function recommend(songs, seed) {
  const byIndex = new Map(songs.map(song => [song.idx, song]));
  if (byIndex.size !== songs.length) throw new Error('Duplicate song idx');
  let base = 1, other = 2;
  const selected = [];
  for (const idx of permutation(seed)) {
    const song = byIndex.get(idx);
    if (!song || song.id === 'lasteternity') continue;
    const isBase = song.set === 'base' || song.id === 'innocence';
    if ((isBase && base > 0) || (!isBase && other > 0)) {
      selected.push({ idx, id: song.id, title: song.title_localized, artist: song.artist, set: song.set });
      if (isBase) base--; else other--;
    }
    if (base === 0 && other === 0) break;
  }
  if (selected.length !== 3) throw new Error('Catalogue does not supply all three recommendations');
  return selected;
}

function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--date', '--seed', '--catalog'].includes(args[i]) || !args[i + 1]) {
      throw new Error('Usage: node aichan-recommend.js [--date ISO8601-with-timezone | --seed integer] [--catalog songlist.json]');
    }
    if (options[args[i]]) throw new Error('Duplicate option');
    options[args[i]] = args[i + 1];
  }
  if (options['--date'] && options['--seed']) throw new Error('Choose --date or --seed');
  if (options['--date'] && !/(Z|[+-]\d\d:\d\d)$/.test(options['--date'])) throw new Error('--date requires a time zone');
  const time = options['--date'] ? Date.parse(options['--date']) : Date.now();
  if (!Number.isFinite(time)) throw new Error('Invalid date');
  const seed = options['--seed'] ? Number(options['--seed']) : Math.floor((time + 14400000) / 86400000);
  if (!Number.isInteger(seed) || seed < 20400 || seed > 10000000) throw new Error('Invalid or unsupported day index');
  const catalog = options['--catalog'] || path.join(__dirname, 'songlist.json');
  const songs = JSON.parse(fs.readFileSync(catalog, 'utf8')).songs;
  const start = seed * 86400000 - 14400000;
  console.log(JSON.stringify({
    character_id: 75, skill_id: 'skill_aichan', game_version: '7.3.0',
    method: 'static_algorithm_reproduction; not observed in a running game',
    day_index: seed,
    effective_period_utc: { from: new Date(start).toISOString(), until_exclusive: new Date(start + 86400000).toISOString() },
    server_time_offset_assumed_ms: 0,
    songs: recommend(songs, seed)
  }, null, 2));
}
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { permutation, recommend };
