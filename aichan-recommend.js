// Arcaea 7.3.0 skill_aichan static reproduction. No network or game execution.
const fs = require('fs');
const path = require('path');

const { dayIndex, isDayIndex, permutation, recommend, recommendationResponse } = require('./recommendations.cjs');

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
  const seed = options['--seed'] ? Number(options['--seed']) : dayIndex(time);
  if (!isDayIndex(seed)) throw new Error('Invalid or unsupported day index');
  const catalog = options['--catalog'] || path.join(__dirname, 'songlist.json');
  const songs = JSON.parse(fs.readFileSync(catalog, 'utf8')).songs;
  console.log(JSON.stringify(recommendationResponse(songs, seed), null, 2));
}
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { permutation, recommend };
