#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ENTRIES_DIR = path.join(__dirname, 'entries');
const PER_PAGE = 10;

// Simple frontmatter parser
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
  });
  return { meta, body: match[2] };
}

// Markdown to HTML
function md(text) {
  return text
    // Category tags: [new], [improved], [fixed]
    .replace(/^\[new\]\s*$/gim, '<h3 class="cat-new"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z"/></svg><span>New</span></h3>')
    .replace(/^\[improved\]\s*$/gim, '<h3 class="cat-improved"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><span>Improved</span></h3>')
    .replace(/^\[fixed\]\s*$/gim, '<h3 class="cat-fixed"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg><span>Fixed</span></h3>')
    // Regular headings
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    // List items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m.trim()}</ul>`)
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="entry-img">')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Wrap loose text in <p> tags
    .split('\n')
    .map(line => {
      const t = line.trim();
      if (!t) return '';
      if (/^<(h[1-6]|ul|\/ul|li|img|p|\/p)/.test(t)) return t;
      return `<p>${t}</p>`;
    })
    .filter(line => line !== '')
    .join('\n');
}

// Read and sort entries
const entries = fs.readdirSync(ENTRIES_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => {
    const raw = fs.readFileSync(path.join(ENTRIES_DIR, f), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    return { file: f, meta, html: md(body) };
  })
  .sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''));

// Format date
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.split('-').slice(0, 3).join('-') + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Logos as base64
const logoDarkPath = path.join(__dirname, 'logo-dark.png');
const logoLightPath = path.join(__dirname, 'logo-light.png');
let logoDarkBase64 = '', logoLightBase64 = '';
if (fs.existsSync(logoDarkPath)) logoDarkBase64 = fs.readFileSync(logoDarkPath).toString('base64');
if (fs.existsSync(logoLightPath)) logoLightBase64 = fs.readFileSync(logoLightPath).toString('base64');

// Paginate
const totalPages = Math.ceil(entries.length / PER_PAGE);

function buildPage(pageNum) {
  const start = pageNum * PER_PAGE;
  const pageEntries = entries.slice(start, start + PER_PAGE);

  const entriesHtml = pageEntries.map(e => `
  <article class="entry">
    <time>${fmtDate(e.meta.date)}</time>
    <h2>${e.meta.title || fmtDate(e.meta.date)}</h2>
    ${e.html}
  </article>`).join('\n');

  // Pagination nav
  let paginationHtml = '';
  if (totalPages > 1) {
    const prevFile = pageNum > 0 ? (pageNum === 1 ? 'index.html' : `page-${pageNum}.html`) : '';
    const nextFile = pageNum < totalPages - 1 ? `page-${pageNum + 2}.html` : '';
    paginationHtml = `<nav class="pagination">
      ${prevFile ? `<a href="${prevFile}" class="page-link">← Newer</a>` : '<span></span>'}
      <span class="page-info">Page ${pageNum + 1} of ${totalPages}</span>
      ${nextFile ? `<a href="${nextFile}" class="page-link">Older →</a>` : '<span></span>'}
    </nav>`;
  }

  return buildHtml(entriesHtml, paginationHtml);
}

