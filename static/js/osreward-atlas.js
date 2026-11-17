/* ==========================================================================
   OSReward — corpus atlas
   Every one of the 1,019 benchmark trajectories as one cell, regrouped live
   by platform, agent, human label or length. Hover reads a trajectory's
   instruction and its action barcode (one coloured tick per step); click pins
   it, and the ten case studies open straight into the case player.

   Data: window.OSRewardCorpus, built by tools/build_corpus_atlas.py.
   Mounts into #atlas-body.
   ========================================================================== */
(function () {
  "use strict";

  var host = document.getElementById("atlas-body");
  var C = window.OSRewardCorpus;
  if (!host || !C || !C.rows || !C.rows.length) return;

  var REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var DATASET_URL = "https://huggingface.co/datasets/OS-Copilot/OSReward";

  var KINDS = {
    c: "Click", d: "Double-click", h: "Hover", t: "Type", k: "Key press", s: "Scroll", w: "Swipe",
    g: "Drag", n: "Navigate", x: "Run code", p: "Wait", e: "Finish", o: "Other"
  };
  var KIND_ORDER = ["c", "d", "h", "t", "k", "s", "w", "g", "n", "x", "p", "e", "o"];

  var rows = C.rows.map(function (r, i) {
    return {
      i: i, id: r[0], plat: C.platforms[r[1]], agent: C.agents[r[2]], ok: r[3] === 1,
      task: r[4], code: r[5], len: r[5].length, lower: r[4].toLowerCase(),
      x: 0, y: 0, tx: 0, ty: 0, fx: 0, fy: 0
    };
  });

  function lenBucket(n) {
    return n <= 10 ? "1–10 steps" : n <= 20 ? "11–20 steps" : n <= 40 ? "21–40 steps" : "41–100 steps";
  }
  var GROUPS = {
    plat: { label: "Platform", key: function (r) { return r.plat; } },
    agent: { label: "Agent", key: function (r) { return r.agent; } },
    ok: { label: "Human label", key: function (r) { return r.ok ? "SUCCESS" : "FAILURE"; } },
    len: { label: "Length", key: function (r) { return lenBucket(r.len); },
      order: ["1–10 steps", "11–20 steps", "21–40 steps", "41–100 steps"] }
  };
  var state = { group: "plat", color: "ok", query: "", hover: null, pinned: null };

  /* ------------------------------------------------------------- helpers */
  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function seg(parent, options, value, onPick, label) {
    var g = h("div", "seg atlas-seg", parent);
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", label);
    var bs = options.map(function (o) {
      var b = h("button", null, g, o[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", o[0] === value ? "true" : "false");
      if (o[0] === value) b.classList.add("on");
      b.addEventListener("click", function () {
        bs.forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        onPick(o[0]);
      });
      return b;
    });
    return g;
  }
  function cssVar(name, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  }
  function hexRgb(c) {
    c = String(c).trim();
    if (c[0] === "#") {
      if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    }
    var m = c.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgba(c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + a + ")"; }
  function short(t, n) { return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function isCase(r) { return !!(window.OSRewardPlayer && window.OSRewardPlayer.has(r.id)); }

  function barcode(parent, code, big) {
    var b = h("div", "atlas-code" + (big ? " is-big" : ""), parent);
    for (var i = 0; i < code.length; i++) {
      var t = h("i", "px-k-" + code[i], b);
      if (big) t.title = "Step " + i + ": " + (KINDS[code[i]] || "Other");
    }
    return b;
  }

  /* ---------------------------------------------------------------- DOM */
  host.textContent = "";
  var root = h("div", "atlas", host);
  var bar = h("div", "atlas-bar", root);
  var gWrap = h("div", "atlas-ctl", bar);
  h("span", "px-k", gWrap, "Group by");
  seg(gWrap, [["plat", "Platform"], ["agent", "Agent"], ["ok", "Human label"], ["len", "Length"]], state.group,
    function (v) { state.group = v; layout(true); }, "Group trajectories by");
  var cWrap = h("div", "atlas-ctl", bar);
  h("span", "px-k", cWrap, "Colour");
  seg(cWrap, [["ok", "Human label"], ["len", "Length"]], state.color,
    function (v) { state.color = v; renderLegend(); draw(); }, "Colour trajectories by");
  var search = h("label", "atlas-search", bar);
  h("span", "sr-only", search, "Search instructions");
  var input = h("input", null, search);
  input.type = "search";
  input.placeholder = "Search 1,019 instructions…";
  input.autocomplete = "off";
  var count = h("span", "atlas-count", bar);
  count.setAttribute("aria-live", "polite");

  var legend = h("div", "atlas-legend", root);
  var canvasWrap = h("div", "atlas-canvas", root);
  var canvas = h("canvas", null, canvasWrap);
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Grid of all 1,019 OSReward trajectories grouped by platform; " +
    "the detail panel below lists the selected trajectory.");
  canvas.tabIndex = 0;
  var tip = h("div", "atlas-tip", canvasWrap);
  tip.setAttribute("aria-hidden", "true");

  var detail = h("div", "atlas-detail", root);
  detail.setAttribute("aria-live", "polite");
  var kinds = h("div", "atlas-kinds", root);
  h("span", "px-k", kinds, "Action barcode");
  KIND_ORDER.forEach(function (k) {
    if (k === "o") return;
    var item = h("span", "atlas-kind", kinds);
    h("i", "px-k-" + k, item);
    h("span", null, item, KINDS[k]);
  });

  /* ------------------------------------------------------------- layout */
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1, CELL = 11, DOT = 8, LABEL_W = 190, groups = [];
  var anim = null;

  function measure() {
    W = canvasWrap.clientWidth;
    var narrow = W < 640;
    LABEL_W = narrow ? 0 : 190;
    CELL = narrow ? 9 : W > 1200 ? 12 : 11;
    DOT = CELL - (narrow ? 2 : 3);
  }

  function layout(animate) {
    measure();
    var G = GROUPS[state.group];
    var map = {};
    rows.forEach(function (r) {
      var k = G.key(r);
      (map[k] = map[k] || []).push(r);
    });
    var keys = Object.keys(map);
    if (G.order) keys.sort(function (a, b) { return G.order.indexOf(a) - G.order.indexOf(b); });
    else keys.sort(function (a, b) { return map[b].length - map[a].length; });

    var narrow = LABEL_W === 0;
    var cols = Math.max(10, Math.floor((W - LABEL_W - 8) / CELL));
    var y = 6;
    groups = keys.map(function (k) {
      var list = map[k].slice().sort(function (a, b) {
        if (state.color === "len") return a.len - b.len;
        return (b.ok - a.ok) || (a.len - b.len);
      });
      if (narrow) y += 24;
      var top = y;
      list.forEach(function (r, i) {
        r.tx = LABEL_W + (i % cols) * CELL;
        r.ty = top + Math.floor(i / cols) * CELL;
      });
      var nrows = Math.ceil(list.length / cols);
      var g = { key: k, list: list, top: top, h: nrows * CELL, ok: list.filter(function (r) { return r.ok; }).length };
      y = top + Math.max(nrows * CELL, narrow ? 0 : 40) + 18;
      return g;
    });
    H = y;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.height = H + "px";
    renderLabels();

    if (!animate || REDUCED) {
      rows.forEach(function (r) { r.x = r.tx; r.y = r.ty; });
      draw();
      return;
    }
    rows.forEach(function (r) { r.fx = r.x; r.fy = r.y; });
    var t0 = performance.now(), dur = 760;
    if (anim) cancelAnimationFrame(anim);
    (function frame(now) {
      var done = true;
      rows.forEach(function (r) {
        var delay = (r.ty / Math.max(H, 1)) * 180 + (r.tx / Math.max(W, 1)) * 120;
        var t = Math.max(0, Math.min(1, (now - t0 - delay) / dur));
        if (t < 1) done = false;
        var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        r.x = r.fx + (r.tx - r.fx) * e;
        r.y = r.fy + (r.ty - r.fy) * e;
      });
      draw();
      anim = done ? null : requestAnimationFrame(frame);
    })(t0);
  }

  /* group labels live in the DOM so they stay crisp and selectable */
  var labelLayer = h("div", "atlas-labels", canvasWrap);
  function renderLabels() {
    labelLayer.textContent = "";
    groups.forEach(function (g) {
      var l = h("div", "atlas-glabel" + (LABEL_W ? "" : " is-inline"), labelLayer);
      l.style.top = (LABEL_W ? g.top - 2 : g.top - 22) + "px";
      if (LABEL_W) l.style.width = (LABEL_W - 18) + "px";
      h("b", null, l, g.key);
      var meta = h("span", null, l, g.list.length + " · " + Math.round(g.ok / g.list.length * 100) + "% success");
      meta.className = "atlas-gmeta";
      var split = h("span", "atlas-split", l);
      var okBar = h("i", "is-ok", split);
      okBar.style.width = (g.ok / g.list.length * 100) + "%";
      h("i", "is-bad", split).style.width = (100 - g.ok / g.list.length * 100) + "%";
    });
  }

  /* --------------------------------------------------------------- draw */
  var palette = {};
  function readPalette() {
    palette.ok = hexRgb(cssVar("--ok", "#58c7a4"));
    palette.bad = hexRgb(cssVar("--bad", "#e0736b"));
    palette.lo = hexRgb(cssVar("--cyan-500", "#1d86a6"));
    palette.mid = hexRgb(cssVar("--cyan-300", "#6fcfe0"));
    palette.hi = hexRgb(cssVar("--gold-300", "#e2c377"));
    palette.gold = cssVar("--gold-300", "#e2c377");
    palette.ink = cssVar("--text-hi", "#eaf1f9");
  }
  function colorOf(r) {
    if (state.color === "len") {
      var t = Math.log(r.len) / Math.log(100);
      return t < 0.5 ? mix(palette.lo, palette.mid, t * 2) : mix(palette.mid, palette.hi, (t - 0.5) * 2);
    }
    return r.ok ? palette.ok : palette.bad;
  }
  function matches(r) { return !state.query || r.lower.indexOf(state.query) >= 0; }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var q = !!state.query;
    var rad = Math.min(2.5, DOT / 3);
    rows.forEach(function (r) {
      var on = matches(r);
      var c = colorOf(r);
      ctx.fillStyle = rgba(c, q ? (on ? 0.95 : 0.09) : 0.78);
      roundRect(r.x, r.y, DOT, DOT, rad);
      ctx.fill();
    });
    /* the ten case studies carry a gold ring */
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.gold;
    rows.forEach(function (r) {
      if (r._case) { roundRect(r.x - 1.5, r.y - 1.5, DOT + 3, DOT + 3, rad + 1); ctx.stroke(); }
    });
    [state.pinned, state.hover].forEach(function (r, k) {
      if (!r) return;
      ctx.lineWidth = 2;
      ctx.strokeStyle = k === 0 ? palette.gold : palette.ink;
      roundRect(r.x - 2.5, r.y - 2.5, DOT + 5, DOT + 5, rad + 2);
      ctx.stroke();
    });
  }
  function roundRect(x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hh, r);
    ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function renderLegend() {
    legend.textContent = "";
    if (state.color === "ok") {
      [["is-ok", "Human: SUCCESS"], ["is-bad", "Human: FAILURE"]].forEach(function (x) {
        var it = h("span", "atlas-li", legend);
        h("i", x[0], it);
        h("span", null, it, x[1]);
      });
    } else {
      var it = h("span", "atlas-li atlas-li-ramp", legend);
      h("span", null, it, "1 step");
      h("i", "atlas-ramp", it);
      h("span", null, it, "100 steps");
    }
    var cs = h("span", "atlas-li", legend);
    h("i", "is-case", cs);
    h("span", null, cs, "Case study, opens in the player");
  }

  /* ----------------------------------------------------------- hit test */
  function hit(mx, my) {
    var best = null, bd = 1e9;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var dx = mx - (r.x + DOT / 2), dy = my - (r.y + DOT / 2);
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = r; }
    }
    return bd <= CELL * CELL * 0.5 ? best : null;
  }
  function local(ev) {
    var b = canvas.getBoundingClientRect();
    return { x: ev.clientX - b.left, y: ev.clientY - b.top };
  }

  function showTip(r) {
    tip.textContent = "";
    if (!r) { tip.classList.remove("is-on"); return; }
    var m = h("div", "atlas-tip-meta", tip);
    h("span", "px-tag-v is-" + (r.ok ? "success" : "failure"), m, r.ok ? "SUCCESS" : "FAILURE");
    h("span", null, m, r.plat + " · " + r.agent + " · " + r.len + " steps");
    h("p", null, tip, short(r.task, 180));
    barcode(tip, r.code, false);
    if (r._case) h("span", "atlas-tip-case", tip, "Case study · click to open in the player");
    var tw = 300;
    var left = r.x + DOT + 14;
    if (left + tw > W) left = r.x - tw - 14;
    tip.style.left = Math.max(0, left) + "px";
    tip.style.top = Math.max(0, r.y - 12) + "px";
    tip.classList.add("is-on");
  }

  function pin(r) {
    state.pinned = r;
    draw();
    detail.textContent = "";
    if (!r) { detail.classList.remove("is-on"); return; }
    detail.classList.add("is-on");
    var top = h("div", "atlas-detail-top", detail);
    var meta = h("div", "atlas-detail-meta", top);
    h("span", "px-tag-v is-" + (r.ok ? "success" : "failure"), meta, "Human: " + (r.ok ? "SUCCESS" : "FAILURE"));
    h("span", "px-plat px-plat-" + r.plat.toLowerCase(), meta, r.plat);
    h("span", "px-tag", meta, r.agent);
    h("span", "px-tag", meta, r.len + " steps");
    var close = h("button", "px-link", top, "Close ×");
    close.type = "button";
    close.addEventListener("click", function () { pin(null); canvas.focus(); });
    h("p", "atlas-detail-task", detail, r.task);
    barcode(detail, r.code, true);

    var mix = {};
    for (var i = 0; i < r.code.length; i++) mix[r.code[i]] = (mix[r.code[i]] || 0) + 1;
    var mixRow = h("div", "atlas-mix", detail);
    KIND_ORDER.forEach(function (k) {
      if (!mix[k]) return;
      var it = h("span", "atlas-kind", mixRow);
      h("i", "px-k-" + k, it);
      h("span", null, it, KINDS[k] + " " + mix[k]);
    });

    var acts = h("div", "atlas-detail-acts", detail);
    if (r._case) {
      var open = h("button", "px-pill px-pill-gold", acts, "Open in the case player →");
      open.type = "button";
      open.addEventListener("click", function () { window.OSRewardPlayer.open(r.id); });
    } else {
      var a = h("a", "px-pill", acts, "Screenshots and reasoning in the released dataset ↗");
      a.href = DATASET_URL;
      a.target = "_blank";
      a.rel = "noopener";
    }
    h("code", "atlas-id", acts, r.id);
  }

  canvas.addEventListener("pointermove", function (ev) {
    var p = local(ev);
    var r = hit(p.x, p.y);
    if (r !== state.hover) {
      state.hover = r;
      canvas.style.cursor = r ? "pointer" : "default";
      showTip(r);
      draw();
    }
  });
  canvas.addEventListener("pointerleave", function () {
    state.hover = null;
    showTip(null);
    draw();
  });
  canvas.addEventListener("click", function (ev) {
    var p = local(ev);
    var r = hit(p.x, p.y);
    if (r && r._case && state.pinned === r) { window.OSRewardPlayer.open(r.id); return; }
    pin(r);
  });
  /* keyboard: arrow keys walk the grid in reading order */
  canvas.addEventListener("keydown", function (ev) {
    var order = [];
    groups.forEach(function (g) { order = order.concat(g.list); });
    var i = state.pinned ? order.indexOf(state.pinned) : -1;
    var step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 10, ArrowUp: -10 }[ev.key];
    if (step) {
      ev.preventDefault();
      i = Math.max(0, Math.min(order.length - 1, i + step));
      pin(order[i]);
    } else if (ev.key === "Enter" && state.pinned && state.pinned._case) {
      window.OSRewardPlayer.open(state.pinned.id);
    } else if (ev.key === "Escape") pin(null);
  });

  var qTimer = null;
  input.addEventListener("input", function () {
    clearTimeout(qTimer);
    qTimer = setTimeout(function () {
      state.query = input.value.trim().toLowerCase();
      updateCount();
      draw();
    }, 90);
  });
  function updateCount() {
    var n = state.query ? rows.filter(matches).length : rows.length;
    count.textContent = state.query ? n + " of " + rows.length + " match" : rows.length + " trajectories · " +
      rows.reduce(function (s, r) { return s + r.len; }, 0).toLocaleString() + " steps";
  }

  /* theme flips repaint the canvas from the new tokens */
  new MutationObserver(function () { readPalette(); draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  var lastW = 0;
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      if (Math.abs(canvasWrap.clientWidth - lastW) < 2) return;
      lastW = canvasWrap.clientWidth;
      layout(false);
    }).observe(canvasWrap);
  }

  function init() {
    rows.forEach(function (r) { r._case = isCase(r); });
    readPalette();
    renderLegend();
    updateCount();
    lastW = canvasWrap.clientWidth;
    measure();
    layout(false);
    /* first paint: cells drop into place once the atlas scrolls into view */
    if (!REDUCED && "IntersectionObserver" in window) {
      rows.forEach(function (r) { r.y = r.ty - 40 - Math.random() * 60; });
      draw();
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        layout(true);
      }, { threshold: 0.2 });
      io.observe(canvasWrap);
    }
  }
  init();
})();
