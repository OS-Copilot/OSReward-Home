# Open items — OSReward-Home

Questions and pending inputs for the project page. Resolved items move to the
bottom with a date so the history stays readable.

Status key: **BLOCKED** needs a decision or a file from Qiushi · **TODO** known
work, no decision needed · **NOTE** deliberate choice, recorded so it is not
re-litigated.

---

## A. Publication and identity

### A1 — Author anonymity **RESOLVED 2026-07-27**
`paper/main.tex` sets `\anonauthorstrue`, so the PDF byline reads
"OSReward Contributors" while this page lists all 23 authors and 7
affiliations. Qiushi confirmed the page keeps the full byline: the anonymous
byline belongs to a specific submission version, and the project page is meant
to be public. No code change; the byline block stands as written. This item is
closed and should not be reopened without a new instruction.

### A2 — Venue line **TODO**
`index.html`, hero: `<p class="venue">Preprint</p>`. Replace with the venue on
acceptance. "Under review" was deliberately not written since the status could
not be confirmed from the sources.

### A3 — Author homepages **BLOCKED**
12 of 23 authors link to a homepage, reused from the OS-Genesis / OS-Sentinel /
ScienceBoard pages. Missing: Yian Wang, Bowen Yang, Hang Yan, Nuo Chen,
Jialin Cao, Xingdong Gong, Zehao Li, Kaiming Jin, Xinfeng Yuan, Jiahui Gao,
Jianbing Zhang. Add by wrapping the name in `<a href="…">` in the `.authors`
block.

Note: Zichen Ding intentionally carries no affiliation superscript, following
the `r73` directive in `main.tex`.

### A4 — The paper advertises a URL the site will not serve **BLOCKED**
The abstract points readers at `https://osreward.github.io/`, but C3 settled the
deployment on `https://os-copilot.github.io/OSReward-Home/`. As it stands the
printed link is dead. The two have to agree before the paper is public. Either:

1. change the URL in `main.tex` to the OS-Copilot subpath, or
2. register the `osreward` GitHub account, create `osreward/osreward.github.io`,
   and serve a redirect (or the site itself) from it.

Option 2 keeps the shorter URL and survives the repo moving later; option 1 is
free. Raised 2026-07-27 when C3 was decided.

---

## B. Assets

### B1 — Affiliation logos **RESOLVED 2026-07-27**
All seven institutions now have a real mark in `public/affil/` (hku, nju, nus,
ustc, xjtu, oxford, fudan), normalised to 96×96 transparent PNGs. The initials
placeholder and its CSS rule are gone.

### B1b — "More research" links **RESOLVED 2026-07-27**
All six projects in the nav dropdown carry their own artwork
(`public/logos/projects/`). The two weak targets were chased down:

| Project | Link | Source |
| --- | --- | --- |
| OS-Sentinel / ScienceBoard / OS-Genesis | project pages | verified, sibling repos |
| OS-Atlas | `https://osatlas.github.io/` | verified, cited on your own site |
| OpenMobile | `https://njucckevin.github.io/openmobile/` | project page, fetched and confirmed — title matches, links to paper, weights, data and code |
| SeeClick | `https://aclanthology.org/2024.acl-long.505` | no project page exists; kept the anthology entry |

OpenMobile was moved off its arXiv abstract onto the project page. SeeClick has
none: the canonical repo is `njucckevin/SeeClick` (resolved through the fork
parent of the local clone), and the GitHub API reports `has_pages: false` with
an empty homepage field. The anthology link therefore stays. If you would rather
send readers to the code, `https://github.com/njucckevin/SeeClick` is the
verified canonical repository — one line, say the word.

OS-Copilot was removed from the menu on 2026-07-27.

### B2 — Brand mark **NOTE**
`OS-Shepherd-logo-v3.png` (supplied 2026-07-27) is the source for the favicon,
the nav/footer/404 marks and the "ours" family logo. The **whole composition** is
used, not a crop. If the artwork is ever replaced, regenerate all six
derivatives together (favicon 16/32/512, `favicon.ico`, `apple-touch-icon`
and the `logos/OS-Shepherd.png` family mark).

### B3 — Cover art **NOTE**
`public/cover.png` / `.webp` are 900×900 quantised exports of
`figure/resources/osreward-cover.png` (gitignored). Favicons and the social card
are crops of the same file, all generated from the gitignored original with
PIL: 900x900 `quantize(224)` for the cover, a border flood-fill for the brand
mark's background, and a 1200x630 composite for the social card.

---

## C. Links

