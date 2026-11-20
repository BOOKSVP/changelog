# ARTSVP Changelog

The source of [changelog.artsvp.com](https://changelog.artsvp.com).

## Build and preview

```bash
node build.js
python3 -m http.server -d _site 8000
```

`build.js` has no dependencies. It writes the site to `_site/`, which is not committed. On every push to `main`, the GitHub Action builds `_site/` and deploys it to GitHub Pages.

## What is where

| Path | What it is |
|---|---|
| `entries/` | One Markdown file per entry. The format is in `AGENTS.md`. |
| `assets/YYYY-MM-DD…/` | Screenshots for an entry. |
| `assets/plates/` | Art photos that sit behind screenshots, with `CREDITS.md`. |
| `assets/site.css`, `assets/site.js` | The site's styles and theme toggle. |
| `build.js` | Builds the front page, highlights, archive by year, `feed.json`, `rss.xml` and redirects for the old `page-N.html` links. |
| `widget.js` | The unread badge script for the ARTSVP admin. Do not change it without updating its integrity hash in `BOOKSVP/artsvp`. |
| `AGENTS.md` | Rules for the changelog bot: copy, highlights, screenshots and fake data. |

## How the front page is chosen

- **Hero:** the newest entry with a `highlight` field.
- **Highlights:** one card per month, the newest highlight of that month, without the hero's month.
- **Every week:** the six newest entries in full, then the next eight as a list.
