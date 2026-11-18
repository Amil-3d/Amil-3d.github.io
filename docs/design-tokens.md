# Design tokens

The portfolio's look ("drawing sheet"), written down so the Assistant panel can be reskinned to match.
The source of truth is the top of `portfolio.css`. If you change a value there, change it here too.

The look in one line: an engineering drawing. Flat paper-coloured background with a faint grid, square corners,
thin ink rules instead of shadows, small uppercase mono labels, and one green accent.

## Colors

| Token | Role | Light | Dark |
|---|---|---|---|
| `--bg` | Page background | `#f3f2ec` | `#0d0f0e` |
| `--surface` | Cards, inputs, hover fill | `#fbfaf6` | `#141716` |
| `--text` | Body text and headings | `#15150f` | `#eceade` |
| `--muted` | Labels, secondary text, captions | `#6d6b60` | `#8c8a7e` |
| `--accent` | Links, active nav, numbers, focus ring | `#007a31` | `#2fd968` |
| `--danger` | Errors, destructive buttons | `#c2410c` | `#ff7a45` |

Supporting colors:

| Token | Role | Light | Dark |
|---|---|---|---|
| `--line` | Strong rules: the outer frame, section dividers, button borders | `#15150f` | `#eceade` |
| `--hair` | Faint rules between rows and around thumbnails and chips | `#d3d1c6` | `#2a2d2a` |
| `--accent-soft` | Tinted background behind accent content | `#e3f1e6` | `#12251a` |
| `--on-accent` | Text on a solid accent fill | `#ffffff` | `#06140b` |
| `--grid` | Background grid lines, 24 px apart | `rgba(21,21,15,.05)` | `rgba(236,234,222,.045)` |

Contrast against `--bg`:

| Color | Light | Dark |
|---|---|---|
| text | 16.3:1 | 15.9:1 |
| muted | 4.8:1 | 5.5:1 |
| accent | 4.9:1 | 10.3:1 |
| danger | 4.6:1 | 7.4:1 |

Every color in the table passes WCAG AA for small text. White on the light accent is 5.5:1.

Primary button: `--text` fill with `--bg` text. On hover the fill changes to `--accent` with `--on-accent` text.
Secondary button: transparent with a `--line` border. On hover it inverts to the primary look.

## Light and dark

Dark follows the system setting, and the ◐ button overrides it. The button saves the choice in `localStorage`
under the key `theme`, with the value `light` or `dark`. That is the same key `site.js` uses, so one choice
carries across the whole site.

```css
:root{ /* light values */ }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ /* dark values */ } }
:root[data-theme="dark"]{ /* dark values */ }
```

## Fonts

| Token | Family | Used for |
|---|---|---|
| `--sans` | Space Grotesk 400/500/600/700, then system-ui | Body, headings, values |
| `--mono` | JetBrains Mono 400/500/600, then ui-monospace | Labels, nav, buttons, chips, numbers, captions |

Google Fonts link:
`https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap`

Type scale:

- Body: 16px, line-height 1.6. Reading text such as project notes is 17 to 18px.
- Labels (`.m`): mono, 11px, uppercase, letter-spacing .08em, usually in `--muted` or `--accent`.
- Small title-block labels: mono, 9.5px, uppercase, `--muted`.
- Headings: sans, weight 600, letter-spacing -.015em to -.035em (tighter as they get larger).
  - h1 on the home page: clamp(44px, 6.4vw, 72px), line-height .98.
  - h1 on other pages: clamp(36px, 5vw, 56px).
  - Row and card titles: 19 to 21px.

## Radius

| Token | Value | Used for |
|---|---|---|
| `--radius` | `0` | Frames, cards, buttons, inputs. Corners are square. |
| `--radius-sm` | `2px` | Small controls: chips, thumbnails, the theme button |

There are no shadows. Depth comes from rules: `--rule` (1.5px, `--line`) for the frame and major dividers,
1px `--line` for panel splits, and 1px `--hair` between rows.

## Spacing

A 4px base:

| Token | Value |
|---|---|
| `--s1` | 4px |
| `--s2` | 8px |
| `--s3` | 12px |
| `--s4` | 16px |
| `--s5` | 24px |
| `--s6` | 32px |
| `--s7` | 48px |
| `--s8` | 64px |

Layout:

- The page sits in one bordered sheet, at most 1180px wide, with a 24px margin.
- On phones (620px and under) the sheet drops its side borders and margin.
- Panels use 28 to 40px padding on desktop and 16 to 24px on phones.
- Gutters inside lists are 16px, and gaps between columns are 20px.

## Pieces worth copying into the panel

- **Title block:** a row of bordered cells. Each cell has a tiny muted label over a bold mono value. The nav sits in the last cell.
- **Index row:** a green mono number, a thumbnail, a title, muted text, and a right-aligned mono meta column. The rows are separated by `--hair` rules and get the `--surface` fill on hover.
- **Spec table:** a mono muted label column about 96px wide, with values on the right and `--hair` rules between rows.
- **Focus:** a 2px `--accent` outline with a 2px offset.
- **Motion:** about .15s for hovers. All animation is turned off under `prefers-reduced-motion`.

## Where it is used

- The portfolio pages: `portfolio.css`.
- The Assistant page (`assistant.html`): `portfolio.css` plus `assistant.css`, on the same sheet and title block.
- The control panel: the first block of `panel.css` holds the same values under `--p-` names
  (`--p-bg`, `--p-surface`, `--p-line` is hair, `--p-rule` and `--p-line-strong` are line, `--p-ink-3` is muted).
