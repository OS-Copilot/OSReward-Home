/* ==========================================================================
   OSReward — data module
   Every number on this page comes from the paper. Keep this file the single
   source of truth so the charts, the tables and any future blog post agree.

   Usage:  <script src="osreward-data.js"></script>  ->  window.OSRewardData
   ========================================================================== */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------------- families
     Display colours for model families. Chosen for separation on the dark
     page; "ours" is gold so OS-Shepherd reads as the subject of every plot. */
  var FAMILIES = {
    anthropic: { label: "Anthropic",   color: "#e5825f", logo: "Claude.png" },
    openai:    { label: "OpenAI",      color: "#8fa3bd", logo: "GPT.png" },
    google:    { label: "Google",      color: "#4f97ee", logo: "Gemini.png" },
    qwen:      { label: "Qwen",        color: "#a67ded", logo: "Qwen.png" },
    kimi:      { label: "Moonshot",    color: "#d0779a", logo: "Kimi.png" },
    doubao:    { label: "Seed",        color: "#2fbcbc", logo: "Doubao.png" },
    intern:    { label: "Intern",      color: "#46c489", logo: "InternLM.png" },
    ours:      { label: "OS-Shepherd", color: "#d9a53a", logo: "OS-Shepherd.png", ours: true }
  };

  /* ------------------------------------------------------------ leaderboard
     Paper Table 1 — main-setting results, sorted by full-set accuracy.
     acc = binary accuracy, sRec = recall on GT=SUCCESS, fRec = recall on
     GT=FAIL, bal = balanced accuracy (their mean). Hard-set columns mirror it.
     "access": closed | open | ours   (ours = open weights + open data)        */
  var JUDGES = [
    // name,                     family,      access,  full[acc,sRec,fRec,bal],  hard[acc,sRec,fRec,bal]
    ["Claude-Opus-4-8",          "anthropic", "closed", [89.7, 91.1, 88.9, 90.0], [69.7, 69.8, 69.7, 69.7]],
    ["GPT-5.5",                  "openai",    "closed", [89.5, 91.8, 87.8, 89.8], [67.3, 66.3, 67.7, 67.0]],
    ["Claude-Opus-4-6",          "anthropic", "closed", [89.5, 92.7, 87.7, 90.2], [67.3, 72.1, 65.2, 68.6]],
    ["Gemini-3.1-Pro",           "google",    "closed", [87.9, 90.2, 86.2, 88.2], [61.6, 61.6, 61.6, 61.6]],
    ["Gemini-3.5-Flash",         "google",    "closed", [87.8, 95.7, 81.8, 88.8], [59.5, 81.4, 50.0, 65.7]],
    ["Claude-Sonnet-4-6",        "anthropic", "closed", [87.7, 97.5, 80.3, 88.9], [59.2, 90.7, 45.5, 68.1]],
    ["GPT-5",                    "openai",    "closed", [87.4, 86.8, 87.9, 87.4], [58.1, 43.0, 64.6, 53.8]],
    ["GPT-5.4",                  "openai",    "closed", [87.1, 87.3, 87.0, 87.1], [63.0, 62.8, 63.1, 63.0]],
    ["Gemini-3-Flash",           "google",    "closed", [87.0, 96.6, 79.8, 88.2], [57.0, 86.0, 44.4, 65.2]],
    ["GPT-5-mini",               "openai",    "closed", [86.1, 93.8, 80.2, 87.0], [56.3, 79.1, 46.5, 62.8]],
    ["Kimi-K2.5",                "kimi",      "open",   [85.9, 95.5, 79.2, 87.3], [54.8, 83.7, 42.1, 62.9]],
    ["Qwen3.5-397B-A17B",        "qwen",      "open",   [85.8, 95.2, 78.6, 86.9], [58.5, 91.9, 43.9, 67.9]],
    ["GPT-5.4-mini",             "openai",    "closed", [85.2, 82.5, 87.2, 84.9], [58.1, 48.2, 62.4, 55.3]],
    ["Claude-Haiku-4-5",         "anthropic", "closed", [84.5, 80.9, 87.2, 84.0], [59.5, 47.7, 64.6, 56.2]],
    ["GPT-5.2",                  "openai",    "closed", [83.9, 73.0, 92.2, 82.6], [63.0, 30.2, 77.3, 53.8]],
    ["Gemini-2.5-Flash",         "google",    "closed", [83.3, 95.5, 74.0, 84.8], [48.9, 90.7, 30.8, 60.8]],
    ["Doubao-2.0-Lite",          "doubao",    "closed", [83.3, 98.5, 72.1, 85.3], [45.5, 96.1, 24.3, 60.2]],
    ["GPT-5-nano",               "openai",    "closed", [82.3, 97.0, 71.1, 84.1], [45.4, 95.3, 23.7, 59.5]],
    ["Intern-S1-Pro",            "intern",    "open",   [82.3, 92.3, 74.7, 83.5], [43.7, 70.9, 31.8, 51.4]],
    ["Qwen3.5-35B-A3B",          "qwen",      "open",   [82.2, 92.4, 74.5, 83.5], [51.1, 83.7, 36.9, 60.3]],
    ["Qwen3.5-27B",              "qwen",      "open",   [82.0, 97.4, 70.5, 84.0], [44.2, 92.9, 23.2, 58.0]],
    ["GPT-4o",                   "openai",    "closed", [81.0, 96.8, 69.0, 82.9], [39.4, 90.7, 17.2, 53.9]],
    ["Intern-S2-Preview",        "intern",    "open",   [80.6, 98.4, 66.9, 82.7], [40.3, 94.2, 16.8, 55.5]],
    ["Qwen3.5-122B-A10B",        "qwen",      "open",   [79.6, 96.8, 66.4, 81.6], [39.4, 89.5, 17.7, 53.6]],
    ["Qwen3-VL-8B",              "qwen",      "open",   [77.1, 99.8, 59.9, 79.8], [36.2, 100.0, 8.2, 54.1]],
    ["Qwen3-VL-235B",            "qwen",      "open",   [74.0, 99.1, 54.9, 77.0], [31.4, 97.7, 2.5, 50.1]],
    ["Qwen3-VL-30B",             "qwen",      "open",   [69.4, 99.8, 46.3, 73.0], [31.1, 98.8, 1.5, 50.2]],
    ["OS-Shepherd-9B",           "ours",      "ours",   [86.1, 86.6, 86.0, 86.3], [60.2, 66.3, 57.6, 61.9]],
    ["OS-Shepherd-35B-A3B",      "ours",      "ours",   [85.6, 85.0, 86.2, 85.6], [62.7, 68.6, 60.1, 64.3]]
  ].map(function (r) {
    return {
      name: r[0], family: r[1], access: r[2],
      full: { acc: r[3][0], sRec: r[3][1], fRec: r[3][2], bal: r[3][3] },
      hard: { acc: r[4][0], sRec: r[4][1], fRec: r[4][2], bal: r[4][3] }
    };
  });

  /* ------------------------------------------------------------------ multi
     Paper Table 2 — OSReward-Multi (%), sorted by AUC.                       */
  var MULTI = [
    { name: "GPT-5.5",             family: "openai",    align: 58.7, effic: 68.2, multi: 63.5, auc: 66.7 },
    { name: "Claude-Opus-4-8",     family: "anthropic", align: 52.9, effic: 68.7, multi: 60.8, auc: 65.6 },
    { name: "Claude-Sonnet-4-6",   family: "anthropic", align: 53.2, effic: 62.6, multi: 57.9, auc: 61.9 },
    { name: "Gemini-3.5-Flash",    family: "google",    align: 47.6, effic: 71.4, multi: 59.5, auc: 60.8 },
    { name: "OS-Shepherd-35B-A3B", family: "ours",      align: 47.7, effic: 65.8, multi: 56.8, auc: 60.7 },
    { name: "OS-Shepherd-9B",      family: "ours",      align: 44.1, effic: 54.0, multi: 49.0, auc: 58.5 },
    { name: "Gemini-3-Flash",      family: "google",    align: 50.6, effic: 61.5, multi: 56.0, auc: 55.8 }
  ];

  /* ----------------------------------------------------------------- cost
     Paper Figure 2 — judge cost against OSReward-Hard accuracy.
     `cost` is the total USD to judge all 1,019 trajectories at official API
     list prices (open-weight models priced at market rates for similar-size
     models, May 2026); the paper reads it as cost per 1,000 trajectories.
     Accuracies here come from the hard-set survival table, so a few differ
     from Table 1 by <0.1 pp. Intern-S2-Preview and the two cropped Qwen3-VL
     points are included here although the paper's Fig. 2 omits them; see
     open_items.md.                                                           */
  var PARETO = [
    // name,                   family,      access,  cost,      hard,    full
    ["Claude-Opus-4-8",        "anthropic", "closed", 86.04,    69.72,   89.70],
    ["Claude-Opus-4-6",        "anthropic", "closed", 85.56,    67.25,   89.50],
    ["Claude-Sonnet-4-6",      "anthropic", "closed", 52.96,    59.15,   87.71],
    ["GPT-5.5",                "openai",    "closed", 45.44,    67.25,   89.50],
    ["GPT-5.4",                "openai",    "closed", 20.87,    63.03,   87.13],
    ["Kimi-K2.5",              "kimi",      "open",   20.37,    54.77,   85.87],
    ["GPT-4o",                 "openai",    "closed", 20.31,    39.44,   81.04],
    ["Claude-Haiku-4-5",       "anthropic", "closed", 18.55,    59.51,   84.46],
    ["GPT-5.2",                "openai",    "closed", 15.27,    63.03,   83.89],
    ["GPT-5",                  "openai",    "closed", 10.76,    58.10,   87.43],
    ["Qwen3-VL-235B",          "qwen",      "open",    8.16,    31.45,   73.99],
    ["Gemini-3.1-Pro",         "google",    "closed",  7.98,    61.62,   87.92],
    ["Qwen3.5-397B-A17B",      "qwen",      "open",    7.96,    58.45,   85.77],
    ["GPT-5.4-mini",           "openai",    "closed",  6.20,    58.10,   85.18],
    ["Intern-S2-Preview",      "intern",    "open",    5.94,    40.28,   80.55],
    ["Intern-S1-Pro",          "intern",    "open",    5.90,    43.66,   82.32],
    ["Gemini-3.5-Flash",       "google",    "closed",  5.78,    59.51,   87.82],
    ["Doubao-2.0-Lite",        "doubao",    "closed",  4.82,    45.53,   83.26],
    ["Qwen3.5-122B-A10B",      "qwen",      "open",    4.11,    39.44,   79.57],
    ["Qwen3-VL-30B",           "qwen",      "open",    3.09,    31.10,   69.42],
    ["Qwen3.5-35B-A3B",        "qwen",      "open",    2.83,    51.06,   82.24],
    ["OS-Shepherd-35B-A3B",    "ours",      "ours",    2.83,    62.70,   85.60],
    ["Qwen3.5-27B",            "qwen",      "open",    2.60,    44.24,   82.05],
    ["GPT-5-mini",             "openai",    "closed",  2.17,    56.34,   86.06],
    ["Gemini-3-Flash",         "google",    "closed",  2.02,    57.04,   87.03],
    ["Qwen3-VL-8B",            "qwen",      "open",    1.39,    36.17,   77.14],
    ["OS-Shepherd-9B",         "ours",      "ours",    1.36,    60.20,   86.06],
    ["Qwen3.5-9B",             "qwen",      "open",    1.36,    39.40,   76.70],
    ["Gemini-2.5-Flash",       "google",    "closed",  1.33,    48.94,   83.30],
    ["GPT-5-nano",             "openai",    "closed",  0.80,    45.42,   82.32]
  ].map(function (r) {
    return { name: r[0], family: r[1], access: r[2], cost: r[3], hard: r[4], full: r[5] };
  });

  /* --------------------------------------------------------- failure modes
     Paper Figure 7 — every incorrect verdict labeled into six modes, as a
     share of that judge's errors. `n` is the judge's total error count.      */
  var FAILURE_MODES = {
    categories: [
      { key: "incomplete", label: "Over-accept: task incomplete",     group: "accept", color: "#d9705c" },
      { key: "wrong",      label: "Over-accept: wrong action",        group: "accept", color: "#e79470" },
      { key: "suppressed", label: "Over-accept: error suppressed",    group: "accept", color: "#e8c08f" },
      { key: "path",       label: "Over-reject: strict on path",      group: "reject", color: "#a9d6c9" },
      { key: "deviation",  label: "Over-reject: strict on deviation", group: "reject", color: "#66b2a0" },
      { key: "ambiguous",  label: "Over-reject: ambiguous completion",group: "reject", color: "#4f93a8" }
    ],
    rows: [
      { name: "Claude-Sonnet-4-6", family: "anthropic", n: 154, values: [76.6, 7.1, 6.5, 0.0, 1.9, 7.8] },
      { name: "Qwen3.5-397B",      family: "qwen",      n: 161, values: [75.2, 6.8, 5.0, 0.6, 1.9, 10.6] },
      { name: "Kimi-K2.5",         family: "kimi",      n: 170, values: [75.9, 5.3, 2.4, 2.4, 4.7, 9.4] },
      { name: "Gemini-3.5-Flash",  family: "google",    n: 156, values: [75.6, 3.8, 2.6, 2.6, 5.1, 10.3] },
      { name: "Claude-Opus-4-6",   family: "anthropic", n: 138, values: [54.3, 8.0, 5.1, 1.4, 10.1, 21.0] },
      { name: "Gemini-3.1-Pro",    family: "google",    n: 156, values: [56.4, 3.2, 4.5, 3.8, 14.1, 17.9] },
      { name: "GPT-5.5",           family: "openai",    n: 144, values: [56.3, 4.2, 2.1, 3.5, 14.6, 19.4] }
    ]
  };

  /* --------------------------------------------------------------- hard set
     Paper Figure 8 — mean per-judge binary accuracy on OSReward-Hard.        */
  var HARD_BREAKDOWN = {
    platform: [
      { key: "Mobile",  n: 63,  acc: 58.3 },
      { key: "Ubuntu",  n: 132, acc: 52.1 },
      { key: "Web",     n: 60,  acc: 51.9 },
      { key: "Windows", n: 29,  acc: 42.4 }
    ],
    failure: [
      { key: "Memory",     n: 20,  acc: 49.5 },
      { key: "Planning",   n: 187, acc: 49.0 },
      { key: "Action",     n: 62,  acc: 43.5 },
      { key: "Perception", n: 51,  acc: 41.6 }
    ]
  };

  /* ------------------------------------------------------------- ablations
     Paper Figure 9 — change in binary accuracy vs. the main setting (pp).    */
  var ABLATIONS = {
    models: ["Opus-4-6", "Opus-4-8", "Sonnet-4-6", "GPT-4o", "GPT-5", "GPT-5-mini",
             "GPT-5.5", "2.5-Flash", "3-Flash", "3.5-Flash", "3.5-397B"],
    families: ["anthropic", "anthropic", "anthropic", "openai", "openai", "openai",
               "openai", "google", "google", "google", "qwen"],
    rows: [
      { label: "Last-3 frames",          note: "fewer trailing screenshots",
        values: [-0.5, -1.2, -0.3, 0.7, 0.2, -0.3, 0.3, 0.2, 0.5, -0.2, -0.3], avg: -0.07 },
      { label: "First + last-2 frames",  note: "start plus the ending",
        values: [0.2, -1.9, -0.1, 0.6, -1.0, -1.2, 0.4, 0.0, -0.7, 1.1, 0.0], avg: -0.24 },
      { label: "Screenshots only",       note: "no reasoning or action text",
        values: [-8.4, -10.7, -7.1, -2.2, -10.1, -5.5, -9.5, -7.9, -8.3, -5.3, -5.3], avg: -7.29 },
      { label: "Screenshots + actions",  note: "no reasoning",
        values: [-1.4, -3.0, -1.6, -2.1, -3.4, -2.7, -0.7, -2.5, -2.3, 0.3, -0.3], avg: -1.78 },
      { label: "No action marker",       note: "red click marker removed",
        values: [0.2, -0.3, 0.6, -0.5, 0.5, 0.6, -0.3, 1.2, 0.4, 1.3, -0.2], avg: 0.32 }
    ]
  };

  /* --------------------------------------------------------- generalization
     Paper Figure 11 — judges on three existing CUA benchmarks, scored against
     each benchmark's own human-written verifier on matched subsets.
     Means in the paper are computed before rounding.                         */
  var GENERALIZATION = {
    benchmarks: ["OSWorld", "WebArena", "AndroidWorld"],
    rows: [
      { name: "Gemini-3.1-Pro",       family: "google",    v: [75, 84, 89], mean: 83 },
      { name: "Claude-Sonnet-4-6",    family: "anthropic", v: [75, 82, 88], mean: 82 },
      { name: "Gemini-3-Flash",       family: "google",    v: [74, 81, 89], mean: 81 },
      { name: "OS-Shepherd-35B-A3B",  family: "ours",      v: [72, 82, 84], mean: 80 },
      { name: "OS-Shepherd-9B",       family: "ours",      v: [73, 81, 83], mean: 79 },
      { name: "GPT-5-mini",           family: "openai",    v: [72, 80, 84], mean: 79 },
      { name: "Qwen3.5-35B",          family: "qwen",      v: [71, 74, 74], mean: 73 },
      { name: "Qwen3.5-397B",         family: "qwen",      v: [70, 74, 73], mean: 72 },
      { name: "Qwen3-VL-235B",        family: "qwen",      v: [67, 71, 68], mean: 69 },
      { name: "Qwen3.5-9B",           family: "qwen",      v: [64, 67, 70], mean: 67 },
      { name: "Qwen3-VL-30B",         family: "qwen",      v: [64, 66, 64], mean: 65 }
    ],
    /* Leniency resistance = recall on truly-failed runs. The Qwen series is
       the median over five general Qwen judges (9B to 397B). */
    leniency: [
      { bench: "OSWorld",      shep9b: 0.456, shep35b: 0.488, qwen: 0.242 },
      { bench: "WebArena",     shep9b: 0.846, shep35b: 0.865, qwen: 0.656 },
      { bench: "AndroidWorld", shep9b: 0.633, shep35b: 0.708, qwen: 0.250 }
    ],
    n: { OSWorld: 718, WebArena: 404, AndroidWorld: 300 }
  };

  /* ------------------------------------------------------------- benchmark
     Paper Figure 5 and §3.4.                                                 */
  var BENCHMARK = {
    full: { n: 1019, success: 43, fail: 57, nSuccess: 440, nFail: 579 },
    hard: { n: 284,  success: 30, fail: 70, nSuccess: 86,  nFail: 198 },
    multi: { n: 440 },
    /* Paper Figure 5(b). Shares are of the 1,016 trajectories the composition
       table carries; the Ubuntu GUI-only / GUI+CLI split is an estimate. */
    platforms: [
      { key: "Ubuntu GUI-only", pct: 36, color: "#2f9fbd" },
      { key: "Ubuntu GUI+CLI",  pct: 12, color: "#1a6b83" },
      { key: "Mobile",          pct: 25, color: "#d9a53a" },
      { key: "Web",             pct: 16, color: "#4f97ee" },
      { key: "Windows",         pct: 10, color: "#6f7fa8" }
    ],
    /* Trajectory length in steps, Figure 5(c) box plots; whiskers at 1.5 IQR,
       outliers not drawn. */
    length: {
      success: { min: 1, q1: 8,  med: 14.5, q3: 25, max: 50, mean: 19.3 },
      fail:    { min: 1, q1: 18, med: 30,   q3: 50, max: 80, mean: 38.2 }
    }
  };

  /* ------------------------------------------------------------ os-shepherd
     Paper Table 3 — OS-Shepherd-100K judge-instance pool by platform.        */
  var CORPUS_PLATFORMS = [
    { key: "Web",              n: 119469, pct: 37 },
    { key: "Windows",          n: 62053,  pct: 19 },
    { key: "macOS",            n: 45028,  pct: 14 },
    { key: "Ubuntu (GUI only)",n: 34355,  pct: 11 },
    { key: "Mobile",           n: 30941,  pct: 10 },
    { key: "Ubuntu (GUI+CLI)", n: 29785,  pct: 9 }
  ];
  var CORPUS_TOTAL = 321631;

  /* ------------------------------------------------------- corpus pipeline
     Paper Figure 10 — the OS-Shepherd-100K funnel, as a Sankey.

     Two caveats the figure carries and the chart states on the page:
     (a) the unit changes after "Final trajectories": columns 1-4 count
         trajectories, column 5 counts judge instances (~4 judges per
         trajectory) and column 6 counts training samples, so the two halves
         are drawn on separate vertical scales;
     (b) the four open-source inflows are printed at the paper's rounded
         values and sum to 82.5K against a stated 82K, so the incoming bands
         are normalised to the node. The gap is 0.6% and sub-pixel.           */
  var CORPUS_FLOW = {
    /* trajectory-unit stages */
    stages: [
      { id: "raw",   label: "Raw instructions",   n: 100415, show: "~100K",
        note: "written and synthesized on our own infrastructure" },
      { id: "instr", label: "Instructions kept",  n: 88702,  show: "88.7K",
        note: "rolled out by five agent families" },
      { id: "traj",  label: "Trajectories kept",  n: 78571,  show: "78.6K",
        note: "before the quality filter" },
      { id: "final", label: "Final trajectories", n: 82000,  show: "82K",
        note: "self-collected plus open-source corpora" }
    ],
    /* what each stage loses, drawn as a band peeling off downward */
    drops: [
      { after: "raw",   label: "Instruction filter",  n: 11713, show: "−11.7K" },
      { after: "instr", label: "Bad-trajectory filter", n: 10131, show: "−10.1K" },
      { after: "traj",  label: "Quality filter",      n: 26981, show: "−27.0K" }
    ],
    /* self-collected survivors carried into "Final trajectories" */
    carried: { n: 51590, show: "51.6K", label: "Self-collected, kept" },
    /* open-source corpora merged in at the same node */
    sources: [
      { label: "OpenCUA",    n: 22534, show: "22.5K", color: "#a67ded" },
      { label: "OpenMobile", n: 5158,  show: "5.2K",  color: "#e5825f" },
      { label: "OS-Genesis", n: 2218,  show: "2.2K",  color: "#4f97ee" },
      { label: "ScaleCUA",   n: 1000,  show: "1.0K",  color: "#8fa3bd" }
    ],
    /* judgment-unit stages, drawn on their own scale */
    judged: {
      label: "Judge instances", n: 321631, show: "321,631",
      note: "~4 judges per trajectory, varied screenshot settings",
      perTraj: 3.92
    },
    agreement: { label: "Cross-model agreement filter", dropped: 12337, show: "−12.3K",
                 keptTraj: 69663, keptPct: 85 },
    /* Presented as 100K, the corpus's name (Qiushi's call, 2026-07-30). `n`
       stays the true count so the ribbon keeps its real proportion, but nothing
       renders it — the node caption and both tooltips read `show`. See
       open_items D7. */
    corpus: { label: "OS-Shepherd-100K", n: 96621, show: "100K",
              note: "reasoning-annotated training samples" }
  };

  /* Paper Table 4 — trained models against the checkpoints they start from. */
  var TRAINING = [
    { name: "Qwen3.5-9B (base)",   role: "base",  full: [76.7, 98.9, 59.9, 79.4], hard: [39.4, 97.7, 14.1, 55.9] },
    { name: "OS-Shepherd-9B",      role: "ours",  full: [86.1, 86.6, 86.0, 86.3], hard: [60.2, 66.3, 57.6, 61.9] },
    { name: "Qwen3.5-35B-A3B (base)", role: "base", full: [82.2, 92.4, 74.5, 83.5], hard: [51.1, 83.7, 36.9, 60.3] },
    { name: "OS-Shepherd-35B-A3B", role: "ours",  full: [85.6, 85.0, 86.2, 85.6], hard: [62.7, 68.6, 60.1, 64.3] }
  ];

  /* ------------------------------------------------------------------
     DataViewer examples — PLACEHOLDER CONTENT, NOT BENCHMARK DATA.

     These three records exist so the viewer can be built and styled
     before the real export is ready. Nothing here was taken from the
     benchmark: the instructions, steps and judge verdicts are invented,
     including the verdicts attributed to named models. `placeholder`
     drives a visible banner on the page — replace this array with real
     records and set it to false in the same commit, so the viewer can
     never be advertised while showing invented data.
     ------------------------------------------------------------------ */
  var VIEWER = {
    placeholder: true,
    examples: [
      {
        id: "web-0142",
        platform: "Web",
        instruction: "Find the cheapest direct flight from Newark to Lisbon in the first week of " +
          "September, then add it to the cart.",
        gold: "failure",
        goldWhy: "A direct flight is found and priced, but the run stops on the fare page — the " +
          "itinerary is never added to the cart, so the instruction is not fulfilled.",
        steps: [
          { action: "click(\"Departure airport\")",
            thought: "Set the origin first; the date pickers stay disabled until both airports are chosen." },
          { action: "type(\"Newark EWR\") → click(\"Newark Liberty Intl (EWR)\")",
            thought: "Take the airport from the autocomplete rather than the free-text city match." },
          { action: "click(\"Nonstop only\")",
            thought: "The instruction says direct, so filter before comparing fares." },
          { action: "click(\"Sort: price, lowest first\")",
            thought: "Cheapest direct is now the first row." },
          { action: "click(\"Select · $412\")",
            thought: "This is the cheapest nonstop in the requested week." },
          { action: "stop()",
            thought: "The fare is selected, so the task looks complete." }
        ],
        judges: [
          { name: "GPT-5.5", verdict: "success", correct: false },
          { name: "Claude-Opus-4-8", verdict: "failure", correct: true },
          { name: "Qwen3-VL-30B", verdict: "success", correct: false },
          { name: "OS-Shepherd-9B", verdict: "failure", correct: true }
        ]
      },
      {
        id: "ubuntu-0067",
        platform: "Ubuntu",
        instruction: "In the open spreadsheet, sort the rows by the Revenue column in descending " +
          "order and save the file in place.",
        gold: "success",
        goldWhy: "The range is selected, sorted descending on the right column, and saved to the " +
          "original path without a dialog left open.",
        steps: [
          { action: "click(cell A1) → key(\"ctrl+shift+End\")",
            thought: "Select the used range so the sort covers every row." },
          { action: "menu(\"Data\" → \"Sort…\")",
            thought: "The toolbar sort would key on the active column only." },
          { action: "select(\"Sort Key 1: Revenue\") → click(\"Descending\")",
            thought: "Revenue descending is what was asked for." },
          { action: "click(\"OK\")", thought: "Apply and close the dialog." },
          { action: "key(\"ctrl+s\") → click(\"Use ODF Format\")",
            thought: "Save in place; keep the existing format so the path does not change." }
        ],
        judges: [
          { name: "GPT-5.5", verdict: "success", correct: true },
          { name: "Claude-Opus-4-8", verdict: "success", correct: true },
          { name: "Qwen3-VL-30B", verdict: "success", correct: true },
          { name: "OS-Shepherd-9B", verdict: "success", correct: true }
        ]
      },
      {
        id: "mobile-0231",
        platform: "Mobile",
        instruction: "Turn on battery saver and set the screen timeout to 30 seconds.",
        gold: "failure",
        goldWhy: "Battery saver is enabled, but the timeout is left at 1 minute: the agent opens the " +
          "right menu and selects the wrong entry. Only the second half of the instruction fails.",
        steps: [
          { action: "swipe(down, from: status_bar)", thought: "Quick settings is the shortest route." },
          { action: "click(\"Battery Saver\")", thought: "First half of the instruction done." },
          { action: "click(\"Settings\") → click(\"Display\")",
            thought: "Screen timeout lives under Display." },
          { action: "click(\"Screen timeout\")", thought: "Open the interval list." },
          { action: "click(\"1 minute\")",
            thought: "Picking the shortest available interval." },
          { action: "click(\"Back\")", thought: "Both settings look applied." }
        ],
        judges: [
          { name: "GPT-5.5", verdict: "success", correct: false },
          { name: "Claude-Opus-4-8", verdict: "success", correct: false },
          { name: "Qwen3-VL-30B", verdict: "success", correct: false },
          { name: "OS-Shepherd-9B", verdict: "failure", correct: true }
        ]
      }
    ]
  };

  global.OSRewardData = {
    families: FAMILIES,
    judges: JUDGES,
    paretoPoints: PARETO,
    failureModes: FAILURE_MODES,
    multi: MULTI,
    hardBreakdown: HARD_BREAKDOWN,
    ablations: ABLATIONS,
    generalization: GENERALIZATION,
    benchmark: BENCHMARK,
    corpus: { platforms: CORPUS_PLATFORMS, total: CORPUS_TOTAL },
    corpusFlow: CORPUS_FLOW,
    training: TRAINING,
    viewer: VIEWER,
    logoPath: "public/logos/",
    /* convenience lookup */
    byName: JUDGES.reduce(function (m, j) { m[j.name] = j; return m; }, {})
  };
})(window);
