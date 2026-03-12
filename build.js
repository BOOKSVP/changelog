#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ENTRIES_DIR = path.join(__dirname, 'entries');

// Simple frontmatter parser
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
  });
  return { meta, body: match[2] };
}

// Minimal markdown to HTML
function md(text) {
  return text
    .replace(/^## (.+)$/gm, (_, h) => {
      let cls = '';
      if (h.includes('🆕') || h.includes('New')) cls = 'cat-new';
      else if (h.includes('⚡') || h.includes('Improved')) cls = 'cat-improved';
      else if (h.includes('🔧') || h.includes('Fixed')) cls = 'cat-fixed';
      return `<h3 class="${cls}">${h}</h3>`;
    })
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n{2,}/g, '\n');
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
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const entriesHtml = entries.map(e => `
  <article class="entry">
    <time>${fmtDate(e.meta.date)}</time>
    <h2>${e.meta.title || ''}</h2>
    ${e.html}
  </article>
`).join('\n');

const html = `<!DOCTYPE html>
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
    --fg-muted: #666666;
    --border: #e5e5e5;
    --badge-new-bg: #ecfdf5;
    --badge-new-fg: #065f46;
    --badge-improved-bg: #eff6ff;
    --badge-improved-fg: #1e40af;
    --badge-fixed-bg: #fff7ed;
    --badge-fixed-fg: #9a3412;
    --toggle-bg: #f0f0f0;
  }

  [data-theme="dark"] {
    --bg: #111111;
    --fg: #e8e8e8;
    --fg-muted: #888888;
    --border: #2a2a2a;
    --badge-new-bg: #064e3b;
    --badge-new-fg: #a7f3d0;
    --badge-improved-bg: #1e3a5f;
    --badge-improved-fg: #bfdbfe;
    --badge-fixed-bg: #431407;
    --badge-fixed-fg: #fed7aa;
    --toggle-bg: #222222;
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
    align-items: flex-start;
    margin-bottom: 80px;
  }

  .brand h1 {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--fg);
  }

  .brand p {
    font-size: 13px;
    color: var(--fg-muted);
    margin-top: 2px;
    letter-spacing: 0.05em;
  }

  .toggle {
    background: var(--toggle-bg);
    border: none;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    color: var(--fg-muted);
    transition: all 0.3s ease;
    letter-spacing: 0.02em;
  }

  .toggle:hover {
    color: var(--fg);
  }

  .entry {
    margin-bottom: 64px;
    padding-bottom: 64px;
    border-bottom: 1px solid var(--border);
  }

  .entry:last-child {
    border-bottom: none;
  }

  .entry time {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--fg-muted);
    display: block;
    margin-bottom: 8px;
  }

  .entry h2 {
    font-size: 20px;
    font-weight: 500;
    margin-bottom: 32px;
    letter-spacing: -0.01em;
  }

  .entry h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin: 28px 0 12px;
    padding: 4px 10px;
    border-radius: 4px;
    display: inline-block;
  }

  .entry h3.cat-new {
    background: var(--badge-new-bg);
    color: var(--badge-new-fg);
  }

  .entry h3.cat-improved {
    background: var(--badge-improved-bg);
    color: var(--badge-improved-fg);
  }

  .entry h3.cat-fixed {
    background: var(--badge-fixed-bg);
    color: var(--badge-fixed-fg);
  }

  .entry h3 + ul {
    margin-top: 0;
  }

  ul {
    list-style: none;
    margin: 8px 0 0;
  }

  li {
    position: relative;
    padding-left: 16px;
    margin-bottom: 6px;
    font-size: 15px;
    color: var(--fg);
    line-height: 1.5;
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

  a {
    color: var(--fg);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  footer {
    margin-top: 80px;
    padding-top: 40px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--fg-muted);
    letter-spacing: 0.05em;
  }

  footer a {
    color: var(--fg-muted);
  }

  @media (max-width: 480px) {
    body { padding: 48px 20px 80px; }
    header { margin-bottom: 48px; }
    .entry { margin-bottom: 40px; padding-bottom: 40px; }
  }
</style>
</head>
<body>
<header>
  <div class="brand">
    <h1>ARTSVP</h1>
    <p>Changelog</p>
  </div>
  <button class="toggle" onclick="toggleTheme()" aria-label="Toggle dark mode">
    <span id="toggle-label">Dark</span>
  </button>
</header>
<main>
${entriesHtml}
</main>
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
  document.getElementById('toggle-label').textContent = t === 'dark' ? 'Light' : 'Dark';
  localStorage.setItem('theme', t);
}
function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
applyTheme(getTheme());
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log(`Built ${entries.length} entries → index.html`);
