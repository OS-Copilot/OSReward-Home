/* ==========================================================================
   OSReward — case player
   An interactive trajectory player for the paper's case studies.

   Reading flow, the same one a judge goes through:
     1. Blind replay. Instruction, screenshots, the agent's actions and its
        reasoning — no editorial captions, no case type, no highlights.
     2. Your call. The reader votes SUCCESS or FAILURE.
     3. Annotated replay. The human verdict, the judges' votes and their raw
        responses appear, and the timeline lights up the evidence states so
        the reader can go back and see what was missed.

   Actions are parsed from the raw tool calls of each agent family and drawn
   on top of the screenshot (cursor travel, click ripple, target box, typed
   text, key chords, swipes, scrolls, finish banner).

   Mounts into #viewer-body. Exposes window.OSRewardPlayer.open(id, step).
   ========================================================================== */
(function () {
  "use strict";

  var D = window.OSRewardData;
  var host = document.getElementById("viewer-body");
  if (!host || !D || !D.viewer || !D.viewer.examples || !D.viewer.examples.length) return;

  var EX = D.viewer.examples;
  var REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var FINE = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);
  var STORE_KEY = "osreward-player-votes-v1";
  var BASE_DWELL = 3200;
  var SPEEDS = [0.5, 1, 2];

  /* Agent that produced each trajectory, looked up in the corpus manifest
     (static/js/osreward-corpus.js, built from data/full) by traceId. */
  var AGENTS = {};
  var CORPUS = window.OSRewardCorpus;
  if (CORPUS && CORPUS.rows) {
    CORPUS.rows.forEach(function (r) { AGENTS[r[0]] = CORPUS.agents[r[2]]; });
  }

  var MODEL_NAMES = {
    "gpt-5.5": "GPT-5.5", "gpt-5.4": "GPT-5.4", "gpt-5.4-mini": "GPT-5.4-mini", "gpt-5-mini": "GPT-5-mini",
    "gemini-3-flash": "Gemini-3-Flash", "gemini-3-flash-preview": "Gemini-3-Flash",
    "gemini-3.5-flash": "Gemini-3.5-Flash", "gemini-3.1-pro-preview": "Gemini-3.1-Pro",
    "claude-opus-4-6": "Claude-Opus-4.6", "claude-sonnet-4-6": "Claude-Sonnet-4.6",
    "claude-haiku-4-5": "Claude-Haiku-4.5", "claude-haiku-4-5-20251001": "Claude-Haiku-4.5",
    "qwen3.5-397b": "Qwen3.5-397B", "qwen3.5-397b-a17b": "Qwen3.5-397B-A17B",
    "qwen3-vl-8b-instruct": "Qwen3-VL-8B"
  };
  var FAMILY_LOGO = [
    [/^gpt/i, "GPT.png"], [/^gemini/i, "Gemini.png"], [/^claude/i, "Claude.png"],
    [/^qwen/i, "Qwen.png"], [/^kimi/i, "Kimi.png"], [/shepherd/i, "OS-Shepherd.png"]
  ];

  function modelName(n) {
    var raw = String(n || "Unknown model");
    return MODEL_NAMES[raw.toLowerCase()] || raw;
  }
  function modelLogo(n) {
    for (var i = 0; i < FAMILY_LOGO.length; i++) {
      if (FAMILY_LOGO[i][0].test(n)) return (D.logoPath || "public/logos/") + FAMILY_LOGO[i][1];
    }
    return null;
  }

  /* ------------------------------------------------------------- helpers */
  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function btn(cls, parent, text, label) {
    var b = h("button", cls, parent, text);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    return b;
  }
  function icon(name) {
    var P = {
      first: "M4 3v10M13 3 6.5 8 13 13Z",
      prev: "M11 3 5 8l6 5",
      next: "M5 3l6 5-6 5",
      last: "M12 3v10M3 3l6.5 5L3 13Z",
      play: "M5 3.2v9.6L13 8Z",
      pause: "M5 3v10M11 3v10",
      zoom: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM10.6 10.6 14 14M5 7h4M7 5v4",
      full: "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4",
      link: "M6.5 9.5 9.5 6.5M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1",
      spark: "M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6Z",
      shuffle: "M2 4h2.5c3 0 4 8 7 8H14M2 12h2.5c1.2 0 2-1.3 2.7-3M10 6.2c.5-1.2 1.2-2.2 1.5-2.2H14M12 2l2 2-2 2M12 10l2 2-2 2"
    };
    var svg = s("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": "1.6",
      "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
    s("path", { d: P[name] }, svg);
    if (name === "play" || name === "first" || name === "last" || name === "spark") svg.querySelector("path").setAttribute("fill", "currentColor");
    return svg;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function verdictWord(v) { return v === "success" ? "SUCCESS" : "FAILURE"; }

  function loadVotes() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveVotes() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(votes)); } catch (e) { /* private mode */ }
  }

  /* ------------------------------------------------------ action parsing */
  var NAME_KIND = {
    click: "click", click_at: "click", left_click: "click", single_click: "click", tap: "click",
    double_click: "dclick", doubleclick: "dclick", triple_click: "dclick", tripleclick: "dclick",
    right_click: "rclick", rightclick: "rclick",
    hover: "hover", hover_at: "hover", mouse_move: "hover", moveto: "hover",
    type: "type", type_text_at: "type", write: "type", typewrite: "type", fill: "type", input: "type",
    key_combination: "key", key: "key", press: "key", hotkey: "key", system_button: "key", "delete": "key",
    scroll: "scroll", scroll_at: "scroll", scroll_document: "scroll",
    swipe: "swipe", drag_and_drop: "drag", drag: "drag", dragto: "drag", long_press: "drag",
    "goto": "nav", navigate: "nav", open: "nav", open_app: "nav", go_back: "nav", back: "nav",
    wait: "wait", wait_5_seconds: "wait", sleep: "wait",
    done: "done", stop: "done", terminate: "done", answer: "done", finish: "done", fail: "done"
  };

  /* Coordinates arrive as fractions (0–1), as the 0–999 grid most VLM agents
     use, or as raw pixels; box2d is [ymin, xmin, ymax, xmax] on the 0–1000 grid. */
  function norm(x, y, dims) {
    x = +x; y = +y;
    if (!isFinite(x) || !isFinite(y)) return null;
    if (x <= 1 && y <= 1) return { x: x, y: y };
    if (x <= 1000 && y <= 1000) return { x: x / 1000, y: y / 1000 };
    var w = dims && dims.w || (x > 1920 || y > 1080 ? 2560 : 1920);
    var hh = dims && dims.h || (x > 1920 || y > 1080 ? 1440 : 1080);
    return { x: clamp(x / w, 0, 1), y: clamp(y / hh, 0, 1) };
  }

  function parseAction(raw) {
    var r = String(raw || "").trim();
    var a = { kind: "other", name: "", pt: null, pt2: null, box: null, text: "", keys: "", dir: "",
      amount: null, answer: "", url: "", enter: false };
    if (!r) { a.kind = "none"; return a; }

    if (/^(DONE|done)$/.test(r) || /^#\s*Task completed/i.test(r)) {
      a.kind = "done";
      a.answer = r.replace(/^#\s*/gm, "").replace(/^Task completed successfully\s*-?\s*/i, "").replace(/^DONE$/i, "").trim();
      return a;
    }
    if (/^FAIL$/i.test(r)) { a.kind = "done"; a.answer = "Agent gave up"; return a; }
    if (/^WAIT$/i.test(r)) { a.kind = "wait"; return a; }

    var start = r.indexOf("{"), end = r.lastIndexOf("}"), j = null;
    if (start >= 0 && end > start && !/^(computer\.|pyautogui|import|#)/.test(r)) {
      var body = r.slice(start, end + 1);
      if (body.indexOf("};{") >= 0) body = body.split("};{")[0] + "}";
      try { j = JSON.parse(body); } catch (e) { j = null; }
    }
    if (j && typeof j === "object") {
      var name = j.action_key || j.name || j.action || "";
      var kw = j.action_kwargs || j.arguments || j.parameters || {};
      if ((name === "mobile_use" || name === "computer_use" || name === "computer") && kw.action) name = kw.action;
      name = String(name).toLowerCase();
      a.name = name;
      a.kind = NAME_KIND[name] || "other";
      if (kw.box2d && kw.box2d.length === 4) {
        var b = kw.box2d;
        a.box = { x0: b[1] / 1000, y0: b[0] / 1000, x1: b[3] / 1000, y1: b[2] / 1000 };
        a.pt = { x: (a.box.x0 + a.box.x1) / 2, y: (a.box.y0 + a.box.y1) / 2 };
      } else if (kw.coordinate && kw.coordinate.length >= 2) {
        a.pt = norm(kw.coordinate[0], kw.coordinate[1]);
      } else if (kw.x != null && kw.y != null) {
        a.pt = norm(kw.x, kw.y);
      }
      if (kw.coordinate2 && kw.coordinate2.length >= 2) a.pt2 = norm(kw.coordinate2[0], kw.coordinate2[1]);
      else if (kw.destination_x != null) a.pt2 = norm(kw.destination_x, kw.destination_y);
      a.text = String(kw.text != null ? kw.text : kw.content || "");
      var keys = kw.keys || kw.key || kw.button || "";
      a.keys = Array.isArray(keys) ? keys.join("+") : String(keys);
      a.dir = String(kw.direction || kw.dir || "");
      a.amount = kw.magnitude || kw.steps || kw.amount || kw.count || null;
      a.url = String(kw.url || "");
      a.enter = !!kw.press_enter;
      if (a.kind === "done") a.answer = String(kw.answer || kw.status || kw.text || "");
      if (name === "wait_5_seconds") a.amount = 5;
      if (a.kind === "type" && /\n+$/.test(a.text)) { a.enter = true; a.text = a.text.replace(/\n+$/, ""); }
      return a;
    }

    /* Python-style tool calls: computer.mouse.*, computer.keyboard.*, pyautogui.* */
    var m = r.match(/move_abs\(\s*x\s*=\s*([\d.]+)\s*,\s*y\s*=\s*([\d.]+)/);
    if (m) a.pt = norm(m[1], m[2]);
    m = r.match(/pyautogui\.\w+\(\s*(?:x\s*=\s*)?([\d.]+)\s*,\s*(?:y\s*=\s*)?([\d.]+)/);
    if (m && !a.pt) a.pt = norm(m[1], m[2]);
    var ops = [], re = /(?:computer(?:\.\w+)?|pyautogui)\.(\w+)\s*\(([^)]*)\)/g, mm;
    while ((mm = re.exec(r))) ops.push({ op: mm[1].toLowerCase(), args: mm[2] });
    var main = ops.filter(function (o) { return o.op !== "move_abs" && o.op !== "moveto" && o.op !== "sleep"; }).pop() ||
      ops[ops.length - 1];
    if (main) {
      a.name = main.op;
      a.kind = NAME_KIND[main.op] || (main.op === "move_abs" ? "hover" : "other");
      var str = main.args.match(/"""([\s\S]*?)"""|'''([\s\S]*?)'''|"([^"]*)"|'([^']*)'/);
      var val = str ? (str[1] || str[2] || str[3] || str[4] || "") : "";
      if (a.kind === "type") a.text = val;
      if (a.kind === "key") a.keys = val || main.args.replace(/['"\s]/g, "");
      var dir = main.args.match(/dir\s*=\s*["'](\w+)/);
      if (dir) a.dir = dir[1];
      var st = main.args.match(/steps\s*=\s*(\d+)/);
      if (st) a.amount = +st[1];
      if (a.kind === "scroll" && !a.dir) {
        var amt = main.args.match(/-?\d+/);
        if (amt) a.dir = +amt[0] < 0 ? "down" : "up";
      }
      if (a.kind === "done") a.answer = (main.args.match(/answer\s*=\s*['"]{1,3}([\s\S]*?)['"]{1,3}\s*$/) || [])[1] || "";
      return a;
    }
    if (/^(import |#!|export |from )/.test(r) || r.indexOf("\n") >= 0) { a.kind = "code"; a.text = r; }
    return a;
  }

  function swipeDir(a) {
    if (!a.pt || !a.pt2) return a.dir || "";
    var dx = a.pt2.x - a.pt.x, dy = a.pt2.y - a.pt.y;
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "up" : "down";
    return dx < 0 ? "left" : "right";
  }

  function short(t, n) {
    t = String(t || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  var KIND_META = {
    click: ["Click", "c"], dclick: ["Double-click", "d"], rclick: ["Right-click", "c"], hover: ["Hover", "h"],
    type: ["Type", "t"], key: ["Press", "k"], scroll: ["Scroll", "s"], swipe: ["Swipe", "w"], drag: ["Drag", "g"],
    nav: ["Navigate", "n"], wait: ["Wait", "p"], done: ["Finish", "e"], code: ["Run code", "x"],
    other: ["Action", "o"], none: ["No action", "o"]
  };

  function actionSummary(a) {
    var label = KIND_META[a.kind] ? KIND_META[a.kind][0] : "Action";
    var detail = "";
    switch (a.kind) {
      case "type": detail = "“" + short(a.text, 60) + "”" + (a.enter ? " ⏎" : ""); break;
      case "key": detail = a.keys; break;
      case "scroll": detail = (a.dir || "") + (a.amount ? " ×" + a.amount : ""); break;
      case "swipe": detail = swipeDir(a); break;
      case "nav": detail = a.url || (a.name === "go_back" ? "back" : ""); break;
      case "wait": detail = a.amount ? a.amount + " s" : ""; break;
      case "done": detail = short(a.answer, 80); break;
      case "other": detail = a.name; break;
    }
    if (a.pt && (a.kind === "click" || a.kind === "dclick" || a.kind === "rclick" || a.kind === "hover")) {
      detail = "at " + Math.round(a.pt.x * 100) + "%, " + Math.round(a.pt.y * 100) + "%";
    }
    return { label: label, detail: detail, code: KIND_META[a.kind] ? KIND_META[a.kind][1] : "o" };
  }

  /* --------------------------------------------------------------- state */
  var votes = loadVotes();
  var state = { ci: 0, si: 0, playing: false, speed: 1, lens: false, filter: "all", set: "all" };
  var timer = null, typeRaf = null, overlayTimers = [], started = false, visible = false;
  var cursorPt = { x: 0.5, y: 0.5 };

  EX.forEach(function (e) {
    e._steps = (e.steps || []).map(function (st) {
      var a = parseAction(st.actionRaw || st.action);
      return { raw: st, act: a, sum: actionSummary(a) };
    });
    e._total = e.stateMeta && e.stateMeta.totalStates ||
      (e.steps.length ? e.steps[e.steps.length - 1].number + 1 : 0);
    e._portrait = e.platform === "Mobile";
    e._agent = AGENTS[e.traceId] || null;
  });

  function revealed(e) { return !!votes[e.id]; }

  /* ---------------------------------------------------------------- DOM */
  host.textContent = "";
  var root = h("div", "px", host);
  root.tabIndex = -1;

  /* Case rail ------------------------------------------------------------ */
  var rail = h("div", "px-rail", root);
  var railTop = h("div", "px-rail-top", rail);
  var filters = h("div", "px-filters", railTop);
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Filter cases");
  /* two filters in one row: which set (paper case studies or the extra hard
     picks) and which platform */
  var nHard = EX.filter(function (e) { return e.set === "hard"; }).length;
  var setChips = [["all", "All " + EX.length]];
  if (nHard) setChips.push(["paper", "Paper cases " + (EX.length - nHard)], ["hard", "Hard picks " + nHard]);
  var filterBtns = setChips.map(function (o) {
    var b = btn("px-chip px-chip-set", filters, o[1]);
    b.dataset.set = o[0];
    b.addEventListener("click", function () { state.set = o[0]; renderRail(); });
    return b;
  });
  h("span", "px-chip-sep", filters);
  var platforms = [];
  EX.forEach(function (e) { if (platforms.indexOf(e.platform) < 0) platforms.push(e.platform); });
  filterBtns = filterBtns.concat(platforms.map(function (p) {
    var b = btn("px-chip", filters, p);
    b.dataset.p = p;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () { state.filter = state.filter === p ? "all" : p; renderRail(); });
    return b;
  }));
  var score = h("div", "px-score", railTop);
  score.setAttribute("aria-live", "polite");
  var cards = h("div", "px-cards", rail);
  cards.setAttribute("role", "list");

  /* Header --------------------------------------------------------------- */
  var main = h("div", "px-main", root);
  var head = h("div", "px-head", main);
  var headMeta = h("div", "px-meta", head);
  var headTask = h("div", "px-task", head);
  h("span", "px-k", headTask, "Instruction");
  var taskText = h("p", null, headTask);
  var headNav = h("div", "px-head-nav", head);
  var prevCase = btn("px-icon", headNav, null, "Previous case");
  prevCase.appendChild(icon("prev"));
  var caseIdx = h("span", "px-case-idx", headNav);
  var nextCase = btn("px-icon", headNav, null, "Next case");
  nextCase.appendChild(icon("next"));
  var shuffle = btn("px-icon", headNav, null, "Random case");
  shuffle.appendChild(icon("shuffle"));
  var copyLink = btn("px-icon", headNav, null, "Copy a link to this step");
  copyLink.appendChild(icon("link"));

  /* Stage + side panel ----------------------------------------------------- */
  var body = h("div", "px-body", main);
  var stageCol = h("div", "px-stage-col", body);
  var stage = h("div", "px-stage", stageCol);
  var screen = h("div", "px-screen", stage);
  var chrome = h("div", "px-chrome", screen);
  h("i", null, chrome); h("i", null, chrome); h("i", null, chrome);
  var chromeTitle = h("span", null, chrome);
  var viewport = h("div", "px-viewport", screen);
  var img = h("img", "px-img", viewport);
  img.alt = "";
  img.decoding = "async";
  var ov = h("div", "px-ov", viewport);
  ov.setAttribute("aria-hidden", "true");
  var ovSvg = s("svg", { class: "px-ov-svg", viewBox: "0 0 100 100", preserveAspectRatio: "none" }, ov);
  var ovBox = h("div", "px-box", ov);
  var cursor = h("div", "px-cursor", ov);
  cursor.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 2.5v17.2l4.6-4.4 2.9 6.7 3-1.3-2.9-6.6h6.4Z"/></svg>';
  var ovLayer = h("div", "px-ov-layer", ov);
  var lens = h("div", "px-lens", viewport);
  lens.setAttribute("aria-hidden", "true");
  var hud = h("div", "px-hud", viewport);
  var hudStep = h("span", "px-hud-step", hud);
  var hudBadges = h("span", "px-hud-badges", hud);
  var stepProgress = h("div", "px-progress", viewport);
  var stepProgressBar = h("i", null, stepProgress);

  /* Transport */
  var transport = h("div", "px-transport", stageCol);
  var tFirst = btn("px-icon", transport, null, "First state"); tFirst.appendChild(icon("first"));
  var tPrev = btn("px-icon", transport, null, "Previous state (←)"); tPrev.appendChild(icon("prev"));
  var tPlay = btn("px-play", transport, null, "Play (space)");
  var tNext = btn("px-icon", transport, null, "Next state (→)"); tNext.appendChild(icon("next"));
  var tLast = btn("px-icon", transport, null, "Last state"); tLast.appendChild(icon("last"));
  var tSpeed = btn("px-speed", transport, "1×", "Playback speed");
  h("span", "px-spacer", transport);
  var tKey = btn("px-pill px-key-jump", transport, null, "Jump to the next key evidence state");
  tKey.appendChild(icon("spark"));
  h("span", null, tKey, "Key evidence");
  var tLens = btn("px-icon px-lens-btn", transport, null, "Magnifier");
  tLens.appendChild(icon("zoom"));
  tLens.setAttribute("aria-pressed", "false");
  var tFull = btn("px-icon", transport, null, "Open the full-resolution screenshot");
  tFull.appendChild(icon("full"));

  /* Filmstrip + macro timeline */
  var film = h("div", "px-film", stageCol);
  var macro = h("div", "px-macro", stageCol);
  var macroTrack = h("div", "px-macro-track", macro);
  var macroLabel = h("span", "px-macro-label", macro);
  var preview = h("div", "px-preview", stageCol);
  var previewImg = h("img", null, preview);
  previewImg.alt = "";
  var previewText = h("span", null, preview);

  /* Side panel */
  var side = h("aside", "px-side", body);
  var sideHead = h("div", "px-side-head", side);
  var sideStep = h("span", "px-k", sideHead);
  var sideCaption = h("strong", "px-caption", sideHead);
  var actionCard = h("div", "px-action", side);
  var actionIcon = h("span", "px-action-icon", actionCard);
  var actionText = h("span", "px-action-text", actionCard);
  var actionLabel = h("b", null, actionText);
  var actionDetail = h("span", null, actionText);
  var thoughtBox = h("div", "px-thought", side);
  var thoughtHead = h("div", "px-thought-head", thoughtBox);
  h("span", "px-k", thoughtHead, "Agent reasoning");
  var thoughtSkip = btn("px-link", thoughtHead, "Show all");
  var thoughtText = h("p", "px-thought-text", thoughtBox);
  var rawBox = h("details", "px-raw", side);
  h("summary", null, rawBox, "Raw tool call");
  var rawPre = h("pre", null, rawBox);
  var keysHint = h("p", "px-keys-hint", side);
  keysHint.innerHTML = "<kbd>←</kbd> <kbd>→</kbd> step · <kbd>space</kbd> play · <kbd>S</kbd> / <kbd>F</kbd> vote";

  /* Verdict console */
  var verdict = h("section", "px-verdict", main);
  verdict.setAttribute("aria-live", "polite");

  var status = h("span", "sr-only", root);
  status.setAttribute("aria-live", "polite");

  /* Lightbox */
  var lb = h("div", "px-lightbox", document.body);
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Full-resolution screenshot");
  var lbBar = h("div", "px-lightbox-bar", lb);
  var lbCap = h("span", null, lbBar);
  var lbActs = h("div", null, lbBar);
  var lbPrev = btn("px-icon", lbActs, null, "Previous state"); lbPrev.appendChild(icon("prev"));
  var lbNext = btn("px-icon", lbActs, null, "Next state"); lbNext.appendChild(icon("next"));
  var lbOpen = h("a", "px-pill", lbActs, "Original");
  lbOpen.target = "_blank"; lbOpen.rel = "noopener";
  var lbClose = btn("px-pill", lbActs, "Close ×");
  var lbScroll = h("div", "px-lightbox-scroll", lb);
  var lbImg = h("img", null, lbScroll);
  lbImg.alt = "";
  var lbReturn = null;

  /* ---------------------------------------------------------- rendering */
  function cur() { return EX[state.ci]; }
  function curStep() { return cur()._steps[state.si]; }

  function renderScore() {
    var mine = 0, mineOk = 0, judges = 0, judgesOk = 0;
    EX.forEach(function (e) {
      var v = votes[e.id];
      if (!v || v === "skip") return;
      mine++;
      if (v === e.gold) mineOk++;
      (e.judges || []).forEach(function (j) { judges++; if (j.verdict === e.gold) judgesOk++; });
    });
    score.textContent = "";
    if (!mine) {
      h("span", null, score, "Judge each case before you see the answer.");
      return;
    }
    var you = h("span", "px-score-you", score);
    h("b", null, you, mineOk + "/" + mine);
    h("span", null, you, " your calls match the annotators");
    if (judges) {
      var them = h("span", "px-score-judges", score);
      h("b", null, them, judgesOk + "/" + judges);
      h("span", null, them, " model judges on the same cases");
    }
    var reset = btn("px-link", score, "Reset");
    reset.addEventListener("click", function () {
      votes = {};
      saveVotes();
      renderAll();
    });
  }

  function cardThumb(e) {
    var key = e.steps.filter(function (st) { return st.markers && st.markers.length; })[0];
    return (key || e.steps[Math.min(1, e.steps.length - 1)] || {}).thumb;
  }

  function renderRail() {
    filterBtns.forEach(function (b) {
      var on = b.dataset.set ? b.dataset.set === state.set : b.dataset.p === state.filter;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    cards.textContent = "";
    var shown = 0;
    EX.forEach(function (e, i) {
      if (state.filter !== "all" && e.platform !== state.filter) return;
      if (state.set === "hard" && e.set !== "hard") return;
      if (state.set === "paper" && e.set === "hard") return;
      shown++;
      var item = h("div", null, cards);
      item.setAttribute("role", "listitem");
      var c = btn("px-card" + (i === state.ci ? " is-on" : "") + (e._portrait ? " is-portrait" : ""), item);
      c.setAttribute("aria-current", i === state.ci ? "true" : "false");
      var th = h("span", "px-card-shot", c);
      var im = h("img", null, th);
      im.src = cardThumb(e);
      im.alt = "";
      im.loading = "lazy";
      var v = votes[e.id];
      if (v) {
        var mark = h("span", "px-card-mark " + (v === "skip" ? "is-skip" : v === e.gold ? "is-ok" : "is-bad"), th,
          v === "skip" ? "·" : v === e.gold ? "✓" : "✗");
        mark.title = v === "skip" ? "Revealed without a vote" : v === e.gold ? "You matched the annotators" : "You disagreed with the annotators";
      }
      if (e.set === "hard") h("span", "px-card-hard", th, "Hard pick");
      var tx = h("span", "px-card-text", c);
      h("span", "px-card-plat", tx, e.platform + " · " + (e._total || e.steps.length) + " states");
      h("span", "px-card-type", tx, revealed(e) ? e.caseType : "Case " + String(i + 1).padStart(2, "0") + " · unjudged");
      c.setAttribute("aria-label", "Case " + (i + 1) + ", " + e.platform + (revealed(e) ? ", " + e.caseType : ", not judged yet"));
      c.addEventListener("click", function () { openCase(i, 0, true); });
    });
    if (!shown) h("p", "px-empty", cards, "No cases match both filters.");
    renderScore();
  }

  function renderHead() {
    var e = cur();
    headMeta.textContent = "";
    h("span", "px-plat px-plat-" + e.platform.toLowerCase(), headMeta, e.platform);
    if (e._agent) h("span", "px-tag", headMeta, "Agent · " + e._agent);
    h("span", "px-tag", headMeta, (e._total || e.steps.length) + " recorded states" +
      (e.stateMeta && !e.stateMeta.showsAllStates ? " · " + e.steps.length + " shown" : ""));
    if (revealed(e)) h("span", "px-tag px-tag-gold", headMeta, e.caseType);
    else h("span", "px-tag px-tag-blind", headMeta, "Blind replay — annotations unlock after your call");
    taskText.textContent = e.instruction;
    caseIdx.textContent = (state.ci + 1) + " / " + EX.length;
    root.classList.toggle("is-portrait", e._portrait);
    root.classList.toggle("is-revealed", revealed(e));
    chromeTitle.textContent = e.platform === "Web" ? "browser" : e.platform === "Mobile" ? "" : e.platform.toLowerCase() + " desktop";
  }

  function markerTypes(st) { return (st.raw.markers || []).map(function (m) { return m.type; }); }

  function renderFilm() {
    var e = cur();
    film.textContent = "";
    var prev = null;
    e._steps.forEach(function (st, i) {
      var n = st.raw.number;
      if (prev !== null && n > prev + 1) {
        var gap = h("span", "px-gap", film, "+" + (n - prev - 1));
        gap.title = (n - prev - 1) + " recorded state" + (n - prev - 1 === 1 ? "" : "s") + " not shown";
      }
      prev = n;
      var types = revealed(e) ? markerTypes(st) : [];
      var f = btn("px-frame" + types.map(function (t) { return " is-" + t; }).join(""), film, null,
        "State " + n + ": " + st.sum.label + (st.sum.detail ? " " + st.sum.detail : ""));
      f.dataset.i = i;
      var fi = h("img", null, f);
      fi.src = st.raw.thumb || st.raw.shot;
      fi.alt = "";
      
      fi.decoding = "async";
      h("span", "px-frame-n", f, n);
      h("span", "px-frame-k px-k-" + st.sum.code, f);
      f.addEventListener("click", function () { userGo(i); });
      f.addEventListener("mouseenter", function () { showPreview(i, f); });
      f.addEventListener("mouseleave", hidePreview);
    });

    macroTrack.textContent = "";
    var total = Math.max(e._total, 1);
    var fill = h("i", "px-macro-fill", macroTrack);
    fill.style.width = "0%";
    e._steps.forEach(function (st, i) {
      var t = h("button", "px-macro-tick", macroTrack);
      t.type = "button";
      t.tabIndex = -1;
      t.setAttribute("aria-hidden", "true");
      t.style.left = (total > 1 ? st.raw.number / (total - 1) * 100 : 0) + "%";
      if (revealed(e)) markerTypes(st).forEach(function (m) { t.classList.add("is-" + m); });
      t.addEventListener("click", function () { userGo(i); });
    });
    h("i", "px-macro-head", macroTrack);
    tKey.hidden = !revealed(e) || !e._steps.some(function (st) { return markerTypes(st).length; });
  }

  function showPreview(i, anchor) {
    if (!FINE) return;
    var st = cur()._steps[i];
    previewImg.src = st.raw.thumb || st.raw.shot;
    previewText.textContent = "State " + st.raw.number + " · " + st.sum.label +
      (revealed(cur()) && st.raw.caption ? " — " + st.raw.caption : "");
    var colR = stageCol.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    preview.style.left = clamp(r.left + r.width / 2 - colR.left, 110, colR.width - 110) + "px";
    preview.style.top = (r.top - colR.top) + "px";
    preview.classList.add("is-on");
  }
  function hidePreview() { preview.classList.remove("is-on"); }

  function clearOverlay() {
    overlayTimers.forEach(clearTimeout);
    overlayTimers = [];
    ovLayer.textContent = "";
    ovSvg.textContent = "";
    ovBox.className = "px-box";
  }
  function later(fn, ms) { overlayTimers.push(setTimeout(fn, REDUCED ? 0 : ms)); }

  function placeCursor(pt, animate) {
    cursor.classList.toggle("no-anim", !animate || REDUCED);
    cursor.style.left = (pt.x * 100) + "%";
    cursor.style.top = (pt.y * 100) + "%";
    cursorPt = pt;
  }

  function drawOverlay(st, animate) {
    clearOverlay();
    var a = st.act;
    var travel = animate && !REDUCED ? 520 : 0;
    var hasPt = !!a.pt;
    cursor.classList.toggle("is-hidden", !hasPt);
    if (hasPt) {
      var dist = Math.hypot(a.pt.x - cursorPt.x, a.pt.y - cursorPt.y);
      if (dist < 0.002) travel = 0;
      placeCursor(a.pt, animate);
    }

    if (a.box) {
      ovBox.style.left = a.box.x0 * 100 + "%";
      ovBox.style.top = a.box.y0 * 100 + "%";
      ovBox.style.width = (a.box.x1 - a.box.x0) * 100 + "%";
      ovBox.style.height = (a.box.y1 - a.box.y0) * 100 + "%";
      later(function () { ovBox.className = "px-box is-on"; }, travel);
    }

    var k = a.kind;
    if (hasPt && (k === "click" || k === "dclick" || k === "rclick" || k === "type")) {
      later(function () {
        ripple(a.pt, k === "rclick" ? "is-right" : "");
        if (k === "dclick") later(function () { ripple(a.pt, ""); }, 160);
      }, travel);
    }
    if (hasPt && k === "hover") {
      later(function () {
        var ring = h("span", "px-hover-ring", ovLayer);
        pos(ring, a.pt);
      }, travel);
    }
    if (k === "type") {
      later(function () { typedBubble(a); }, travel + 200);
    }
    if (k === "key") keycaps(a.keys);
    if (k === "scroll") scrollCue(a);
    if ((k === "swipe" || k === "drag") && a.pt && a.pt2) later(function () { swipeCue(a); }, travel);
    if (k === "nav") chip("px-ov-url", "↗ " + (a.url || a.name.replace(/_/g, " ")));
    if (k === "wait") chip("px-ov-wait", "⏳ waiting" + (a.amount ? " " + a.amount + " s" : ""));
    if (k === "code") chip("px-ov-code", "› " + short(a.text, 80));
    if (k === "done") doneBanner(a);
  }

  function pos(n, pt) {
    n.style.left = pt.x * 100 + "%";
    n.style.top = pt.y * 100 + "%";
  }
  function ripple(pt, extra) {
    var r = h("span", "px-ripple " + (extra || ""), ovLayer);
    pos(r, pt);
    var r2 = h("span", "px-ripple px-ripple-2 " + (extra || ""), ovLayer);
    pos(r2, pt);
  }
  function chip(cls, text) {
    return h("div", "px-ov-chip " + cls, ovLayer, text);
  }
  function keycaps(keys) {
    var wrap = h("div", "px-ov-chip px-ov-keys", ovLayer);
    String(keys || "").split(/\s*\+\s*/).filter(Boolean).forEach(function (kk, i) {
      if (i) h("span", "px-plus", wrap, "+");
      h("kbd", null, wrap, kk);
    });
  }
  function typedBubble(a) {
    var b = h("div", "px-ov-type", ovLayer);
    if (a.pt) {
      pos(b, a.pt);
      if (a.pt.y > 0.78) b.classList.add("is-above");
      if (a.pt.x > 0.7) b.classList.add("is-left");
    } else b.classList.add("is-center");
    var t = h("span", null, b);
    var caret = h("i", "px-caret", b);
    if (a.enter) h("kbd", "px-enter", b, "⏎");
    var text = a.text || "";
    if (REDUCED || !text) { t.textContent = text; return; }
    var n = 0, step = Math.max(1, Math.ceil(text.length / 40));
    (function tick() {
      n = Math.min(text.length, n + step);
      t.textContent = text.slice(0, n);
      if (n < text.length) overlayTimers.push(setTimeout(tick, 28));
      else caret.classList.add("is-done");
    })();
  }
  function scrollCue(a) {
    var pt = a.pt || { x: 0.5, y: 0.5 };
    var dir = (a.dir || "down").toLowerCase();
    var c = h("div", "px-ov-scroll is-" + dir, ovLayer);
    pos(c, pt);
    h("i", null, c); h("i", null, c); h("i", null, c);
  }
  function swipeCue(a) {
    var line = s("line", { x1: a.pt.x * 100, y1: a.pt.y * 100, x2: a.pt2.x * 100, y2: a.pt2.y * 100,
      class: "px-swipe-line", "vector-effect": "non-scaling-stroke", pathLength: "1" }, ovSvg);
    line.getBoundingClientRect();
    line.classList.add("is-on");
    var dot = h("span", "px-swipe-dot", ovLayer);
    pos(dot, a.pt);
    var end = h("span", "px-swipe-end is-" + swipeDir(a), ovLayer);
    pos(end, a.pt2);
    requestAnimationFrame(function () { pos(dot, a.pt2); dot.classList.add("is-moving"); });
  }
  function doneBanner(a) {
    var b = h("div", "px-ov-done", ovLayer);
    h("b", null, b, "Agent declares the task finished");
    if (a.answer && !/^(success|failure)$/i.test(a.answer)) h("span", null, b, short(a.answer, 220));
  }

  function typeThought(text, animate) {
    if (typeRaf) cancelAnimationFrame(typeRaf);
    typeRaf = null;
    /* agents write light Markdown; the panel shows plain text */
    text = String(text || "").replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/^#{1,4}\s+/gm, "").trim() ||
      "No reasoning recorded for this state.";
    thoughtBox.classList.remove("is-typing");
    if (!animate || REDUCED) {
      thoughtText.textContent = text;
      thoughtSkip.hidden = true;
      return;
    }
    thoughtSkip.hidden = false;
    thoughtBox.classList.add("is-typing");
    var t0 = performance.now();
    var cps = 520 * state.speed;
    (function frame(now) {
      var n = Math.min(text.length, Math.floor((now - t0) / 1000 * cps));
      thoughtText.textContent = text.slice(0, n);
      if (n < text.length) typeRaf = requestAnimationFrame(frame);
      else { typeRaf = null; thoughtSkip.hidden = true; thoughtBox.classList.remove("is-typing"); }
    })(t0);
    thoughtSkip.onclick = function () {
      if (typeRaf) cancelAnimationFrame(typeRaf);
      typeRaf = null;
      thoughtText.textContent = text;
      thoughtSkip.hidden = true;
      thoughtBox.classList.remove("is-typing");
    };
  }

  function renderStep(animate) {
    var e = cur(), st = curStep(), raw = st.raw;
    var isRev = revealed(e);
    var src = raw.thumb || raw.shot;
    if (img.getAttribute("src") !== src) {
      img.classList.remove("is-in");
      img.onload = function () { img.classList.add("is-in"); };
      img.src = src;
      if (img.complete) img.classList.add("is-in");
    }
    img.alt = "Screenshot at state " + raw.number + " of the trajectory" + (isRev && raw.caption ? ": " + raw.caption : "");
    lens.style.backgroundImage = state.lens ? "url(\"" + raw.shot + "\")" : "";

    hudStep.textContent = "State " + raw.number + " / " + Math.max(e._total - 1, raw.number);
    hudBadges.textContent = "";
    if (isRev) (raw.markers || []).forEach(function (m) { h("span", "px-badge is-" + m.type, hudBadges, m.label); });

    sideStep.textContent = "State " + raw.number + " · " + (state.si + 1) + " of " + e._steps.length + " shown";
    sideCaption.textContent = isRev ? (raw.caption || "") : "";
    sideCaption.hidden = !isRev || !raw.caption;
    actionIcon.className = "px-action-icon px-k-" + st.sum.code;
    actionIcon.textContent = st.sum.label.charAt(0);
    actionLabel.textContent = st.sum.label;
    actionDetail.textContent = st.sum.detail ? " " + st.sum.detail : "";
    rawPre.textContent = raw.actionRaw || raw.action || "—";
    typeThought(raw.thought, animate);

    drawOverlay(st, animate);

    Array.prototype.forEach.call(film.querySelectorAll(".px-frame"), function (f) {
      var on = +f.dataset.i === state.si;
      f.classList.toggle("is-on", on);
      f.setAttribute("aria-current", on ? "step" : "false");
      if (on) {
        var l = f.offsetLeft - film.clientWidth / 2 + f.clientWidth / 2;
        film.scrollTo({ left: l, behavior: animate && !REDUCED ? "smooth" : "auto" });
      }
    });
    var total = Math.max(e._total - 1, 1);
    var pct = raw.number / total * 100;
    macroTrack.querySelector(".px-macro-fill").style.width = pct + "%";
    macroTrack.querySelector(".px-macro-head").style.left = pct + "%";
    Array.prototype.forEach.call(macroTrack.querySelectorAll(".px-macro-tick"), function (t, i) {
      t.classList.toggle("is-past", i <= state.si);
    });
    macroLabel.textContent = Math.round(pct) + "% through the trajectory";

    tPrev.disabled = tFirst.disabled = state.si === 0;
    tNext.disabled = tLast.disabled = state.si === e._steps.length - 1;
    status.textContent = "State " + raw.number + ": " + st.sum.label + (st.sum.detail ? " " + st.sum.detail : "");

    /* warm the next frames */
    for (var k = 1; k <= 2; k++) {
      var nx = e._steps[state.si + k];
      if (nx) { var p = new Image(); p.src = nx.raw.thumb || nx.raw.shot; }
    }
    if (!lb.hidden) syncLightbox();
    if (state.si === e._steps.length - 1 && !isRev) verdict.classList.add("is-nudge");
  }

  /* ----------------------------------------------------- verdict console */
  function parseField(sum) {
    var m = String(sum || "").match(/(\d+)\s*\/\s*(\d+)\s*(SUCCESS|FAIL)/i);
    if (!m) return null;
    return { n: +m[1], of: +m[2], v: /succ/i.test(m[3]) ? "success" : "failure" };
  }

  function renderVerdict() {
    var e = cur();
    verdict.textContent = "";
    verdict.classList.remove("is-nudge");
    var v = votes[e.id];
    if (!v) {
      verdict.className = "px-verdict is-ask";
      var q = h("div", "px-ask", verdict);
      h("span", "px-k", q, "Your call");
      h("h3", null, q, "Did the agent complete the task?");
      h("p", null, q, "Step through the evidence the way a judge would, then decide. " +
        "The annotators' verdict, the model judges' votes and the key states unlock after you answer.");
      var row = h("div", "px-vote-row", verdict);
      var yes = btn("px-vote is-success", row);
      h("b", null, yes, "✓ Success");
      h("small", null, yes, "S");
      var no = btn("px-vote is-failure", row);
      h("b", null, no, "✗ Failure");
      h("small", null, no, "F");
      var skip = btn("px-link px-skip", row, "Just reveal it");
      yes.addEventListener("click", function () { vote("success"); });
      no.addEventListener("click", function () { vote("failure"); });
      skip.addEventListener("click", function () { vote("skip"); });
      return;
    }

    verdict.className = "px-verdict is-result";
    var grid = h("div", "px-result", verdict);

    /* left: stamp + your result */
    var left = h("div", "px-result-main", grid);
    var stamp = h("div", "px-stamp is-" + e.gold, left);
    h("span", null, stamp, "Human verdict");
    h("b", null, stamp, verdictWord(e.gold));
    var you = h("p", "px-you", left);
    if (v === "skip") you.textContent = "You revealed this case without voting.";
    else if (v === e.gold) { you.classList.add("is-ok"); you.textContent = "You called " + verdictWord(v) + " — you agree with the annotators."; }
    else { you.classList.add("is-bad"); you.textContent = "You called " + verdictWord(v) + " — the annotators disagree."; }
    h("p", "px-why", left, e.goldWhy);
    if (e.reason) {
      var rs = h("div", "px-reason", left);
      h("span", "px-k", rs, e.reasonLabel || "Why it is hard");
      h("p", null, rs, e.reason);
    }
    if (e.agentAccount) {
      var ac = h("div", "px-reason", left);
      h("span", "px-k", ac, "What the agent claimed");
      h("p", null, ac, e.agentAccount);
    }

    /* right: judges */
    var right = h("div", "px-result-judges", grid);
    var judges = e.judges || [];
    var agree = judges.filter(function (j) { return j.verdict === e.gold; }).length;
    var jh = h("div", "px-judges-head", right);
    h("span", "px-k", jh, "Model judges");
    if (judges.length) {
      h("strong", null, jh, agree + " of " + judges.length + " shown judges match the human verdict");
    } else {
      h("p", "px-judges-none", right, "Model-judge responses for this trajectory are not in the page export yet. " +
        "It was picked from the full benchmark because its final screen and the agent's own report point " +
        (e.gold === "failure" ? "towards success while the annotators marked it a failure." :
          "towards failure (long, noisy, self-correcting) while the annotators marked it a success."));
    }
    var field = parseField(e.judgeFieldSummary);
    if (field) {
      var fw = h("div", "px-field", right);
      var dots = h("div", "px-field-dots", fw);
      for (var i = 0; i < field.of; i++) {
        var said = i < field.n ? field.v : (field.v === "success" ? "failure" : "success");
        var d = h("i", "is-" + said + (said === e.gold ? " is-right" : ""), dots);
        d.style.animationDelay = (REDUCED ? 0 : i * 28) + "ms";
      }
      var fieldWrong = field.v === e.gold ? field.of - field.n : field.n;
      h("span", "px-field-cap", fw, "All " + field.of + " judges in the study: " + field.n + " said " +
        verdictWord(field.v) + " · " + fieldWrong + " got it wrong (gold ring = matches the human verdict)");
    }
    if (judges.length) {
      var tabs = h("div", "px-jtabs", right);
      tabs.setAttribute("role", "tablist");
      var panel = h("div", "px-jpanel", right);
      panel.setAttribute("role", "tabpanel");
      var tabEls = judges.map(function (j, ji) {
        var t = btn("px-jtab" + (j.verdict === e.gold ? " is-right" : " is-wrong"), tabs);
        t.setAttribute("role", "tab");
        var logo = modelLogo(modelName(j.name));
        if (logo) { var li = h("img", null, t); li.src = logo; li.alt = ""; }
        h("span", "px-jname", t, modelName(j.name));
        h("span", "px-tag-v is-" + j.verdict, t, j.verdict === "success" ? "S" : "F");
        t.addEventListener("click", function () { showJudge(ji); });
        return t;
      });
      var showJudge = function (ji) {
        var j = judges[ji];
        tabEls.forEach(function (t, k) { t.classList.toggle("is-on", k === ji); t.setAttribute("aria-selected", k === ji ? "true" : "false"); });
        panel.textContent = "";
        var ph = h("div", "px-jpanel-head", panel);
        h("span", "px-tag-v is-" + j.verdict, ph, verdictWord(j.verdict));
        h("span", j.verdict === e.gold ? "px-ok" : "px-bad", ph, j.verdict === e.gold ? "matches human" : "disagrees with human");
        if (j.context) h("small", null, ph, j.context);
        h("pre", "px-jresp", panel, j.response || j.reason || "");
      };
      var firstWrong = judges.findIndex(function (j) { return j.verdict !== e.gold; });
      showJudge(firstWrong >= 0 ? firstWrong : 0);
    }

    var foot = h("div", "px-result-foot", verdict);
    if (e.annotation === "site") {
      h("p", "px-provenance", foot, "Captions and highlighted states for this case were written for this page from " +
        "the trajectory and its screenshots; the human verdict is the benchmark's gold label.");
    }
    var replay = btn("px-pill", foot, null);
    replay.appendChild(icon("spark"));
    h("span", null, replay, "Replay with annotations");
    replay.addEventListener("click", function () {
      var keyIdx = e._steps.findIndex(function (st) { return markerTypes(st).length; });
      go(keyIdx >= 0 ? keyIdx : 0, true);
      stage.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
    });
    var next = btn("px-pill px-pill-gold", foot, "Next case →");
    next.addEventListener("click", function () { nextUnjudged(); });
  }

  function vote(v) {
    var e = cur();
    if (votes[e.id]) return;
    votes[e.id] = v;
    saveVotes();
    pause();
    renderHead();
    renderFilm();
    renderStep(false);
    renderVerdict();
    renderRail();
    verdict.classList.add("is-flash");
    if (v !== "skip") status.textContent = v === e.gold ? "Correct. The annotators also said " + verdictWord(e.gold) + "." :
      "The annotators said " + verdictWord(e.gold) + ".";
  }

  function nextUnjudged() {
    for (var k = 1; k <= EX.length; k++) {
      var i = (state.ci + k) % EX.length;
      if (!votes[EX[i].id]) { openCase(i, 0, true); return; }
    }
    openCase((state.ci + 1) % EX.length, 0, true);
  }

  /* ---------------------------------------------------------- navigation */
  function go(i, animate) {
    var n = cur()._steps.length;
    state.si = clamp(i, 0, n - 1);
    renderStep(animate !== false);
    if (state.playing) schedule();
  }
  function userGo(i) { pause(); go(i, true); }

  function schedule() {
    clearTimeout(timer);
    stepProgress.classList.remove("is-run");
    if (!state.playing) return;
    var dwell = BASE_DWELL / state.speed;
    stepProgressBar.style.animationDuration = dwell + "ms";
    void stepProgress.offsetWidth;
    stepProgress.classList.add("is-run");
    timer = setTimeout(function () {
      if (state.si >= cur()._steps.length - 1) { pause(); return; }
      go(state.si + 1, true);
    }, dwell);
  }
  function play() {
    if (state.si >= cur()._steps.length - 1) go(0, true);
    state.playing = true;
    setPlayIcon();
    schedule();
  }
  function pause() {
    state.playing = false;
    clearTimeout(timer);
    stepProgress.classList.remove("is-run");
    setPlayIcon();
  }
  function setPlayIcon() {
    tPlay.textContent = "";
    tPlay.appendChild(icon(state.playing ? "pause" : "play"));
    h("span", null, tPlay, state.playing ? "Pause" : "Play");
    tPlay.setAttribute("aria-label", state.playing ? "Pause (space)" : "Play (space)");
    root.classList.toggle("is-playing", state.playing);
  }

  function openCase(i, step, animate) {
    pause();
    state.ci = clamp(i, 0, EX.length - 1);
    state.si = 0;
    cursorPt = { x: 0.5, y: 0.5 };
    placeCursor(cursorPt, false);
    renderAll(animate);
    go(step || 0, animate);
    /* blind replays run on their own once the reader has met the player */
    if (started && !revealed(cur()) && !REDUCED && animate && !step) play();
  }

  function renderAll(animate) {
    renderHead();
    renderRail();
    renderFilm();
    renderVerdict();
    renderStep(!!animate);
  }

  /* ---------------------------------------------------------------- lens */
  function setLens(on) {
    state.lens = on;
    tLens.setAttribute("aria-pressed", on ? "true" : "false");
    tLens.classList.toggle("is-on", on);
    root.classList.toggle("has-lens", on);
    lens.style.backgroundImage = on ? "url(\"" + curStep().raw.shot + "\")" : "";
  }
  viewport.addEventListener("pointermove", function (ev) {
    if (!state.lens || ev.pointerType === "touch") return;
    var r = viewport.getBoundingClientRect();
    var x = ev.clientX - r.left, y = ev.clientY - r.top, z = 2.6;
    lens.style.transform = "translate(" + (x - 90) + "px," + (y - 90) + "px)";
    lens.style.backgroundSize = r.width * z + "px " + r.height * z + "px";
    lens.style.backgroundPosition = (90 - x * z) + "px " + (90 - y * z) + "px";
    lens.classList.add("is-on");
  });
  viewport.addEventListener("pointerleave", function () { lens.classList.remove("is-on"); });
  viewport.addEventListener("click", function () { if (!state.lens) openLightbox(viewport); });

  /* ------------------------------------------------------------ lightbox */
  function syncLightbox() {
    var st = curStep().raw;
    lbCap.textContent = "State " + st.number + (revealed(cur()) && st.caption ? " · " + st.caption : "");
    lbImg.src = st.shot;
    lbImg.alt = "Full-resolution screenshot, state " + st.number;
    lbOpen.href = st.shot;
  }
  function openLightbox(opener) {
    pause();
    lbReturn = opener || null;
    syncLightbox();
    lb.hidden = false;
    lb.classList.remove("is-actual");
    document.body.classList.add("px-modal-open");
    lbClose.focus();
  }
  function closeLightbox() {
    lb.hidden = true;
    lbImg.removeAttribute("src");
    document.body.classList.remove("px-modal-open");
    if (lbReturn && document.contains(lbReturn)) lbReturn.focus();
  }
  lbClose.addEventListener("click", closeLightbox);
  lbPrev.addEventListener("click", function () { go(state.si - 1, false); });
  lbNext.addEventListener("click", function () { go(state.si + 1, false); });
  lbImg.addEventListener("click", function () { lb.classList.toggle("is-actual"); });
  lb.addEventListener("click", function (ev) { if (ev.target === lb || ev.target === lbScroll) closeLightbox(); });
  document.addEventListener("keydown", function (ev) {
    if (lb.hidden) return;
    if (ev.key === "Escape") { ev.preventDefault(); closeLightbox(); }
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); go(state.si - 1, false); }
    else if (ev.key === "ArrowRight") { ev.preventDefault(); go(state.si + 1, false); }
    else if (ev.key === "Tab") {
      var f = lb.querySelectorAll("button, a[href]");
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  /* ------------------------------------------------------------ controls */
  tFirst.addEventListener("click", function () { userGo(0); });
  tPrev.addEventListener("click", function () { userGo(state.si - 1); });
  tNext.addEventListener("click", function () { userGo(state.si + 1); });
  tLast.addEventListener("click", function () { userGo(cur()._steps.length - 1); });
  tPlay.addEventListener("click", function () { started = true; state.playing ? pause() : play(); });
  tSpeed.addEventListener("click", function () {
    var k = (SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length;
    state.speed = SPEEDS[k];
    tSpeed.textContent = state.speed + "×";
    if (state.playing) schedule();
  });
  tKey.addEventListener("click", function () {
    var st = cur()._steps;
    for (var k = 1; k <= st.length; k++) {
      var i = (state.si + k) % st.length;
      if (markerTypes(st[i]).length) { userGo(i); return; }
    }
  });
  tLens.addEventListener("click", function () { setLens(!state.lens); });
  tFull.addEventListener("click", function () { openLightbox(tFull); });
  prevCase.addEventListener("click", function () { openCase((state.ci - 1 + EX.length) % EX.length, 0, true); });
  nextCase.addEventListener("click", function () { openCase((state.ci + 1) % EX.length, 0, true); });
  shuffle.addEventListener("click", function () {
    if (EX.length < 2) return;
    var i;
    do { i = Math.floor(Math.random() * EX.length); } while (i === state.ci);
    openCase(i, 0, true);
  });
  copyLink.addEventListener("click", function () {
    var url = location.href.split("#")[0] + "#case=" + encodeURIComponent(cur().id) + "&state=" + curStep().raw.number;
    try { history.replaceState(null, "", url); } catch (e) { /* file:// */ }
    var done = function () {
      copyLink.classList.add("is-done");
      setTimeout(function () { copyLink.classList.remove("is-done"); }, 1400);
      status.textContent = "Link to this state copied.";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  });

  root.addEventListener("keydown", function (ev) {
    if (!lb.hidden || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var tag = ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    var k = ev.key;
    if (k === "ArrowRight") { ev.preventDefault(); userGo(state.si + 1); }
    else if (k === "ArrowLeft") { ev.preventDefault(); userGo(state.si - 1); }
    else if (k === " " && tag !== "BUTTON" && tag !== "A" && tag !== "SUMMARY") {
      ev.preventDefault(); started = true; state.playing ? pause() : play();
    }
    else if ((k === "s" || k === "S") && !votes[cur().id]) vote("success");
    else if ((k === "f" || k === "F") && !votes[cur().id]) vote("failure");
  });
  /* clicking anywhere in the player gives it keyboard focus for the arrow keys */
  root.addEventListener("pointerdown", function (ev) {
    if (!root.contains(document.activeElement) && !ev.target.closest("button, a, summary, pre")) root.focus({ preventScroll: true });
  });

  /* autoplay the first blind replay once the player is on screen; pause off screen */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible = en.isIntersecting;
        if (visible && !started) {
          started = true;
          if (!REDUCED && !revealed(cur())) play();
        } else if (!visible && state.playing) pause();
      });
    }, { threshold: 0.45 }).observe(stage);
  }

  /* ------------------------------------------------------------- deep link */
  function fromHash() {
    var m = location.hash.match(/^#case=([^&]+)(?:&state=(\d+))?/);
    if (!m) return false;
    var id = decodeURIComponent(m[1]);
    var ci = EX.findIndex(function (e) { return e.id === id || e.traceId === id; });
    if (ci < 0) return false;
    var si = 0;
    if (m[2]) {
      var want = +m[2];
      EX[ci]._steps.forEach(function (st, k) { if (st.raw.number <= want) si = k; });
    }
    openCase(ci, si, false);
    var sec = document.getElementById("viewer");
    if (sec) setTimeout(function () { sec.scrollIntoView(); }, 60);
    return true;
  }

  window.OSRewardPlayer = {
    open: function (id, stateNumber) {
      var ci = EX.findIndex(function (e) { return e.id === id || e.traceId === id; });
      if (ci < 0) return false;
      var si = 0;
      if (stateNumber != null) EX[ci]._steps.forEach(function (st, k) { if (st.raw.number <= stateNumber) si = k; });
      started = true;
      openCase(ci, si, true);
      var sec = document.getElementById("viewer");
      if (sec) sec.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
      return true;
    },
    has: function (id) {
      return EX.some(function (e) { return e.id === id || e.traceId === id; });
    }
  };

  setPlayIcon();
  if (!fromHash()) openCase(0, 0, false);
  window.addEventListener("hashchange", fromHash);
})();
