#!/usr/bin/env node
// Builds changelog.artsvp.com into _site/. No dependencies: run `node build.js`.
//
// Page structure:
//   Hero        the newest entry with a `highlight` field
//   Highlights  one card per month (the newest highlight of that month), without the hero's month
//   Every week  the newest entries in full, then a short list of earlier weeks
//   Archive     one page per year with every entry in full
//
// See AGENTS.md for the entry format.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const ENTRIES_DIR = path.join(ROOT, 'entries');
const OUT = path.join(ROOT, '_site');
const SITE_URL = 'https://changelog.artsvp.com';
const APP_SIGN_IN = 'https://app.artsvp.com/sign_in';

const FRONT_WEEKS = 6;       // entries shown in full on the front page
const FRONT_EARLIER = 8;     // entries listed as rows under them
const FRONT_HIGHLIGHTS = 3;  // monthly highlight cards on the front page
const FEED_SIZE = 20;
const OLD_PER_PAGE = 10;     // the old site's pagination, for redirects

const FRAMES = ['window', 'phone', 'dialog', 'detail'];
const PLATES = fs.readdirSync(path.join(ROOT, 'assets', 'plates'))
  .filter(f => f.endsWith('.jpg'))
  .map(f => f.replace(/\.jpg$/, ''))
  .sort();
const LABELS = { new: 'New', improved: 'Improved', fixed: 'Fixed' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const IMG_RE = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/;

// ---------- helpers ----------

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}
const fmtLong = d => { const p = parseDate(d); return `${p.day} ${MONTHS[p.m - 1]} ${p.y}`; };
const fmtShort = d => { const p = parseDate(d); return `${p.day} ${MONTHS[p.m - 1].slice(0, 3)} ${p.y}`; };
const fmtDay = d => { const p = parseDate(d); return `${p.day} ${MONTHS[p.m - 1].slice(0, 3)}`; };
const fmtMonth = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

function parseFrontmatter(raw) {
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1).replace(/\\"/g, '"');
    meta[key] = val;
  }
  return { meta, body: m[2] };
}

function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>');
  return s;
}

const plain = text => String(text || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\-–—]$/, '') + '…';
}

const resolveSrc = src => /^https?:\/\//.test(src) ? src : '/' + src.replace(/^\.?\//, '');

function pickPlate(seed) {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PLATES[h % PLATES.length];
}

function parseLook(title) {
  const words = String(title || '').toLowerCase().split(/\s+/).filter(Boolean);
  return { frame: words.find(w => FRAMES.includes(w)), plate: words.find(w => PLATES.includes(w)) };
}

// A screenshot in a frame on a plate. With no frame, a plain bordered image.
function shot({ src, alt, frame, plate, cls = '', eager = false }) {
  const loading = eager ? '' : ' loading="lazy"';
  const img = `<img src="${esc(resolveSrc(src))}" alt="${esc(alt)}"${loading}>`;
  if (!frame) return `<figure class="shot-plain ${cls}">${img}</figure>`;
  const bg = `<img class="bg" src="/assets/plates/${plate || pickPlate(src)}.jpg" alt=""${loading}>`;
  if (frame === 'detail') return `<figure class="plate detail ${cls}">${bg}<div class="f-detail">${img}</div></figure>`;
  return `<figure class="plate ${cls}">${bg}<div class="f-${frame}">${img}</div></figure>`;
}

// The image for a hero, a highlight card or a week's cover.
function feature(e, cls, eager = false) {
  const loading = eager ? '' : ' loading="lazy"';
  if (e.art) return `<figure class="plate art ${cls}"><img class="bg" src="${esc(resolveSrc(e.art))}" alt="${esc(e.highlight || e.title)}"${loading}></figure>`;
  if (e.image) return shot({ src: e.image, alt: e.highlight || e.title, frame: e.frame, plate: e.plate || pickPlate(e.slug), cls, eager });
  return '';
}

// ---------- Markdown body ----------

