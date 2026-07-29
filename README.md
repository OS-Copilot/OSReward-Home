# OSReward — project page

Source for the OSReward homepage: *Instituting Standardized Reward Evaluation for
Cross-Platform Computer-Using Agents*.

Static HTML, CSS and vanilla JS. No build step, no framework, no CDN scripts —
open `index.html` or serve the directory and it runs.

```bash
python3 -m http.server 8899   # then http://localhost:8899
```

## Layout

```
index.html               the page
404.html                 not-found page
static/css/main.css      design system + all page styles
static/js/
  osreward-data.js       every number from the paper, one place
  osreward-charts.js     dependency-free SVG chart library
  main.js                page behaviour + chart wiring
public/
  cover.png              project key art
  favicon*.png .ico      derived from the cover
  social/og-image.png    1200x630 social card
  logos/                 model-family marks used in tables and plots
  affil/                 university logos (not currently used on the page)
figure/resources/        local-only working material (gitignored)
```

## Filling in the links

Every release link is built but parked. In `index.html`, search for
`class="btn pending"` (hero) and `class="card feature pending-card"` (Resources).
For each one, drop the `pending` / `pending-card` class, add the `href`, and
delete the `<span class="soon">` badge. The `data-link` attribute names which
artifact each button points at: `paper`, `arxiv`, `code`, `benchmark`, `corpus`,
`models`.

Other `TODO` comments mark the venue line, the news list, the BibTeX entry, and
the GitHub link in the nav.

## The interactive figures

`osreward-charts.js` is written to be lifted into a blog post as-is. Include the
three files, then mount:

```html
<link rel="stylesheet" href="main.css">
<div id="pareto"></div>
<script src="osreward-data.js"></script>
<script src="osreward-charts.js"></script>
<script>
  OSRewardCharts.pareto("#pareto", { metric: "hard" });
</script>
```

Every constructor takes a selector or element and returns
`{ el, update(opts), destroy() }`, and re-renders on container resize so labels
stay at true size instead of being scaled with the SVG.

| Call | Paper figure | What it draws |
| --- | --- | --- |
| `pareto(sel, {metric})` | Fig. 2 | cost vs. accuracy, log x, Pareto frontier |
| `biasPlane(sel, {set})` | Fig. 1b / 6 | fail recall vs. success recall, balanced diagonal |
| `leaderboard(sel, {set, maxHeight})` | Table 1 | sortable, filterable, searchable table |
| `failureModes(sel)` | Fig. 7 | stacked error composition per judge |
| `barPair(sel, {groups})` | Fig. 8 | paired horizontal bar groups |
| `heatmap(sel, {cols, rows, ...})` | Fig. 9, 11 | sequential or diverging heatmap |
| `donut(sel, {data, centerTop})` | Fig. 5, Table 3 | ring chart with a centre stat |
| `groupedBars(sel, {series, groups})` | Fig. 11 right | grouped horizontal bars |
| `composition(sel)` | Fig. 5 | success/fail split bars + length box plot |
| `corpusSankey(sel)` | Fig. 10 | corpus funnel; scrolls sideways below 800 px |

All colours come from the CSS custom properties in `main.css` and the family
palette in `osreward-data.js`, so restyling is one file each.

## Numbers

`osreward-data.js` is the single source of truth. It carries Tables 1–4 and the
data behind Figures 2, 5, 7, 8, 9, 10 and 11, each block commented with its
paper reference. Update it there, never inline in the HTML.

The page ships a light and a dark theme off one token set: `:root` is dark,
`:root[data-theme="light"]` overrides the same variables, and an inline script
in `<head>` sets `data-theme` before first paint (localStorage →
`prefers-color-scheme` → dark) so there is no flash. Anything that bakes a
colour into an SVG attribute goes through `cssVar()` in the chart library, and
`OSRewardCharts.redrawAll()` repaints every chart when the theme flips.

## Deploying

GitHub Pages from a branch, folder `/ (root)`, served at
`https://os-copilot.github.io/OSReward-Home/`. No `.nojekyll` is needed —
nothing in the tree starts with an underscore.

Two things hardcode that address. The Open Graph tags in `<head>` are absolute,
because social scrapers do not resolve relative URLs. And `404.html` uses
root-absolute `/OSReward-Home/…` paths, because Pages serves it for a miss at
any depth below the project path, where relative paths would resolve against
the wrong directory. Everything else on the page is relative and survives a
move on its own. Change those two together if the site is hosted elsewhere.
