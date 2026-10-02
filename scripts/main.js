/* OfferPilot AI, global interactions: nav, scroll reveals, hero HUD sequence. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- sticky nav shadow ---- */
  var nav = document.getElementById("nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("is-stuck", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- mobile menu ---- */
  var burger = document.getElementById("navBurger");
  var mobile = document.getElementById("navMobile");
  if (burger && mobile) {
    burger.addEventListener("click", function () {
      var open = mobile.classList.toggle("is-open");
      mobile.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
    });
    mobile.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mobile.classList.remove("is-open"); mobile.hidden = true;
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- scroll reveal ---- */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---- hero HUD: invisibility toggle + streaming boot sequence ---- */
  var hud = document.getElementById("heroHud");
  if (hud) {
    var toggleBtns = hud.querySelectorAll(".hud__toggle button");
    toggleBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        toggleBtns.forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        hud.classList.toggle("show-interviewer", b.dataset.view === "interviewer");
      });
    });

    var qEl = hud.querySelector(".hud__q .txt");
    var aEl = hud.querySelector(".hud__a .txt");
    if (qEl && aEl && !reduce) {
      var script = [
        { t: "So, how would you make a payment retry safe if the network drops mid-request?",
          a: "Make the write idempotent. I attach an idempotency key per payment, so a retried request maps to the same ledger entry instead of double-charging, then pair it with safe retries and reconciliation so a dropped connection never moves money twice." },
      ];
      var typed = function (el, text, speed, done) {
        var i = 0; el.innerHTML = "";
        var cur = document.createElement("span"); cur.className = "cursor"; el.appendChild(cur);
        (function tick() {
          if (i <= text.length) {
            el.textContent = text.slice(0, i);
            el.appendChild(cur.cloneNode());
            i++; setTimeout(tick, speed);
          } else { el.textContent = text; if (done) done(); }
        })();
      };
      var run = function () {
        typed(qEl, script[0].t, 26, function () {
          setTimeout(function () {
            var c = document.createElement("span"); c.className = "cursor";
            aEl.innerHTML = ""; aEl.appendChild(c);
            setTimeout(function () { typed(aEl, script[0].a, 16); }, 260);
          }, 380);
        });
      };
      // kick off when the hero is on screen
      if ("IntersectionObserver" in window) {
        var hio = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { run(); hio.disconnect(); } });
        }, { threshold: 0.4 });
        hio.observe(hud);
      } else { run(); }
    }
  }

  /* ---- current year ---- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
