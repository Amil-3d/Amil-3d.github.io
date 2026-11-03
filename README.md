# Amil Dhookie — engineering portfolio

Static site, hosted on GitHub Pages at <https://amil-3d.github.io>

It is a project portfolio: a home page with the project grid, plus separate About and Contact pages.

## Adding or editing a project

1. Open <https://amil-3d.github.io/editor.html>
2. Add/edit/reorder projects, click **Generate JSON**, then **Copy**
3. Open `projects.json` in this repo on github.com, click the pencil, select all, paste, **Commit changes**

The site updates about a minute after the commit.

## Adding photos

1. Open `img/` in this repo on github.com and go into the project's subfolder (or create one)
2. **Add file → Upload files**, drag the photos in, commit
3. In the editor, add a line per photo to that project's **Photos** box:
   `img/your-folder/your-photo.jpg | what the photo shows`

The first photo is the card image; the rest become thumbnails under it. Clicking the card photo opens
a full-size viewer with arrow-key navigation. Keep photos under ~1 MB each; landscape crops best.

## Adding a video

Put the `.mp4` and a poster frame in `video/`, then fill the three video fields in the editor
(file, poster, label). The video shows up as one more thumbnail on that project's card and plays
inline. Keep videos web-sized — 1280 px long edge, faststart enabled.

## Card options

- **Featured** — full-width card with the photos beside the text. Two or three of these reads well; all of them does not.
- **Card size: Small** — a lighter card for smaller projects.

## Files

- `index.html` — home page: intro, project grid, gallery, lightbox
- `about.html` — About page (intro and skills)
- `contact.html` — Contact page (email, phone, LinkedIn, GitHub)
- `style.css` — shared styling for every page, including the accent color (`--accent`)
- `site.js` — shared dark/light toggle and footer year
- `favicon.svg`, `favicon.png`, `apple-touch-icon.png` — the gear tab icon
- `projects.json` — project content, the only file you normally edit
- `editor.html` — form UI that writes `projects.json` for you
- `img/` — project photos, one subfolder per project
- `video/` — project videos and their poster frames

## Custom domain, later

Nothing here is tied to `amil-3d.github.io`. To move to a domain you own: buy it, point four A records
and four AAAA records at GitHub's Pages IPs, then enter the domain under Settings → Pages → Custom domain.
No changes to any file in this repo.