### C1 — Every release link is parked **TODO**
Paper, arXiv, Code, OSReward, OS-Shepherd-100K, Models. In `index.html` search
for `class="btn pending"` (hero) and `class="card feature pending-card"`
(Resources). For each: drop the `pending` / `pending-card` class and add `href`
(Resources cards also carry a `<span class="soon">` badge to delete; the hero
buttons no longer do). The `data-link` attribute names the artifact (`paper`,
`arxiv`, `code`, `benchmark`, `corpus`, `models`). Once every hero link is live,
remove the `.links-note` line under the row.

### C2 — Nav GitHub button **TODO**
Currently `href="#resources"`. Point at the code repository once public.

### C0 — Turn GitHub Pages on **TODO — Qiushi**
The code is pushed but the site is not served yet; `gh api
repos/OS-Copilot/OSReward-Home/pages` returned 404 on 2026-07-27, confirming
Pages is still off. Qiushi is doing this by hand: Repository → Settings → Pages
→ Source: *Deploy from a branch*, branch `main`, folder `/ (root)`. No
`.nojekyll` is needed — nothing in the tree starts with an underscore. The site
should then answer at `https://os-copilot.github.io/OSReward-Home/`; check that
the stylesheet and `public/` assets load, since a wrong folder setting fails
quietly with an unstyled page.

### C3 — Deployment host **RESOLVED 2026-07-27**
Settled on `https://os-copilot.github.io/OSReward-Home/`, a project page under
the existing `OS-Copilot/OSReward-Home` remote. Consequences, all applied:

- `og:url` and both image tags in `index.html` now carry that absolute prefix.
  Social scrapers do not resolve relative URLs, so these are the only absolute
  URLs on the page and they must move together with the host.
- `index.html`, the CSS and the JS use relative paths throughout, so the subpath
  needs no other change. Verified by serving the parent directory and loading
  the page at `/OSReward-Home/`.
- `404.html` was switched to root-absolute `/OSReward-Home/…` paths. Pages
  serves it for any miss below the project path, including deep ones, where
  relative paths resolve against the wrong directory and leave an unstyled page
  with a dead back-link. This is the one file that hardcodes the repository
  name.
- The URL printed in the paper no longer matches. See A4.

---

## D. Data and figure fidelity

### D1 — Pareto point set differs from the paper **NOTE**
Paper Fig. 2 hides `Intern-S2-Preview` (the generator comments say it is a
logo-alignment issue, not a data one) and the wide variant crops
`Qwen3-VL-235B` / `Qwen3-VL-30B` at `acc >= 34.5`. The page plots all 30 points.
Say the word to match the paper exactly — the entries are in the `PARETO` array
of `static/js/osreward-data.js`.

### D2 — Figure 8 excludes the "Others" failure type **NOTE**
Paper Fig. 8 filters out `Others` (n=71, 57.1%), which would otherwise be the
highest bar and would soften the "perception and action are hardest" reading.
The page mirrors the paper. Flagged because a reader who has the appendix may
notice.

### D3 — Ablation average column **NOTE**
Paper prose says text removal costs 7.2 pp on average (12-model mean, includes
Intern-S1-Pro); the figure's `avg` column reads −7.29 (11 models shown). The
page carries both and the chart note states which models the average covers.

### D4 — Transcription fix already applied **NOTE**
`Qwen3-VL-8B` hard-set accuracy is **36.2**, not 35.2. All 29 Table 1 rows were
verified cell by cell against `paper/tables/tab_leaderboard.tex`.

### D6 — Sankey inflows are normalised **NOTE**
The four open-source corpora in Figure 10 are printed at the paper's rounded
values (22.5K + 5.2K + 2.2K + 1.0K) and sum to 82.5K against a stated 82K node.
The chart keeps the printed labels and normalises the band heights to the node.
The paper's own generator instead uses 500 for ScaleCUA while printing 1.0K.

### D5 — OS-Shepherd-35B-A3B has no OOD confusion counts **NOTE**
In the paper's Fig. 11 pipeline this row is a hardcoded dict (accuracy and fail
recall only, no `n`, no success recall). The page therefore never shows an `n`
or a precision figure for it. Do not add one without re-running the eval.

---

## E. Content decisions to confirm

### E1 — News list **TODO**
One placeholder entry. Add real dated items, newest first, `YYYY-MM` format.

### E2 — BibTeX **TODO**
`journal = {arXiv preprint}` with no eprint id. Fill in on arXiv submission.

---

## Resolved

