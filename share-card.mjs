import { selectShareDay, shareCardVersion, shareCardRevision, shareContent } from './share-data.mjs';

const chartColors = {
  FTR: ['#342735', '#e9a5e6'],
  ETR: ['#D8C9F0', '#39284F', '#dbcef1'],
  BYD: ['#BF0D25', '#fadee3'],
  INS: ['#4949a0', '#efefff']
};
const maxJacketBytes = 512 * 1024;
const jacketSize = 300;
const jacketInset = 30;
const cardWidth = jacketSize + 2 * jacketInset;
const jacketTop = 30;
const cardTop = -29;
const headerCenter = (cardTop + jacketTop) / 2;
const accessHeight = 34;
const titleAreaHeight = 76;
const titleLineHeight = 33;
const chartGap = 8;

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
    else if (/[a-z0-9]/u.test(character)) width += 0.60;
    else width += 0.73;
  }
  return width;
}

function fitText(text, lineWidth, maxLines, truncate = true) {
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
      if (!truncate) return null;
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
  const x = jacketInset + index * (cardWidth + jacketInset);
  const center = cardWidth / 2;
  const titleTop = jacketTop + jacketSize;
  let titleSize = 30;
  let titleLines = fitText(song.title, jacketSize / titleSize, 2, false);
  while (!titleLines && titleSize > 24) {
    titleSize--;
    titleLines = fitText(song.title, jacketSize / titleSize, 2, false);
  }
  titleLines ??= fitText(song.title, jacketSize / titleSize, 2);
  const titleBaseline = titleTop + (titleAreaHeight - (titleLines.length - 1) * titleLineHeight) / 2 + Math.round(titleSize * .34);
  const title = titleLines.map((line, lineIndex) =>
    `<text x="${center}" y="${titleBaseline + lineIndex * titleLineHeight}" text-anchor="middle" fill="#f7f7f8" font-size="${titleSize}">${escapeXml(line)}</text>`
  ).join('');
  const chartCount = song.difficulties.length;
  const chartWidth = Math.min(92, Math.floor((cardWidth - 2 * chartGap - (chartCount - 1) * chartGap) / Math.max(1, chartCount)));
  const chartStart = (cardWidth - (chartCount * chartWidth + (chartCount - 1) * chartGap)) / 2;
  const chartTop = titleTop + titleAreaHeight;
  const charts = song.difficulties.map(({ difficulty, level }, chartIndex) => {
    const [background, color, border = color] = chartColors[difficulty];
    return `<g transform="translate(${chartStart + chartIndex * (chartWidth + chartGap)} ${chartTop})">
      <rect width="${chartWidth}" height="36" rx="7" fill="${background}" stroke="${border}" stroke-opacity=".65"/>
      <text x="${chartWidth / 2}" y="25" text-anchor="middle" font-size="20" fill="${color}">${difficulty} ${escapeXml(level)}</text>
    </g>`;
  }).join('');
  const accessLabel = labels[song.access];
  const accessX = cardWidth - 84 - 8;
  const access = accessLabel ? `<g transform="translate(${accessX} ${headerCenter - accessHeight / 2})">
    <rect width="84" height="${accessHeight}" rx="7" fill="${song.access === 'free' ? '#e8e8ed' : '#25252a'}" stroke="#92929c"/>
    <text x="42" y="22" text-anchor="middle" fill="${song.access === 'free' ? '#232329' : '#f3f3f5'}" font-size="15">${escapeXml(accessLabel)}</text>
  </g>` : '';
  const pack = fitText(song.packName, (accessLabel ? accessX - jacketInset - 8 : jacketSize) / 18, 3);
  const packLineHeight = 19;
  const packBaseline = headerCenter + 6 - (pack.length - 1) * packLineHeight / 2;
  const packText = pack.map((line, i) =>
    `<text x="${jacketInset}" y="${packBaseline + i * packLineHeight}" font-size="18" fill="#f3f3f5">${escapeXml(line)}</text>`
  ).join('');
  const jacket = bytes ? `<image href="${jacketDataUrl(bytes)}" width="${jacketSize}" height="${jacketSize}" preserveAspectRatio="xMidYMid slice"/>` : '';

  return `<g transform="translate(${x} 105)">
    <rect y="${cardTop}" width="${cardWidth}" height="503" rx="15" fill="#2a2a2e" stroke="#48484f"/>
    <g transform="translate(${jacketInset} ${jacketTop})" clip-path="url(#jacket-clip)">
      <rect width="${jacketSize}" height="${jacketSize}" fill="#414147"/>
      <path transform="translate(84 81) scale(1.16)" d="M63 29v42c0 12-17 17-23 9-7-11 4-22 16-19V38l29-7v9z" fill="#888891"/>
      ${jacket}
    </g>
    ${access}
    ${packText}
    ${title}
    ${charts}
  </g>`;
}

