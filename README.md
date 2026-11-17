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
- `assistant.html`, `assistant.css`, `assistant.js` — the Assistant project page and its private dashboard. They hold no data: the page fetches it from the bot, and the private part only after a password
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

## Assistant dashboard and control panel

`assistant.html` is the public project page with the view-only private dashboard. `panel.html` is the control
panel. Both hold no data, no keys and nothing private: after the login they ask the bot for everything.

- `assistant-login.js` is the one login for both pages: the password, then on a new device a code the bot texts.
- `panel.css` is the only stylesheet the panel uses. To reskin the panel, change the values at the top of that
  one file.
- `panel.js` is the shell. A section is added with `Panel.section({...})`, and every button goes through
  `Panel.press()`, so the bot logs it.
- `panel-daily.js` is the Assistant section: Waiting on you (drafts), Today (tracker row and to-dos) and
  Switches (with Pause Everything). It has no styles of its own.

Never put a key, a phone number, an email address or a private link in this repo.
