# amil.engineer

Personal engineering portfolio. Static site, hosted on GitHub Pages.

## Adding or editing a project

1. Open <https://amil.engineer/editor.html>
2. Add/edit/reorder projects, click **Generate JSON**, then **Copy**
3. Open `projects.json` in this repo on github.com, click the pencil, select all, paste, **Commit changes**

The site updates about a minute after the commit.

## Adding a photo

1. Open the `img/` folder in this repo on github.com
2. **Add file -> Upload files**, drag the photo in, commit
3. In the editor, set that project's **Image path** to `img/your-photo.jpg`

Keep photos under ~1 MB each. Landscape (16:9-ish) crops best on the cards.

## Resume

Drop a file named `resume.pdf` in the repo root and the "Résumé (PDF)" button in the header works.

## Files

- `index.html` — the whole site (structure, styling, rendering)
- `projects.json` — project content, the only file you normally edit
- `editor.html` — form UI that writes `projects.json` for you
- `img/` — project photos
- `CNAME` — the custom domain; do not delete, Pages needs it