function renderBody(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const counts = { new: 0, improved: 0, fixed: 0 };
  let group = null;
  let list = null;
  let para = [];
  let lastItem = null;
  let firstText = '';

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(' ');
    if (!firstText) firstText = plain(text);
    out.push(`<p>${inline(text)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<ul class="items">${list.map(renderItem).join('')}</ul>`);
    list = null;
  };
  const closeGroup = () => {
    flushPara();
    flushList();
    if (group) out.push('</div>');
    group = null;
    lastItem = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();

    const cat = t.match(/^\[(new|improved|fixed)\]$/i);
    if (cat) {
      closeGroup();
      group = cat[1].toLowerCase();
      out.push(`<div class="group"><span class="badge b-${group}">${LABELS[group]}</span>`);
      continue;
    }
    if (!t) { flushPara(); continue; }

    const img = t.match(IMG_RE);
    if (img) {
      flushPara();
      const fig = { src: img[2], alt: img[1], ...parseLook(img[3]) };
      if (lastItem) lastItem.figs.push(fig);
      else { flushList(); out.push(shot({ ...fig, cls: 'body-shot' })); }
      continue;
    }

    const h = t.match(/^#{2,4}\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      lastItem = null;
      out.push(`<h4>${inline(h[1])}</h4>`);
      continue;
    }

    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      flushPara();
      if (!list) list = [];
      lastItem = { text: li[1], figs: [] };
      list.push(lastItem);
      if (!firstText) firstText = plain(li[1]);
      if (group) counts[group]++;
      continue;
    }

    if (/^\s{2,}\S/.test(line) && lastItem) { lastItem.text += ' ' + t; continue; }

    if (list) { flushList(); lastItem = null; }
    para.push(t);
  }
  closeGroup();
  return { html: out.join('\n'), counts, firstText };
}

function renderItem(item) {
  let html = inline(item.text);
  const m = html.match(/^<strong>(.*?)<\/strong>([\s\S]*)$/);
  if (m && m[2].trim()) html = `<strong>${m[1]}</strong><span>${m[2]}</span>`;
  const figs = item.figs.map(f => shot({ ...f, cls: 'item-shot' })).join('');
  return `<li><p>${html}</p>${figs}</li>`;
}

// ---------- entries ----------

const entries = fs.readdirSync(ENTRIES_DIR)
  .filter(f => f.endsWith('.md'))
  .map(file => {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8'));
    const slug = file.replace(/\.md$/, '');
    const date = String(meta.date || slug).slice(0, 10);
    const r = renderBody(body);
    const image = meta.image || '';
    return {
      file, slug, date,
      year: date.slice(0, 4),
      month: date.slice(0, 7),
      title: meta.title || fmtLong(date),
      summary: meta.summary || '',
      highlight: meta.highlight || '',
      image,
      art: meta.art || '',
      frame: FRAMES.includes(meta.frame) ? meta.frame : (image ? 'window' : ''),
      plate: PLATES.includes(meta.plate) ? meta.plate : '',
      html: r.html,
      counts: r.counts,
      total: r.counts.new + r.counts.improved + r.counts.fixed,
      lead: meta.summary || clip(r.firstText, 200),
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

if (!entries.length) throw new Error('No entries found');

const front = entries.slice(0, FRONT_WEEKS);
const frontSlugs = new Set(front.map(e => e.slug));
const years = [...new Set(entries.map(e => e.year))].sort().reverse();
const highlights = entries.filter(e => e.highlight);
const hero = highlights[0] || null;
const monthly = [];
for (const e of highlights) if (!monthly.some(x => x.month === e.month)) monthly.push(e);
const frontCards = monthly.filter(e => !hero || e.month !== hero.month).slice(0, FRONT_HIGHLIGHTS);

const archiveUrl = e => `/archive/${e.year}.html#${e.slug}`;
const entryUrl = e => frontSlugs.has(e.slug) ? `/#${e.slug}` : archiveUrl(e);

// ---------- templates ----------

const cssVersion = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'assets', 'site.css'))).digest('hex').slice(0, 8);
const jsVersion = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'assets', 'site.js'))).digest('hex').slice(0, 8);

