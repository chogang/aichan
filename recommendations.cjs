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

function dayIndex(time) {
  return Math.floor((time + 14400000) / 86400000);
}

function calendarDayIndex(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('date must use YYYY-MM-DD.');
  const midnight = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== value) {
    throw new Error('date must be a valid calendar date.');
  }
  // The UTC calendar-day index is the recommendation index starting at 05:00 KST.
  return dayIndex(midnight);
}

function isDayIndex(seed) {
  return Number.isInteger(seed) && seed >= 20400 && seed <= 10000000;
}

function recommendationResponse(songs, seed) {
  const start = seed * 86400000 - 14400000;
  return {
    character_id: 75, skill_id: 'skill_aichan', game_version: '7.3.0',
    method: 'static_algorithm_reproduction; not observed in a running game',
    day_index: seed,
    effective_period_utc: { from: new Date(start).toISOString(), until_exclusive: new Date(start + 86400000).toISOString() },
    server_time_offset_assumed_ms: 0,
    songs: recommend(songs, seed)
  };
}

module.exports = { calendarDayIndex, dayIndex, isDayIndex, permutation, recommend, recommendationResponse };
