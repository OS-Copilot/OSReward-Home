/* ==========================================================================
   OSReward — pipeline demo (#pipeline-demo)
   Arms the static walkthrough in the benchmark section: draws the wire layer
   between nodes, steps the narration, and wires the controls. All colour
   stays on CSS variables, so a theme flip repaints for free. Without this
   script the block reads top-to-bottom as a plain diagram plus a list.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stackedMq = window.matchMedia("(max-width: 940px)");

  /* Wires between nodes. `step` is the moment a wire first lights up; kinds:
     h  = left-to-right (smooth S when the rows are offset)
     v  = straight down
     vh = down, then across into the target's left edge
     hv = across, then up into the target's bottom edge
     return = the carriage return from row 1's end to row 2's start */
  var WIRES = [
    { from: "dn-env",    to: "dn-setup",  step: 2,  kind: "h" },
    { from: "dn-setup",  to: "dn-instr",  step: 3,  kind: "h" },
    { from: "dn-instr",  to: "dn-agents", step: 4,  kind: "h" },
    { from: "dn-agents", to: "dn-raw",    step: 5,  kind: "h" },
    { from: "dn-raw",    to: "dn-filter", step: 6,  kind: "return", label: "to annotation" },
    { from: "dn-filter", to: "d-tray",    step: 6,  kind: "v", cls: "drop" },
    { from: "dn-filter", to: "dn-annot",  step: 7,  kind: "h" },
    { from: "dn-annot",  to: "dn-gold",   step: 8,  kind: "h", label: "all agree" },
    { from: "dn-annot",  to: "dn-meta",   step: 8,  kind: "vh", label: "disagree" },
    { from: "dn-meta",   to: "dn-gold",   step: 9,  kind: "hv", label: "verified" },
    { from: "dn-gold",   to: "dn-hard",   step: 11, kind: "h" },
    { from: "dn-gold",   to: "dn-multi",  step: 12, kind: "vh", label: "all-success" }
  ];
  var R = 10;               /* elbow radius */
  var PLAY_MS = 4200;

  var card, stage, grid, svg, items, dots, prevBtn, nextBtn, playBtn, countEl;
  var wires = [];           /* WIRES + live {g} refs */
  var cur = 1, N = 0, timer = null, raf = null;

  function rectOf(el) {
    var a = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return {
      l: a.left - s.left, r: a.right - s.left,
      t: a.top - s.top, b: a.bottom - s.top,
      cx: a.left - s.left + a.width / 2,
      cy: a.top - s.top + a.height / 2
    };
  }

  function el(name, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* A small filled triangle at (x, y) pointing right / left / up / down. */
  function head(x, y, dir) {
    var d = { right: "M0 0L-7 -3.5L-7 3.5Z", left: "M0 0L7 -3.5L7 3.5Z",
              down: "M0 0L-3.5 -7L3.5 -7Z", up: "M0 0L-3.5 7L3.5 7Z" }[dir];
    return el("path", { "class": "arrow", d: d, transform: "translate(" + x + " " + y + ")" });
  }

  function geom(w) {
    var f = rectOf(document.getElementById(w.from));
    var t = rectOf(document.getElementById(w.to));
    var d, ax, ay, dir, lx, ly;
    if (w.kind === "h") {
      var mx = (f.r + t.l) / 2;
      d = "M" + f.r + " " + f.cy + "C" + mx + " " + f.cy + " " + mx + " " + t.cy + " " + (t.l - 7) + " " + t.cy;
      ax = t.l; ay = t.cy; dir = "right";
      lx = mx; ly = Math.min(f.cy, t.cy) - 7;
    } else if (w.kind === "v") {
      d = "M" + f.cx + " " + f.b + "L" + f.cx + " " + (t.t - 7);
      ax = f.cx; ay = t.t; dir = "down";
      lx = f.cx; ly = (f.b + t.t) / 2;
    } else if (w.kind === "vh") {
      d = "M" + f.cx + " " + f.b +
          "L" + f.cx + " " + (t.cy - R) +
          "Q" + f.cx + " " + t.cy + " " + (f.cx + R) + " " + t.cy +
          "L" + (t.l - 7) + " " + t.cy;
      ax = t.l; ay = t.cy; dir = "right";
      lx = (f.cx + t.l) / 2; ly = t.cy - 7;
    } else if (w.kind === "hv") {
      d = "M" + f.r + " " + f.cy +
          "L" + (t.cx - R) + " " + f.cy +
          "Q" + t.cx + " " + f.cy + " " + t.cx + " " + (f.cy - R) +
          "L" + t.cx + " " + (t.b + 7);
      ax = t.cx; ay = t.b; dir = "up";
      lx = (f.r + t.cx) / 2; ly = f.cy - 7;
    } else { /* return */
      var g = (f.b + t.t) / 2;
      d = "M" + f.cx + " " + f.b +
          "L" + f.cx + " " + (g - R) +
          "Q" + f.cx + " " + g + " " + (f.cx - R) + " " + g +
          "L" + (t.cx + R) + " " + g +
          "Q" + t.cx + " " + g + " " + t.cx + " " + (g + R) +
          "L" + t.cx + " " + (t.t - 7);
      ax = t.cx; ay = t.t; dir = "down";
      lx = (f.cx + t.cx) / 2; ly = g - 7;
    }
    return { d: d, ax: ax, ay: ay, dir: dir, lx: lx, ly: ly };
  }

  function build() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (stackedMq.matches || !grid.offsetWidth) return;
    var box = stage.getBoundingClientRect();
    svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
    wires.forEach(function (w) {
      var g = el("g", { "class": "wire" + (w.cls ? " " + w.cls : "") });
      var m = geom(w);
      g.appendChild(el("path", { d: m.d }));
      g.appendChild(head(m.ax, m.ay, m.dir));
      if (w.label) {
        var tx = el("text", { x: m.lx, y: m.ly });
        tx.textContent = w.label;
        g.appendChild(tx);
      }
      svg.appendChild(g);
      w.g = g;
    });
    applyState();
  }

  function applyState() {
    var focus = (items[cur - 1].getAttribute("data-node") || "").split(/\s+/);
    Array.prototype.forEach.call(grid.children, function (n) {
      var on = focus.indexOf(n.id) !== -1;
      var past = !on && +(n.getAttribute("data-step") || 99) < cur;
      n.classList.toggle("on", on);
      n.classList.toggle("past", past);
      if (on) n.setAttribute("aria-current", "step");
      else n.removeAttribute("aria-current");
    });
    wires.forEach(function (w) {
      if (!w.g) return;
      w.g.classList.toggle("on", w.step <= cur);
      w.g.classList.toggle("now", w.step === cur);
    });
    items.forEach(function (li, i) { li.classList.toggle("on", i === cur - 1); });
    Array.prototype.forEach.call(dots.children, function (li, i) {
      var b = li.firstChild;
      if (i === cur - 1) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    countEl.textContent = cur + " / " + N;
    prevBtn.disabled = cur === 1;
    nextBtn.disabled = cur === N;
  }

  function setStep(k, manual) {
    cur = Math.max(1, Math.min(N, k));
    if (manual) stopPlay();
    applyState();
  }

  function stopPlay() {
    if (timer) { clearInterval(timer); timer = null; }
    playBtn.setAttribute("aria-pressed", "false");
    playBtn.setAttribute("aria-label", "Play the walkthrough");
  }

  function startPlay() {
    if (cur === N) { cur = 1; applyState(); }
    timer = setInterval(function () {
      if (cur < N) { cur += 1; applyState(); }
      if (cur === N) stopPlay();
    }, PLAY_MS);
    playBtn.setAttribute("aria-pressed", "true");
    playBtn.setAttribute("aria-label", "Pause the walkthrough");
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = null; build(); });
  }

  function init() {
    card = document.getElementById("pipeline-demo");
    if (!card) return;
    stage = card.querySelector(".demo-stage");
    grid = card.querySelector(".demo-grid");
    svg = card.querySelector(".demo-wires");
    dots = document.getElementById("demoDots");
    prevBtn = document.getElementById("demoPrev");
    nextBtn = document.getElementById("demoNext");
    playBtn = document.getElementById("demoPlay");
    countEl = document.getElementById("demoCount");
    items = Array.prototype.slice.call(card.querySelectorAll(".demo-script > li"));
    N = items.length;
    if (!stage || !svg || !N || !dots) return;
    wires = WIRES.slice();

    items.forEach(function (li, i) {
      var t = li.querySelector("h4");
      var label = t ? t.textContent.replace(/^\s*\d+\s*/, "").trim() : "step";
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Step " + (i + 1) + ": " + label);
      b.addEventListener("click", function () { setStep(i + 1, true); });
      var wrap = document.createElement("li");
      wrap.appendChild(b);
      dots.appendChild(wrap);
    });

    /* Every node is also a jump target — click (or Enter/Space) goes to its
       step. Added only in armed mode so the no-JS page keeps plain divs. */
    Array.prototype.forEach.call(grid.children, function (n) {
      var s = +n.getAttribute("data-step");
      if (!s) return;
      var t = n.querySelector("h4") || n.querySelector(".d-tray-label");
      n.setAttribute("role", "button");
      n.setAttribute("tabindex", "0");
      n.setAttribute("aria-label", "Go to step " + s + (t ? ": " + t.textContent.replace(/^\s*\d+\s*/, "") : ""));
      n.addEventListener("click", function () { setStep(s, true); });
      n.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { setStep(s, true); e.preventDefault(); }
      });
    });

    prevBtn.addEventListener("click", function () { setStep(cur - 1, true); });
    nextBtn.addEventListener("click", function () { setStep(cur + 1, true); });
    if (reduced) {
      playBtn.hidden = true;
    } else {
      playBtn.addEventListener("click", function () {
        if (timer) stopPlay(); else startPlay();
      });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stopPlay();
      });
    }
    card.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowLeft") { setStep(cur - 1, true); e.preventDefault(); }
      if (e.key === "ArrowRight") { setStep(cur + 1, true); e.preventDefault(); }
    });

    card.setAttribute("data-live", "");
    card.querySelector(".demo-script").setAttribute("aria-live", "polite");

    if ("ResizeObserver" in window) {
      new ResizeObserver(schedule).observe(grid);
    } else {
      window.addEventListener("resize", schedule);
    }
    if (stackedMq.addEventListener) stackedMq.addEventListener("change", schedule);
    window.addEventListener("load", schedule);

    build();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
