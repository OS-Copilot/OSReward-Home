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

  /* ----------------------------------------------------- 6.5 case studies */
  /* One case at a time, following the paper site's Data Viewer grammar:
     instruction, trajectory, human verdict and expandable judge readings.
     Cards load WebP previews; the lightbox uses untouched source frames. */
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

    function verdictTag(parent, verdict) {
      return h("span", "viewer-tag viewer-tag-" + verdict, parent, verdict);
    }

    function shownJudgeSummary(judges) {
      var shown = Array.isArray(judges) ? judges : [];
      var total = shown.length;
      var successes = shown.filter(function (judge) {
        return judge.verdict === "success";
      }).length;
      var failures = shown.filter(function (judge) {
        return judge.verdict === "failure";
      }).length;

      if (!total) return "Shown model responses: none";
      if (successes === total) return "Shown model responses: " + successes + "/" + total + " SUCCESS";
      if (failures === total) return "Shown model responses: " + failures + "/" + total + " FAIL";
      return "Shown model responses: " + successes + " SUCCESS / " + failures + " FAIL";
    }

    var MODEL_DISPLAY_NAMES = {
      "gpt-5.5": "GPT-5.5",
      "gpt-5.4": "GPT-5.4",
      "gpt-5.4-mini": "GPT-5.4-mini",
      "gpt-5-mini": "GPT-5-mini",
      "gemini-3-flash": "Gemini-3-Flash",
      "gemini-3-flash-preview": "Gemini-3-Flash",
      "gemini-3.5-flash": "Gemini-3.5-Flash",
      "gemini-3.1-pro-preview": "Gemini-3.1-Pro-Preview",
      "claude-opus-4-6": "Claude-Opus-4-6",
      "claude-sonnet-4-6": "Claude-Sonnet-4-6",
      "claude-haiku-4-5": "Claude-Haiku-4-5",
      "claude-haiku-4-5-20251001": "Claude-Haiku-4-5",
      "qwen3.5-397b": "Qwen3.5-397B",
      "qwen3.5-397b-a17b": "Qwen3.5-397B-A17B",
      "qwen3-vl-8b-instruct": "Qwen3-VL-8B-Instruct"
    };

    function displayModelName(name) {
      var raw = String(name || "Unknown model");
      return MODEL_DISPLAY_NAMES[raw.toLowerCase()] || raw;
    }

    function markerTypes(step) {
      return (step.markers || []).map(function (marker) { return marker.type; });
    }

    function thoughtSummary(thought) {
      var clean = String(thought || "").replace(/\s+/g, " ").trim();
      return clean.length > 94 ? clean.slice(0, 91) + "…" : clean;
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
    var caseType = h("span", "viewer-case-type", meta);

    var pager = h("div", "viewer-pager", bar);
    var nextCase = h("button", "viewer-nav", pager, "Next case →");
    nextCase.type = "button";
    nextCase.setAttribute("aria-label", "Show the next case");
    var caseStatus = h("span", "sr-only", pager);
    caseStatus.setAttribute("aria-live", "polite");
    caseStatus.setAttribute("aria-atomic", "true");

    var stage = h("div", null, host);

    var lightbox = h("div", "viewer-lightbox", document.body);
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-labelledby", "viewer-lightbox-caption");
    var lightboxBar = h("div", "viewer-lightbox-bar", lightbox);
    var lightboxCaption = h("span", null, lightboxBar);
    lightboxCaption.id = "viewer-lightbox-caption";
    var lightboxActions = h("div", null, lightboxBar);
    var lightboxOriginal = h("a", "viewer-lightbox-link", lightboxActions, "Open original");
    lightboxOriginal.target = "_blank";
    lightboxOriginal.rel = "noopener";
    var lightboxClose = h("button", "viewer-lightbox-close", lightboxActions, "Close ×");
    lightboxClose.type = "button";
    var lightboxImage = document.createElement("img");
    lightboxImage.className = "viewer-lightbox-image";
    lightboxImage.alt = "";
    lightbox.appendChild(lightboxImage);
    var lightboxReturnFocus = null;

    function closeLightbox() {
      lightbox.hidden = true;
      lightboxImage.removeAttribute("src");
      lightboxImage.alt = "";
      document.body.classList.remove("viewer-modal-open");
      if (lightboxReturnFocus && document.contains(lightboxReturnFocus)) {
        lightboxReturnFocus.focus();
      }
      lightboxReturnFocus = null;
    }

    function openLightbox(step, opener) {
      lightboxReturnFocus = opener;
      lightboxCaption.textContent = "Step " + step.number + " · " + step.caption;
      lightboxImage.src = step.shot;
      lightboxImage.alt = "Full-resolution trajectory screenshot at step " + step.number +
        ": " + step.caption;
      lightboxOriginal.href = step.shot;
      lightbox.hidden = false;
      document.body.classList.add("viewer-modal-open");
      lightboxClose.focus();
    }

    lightboxClose.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (event) {
      if (lightbox.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key !== "Tab") return;
      var first = lightboxOriginal;
      var last = lightboxClose;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    function render() {
      var e = EX[idx];
      stage.textContent = "";
      platform.textContent = e.platform;
      caseType.textContent = e.caseType;
      nextCase.disabled = EX.length < 2;

      h("span", "viewer-k", stage, "Instruction");
      h("p", "viewer-task", stage, e.instruction);

      var trajectoryHead = h("div", "viewer-trajectory-head", stage);
      h("span", "viewer-k", trajectoryHead, "Trajectory · " + e.steps.length + " selected states");
      var legend = h("div", "viewer-legend", trajectoryHead);
      [["focus", "Focus"], ["evidence", "Evidence"], ["verification", "Verification"]].forEach(function (item) {
        var key = h("span", "viewer-legend-item viewer-legend-" + item[0], legend);
        h("i", null, key);
        h("span", null, key, item[1]);
      });

      var strip = h("div", "viewer-strip", stage);
      var previousNumber = null;
      e.steps.forEach(function (s, n) {
        if (previousNumber !== null && s.number > previousNumber + 1) {
          var gap = h("div", "viewer-gap-card", strip);
          h("strong", null, gap, "…");
          h("span", null, gap, (s.number - previousNumber - 1) + " state" +
            (s.number - previousNumber - 1 === 1 ? "" : "s") + " omitted");
        }
        previousNumber = s.number;

        var types = markerTypes(s);
        var card = h("article", "viewer-step" + types.map(function (type) {
          return " is-" + type;
        }).join(""), strip);

        var stepHead = h("div", "viewer-step-head", card);
        h("span", "viewer-step-number", stepHead, "Step " + s.number);
        if (s.markers && s.markers.length) {
          var badges = h("span", "viewer-step-badges", stepHead);
          s.markers.forEach(function (marker) {
            h("span", "viewer-marker viewer-marker-" + marker.type, badges, marker.label);
          });
        }

        var shotButton = h("button", "viewer-step-shot-button", card);
        shotButton.type = "button";
        shotButton.setAttribute("aria-label", "Open screenshot for step " + s.number + " at full resolution");
        var image = document.createElement("img");
        image.className = "viewer-shot";
        image.src = s.thumb || s.shot;
        image.alt = "Trajectory screenshot at step " + s.number + ": " + s.caption;
        image.loading = n < 3 ? "eager" : "lazy";
        image.decoding = "async";
        shotButton.appendChild(image);
        shotButton.addEventListener("click", function () { openLightbox(s, shotButton); });

        h("strong", "viewer-step-caption", card, s.caption);

        var action = h("div", "viewer-step-field viewer-action", card);
        h("span", null, action, "Action");
        h("code", null, action, s.action || "No action recorded");

        var thought = h("details", "viewer-thought", card);
        var thoughtHead = h("summary", null, thought);
        h("span", null, thoughtHead, "Thought");
        h("em", null, thoughtHead, thoughtSummary(s.thought));
        h("p", null, thought, s.thought || "No thought recorded");

        if (s.actionRaw && s.actionRaw.trim() !== String(s.action || "").trim()) {
          var raw = h("details", "viewer-raw-action", card);
          h("summary", null, raw, "Raw tool call");
          h("pre", null, raw, s.actionRaw);
        }
      });

      /* Preserve the latest site's reveal-on-click reading flow: the human
         verdict, analysis and model responses appear only after the reader
         has inspected the trajectory. Paging resets the reveal. */
      var answerId = "viewer-answer-" + idx;
      var btn = h("button", "viewer-reveal", stage, "Did it succeed? Reveal the verdict");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", answerId);

      var panel = h("div", "viewer-answer", stage);
      panel.id = answerId;
      panel.hidden = true;

      var outcome = h("section", "viewer-verdict-block", panel);
      h("span", "viewer-k", outcome, "Human verdict");
      var verdictRow = h("div", "viewer-outcome-row", outcome);
      verdictTag(verdictRow, e.gold);
      h("span", "viewer-tendency", verdictRow,
        e.judgeFieldSummary || shownJudgeSummary(e.judges));
      h("p", "viewer-gold-why", outcome, e.goldWhy);

      var reason = h("div", "viewer-reason-strip", panel);
      h("span", "viewer-k", reason, e.reasonLabel);
      h("p", null, reason, e.reason);

      var account = h("section", "viewer-account", panel);
      h("span", "viewer-k", account, "Agent outcome summary");
      h("p", null, account, e.agentAccount);

      var readings = h("section", "viewer-readings", panel);
      h("span", "viewer-k", readings, "Model judge responses");
      h("p", "viewer-judge-note", readings,
        "Select a model to read its unedited response from the evaluation record.");
      var jr = h("div", "viewer-judges", readings);
      e.judges.forEach(function (j) {
        var row = h("details", "viewer-judge" + (j.correct ? "" : " wrong"), jr);
        var judgeHead = h("summary", "viewer-judge-head", row);
        var identity = h("span", "viewer-judge-identity", judgeHead);
        h("span", "jn", identity, displayModelName(j.name));
        if (j.context) h("small", null, identity, j.context);
        h("span", "jv viewer-tag viewer-tag-" + j.verdict, judgeHead, j.verdict);
        h("span", "jm", judgeHead, j.correct ? "matches human" : "disagrees");
        h("span", "viewer-judge-chevron", judgeHead, "⌄");
        h("pre", "viewer-judge-response", row, j.response || j.reason);
      });

      requestAnimationFrame(function () {
        strip.scrollLeft = 0;
      });

      btn.addEventListener("click", function () {
        panel.hidden = false;
        panel.tabIndex = -1;
        btn.setAttribute("aria-expanded", "true");
        btn.remove();
        panel.focus();
      });
    }

    nextCase.addEventListener("click", function () {
      if (EX.length < 2) return;
      idx = (idx + 1) % EX.length;
      render();
      caseStatus.textContent = "Loaded the next case: " + EX[idx].caseType + " on " + EX[idx].platform + ".";
    });
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
