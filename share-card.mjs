import { selectShareDay, shareCardVersion, shareContent } from './share-data.mjs';

const chartColors = {
  FTR: ['#342735', '#e9a5e6'],
  ETR: ['#252d45', '#b6c7ff'],
  BYD: ['#40272f', '#ffadb3'],
  INS: ['#403321', '#ffd18a']
};
const maxJacketBytes = 512 * 1024;
const jacketSize = 302;
const jacketInset = 33;

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character]);
}

function textWidth(text) {
  let width = 0;
  for (const character of text) {
    if (/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff\uff01-\uff60]/u.test(character)) width += 1;
    else if (/\s/u.test(character)) width += 0.25;
    else if (/[mwMW@%]/u.test(character)) width += 0.99;
    else if (/[fijlrIt'!.,:;|]/u.test(character)) width += 0.43;
    else if (/[a-z0-9]/u.test(character)) width += 0.64;
    else width += 0.73;
  }
  return width;
}

function fitText(text, lineWidth, maxLines) {
  const lines = [];
  let rest = [...text.trim()];
  while (rest.length && lines.length < maxLines) {
    const isLastLine = lines.length === maxLines - 1;
    let end = 0;
    while (end < rest.length && textWidth(rest.slice(0, end + 1).join('')) <= lineWidth) end++;
    if (end === rest.length) {
      lines.push(rest.join(''));
      break;
    }
    if (isLastLine) {
      while (end && textWidth(rest.slice(0, end).join('') + '…') > lineWidth) end--;
      lines.push(rest.slice(0, end).join('').trimEnd() + '…');
      break;
    }
    const space = rest.slice(0, end + 1).lastIndexOf(' ');
    if (space > 0) end = space;
    lines.push(rest.slice(0, end).join('').trimEnd());
    rest = [...rest.slice(end).join('').trimStart()];
  }
  return lines;
}

function jacketDataUrl(bytes) {
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + 8192)));
  }
  return `data:image/jpeg;base64,${btoa(chunks.join(''))}`;
}

function songCard(song, index, bytes, labels) {
  const x = 36 + index * 380;
  const title = fitText(song.title, 12.8, 2).map((line, lineIndex) =>
    `<text x="184" y="${383 + lineIndex * 28}" text-anchor="middle" fill="#f7f7f8" font-size="25">${escapeXml(line)}</text>`
  ).join('');
  const charts = song.difficulties.map(({ difficulty, level }, chartIndex) => {
    const [background, color] = chartColors[difficulty];
    return `<g transform="translate(${19 + chartIndex * 81} 429)">
      <rect width="74" height="31" rx="7" fill="${background}" stroke="${color}" stroke-opacity=".65"/>
      <text x="37" y="21" text-anchor="middle" font-size="16" fill="${color}">${difficulty} ${escapeXml(level)}</text>
    </g>`;
  }).join('');
  const accessLabel = labels[song.access];
  const access = accessLabel ? `<g transform="translate(276 -1)">
    <rect width="84" height="28" rx="7" fill="${song.access === 'free' ? '#e8e8ed' : '#25252a'}" stroke="#92929c"/>
    <text x="42" y="19" text-anchor="middle" fill="${song.access === 'free' ? '#232329' : '#f3f3f5'}" font-size="15">${escapeXml(accessLabel)}</text>
  </g>` : '';
  const pack = fitText(song.packName, accessLabel ? 13.5 : 19, 2);
  const packFontSize = accessLabel ? Math.min(15, Math.floor(170 / Math.max(1, ...pack.map(textWidth)))) : 15;
  const packText = pack.map((line, i) =>
    `<text x="184" y="${pack.length === 1 ? 18 : 10 + i * 17}" text-anchor="middle" font-size="${packFontSize}" fill="#f3f3f5">${escapeXml(line)}</text>`
  ).join('');
  const jacket = bytes ? `<image href="${jacketDataUrl(bytes)}" width="${jacketSize}" height="${jacketSize}" preserveAspectRatio="xMidYMid slice"/>` : '';

  return `<g transform="translate(${x} 105)">
    <rect y="-11" width="368" height="485" rx="15" fill="#2a2a2e" stroke="#48484f"/>
    <g transform="translate(${jacketInset} ${jacketInset})" clip-path="url(#jacket-clip)">
      <rect width="${jacketSize}" height="${jacketSize}" fill="#414147"/>
      <path transform="translate(85 82) scale(1.16)" d="M63 29v42c0 12-17 17-23 9-7-11 4-22 16-19V38l29-7v9z" fill="#888891"/>
      ${jacket}
    </g>
    ${access}
    ${packText}
    ${title}
    ${charts}
  </g>`;
}

export function shareCardSvg({ day, songs, labels }, jackets) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><clipPath id="jacket-clip"><rect width="${jacketSize}" height="${jacketSize}" rx="9"/></clipPath></defs>
    <rect width="1200" height="630" fill="#202023"/>
    <g font-family="AiChan Preview, AiChan Hangul, AiChan Han">
      <text x="36" y="39" font-size="16" fill="#bfbfc7" letter-spacing="1.2">ARCAEA</text>
      <text x="36" y="81" font-size="35" fill="#f7f7f8">${escapeXml(labels.title)}</text>
      <text x="1164" y="80" font-size="31" fill="#e6e6ea" text-anchor="end">${escapeXml(day)}</text>
      ${songs.map((song, index) => songCard(song, index, jackets[index], labels)).join('')}
      <text x="36" y="609" font-size="15" fill="#bfbfc7">${escapeXml(labels.jacketCredit)}</text>
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
  const url = new URL(request.url);
  const versions = url.searchParams.getAll('v');
  if (versions.length === 1 && versions[0] === shareCardVersion) url.searchParams.delete('v');
  let selection;
  try {
    selection = selectShareDay(new Request(url), now);
  } catch (error) {
    return new Response(error.message, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const hasDate = url.searchParams.has('date');
  url.search = new URLSearchParams({ date: selection.day, lang: selection.locale, v: shareCardVersion }).toString();
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