const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const SUN = '<svg class="i-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const MOON = '<svg class="i-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function page({ title, description, pathname, body, ogImage }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${pathname}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ARTSVP Changelog">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE_URL}${pathname}">
${ogImage ? `<meta property="og:image" content="${esc(/^https?:/.test(ogImage) ? ogImage : SITE_URL + ogImage)}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="ARTSVP Changelog" href="/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
<script>try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script src="/assets/site.js?v=${jsVersion}" defer></script>
</head>
<body>
${nav()}
<main id="top">
${body}
</main>
${footer()}
</body>
</html>
`;
}

function nav() {
  return `<header class="nav">
  <div class="wrap">
    <a class="brand" href="/" aria-label="ARTSVP Changelog home">
      <img src="/logo-light.png" alt="ARTSVP" width="1034" height="164">
      <span class="sep" aria-hidden="true"></span>
      <span class="eyebrow">Changelog</span>
    </a>
    <nav class="nav-links" aria-label="Site">
      ${monthly.length ? '<a class="btn btn-ghost btn-sm hide-sm" href="/#highlights">Highlights</a>' : ''}
      <a class="btn btn-ghost btn-sm hide-sm" href="/#weekly">Every week</a>
      <a class="btn btn-ghost btn-sm hide-sm" href="/archive/${years[0]}.html">Archive</a>
      <button class="btn btn-ghost btn-icon" type="button" data-theme-toggle aria-label="Switch between light and dark">${SUN}${MOON}</button>
      <a class="btn btn-outline btn-sm" href="${APP_SIGN_IN}">Sign in</a>
    </nav>
  </div>
</header>`;
}

function footer() {
  return `<footer class="foot">
  <div class="wrap">
    <a class="brand" href="/"><img src="/logo-light.png" alt="ARTSVP" width="1034" height="164"></a>
    <span>Every change to ARTSVP since ${years[years.length - 1]}.</span>
    <nav aria-label="Footer"><a href="https://artsvp.com">artsvp.com</a><a href="https://status.artsvp.com">Status</a><a href="/rss.xml">RSS</a></nav>
  </div>
</footer>`;
}

function heroSection() {
  if (!hero) {
    return `<section class="hero">
  <div class="wrap">
    <div class="hero-text">
      <h1>What's new in ARTSVP</h1>
      <div class="hero-side">
        <p class="lead">New features, improvements and fixes for galleries, art fairs and the teams behind them. Every week.</p>
        <div class="actions"><a class="btn btn-primary" href="#weekly">See every week</a></div>
      </div>
    </div>
  </div>
</section>`;
  }
  const visual = feature(hero, 'hero-plate', true);
  return `<section class="hero">
  <div class="wrap">
    <div class="hero-text">
      <div>
        <span class="pill"><span class="badge b-new">Highlight</span>${fmtMonth(hero.month)}</span>
        <h1>${esc(hero.highlight)}</h1>
      </div>
      <div class="hero-side">
        <p class="lead">${esc(hero.lead)}</p>
        <div class="actions">
          <a class="btn btn-primary" href="${entryUrl(hero)}">Read the update</a>
          <a class="btn btn-outline" href="#weekly">See every week</a>
        </div>
      </div>
    </div>
    ${visual ? `<a class="hero-link" href="${entryUrl(hero)}" aria-label="Read the ${esc(fmtLong(hero.date))} update">${visual}</a>` : ''}
  </div>
</section>`;
}

