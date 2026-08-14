/* OfferPilot AI, checkout wiring (Stripe Payment Links, no backend).
 *
 * Any element with data-plan="free|pro|ultimate|lifetime" becomes a checkout
 * button. When a Stripe Payment Link is configured in /data/checkout.json the
 * button opens Stripe's hosted, PCI-compliant checkout. Until then it routes to
 * the free download so the site never dead-ends. Progressive enhancement: the
 * anchor's own href is a sensible fallback if this script never runs.
 */
(function () {
  "use strict";
  var base = (document.querySelector('meta[name="base-path"]') || {}).content || "";
  var withBase = function (href) {
    if (!href) return href;
    if (/^https?:\/\//.test(href)) return href;
    return base + href;
  };

  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-plan]"));
  if (!buttons.length) return;

  fetch(base + "/data/checkout.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg) return;
      buttons.forEach(function (el) {
        var plan = el.getAttribute("data-plan");
        var href, external = false, configured = true;
        if (plan === "free") {
          href = withBase(cfg.free_href || "/download/");
        } else {
          var link = (cfg.links || {})[plan];
          if (link && /^https?:\/\//.test(link)) { href = link; external = true; }
          else { href = withBase(cfg.fallback_href || "/download/"); configured = false; }
        }
        if (el.tagName === "A") {
          el.setAttribute("href", href);
          if (external) { el.setAttribute("rel", "noopener"); }
        } else {
          el.addEventListener("click", function () { window.location.href = href; });
        }
        if (!configured && plan !== "free") {
          el.setAttribute("data-checkout", "pending");
          el.setAttribute("title", "Live checkout activates once the Stripe link is set.");
        } else {
          el.setAttribute("data-checkout", "ready");
        }
      });
    })
    .catch(function () { /* fallbacks already in the markup */ });
})();
