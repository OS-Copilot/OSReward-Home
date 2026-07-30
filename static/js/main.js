/* ==========================================================================
   OSReward — page behaviour
   Starfield, nav, reveal-on-scroll, copy-to-clipboard, and chart wiring.
   ========================================================================== */
(function () {
  "use strict";

  var D = window.OSRewardData;
  var C = window.OSRewardCharts;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------- 0. theme
     The initial value is set by the inline boot script in <head> so the page
     never flashes the wrong theme. This only handles the toggle afterwards. */
  function theme() {
    var btn = document.getElementById("themeToggle");
    var root = document.documentElement;

    function label() {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      if (btn) btn.setAttribute("aria-label", "Switch to " + next + " theme");
    }
    label();

    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("osreward-theme", next); } catch (e) { /* private mode */ }
      label();
      /* Charts bake a few colours into SVG attributes at draw time, so they
         have to be redrawn rather than restyled. */
      if (C && C.redrawAll) C.redrawAll();
      window.dispatchEvent(new CustomEvent("osreward:theme", { detail: next }));
    });
  }

  /* ---------------------------------------------------------- 1. starfield
     A slow drift of small stars with a few gold ones, echoing the cover.
     Paused when the tab is hidden and skipped entirely under reduced motion. */
  function starfield() {
    var cv = document.getElementById("starfield");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var stars = [], w = 0, h = 0, raf = null, t = 0;

    function build() {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(240, (w * h) / 7000));
      stars = [];
      for (var i = 0; i < n; i++) {
        var gold = Math.random() < 0.22;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * (gold ? 1.5 : 1.1) + 0.25,
          a: Math.random() * 0.55 + 0.12,
          tw: Math.random() * 0.9 + 0.25,
          ph: Math.random() * Math.PI * 2,
          vy: (Math.random() * 0.05 + 0.012),
          gold: gold
        });
      }
    }

    function frame() {
      t += 0.0125;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y -= s.vy;
        if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
        var a = s.a * (0.62 + 0.38 * Math.sin(t * s.tw + s.ph));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fillStyle = s.gold
          ? "rgba(238, 198, 116, " + a.toFixed(3) + ")"
          : "rgba(196, 224, 250, " + (a * 0.85).toFixed(3) + ")";
        ctx.fill();
        if (s.gold && s.r > 1.05) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3.4, 0, 6.2832);
          ctx.fillStyle = "rgba(226, 170, 60, " + (a * 0.07).toFixed(3) + ")";
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) frame(); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    function lightTheme() { return document.documentElement.getAttribute("data-theme") === "light"; }

    build();
    if (reduced) {
      /* one static pass, no animation loop */
      t = 1; ctx.clearRect(0, 0, w, h);
      stars.forEach(function (s) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fillStyle = s.gold ? "rgba(238,198,116,.4)" : "rgba(196,224,250,.32)";
        ctx.fill();
      });
    } else {
      if (!lightTheme()) start();
      document.addEventListener("visibilitychange", function () {
        (document.hidden || lightTheme()) ? stop() : start();
      });
      /* the canvas is hidden in the light theme, so do not burn frames on it */
      window.addEventListener("osreward:theme", function () {
        lightTheme() ? stop() : start();
      });
    }
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { build(); }, 180);
    });
  }

  /* ---------------------------------------------------------------- 2. nav */
  function nav() {
    var el = document.getElementById("nav");
    var toggle = document.getElementById("navToggle");
    var links = document.getElementById("navLinks");
    if (!el) return;

    function onScroll() { el.classList.toggle("stuck", window.scrollY > 40); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (toggle && links) {
      toggle.addEventListener("click", function () {
        var open = links.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      links.addEventListener("click", function (e) {
        if (e.target.tagName === "A") {
          links.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    /* "More research" dropdown: click to open, click-away or Escape to close */
    var more = document.getElementById("navMore");
    if (more) {
      var moreBtn = more.querySelector("button");
      var setOpen = function (v) {
        more.setAttribute("data-open", String(v));
        moreBtn.setAttribute("aria-expanded", String(v));
      };
      moreBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setOpen(more.getAttribute("data-open") !== "true");
      });
      document.addEventListener("click", function (e) {
        if (!more.contains(e.target)) setOpen(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") setOpen(false);
      });
    }

    /* highlight the section in view */
    var ids = ["abstract", "benchmark", "findings", "leaderboard", "shepherd", "viewer", "resources"];
    var map = {};
    ids.forEach(function (id) {
      var a = document.querySelector('.nav-links a[href="#' + id + '"]');
      var s = document.getElementById(id);
      if (a && s) map[id] = { a: a, s: s };
    });
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var m = map[en.target.id];
        if (m && en.isIntersecting) {
          Object.keys(map).forEach(function (k) { map[k].a.classList.remove("active"); });
          m.a.classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (k) { io.observe(map[k].s); });
  }

  /* ------------------------------------------------------------ 3. reveal */
  function reveal() {
    var items = document.querySelectorAll(".rise");
    if (!("IntersectionObserver" in window) || reduced) {
      Array.prototype.forEach.call(items, function (n) { n.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    Array.prototype.forEach.call(items, function (n) { io.observe(n); });
  }

  /* -------------------------------------------------------------- 4. copy */
  function copyBib() {
    var btn = document.getElementById("copyBib");
    var pre = document.getElementById("bibtex");
    if (!btn || !pre) return;
    btn.addEventListener("click", function () {
      var text = pre.textContent;
      var done = function () {
        btn.classList.add("done");
        btn.querySelector("span").textContent = "Copied";
        setTimeout(function () {
          btn.classList.remove("done");
          btn.querySelector("span").textContent = "Copy";
        }, 1800);
      };
      var legacy = function () {
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* noop */ }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && window.isSecureContext) {
        /* the async API rejects without transient user activation or when the
           permission is denied — fall back rather than fail silently */
        navigator.clipboard.writeText(text).then(done, legacy);
      } else {
        legacy();
      }
    });
  }

  /* -------------------------------------------------------- 6. side tables */
  function tableMulti() {
    var tb = document.querySelector("#table-multi tbody");
    if (!tb || !D) return;
    var cols = ["align", "effic", "multi", "auc"];
    var best = {};
    cols.forEach(function (c) {
      best[c] = Math.max.apply(null, D.multi.map(function (r) { return r[c]; }));
    });
    D.multi.forEach(function (r) {
      var tr = document.createElement("tr");
      if (r.family === "ours") tr.className = "ours";
      var td = document.createElement("td");
      var cell = document.createElement("div");
      cell.className = "model-cell";
      var im = document.createElement("img");
      im.src = D.logoPath + (D.families[r.family] || {}).logo; im.alt = ""; im.loading = "lazy";
      cell.appendChild(im);
      var nm = document.createElement("span");
      nm.className = "nm"; nm.textContent = r.name;
      cell.appendChild(nm);
      td.appendChild(cell);
      tr.appendChild(td);
      cols.forEach(function (c) {
        var d = document.createElement("td");
        if (r[c] === best[c]) d.className = "best";
        d.textContent = r[c].toFixed(1);
        tr.appendChild(d);
      });
      tb.appendChild(tr);
    });
  }

  function tableTraining() {
    var tb = document.querySelector("#table-training tbody");
    if (!tb || !D) return;
    D.training.forEach(function (r) {
      var tr = document.createElement("tr");
      if (r.role === "ours") tr.className = "ours";
      var td = document.createElement("td");
      td.textContent = r.name;
      if (r.role === "base") td.style.color = "var(--text-faint)";
      tr.appendChild(td);
      r.full.concat(r.hard).forEach(function (v, i) {
        var d = document.createElement("td");
        d.textContent = v.toFixed(1);
        if (i === 3 || i === 7) d.style.borderRight = "1px solid var(--hairline-cool)";
        tr.appendChild(d);
      });
      tb.appendChild(tr);
    });
  }

  /* -------------------------------------------------------- 6.5 dataviewer */
  /* One example at a time out of OSRewardData.viewer, stepped with the pager.
     A step may carry an optional `shot` image path; without one a labelled
     dashed frame is drawn, which is where a real screenshot belongs. The
     placeholder banner is driven by the data, not hardcoded here, so it
     disappears the moment real records land. */
  function dataViewer() {
    var host = document.getElementById("viewer-body");
    if (!host || !D || !D.viewer || !D.viewer.examples || !D.viewer.examples.length) return;
    var EX = D.viewer.examples;
    var idx = 0;

    function h(tag, cls, parent, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined) n.textContent = text;
      if (parent) parent.appendChild(n);
      return n;
    }

    if (D.viewer.placeholder) {
      var warn = h("div", "viewer-warn", host);
      h("b", null, warn, "Placeholder.");
      h("span", null, warn, " These examples exist to build the viewer. The instructions, steps and " +
        "judge verdicts are invented, not drawn from the benchmark. Real records replace them when " +
        "the export lands.");
    }

    var bar = h("div", "viewer-bar", host);
    var meta = h("div", "viewer-meta", bar);
    var platform = h("span", "viewer-plat", meta);
    var ident = h("span", "viewer-id", meta);

    var pager = h("div", "viewer-pager", bar);
    var prev = h("button", "viewer-nav", pager, "‹ Prev");
    prev.type = "button";
    var count = h("span", "viewer-count", pager);
    var next = h("button", "viewer-nav", pager, "Next ›");
    next.type = "button";

    var stage = h("div", null, host);

    function render() {
      var e = EX[idx];
      stage.textContent = "";
      platform.textContent = e.platform;
      ident.textContent = e.id;
      count.textContent = (idx + 1) + " / " + EX.length;
      prev.disabled = idx === 0;
      next.disabled = idx === EX.length - 1;

      h("span", "viewer-k", stage, "Instruction");
      h("p", "viewer-task", stage, e.instruction);

      h("span", "viewer-k", stage, "Trajectory · " + e.steps.length + " steps");
      var strip = h("div", "viewer-strip", stage);
      e.steps.forEach(function (s, n) {
        var card = h("div", "viewer-step", strip);
        h("div", "viewer-step-n", card, "Step " + (n + 1));
        if (s.shot) {
          var im = document.createElement("img");
          im.src = s.shot; im.alt = ""; im.loading = "lazy";
          im.className = "viewer-shot";
          card.appendChild(im);
        } else {
          var ph = h("div", "viewer-shot viewer-shot-empty", card);
          h("span", null, ph, "screenshot");
        }
        h("code", "viewer-act", card, s.action);
        h("p", "viewer-thought", card, s.thought);
      });

      /* The verdict stays hidden until asked for. A reader who sees "FAILURE"
         before reading the steps never forms their own call, which is the one
         thing this section is for (Qiushi, 2026-07-30). Rebuilt on every
         render, so paging to another example hides the answer again. */
      var answerId = "viewer-answer-" + idx;
      var btn = h("button", "viewer-reveal", stage, "Did it succeed? Reveal the verdict");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", answerId);

      var panel = h("div", "viewer-answer", stage);
      panel.id = answerId;
      panel.hidden = true;

      h("span", "viewer-k", panel, "Human verdict");
      var vr = h("div", "viewer-verdict", panel);
      h("span", "viewer-tag viewer-tag-" + e.gold, vr, e.gold);
      h("p", "viewer-why", vr, e.goldWhy);

      h("span", "viewer-k", panel, "What the judges called it");
      var jr = h("div", "viewer-judges", panel);
      e.judges.forEach(function (j) {
        var row = h("div", "viewer-judge" + (j.correct ? "" : " wrong"), jr);
        row.title = j.correct ? "matches the human verdict" : "disagrees with the human verdict";
        h("span", "jn", row, j.name);
        h("span", "jv", row, j.verdict);
        h("span", "jm", row, j.correct ? "✓" : "✗");
      });

      btn.addEventListener("click", function () {
        panel.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        btn.remove();
      });
    }

    prev.addEventListener("click", function () { if (idx > 0) { idx--; render(); } });
    next.addEventListener("click", function () { if (idx < EX.length - 1) { idx++; render(); } });
    render();
  }

  /* ------------------------------------------------------------- 7. charts */
  function charts() {
    if (!C || !D) return;

    C.biasPlane("#chart-bias", { set: "full" });

    C.leaderboard("#table-leaderboard", { set: "full", maxHeight: 620 });

    if (D.paretoPoints && D.paretoPoints.length) {
      C.pareto("#chart-pareto", { metric: "hard", data: D.paretoPoints });
    } else {
      var pn = document.getElementById("chart-pareto");
      if (pn) {
        pn.innerHTML = '<p style="color:var(--text-faint);font-size:14px;padding:24px 0">' +
          "Cost figures are being finalized; this chart appears once they land.</p>";
      }
    }

    C.composition("#chart-composition");

    C.donut("#chart-platform", {
      data: D.benchmark.platforms,
      centerTop: "1,019", centerSub: "trajectories",
      aria: "Platform mix of the OSReward benchmark"
    });

    if (D.failureModes) C.failureModes("#chart-failure");

    C.barPair("#chart-hard", {
      groups: [
        { title: "By platform", unit: "Mean per-judge binary accuracy (%)",
          items: D.hardBreakdown.platform, color: "#5aa2f7" },
        { title: "By failure type", unit: "Mean per-judge binary accuracy (%)",
          items: D.hardBreakdown.failure, color: "#b18bf2" }
      ]
    });

    var A = D.ablations;
    C.heatmap("#chart-ablation", {
      cols: A.models.map(function (m, i) {
        return { label: m, logo: D.logoPath + (D.families[A.families[i]] || {}).logo };
      }).concat([{ label: "avg" }]),
      rows: A.rows.map(function (r) {
        return { label: r.label, note: r.note, values: r.values.concat([r.avg]) };
      }),
      diverging: true, max: 11, min: -11,
      /* cells at 1 dp, the trailing average column at 2, as in the paper */
      format: function (v, ci, n) {
        var d = (ci === n - 1) ? 2 : 1;
        return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
      },
      unit: " pp",
      labelWidth: 176,
      aria: "Input ablations: change in binary accuracy per setting and model"
    });

    var G = D.generalization;
    C.heatmap("#chart-general", {
      cols: G.benchmarks.concat(["Mean"]).map(function (b) { return { label: b }; }),
      rows: G.rows.map(function (r) {
        return { label: r.name, values: r.v.concat([r.mean]), hi: r.family === "ours",
                 logo: D.logoPath + (D.families[r.family] || {}).logo };
      }),
      min: 62, max: 90, unit: "%", labelWidth: 158,
      format: function (v) { return String(v); },
      aria: "Judge agreement with human-written verifiers on three CUA benchmarks"
    });

    C.groupedBars("#chart-leniency", {
      series: [
        { key: "shep9b", label: "OS-Shepherd-9B", color: "#d9a53a" },
        { key: "shep35b", label: "OS-Shepherd-35B-A3B", color: "#a8741d" },
        { key: "qwen", label: "Qwen judges (median)", color: "#8093a8" }
      ],
      groups: G.leniency.map(function (r) {
        return { label: r.bench, values: { shep9b: r.shep9b, shep35b: r.shep35b, qwen: r.qwen } };
      }),
      max: 1,
      aria: "Fail recall on three benchmarks"
    });

    C.corpusSankey("#chart-corpus-flow");

    /* Corpus donut, built from Table 3 */
    var palette = ["#4f97ee", "#d9a53a", "#e5825f", "#2fbcbc", "#a67ded", "#46c489"];
    C.donut("#chart-corpus", {
      data: D.corpus.platforms.map(function (p, i) {
        return { key: p.key, pct: p.pct, n: p.n, color: palette[i % palette.length] };
      }),
      centerTop: "321K", centerSub: "judge instances",
      max: 300,
      aria: "OS-Shepherd-100K judge-instance pool by platform"
    });
  }

  /* --------------------------------------------------------------- 8. init */
  function init() {
    theme();
    starfield();
    nav();
    reveal();
    copyBib();
    tableMulti();
    tableTraining();
    dataViewer();
    charts();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
