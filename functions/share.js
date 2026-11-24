import { selectShareDay, shareContent, shareCardVersion, shareOrigin, viewerOrigin } from '../share-data.mjs';

const forward = 'location.replace(document.getElementById("viewer").href)';
const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; script-src 'sha256-6WApDpDbE+4hFHvsYNwk+liJ+ji/6N0o4j8QP34IOiY='; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};
const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = value => String(value).replace(/[&<>"']/g, character => escapes[character]);

export function onRequest({ request }) {
  return sharePage(request);
}

export function sharePage(request, now = Date.now()) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Use GET or HEAD.', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const respond = (body, status = 200, cache = 'no-store') => new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers: { ...headers, 'Cache-Control': cache }
  });
  let selected;
  try {
    selected = selectShareDay(request, now);
  } catch (error) {
    return respond(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Invalid date</title><p>${escape(error.message)}</p><a href="${viewerOrigin}">Open the viewer</a></html>`, 400);
  }
  const { day, locale, labels, songs } = shareContent(selected);
  const title = `${day} ${labels.title} · Arcaea`;
  const chartLabels = song => song.difficulties.map(({ difficulty, level }) => `${difficulty} ${level}`);
  const description = songs.map(song => [song.title, ...chartLabels(song)].join(' · ')).join(' | ');
  const imageDescription = songs.map(song => [
    song.title, song.packName, labels[song.access], ...chartLabels(song)
  ].filter(Boolean).join(' · ')).join(' | ');
  const requested = new URL(request.url).searchParams;
  const query = `date=${day}&lang=${locale}`;
  const canonical = escape(`${shareOrigin}/share?${query}`);
  const image = escape(`${shareOrigin}/share-card?${query}&v=${shareCardVersion}`);
  const viewer = escape(`${viewerOrigin}?${requested.has('lang') ? query : 'date=' + day}`);
  return respond(`<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <link rel="canonical" href="${canonical}">
  <meta name="description" content="${escape(description)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${labels.ogLocale}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escape(title + ' | ' + imageDescription)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${escape(title + ' | ' + imageDescription)}">
</head>
<body>
  <main>
    <h1>${escape(title)}</h1>
    <a id="viewer" href="${viewer}">${escape(labels.openViewer)}</a>
  </main>
  <script>${forward}</script>
</body>
</html>`, 200, requested.has('date') ? 'public, max-age=300' : 'no-store');
}
