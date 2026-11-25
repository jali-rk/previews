/* Shared motion layer: GSAP + ScrollTrigger + SplitText + Lenis, driven by data attributes.
   Load order (all defer): vendor/gsap, vendor/ScrollTrigger, vendor/SplitText, vendor/lenis, motion.js.
   The page head sets:  html.m  and  window.MQ / window.onMotion  (queue for site scripts).

   Attributes
     data-header                 sticky header: .is-scrolled after 24px, .is-hidden while scrolling down
     data-menu-toggle / data-menu  mobile menu (html.menu-open), links close it, Esc closes it
     data-reveal="up|down|left|right|scale|fade|image|zoom"  (+ data-delay, data-duration)
     data-reveal-group           children reveal in a stagger (+ data-stagger)
     data-split="lines|words|chars"  masked text reveal (+ data-delay)
     data-scrub                  words light up as you scroll through the paragraph
     data-parallax="12"          moves by ±12% of its height while crossing the viewport
     data-marquee (+ data-speed) endless strip; its first .marquee-track is cloned
     data-magnetic               button drifts toward the pointer
     data-count="42"             counts up when visible (use only for real numbers)
     data-hscroll                pinned horizontal scroll of its .hs-track (desktop only; refreshes after
                                 site pins, so pins created later in onMotion still measure correctly)
     data-progress               reading progress bar
*/
(function () {
  "use strict";
  var html = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var g = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText;
  var M = { gsap: g, ScrollTrigger: ST, SplitText: Split, lenis: null, reduced: reduced || !g || !ST, fine: fine };
  window.Motion = M;

  header();
  menu();

  if (!g || !ST || reduced) { html.classList.add("m-off"); flush(); return; }
  g.registerPlugin(ST);
  if (Split) g.registerPlugin(Split);
  var late = html.classList.contains("m-off"); // content already shown by the fallback: don't hide it again

  if (window.Lenis && fine) {
    M.lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    M.lenis.on("scroll", ST.update);
    g.ticker.add(function (t) { M.lenis.raf(t * 1000); });
    g.ticker.lagSmoothing(0);
  }
  anchors();

  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
    var run = function (f) { try { f(); } catch (e) { console.error(e); } };
    if (!late) { run(splits); run(reveals); run(groups); }
    [scrubs, parallax, marquees, counters, magnetic, hscroll, progress].forEach(run);
    html.classList.add("m-ready");
    flush();
    window.addEventListener("load", function () { ST.refresh(); });
  });

  function flush() {
    window.MOTION_READY = true;
    var q = window.MQ || [];
    window.onMotion = function (f) { try { f(M); } catch (e) { console.error(e); } };
    q.forEach(window.onMotion);
    window.MQ = [];
  }

  function header() {
    var h = document.querySelector("[data-header]");
    if (!h) return;
    var last = window.scrollY, ticking = false;
    function update() {
      var y = window.scrollY;
      h.classList.toggle("is-scrolled", y > 24);
      var down = y > last + 4, up = y < last - 4;
      if (html.classList.contains("menu-open")) h.classList.remove("is-hidden");
      else if (down && y > 420) h.classList.add("is-hidden");
      else if (up || y < 120) h.classList.remove("is-hidden");
      last = y; ticking = false;
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    h.addEventListener("focusin", function () { h.classList.remove("is-hidden"); });
    update();
  }

  function menu() {
    var btn = document.querySelector("[data-menu-toggle]"), panel = document.querySelector("[data-menu]");
    if (!btn || !panel) return;
    function set(open) {
      html.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (M.lenis) open ? M.lenis.stop() : M.lenis.start();
      if (open && g && !M.reduced) {
        g.fromTo(panel.querySelectorAll("a, [data-menu-item]"), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .05, ease: "expo.out", delay: .1, overwrite: true });
      }
    }
    btn.addEventListener("click", function () { set(!html.classList.contains("menu-open")); });
    panel.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && html.classList.contains("menu-open")) { set(false); btn.focus(); } });
    matchMedia("(min-width: 960px)").addEventListener("change", function (e) { if (e.matches) set(false); });
  }

  function anchors() {
    if (!M.lenis) return;
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      var h = document.querySelector("[data-header]");
      M.lenis.scrollTo(t, { offset: -((h && h.offsetHeight) || 0) + 1, duration: 1.4 });
      history.replaceState(null, "", id);
    });
  }

  function num(el, k, d) { var v = parseFloat(el.getAttribute(k)); return isNaN(v) ? d : v; }

  function splits() {
    if (!Split) { g.set("[data-split]", { visibility: "visible" }); return; }
    g.utils.toArray("[data-split]").forEach(function (el) {
      var type = el.getAttribute("data-split") || "lines";
      var delay = num(el, "data-delay", 0);
      var types = type === "chars" ? "lines,words,chars" : type === "words" ? "lines,words" : "lines";
      Split.create(el, {
        type: types, mask: type === "chars" ? "lines" : type, linesClass: "split-line", autoSplit: true,
        onSplit: function (self) {
          g.set(el, { visibility: "visible" });
          var targets = self[type] || self.lines;
          return g.from(targets, {
            yPercent: type === "chars" ? 105 : 112, rotate: type === "lines" ? 2.5 : 0, duration: num(el, "data-duration", 1.25),
            ease: "expo.out", stagger: type === "chars" ? .018 : type === "words" ? .04 : .1, delay: delay,
            scrollTrigger: { trigger: el, start: "top 92%", once: true }
          });
        }
      });
    });
  }

  function reveals() {
    g.utils.toArray("[data-reveal]").forEach(function (el) {
      var t = el.getAttribute("data-reveal") || "up";
      var d = num(el, "data-delay", 0), dur = num(el, "data-duration", t === "image" || t === "zoom" ? 1.6 : 1.1);
      var st = { trigger: el, start: "top 90%", once: true };
      if (t === "image") {
        var img = el.querySelector("img, picture, video, svg");
        var tl = g.timeline({ scrollTrigger: st, delay: d });
        tl.fromTo(el, { opacity: 1, clipPath: "inset(18% 12% 18% 12%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: dur, ease: "expo.inOut" });
        if (img) tl.fromTo(img, { scale: 1.35 }, { scale: 1, duration: dur + .4, ease: "expo.out" }, 0);
        tl.set(el, { clearProps: "clipPath" });
        return;
      }
      if (t === "zoom") { // hero media: fade + slow settle
        g.fromTo(el, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: dur + .6, ease: "expo.out", delay: d });
        return;
      }
      var from = { opacity: 0 }, to = { opacity: 1, x: 0, y: 0, scale: 1, duration: dur, ease: "expo.out", delay: d, scrollTrigger: st, clearProps: "transform" };
      if (t === "up") from.y = 48; else if (t === "down") from.y = -32;
      else if (t === "left") from.x = -60; else if (t === "right") from.x = 60;
      else if (t === "scale") from.scale = .9;
      g.fromTo(el, from, to);
    });
  }

  function groups() {
    g.utils.toArray("[data-reveal-group]").forEach(function (el) {
      g.fromTo(el.children, { opacity: 0, y: 36 }, {
        opacity: 1, y: 0, duration: 1, ease: "expo.out", stagger: num(el, "data-stagger", .09), delay: num(el, "data-delay", 0),
        clearProps: "transform", scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });
  }

  function scrubs() {
    if (!Split) return;
    g.utils.toArray("[data-scrub]").forEach(function (el) {
      Split.create(el, {
        type: "words", autoSplit: true,
        onSplit: function (self) {
          return g.fromTo(self.words, { opacity: .16 }, {
            opacity: 1, ease: "none", stagger: .1,
            scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 45%", scrub: .6 }
          });
        }
      });
    });
  }

  function parallax() {
    g.utils.toArray("[data-parallax]").forEach(function (el) {
      var v = num(el, "data-parallax", 10);
      var trig = el.closest("[data-parallax-wrap]") || el.parentElement || el;
      g.fromTo(el, { yPercent: -v }, { yPercent: v, ease: "none", scrollTrigger: { trigger: trig, start: "top bottom", end: "bottom top", scrub: true } });
    });
  }

  function marquees() {
    g.utils.toArray("[data-marquee]").forEach(function (el) {
      var track = el.querySelector(".marquee-track");
      if (!track) return;
      var inner = document.createElement("div");
      inner.className = "marquee-inner";
      track.parentNode.insertBefore(inner, track);
      inner.appendChild(track);
      var w = track.getBoundingClientRect().width;
      if (!w) return;
      var copies = Math.max(1, Math.ceil((el.clientWidth || window.innerWidth) * 2 / w));
      for (var i = 0; i < copies; i++) { var c = track.cloneNode(true); c.setAttribute("aria-hidden", "true"); inner.appendChild(c); }
      var dir = el.getAttribute("data-direction") === "right" ? 1 : -1;
      var speed = num(el, "data-speed", 60); // px per second
      var tw = g.fromTo(inner, { x: dir < 0 ? 0 : -w }, { x: dir < 0 ? -w : 0, duration: w / speed, ease: "none", repeat: -1 });
      ST.create({
        trigger: el, start: "top bottom", end: "bottom top",
        onToggle: function (s) { s.isActive ? tw.play() : tw.pause(); },
        onUpdate: function (s) {
          var v = Math.min(Math.abs(s.getVelocity()) / 300, 4);
          g.to(tw, { timeScale: 1 + v, duration: .2, overwrite: true, onComplete: function () { g.to(tw, { timeScale: 1, duration: 1.2 }); } });
        }
      });
    });
  }

  function counters() {
    g.utils.toArray("[data-count]").forEach(function (el) {
      var end = num(el, "data-count", 0), dec = (el.getAttribute("data-count").split(".")[1] || "").length;
      var o = { v: 0 };
      g.to(o, {
        v: end, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: function () { el.textContent = o.v.toLocaleString("en-LK", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
      });
    });
  }

  function magnetic() {
    if (!fine) return;
    g.utils.toArray("[data-magnetic]").forEach(function (el) {
      var xTo = g.quickTo(el, "x", { duration: .5, ease: "power3.out" }), yTo = g.quickTo(el, "y", { duration: .5, ease: "power3.out" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * .28);
        yTo((e.clientY - r.top - r.height / 2) * .4);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  function hscroll() {
    var mm = g.matchMedia();
    g.utils.toArray("[data-hscroll]").forEach(function (sec) {
      var track = sec.querySelector(".hs-track");
      if (!track) return;
      mm.add("(min-width: 960px)", function () {
        var dist = function () { return Math.max(0, track.scrollWidth - sec.clientWidth); };
        g.to(track, {
          x: function () { return -dist(); }, ease: "none",
          scrollTrigger: { trigger: sec, start: "top top", end: function () { return "+=" + dist(); }, pin: true, scrub: .8, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: -1 }
        });
      });
    });
  }

  function progress() {
    g.utils.toArray("[data-progress]").forEach(function (bar) {
      g.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: .3 } });
    });
  }
})();
