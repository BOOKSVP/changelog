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
      let cls = '', icon = '', label = '';
      const clean = h.replace(/[\u{1F195}\u{26A1}\u{1F527}]/gu, '').trim();
      if (/new/i.test(h)) { cls = 'cat-new'; icon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z"/></svg>'; label = 'New'; }
      else if (/improved/i.test(h)) { cls = 'cat-improved'; icon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'; label = 'Improved'; }
      else if (/fixed/i.test(h)) { cls = 'cat-fixed'; icon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'; label = 'Fixed'; }
      if (label) return `<h3 class="${cls}">${icon}<span>${label}</span></h3>`;
      return `<h3>${clean}</h3>`;
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

// Logos as base64
const logoDarkPath = path.join(__dirname, 'logo-dark.png');
const logoLightPath = path.join(__dirname, 'logo-light.png');
let logoDarkBase64 = '', logoLightBase64 = '';
if (fs.existsSync(logoDarkPath)) logoDarkBase64 = fs.readFileSync(logoDarkPath).toString('base64');
if (fs.existsSync(logoLightPath)) logoLightBase64 = fs.readFileSync(logoLightPath).toString('base64');

const entriesHtml = entries.map(e => `
  <article class="entry">
    <h2>${e.meta.title || fmtDate(e.meta.date)}</h2>
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
    align-items: center;
    gap: 16px;
  }

  .brand {
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

  /* brand-text removed — logo includes changelog text */

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

  .toggle:hover svg {
    transform: rotate(15deg);
  }

  .icon-sun, .icon-moon { display: none; }
  [data-theme="light"] .icon-moon { display: block; }
  [data-theme="dark"] .icon-sun { display: block; }

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
    font-size: 22px;
    font-weight: 500;
    margin-bottom: 32px;
    letter-spacing: -0.01em;
  }

  .entry h3 {
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 28px 0 12px;
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

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log(`Built ${entries.length} entries → index.html`);