function card(e) {
  const visual = feature(e, '') || `<figure class="plate"><img class="bg" src="/assets/plates/${e.plate || pickPlate(e.slug)}.jpg" alt="" loading="lazy"></figure>`;
  return `<a class="hl" href="${entryUrl(e)}">
  ${visual}
  <div class="hl-meta">
    <time datetime="${e.month}">${fmtMonth(e.month)}</time>
    <h3>${esc(e.highlight)}</h3>
    <p>${esc(e.lead)}</p>
    <span class="more">Read more ${ARROW}</span>
  </div>
</a>`;
}

function highlightsSection() {
  if (!frontCards.length) return '';
  return `<section class="section" id="highlights">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <h2>Highlights</h2>
        <p>The biggest change of each month.</p>
      </div>
      <a class="btn btn-outline btn-sm" href="/highlights.html">All highlights</a>
    </div>
    <div class="highlights count-${frontCards.length}">
      ${frontCards.map(card).join('\n      ')}
    </div>
  </div>
</section>`;
}

function article(e) {
  const meta = [
    `<time datetime="${e.date}">${fmtShort(e.date)}</time>`,
    e.total ? `<span>${e.total} change${e.total === 1 ? '' : 's'}</span>` : '',
    e.highlight ? '<span class="badge b-outline">Highlight</span>' : '',
  ].filter(Boolean).join('\n      ');
  // No cover for the hero's week, or when the same image already sits in the body.
  const coverSrc = e.art || e.image;
  const inBody = coverSrc && e.html.includes(`src="${esc(resolveSrc(coverSrc))}"`);
  const cover = e === hero || inBody ? '' : feature(e, 'cover');
  return `<article class="release" id="${e.slug}">
    <div class="release-meta">
      ${meta}
    </div>
    <div class="release-body">
      <div>
        <h3><a href="${entryUrl(e)}">${esc(e.title)}</a></h3>
        ${e.summary ? `<p class="summary">${esc(e.summary)}</p>` : ''}
      </div>
      ${cover}
      <div class="prose">
${e.html}
      </div>
    </div>
  </article>`;
}

function yearPills(active) {
  return `<div class="years">${years.map(y =>
    `<a class="btn ${y === active ? 'btn-outline' : 'btn-ghost'} btn-sm" href="/archive/${y}.html"${y === active ? ' aria-current="page"' : ''}>${y}</a>`
  ).join('')}</div>`;
}

function weeklySection() {
  const earlier = entries.slice(FRONT_WEEKS, FRONT_WEEKS + FRONT_EARLIER);
  return `<section class="section" id="weekly">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <h2>Every week</h2>
        <p>Each week's changes, newest first.</p>
      </div>
    </div>
  ${front.map(article).join('\n  ')}
    <div class="release release-end">
      <div class="release-meta"><time>Earlier</time></div>
      <div class="release-body">
        ${earlier.length ? `<div class="earlier">
          ${earlier.map(e => `<a class="row" href="${archiveUrl(e)}"><time datetime="${e.date}">${fmtDay(e.date)}</time><span>${esc(e.title)}</span>${CHEVRON}</a>`).join('\n          ')}
        </div>` : ''}
        <div class="archive" id="archive">
          <span class="eyebrow">Archive</span>
          ${yearPills(null)}
        </div>
      </div>
    </div>
  </div>
</section>`;
}

// ---------- write ----------

// Empty _site/ instead of deleting it, so file-sync tools (such as iCloud Drive) do not make conflict copies.
if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'archive'), { recursive: true });
const write = (rel, content) => fs.writeFileSync(path.join(OUT, rel), content);

fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true });
for (const f of ['widget.js', 'logo-light.png', 'logo-dark.png', 'CNAME']) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
}

const heroImage = hero ? (hero.art || hero.image) : '';
write('index.html', page({
  title: 'ARTSVP Changelog',
  description: 'New features, improvements and fixes in ARTSVP, every week.',
  pathname: '/',
  ogImage: heroImage ? resolveSrc(heroImage) : '',
  body: [heroSection(), highlightsSection(), weeklySection()].join('\n'),
}));

