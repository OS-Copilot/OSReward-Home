/* ==========================================================================
   OSReward — page polish
   Small, data-driven touches around the main sections:
     1. reading-progress line under the nav
     2. (overview visuals live in index.html: the judge loop and contribution flow)
     3. findings takeaways get a headline number that counts up, and jump to
        the figure that backs them
     5. an OS-Copilot series orbit (after OS-Hub) in the resources section
   Everything is progressive: without this file the page reads as before.
   ========================================================================== */
(function () {
  "use strict";

  var D = window.OSRewardData;
  var REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var SVGNS = "http://www.w3.org/2000/svg";

  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function s(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function onView(el, fn, threshold) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      fn();
    }, { threshold: threshold || 0.35 });
    io.observe(el);
  }
  function famColor(f) { return D && D.families && D.families[f] ? D.families[f].color : "#8fa3bd"; }

  /* --------------------------------------------------- 1. reading progress */
  function progress() {
    var nav = document.getElementById("nav");
    if (!nav) return;
    var bar = h("div", "read-progress", nav);
    bar.setAttribute("aria-hidden", "true");
    var ticking = false;
    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, scrollY / max) : 0) + ")";
    }
    addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ----------------------------------------------- 3. findings headliners */
  var FINDINGS = [
    { pre: "<", to: 90, dec: 0, post: "%", cap: "best binary accuracy", target: "table-leaderboard" },
    { pre: "", to: null, text: "⅔", post: "", cap: "of all errors are false successes", target: "chart-failure" },
    { pre: "−", to: 7.2, dec: 1, post: " pp", cap: "without the thought and action text", target: "chart-ablation" },
    { pre: "$", to: 45, dec: 0, post: "–100", cap: "per pass for a ~70% Hard judge", target: "chart-pareto" }
  ];
  function countUp(el, f) {
    if (f.to === null) { el.textContent = f.text; return; }
    if (REDUCED) { el.textContent = f.pre + f.to.toFixed(f.dec) + f.post; return; }
    var t0 = performance.now(), dur = 1100;
    (function frame(now) {
      var t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = f.pre + (f.to * e).toFixed(f.dec) + f.post;
      if (t < 1) requestAnimationFrame(frame);
    })(t0);
  }
  function findings() {
    var cards = document.querySelectorAll("#findings .takeaway");
    Array.prototype.forEach.call(cards, function (card, i) {
      var f = FINDINGS[i];
      if (!f) return;
      var p = card.querySelector("p");
      var head = document.createElement("div");
      head.className = "take-head";
      var num = h("span", "take-num", head, f.to === null ? f.text : f.pre + "0" + f.post);
      h("span", "take-cap", head, f.cap);
      card.insertBefore(head, p);
      var target = document.getElementById(f.target);
      if (target) {
        var go = h("a", "take-go", card, "See the figure ↓");
        go.href = "#" + f.target;
        go.addEventListener("click", function (ev) {
          ev.preventDefault();
          var box = target.closest(".card") || target;
          box.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
          box.classList.remove("is-pinged");
          void box.offsetWidth;
          box.classList.add("is-pinged");
        });
      }
      onView(card, function () { countUp(num, f); }, 0.6);
    });
  }

  /* -------------------------------------------------- 5. series orbit */
  function series() {
    var grid = document.querySelector("#resources .grid-4");
    var links = document.querySelectorAll(".nav-more ul li:not(.nav-more-hub) a");
    if (!grid || !links.length) return;
    var hubUrl = "https://os-copilot.github.io/OS-Hub/";
    var band = document.createElement("div");
    band.className = "series rise in";
    grid.parentNode.insertBefore(band, grid.nextSibling);

    var copy = h("div", "series-copy", band);
    h("span", "eyebrow", copy, "OS-Copilot series");
    h("h3", null, copy, "One part of an open stack for computer-using agents");
    h("p", null, copy, "OSReward is the evaluation and reward layer. Its siblings build the agents, data and " +
      "environments it judges: grounding models, trajectory synthesis, mobile agents, safety and science " +
      "benchmarks.");
    var hub = h("a", "px-pill px-pill-gold", copy, "Explore the series on OS-Hub ↗");
    hub.href = hubUrl; hub.target = "_blank"; hub.rel = "noopener";

    var orbit = h("div", "series-orbit", band);
    orbit.setAttribute("role", "list");
    orbit.setAttribute("aria-label", "Other OS-Copilot projects");
    h("span", "series-ring is-1", orbit);
    h("span", "series-ring is-2", orbit);
    var core = h("a", "series-core", orbit);
    core.href = hubUrl; core.target = "_blank"; core.rel = "noopener";
    core.setAttribute("aria-label", "OSReward in the OS-Copilot series map (OS-Hub)");
    var ci = h("img", null, core); ci.src = "public/favicon-512.png"; ci.alt = "";
    h("span", null, core, "OSReward");

    var sats = Array.prototype.map.call(links, function (a, i) {
      var it = h("a", "series-sat", orbit);
      it.href = a.href; it.target = "_blank"; it.rel = "noopener";
      it.setAttribute("role", "listitem");
      var im = a.querySelector("img");
      var li = h("img", null, it); li.src = im ? im.getAttribute("src") : ""; li.alt = "";
      var label = a.querySelector("span");
      var name = label ? label.childNodes[0].textContent.trim() : a.textContent.trim();
      var sub = label && label.querySelector("small") ? label.querySelector("small").textContent : "";
      var tip = h("span", "series-tip", it);
      h("b", null, tip, name);
      if (sub) h("small", null, tip, sub);
      it.setAttribute("aria-label", name + (sub ? " — " + sub : ""));
      return { el: it, base: i / links.length * Math.PI * 2, ring: i % 2 };
    });

    var phase = 0, last = 0, paused = REDUCED, raf = null, visible = false;
    function place() {
      var w = orbit.clientWidth, hgt = orbit.clientHeight;
      sats.forEach(function (st) {
        var rx = (st.ring ? 0.46 : 0.33) * w, ry = (st.ring ? 0.40 : 0.28) * hgt;
        var a = st.base + phase * (st.ring ? 0.7 : 1);
        var x = w / 2 + Math.cos(a) * rx, y = hgt / 2 + Math.sin(a) * ry;
        st.el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-50%)";
        st.el.style.zIndex = Math.round(y);
        st.el.style.setProperty("--depth", (0.78 + 0.22 * (Math.sin(a) + 1) / 2).toFixed(3));
      });
    }
    function frame(t) {
      if (last) phase += (t - last) / 1000 * 0.12;
      last = t;
      place();
      raf = (!paused && visible) ? requestAnimationFrame(frame) : null;
    }
    function run() { if (!raf && !paused && visible) { last = 0; raf = requestAnimationFrame(frame); } }
    orbit.addEventListener("mouseenter", function () { paused = true; });
    orbit.addEventListener("mouseleave", function () { paused = REDUCED; run(); });
    orbit.addEventListener("focusin", function () { paused = true; });
    orbit.addEventListener("focusout", function () { paused = REDUCED; run(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; run(); }).observe(orbit);
    } else { visible = true; }
    addEventListener("resize", place);
    place();
    run();
  }

  function init() {
    progress();
    findings();
    series();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
