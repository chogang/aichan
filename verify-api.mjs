import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleRequest } from './api.mjs';
import catalog from './songlist.json' with { type: 'json' };
import songDifficulties from './song-difficulties.json' with { type: 'json' };
import catalogUpdater from './scripts/update-catalog.cjs';

const endpoint = 'https://example.com/api/recommendations';
const cli = fileURLToPath(new URL('./aichan-recommend.js', import.meta.url));
const cliResult = point => JSON.parse(execFileSync(process.execPath, [cli, '--date', point], { encoding: 'utf8' }));
const before = '2026-11-18T04:59:59.999+09:00';
const after = '2026-11-18T05:00:00.000+09:00';
const viewer = readFileSync(new URL('./docs/index.html', import.meta.url), 'utf8');
const { songs: viewerSongs, metadata: viewerMetadata } = catalogUpdater.readViewerCatalog(viewer);
assert.deepEqual(viewerSongs, catalog.songs);
assert.deepEqual(Object.keys(viewerMetadata).sort(), catalog.songs.map(song => song.id).sort());
const jackets = catalogUpdater.readSongJackets();
for (const { id } of catalog.songs) assert.equal(viewerMetadata[id].jacket_hash, jackets.get(id), `Jacket hash for ${id}`);
const labels = { 0: 'PST', 1: 'PRS', 2: 'FTR', 3: 'BYD', 4: 'ETR' };
const order = [0, 1, 2, 4, 3];
const expectedDifficulties = Object.fromEntries(catalog.songs.map(({ id }) => [id,
  [...viewerMetadata[id].difficulties].sort((a, b) => order.indexOf(a.ratingClass) - order.indexOf(b.ratingClass))
  .map(({ ratingClass, ratingClassAlias, rating, ratingPlus }) => ({
    difficulty: ratingClass === 3 && ratingClassAlias === 1 ? 'INS' : labels[ratingClass],
    level: `${rating}${ratingPlus ? '+' : ''}`
  }))
]));
assert.deepEqual(songDifficulties, expectedDifficulties);
const fixtures = [
  ['', before, cliResult(before)],
  ['', after, cliResult(after)],
  ['?date=2026-11-18', before, cliResult(after)],
  ['?seed=20775', before, cliResult(after)]
];

for (const [query, clock, expected] of fixtures) {
  const response = handleRequest(new Request(endpoint + query), Date.parse(clock));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json\b/);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const json = await response.json();
  const songs = json.songs.map(({ difficulties, ...song }) => {
    assert.deepEqual(difficulties, expectedDifficulties[song.id]);
    return song;
  });
  assert.deepEqual({ ...json, songs }, expected);
}

for (const query of [
  '?date=2026-02-29', '?date=2026-11-31', '?date=2026-11-8', '?date=', '?date=2020-01-01',
  '?seed=', '?seed=2e5', '?seed=20775.0', '?seed=20399', '?seed=10000001',
  '?seed=20775&seed=20776', '?date=2026-11-18&date=2026-11-18', '?date=2026-11-18&seed=20775', '?day=1'
]) {
  const response = handleRequest(new Request(endpoint + query));
  assert.equal(response.status, 400, query);
  assert.equal(typeof (await response.json()).error, 'string');
}

const wrongMethod = handleRequest(new Request(endpoint, { method: 'POST' }));
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.headers.get('allow'), 'GET');
assert.equal(handleRequest(new Request('https://example.com/')).status, 404);
console.log('Verified CLI fields, viewer difficulties for all catalog songs, daily boundary, deterministic inputs, and HTTP errors.');