for (const y of years) {
  const list = entries.filter(e => e.year === y);
  write(path.join('archive', `${y}.html`), page({
    title: `${y} · ARTSVP Changelog`,
    description: `Every ARTSVP change in ${y}.`,
    pathname: `/archive/${y}.html`,
    body: `<section class="section page-head">
  <div class="wrap">
    <p class="eyebrow">Archive</p>
    <h1>${y}</h1>
    <p class="lead">${list.length} ${list.length === 1 ? 'entry' : 'entries'}, newest first.</p>
    ${yearPills(y)}
  </div>
</section>
<section class="section archive-list">
  <div class="wrap">
  ${list.map(article).join('\n  ')}
  </div>
</section>`,
  }));
}

write('highlights.html', page({
  title: 'Highlights · ARTSVP Changelog',
  description: 'The biggest ARTSVP change of each month.',
  pathname: '/highlights.html',
  body: `<section class="section page-head">
  <div class="wrap">
    <p class="eyebrow">Highlights</p>
    <h1>The biggest change of each month</h1>
  </div>
</section>
<section class="section">
  <div class="wrap">
    ${monthly.length ? `<div class="highlights">\n      ${monthly.map(card).join('\n      ')}\n    </div>` : '<p class="lead">No highlights yet.</p>'}
  </div>
</section>`,
}));

write('404.html', page({
  title: 'Page not found · ARTSVP Changelog',
  description: 'This page does not exist.',
  pathname: '/404.html',
  body: `<section class="section page-head">
  <div class="wrap">
    <p class="eyebrow">404</p>
    <h1>This page does not exist</h1>
    <p class="lead">It may have moved when the changelog was redesigned.</p>
    <div class="actions"><a class="btn btn-primary" href="/">Go to the changelog</a></div>
  </div>
</section>`,
}));

// Old paginated URLs (page-2.html, page-3.html, …) point to the archive year of their first entry.
const oldOrder = [...entries].sort((a, b) => b.date.localeCompare(a.date) || a.file.localeCompare(b.file));
const oldPages = Math.max(12, Math.ceil(oldOrder.length / OLD_PER_PAGE));
for (let i = 1; i < oldPages; i++) {
  const first = oldOrder[Math.min(i * OLD_PER_PAGE, oldOrder.length - 1)];
  const target = `/archive/${first.year}.html`;
  write(`page-${i + 1}.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ARTSVP Changelog</title><link rel="canonical" href="${SITE_URL}${target}"><meta http-equiv="refresh" content="0; url=${target}"></head><body><a href="${target}">The changelog has moved to ${target}</a></body></html>\n`);
}

// feed.json keeps `date` and `title` first: widget.js in the ARTSVP admin reads them.
const feedEntries = entries.slice(0, FEED_SIZE).map(e => {
  const item = { date: e.date, title: e.title, url: SITE_URL + archiveUrl(e) };
  if (e.lead) item.summary = e.lead;
  if (e.highlight) item.highlight = e.highlight;
  if (e.art || e.image) item.image = SITE_URL + resolveSrc(e.art || e.image);
  return item;
});
write('feed.json', JSON.stringify({ entries: feedEntries }, null, 2) + '\n');

const xml = s => esc(s).replace(/'/g, '&apos;');
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>ARTSVP Changelog</title>
<link>${SITE_URL}/</link>
<description>New features, improvements and fixes in ARTSVP, every week.</description>
<language>en-gb</language>
<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${entries.slice(0, FEED_SIZE).map(e => `<item>
<title>${xml(e.title)}</title>
<link>${SITE_URL}${archiveUrl(e)}</link>
<guid isPermaLink="false">${e.slug}</guid>
<pubDate>${new Date(e.date + 'T09:00:00Z').toUTCString()}</pubDate>
<description>${xml(e.lead)}</description>
</item>`).join('\n')}
</channel>
</rss>
`);

console.log(`Built ${entries.length} entries: hero ${hero ? hero.slug : 'none'}, ${monthly.length} monthly highlights, ${years.length} archive years → _site/`);