function buildHtml(entriesHtml, paginationHtml) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ARTSVP — Changelog</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #ffffff;
    --fg: #111111;
    --fg-muted: #888888;
    --border: #e8e8e8;
    --tag-bg: #f5f5f5;
    --tag-fg: #555555;
    --tag-border: #e0e0e0;
    --tag-icon: #777777;
    --toggle-bg: transparent;
  }

  [data-theme="dark"] {
    --bg: #111111;
    --fg: #e8e8e8;
    --fg-muted: #777777;
    --border: #2a2a2a;
    --tag-bg: #1e1e1e;
    --tag-fg: #aaaaaa;
    --tag-border: #333333;
    --tag-icon: #888888;
    --toggle-bg: transparent;
  }

  html {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--bg);
    color: var(--fg);
    transition: background 0.3s ease, color 0.3s ease;
  }

  body {
    max-width: 640px;
    margin: 0 auto;
    padding: 80px 24px 120px;
    line-height: 1.6;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 80px;
  }

  .brand {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .brand img {
    width: auto;
    height: 32px;
    max-width: 100%;
    transition: opacity 0.3s ease;
  }

  .brand-subtitle {
    font-size: 14px;
    color: var(--fg-muted);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 400;
  }

  .logo-light, .logo-dark { display: none; }
  [data-theme="light"] .logo-light { display: block; }
  [data-theme="dark"] .logo-dark { display: block; }

  .toggle {
    background: var(--toggle-bg);
    border: 1px solid var(--border);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--fg-muted);
    transition: all 0.3s ease;
  }

  .toggle:hover {
    color: var(--fg);
    border-color: var(--fg-muted);
  }

  .toggle svg {
    width: 18px;
    height: 18px;
    transition: transform 0.3s ease;
  }

  .toggle:hover svg { transform: rotate(15deg); }

  .icon-sun, .icon-moon { display: none; }
  [data-theme="light"] .icon-moon { display: block; }
  [data-theme="dark"] .icon-sun { display: block; }

  .entry {
    margin-bottom: 64px;
    padding-bottom: 64px;
    border-bottom: 1px solid var(--border);
  }

  .entry:last-child { border-bottom: none; }

  .entry time {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--fg-muted);
    display: block;
    margin-bottom: 4px;
  }

  .entry h2 {
    font-size: 22px;
    font-weight: 500;
    margin-bottom: 24px;
    letter-spacing: -0.01em;
    position: sticky;
    top: 0;
    background: var(--bg);
    padding: 12px 0;
    z-index: 10;
    border-bottom: 1px solid var(--border);
  }

  .entry p {
    font-size: 15px;
    line-height: 1.6;
    margin: 12px 0;
    color: var(--fg);
  }

  .entry h3 {
    font-size: 16px;
    font-weight: 500;
    margin: 20px 0 8px;
    color: var(--fg);
  }

  .entry h3.cat-new,
  .entry h3.cat-improved,
  .entry h3.cat-fixed {
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 24px 0 12px;
    padding: 5px 12px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--tag-bg);
    color: var(--tag-fg);
    border: 1px solid var(--tag-border);
  }

  .entry h3 svg {
    color: var(--tag-icon);
    flex-shrink: 0;
  }

  .entry h3 + ul { margin-top: 0; }

  .entry-img {
    max-width: 100%;
    border-radius: 8px;
    margin: 16px 0;
    display: block;
  }

  ul {
    list-style: none;
    margin: 8px 0 16px;
  }

  li {
    position: relative;
    padding-left: 16px;
    margin-bottom: 8px;
    font-size: 15px;
    color: var(--fg);
    line-height: 1.55;
  }

  li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 10px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--fg-muted);
  }

  strong { font-weight: 600; }
  em { font-style: italic; }
  code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    background: var(--tag-bg);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--tag-border);
  }

  a {
    color: var(--fg);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 40px;
    padding-top: 40px;
    border-top: 1px solid var(--border);
  }

  .page-link {
    font-size: 14px;
    color: var(--fg);
    text-decoration: none;
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .page-link:hover {
    background: var(--tag-bg);
    border-color: var(--fg-muted);
  }

  .page-info {
    font-size: 13px;
    color: var(--fg-muted);
    letter-spacing: 0.05em;
  }

  footer {
    margin-top: 80px;
    padding-top: 40px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--fg-muted);
    letter-spacing: 0.05em;
  }

  footer a { color: var(--fg-muted); }

  @media (max-width: 480px) {
    body { padding: 48px 20px 80px; }
    header { margin-bottom: 48px; }
    .brand img { width: auto; height: 24px; }
    .entry { margin-bottom: 40px; padding-bottom: 40px; }
  }
</style>
</head>
<body>
<header>
  <div class="brand">
    ${logoLightBase64 ? `<img class="logo-light" src="data:image/png;base64,${logoLightBase64}" alt="ARTSVP">` : ''}
    ${logoDarkBase64 ? `<img class="logo-dark" src="data:image/png;base64,${logoDarkBase64}" alt="ARTSVP">` : ''}
    <span class="brand-subtitle">Changelog</span>
  </div>
  <button class="toggle" onclick="toggleTheme()" aria-label="Toggle dark mode">
    <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
    <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  </button>
</header>
<main>
${entriesHtml}
</main>
${paginationHtml}
<footer>
  <a href="https://artsvp.com">artsvp.com</a>
</footer>
<script>
function getTheme() {
  return localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
}
function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
applyTheme(getTheme());
</script>
</body>
</html>`;
}

// Build all pages
for (let i = 0; i < totalPages; i++) {
  const filename = i === 0 ? 'index.html' : `page-${i + 1}.html`;
  fs.writeFileSync(path.join(__dirname, filename), buildPage(i));
}

console.log(`Built ${entries.length} entries across ${totalPages} pages`);
