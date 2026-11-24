const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { recommend } = require('../recommendations.cjs');

const root = path.resolve(__dirname, '..');
const block = /(<script type="application\/octet-stream" id="viewer-catalog">)([0-9a-f]+)(<\/script>)/g;
const kinds = new Map([[0, 'PST'], [1, 'PRS'], [2, 'FTR'], [4, 'ETR'], [3, 'BYD']]);
const kindOrder = [...kinds.keys()];
const idPattern = /^[a-zA-Z0-9_.-]+$/;
const jacketPattern = /^[a-f0-9]{32}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = text => { throw new Error(text); };

function encodeCatalog(catalog) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  return Buffer.concat([key, iv, cipher.update(JSON.stringify(catalog), 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('hex');
}

function readViewerCatalog(html) {
  const blocks = [...html.matchAll(block)];
  if (blocks.length !== 1 || blocks[0][2].length <= 120 || blocks[0][2].length % 2 !== 0) fail('Expected one valid viewer catalog envelope');
  const bytes = Buffer.from(blocks[0][2], 'hex');
  const decipher = createDecipheriv('aes-256-gcm', bytes.subarray(0, 32), bytes.subarray(32, 44));
  decipher.setAuthTag(bytes.subarray(-16));
  const catalog = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(44, -16)), decipher.final()]).toString('utf8'));
  if (catalog.format !== 1 || !Array.isArray(catalog.songs) || !object(catalog.metadata)) fail('Unsupported viewer catalog format');
  return catalog;
}

function replaceViewerCatalog(html, catalog) {
  const updated = html.replace(block, (_, open, ciphertext, close) => open + encodeCatalog(catalog) + close);
  if (JSON.stringify(readViewerCatalog(updated)) !== JSON.stringify(catalog)) fail('New viewer catalog failed round-trip verification');
  return updated;
}

function localized(value) {
  return value?.ko || value?.en || Object.values(value || {})[0];
}

