# Amil Dhookie — engineering portfolio

Static site, hosted on GitHub Pages at <https://amil-3d.github.io>

It is a project portfolio: a home page with a rotating featured-project figure and the project index, one page per project, plus About and Contact pages.

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

The first photo is the project's thumbnail in the index and the first photo on its project page; the rest
become thumbnails under it. Clicking a photo on the project page opens a full-size viewer with arrow-key
navigation. Keep photos under ~1 MB each; landscape crops best.

## Adding a video

Put the `.mp4` and a poster frame in `video/`, then fill the three video fields in the editor
(file, poster, label). The video shows up as one more thumbnail on that project's card and plays
inline. Keep videos web-sized — 1280 px long edge, faststart enabled.

## Card options

- **Featured** — the project's first photo joins the rotating figure at the top of the home page (it changes every
  6 seconds, pauses on hover, and has previous, pause and next buttons). Three to five of these reads well.
- **Card size: Small** — kept in the data but not used by the current design.
- Each project's page lives at `project.html?p=<title in lowercase, dashes for spaces>`, so renaming a project changes its address.

## Files

- `index.html` — home page: intro, rotating featured figure, project index
- `project.html` — one page per project (photos, video, notes, skills), picked by `?p=`
- `about.html` — About page (intro and skills)
- `contact.html` — Contact page (email, phone, LinkedIn, GitHub)
- `portfolio.css`, `portfolio.js` — styling and scripts for the four portfolio pages above
- `assistant.html`, `assistant.css`, `assistant.js` — the Assistant project page and its private dashboard. They hold no data: the page fetches it from the bot, and the private part only after a password
- `style.css`, `site.js` — the older styling and toggle, still used by `assistant.html` and `privacy.html` until those are reskinned
- `favicon.svg`, `favicon.png`, `apple-touch-icon.png` — the cube and quadcopter tab icon
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
- `panel-inside.js` is the Inside section: Why (what each heartbeat run saw and why it texted or stayed quiet),
  Spend (today, credits left, the caps) and Logins (Canvas, Outlook, Google, with a way to fix each).
- `panel-brain.js` is the Brain section: Memory (fix or delete a line, undo, put a file back from a daily copy),
  Recipes (edit, run now, delete) and Skills (add, edit or delete how-tos and email style notes).
- `panel-daily.js` is the Assistant section: Today (tracker row and to-dos, the view the panel opens on), Chat, Morning, Jobs (long jobs in the Claude app),
  Waiting on you (drafts) and Switches (with Pause Everything). It has no styles of its own.
- `panel-study.js` is the Study section: Schedule (tests by class, study days, your own timelines), Library (laid out like a notebook:
  classes down the side, tests across the top, pages in the middle, with search and add a file) and Cards (flashcard
  review). A workbook opens over the whole window in a sealed frame served by the bot
  (`sandbox="allow-scripts"`, a one-time address): it has no login, no network and no way to reach the panel.
- On a screen 1000px wide or more the panel uses the whole window: the sections move to a rail on the left and
  cards sit side by side. It is one block at the end of `panel.css`; below that width the phone layout is unchanged.
- `panel-extras.js` draws the chat box (the same as texting the Assistant, with tables and links built as text),
  the morning report page and the trading card, which only shows when the bot has a trading summary.

Never put a key, a phone number, an email address or a private link in this repo.