- *2026-07-29, session 3* — Accessibility and semantics pass. All 31 inline icon
  SVGs now carry `aria-hidden="true"`; `chart-hard` gained the container label
  the other eleven charts already had; table headers gained `scope`; the footer
  column labels became `h2` so the heading outline no longer skips a level. The
  rest of the audit came back clean. One improvement left on the table by
  choice: the model-name cells in each table body are still `td`, not
  `th scope="row"` — converting them moves the cells onto `.data th` styling, so
  it needs its own visual pass.

- *2026-07-27, session 2* — Both publication blockers answered by Qiushi. A1:
  the page keeps the full 23-author byline. C3: the site deploys to
  `https://os-copilot.github.io/OSReward-Home/`, so the Open Graph URLs were
  rewritten and `404.html` was moved to root-absolute paths, which the subpath
  would otherwise have broken. Verified by serving the parent directory and
  loading the page at `/OSReward-Home/`. B1b closed in the same pass: OpenMobile
  moved to its project page, SeeClick confirmed not to have one. A4 raised —
  the URL in the paper no longer matches the deployment.

- *2026-07-27* — First commit pushed to `main`. `figure/` (paper draft, raw
  cover art) and `HANDOFF.md` (session log) are gitignored; everything else in
  the tree ships.

- *2026-07-27* — Style dialled back from the first pass: split hero following
  the OS-Sentinel / ScienceBoard / OS-Genesis structure, smaller title, calmer
  glows, drop cap removed, starfield opacity halved.
- *2026-07-27* — Affiliation logos moved inline (small mark left of each name)
  instead of the 80 px logo row the reference pages use.
- *2026-07-27* — Light/dark theme added, toggle in the nav, persisted in
  `localStorage` under `osreward-theme`.
- *2026-07-27* — Second revision pass: platform-mix donut recoloured to the site
  palette with the two Ubuntu slices adjacent and same-hue; median labels dropped
  from the trajectory-length box plot; chart legends renamed (Shanghai AI Lab →
  Intern, ByteDance → Seed) and the OS-Shepherd chip given a gold field so it no
  longer needs an "(ours)" suffix; vendor logos removed from the ablation heatmap
  headers; every "Paper Fig. N" badge removed; the link row compacted onto one
  line with a single caption instead of six "soon" badges; the byline moved onto
  a light panel in both themes so the crests read without per-logo white discs;
  equal contribution shown as a colour rather than an asterisk; the long abstract
  replaced with a short motivation plus three contributions; the hero widened;
  and the cover matted like a framed print in the light theme so the dark
  artwork sits on the warm background instead of punching a hole in it.
- *2026-07-27* — Dark-theme logo legibility, second attempt: the warm-silhouette
  CSS filter was replaced by pre-rendered `-dark.png` crests, because a flat
  silhouette blanks the filled crests (HKU, NUS) into white lozenges. Dropdown
  project icons now sit on a light plate in the dark theme.
- *2026-07-27* — "More research" dropdown: six projects, each with its own
  logo (OS-Atlas arrived on a white ground and was flood-filled to transparent
  like the brand mark); OS-Copilot dropped; descriptions title-cased.
- *2026-07-27* — Fourth revision pass: hero link labels now name the artifacts
  (OSReward / OS-Shepherd-100K / OS-Shepherd-9B/35B) and the hero widened to
  `--page-hero: 1500` so they still fit one line; parked buttons made legible on
  the light theme (they were `--text-faint` on cream); leaderboard ties now
  break in our favour, so OS-Shepherd-9B sits above GPT-5-mini at 86.1; content
  containers widened again (1460 → 1560); and the Sankey was rebuilt to hang
  from a flat top edge with every open-source corpus as its own labelled branch.
- *2026-07-27* — Third revision pass: venue line and stat strip removed; content
  sections widened ~25%; heatmap row labels measured instead of fixed (was
  clipping "OS-Shepherd-35B-A3B"); nav wordmark now "OSReward & OS-Shepherd";
  "More research" moved from the footer into a nav dropdown; the byline's light
  panel reverted in favour of warm-silhouette crests on the dark theme; a cosmic
  gradient band added behind the hero so the cover art no longer sits on flat
  navy; per-bar "n =" labels and the three views' "n =" chips moved to tooltips
  or dropped; chart legends no longer wrap mid-label; and paper Figure 10 is now
  an interactive Sankey (`corpusSankey`).
- *2026-07-27* — Favicon set rebuilt from `OS-Shepherd-logo-v3.png`: background
  flood-filled to transparent, the whole mark used at every size, six
  derivatives generated, and the 1.5 MB source shipped at 92 KB. `public/logos/OS-Shepherd.png` (deleted when
  the new logo landed, which had broken the family mark in the leaderboard,
  tooltips and model cards) was regenerated from the same head crop.
