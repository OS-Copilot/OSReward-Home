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
There is currently **no** venue line at all: the third revision pass removed it
along with the stat strip, so the hero states no publication status. Add one
under the hero subtitle on acceptance. "Under review" was deliberately not
written, since the status could not be confirmed from the sources.

*Corrected 2026-07-29: this item used to describe a `<p class="venue">Preprint</p>`
in the hero, which had already been deleted. Nothing to replace — it is an
addition.*

### A3 — Author homepages **BLOCKED**
12 of 23 authors link to a homepage, reused from the OS-Genesis / OS-Sentinel /
ScienceBoard pages. Missing: Yian Wang, Bowen Yang, Hang Yan, Nuo Chen,
Jialin Cao, Xingdong Gong, Zehao Li, Kaiming Jin, Xinfeng Yuan, Jiahui Gao,
Jianbing Zhang. Add by wrapping the name in `<a href="…">` in the `.authors`
block.

Note: Zichen Ding intentionally carries no affiliation superscript, following
the `r73` directive in `main.tex`.

### A4 — The paper advertises a URL the site will not serve **RESOLVED 2026-08-03**
Qiushi updated the link in the paper (and on the homepage) to
`https://os-copilot.github.io/OSReward-Home/`, matching the deployment. The
`osreward.github.io` URL is no longer printed anywhere, so its 404 is moot.

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
`public/cover.png` / `.webp` are 900×900 exports of
`figure/resources/osreward-cover-3.jpg` (gitignored; the art has been replaced
twice — `osreward-cover.png` → `cover-2.jpg` → this one). The social card is a
1200×630 composite of the same file. All of it is rebuilt by
`python3 figure/build_cover_assets.py`, which also keeps the card's colours in
step with the CSS `:root` tokens **and bakes in the page title** — so a title
change means re-running it, not just editing the HTML.

The **favicons are not** built from the cover — they come from the OS-Shepherd
brand mark (B2). An earlier version of this note claimed otherwise; corrected
2026-07-29. Changing the key art therefore does *not* require regenerating them.

---

## C. Links

### C1 — Release links: five live, none parked **TODO 2026-08-03**
Live (hero button + Resources card each for the artifacts, plus the nav icon
for code):

| `data-link` | Target |
| --- | --- |
| `paper` | `https://arxiv.org/abs/2607.28609` — verified 200 |
| `code` | `https://github.com/OS-Copilot/OSReward` — **returns 404, see below** |
| `benchmark` | `https://huggingface.co/datasets/OS-Copilot/OSReward` — verified 200 |
| `corpus` | `https://huggingface.co/datasets/OS-Copilot/OS-Shepherd-100K` — verified 200 |
| `models` | `https://huggingface.co/collections/OS-Copilot/osreward-and-os-shepherd` — verified 200 |

The paper went live 2026-08-03 as a single gold **Paper** button carrying the
arXiv logomark (inlined from `public/logos/arxiv-logomark-small.svg`, grey
chevrons switched to `currentColor` for legibility on the gold field). The
separate dashed arXiv button was removed on request, so the hero has five
buttons and `data-link="arxiv"` no longer exists. The `.btn.pending` /
`.pending-card` CSS rules are now unused; kept in case the code links need
re-parking.

> **`github.com/OS-Copilot/OSReward` 404s.** Checked repeatedly, including with a
> browser user agent (last re-checked 2026-08-03). The repository is either
> still private or not created yet, so three places on the live page currently
> point at a 404: the hero Code button, the Resources Code card, and the nav
> GitHub icon. Qiushi supplied the URL while setting the artifacts up, so this
> should resolve itself on publish — but until it does the site advertises a
> dead link. Make the repo public, or say the word and I will re-park those
> three.

### C2 — Nav GitHub button **RESOLVED 2026-07-30**
Points at `https://github.com/OS-Copilot/OSReward` (subject to the 404 note in
C1). Was `href="#resources"`.

### C4 — Three author homepages are dead **RESOLVED 2026-08-03**
Replacements supplied by Qiushi and applied, each verified 200 with a browser
user agent (Scholar times out on a first curl and passes on retry — that is the
same behaviour that looked like a "connection failure" elsewhere, so always
retry before calling a link dead):

| Author | New link |
| --- | --- |
| Jingyang Gong | `https://gonggongjohn.me/` |
| Tianbao Xie | `https://scholar.google.com/citations?user=8sdGK_0AAAAJ` |
| Ben Kao | `https://www.ai.hku.hk/people/academic-staff/kao` |

### C0 — Turn GitHub Pages on **RESOLVED 2026-07-29**
Qiushi enabled it: *Deploy from a branch*, branch `main`, folder `/ (root)`,
HTTPS enforced. **The site is live at `https://os-copilot.github.io/OSReward-Home/`.**

Verified against the live host, not just the settings page: the first build
reported `built` with no error; the page, stylesheet, all three scripts
and every sampled asset under `public/` return 200; the absolute OG image
resolves as a 194 KB `image/png` at the URL scrapers will actually request; 61
images load with none broken; all 12 charts draw; no console errors; no
horizontal overflow. A deep miss at `/OSReward-Home/a/b` correctly serves our
404 page with a resolving stylesheet and a working back-link — the case the
root-absolute paths in `404.html` were introduced for.

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