function convert(source, packSource, previous, jackets = new Map()) {
  if (!Array.isArray(source?.songs) || source.songs.length === 0 || source.songs.length > 5000) fail('Expected a full songlist JSON object with 1–5000 songs');
  const packages = new Map();
  if (packSource !== undefined) {
    if (!Array.isArray(packSource?.packs)) fail('Expected a packlist JSON object with a packs array');
    for (const entry of packSource.packs) {
      if (!object(entry) || typeof entry.id !== 'string' || !idPattern.test(entry.id) || packages.has(entry.id)) fail('Invalid or duplicate pack ID');
      if (entry.pack_parent !== undefined && typeof entry.pack_parent !== 'string') fail(`Invalid pack parent in ${entry.id}`);
      if (entry.name_localized !== undefined && (!object(entry.name_localized) || Object.values(entry.name_localized).some(name => typeof name !== 'string'))) fail(`Invalid localized pack name in ${entry.id}`);
      packages.set(entry.id, entry);
    }
  }
  const oldPackNames = new Map(previous?.songs.filter(song => song.set).map(song => [song.set, previous.metadata[song.id]?.pack]) || []);
  function packName(id, seen = new Set()) {
    if (!id) return '팩 정보 없음';
    const pack = packages.get(id);
    if (!pack) return oldPackNames.get(id) || (id === 'single' ? '개별곡 (single)' : id + ' (팩 표시명 없음)');
    if (seen.has(id)) fail(`Circular pack inheritance at ${id}`);
    seen.add(id);
    const name = localized(pack.name_localized) || id;
    return pack.pack_parent ? packName(pack.pack_parent, seen) + ' / ' + name : name;
  }

  const ids = new Set();
  const indices = new Set();
  const songs = [];
  const packNames = Object.create(null);
  const difficulties = Object.create(null);
  const metadata = Object.create(null);
  for (const row of source.songs) {
    if (!object(row) || typeof row.id !== 'string' || !idPattern.test(row.id) || ids.has(row.id)) fail('Invalid or duplicate song ID');
    const { idx, id, title_localized, artist, set, purchase } = row;
    if (!Number.isInteger(idx) || idx < 0 || idx >= 5000 || indices.has(idx)) fail(`Invalid or duplicate index for ${id}`);
    indices.add(idx);
    ids.add(id);
    if (row.deleted !== true || title_localized !== undefined) {
      if (!object(title_localized) || !Object.values(title_localized).some(Boolean) || Object.values(title_localized).some(title => typeof title !== 'string')) fail(`Invalid localized title for ${id}`);
    }
    if ((row.deleted !== true || artist !== undefined) && typeof artist !== 'string') fail(`Invalid artist for ${id}`);
    if ((row.deleted !== true || set !== undefined) && (typeof set !== 'string' || !idPattern.test(set))) fail(`Invalid pack ID for ${id}`);
    if (purchase !== undefined && typeof purchase !== 'string') fail(`Invalid purchase ID for ${id}`);
    const chartData = row.deleted === true && row.difficulties === undefined ? [] : row.difficulties;
    if (!Array.isArray(chartData) || (row.deleted !== true && chartData.length === 0)) fail(`Missing chart data for ${id}; use the full game songlist`);

    const classes = new Set();
    const charts = chartData.map(item => {
      if (!object(item)) fail(`Invalid chart data for ${id}`);
      const { ratingClass, ratingClassAlias, rating, ratingPlus } = item;
      if (!kinds.has(ratingClass) || classes.has(ratingClass) || !Number.isInteger(rating) || rating < 0 || rating > 99 || (ratingPlus !== undefined && typeof ratingPlus !== 'boolean')) fail(`Invalid or duplicate chart for ${id}`);
      classes.add(ratingClass);
      const chart = { ratingClass, rating, ratingPlus: ratingPlus === true };
      if (ratingClass === 3 && ratingClassAlias === 1) chart.ratingClassAlias = 1;
      return chart;
    });
    songs.push({ idx, id, title_localized, artist, set, purchase });
    if (set && !Object.hasOwn(packNames, set)) packNames[set] = packName(set);
    metadata[id] = { pack: set ? packNames[set] : packName(set), difficulties: charts };
    if (purchase !== undefined) metadata[id].access = purchase ? 'purchase' : 'free';
    if (jackets.has(id)) metadata[id].jacket_hash = jackets.get(id);
    difficulties[id] = [...charts].sort((a, b) => kindOrder.indexOf(a.ratingClass) - kindOrder.indexOf(b.ratingClass)).map(chart => ({
      difficulty: chart.ratingClass === 3 && chart.ratingClassAlias === 1 ? 'INS' : kinds.get(chart.ratingClass),
      level: `${chart.rating}${chart.ratingPlus ? '+' : ''}`
    }));
  }
  recommend(songs, 20775); // Ensure the source supports both recommendation groups.
  return { songs, packNames, difficulties, metadata };
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function readSongJackets(directory = root, required = false) {
  let data;
  try {
    data = readJSON(path.join(directory, 'song-jackets.json'));
  } catch (error) {
    if (error.code === 'ENOENT' && !required) return new Map();
    throw error;
  }
  if (!object(data)) fail('Expected a song-jackets.json object keyed by song ID');
  const entries = Object.entries(data);
  for (const [id, hash] of entries) {
    if (!idPattern.test(id) || typeof hash !== 'string' || !jacketPattern.test(hash)) fail(`Invalid jacket hash for ${id}`);
  }
  return new Map(entries);
}

function publishFiles(files) {
  const suffix = `.catalog-${randomBytes(6).toString('hex')}`;
  const prepared = [];
  try {
    for (const [file, before, after] of files) {
      const temporary = file + suffix;
      prepared.push({ file, before, temporary, published: false });
      fs.writeFileSync(temporary, after, { flag: 'wx' });
    }
    for (const item of prepared) {
      fs.renameSync(item.temporary, item.file);
      item.published = true;
    }
  } catch (error) {
    for (const item of prepared.filter(item => item.published)) {
      fs.writeFileSync(item.temporary, item.before, { flag: 'wx' });
      fs.renameSync(item.temporary, item.file);
    }
    throw error;
  } finally {
    for (const item of prepared) fs.rmSync(item.temporary, { force: true });
  }
}

function updateCatalog(songPath, packPath, dryRun, directory = root) {
  const htmlPath = path.join(directory, 'docs', 'index.html');
  const cliPath = path.join(directory, 'songlist.json');
  const difficultyPath = path.join(directory, 'song-difficulties.json');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const previous = readViewerCatalog(html);
  const { songs, packNames, metadata, difficulties } = convert(readJSON(songPath), packPath === undefined ? undefined : readJSON(packPath), previous, readSongJackets(directory));
  const serialize = (value, spaces) => JSON.stringify(value, null, spaces) + '\n';
  const cliCatalog = { songs, packNames };
  const newCatalog = { format: 1, songs, metadata };
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const newHtml = equal(previous, newCatalog) ? html : replaceViewerCatalog(html, newCatalog);
  const cli = fs.readFileSync(cliPath, 'utf8');
  const chartLevels = fs.readFileSync(difficultyPath, 'utf8');
  const changed = [
    [cliPath, cli, equal(JSON.parse(cli), cliCatalog) ? cli : serialize(cliCatalog, 2)],
    [difficultyPath, chartLevels, equal(JSON.parse(chartLevels), difficulties) ? chartLevels : '{\n' + Object.entries(difficulties).map(([id, tracks]) => `  ${JSON.stringify(id)}: ${JSON.stringify(tracks)}`).join(',\n') + '\n}\n'],
    [htmlPath, html, newHtml]
  ].filter(([, before, after]) => before !== after);
  if (!dryRun) publishFiles(changed);
  return { count: songs.length, files: changed.map(([file]) => path.relative(directory, file)) };
}

function refreshJackets(dryRun, directory = root) {
  const htmlPath = path.join(directory, 'docs', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const catalog = readViewerCatalog(html);
  const jackets = readSongJackets(directory, true);
  let changed = false;
  for (const { id } of catalog.songs) {
    const metadata = catalog.metadata[id];
    if (!Object.hasOwn(catalog.metadata, id) || !object(metadata)) fail(`Missing viewer metadata for ${id}`);
    const hash = jackets.get(id);
    if (metadata.jacket_hash === hash) continue;
    if (hash === undefined) delete metadata.jacket_hash;
    else metadata.jacket_hash = hash;
    changed = true;
  }
  if (changed) {
    const updated = replaceViewerCatalog(html, catalog);
    if (!dryRun) publishFiles([[htmlPath, html, updated]]);
  }
  return { count: catalog.songs.length, files: changed ? [path.relative(directory, htmlPath)] : [] };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const dryRun = args[0] === '--dry-run';
    if (dryRun) args.shift();
    const jacketsOnly = args.length === 1 && args[0] === '--refresh-jackets';
    if (!jacketsOnly && (args.length < 1 || args.length > 2 || args.some(arg => arg.startsWith('--')))) fail('Usage: node scripts/update-catalog.cjs [--dry-run] {FULL_SONGLIST.json [PACKLIST.json] | --refresh-jackets}');
    const { count, files } = jacketsOnly ? refreshJackets(dryRun) : updateCatalog(args[0], args[1], dryRun);
    console.log(`${count} songs validated. ${files.length ? `${dryRun ? 'Would update' : 'Updated'} ${files.join(', ')}` : 'No catalog changes.'}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { convert, encodeCatalog, readJSON, readSongJackets, readViewerCatalog, updateCatalog, refreshJackets };
