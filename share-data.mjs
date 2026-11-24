import core from './recommendations.cjs';
import catalog from './songlist.json' with { type: 'json' };
import songDifficulties from './song-difficulties.json' with { type: 'json' };
import jacketHashes from './song-jackets.json' with { type: 'json' };

export const shareOrigin = 'https://arcaea-aichan-api.pages.dev';
export const viewerOrigin = 'https://chogang.github.io/aichan/';

const highestPageDay = core.calendarDayIndex('2099-12-31');
const previewDifficulties = new Set(['FTR', 'ETR', 'BYD', 'INS']);
const songsById = new Map(catalog.songs.map(song => [song.id, song]));

export function selectShareDay(request, now = Date.now()) {
  const keys = [...new URL(request.url).searchParams];
  if (keys.length > 1 || (keys.length === 1 && keys[0][0] !== 'date')) {
    throw new Error('Supply at most one date.');
  }
  const seed = keys.length ? core.calendarDayIndex(keys[0][1]) : core.dayIndex(now);
  if (!core.isDayIndex(seed) || seed > highestPageDay) {
    throw new Error('date must be between 2025-11-08 and 2099-12-31.');
  }
  return { day: new Date(seed * 86400000).toISOString().slice(0, 10), seed };
}

export function shareContent({ day, seed }) {
  const songs = core.recommend(catalog.songs, seed).map(song => {
    const hash = jacketHashes[song.id];
    const { purchase } = songsById.get(song.id);
    const titles = song.title || {};
    const packName = catalog.packNames?.[song.set] || song.set || '';
    return {
      id: song.id,
      title: titles.en || titles.ja || Object.values(titles)[0] || song.id,
      packName: packName === '개별곡 (single)' ? 'Singles' : packName,
      access: typeof purchase === 'string' ? (purchase ? 'purchase' : 'free') : null,
      jacketUrl: typeof hash === 'string' && /^[a-f0-9]{32}$/.test(hash) ? `https://webassets.lowiro.com/${hash}.jpg?v=323` : null,
      difficulties: (songDifficulties[song.id] || []).filter(chart => previewDifficulties.has(chart.difficulty))
    };
  });
  return { day, seed, songs };
}