function songRow(song, index, bytes, labels) {
  const charts = song.difficulties.map(({ difficulty, level }, chartIndex) => {
    const [background, color] = chartColors[difficulty];
    return `<g transform="translate(${chartIndex * 137} 64)">
      <rect width="124" height="34" rx="8" fill="${background}"/>
      <text x="62" y="24" text-anchor="middle" font-size="19" fill="${color}">${difficulty} ${escapeXml(level)}</text>
    </g>`;
  }).join('');
  const accessLabel = labels[song.access];
  const access = accessLabel ? `<g transform="translate(1024 21)">
    <rect width="84" height="${accessHeight}" rx="7" fill="${song.access === 'free' ? '#45454b' : 'none'}" stroke="#6d6d76"/>
    <text x="42" y="22" text-anchor="middle" fill="#e6e6ea" font-size="14" letter-spacing="1">${escapeXml(accessLabel)}</text>
  </g>` : '';
  const jacket = bytes ? `<image href="${jacketDataUrl(bytes)}" width="112" height="112" preserveAspectRatio="xMidYMid slice"/>` : '';
  return `<g transform="translate(36 ${136 + index * 152})">
    <rect width="1128" height="140" rx="16" fill="#2a2a2e" stroke="#444449"/>
    <g transform="translate(14 14)" clip-path="url(#jacket-clip)">
      <rect width="112" height="112" fill="#414147"/>
      <path d="M63 29v42c0 12-17 17-23 9-7-11 4-22 16-19V38l29-7v9z" fill="#888891"/>
      ${jacket}
    </g>
    <g transform="translate(154 0)">
      <text x="0" y="48" fill="#f7f7f8" font-size="31">${escapeXml(fitText(song.title, 27, 1)[0] || '')}</text>
      ${charts}
      <text x="0" y="124" fill="#bfbfc7" font-size="19">${escapeXml(song.packName)}</text>
    </g>
    ${access}
  </g>`;
}

export function shareCardSvg({ day, songs, labels }, jackets, layout = '2') {
  const list = layout === '1';
  const coverSize = list ? 112 : jacketSize;
  const drawSong = list ? songRow : songCard;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><clipPath id="jacket-clip"><rect width="${coverSize}" height="${coverSize}" rx="${list ? 10 : 9}"/></clipPath></defs>
    <rect width="1200" height="630" fill="#202023"/>
    <g font-family="AiChan Preview, AiChan Hangul, AiChan Han">
      <text x="36" y="${list ? 58 : 21}" font-size="${list ? 22 : 16}" fill="#bfbfc7" letter-spacing="1.2">ARCAEA</text>
      <text x="36" y="${list ? 104 : 63}" font-size="${list ? 39 : 35}" fill="#f7f7f8">${escapeXml(labels.title)}</text>
      <text x="1164" y="${list ? 102 : 62}" font-size="${list ? 34 : 31}" fill="#e6e6ea" text-anchor="end">${escapeXml(day)}</text>
      ${songs.map((song, index) => drawSong(song, index, jackets[index], labels)).join('')}
      <text x="36" y="${list ? 610 : 609}" font-size="15" fill="#bfbfc7">${escapeXml(labels.jacketCredit)}</text>
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
  if (versions.length === 1 && /^\d+$/.test(versions[0])) url.searchParams.delete('v');
  const revisions = url.searchParams.getAll('rev');
  if (revisions.length === 1 && /^\d+$/.test(revisions[0])) url.searchParams.delete('rev');
  const layout = versions[0] === '1' ? '1' : shareCardVersion;
  let selection;
  try {
    selection = selectShareDay(new Request(url), now);
  } catch (error) {
    return new Response(error.message, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const hasDate = url.searchParams.has('date');
  url.search = new URLSearchParams({ date: selection.day, lang: selection.locale, v: layout, rev: shareCardRevision }).toString();
  const cacheKey = new Request(url);
  let datedResponse = await cache?.match(cacheKey);
  if (!datedResponse) {
    const content = shareContent(selection);
    const jackets = await Promise.all(content.songs.map(song => fetchJacket(song.jacketUrl, fetchImage)));
    const complete = content.songs.every((song, index) => !song.jacketUrl || jackets[index]);
    const png = await renderPng(shareCardSvg(content, jackets, layout));
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
