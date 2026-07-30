/* ==========================================================================
   OSReward — interactive figures
   Dependency-free SVG charts. Pair with osreward-data.js and main.css.

     <div id="pareto"></div>
     <script src="osreward-data.js"></script>
     <script src="osreward-charts.js"></script>
     <script>OSRewardCharts.pareto("#pareto", { metric: "hard" });</script>

   Every constructor returns { el, update(opts), destroy() } and re-renders on
   container resize, so labels stay at true size instead of being scaled with
   the SVG. Written to be lifted wholesale into a blog post later.
   ========================================================================== */
(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var D = global.OSRewardData;

  /* Every mounted chart, so a theme switch can redraw the handful of colours
     that have to be baked into SVG attributes rather than inherited from CSS. */
  var REGISTRY = [];
  function register(chart) { if (chart) REGISTRY.push(chart); return chart; }

  var _varCache = {};
  function cssVar(name, fallback) {
    if (name in _varCache) return _varCache[name];
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return (_varCache[name] = v || fallback);
  }

  /* ------------------------------------------------------------- utilities */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function node(sel) { return typeof sel === "string" ? document.querySelector(sel) : sel; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fam(key) { return (D.families[key] || { color: "#8ba4bf", label: key, logo: "" }); }
  function logoSrc(key) { var f = fam(key); return f.logo ? D.logoPath + f.logo : ""; }
  function fmt(v, d) { return v === null || v === undefined || isNaN(v) ? "–" : v.toFixed(d === undefined ? 1 : d); }

  function scaleLinear(d0, d1, r0, r1) {
    var f = function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
    f.invert = function (p) { return d0 + (p - r0) / (r1 - r0) * (d1 - d0); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  }
  function scaleLog(d0, d1, r0, r1) {
    var l0 = Math.log10(d0), l1 = Math.log10(d1);
    var f = function (v) { return r0 + (Math.log10(v) - l0) / (l1 - l0) * (r1 - r0); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  }
  function niceTicks(d0, d1, count) {
    var span = d1 - d0, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], t = Math.ceil(d0 / step) * step;
    for (; t <= d1 + step * 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6);
    return out;
  }

  /* Shared tooltip bound to a positioned container. */
  function Tooltip(host) {
    var t = html("div", "tip", host);
    return {
      show: function (x, y, content) {
        t.innerHTML = content;
        t.style.left = x + "px";
        t.style.top = y + "px";
        t.classList.add("on");
      },
      hide: function () { t.classList.remove("on"); },
      el: t
    };
  }
  function tipBody(title, logo, rows, foot) {
    var h = '<div class="t-name">' + (logo ? '<img src="' + logo + '" alt="">' : "") + title + "</div><dl>";
    rows.forEach(function (r) { h += "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; });
    h += "</dl>";
    if (foot) h += '<div class="t-foot">' + foot + "</div>";
    return h;
  }

  /* Re-render on width change; returns a teardown fn. */
  function responsive(host, draw) {
    var last = 0, ro;
    function run() {
      var w = host.clientWidth;
      if (!w || Math.abs(w - last) < 2) return;
      last = w;
      draw(w);
    }
    if (global.ResizeObserver) { ro = new ResizeObserver(run); ro.observe(host); }
    else { global.addEventListener("resize", run); }
    run();
    return function () { if (ro) ro.disconnect(); else global.removeEventListener("resize", run); };
  }

  /* Text width, measured rather than guessed — label collision handling is
     only as good as the width estimate behind it. */
  var _mctx = null;
  function measureText(text, font) {
    if (!_mctx) _mctx = document.createElement("canvas").getContext("2d");
    _mctx.font = font || '10.5px Inter, -apple-system, sans-serif';
    return _mctx.measureText(text).width;
  }

  /* Greedy scatter labelling. Every point marker is an obstacle, so a label
     never lands on top of a dot; each label tries above, below, right, left
     in turn and is dropped if none is free. Caller supplies priority order. */
  function labelPlacer(obstacles, bounds) {
    var placed = (obstacles || []).slice();
    function free(b) {
      return !placed.some(function (p) {
        return !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1);
      });
    }
    return {
      /* `force` guarantees a label even when every slot is taken — used for
         our own models, which must always be findable in the plot. */
      place: function (cx, cy, w, h, r, prefer, force) {
        var pad = 4;
        var cands = [
          { x: cx, y: cy - r - pad, anchor: "middle" },
          { x: cx, y: cy + r + pad + h * 0.82, anchor: "middle" },
          { x: cx + r + pad + 2, y: cy + h * 0.34, anchor: "start" },
          { x: cx - r - pad - 2, y: cy + h * 0.34, anchor: "end" }
        ];
        if (prefer === "left") cands.unshift(cands.splice(3, 1)[0]);
        if (prefer === "right") cands.unshift(cands.splice(2, 1)[0]);
        var inBounds = null;
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i];
          var x0 = c.anchor === "middle" ? c.x - w / 2 : (c.anchor === "start" ? c.x : c.x - w);
          var box = { x0: x0 - 1, x1: x0 + w + 1, y0: c.y - h * 0.82, y1: c.y + h * 0.24 };
          if (bounds && (box.x0 < bounds.x0 || box.x1 > bounds.x1 ||
                         box.y0 < bounds.y0 || box.y1 > bounds.y1)) continue;
          if (!inBounds) inBounds = { c: c, box: box };
          if (!free(box)) continue;
          placed.push(box);
          return c;
        }
        if (force && inBounds) { placed.push(inBounds.box); return inBounds.c; }
        return null;
      }
    };
  }

  /* Build the standard control strip. spec = [{type,...}] */
  function controls(host, spec) {
    var bar = html("div", "controls", host);
    spec.forEach(function (s) {
      if (s.type === "label") { html("span", "ctl-label", bar, s.text); return; }
      if (s.type === "spacer") { html("span", "spacer", bar); return; }
      if (s.type === "seg") {
        var g = html("div", "seg", bar);
        s.options.forEach(function (o) {
          var b = html("button", null, g, o.label);
          b.type = "button";
          b.setAttribute("aria-pressed", String(o.value === s.value));
          b.addEventListener("click", function () {
            Array.prototype.forEach.call(g.children, function (c) { c.setAttribute("aria-pressed", "false"); });
            b.setAttribute("aria-pressed", "true");
            s.onChange(o.value);
          });
        });
      }
      if (s.type === "chips") {
        var c = html("div", "chips", bar);
        s.options.forEach(function (o) {
          var b = html("button", "chip" + (o.ours ? " chip-ours" : ""), c);
          b.type = "button";
          b.setAttribute("aria-pressed", "true");
          if (o.ours) b.title = "Our models";
          var dot = html("span", "dot", b); dot.style.background = o.color;
          html("span", null, b, o.label);
          b.addEventListener("click", function () {
            var on = b.getAttribute("aria-pressed") === "true";
            b.setAttribute("aria-pressed", String(!on));
            s.onChange(o.value, !on);
          });
        });
      }
      if (s.type === "search") {
        var i = document.createElement("input");
        i.className = "search"; i.type = "search"; i.placeholder = s.placeholder || "Search";
        i.addEventListener("input", function () { s.onChange(i.value); });
        bar.appendChild(i);
      }
    });
    return bar;
  }

  /* ======================================================================
     1. Cost vs. accuracy — paper Figure 2
     ====================================================================== */
  function pareto(sel, opts) {
    opts = opts || {};
    var host = node(sel);
    if (!host) return null;
    host.classList.add("chart-body");
    host.style.position = "relative";

    var state = {
      metric: opts.metric || "hard",
      hidden: {},
      data: (opts.data || D.paretoPoints || []).slice()
    };
    if (!state.data.length) { html("p", "chart-note", host, "Cost data unavailable."); return null; }

    var ctlHost = html("div", null, host);
    host.insertBefore(ctlHost, host.firstChild);
    var famKeys = [];
    state.data.forEach(function (p) { if (famKeys.indexOf(p.family) < 0) famKeys.push(p.family); });

    controls(ctlHost, [
      { type: "label", text: "Accuracy on" },
      { type: "seg", value: state.metric,
        options: [{ label: "OSReward-Hard", value: "hard" }, { label: "OSReward", value: "full" }],
        onChange: function (v) { state.metric = v; render(host.clientWidth); } },
      { type: "spacer" },
      { type: "chips",
        options: famKeys.map(function (k) {
          return { label: fam(k).label, value: k, color: fam(k).color, ours: !!fam(k).ours };
        }),
        onChange: function (k, on) { state.hidden[k] = !on; render(host.clientWidth); } }
    ]);

    var plot = html("div", null, host);
    plot.style.position = "relative";
    var tip = Tooltip(plot);

    function render(w) {
      w = w || host.clientWidth;
      if (!w) return;
      plot.innerHTML = "";
      plot.appendChild(tip.el);

      var narrow = w < 620;
      var h = clamp(Math.round(w * (narrow ? 0.86 : 0.55)), 320, 560);
      var m = { t: 18, r: narrow ? 14 : 24, b: 52, l: 54 };
      var iw = w - m.l - m.r, ih = h - m.t - m.b;

      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h,
        role: "img", "aria-label": "Judge cost against accuracy" }, plot);
      var g = el("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);

      var pts = state.data.filter(function (p) { return !state.hidden[p.family]; });
      var yv = function (p) { return state.metric === "hard" ? p.hard : p.full; };

      var costs = state.data.map(function (p) { return p.cost; });
      var x = scaleLog(Math.min.apply(null, costs) * 0.62, Math.max.apply(null, costs) * 1.5, 0, iw);
      var ys = state.data.map(yv);
      var y0 = Math.floor((Math.min.apply(null, ys) - 3) / 5) * 5;
      var y1 = Math.ceil((Math.max.apply(null, ys) + 3) / 5) * 5;
      var y = scaleLinear(y0, y1, ih, 0);

      /* grid + axes */
      niceTicks(y0, y1, 6).forEach(function (t) {
        el("line", { class: "ax-grid", x1: 0, x2: iw, y1: y(t), y2: y(t) }, g);
        el("text", { class: "ax-tick", x: -10, y: y(t) + 4, "text-anchor": "end" }, g).textContent = t;
      });
      var decades = [];
      for (var d = Math.floor(Math.log10(x.domain[0])); d <= Math.ceil(Math.log10(x.domain[1])); d++) decades.push(d);
      decades.forEach(function (d) {
        for (var k = 1; k <= 9; k++) {
          var v = k * Math.pow(10, d);
          if (v < x.domain[0] || v > x.domain[1]) continue;
          var major = k === 1;
          el("line", { class: "ax-grid" + (major ? "" : " minor"), x1: x(v), x2: x(v), y1: 0, y2: ih }, g);
          if (major || (k === 3 && decades.length < 3)) {
            el("text", { class: "ax-tick", x: x(v), y: ih + 19, "text-anchor": "middle" }, g)
              .textContent = "$" + (v < 1 ? v.toFixed(2).replace(/0$/, "") : v);
          }
        }
      });
      el("line", { class: "ax-line", x1: 0, x2: iw, y1: ih, y2: ih }, g);
      el("line", { class: "ax-line", x1: 0, x2: 0, y1: 0, y2: ih }, g);
      el("text", { class: "ax-title", x: iw / 2, y: ih + 42, "text-anchor": "middle" }, g)
        .textContent = "Judge cost per 1,000 trajectories (USD, log scale)";
      el("text", { class: "ax-title", transform: "translate(" + (-38) + "," + ih / 2 + ") rotate(-90)",
        "text-anchor": "middle" }, g).textContent =
        (state.metric === "hard" ? "OSReward-Hard" : "OSReward") + " binary accuracy (%)";

      /* Pareto frontier over the visible points: cheapest-first, keep points
         that no cheaper point beats on accuracy. */
      var sorted = pts.slice().sort(function (a, b) { return a.cost - b.cost; });
      var front = [], best = -Infinity;
      sorted.forEach(function (p) { if (yv(p) > best) { best = yv(p); front.push(p); } });
      if (front.length > 1) {
        var dstr = front.map(function (p, i) { return (i ? "L" : "M") + x(p.cost) + " " + y(yv(p)); }).join(" ");
        el("path", { d: dstr, fill: "none", stroke: "rgba(216,168,74,.55)", "stroke-width": 1.6,
          "stroke-dasharray": "6 5" }, g);
      }

      /* points, ours last so their halo sits on top */
      var order = pts.slice().sort(function (a, b) { return (a.family === "ours") - (b.family === "ours"); });
      var labelCands = [], obstacles = [];
      order.forEach(function (p) {
        var r0 = p.family === "ours" ? 13 : 5.5;
        var px = x(p.cost), py = y(yv(p));
        obstacles.push({ x0: px - r0, x1: px + r0, y0: py - r0, y1: py + r0 });
      });
      order.forEach(function (p) {
        var cx = x(p.cost), cy = y(yv(p)), c = fam(p.family).color, ours = p.family === "ours";
        if (ours) {
          el("circle", { class: "pt-halo", cx: cx, cy: cy, r: 13, fill: "none",
            stroke: c, "stroke-width": 1, opacity: 0.34 }, g);
          el("circle", { class: "pt-halo", cx: cx, cy: cy, r: 8.5, fill: "none",
            stroke: c, "stroke-width": 1.4, opacity: 0.7 }, g);
        }
        var dot = el("circle", { class: "pt", cx: cx, cy: cy, r: ours ? 6 : 5,
          fill: c, "fill-opacity": ours ? 0.95 : 0.68, stroke: c, "stroke-width": 1.3,
          tabindex: 0, role: "button",
          "aria-label": p.name + ", $" + p.cost + " per 1000, " + yv(p) + " percent" }, g);

        function on() {
          dot.setAttribute("r", (ours ? 8 : 7));
          var box = plot.getBoundingClientRect(), sb = svg.getBoundingClientRect();
          tip.show(sb.left - box.left + m.l + cx, sb.top - box.top + m.t + cy,
            tipBody(p.name, logoSrc(p.family), [
              ["Cost / 1k traj.", "$" + p.cost.toFixed(2)],
              ["OSReward", fmt(p.full) + "%"],
              ["OSReward-Hard", fmt(p.hard) + "%"]
            ], p.access === "ours" ? "Open weights + open data" :
               p.access === "open" ? "Open weights" : "Closed"));
        }
        function off() { dot.setAttribute("r", ours ? 6 : 5); tip.hide(); }
        dot.addEventListener("mouseenter", on);
        dot.addEventListener("mouseleave", off);
        dot.addEventListener("focus", on);
        dot.addEventListener("blur", off);

        if (!narrow) {
          labelCands.push({ p: p, cx: cx, cy: cy, ours: ours, r: ours ? 13 : 5.5 });
        }
      });

      /* label priority: ours, then frontier, then by accuracy */
      labelCands.sort(function (a, b) {
        var ao = a.ours ? 0 : (front.indexOf(a.p) >= 0 ? 1 : 2);
        var bo = b.ours ? 0 : (front.indexOf(b.p) >= 0 ? 1 : 2);
        return ao - bo || yv(b.p) - yv(a.p);
      });
      var LF = '10.5px Inter, -apple-system, sans-serif';
      var LFB = '600 10.5px Inter, -apple-system, sans-serif';
      var placer = labelPlacer(obstacles, { x0: -m.l + 4, x1: iw + m.r - 4, y0: -m.t + 2, y1: ih + 14 });
      labelCands.forEach(function (L) {
        var tw = measureText(L.p.name, L.ours ? LFB : LF);
        var pos = placer.place(L.cx, L.cy, tw, 11, L.r, L.cx > iw * 0.82 ? "left" : null, L.ours);
        if (!pos) return;
        el("text", { class: "pt-label" + (L.ours ? " hi" : ""), x: pos.x, y: pos.y,
          "text-anchor": pos.anchor }, g).textContent = L.p.name;
      });
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function (o) { if (o) Object.assign(state, o); render(); }, destroy: stop });
  }

  /* ======================================================================
     2. Strict–lenient plane — paper Figures 1b and 6
     ====================================================================== */
  function biasPlane(sel, opts) {
    opts = opts || {};
    var host = node(sel);
    if (!host) return null;
    host.classList.add("chart-body");
    host.style.position = "relative";

    var state = { set: opts.set || "full", hidden: {} };
    var ctlHost = html("div", null, host);
    host.insertBefore(ctlHost, host.firstChild);

    var famKeys = [];
    D.judges.forEach(function (j) { if (famKeys.indexOf(j.family) < 0) famKeys.push(j.family); });

    controls(ctlHost, [
      { type: "label", text: "Set" },
      { type: "seg", value: state.set,
        options: [{ label: "OSReward", value: "full" }, { label: "OSReward-Hard", value: "hard" }],
        onChange: function (v) { state.set = v; render(); } },
      { type: "spacer" },
      { type: "chips",
        options: famKeys.map(function (k) {
          return { label: fam(k).label, value: k, color: fam(k).color, ours: !!fam(k).ours };
        }),
        onChange: function (k, on) { state.hidden[k] = !on; render(); } }
    ]);

    var plot = html("div", null, host);
    plot.style.position = "relative";
    var tip = Tooltip(plot);

    function render(w) {
      w = w || host.clientWidth;
      if (!w) return;
      plot.innerHTML = "";
      plot.appendChild(tip.el);

      var narrow = w < 620;
      var h = clamp(Math.round(w * (narrow ? 0.98 : 0.56)), 330, 520);
      var m = { t: 16, r: 18, b: 58, l: 70 };
      var iw = w - m.l - m.r, ih = h - m.t - m.b;

      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h,
        role: "img", "aria-label": "Judge bias: fail recall against success recall" }, plot);
      var g = el("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);

      var pts = D.judges.filter(function (j) { return !state.hidden[j.family]; });
      var xs = pts.map(function (j) { return j[state.set].fRec; });
      var ys = pts.map(function (j) { return j[state.set].sRec; });
      if (!pts.length) return;
      /* Independent x and y ranges, as the paper's panels use: the cloud sits
         in the top-left, so a shared square domain would waste half the plot.
         The sRec = fRec line is still the true y = x line, just not at 45°. */
      var xLo = Math.max(0, Math.floor((Math.min.apply(null, xs) - 5) / 10) * 10);
      var xHi = Math.min(100, Math.ceil((Math.max.apply(null, xs) + 4) / 5) * 5);
      var yLo = Math.max(0, Math.floor((Math.min.apply(null, ys) - 4) / 5) * 5);
      var yHi = Math.min(102, Math.ceil((Math.max.apply(null, ys) + 3) / 5) * 5);
      var x = scaleLinear(xLo, xHi, 0, iw), y = scaleLinear(yLo, yHi, ih, 0);

      niceTicks(yLo, yHi, 6).forEach(function (t) {
        el("line", { class: "ax-grid", x1: 0, x2: iw, y1: y(t), y2: y(t) }, g);
        el("text", { class: "ax-tick", x: -9, y: y(t) + 4, "text-anchor": "end" }, g).textContent = t;
      });
      niceTicks(xLo, xHi, 6).forEach(function (t) {
        el("line", { class: "ax-grid", x1: x(t), x2: x(t), y1: 0, y2: ih }, g);
        el("text", { class: "ax-tick", x: x(t), y: ih + 18, "text-anchor": "middle" }, g).textContent = t;
      });

      /* the balanced diagonal, clipped to whatever part of y = x is in view */
      var dLo = Math.max(xLo, yLo), dHi = Math.min(xHi, yHi);
      if (dHi > dLo) {
        el("line", { class: "ref-line", x1: x(dLo), y1: y(dLo), x2: x(dHi), y2: y(dHi) }, g);
        el("text", { class: "ref-label", x: x(dHi) - 6, y: y(dHi) + 16, "text-anchor": "end" }, g)
          .textContent = "balanced (sRec = fRec)";
      }
      var hi = yHi;
      /* Direction hints live in the axis titles rather than floating in the
         plot, where points and labels kept landing on them. */
      el("line", { class: "ax-line", x1: 0, x2: iw, y1: ih, y2: ih }, g);
      el("line", { class: "ax-line", x1: 0, x2: 0, y1: 0, y2: ih }, g);
      el("text", { class: "ax-title", x: iw / 2, y: ih + 46, "text-anchor": "middle" }, g)
        .textContent = "Recall on GT = FAIL (%)   →   lower is more lenient";
      el("text", { class: "ax-title", transform: "translate(-52," + ih / 2 + ") rotate(-90)",
        "text-anchor": "middle" }, g).textContent = "Recall on GT = SUCCESS (%)   →   lower is stricter";

      var order = pts.slice().sort(function (a, b) { return (a.family === "ours") - (b.family === "ours"); });
      var cands = [], obstacles = [];
      order.forEach(function (j) {
        var r0 = j.family === "ours" ? 12 : 5.2;
        var px = x(j[state.set].fRec), py = y(j[state.set].sRec);
        obstacles.push({ x0: px - r0, x1: px + r0, y0: py - r0, y1: py + r0 });
      });
      order.forEach(function (j) {
        var cx = x(j[state.set].fRec), cy = y(j[state.set].sRec);
        var c = fam(j.family).color, ours = j.family === "ours";
        if (ours) {
          el("circle", { class: "pt-halo", cx: cx, cy: cy, r: 12, fill: "none", stroke: c,
            "stroke-width": 1, opacity: 0.32 }, g);
        }
        var dot = el("circle", { class: "pt", cx: cx, cy: cy, r: ours ? 6 : 4.8, fill: c,
          "fill-opacity": ours ? 0.95 : 0.6, stroke: c, "stroke-width": 1.2, tabindex: 0,
          role: "button", "aria-label": j.name }, g);
        function on() {
          dot.setAttribute("r", ours ? 8 : 6.8);
          var box = plot.getBoundingClientRect(), sb = svg.getBoundingClientRect();
          tip.show(sb.left - box.left + m.l + cx, sb.top - box.top + m.t + cy,
            tipBody(j.name, logoSrc(j.family), [
              ["Success recall", fmt(j[state.set].sRec) + "%"],
              ["Fail recall", fmt(j[state.set].fRec) + "%"],
              ["Binary acc.", fmt(j[state.set].acc) + "%"],
              ["Balanced acc.", fmt(j[state.set].bal) + "%"]
            ], (j[state.set].sRec - j[state.set].fRec > 6) ? "Leans lenient" :
               (j[state.set].fRec - j[state.set].sRec > 6) ? "Leans strict" : "Near balanced"));
        }
        function off() { dot.setAttribute("r", ours ? 6 : 4.8); tip.hide(); }
        dot.addEventListener("mouseenter", on); dot.addEventListener("mouseleave", off);
        dot.addEventListener("focus", on); dot.addEventListener("blur", off);
        if (!narrow) cands.push({ j: j, cx: cx, cy: cy, ours: ours, r: ours ? 12 : 5.2 });
      });
      cands.sort(function (a, b) {
        return (a.ours ? 0 : 1) - (b.ours ? 0 : 1) || b.j[state.set].acc - a.j[state.set].acc;
      });
      var LF = '10.5px Inter, -apple-system, sans-serif';
      var LFB = '600 10.5px Inter, -apple-system, sans-serif';
      /* Reserve the diagonal's caption so no label lands on it. */
      var placer = labelPlacer(obstacles.concat([
        { x0: iw - 150, x1: iw, y0: y(Math.min(xHi, yHi)) + 4, y1: y(Math.min(xHi, yHi)) + 22 }
      ]), { x0: -m.l + 6, x1: iw + m.r - 4, y0: -m.t + 2, y1: ih - 2 });
      cands.forEach(function (L) {
        var tw = measureText(L.j.name, L.ours ? LFB : LF);
        var pos = placer.place(L.cx, L.cy, tw, 11, L.r, L.cx > iw * 0.8 ? "left" : null, L.ours);
        if (!pos) return;
        el("text", { class: "pt-label" + (L.ours ? " hi" : ""), x: pos.x, y: pos.y,
          "text-anchor": pos.anchor }, g).textContent = L.j.name;
      });
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function (o) { if (o) Object.assign(state, o); render(); }, destroy: stop });
  }

  /* ======================================================================
     3. Leaderboard — paper Table 1
     ====================================================================== */
  function leaderboard(sel, opts) {
    opts = opts || {};
    var host = node(sel);
    if (!host) return null;

    var state = { set: opts.set || "full", access: "all", q: "", sort: "acc", dir: -1 };

    controls(host, [
      { type: "label", text: "Set" },
      { type: "seg", value: state.set,
        options: [{ label: "OSReward", value: "full" }, { label: "OSReward-Hard", value: "hard" }],
        onChange: function (v) { state.set = v; draw(); } },
      { type: "label", text: "Access" },
      { type: "seg", value: "all",
        options: [{ label: "All", value: "all" }, { label: "Closed", value: "closed" }, { label: "Open", value: "open" }],
        onChange: function (v) { state.access = v; draw(); } },
      { type: "spacer" },
      { type: "search", placeholder: "Filter judges…", onChange: function (v) { state.q = v.toLowerCase(); draw(); } }
    ]);

    var shell = html("div", "table-shell", host);
    var scroll = html("div", "table-scroll", shell);
    scroll.style.maxHeight = (opts.maxHeight || 560) + "px";
    scroll.style.overflowY = "auto";

    var COLS = [
      { k: "acc",  t: "Acc",    hint: "binary accuracy" },
      { k: "sRec", t: "sRec",   hint: "recall on GT = SUCCESS" },
      { k: "fRec", t: "fRec",   hint: "recall on GT = FAIL" },
      { k: "bal",  t: "BalAcc", hint: "balanced accuracy" }
    ];

    function draw() {
      scroll.innerHTML = "";
      var rows = D.judges.filter(function (j) {
        if (state.access === "closed" && j.access !== "closed") return false;
        if (state.access === "open" && j.access === "closed") return false;
        if (state.q && j.name.toLowerCase().indexOf(state.q) < 0) return false;
        return true;
      });
      rows.sort(function (a, b) {
        if (state.sort === "name") return a.name.localeCompare(b.name) * state.dir * -1;
        var d = (a[state.set][state.sort] - b[state.set][state.sort]) * state.dir;
        if (d) return d;
        /* Ties are common at one decimal place. Break them our way — a reader
           scanning for OS-Shepherd should not find it below a judge it matched. */
        var ao = a.access === "ours" ? 0 : 1, bo = b.access === "ours" ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return 0;
      });

      var best = {};
      COLS.forEach(function (c) {
        best[c.k] = Math.max.apply(null, D.judges.map(function (j) { return j[state.set][c.k]; }));
      });

      var t = html("table", "data", scroll);
      var thead = html("thead", null, t);
      var hr = html("tr", null, thead);
      var thRank = html("th", null, hr, "#");
      thRank.className = "rank";
      thRank.setAttribute("scope", "col");
      var thName = html("th", "sortable", hr);
      thName.setAttribute("scope", "col");
      thName.innerHTML = "Judge<span class='arrow'>▼</span>";
      thName.addEventListener("click", function () { sortBy("name"); });
      html("th", null, hr, "Access").setAttribute("scope", "col");
      COLS.forEach(function (c) {
        var th = html("th", "sortable", hr);
        th.setAttribute("scope", "col");
        th.innerHTML = c.t + "<span class='arrow'>▼</span>";
        th.title = c.hint;
        if (state.sort === c.k) th.setAttribute("aria-sort", state.dir < 0 ? "descending" : "ascending");
        th.addEventListener("click", function () { sortBy(c.k); });
      });

      var tb = html("tbody", null, t);
      rows.forEach(function (j, i) {
        var tr = html("tr", j.access === "ours" ? "ours" : null, tb);
        html("td", "rank", tr, String(i + 1));
        var td = html("td", null, tr);
        var cell = html("div", "model-cell", td);
        var im = document.createElement("img");
        im.src = logoSrc(j.family); im.alt = ""; im.loading = "lazy";
        cell.appendChild(im);
        html("span", "nm", cell, j.name);
        var acc = html("td", null, tr);
        var tag = html("span", "tag " + (j.access === "ours" ? "ours" : j.access), acc,
          j.access === "ours" ? "open + data" : j.access === "open" ? "open weights" : "closed");
        tag.title = j.access === "ours" ? "Open weights and open training data" : "";
        COLS.forEach(function (c) {
          var v = j[state.set][c.k];
          var cd = html("td", v === best[c.k] ? "best" : null, tr);
          var wrap = html("span", "cellbar", cd, fmt(v));
          var bar = document.createElement("i");
          bar.style.transform = "scaleX(" + (v / 100).toFixed(3) + ")";
          wrap.appendChild(bar);
        });
      });

      if (!rows.length) {
        var e = html("div", null, scroll, "No judge matches that filter.");
        e.style.cssText = "padding:30px;text-align:center;color:var(--text-faint)";
      }
    }
    function sortBy(k) {
      if (state.sort === k) state.dir *= -1; else { state.sort = k; state.dir = k === "name" ? 1 : -1; }
      draw();
    }

    draw();
    return register({ el: host, update: function (o) { if (o) Object.assign(state, o); draw(); }, destroy: function () {} });
  }

  /* ======================================================================
     4. Stacked failure-mode composition — paper Figure 7
     ====================================================================== */
  function failureModes(sel, opts) {
    opts = opts || {};
    var host = node(sel);
    if (!host || !D.failureModes) return null;
    host.classList.add("chart-body");
    host.style.position = "relative";
    var tip = Tooltip(host);

    var CATS = D.failureModes.categories;

    function render(w) {
      w = w || host.clientWidth;
      if (!w) return;
      Array.prototype.slice.call(host.children).forEach(function (c) { if (c !== tip.el) c.remove(); });

      var rows = D.failureModes.rows;
      var narrow = w < 620;
      var labelW = narrow ? 108 : 152;
      var m = { t: 8, r: 14, b: 30, l: labelW };
      var rowH = narrow ? 34 : 38, gap = 10;
      var ih = rows.length * (rowH + gap) - gap;
      var h = ih + m.t + m.b;
      var iw = w - m.l - m.r;

      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h,
        role: "img", "aria-label": "Per-judge error composition" }, host);
      var g = el("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);

      [0, 25, 50, 75, 100].forEach(function (t) {
        var px = t / 100 * iw;
        el("line", { class: "ax-grid", x1: px, x2: px, y1: 0, y2: ih }, g);
        el("text", { class: "ax-tick", x: px, y: ih + 18, "text-anchor": "middle" }, g).textContent = t + "%";
      });

      rows.forEach(function (r, i) {
        var yy = i * (rowH + gap);
        var lg = el("g", { transform: "translate(" + (-10) + "," + (yy + rowH / 2) + ")" }, g);
        el("text", { class: "ax-tick", x: 0, y: 4, "text-anchor": "end",
          style: "fill:var(--text-hi);font-size:12.5px" }, lg).textContent = r.name;

        var acc = 0;
        r.values.forEach(function (v, ci) {
          if (v <= 0) { return; }
          var x0 = acc / 100 * iw, wpx = v / 100 * iw;
          acc += v;
          var rect = el("rect", { x: x0, y: yy, width: Math.max(0.6, wpx - 0.8), height: rowH,
            rx: 2, fill: CATS[ci].color, "fill-opacity": 0.86, tabindex: 0, role: "button",
            "aria-label": r.name + ", " + CATS[ci].label + ", " + v + " percent" }, g);
          rect.style.cursor = "pointer";
          function on() {
            rect.setAttribute("fill-opacity", 1);
            var b = host.getBoundingClientRect(), sb = svg.getBoundingClientRect();
            tip.show(sb.left - b.left + m.l + x0 + wpx / 2, sb.top - b.top + m.t + yy,
              tipBody(r.name, logoSrc(r.family), [[CATS[ci].label, v.toFixed(1) + "%"]],
                CATS[ci].group === "accept" ? "Over-accept — a failure scored SUCCESS"
                                            : "Over-reject — a success scored FAIL"));
          }
          function off() { rect.setAttribute("fill-opacity", 0.86); tip.hide(); }
          rect.addEventListener("mouseenter", on); rect.addEventListener("mouseleave", off);
          rect.addEventListener("focus", on); rect.addEventListener("blur", off);
          if (wpx > 32) {
            el("text", { x: x0 + wpx / 2, y: yy + rowH / 2 + 4, "text-anchor": "middle",
              style: "fill:#101822;font-size:11.5px;font-weight:650;pointer-events:none" }, g)
              .textContent = v.toFixed(1) + "%";
          }
        });
      });

      var lg2 = html("div", "legend-row", host);
      CATS.forEach(function (c) {
        var li = html("span", "li", lg2);
        var sw = html("span", "sw", li); sw.style.background = c.color;
        html("span", null, li, c.label);
      });
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function () { render(); }, destroy: stop });
  }

  /* ======================================================================
     5. Paired horizontal bars — paper Figure 8
     ====================================================================== */
  function barPair(sel, opts) {
    opts = opts || {};
    var host = node(sel);
    if (!host) return null;
    host.classList.add("chart-body");
    host.style.position = "relative";
    var tip = Tooltip(host);

    var groups = opts.groups;   /* [{title, unit, items:[{key,n,acc}], color}] */

    function render(w) {
      w = w || host.clientWidth;
      if (!w) return;
      Array.prototype.slice.call(host.children).forEach(function (c) { if (c !== tip.el) c.remove(); });
      var wide = w > 720;
      var grid = html("div", null, host);
      grid.style.cssText = "display:grid;gap:26px;grid-template-columns:" + (wide ? "1fr 1fr" : "1fr");

      groups.forEach(function (grp) {
        var cell = html("div", null, grid);
        var t = html("div", null, cell, grp.title);
        t.style.cssText = "font-size:12.5px;letter-spacing:.09em;text-transform:uppercase;" +
          "color:var(--gold-400);font-weight:600;margin-bottom:12px";
        var cw = wide ? (w - 26) / 2 : w;
        var labelW = 106, rowH = 30, gap = 9;
        var ih = grp.items.length * (rowH + gap) - gap;
        var iw = cw - labelW - 62;   /* room for the value label past the bar */
        var svg = el("svg", { viewBox: "0 0 " + cw + " " + (ih + 26), width: cw, height: ih + 26,
          role: "img", "aria-label": grp.title + ", " + grp.unit }, cell);
        var g = el("g", { transform: "translate(" + labelW + ",0)" }, svg);
        var trackFill = cssVar("--chart-track", "rgba(126,168,214,.07)");
        var max = Math.max.apply(null, grp.items.map(function (d) { return d.acc; }));
        var scale = Math.ceil((max + 6) / 10) * 10;

        [0, scale / 2, scale].forEach(function (tk) {
          var px = tk / scale * iw;
          el("line", { class: "ax-grid", x1: px, x2: px, y1: 0, y2: ih }, g);
          el("text", { class: "ax-tick", x: px, y: ih + 17, "text-anchor": "middle" }, g).textContent = tk;
        });
        el("line", { class: "ref-line", x1: 50 / scale * iw, x2: 50 / scale * iw, y1: 0, y2: ih }, g);

        grp.items.forEach(function (d, i) {
          var yy = i * (rowH + gap);
          var lab = el("text", { class: "ax-tick", x: -12, y: yy + rowH / 2 + 4, "text-anchor": "end",
            style: "fill:var(--text-hi);font-size:12.5px" }, g);
          lab.textContent = d.key;
          var bw = d.acc / scale * iw;
          el("rect", { x: 0, y: yy + 4, width: iw, height: rowH - 8, rx: 4,
            fill: trackFill }, g);
          var barEl = el("rect", { x: 0, y: yy + 4, width: bw, height: rowH - 8, rx: 4,
            fill: grp.color, "fill-opacity": 0.8, tabindex: 0, role: "button",
            "aria-label": d.key + " " + d.acc + " percent, n " + d.n }, g);
          barEl.style.cursor = "pointer";
          (function (dd, rect, yTop) {
            function on() {
              rect.setAttribute("fill-opacity", 1);
              var b = host.getBoundingClientRect(), sb = svg.getBoundingClientRect();
              tip.show(sb.left - b.left + labelW + bw / 2, sb.top - b.top + yTop,
                tipBody(dd.key, "", [["Mean judge accuracy", dd.acc.toFixed(1) + "%"],
                                     ["Trajectories", dd.n]]));
            }
            function off() { rect.setAttribute("fill-opacity", 0.8); tip.hide(); }
            rect.addEventListener("mouseenter", on); rect.addEventListener("mouseleave", off);
            rect.addEventListener("focus", on); rect.addEventListener("blur", off);
          })(d, barEl, yy + 4);
          /* values in a column past the track, so they line up and never sit
             on top of the grey remainder */
          el("text", { x: iw + 10, y: yy + rowH / 2 + 4,
            style: "fill:var(--text-hi);font-size:12px;font-weight:600" }, g)
            .textContent = d.acc.toFixed(1) + "%";
        });
        var cap = html("div", null, cell, grp.unit);
        cap.style.cssText = "font-size:11.5px;color:var(--text-faint);margin-top:6px";
      });
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function () { render(); }, destroy: stop });
  }

  /* ======================================================================
     6. Heatmap — paper Figures 9 and 11
     ====================================================================== */
  function heatmap(sel, opts) {
    var host = node(sel);
    if (!host) return null;
    host.classList.add("chart-body");
    host.style.position = "relative";
    var tip = Tooltip(host);

    var cols = opts.cols, rows = opts.rows;   /* rows: [{label, note, values:[], extra}] */
    var diverging = !!opts.diverging;
    var lo = opts.min, hi = opts.max;

    function color(v) {
      if (diverging) {
        var t = clamp(Math.abs(v) / hi, 0, 1);
        var a = 0.1 + 0.72 * Math.pow(t, 0.72);
        return v < 0 ? "rgba(206,96,84," + a.toFixed(3) + ")" : "rgba(78,196,160," + a.toFixed(3) + ")";
      }
      var t = clamp((v - lo) / (hi - lo), 0, 1);
      /* deep teal -> cyan -> gold */
      var stops = [[18, 62, 92], [26, 122, 150], [72, 186, 190], [214, 176, 92]];
      var seg = clamp(Math.floor(t * 3), 0, 2), f = t * 3 - seg;
      var c = stops[seg].map(function (s, i) { return Math.round(s + (stops[seg + 1][i] - s) * f); });
      return "rgb(" + c.join(",") + ")";
    }

    function render(w) {
      w = w || host.clientWidth;
      if (!w) return;
      Array.prototype.slice.call(host.children).forEach(function (c) { if (c !== tip.el) c.remove(); });
      var narrow = w < 700;
      /* Measure the longest row label instead of trusting a fixed width —
         "OS-Shepherd-35B-A3B" in the bold "ours" weight used to run past it. */
      var longest = 0;
      rows.forEach(function (r) {
        longest = Math.max(longest, measureText(r.label,
          (r.hi ? "650 " : "") + "12.5px Inter, -apple-system, sans-serif"));
        if (r.note) longest = Math.max(longest, measureText(r.note, "10px Inter, -apple-system, sans-serif"));
      });
      var labelW = Math.min(w * 0.42,
        Math.max(narrow ? 110 : (opts.labelWidth || 150), Math.ceil(longest) + 22));
      var m = { t: narrow ? 46 : 34, r: 8, b: 8, l: labelW };
      var iw = w - m.l - m.r;
      var cellW = iw / cols.length;
      var cellH = clamp(cellW * 0.5, 26, 40);
      var ih = rows.length * cellH;
      var h = ih + m.t + m.b;

      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h,
        role: "img", "aria-label": opts.aria || "heatmap" }, host);
      var g = el("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);

      cols.forEach(function (c, ci) {
        var cx = ci * cellW + cellW / 2;
        var tnode = el("text", { class: "ax-tick", x: cx, y: -10, "text-anchor": narrow ? "start" : "middle",
          style: "fill:var(--text-dim);font-size:11px" +
                 (narrow ? ";transform:rotate(-42deg);transform-origin:" + cx + "px -10px" : "") }, g);
        tnode.textContent = c.label !== undefined ? c.label : c;

      });

      rows.forEach(function (r, ri) {
        var yy = ri * cellH;
        var lg = el("g", { transform: "translate(-12," + (yy + cellH / 2) + ")" }, g);
        var lt = el("text", { class: "ax-tick", x: 0, y: r.note ? 0 : 4, "text-anchor": "end",
          style: "fill:" + (r.hi ? "var(--gold-200)" : "var(--text-hi)") +
                 ";font-size:12.5px;font-weight:" + (r.hi ? 650 : 400) }, lg);
        lt.textContent = r.label;
        if (r.note) {
          el("text", { class: "ax-tick", x: 0, y: 13, "text-anchor": "end",
            style: "font-size:10px" }, lg).textContent = r.note;
        }
        r.values.forEach(function (v, ci) {
          var rect = el("rect", { x: ci * cellW + 1, y: yy + 1, width: cellW - 2, height: cellH - 2,
            rx: 3, fill: color(v), tabindex: 0, role: "button",
            "aria-label": r.label + " " + (cols[ci].label || cols[ci]) + " " + v }, g);
          rect.style.cursor = "pointer";
          var txt = el("text", { x: ci * cellW + cellW / 2, y: yy + cellH / 2 + 4, "text-anchor": "middle",
            style: "font-size:11.5px;font-weight:600;pointer-events:none;fill:" +
                   (diverging ? (Math.abs(v) > hi * 0.55 ? "#fff" : "var(--text)")
                              : ((v - lo) / (hi - lo) > 0.62 ? "#0d1220" : "#e7f1fa")) }, g);
          txt.textContent = opts.format ? opts.format(v, ci, cols.length) : v;
          function on() {
            rect.setAttribute("stroke", "var(--gold-300)"); rect.setAttribute("stroke-width", 1.5);
            var b = host.getBoundingClientRect(), sb = svg.getBoundingClientRect();
            tip.show(sb.left - b.left + m.l + ci * cellW + cellW / 2, sb.top - b.top + m.t + yy,
              tipBody(r.label, r.logo || "", [[cols[ci].label || cols[ci],
                (opts.format ? opts.format(v, ci, cols.length) : v) + (opts.unit || "")]],
              r.note || ""));
          }
          function off() { rect.removeAttribute("stroke"); tip.hide(); }
          rect.addEventListener("mouseenter", on); rect.addEventListener("mouseleave", off);
          rect.addEventListener("focus", on); rect.addEventListener("blur", off);
        });
      });

      if (opts.legend !== false) {
        var lgd = html("div", "legend-row", host);
        (diverging
          ? [{ c: "rgba(206,96,84,.78)", l: "accuracy drops" }, { c: "rgba(78,196,160,.78)", l: "accuracy gains" }]
          : [{ c: color(lo), l: (opts.unit === "%" ? lo + "%" : lo) }, { c: color((lo + hi) / 2), l: "" },
             { c: color(hi), l: (opts.unit === "%" ? hi + "%" : hi) }]
        ).forEach(function (s) {
          var li = html("span", "li", lgd);
          var sw = html("span", "sw", li); sw.style.background = s.c;
          if (s.l) html("span", null, li, s.l);
        });
      }
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function () { render(); }, destroy: stop });
  }

  /* ======================================================================
     7. Donut — paper Figure 5 platform mix
     ====================================================================== */
  function donut(sel, opts) {
    var host = node(sel);
    if (!host) return null;
    host.classList.add("chart-body");
    host.style.position = "relative";
    var tip = Tooltip(host);
    var data = opts.data, centerTop = opts.centerTop, centerSub = opts.centerSub;

    function render(w) {
      w = w || host.clientWidth;
      if (!w) return;
      Array.prototype.slice.call(host.children).forEach(function (c) { if (c !== tip.el) c.remove(); });
      var size = clamp(w, 200, opts.max || 320);
      var R = size / 2 - 6, r = R * 0.58, cx = size / 2, cy = size / 2;
      var svg = el("svg", { viewBox: "0 0 " + size + " " + size, width: size, height: size,
        role: "img", "aria-label": opts.aria || "composition" }, host);
      /* inline width beats `.chart-body svg { width: 100% }`, which would
         otherwise stretch the donut past its card */
      svg.style.cssText = "display:block;margin:0 auto;width:" + size + "px;height:" + size + "px";
      var seam = cssVar("--bg", "#02091a");
      var total = data.reduce(function (s, d) { return s + d.pct; }, 0);
      var a0 = -Math.PI / 2;
      data.forEach(function (d) {
        var a1 = a0 + d.pct / total * Math.PI * 2;
        var large = (a1 - a0) > Math.PI ? 1 : 0;
        var p = ["M", cx + R * Math.cos(a0), cy + R * Math.sin(a0),
                 "A", R, R, 0, large, 1, cx + R * Math.cos(a1), cy + R * Math.sin(a1),
                 "L", cx + r * Math.cos(a1), cy + r * Math.sin(a1),
                 "A", r, r, 0, large, 0, cx + r * Math.cos(a0), cy + r * Math.sin(a0), "Z"].join(" ");
        var path = el("path", { d: p, fill: d.color, "fill-opacity": 0.82, stroke: seam,
          "stroke-width": 1.5, tabindex: 0, role: "button",
          "aria-label": d.key + " " + d.pct + " percent" }, svg);
        path.style.cursor = "pointer";
        var mid = (a0 + a1) / 2;
        function on() {
          path.setAttribute("fill-opacity", 1);
          var b = host.getBoundingClientRect(), sb = svg.getBoundingClientRect();
          tip.show(sb.left - b.left + cx + (R + r) / 2 * Math.cos(mid),
                   sb.top - b.top + cy + (R + r) / 2 * Math.sin(mid),
                   tipBody(d.key, "", [["Share", d.pct + "%"]].concat(d.n ? [["Count", d.n.toLocaleString()]] : [])));
        }
        function off() { path.setAttribute("fill-opacity", 0.82); tip.hide(); }
        path.addEventListener("mouseenter", on); path.addEventListener("mouseleave", off);
        path.addEventListener("focus", on); path.addEventListener("blur", off);
        if (d.pct >= 9) {
          el("text", { x: cx + (R + r) / 2 * Math.cos(mid), y: cy + (R + r) / 2 * Math.sin(mid) + 4,
            "text-anchor": "middle", style: "fill:#101822;font-size:12px;font-weight:700;pointer-events:none" }, svg)
            .textContent = d.pct + "%";
        }
        a0 = a1;
      });
      if (centerTop) {
        el("text", { x: cx, y: cy - 2, "text-anchor": "middle",
          style: "fill:var(--gold-200);font-size:22px;font-weight:600;font-family:var(--font-display)" }, svg)
          .textContent = centerTop;
        el("text", { x: cx, y: cy + 16, "text-anchor": "middle",
          style: "fill:var(--text-faint);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase" }, svg)
          .textContent = centerSub || "";
      }
      var lgd = html("div", "legend-row", host);
      lgd.style.justifyContent = "center";
      data.forEach(function (d) {
        var li = html("span", "li", lgd);
        var sw = html("span", "sw round", li); sw.style.background = d.color;
        html("span", null, li, d.key);
      });
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function () { render(); }, destroy: stop });
  }

  /* ======================================================================
     8. Grouped bars — leniency resistance (Figure 11, right)
     ====================================================================== */
  function groupedBars(sel, opts) {
    var host = node(sel);
    if (!host) return null;
    host.classList.add("chart-body");
    host.style.position = "relative";
    var tip = Tooltip(host);
    var series = opts.series;     /* [{key,label,color}] */
    var groups = opts.groups;     /* [{label, values:{key:v}}] */

    function render(w) {
      w = w || host.clientWidth;
      if (!w) return;
      Array.prototype.slice.call(host.children).forEach(function (c) { if (c !== tip.el) c.remove(); });
      var m = { t: 12, r: 14, b: 34, l: 108 };
      var iw = w - m.l - m.r;
      var barH = 17, inner = 5, gGap = 20;
      var gh = series.length * barH + (series.length - 1) * inner;
      var ih = groups.length * gh + (groups.length - 1) * gGap;
      var h = ih + m.t + m.b;
      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h,
        role: "img", "aria-label": opts.aria || "grouped bars" }, host);
      var g = el("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);
      var max = opts.max || 1;

      [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
        var px = t / max * iw;
        el("line", { class: "ax-grid", x1: px, x2: px, y1: 0, y2: ih }, g);
        el("text", { class: "ax-tick", x: px, y: ih + 18, "text-anchor": "middle" }, g).textContent = t.toFixed(2);
      });

      groups.forEach(function (grp, gi) {
        var y0 = gi * (gh + gGap);
        el("text", { class: "ax-tick", x: -12, y: y0 + gh / 2 + 4, "text-anchor": "end",
          style: "fill:var(--text-hi);font-size:12.5px" }, g).textContent = grp.label;
        series.forEach(function (s, si) {
          var v = grp.values[s.key];
          var yy = y0 + si * (barH + inner);
          var bw = v / max * iw;
          var rect = el("rect", { x: 0, y: yy, width: Math.max(2, bw), height: barH, rx: 3,
            fill: s.color, "fill-opacity": 0.82, tabindex: 0, role: "button",
            "aria-label": grp.label + " " + s.label + " " + v }, g);
          rect.style.cursor = "pointer";
          function on() {
            rect.setAttribute("fill-opacity", 1);
            var b = host.getBoundingClientRect(), sb = svg.getBoundingClientRect();
            tip.show(sb.left - b.left + m.l + bw / 2, sb.top - b.top + m.t + yy,
              tipBody(s.label, "", [["Fail recall on " + grp.label, v.toFixed(2)]]));
          }
          function off() { rect.setAttribute("fill-opacity", 0.82); tip.hide(); }
          rect.addEventListener("mouseenter", on); rect.addEventListener("mouseleave", off);
          rect.addEventListener("focus", on); rect.addEventListener("blur", off);
          el("text", { x: bw + 8, y: yy + barH / 2 + 4,
            style: "fill:var(--text-dim);font-size:11px;font-variant-numeric:tabular-nums" }, g)
            .textContent = v.toFixed(2);
        });
      });

      var lgd = html("div", "legend-row", host);
      series.forEach(function (s) {
        var li = html("span", "li", lgd);
        var sw = html("span", "sw", li); sw.style.background = s.color;
        html("span", null, li, s.label);
      });
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function () { render(); }, destroy: stop });
  }

  /* ======================================================================
     9. Composition bars + length box plot — paper Figure 5 (left / right)
     ====================================================================== */
  function composition(sel, opts) {
    var host = node(sel);
    if (!host) return null;
    host.classList.add("chart-body");
    var B = D.benchmark;

    function render(w) {
      w = w || host.clientWidth;
      if (!w) return;
      host.innerHTML = "";
      var sets = [
        { label: "OSReward", n: B.full.n, s: B.full.success, f: B.full.fail },
        { label: "OSReward-Hard", n: B.hard.n, s: B.hard.success, f: B.hard.fail }
      ];
      sets.forEach(function (S) {
        var row = html("div", null, host);
        row.style.cssText = "margin-bottom:20px";
        var top = html("div", null, row);
        top.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px";
        var nm = html("span", null, top, S.label);
        nm.style.cssText = "color:var(--text-hi);font-weight:600;font-size:15px";
        var ct = html("span", null, top, S.n.toLocaleString() + " trajectories");
        ct.style.cssText = "color:var(--text-faint);font-size:12.5px;font-variant-numeric:tabular-nums";
        /* colours live in CSS so both themes can style the fills and the
           labels on top of them */
        var bar = html("div", "comp-bar", row);
        var a = html("div", "seg-ok", bar, S.s + "% success");
        a.style.flex = S.s;
        var b = html("div", "seg-bad", bar, S.f + "% fail");
        b.style.flex = S.f;
      });

      /* trajectory length */
      var lw = w, lh = 132;
      var m = { t: 26, r: 18, b: 26, l: 76 };
      var iw = lw - m.l - m.r, ih = lh - m.t - m.b;
      var cap = html("div", null, host, "Trajectory length (steps)");
      cap.style.cssText = "font-size:12px;letter-spacing:.08em;text-transform:uppercase;" +
        "color:var(--gold-400);font-weight:600;margin:22px 0 4px";
      var svg = el("svg", { viewBox: "0 0 " + lw + " " + lh, width: lw, height: lh,
        role: "img", "aria-label": "Trajectory length for successful and failed runs" }, host);
      var g = el("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);
      var maxV = 84;
      var x = scaleLinear(0, maxV, 0, iw);
      [0, 20, 40, 60, 80].forEach(function (t) {
        el("line", { class: "ax-grid", x1: x(t), x2: x(t), y1: -6, y2: ih + 6 }, g);
        el("text", { class: "ax-tick", x: x(t), y: ih + 20, "text-anchor": "middle" }, g).textContent = t;
      });
      [["Success", B.length.success, "#58c7a4"], ["Fail", B.length.fail, "#e0736b"]].forEach(function (row, i) {
        var yy = i * (ih / 2) + ih / 4, bh = 20;
        el("text", { class: "ax-tick", x: -12, y: yy + 4, "text-anchor": "end",
          style: "fill:var(--text-hi);font-size:12.5px" }, g).textContent = row[0];
        var d = row[1], c = row[2];
        el("line", { x1: x(d.min), x2: x(d.max), y1: yy, y2: yy, stroke: c, "stroke-opacity": 0.5 }, g);
        el("line", { x1: x(d.min), x2: x(d.min), y1: yy - 6, y2: yy + 6, stroke: c, "stroke-opacity": 0.6 }, g);
        el("line", { x1: x(d.max), x2: x(d.max), y1: yy - 6, y2: yy + 6, stroke: c, "stroke-opacity": 0.6 }, g);
        el("rect", { x: x(d.q1), y: yy - bh / 2, width: x(d.q3) - x(d.q1), height: bh, rx: 3,
          fill: c, "fill-opacity": 0.3, stroke: c, "stroke-opacity": 0.7 }, g);
        el("line", { x1: x(d.med), x2: x(d.med), y1: yy - bh / 2, y2: yy + bh / 2, stroke: c,
          "stroke-width": 2 }, g);

      });
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function () { render(); }, destroy: stop });
  }


  /* ======================================================================
     10. Corpus Sankey — paper Figure 10
     Columns 1-4 are trajectories and share one vertical scale; the judgment
     columns count judge instances and training samples, so they get their own
     scale and the break is drawn and labelled rather than hidden.
     ====================================================================== */
  function corpusSankey(sel, opts) {
    opts = opts || {};
    var host = node(sel);
    if (!host || !D.corpusFlow) return null;
    host.classList.add("chart-body");
    host.style.position = "relative";
    var tip = Tooltip(host);
    var F = D.corpusFlow;

    var C_KEEP = "#4f97ee", C_DROP = "#c46a62", C_JUDGE = "#d9a53a", C_OUT = "#3fc3a2";
    var MIN_W = 964;   /* six labelled columns will not compress below this */

    function render(hostW) {
      hostW = hostW || host.clientWidth;
      if (!hostW) return;
      Array.prototype.slice.call(host.children).forEach(function (c) { if (c !== tip.el) c.remove(); });

      var w = Math.max(hostW, MIN_W);
      var scroller = html("div", null, host);
      if (w > hostW) {
        scroller.style.cssText = "overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch";
      }

      var h = 560;
      /* The first and last column captions are centred on their node, so each
         side must reserve half a caption's width. "OS-Shepherd-100K" is the
         widest; at 10px the labels used to spill past the card edge. */
      var m = { t: 58, r: 60, b: 24, l: 60 };
      var iw = w - m.l - m.r, ih = h - m.t - m.b;

      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h,
        role: "img", "aria-label": "How OS-Shepherd-100K is built" }, scroller);
      svg.style.cssText = "display:block;width:" + w + "px;height:" + h + "px;max-width:none";
      var g = el("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);

      /* ---- geometry --------------------------------------------------
         The main chain hangs from a flat top edge, as in the paper: every
         loss peels off the bottom, so the survivor band stays a continuous
         ribbon across the whole diagram. */
      var nodeW = 11, cols = 6;
      var gap = (iw - nodeW * cols) / (cols - 1);
      var X = function (i) { return i * (nodeW + gap); };

      var sTraj = (ih * 0.46) / F.stages[0].n;
      var sJudge = (ih * 0.50) / F.judged.n;
      var H = function (v, sc) { return v * (sc || sTraj); };

      function ribbon(x0, y0a, y0b, x1, y1a, y1b, fill, op) {
        var cx = (x0 + x1) / 2;
        return el("path", {
          d: "M" + x0 + " " + y0a + "C" + cx + " " + y0a + " " + cx + " " + y1a + " " + x1 + " " + y1a +
             "L" + x1 + " " + y1b + "C" + cx + " " + y1b + " " + cx + " " + y0b + " " + x0 + " " + y0b + "Z",
          fill: fill, "fill-opacity": op === undefined ? 0.28 : op }, g);
      }

      function hoverable(elm, title, rows, foot, cx, cy) {
        elm.style.cursor = "pointer";
        elm.setAttribute("tabindex", "0");
        var base = elm.getAttribute("fill-opacity");
        function on() {
          if (base !== null) elm.setAttribute("fill-opacity", Math.min(1, parseFloat(base) + 0.32));
          var b = host.getBoundingClientRect(), sb = svg.getBoundingClientRect();
          tip.show(sb.left - b.left + m.l + cx, sb.top - b.top + m.t + cy, tipBody(title, "", rows, foot));
        }
        function off() { if (base !== null) elm.setAttribute("fill-opacity", base); tip.hide(); }
        elm.addEventListener("mouseenter", on); elm.addEventListener("mouseleave", off);
        elm.addEventListener("focus", on); elm.addEventListener("blur", off);
      }

      function caption(i, show, label, colour) {
        var x = X(i) + nodeW / 2;
        el("text", { x: x, y: -30, "text-anchor": "middle",
          style: "fill:" + colour + ";font-family:var(--font-display);font-size:20px;" +
                 "font-weight:600;font-variant-numeric:tabular-nums" }, g).textContent = show;
        el("text", { x: x, y: -14, "text-anchor": "middle",
          style: "fill:var(--text-hi);font-size:11.5px;font-weight:600" }, g).textContent = label;
      }

      /* ---- trajectory half -------------------------------------------- */
      var v = [F.stages[0].n, F.stages[1].n, F.stages[2].n];
      var dropLane = [ih * 0.46, ih * 0.57, ih * 0.675];

      for (var i = 0; i < 3; i++) {
        var xa = X(i) + nodeW, xb = X(i + 1);
        var keepV = (i < 2) ? v[i + 1] : F.carried.n;
        var keepH = H(keepV), dropH = H(F.drops[i].n), fullH = H(v[i]);

        var rk = ribbon(xa, 0, keepH, xb, 0, keepH, C_KEEP, 0.26);
        hoverable(rk, i < 2 ? "Survives to the next stage" : F.carried.label,
          [["Trajectories", keepV.toLocaleString()]], null, (xa + xb) / 2, keepH / 2);

        var dEndX = xa + gap * 0.34, dy = dropLane[i];
        var rd = ribbon(xa, keepH, fullH, dEndX, dy, dy + dropH * 0.8, C_DROP, 0.24);
        hoverable(rd, F.drops[i].label, [["Dropped", F.drops[i].n.toLocaleString()]],
          "removed at this stage", (xa + dEndX) / 2, (keepH + dy) / 2);
        el("text", { x: dEndX + 8, y: dy + dropH * 0.4 - 1,
          style: "fill:var(--bad);font-family:var(--font-mono);font-size:11px" }, g)
          .textContent = F.drops[i].show;
        el("text", { x: dEndX + 8, y: dy + dropH * 0.4 + 12,
          style: "fill:var(--text-faint);font-size:10px" }, g).textContent = F.drops[i].label;
      }

      /* ---- open-source corpora: one branch each ------------------------ */
      var finalH = H(F.stages[3].n);
      var acc = H(F.carried.n);
      var room = finalH - acc;
      var srcTotal = F.sources.reduce(function (a, d) { return a + d.n; }, 0);
      var srcX = X(2) + nodeW + gap * 0.70;
      var srcTop = ih * 0.775, srcGap = 8;
      var cursor = srcTop;
      F.sources.forEach(function (d, k) {
        var hgt = room * (d.n / srcTotal);
        var nodeH = Math.max(5, hgt);
        var slot = Math.max(nodeH, 15);
        var sy = cursor + (slot - nodeH) / 2;
        cursor += slot + srcGap;
        el("rect", { x: srcX, y: sy, width: 7, height: nodeH, rx: 2,
          fill: d.color, "fill-opacity": 0.92 }, g);
        var rs = ribbon(srcX + 7, sy, sy + nodeH, X(3), acc, acc + hgt, d.color, 0.3);
        hoverable(rs, d.label, [["Trajectories", d.n.toLocaleString()]],
          "open-source corpus", (srcX + X(3)) / 2, (sy + acc) / 2);
        el("text", { x: srcX - 8, y: sy + nodeH / 2 + 4, "text-anchor": "end",
          style: "fill:var(--text-dim);font-size:11px" }, g)
          .textContent = d.label + "  " + d.show;
        acc += hgt;
      });
      el("text", { x: srcX + 12, y: srcTop - 10,
        style: "fill:var(--text-faint);font-size:9.5px;letter-spacing:.07em;text-transform:uppercase" }, g)
        .textContent = "open-source corpora merged in";

      /* ---- unit break --------------------------------------------------- */
      var breakX = X(3) + nodeW + gap * 0.5;
      el("line", { x1: breakX, x2: breakX, y1: -46, y2: ih * 0.56,
        stroke: "var(--gold-500)", "stroke-opacity": 0.4, "stroke-dasharray": "3 5" }, g);
      el("text", { x: breakX, y: -50, "text-anchor": "middle",
        style: "fill:var(--gold-400);font-size:9.5px;letter-spacing:.07em;text-transform:uppercase" }, g)
        .textContent = "unit changes · scale restarts";

      /* ---- judgment half -------------------------------------------------- */
      var judgeH = H(F.judged.n, sJudge);
      var rj = ribbon(X(3) + nodeW, 0, finalH, X(4), 0, judgeH, C_JUDGE, 0.22);
      hoverable(rj, "Ensemble judging",
        [["Trajectories in", F.stages[3].n.toLocaleString()],
         ["Judges each", "~" + F.judged.perTraj],
         ["Instances out", F.judged.n.toLocaleString()]],
        "counts a different thing from here on", (X(3) + X(4)) / 2, finalH / 2);

      var keptH = judgeH * (F.agreement.keptPct / 100);
      var outH = judgeH * 0.44;
      var ro = ribbon(X(4) + nodeW, 0, keptH, X(5), 0, outH, C_OUT, 0.26);
      hoverable(ro, "Agreement filter",
        [["Trajectories kept", F.agreement.keptTraj.toLocaleString()],
         ["Share kept", F.agreement.keptPct + "%"],
         ["Samples out", F.corpus.show]],
        "kept only where strong judges independently agree", (X(4) + X(5)) / 2, outH / 2);

      var aH = judgeH - keptH, aLane = ih * 0.46, aEndX = X(4) + nodeW + gap * 0.46;
      var ra = ribbon(X(4) + nodeW, keptH, judgeH, aEndX, aLane, aLane + aH * 0.8, C_DROP, 0.24);
      hoverable(ra, F.agreement.label, [["Dropped", F.agreement.dropped.toLocaleString()]],
        "judges disagreed", (X(4) + aEndX) / 2, (keptH + aLane) / 2);
      el("text", { x: aEndX + 8, y: aLane + aH * 0.4 - 1,
        style: "fill:var(--bad);font-family:var(--font-mono);font-size:11px" }, g)
        .textContent = F.agreement.show;
      el("text", { x: aEndX + 8, y: aLane + aH * 0.4 + 12,
        style: "fill:var(--text-faint);font-size:10px" }, g).textContent = "agreement filter";

      /* ---- nodes ------------------------------------------------------- */
      [[0, H(v[0]), C_KEEP, F.stages[0].label, F.stages[0].show, v[0], "Trajectories"],
       [1, H(v[1]), C_KEEP, F.stages[1].label, F.stages[1].show, v[1], "Trajectories"],
       [2, H(v[2]), C_KEEP, F.stages[2].label, F.stages[2].show, v[2], "Trajectories"],
       [3, finalH,  C_KEEP, F.stages[3].label, F.stages[3].show, F.stages[3].n, "Trajectories"],
       [4, judgeH,  C_JUDGE, F.judged.label,   F.judged.show,    F.judged.n, "Judge instances"],
       /* 8th slot overrides the tooltip figure. Only the corpus uses it: the
          page presents that node as 100K, its name, so the hover must not
          contradict the headline with a raw count. */
       [5, outH,    C_OUT,   F.corpus.label,   F.corpus.show,    F.corpus.n, "Training samples",
        F.corpus.show]
      ].forEach(function (n) {
        var x = X(n[0]);
        el("rect", { x: x, y: 0, width: nodeW, height: Math.max(4, n[1]), rx: 3,
          fill: n[2], "fill-opacity": 0.95 }, g);
        caption(n[0], n[4], n[3], n[0] === 5 ? C_OUT : "var(--gold-300)");
        var hit = el("rect", { x: x - 5, y: -40, width: nodeW + 10, height: n[1] + 44,
          fill: "transparent" }, g);
        hoverable(hit, n[3], [[n[6], n[7] || n[5].toLocaleString()]], null, x + nodeW / 2, n[1] / 2);
      });

      var lg = html("div", "legend-row", host);
      [[C_KEEP, "kept"], [C_DROP, "filtered out"], [C_JUDGE, "judge instances"],
       [C_OUT, "training samples"]].forEach(function (pair) {
        var li = html("span", "li", lg);
        var sw = html("span", "sw", li); sw.style.background = pair[0]; sw.style.opacity = 0.8;
        html("span", null, li, pair[1]);
      });
    }

    var stop = responsive(host, render);
    return register({ el: host, update: function () { render(); }, destroy: stop });
  }

  global.OSRewardCharts = {
    /* redraw every mounted chart — used when the page theme flips */
    redrawAll: function () {
      _varCache = {};
      REGISTRY.forEach(function (c) { try { c.update(); } catch (e) { /* detached */ } });
    },
    pareto: pareto,
    corpusSankey: corpusSankey,
    biasPlane: biasPlane,
    leaderboard: leaderboard,
    failureModes: failureModes,
    barPair: barPair,
    heatmap: heatmap,
    donut: donut,
    groupedBars: groupedBars,
    composition: composition,
    _util: { el: el, html: html, scaleLinear: scaleLinear, scaleLog: scaleLog, Tooltip: Tooltip, controls: controls }
  };
})(window);
