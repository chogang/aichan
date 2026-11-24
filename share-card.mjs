import { selectShareDay, shareContent } from './share-data.mjs';

const chartColors = {
  FTR: ['#342735', '#e9a5e6'],
  ETR: ['#252d45', '#b6c7ff'],
  BYD: ['#40272f', '#ffadb3'],
  INS: ['#403321', '#ffd18a']
};
const maxJacketBytes = 512 * 1024;

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character]);
}

function truncateTitle(title) {
  let width = 0;
  let result = '';
  for (const character of title) {
    width += /[\u3000-\u9fff\uf900-\ufaff\uff01-\uff60]/u.test(character) ? 2 : 1;
    if (width > 48) return `${result}…`;
    result += character;
  }
  return result;
}

function jacketDataUrl(bytes) {
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + 8192)));
  }
  return `data:image/jpeg;base64,${btoa(chunks.join(''))}`;
}

function songRow(song, index, bytes) {
  const y = 136 + index * 152;
  const charts = song.difficulties.map(({ difficulty, level }, chartIndex) => {
    const [background, color] = chartColors[difficulty];
    const x = chartIndex * 137;
    return `<g transform="translate(${x} 64)">
      <rect width="124" height="34" rx="8" fill="${background}"/>
      <text x="62" y="24" text-anchor="middle" font-size="19" fill="${color}">${difficulty} ${escapeXml(level)}</text>
    </g>`;
  }).join('');
  const accessLabel = song.access === 'free' ? 'FREE' : 'PAID';
  const access = song.access ? `<g transform="translate(1024 24)">
    <rect width="84" height="28" rx="7" fill="${song.access === 'free' ? '#45454b' : 'none'}" stroke="#6d6d76"/>
    <text x="42" y="19" text-anchor="middle" fill="#e6e6ea" font-size="14" letter-spacing="1">${accessLabel}</text>
  </g>` : '';
  const jacket = bytes ? `<image href="${jacketDataUrl(bytes)}" width="112" height="112" preserveAspectRatio="xMidYMid slice"/>` : '';

  return `<g transform="translate(36 ${y})">
    <rect width="1128" height="140" rx="16" fill="#2a2a2e" stroke="#444449"/>
    <g transform="translate(14 14)" clip-path="url(#jacket-clip)">
      <rect width="112" height="112" fill="#414147"/>
      <path d="M63 29v42c0 12-17 17-23 9-7-11 4-22 16-19V38l29-7v9z" fill="#888891"/>
      ${jacket}
    </g>
    <g transform="translate(154 0)">
      <text x="0" y="48" fill="#f7f7f8" font-size="31">${escapeXml(truncateTitle(song.title))}</text>
      ${charts}
      <text x="0" y="124" fill="#bfbfc7" font-size="19">${escapeXml(song.packName || '')}</text>
    </g>
    ${access}
  </g>`;
}

export function shareCardSvg({ day, songs }, jackets) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><clipPath id="jacket-clip"><rect width="112" height="112" rx="10"/></clipPath></defs>
    <rect width="1200" height="630" fill="#202023"/>
    <g font-family="AiChan Preview">
      <text x="36" y="58" font-size="22" fill="#bfbfc7" letter-spacing="1.2">ARCAEA</text>
      <text x="36" y="104" font-size="39" fill="#f7f7f8">Ai-chan recommendations</text>
      <text x="1164" y="102" font-size="34" fill="#e6e6ea" text-anchor="end">${escapeXml(day)}</text>
      ${songs.map((song, index) => songRow(song, index, jackets[index])).join('')}
      <text x="36" y="610" font-size="15" fill="#bfbfc7">Jacket artwork © lowiro</text>
    </g>
  </svg>`;
}

async function fetchJacket(url, fetchImage) {
  if (!/^https:\/\/webassets\.lowiro\.com\/[a-f0-9]{32}\.jpg\?v=323$/.test(url)) return null;
  try {
    const response = await fetchImage(url, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
    if (!response.ok || !/^image\/jpeg(?:;|$)/i.test(response.headers.get('content-type') || '')) return null;
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxJacketBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes[0] === 0xff && bytes[1] === 0xd8 ? bytes : null;
  } catch {
    return null;
  }
}

export async function handleShareCard(request, renderPng, {
  cache, waitUntil, fetchImage = fetch, now = Date.now()
} = {}) {
  let selection;
  try {
    selection = selectShareDay(request, now);
  } catch (error) {
    return new Response(error.message, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(request.url);
  const hasDate = url.searchParams.has('date');
  url.search = new URLSearchParams({ date: selection.day }).toString();
  const cacheKey = new Request(url);
  let datedResponse = await cache?.match(cacheKey);
  if (!datedResponse) {
    const content = shareContent(selection);
    const jackets = await Promise.all(content.songs.map(song => fetchJacket(song.jacketUrl, fetchImage)));
    const complete = content.songs.every((song, index) => !song.jacketUrl || jackets[index]);
    const png = await renderPng(shareCardSvg(content, jackets));
    datedResponse = new Response(png, { headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${complete ? 86400 : 300}`
    } });
    if (cache && waitUntil) waitUntil(cache.put(cacheKey, datedResponse.clone()).catch(() => {}));
  }
  if (hasDate) return datedResponse;
  const headers = new Headers(datedResponse.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(datedResponse.body, { headers });
}
