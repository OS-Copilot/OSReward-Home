# OSReward — project page

Source for the OSReward homepage: *Instituting Standardized Evaluation for
Cross-Platform Computer-Use Reward Models*.

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
  osreward-demo.js       pipeline walkthrough stepper (#pipeline-demo)
  osreward-case-steps.js case-study steps, thoughts, judge responses (generated)
  osreward-corpus.js     all 1,019 trajectories as compact rows (generated)
  osreward-player.js     "Be the judge" case player (#viewer-body)
  osreward-atlas.js      corpus atlas canvas (#atlas-body)
  osreward-polish.js     findings headliners, OS-Copilot series orbit,
                         reading progress
  main.js                page behaviour + chart wiring
static/css/
  osreward-player.css    case player + atlas styles (same token set)
  osreward-polish.css    styles for osreward-polish.js
tools/
  build_case_studies.py  case-study frames + step data (needs the raw traces)
  build_corpus_atlas.py  osreward-corpus.js from ../data/full
  build_hard_cases.py    extra hard cases: public/cases/hard_*/ + osreward-hard-cases.js
public/
  cover.png              project key art
  favicon*.png .ico      derived from the cover
  social/og-image.png    1200x630 social card
  demo/                  pipeline-demo screenshots (from the paper-figure deck)
  logos/                 model-family marks used in tables and plots
  logos/platforms/       platform marks for the pipeline demo
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

## Icons and the overview figure

`index.html` carries one inline SVG sprite (`<svg class="ico-sprite">`) of
duotone line icons: `i-bench`, `i-judge`, `i-corpus`, `i-model`, `i-traj`,
`i-verdict`, `i-eval`, `i-curate`, `i-rl`, `i-unmeasured`, `i-interleaved`,
`i-scratch`, `i-full`, `i-hard`, `i-multi`, `i-code`. Use one with
`<span class="ico-tile"><svg class="duo"><use href="#i-judge"/></svg></span>`
(`.lg` / `.xl` for larger tiles). Inside the symbols, stroke parts carry
`ico-sk` and accents `ico-a` (gold), `ico-b` (cyan wash), `ico-bs` (cyan),
`ico-as` (gold stroke): plain class names, because selectors with ancestors do
not reach `<use>` clones. Colours come from `--ico-*` in `osreward-polish.css`.

The Overview opens with the judge-loop figure (`.loop`: trajectory → VLM
judge → verdict → evaluation / curation / RL) and the four contributions as a
connected flow (`.contrib-flow`), both plain HTML + CSS.

## Be the judge — the case player

`osreward-player.js` turns each case in `OSRewardData.viewer.examples` into a
replay. The reader first sees a **blind replay** (instruction, screenshots,
actions, reasoning; no captions, case type or highlighted states), votes
SUCCESS / FAILURE (buttons or the `S` / `F` keys), and only then gets the human
verdict, the judges' votes and raw responses, and the annotated timeline.
Votes are kept per browser in `localStorage` and only drive the score line.

Actions are parsed from the raw tool calls of every agent family on the page
(`box2d` on the 0–1000 grid as `[ymin, xmin, ymax, xmax]`, Gemini `click_at` /
`type_text_at` and Qwen `mobile_use` on the 0–999 grid, `computer.mouse.move_abs`
fractions) and drawn over the screenshot. Deep links:
`#case=<id>&state=<n>`; the link button in the player copies one.
`window.OSRewardPlayer.open(id, state)` opens a case from other scripts.

Beyond the ten paper case studies, `tools/build_hard_cases.py` adds hard
picks from `../data/full` (false successes whose final screen looks right, and
noisy hard successes). Their captions and highlighted states were written for
the page, which the player states; they have no exported judge responses yet.
Edit the `CASES` list in that script and rerun it to add or change one.

The agent name shown for each case comes from `osreward-corpus.js` by
`traceId`. Rebuild that file after the export changes:

```bash
python3 tools/build_corpus_atlas.py --src ../data/full
```

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
