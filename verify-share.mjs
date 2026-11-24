import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sharePage } from './functions/share.js';
import { handleShareCard } from './share-card.mjs';
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
  assert.ok(html.includes(`<meta property="og:url" content="${shareOrigin}/share?date=${day}&amp;lang=ko">`));
  assert.ok(html.includes(`<meta property="og:image" content="${shareOrigin}/share-card?date=${day}&amp;lang=ko">`));
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
assert.equal(songs[0].packName, '개별곡');
assert.equal(songs[2].packName, 'DJMAX / Collaboration Chapter 2');
assert.match(songs[0].jacketUrl, /^https:\/\/webassets\.lowiro\.com\/[a-f\d]{32}\.jpg\?v=323$/);
assert.deepEqual(songs[0].difficulties, [{ difficulty: 'FTR', level: '9+' }]);

for (const [locale, ogLocale, title, access, single] of [
  ['ko', 'ko_KR', '아이쨩 추천곡', '유료', '개별곡'],
  ['en', 'en_US', 'Ai-chan recommendations', 'PAID', 'Singles'],
  ['ja', 'ja_JP', 'Ai-chanのおすすめ楽曲', '有料', 'シングル'],
  ['zh-Hans', 'zh_CN', 'Ai酱推荐曲目', '付费', '单曲']
]) {
  const html = await respond(`?lang=${locale}`, after).text();
  const query = `date=2026-11-18&amp;lang=${locale}`;
  assert.ok(html.includes(`<html lang="${locale}">`));
  assert.ok(html.includes(`property="og:locale" content="${ogLocale}"`));
  assert.ok(html.includes(`<title>2026-11-18 ${title} · Arcaea</title>`));
  assert.ok(html.includes(`· ${single} · ${access} · FTR`));
  assert.ok(html.includes(`content="${shareOrigin}/share-card?${query}"`));
  assert.ok(html.includes(`id="viewer" href="${viewerOrigin}?${query}"`));
}
const localizedTitles = await respond('?date=2026-02-18&lang=zh-Hans', after).text();
assert.match(localizedTitles, /One Step Closer · FTR[^|]+\| w4 · FTR/);

const cards = new Map();
let renders = 0;
const renderCard = async (query) => {
  const response = await handleShareCard(new Request(url + '-card' + query), svg => {
    renders++;
    return svg;
  }, {
    now: after,
    fetchImage: async () => new Response(null, { status: 404 }),
    cache: {
      match: request => cards.get(request.url)?.clone(),
      put: (request, response) => Promise.resolve(cards.set(request.url, response))
    },
    waitUntil: () => {}
  });
  assert.equal(response.status, 200);
  return response.text();
};
const koreanCard = await renderCard('?date=2026-11-18');
assert.match(koreanCard, /아이쨩 추천곡/);
assert.match(koreanCard, />개별곡</);
const japaneseCard = await renderCard('?lang=ja&date=2026-11-18');
assert.match(japaneseCard, /Ai-chanのおすすめ楽曲/);
assert.match(japaneseCard, />有料</);
assert.equal(await renderCard('?date=2026-11-18&lang=ja'), japaneseCard);
assert.equal(renders, 2);

for (const query of [
  '?date=', '?date=2026-11-8', '?date=2026-02-29', '?date=2025-11-07', '?date=2100-01-01',
  '?date=2026-11-18&date=2026-11-18', '?date=2026-11-18&seed=20775', '?seed=20775',
  '?date=%3Cscript%3E', '?lang=', '?lang=fr', '?lang=constructor', '?lang=ko&lang=ja'
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
console.log('Verified localized share metadata and card cache keys, recommendation date boundary, artwork and pack metadata, and request validation.');
