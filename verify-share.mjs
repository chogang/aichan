import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sharePage } from './functions/share.js';
import { selectShareDay, shareContent, shareOrigin, viewerOrigin } from './share-data.mjs';

const url = 'https://example.com/share';
const before = Date.parse('2026-11-18T04:59:59.999+09:00');
const after = Date.parse('2026-11-18T05:00:00.000+09:00');
const respond = (query, time, method = 'GET') => sharePage(new Request(url + query, { method }), time);

for (const [query, time, day, song] of [
  ['', before, '2026-11-17', 'MANTIS'],
  ['', after, '2026-11-18', '+1(UNKNOWN)-NUMBER'],
  ['?date=2026-11-18', before, '2026-11-18', '+1(UNKNOWN)-NUMBER']
]) {
  const response = respond(query, time);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.match(response.headers.get('content-type'), /^text\/html\b/);
  assert.equal(response.headers.get('cache-control'), query ? 'public, max-age=300' : 'no-store');
  const html = await response.text();
  assert.match(html, new RegExp(`<meta property="og:title" content="${day} `));
  assert.ok(html.includes(`<meta property="og:url" content="${shareOrigin}/share?date=${day}">`));
  assert.ok(html.includes(`<meta property="og:image" content="${shareOrigin}/share-card?date=${day}">`));
  assert.ok(html.includes('<meta property="og:image:type" content="image/png">'));
  assert.ok(html.includes('<meta property="og:image:width" content="1200">'));
  assert.ok(html.includes('<meta property="og:image:height" content="630">'));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(html.includes('<meta property="og:description"') && html.includes(song));
  assert.ok(html.includes(`id="viewer" href="${viewerOrigin}?date=${day}"`));
  assert.doesNotMatch(html, /http-equiv="refresh"/i);
  const script = /<script>([^<]+)<\/script>/.exec(html)[1];
  assert.equal(script, 'location.replace(document.getElementById("viewer").href)');
  const hash = createHash('sha256').update(script).digest('base64');
  assert.ok(response.headers.get('content-security-policy').includes(`'sha256-${hash}'`));
}

const selected = selectShareDay(new Request(url + '?date=2026-11-18'));
const { songs } = shareContent(selected);
assert.deepEqual(songs.map(({ id, access }) => [id, access]), [
  ['unknownnum', 'purchase'],
  ['ddd', 'free'],
  ['syriana', 'purchase']
]);
const outsideBase = shareContent(selectShareDay(new Request(url + '?date=2026-12-12'))).songs;
assert.equal(outsideBase.find(song => song.id === 'acheron')?.access, 'free');
assert.equal(songs[0].packName, 'Singles');
assert.equal(songs[2].packName, 'DJMAX / Collaboration Chapter 2');
assert.match(songs[0].jacketUrl, /^https:\/\/webassets\.lowiro\.com\/[a-f\d]{32}\.jpg\?v=323$/);
assert.deepEqual(songs[0].difficulties, [{ difficulty: 'FTR', level: '9+' }]);

for (const query of [
  '?date=', '?date=2026-11-8', '?date=2026-02-29', '?date=2025-11-07', '?date=2100-01-01',
  '?date=2026-11-18&date=2026-11-18', '?date=2026-11-18&seed=20775', '?seed=20775',
  '?date=%3Cscript%3E'
]) {
  const response = respond(query, before);
  assert.equal(response.status, 400, query);
  assert.doesNotMatch(await response.text(), /<script>/);
}

const head = respond('?date=2026-11-18', before, 'HEAD');
assert.equal(head.status, 200);
assert.equal(await head.text(), '');
const wrongMethod = respond('', before, 'POST');
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.headers.get('allow'), 'GET, HEAD');
console.log('Verified share metadata, recommendation date boundary, artwork and pack metadata, and request validation.');