### D7 — The corpus is presented as 100K, not 96.6K **NOTE**
Qiushi's call, 2026-07-30: nothing on the page states a sub-100K figure for
OS-Shepherd-100K, and the word "distill" appears nowhere (at most "annotate").
The Sankey's final node, its caption and both of its tooltips now read **100K**.

The underlying value is unchanged — `corpusFlow.corpus.n` is still 96,621 — so
the ribbon keeps its true proportion against the 321,631 judge instances; only
the printed strings round up. If you later want the exact count back, it is one
edit: set `show` and drop the 8th slot on the corpus row in `corpusSankey`.
Prose that used to carry the number now describes the mechanism instead ("the
agreement-filtered corpus", "kept from 321,631 judge instances by ensemble
agreement").

**Side effect worth a look.** The Sankey's first column reads "~100K raw
instructions" and its last now reads "100K". The two are different units —
trajectories in, training samples out, with the scale break drawn and labelled
between them — but at a glance the diagram can read as though nothing was
filtered, which undersells a pipeline that visibly drops most of its input.
Options: leave it, or give the corpus node the label alone with no figure, since
the name already carries "100K". Flagged 2026-07-30, not decided.

### D8 — Pipeline demo shows four rollout agent families, not the slide's five **NOTE**
The paper-figure deck (slide 19) draws five model logos including OpenAI, but
`3_method.tex:243` says rollouts span "the Claude, Gemini, Kimi, and Qwen
families" — four. The demo (`#pipeline-demo`, added 2026-08-03) follows the
tex. If GPT rollouts are real and the paper text is stale, fix `main.tex`
first, then add the logo to the rollout node and the narration.

### D5 — OS-Shepherd-35B-A3B has no OOD confusion counts **NOTE**
In the paper's Fig. 11 pipeline this row is a hardcoded dict (accuracy and fail
recall only, no `n`, no success recall). The page therefore never shows an `n`
or a precision figure for it. Do not add one without re-running the eval.

---

## E. Content decisions to confirm

### E1 — News list **TODO**
One entry, dated `2026-07`: "The OSReward project page is live." As of C0 that
is now accurate, so it can stand as the first item. Add the real dated items
above it as they happen, newest first. Two details to settle while there: the
entry uses `YYYY-MM` while the inline TODO comment above it asks for
`YYYY-MM-DD`, and the section has no `id`, so nothing can link to it.

### E2 — BibTeX **RESOLVED 2026-08-03**
Final entry supplied by Qiushi on the arXiv release: compact `field={…}`
formatting, `journal={arXiv preprint arXiv:2607.28609}`. His message truncated
the authors with "and others"; the full 23-author list was restored on his
instruction, wrapped across lines as before. The entry lives inline in
`index.html` (`<pre id="bibtex">`, ~line 1052) — there is no separate `.bib`
file, the "osreward.bib" in the code-box bar is decoration.

### E3 — DataViewer ships invented examples **BLOCKED — replace before advertising**
The `#viewer` section is live with three **placeholder** records in
`OSRewardData.viewer`. The instructions, steps and judge verdicts are all
invented, including verdicts attributed to real named models (GPT-5.5,
Claude-Opus-4-8, Qwen3-VL-30B). A prominent amber banner says so, and the banner
is driven by `viewer.placeholder`, so replacing the array and setting that flag
to `false` in the same commit removes it.

Qiushi asked for a placeholder example and approved the push knowing this. Until
real records land, do not link the section from anywhere external. Step objects
accept an optional `shot` image path; supply it and the dashed placeholder frame
becomes a real screenshot with no code change.

### E4 — The held-out disclosure was deleted with the leaderboard note **CLOSED 2026-08-03**
Qiushi's call: leave it as is, no held-out line to be added. Closed, not to be
reopened without a new instruction. Original item kept below for context.

Removing the "Sort any column…" note (§5 of the 2026-07-29 revision) also
removed the page's only statement that **OS-Shepherd is evaluated held-out** —
that it trains on OS-Shepherd-100K, which is disjoint from this benchmark.
Nothing else on the page says it (`grep` for "disjoint" / "held-out" returns only
the unrelated "Held-out benchmarks" generalization chart). This is a substantive
methodological disclosure about our own models topping the table; it should get
one line somewhere in the OS-Shepherd section. Raised and left for Qiushi's call.

### E5 — One "mid-tier" left **TODO**
"mid-tier" was dropped from the hero bullet and the Overview contribution on
request. The OS-Shepherd-9B model card still reads "moves … into the mid-tier
commercial band", which is a claim about where the model lands rather than a
hedge. Left as written since only the bullet was flagged.

---

## Resolved

- *2026-08-03, session 5* — arXiv release wired in: the hero's parked Paper /
  arXiv pair became one live gold **Paper** button (arXiv logomark,
  `https://arxiv.org/abs/2607.28609`), the BibTeX journal line gained the
  eprint id (E2), the three dead author homepages got their replacements (C4),
  the paper's printed URL now matches the deployment (A4), and E4 was closed
  as won't-fix. Still open: the code repo 404 (C1), the DataViewer placeholder
  data (E3), and D7.

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
