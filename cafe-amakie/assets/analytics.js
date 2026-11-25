/*!
 * Visitor + lead tracking for small-business sites.
 *
 * Configure in the page <head> BEFORE this file loads:
 *   window.SITE_ANALYTICS = {
 *     ga4: "G-XXXXXXXXXX",                 // Google Analytics 4 measurement ID (optional)
 *     umami: { id: "", src: "https://cloud.umami.is/script.js" }, // Umami website ID (optional)
 *     cfBeacon: ""                          // Cloudflare Web Analytics token (optional)
 *   };
 * Any provider left empty / with placeholder X's is skipped, so nothing is sent
 * until you deliberately add your own IDs.
 *
 * Lead events sent automatically (mark these as "Key events" in GA4):
 *   whatsapp_click   – any link to wa.me / api.whatsapp.com
 *   call_click       – any tel: link
 *   directions_click – any Google Maps link
 *   email_click      – any mailto: link
 *   social_click     – Facebook / Instagram / TikTok links
 *   booking_request / order_request / enquiry_request – call window.trackLead(name, {...}) from page code
 *   any element with data-track="event_name" sends that event when clicked
 */
(function () {
  var cfg = window.SITE_ANALYTICS || {};
  var real = function (v) { return typeof v === "string" && v.trim() && !/X{4,}/.test(v); };
  var queue = [];

  // ---- Google Analytics 4 ----
  if (real(cfg.ga4)) {
    var g = document.createElement("script");
    g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(cfg.ga4);
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", cfg.ga4, { anonymize_ip: true });
  }

  // ---- Umami (self-hosted or cloud) ----
  if (cfg.umami && real(cfg.umami.id)) {
    var u = document.createElement("script");
    u.defer = true;
    u.src = cfg.umami.src || "https://cloud.umami.is/script.js";
    u.setAttribute("data-website-id", cfg.umami.id);
    u.onload = function () { queue.splice(0).forEach(function (e) { window.umami.track(e[0], e[1]); }); };
    document.head.appendChild(u);
  }

  // ---- Cloudflare Web Analytics (page views only, cookieless) ----
  if (real(cfg.cfBeacon)) {
    var c = document.createElement("script");
    c.defer = true;
    c.src = "https://static.cloudflareinsights.com/beacon.min.js";
    c.setAttribute("data-cf-beacon", JSON.stringify({ token: cfg.cfBeacon }));
    document.head.appendChild(c);
  }

  function send(name, params) {
    params = params || {};
    params.page = location.pathname;
    if (window.gtag && real(cfg.ga4)) window.gtag("event", name, params);
    if (cfg.umami && real(cfg.umami.id)) {
      if (window.umami && window.umami.track) window.umami.track(name, params);
      else queue.push([name, params]);
    }
    if (window.SITE_ANALYTICS_DEBUG) console.log("[track]", name, params);
  }
  window.trackLead = send;

  function classify(href) {
    if (!href) return null;
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)/i.test(href)) return "whatsapp_click";
    if (/^tel:/i.test(href)) return "call_click";
    if (/^mailto:/i.test(href)) return "email_click";
    if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/i.test(href)) return "directions_click";
    if (/facebook\.com|instagram\.com|tiktok\.com/i.test(href)) return "social_click";
    return null;
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("a,button,[data-track]");
    if (!el) return;
    var name = el.getAttribute("data-track") || classify(el.getAttribute("href"));
    if (!name) return;
    send(name, { label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60) });
  }, true);

  // How far people read: fire once at 50% and 90% of the page.
  var marks = { 50: false, 90: false };
  window.addEventListener("scroll", function () {
    var h = document.documentElement, pct = (h.scrollTop + innerHeight) / h.scrollHeight * 100;
    [50, 90].forEach(function (m) { if (!marks[m] && pct >= m) { marks[m] = true; send("scroll_" + m); } });
  }, { passive: true });
})();
