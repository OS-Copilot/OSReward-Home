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

  /* Eight paper case studies. Each thumbnail is paired with the untouched
     source screenshot so the viewer can open the state at full resolution. */
  var VIEWER = {
    placeholder: false,
    examples: [
      {
        id: "290315ee-b986-5afc-b9b9-7f0774cee4c2",
        traceId: "dc2a1004-c6ee-5c2c-acb7-b1f5716c18ae",
        platform: "Web",
        caseType: "False success",
        instruction: "Help me find some recently popular documentaries with ratings above 8, and " +
          "summarize the main reasons why viewers recommend them.",
        reasonLabel: "Miss reason",
        reason: "On 2026-03-15, the agent presents a visibly 2017 documentary as “recently popular” " +
          "without evidence of renewed popularity.",
        gold: "failure",
        goldWhy: "The visible 2017 release date contradicts the requested recency criterion.",
        agentAccount: "Listed a 2024 title and the visibly 2017 Return to the Wolves as “recently " +
          "popular,” with ratings and recommendation reasons.",
        steps: [
          { number: 11, focus: false, caption: "Older titles rejected",
            thumb: "public/cases/documentary_recency_failure/step_11.webp",
            shot: "public/cases/documentary_recency_failure/full_step_11.png" },
          { number: 22, caption: "A valid recent result",
            thumb: "public/cases/documentary_recency_failure/step_22.webp",
            shot: "public/cases/documentary_recency_failure/full_step_22.png" },
          { number: 26, caption: "Old title selected",
            thumb: "public/cases/documentary_recency_failure/step_26.webp",
            shot: "public/cases/documentary_recency_failure/full_step_26.png" },
          { number: 27, caption: "2017 title treated as recent",
            thumb: "public/cases/documentary_recency_failure/step_27.webp",
            shot: "public/cases/documentary_recency_failure/full_step_27.png" }
        ],
        judges: [
          { name: "GPT-5.5", verdict: "success", correct: false,
            reason: "Accepted the ratings and summaries without checking recency." },
          { name: "Gemini-3.5-Flash", verdict: "success", correct: false,
            reason: "Treated both titles as recent despite the visible 2017 date." }
        ]
      },
      {
        id: "example_task_060",
        traceId: "25cc896a-a4dc-46ad-a5eb-2d36f3bf0de7",
        platform: "Windows",
        caseType: "False success",
        instruction: "Open GitHub Desktop. Use the 'Repository' menu at the top to select 'Open in " +
          "Command Prompt' (or Terminal). Once the external terminal window appears, type git status " +
          "to verify the working directory.",
        reasonLabel: "Miss reason",
        reason: "The agent mistakes a new terminal prompt for proof that git status ran, despite the " +
          "absence of both the command and any Git output.",
        gold: "failure",
        goldWhy: "Neither the required command nor its expected output ever appears on screen.",
        agentAccount: "Declared that git status had executed because the terminal returned to a prompt.",
        steps: [
          { number: 0, focus: false, caption: "GitHub Desktop is open",
            thumb: "public/cases/git_status_false_success/step_0.webp",
            shot: "public/cases/git_status_false_success/full_step_0.png" },
          { number: 7, caption: "Command Prompt option found",
            thumb: "public/cases/git_status_false_success/step_7.webp",
            shot: "public/cases/git_status_false_success/full_step_7.png" },
          { number: 8, caption: "Terminal opened in repository",
            thumb: "public/cases/git_status_false_success/step_8.webp",
            shot: "public/cases/git_status_false_success/full_step_8.png" },
          { number: 10, caption: "Typed command is not visible",
            thumb: "public/cases/git_status_false_success/step_10.webp",
            shot: "public/cases/git_status_false_success/full_step_10.png" },
          { number: 11, caption: "Enter yields no Git output",
            thumb: "public/cases/git_status_false_success/step_11.webp",
            shot: "public/cases/git_status_false_success/full_step_11.png" }
        ],
        judges: [
          { name: "Gemini-3-Flash", verdict: "success", correct: false,
            reason: "Trusted the action history and correct repository prompt." },
          { name: "Claude-Sonnet-4.6", verdict: "success", correct: false,
            reason: "Treated two prompts as proof despite no command or Git output." }
        ]
      },
      {
        id: "task_321",
        traceId: "37b29158-fde9-4e99-a382-1bec564db773",
        platform: "Windows",
        caseType: "Perception failure",
        instruction: "Navigate to \"finance.yahoo.com\" using the address bar, search for \"NVDA\" to find " +
          "Nvidia Corporation's stock data, and locate the current \"Beta\" value.",
        reasonLabel: "Miss reason",
        reason: "The agent reports Beta (3Y Monthly) = 1.38 even though the screen shows Beta " +
          "(5Y Monthly) = 2.38.",
        gold: "failure",
        goldWhy: "The reported time window and value both disagree with the visible Statistics table.",
        agentAccount: "Reported “Beta (3Y Monthly) = 1.38” and declared the task complete.",
        steps: [
          { number: 0, focus: false, caption: "Browser starting state",
            thumb: "public/cases/nvda_beta_perception_failure/step_0.webp",
            shot: "public/cases/nvda_beta_perception_failure/full_step_0.png" },
          { number: 7, caption: "NVDA result identified",
            thumb: "public/cases/nvda_beta_perception_failure/step_7.webp",
            shot: "public/cases/nvda_beta_perception_failure/full_step_7.png" },
          { number: 32, caption: "Statistics page reached",
            thumb: "public/cases/nvda_beta_perception_failure/step_32.webp",
            shot: "public/cases/nvda_beta_perception_failure/full_step_32.png" },
          { number: 35, caption: "Valuation tables inspected",
            thumb: "public/cases/nvda_beta_perception_failure/step_35.webp",
            shot: "public/cases/nvda_beta_perception_failure/full_step_35.png" },
          { number: 36, caption: "Beta value visually misread",
            thumb: "public/cases/nvda_beta_perception_failure/step_36.webp",
            shot: "public/cases/nvda_beta_perception_failure/full_step_36.png" }
        ],
        judges: [
          { name: "Gemini-3.5-Flash", verdict: "success", correct: false,
            reason: "Credited the Statistics page while noting that it shows 2.38." },
          { name: "Qwen3.5-397B", verdict: "success", correct: false,
            reason: "Explained the mismatch as a timing or calculation-window difference." }
        ]
      },
      {
        id: "1a1f2d7b-b2a7-50cb-8f16-3bdae408818c",
        traceId: "1a1f2d7b-b2a7-50cb-8f16-3bdae408818c",
        platform: "Web",
        caseType: "UI-state perception failure",
        instruction: "What are the available color and size options for the 'Tabelo Waterproof " +
          "1200D T/O Blanket' on Horse.com?",
        reasonLabel: "Miss reason",
        reason: "The agent reads the option labels but ignores their strikethrough styling, " +
          "turning disabled color and size variants into available choices.",
        gold: "failure",
        goldWhy: "Only Hunter and size 75 are visibly enabled; every other listed variant is struck through.",
        agentAccount: "Reported Blue, Hunter, Purple, and Red as available colors and 69, 72, 75, " +
          "78, 81, and 84 as available sizes.",
        judgeFieldSummary: "Full judge field: 23/23 SUCCESS",
        steps: [
          { number: 0, focus: false, caption: "Horse.com starting state",
            thumb: "public/cases/horse_product_ui_state_failure/step_0.webp",
            shot: "public/cases/horse_product_ui_state_failure/full_step_0.jpg" },
          { number: 1, caption: "Product options become visible",
            thumb: "public/cases/horse_product_ui_state_failure/step_1.webp",
            shot: "public/cases/horse_product_ui_state_failure/full_step_1.jpg" },
          { number: 4, caption: "Disabled variants reported as available",
            thumb: "public/cases/horse_product_ui_state_failure/step_4.webp",
            shot: "public/cases/horse_product_ui_state_failure/full_step_4.jpg" }
        ],
        judges: []
      },
      {
        id: "37c7fcf5-d656-40ca-842d-8bb09f0d6a06",
        traceId: "37c7fcf5-d656-40ca-842d-8bb09f0d6a06_20260405@033709",
        platform: "Ubuntu",
        caseType: "Planning failure",
        instruction: "In Krita, use the Crop Tool to remove the excess white space around the drawn " +
          "question mark, then export the cropped image as `~/Desktop/reference.jpg`. Next, open " +
          "LibreCAD, insert `~/Desktop/reference.jpg` into a new drawing area, and save the LibreCAD " +
          "document as `~/Desktop/draft.dxf`.",
        reasonLabel: "Miss reason",
        reason: "The agent saves a DXF without verifying insertion; the final drawing shows a blank " +
          "raster instead of the cropped question mark.",
        gold: "failure",
        goldWhy: "The saved drawing does not visibly contain the required question-mark image.",
        agentAccount: "Declared that reference.jpg had been inserted into LibreCAD and that draft.dxf " +
          "was saved correctly.",
        steps: [
          { number: 6, focus: false, caption: "Krita crop and export succeed",
            thumb: "public/cases/librecad_empty_drawing_planning_failure/step_6.webp",
            shot: "public/cases/librecad_empty_drawing_planning_failure/full_step_6.png" },
          { number: 30, caption: "Open Image finally reached",
            thumb: "public/cases/librecad_empty_drawing_planning_failure/step_30.webp",
            shot: "public/cases/librecad_empty_drawing_planning_failure/full_step_30.png" },
          { number: 32, caption: "Placed image renders blank",
            thumb: "public/cases/librecad_empty_drawing_planning_failure/step_32.webp",
            shot: "public/cases/librecad_empty_drawing_planning_failure/full_step_32.png" },
          { number: 44, caption: "Save succeeds; content remains wrong",
            thumb: "public/cases/librecad_empty_drawing_planning_failure/step_44.webp",
            shot: "public/cases/librecad_empty_drawing_planning_failure/full_step_44.png" }
        ],
        judges: [
          { name: "Gemini-3-Flash", verdict: "success", correct: false,
            reason: "Trusted the save path and assumed insertion despite the blank raster and prior error." },
          { name: "Claude-Sonnet-4.6", verdict: "success", correct: false,
            reason: "Treated saving as completion without checking that the question mark was visible." }
        ]
      },
      {
        id: "3c91a543-78eb-47c2-b4c5-b226fa4fe04b",
        traceId: "3c91a543-78eb-47c2-b4c5-b226fa4fe04b_20260324@133025",
        platform: "Ubuntu",
        caseType: "Long-horizon hard case",
        instruction: "I wanna figure out the default model configuration of OS-Symphony, which is a " +
          "multi-agents framework. Open the '~/Desktop/test_files/python_projects/OS-Symphony' folder " +
          "and find the running script of docker. Open it, read the script to find the default model " +
          "name of each agent. Then, open LibreOffice Calc, create a table " +
          "\"OS-Symphony-Default-Settings.xlsx\". Write the agent's name on column A (e.g. " +
          "Orchestrator) and model's name (e.g. gpt or gemini) on column B.",
        reasonLabel: "Why it is hard",
        reason: "Across 53 steps, the agent recovers the project path, extracts five model defaults, " +
          "builds the spreadsheet, and repairs save errors.",
        gold: "success",
        goldWhy: "The final workbook visibly contains the requested agent–model pairs and is saved under the requested name.",
        agentAccount: "Concluded that it had located the Docker script, extracted the default models, " +
          "and generated the requested spreadsheet.",
        steps: [
          { number: 0, focus: false, caption: "Terminal opened for project search",
            thumb: "public/cases/os_symphony_hard_case/step_0.webp",
            shot: "public/cases/os_symphony_hard_case/full_step_0.png" },
          { number: 8, caption: "OS-Symphony file tree enumerated",
            thumb: "public/cases/os_symphony_hard_case/step_8.webp",
            shot: "public/cases/os_symphony_hard_case/full_step_8.png" },
          { number: 33, caption: "Five agent-model pairs entered",
            thumb: "public/cases/os_symphony_hard_case/step_33.webp",
            shot: "public/cases/os_symphony_hard_case/full_step_33.png" },
          { number: 49, caption: "Workbook named in Save As",
            thumb: "public/cases/os_symphony_hard_case/step_49.webp",
            shot: "public/cases/os_symphony_hard_case/full_step_49.png" },
          { number: 52, caption: "Saved workbook verified",
            thumb: "public/cases/os_symphony_hard_case/step_52.webp",
            shot: "public/cases/os_symphony_hard_case/full_step_52.png" }
        ],
        judges: [
          { name: "Gemini-3.1-Pro", verdict: "success", correct: true,
            reason: "Cited script extraction, the populated Calc table, and saved workbook." },
          { name: "Qwen3-VL-8B", verdict: "success", correct: true,
            reason: "Confirmed the visible agent–model pairs and final file." }
        ]
      },
      {
        id: "GoogleMapHospitalAndGasRoute_taskinfo",
        traceId: "GoogleMapHospitalAndGasRoute_0",
        platform: "Mobile",
        caseType: "Compositional hard case",
        instruction: "I want to go to the nearest hospital and fill my gas tank along the road. " +
          "Provide me a best route for driving my own car.",
        reasonLabel: "Why it is hard",
        reason: "The judge must distinguish a closer closed clinic from the nearest open ER while " +
          "also verifying that the final route includes fuel.",
        gold: "success",
        goldWhy: "The route selects an open emergency room, includes Chevron, and uses driving mode.",
        agentAccount: "Reported a route to the selected open hospital with Chevron added en route, " +
          "then started navigation.",
        steps: [
          { number: 0, focus: false, caption: "Mobile starting state",
            thumb: "public/cases/google_maps_open_hospital_hard_case/step_0.webp",
            shot: "public/cases/google_maps_open_hospital_hard_case/full_step_0.png" },
          { number: 7, caption: "Nearest open hospital selected",
            thumb: "public/cases/google_maps_open_hospital_hard_case/step_7.webp",
            shot: "public/cases/google_maps_open_hospital_hard_case/full_step_7.png" },
          { number: 11, caption: "Open gas stop selected",
            thumb: "public/cases/google_maps_open_hospital_hard_case/step_11.webp",
            shot: "public/cases/google_maps_open_hospital_hard_case/full_step_11.png" },
          { number: 12, caption: "Complete driving route composed",
            thumb: "public/cases/google_maps_open_hospital_hard_case/step_12.webp",
            shot: "public/cases/google_maps_open_hospital_hard_case/full_step_12.png" }
        ],
        judges: [
          { name: "Gemini-3.1-Pro", verdict: "success", correct: true,
            reason: "Credited the open hospital, gas stop, driving mode, and navigation." },
          { name: "Qwen3-VL-8B", verdict: "success", correct: true,
            reason: "Used the active route to confirm that both stops were included." }
        ]
      },
      {
        id: "73243cf3-bed7-48fc-8cdd-c6542a90466b",
        traceId: "73243cf3-bed7-48fc-8cdd-c6542a90466b_20260405@194959",
        platform: "Ubuntu",
        caseType: "Long-horizon hard success",
        instruction: "Create a text file at `~/Desktop/stream_info.txt` and write the text 'Be right " +
          "back' into it. In OBS Studio, add a Text (FreeType 2) source named 'StatusText' that reads " +
          "its text directly from this newly created file. Then, open the OBS Settings, navigate to " +
          "the Video tab, and change the Base (Canvas) Resolution to 1280x720 and the Output (Scaled) " +
          "Resolution to 854x480. Apply the changes. (You do not need to start recording).",
        reasonLabel: "Why it is hard",
        reason: "The judge must integrate file creation, a file-backed OBS text source, and a late " +
          "custom-resolution correction after a long recovery-heavy sequence.",
        gold: "success",
        goldWhy: "The text is visibly read from stream_info.txt, and the final resolution action " +
          "enters the exact 854x480 value and submits it with Enter.",
        agentAccount: "Created stream_info.txt, linked it to StatusText, set the 1280x720 canvas, " +
          "and closed Video settings after entering 854x480.",
        judgeFieldSummary: "Full judge field: 13/23 FAIL",
        steps: [
          { number: 0, focus: false, caption: "Desktop and OBS starting state",
            thumb: "public/cases/obs_resolution_long_horizon_hard_case/step_0.webp",
            shot: "public/cases/obs_resolution_long_horizon_hard_case/full_step_0.png" },
          { number: 35, caption: "File-backed text visibly rendered",
            thumb: "public/cases/obs_resolution_long_horizon_hard_case/step_35.webp",
            shot: "public/cases/obs_resolution_long_horizon_hard_case/full_step_35.png" },
          { number: 41, caption: "Preset list lacks the exact output size",
            thumb: "public/cases/obs_resolution_long_horizon_hard_case/step_41.webp",
            shot: "public/cases/obs_resolution_long_horizon_hard_case/full_step_41.png" },
          { number: 42, caption: "Exact 854x480 value entered",
            thumb: "public/cases/obs_resolution_long_horizon_hard_case/step_42.webp",
            shot: "public/cases/obs_resolution_long_horizon_hard_case/full_step_42.png" },
          { number: 43, caption: "Enter closes and commits the dialog",
            thumb: "public/cases/obs_resolution_long_horizon_hard_case/step_43.webp",
            shot: "public/cases/obs_resolution_long_horizon_hard_case/full_step_43.png" }
        ],
        judges: []
      },
      {
        id: "41a372e2-b5cd-474b-8031-81bdfef2a3f4",
        traceId: "41a372e2-b5cd-474b-8031-81bdfef2a3f4_20260405@034215",
        platform: "Ubuntu",
        caseType: "Temporal visual-comparison hard case",
        instruction: "Flip the current image horizontally using Krita's 'Image' menu " +
          "(Mirror Image Horizontally). Then, export the modified image as a PNG file " +
          "named `flipped.png` in the `~/Desktop/` directory.",
        reasonLabel: "Why it is hard",
        reason: "The judge must align an asymmetric shape across adjacent states; 16 of " +
          "23 model judges incorrectly describe the visibly mirrored result as unchanged.",
        gold: "success",
        goldWhy: "The short and long strokes exchange sides immediately after the mirror " +
          "command, and the export workflow reaches Krita's PNG options.",
        agentAccount: "Applied Mirror Image Horizontally, exported the transformed image " +
          "as flipped.png, and returned to the mirrored canvas.",
        judgeFieldSummary: "Full judge field: 16/23 FAIL",
        steps: [
          { number: 0, focus: false, caption: "Original asymmetric orientation",
            thumb: "public/cases/krita_horizontal_mirror_hard_case/step_0.webp",
            shot: "public/cases/krita_horizontal_mirror_hard_case/full_step_0.png" },
          { number: 1, caption: "Horizontal mirror command exposed",
            thumb: "public/cases/krita_horizontal_mirror_hard_case/step_1.webp",
            shot: "public/cases/krita_horizontal_mirror_hard_case/full_step_1.png" },
          { number: 2, caption: "Mirrored orientation is visibly different",
            thumb: "public/cases/krita_horizontal_mirror_hard_case/step_2.webp",
            shot: "public/cases/krita_horizontal_mirror_hard_case/full_step_2.png" },
          { number: 5, caption: "PNG export options reached",
            thumb: "public/cases/krita_horizontal_mirror_hard_case/step_5.webp",
            shot: "public/cases/krita_horizontal_mirror_hard_case/full_step_5.png" },
          { number: 6, caption: "Mirrored canvas remains after export",
            thumb: "public/cases/krita_horizontal_mirror_hard_case/step_6.webp",
            shot: "public/cases/krita_horizontal_mirror_hard_case/full_step_6.png" }
        ],
        judges: []
      },
      {
        id: "041259e7-7396-4ffc-a7af-00cb3d00b209",
        traceId: "041259e7-7396-4ffc-a7af-00cb3d00b209_20260403@232242",
        platform: "Ubuntu",
        caseType: "Semantic outcome failure",
        instruction: "In the open spreadsheet, rename the current sheet from 'Sheet1' to " +
          "'Storm_Data'. Then, add a new sheet and name it 'Summary'. In the 'Summary' sheet, " +
          "type 'Total Known Deaths' in cell A1. In cell B1 of the 'Summary' sheet, insert a " +
          "formula that calculates the sum of all numeric values in the 'deaths' column " +
          "(Column E) from the 'Storm_Data' sheet. Save your changes to the file.",
        reasonLabel: "Why judges miss it",
        reason: "The formula and save action look conclusive, but judging requires reconnecting " +
          "the final zero to the earlier non-zero source data and recognizing that SUM ignored " +
          "text-formatted numbers.",
        gold: "failure",
        goldWhy: "The visible death values total 3669, yet B1 evaluates to 0 and the agent saves " +
          "without validating the contradiction.",
        agentAccount: "Renamed the source sheet, created Summary, entered " +
          "=SUM(Storm_Data.E:E), saved the workbook, and finished with B1 showing 0.",
        judgeFieldSummary: "Full judge field: 19/23 SUCCESS",
        steps: [
          { number: 0, focus: false, caption: "Non-zero death counts are visible",
            thumb: "public/cases/calc_zero_sum_false_success/step_0.webp",
            shot: "public/cases/calc_zero_sum_false_success/full_step_0.png" },
          { number: 3, caption: "Source sheet renamed Storm_Data",
            thumb: "public/cases/calc_zero_sum_false_success/step_3.webp",
            shot: "public/cases/calc_zero_sum_false_success/full_step_3.png" },
          { number: 7, caption: "Summary sheet created",
            thumb: "public/cases/calc_zero_sum_false_success/step_7.webp",
            shot: "public/cases/calc_zero_sum_false_success/full_step_7.png" },
          { number: 20, caption: "Summary label finally entered",
            thumb: "public/cases/calc_zero_sum_false_success/step_20.webp",
            shot: "public/cases/calc_zero_sum_false_success/full_step_20.png" },
          { number: 22, caption: "SUM formula entered for column E",
            thumb: "public/cases/calc_zero_sum_false_success/step_22.webp",
            shot: "public/cases/calc_zero_sum_false_success/full_step_22.png" },
          { number: 23, caption: "Formula evaluates to zero",
            thumb: "public/cases/calc_zero_sum_false_success/step_23.webp",
            shot: "public/cases/calc_zero_sum_false_success/full_step_23.png" },
          { number: 24, caption: "Agent finishes without checking the result",
            thumb: "public/cases/calc_zero_sum_false_success/step_24.webp",
            shot: "public/cases/calc_zero_sum_false_success/full_step_24.png" }
        ],
        judges: []
      }
    ]
  };

  /* The build script keeps the editorial case metadata above readable while
     attaching authentic actions, thoughts and high-resolution source frames
     exported from the original trajectories. */
  if (global.OSRewardCaseSteps) {
    VIEWER.examples.forEach(function (example) {
      if (global.OSRewardCaseSteps[example.id]) {
        example.steps = global.OSRewardCaseSteps[example.id];
      }
      if (global.OSRewardJudgeResponses && global.OSRewardJudgeResponses[example.id]) {
        example.judges = global.OSRewardJudgeResponses[example.id];
      }
    });
  }

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
