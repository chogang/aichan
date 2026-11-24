import { randomUUID } from 'node:crypto';
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import catalogUpdater from './update-catalog.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const rankings = [
  'https://webapi.lowiro.com/webapi/song/rank/free',
  'https://webapi.lowiro.com/webapi/song/rank/paid'
];
const songId = /^[a-zA-Z0-9_.-]+$/;
const jacketHash = /^[a-f0-9]{32}$/;

async function readRanking(url, request) {
  const response = await request(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Official ranking returned HTTP ${response.status}: ${url}`);
  const payload = await response.json();
  if (payload?.success !== true || !Array.isArray(payload.value) || payload.value.length === 0) {
    throw new Error(`Unexpected ranking response: ${url}`);
  }
  const pairs = [];
  for (const row of payload.value) {
    if (typeof row?.song_id !== 'string' || !songId.test(row.song_id)) {
      throw new Error(`Invalid song ID in official ranking: ${url}`);
    }
    if (row.bg === '' || row.bg == null) continue;
    if (typeof row.bg !== 'string' || !jacketHash.test(row.bg)) {
      throw new Error(`Invalid jacket hash for ${row.song_id}: ${url}`);
    }
    pairs.push([row.song_id, row.bg]);
  }
  return pairs;
}

export async function updateRankingJackets({ dryRun = false, directory = root, request = fetch } = {}) {
  const batches = await Promise.all(rankings.map(url => readRanking(url, request)));
  const jackets = catalogUpdater.readSongJackets(directory);
  const candidates = new Map();
  const conflicts = new Set();
  for (const [id, hash] of batches.flat()) {
    if (jackets.has(id)) continue;
    if (candidates.has(id) && candidates.get(id) !== hash) conflicts.add(id);
    else candidates.set(id, hash);
  }
  for (const id of conflicts) candidates.delete(id);

  if (candidates.size && !dryRun) {
    const target = join(directory, 'song-jackets.json');
    const temporary = `${target}.${randomUUID()}.tmp`;
    const updates = [...jackets, ...candidates].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    try {
      writeFileSync(temporary, JSON.stringify(Object.fromEntries(updates), null, 2) + '\n', { flag: 'wx' });
      renameSync(temporary, target);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
  return { added: [...candidates.keys()], conflicts: [...conflicts] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 1 || args[0] !== '--dry-run')) {
      throw new Error('Usage: node scripts/update-jackets-from-rankings.mjs [--dry-run]');
    }
    const dryRun = args.length === 1;
    const { added, conflicts } = await updateRankingJackets({ dryRun });
    if (conflicts.length) console.warn(`Skipped conflicting jacket hashes: ${conflicts.join(', ')}`);
    console.log(added.length
      ? `${dryRun ? 'Would add' : 'Added'} ${added.length} ranked jacket hashes: ${added.join(', ')}`
      : 'No new ranked jacket hashes.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
