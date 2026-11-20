# ARTSVP Changelog

The source of [changelog.artsvp.com](https://changelog.artsvp.com).

## Build and preview

```bash
node build.js
python3 -m http.server -d _site 8000
```

`build.js` has no dependencies. It writes the site to `_site/`, which is not committed. On every push to `main`, the GitHub Action builds `_site/` and deploys it to GitHub Pages.

## Share images

Every page has its own 1200 × 630 link preview in `_site/og/`. `build.js` renders them with headless Chrome: the home card shows the current hero, the highlights card the highlight before it, and each archive card the latest entries of its year. If Chrome is missing, or `SKIP_OG=1` is set, every page uses `assets/og-default.jpg`. Set `CHROME_PATH` to choose a browser.

## What is where

| Path | What it is |
|---|---|
| `entries/` | One Markdown file per entry. The format is in `AGENTS.md`. |
| `assets/YYYY-MM-DD…/` | Screenshots for an entry. |
| `assets/plates/` | Art photos that sit behind screenshots, with `CREDITS.md`. |
| `assets/site.css`, `assets/site.js` | The site's styles and theme toggle. |
| `build.js` | Builds the front page, highlights, archive by year, `feed.json`, `rss.xml`, redirects for the old `page-N.html` links, and a share image for every page. |
| `assets/icons/`, `assets/fonts/` | The favicon and app icons (from the ARTSVP mark), and the Lato files used to render share images. |
| `assets/og-default.jpg` | The share image used when the build cannot find Chrome. |
| `widget.js` | The unread badge script for the ARTSVP admin. Do not change it without updating its integrity hash in `BOOKSVP/artsvp`. |
| `AGENTS.md` | Rules for the changelog bot: copy, highlights, screenshots and fake data. |

## How the front page is chosen

- **Hero:** the newest entry with a `highlight` field.
- **Highlights:** one card per month, the newest highlight of that month, without the hero's month.
- **Every week:** the six newest entries in full, then the next eight as a list.
