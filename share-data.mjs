import core from './recommendations.cjs';
import catalog from './songlist.json' with { type: 'json' };
import songDifficulties from './song-difficulties.json' with { type: 'json' };
import jacketHashes from './song-jackets.json' with { type: 'json' };
import shareLocales from './share-locales.json' with { type: 'json' };

export const shareOrigin = 'https://arcaea-aichan-api.pages.dev';
export const viewerOrigin = 'https://chogang.github.io/aichan/';
export const shareCardVersion = '2';
export const shareCardRevision = '7';

const highestPageDay = core.calendarDayIndex('2099-12-31');
const previewDifficulties = new Set(['FTR', 'ETR', 'BYD', 'INS']);
const songsById = new Map(catalog.songs.map(song => [song.id, song]));

export function selectShareDay(request, now = Date.now()) {
  const params = new URL(request.url).searchParams;
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length || keys.some(key => key !== 'date' && key !== 'lang')) {
    throw new Error('Supply at most one date and one lang.');
  }
  const locale = params.get('lang') ?? 'ko';
  if (!Object.hasOwn(shareLocales, locale)) throw new Error('lang must be ko, en, ja, or zh-Hans.');
  const seed = params.has('date') ? core.calendarDayIndex(params.get('date')) : core.dayIndex(now);
  if (!core.isDayIndex(seed) || seed > highestPageDay) {
    throw new Error('date must be between 2025-11-08 and 2099-12-31.');
  }
  return { day: new Date(seed * 86400000).toISOString().slice(0, 10), seed, locale };
}

export function shareContent({ day, seed, locale }) {
  const labels = shareLocales[locale];
  const songs = core.recommend(catalog.songs, seed).map(song => {
    const hash = jacketHashes[song.id];
    const { purchase } = songsById.get(song.id);
    const titles = song.title || {};
    const packName = catalog.packNames?.[song.set] || song.set || '';
    return {
      id: song.id,
      title: titles[locale] || titles.en || titles.ja || Object.values(titles)[0] || song.id,
      packName: song.set === 'single' ? labels.singles : packName,
      access: typeof purchase === 'string' ? (purchase ? 'purchase' : 'free') : null,
      jacketUrl: typeof hash === 'string' && /^[a-f0-9]{32}$/.test(hash) ? `https://webassets.lowiro.com/${hash}.jpg?v=323` : null,
      difficulties: (songDifficulties[song.id] || []).filter(chart => previewDifficulties.has(chart.difficulty))
    };
  });
  return { day, seed, locale, labels, songs };
}
