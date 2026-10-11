/* OfferPilot AI, Company Q&A Generator.
 *
 * Pick a company and role and get an interview question bank with model
 * answers, in the same schema as the hand-written sets
 * ({questions:[{section, question, answer, code, lang, keywords}]}).
 *
 * Two sources:
 *  - Nine companies have hand-written sets, shipped as static JSON. They load
 *    instantly when the role is left blank or matches the set.
 *  - Any other company, or a hand-written company with a different role, is
 *    generated live by the backend (POST /qa/generate). It streams one question
 *    at a time, so the first appears within a couple of seconds, and caches
 *    every result, so asking again is instant.
 *
 * Previously every company without a hand-written set got the same six template
 * questions with only the name swapped in, the role field was ignored, and the
 * "Generating" spinner was a fixed delay. None of that remains.
 */
(function () {
  "use strict";

  var base = (document.querySelector('meta[name="base-path"]') || {}).content || "";
  var root = document.getElementById("qaGen");
  if (!root) return;

  var API = (root.getAttribute("data-api") || "").replace(/\/+$/, "");
  var ROLE_HINT = "e.g. Software Engineer";
  var els = {
    company: root.querySelector("#genCompany"),
    role: root.querySelector("#genRole"),
    btn: root.querySelector("#genRun"),
    chips: root.querySelector("#genChips"),
    list: root.querySelector("#genList"),
    detail: root.querySelector("#genDetail"),
    note: root.querySelector("#genTitle"),
    download: root.querySelector("#genDownload"),
  };

  var index = {};           // slug -> {name, role, curated} from companies.json
  var indexLoaded = false;  // stays false if companies.json fails, so hand-written sets are still tried
  var runId = 0;            // bumps on every run so a slow, older response is ignored
  var ctl = null;           // AbortController for the in-flight live generation
  var inflight = "";        // company|role of the live generation in progress
  var state = { data: null, source: "", errored: false, known: true };
  var dlUrl = "";           // the current Download blob URL, revoked when replaced

  /* -------------------------------------------------------------- helpers -- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function slugify(s) {
    return String(s || "").toLowerCase().trim().replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function tidy(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  // Case and spacing only. Slugging would make "C#", "C++" and "C" identical.
  function norm(s) {
    var v = String(s || "");
    if (v.normalize) v = v.normalize("NFKC");
    return v.toLowerCase().replace(/\s+/g, " ").trim();
  }
  // Escaped text with `inline code` rendered as code instead of literal backticks.
  function fmt(text) {
    return esc(text).replace(/`([^`\n]{1,120})`/g, "<code>$1</code>");
  }

  /* One tokenizing pass over the RAW code, escaping each piece as it is emitted.
   * The previous version ran three replace() passes over already-escaped HTML,
   * so the keyword pass matched the word "class" inside the <span class="cm">
   * it had just inserted, and every comment and string rendered with literal
   * `class="cm">` text in front of it. */
  var KW = "public|private|protected|static|final|void|int|long|bool|boolean|string|var|let|const|" +
    "new|return|class|interface|struct|enum|if|else|elif|for|foreach|while|do|switch|case|break|" +
    "continue|using|import|from|def|in|async|await|function|func|fn|self|this|None|True|False|" +
    "null|nil|true|false|try|catch|except|finally|throw|throws|raise|lambda|yield|package|" +
    "SELECT|FROM|WHERE|JOIN|LEFT|INNER|GROUP BY|ORDER BY|HAVING|WITH|AS|ON|AND|OR|INSERT|UPDATE|DELETE";
  var STR_SRC = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/.source;
  var CM_HASH = /#[^\n]*/.source;
  var CM_SQL = /--[^\n]*/.source;
  var CM_C = /\/\/[^\n]*|\/\*[\s\S]*?\*\//.source;
  function highlight(code, lang) {
    var cm = /^(python|py|ruby|rb|bash|shell|sh|r|perl|yaml|toml)$/i.test(lang || "") ? CM_HASH
      : /^(sql|tsql|plsql|postgresql|mysql)$/i.test(lang || "") ? CM_SQL : CM_C;
    var re = new RegExp("(" + cm + ")|(" + STR_SRC + ")|\\b(" + KW + ")\\b", "g");
    var src = String(code || "");
    var out = "", last = 0, m;
    while ((m = re.exec(src))) {
      if (!m[0]) { re.lastIndex++; continue; }
      out += esc(src.slice(last, m.index)) +
        '<span class="' + (m[1] ? "cm" : m[2] ? "st" : "kw") + '">' + esc(m[0]) + "</span>";
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }

  /* ------------------------------------------------------------ rendering -- */
  function setNote(text) { if (els.note) els.note.textContent = text; }

  function showStatus(html) {
    els.detail.innerHTML = '<div class="gen__loading"><span class="spinner"></span> ' + html + "</div>";
  }

  function showError(message) {
    state.errored = true;
    setPending(false);
    var msg = message || "Couldn't generate a set right now. Try again in a moment.";
    if (state.data && state.data.questions.length) {
      setNote(msg);   // keep what is already on screen
      wireDownload();
      return;
    }
    els.detail.innerHTML =
      '<div class="gen__error" role="alert"><p>' + esc(msg) + "</p>" +
      '<button class="btn btn--ghost" type="button" data-retry>Try again</button></div>';
    var b = els.detail.querySelector("[data-retry]");
    if (b) b.addEventListener("click", function () { inflight = ""; run(); });
    setNote("");
  }

  function renderDetail(q) {
    if (!q) { els.detail.innerHTML = ""; return; }
    var code = q.code ? '<pre class="code">' + highlight(q.code, q.lang) + "</pre>" : "";
    els.detail.innerHTML =
      '<div class="sec">' + esc(q.section) + "</div>" +
      "<h3>" + fmt(q.question) + "</h3>" +
      "<p>" + fmt(q.answer) + "</p>" + code +
      (q.keywords && q.keywords.length
        ? '<p class="mono" style="font-size:12px;color:var(--muted-2);margin-top:14px">match keywords: ' +
          esc(q.keywords.join(", ")) + "</p>"
        : "");
    els.detail.scrollTop = 0;
  }

  function selectItem(i, focus) {
    var items = els.list.querySelectorAll(".gen__qitem[data-i]");
    for (var k = 0; k < items.length; k++) {
      var on = +items[k].getAttribute("data-i") === i;
      items[k].classList.toggle("is-active", on);
      items[k].setAttribute("aria-current", on ? "true" : "false");
      if (on && focus) items[k].focus();
    }
    renderDetail(state.data.questions[i]);
  }

  function setPending(on, text) {
    var row = els.list.querySelector(".gen__qitem.is-pending");
    if (!on) { if (row) row.parentNode.removeChild(row); return; }
    if (!row) {
      row = document.createElement("div");
      row.className = "gen__qitem is-pending";
      row.setAttribute("aria-live", "polite");
      els.list.appendChild(row);
    }
    row.innerHTML = '<span class="spinner"></span><span>' + esc(text) + "</span>";
  }

  function appendItem(q) {
    var qs = state.data.questions, at = qs.length;
    // A live set's coding question is written by a parallel call and can land
    // after the closing question. It belongs right after system design.
    if (state.source !== "curated" && /^coding/i.test(q.section || "")) {
      for (var k = 0; k < qs.length; k++) {
        if (/^system/i.test(qs[k].section || "")) { at = k + 1; break; }
      }
    }
    qs.splice(at, 0, q);
    var div = document.createElement("div");
    div.className = "gen__qitem";
    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");
    div.innerHTML = '<div class="sec">' + esc(q.section) + '</div><div class="q">' + fmt(q.question) + "</div>";
    // Read the position at event time: a later insertion can shift it.
    div.addEventListener("click", function () { selectItem(+div.getAttribute("data-i")); });
    div.addEventListener("keydown", function (e) {
      var i = +div.getAttribute("data-i");
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectItem(i); }
      else if (e.key === "ArrowDown" && i + 1 < state.data.questions.length) { e.preventDefault(); selectItem(i + 1, true); }
      else if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); selectItem(i - 1, true); }
    });
    var rows = els.list.querySelectorAll(".gen__qitem[data-i]");
    els.list.insertBefore(div, rows[at] || els.list.querySelector(".gen__qitem.is-pending"));
    var all = els.list.querySelectorAll(".gen__qitem:not(.is-pending)");
    for (var n = 0; n < all.length; n++) all[n].setAttribute("data-i", n);
    if (qs.length === 1) selectItem(0);
  }

  function setDownloadEnabled(on) {
    if (!els.download) return;
    els.download.setAttribute("aria-disabled", on ? "false" : "true");
    if (!on) {
      els.download.removeAttribute("href");
      if (dlUrl) { URL.revokeObjectURL(dlUrl); dlUrl = ""; }
    }
  }

  function reset(company, role) {
    state = { data: { company: company, role: role, stack: [], questions: [] },
              source: "", errored: false, known: true };
    els.list.innerHTML = "";
    els.detail.innerHTML = "";
    setDownloadEnabled(false);
  }

  function wireDownload() {
    if (!els.download || !state.data || !state.data.questions.length) return;
    var d = state.data;
    var payload = { company: d.company, role: d.role, stack: d.stack || [], questions: d.questions };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    if (dlUrl) URL.revokeObjectURL(dlUrl);
    dlUrl = URL.createObjectURL(blob);
    els.download.href = dlUrl;
    els.download.download = (slugify(d.company) || "company") + "_qa.json";
    setDownloadEnabled(true);
  }

  /* --------------------------------------------------- hand-written sets -- */
  function fetchCurated(slug) {
    return fetch(base + "/data/qa/" + slug + ".json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // True when the typed role is a shorter form of the set's role, cut at a word
  // boundary: "software engineer" is covered by "software engineer, payments &
  // api platform". Never the other way round: a typed role with MORE detail than
  // the set ("software engineer ii, c#/.net" against "software engineer") is a
  // different interview. And "c" is not "c++ developer".
  function coveredBy(typed, setRole) {
    if (!typed || !setRole || setRole.indexOf(typed) !== 0) return false;
    return setRole.length === typed.length || /[\s,(\/-]/.test(setRole.charAt(typed.length));
  }

  // A hand-written set is the right answer only for the role it was written
  // for. "Software Engineer II, C#/.NET" at Stripe is a different interview from
  // Stripe's payments-platform set, so that request is generated instead.
  function roleMatches(role, data, slug) {
    var r = norm(role);
    if (!r) return true;
    var chip = norm((index[slug] || {}).role);
    var own = norm(data && data.role);
    return coveredBy(r, own) || coveredBy(r, chip);
  }

  function showCurated(data) {
    reset(data.company, data.role);
    state.source = "curated";
    state.data.stack = data.stack || [];
    (data.questions || []).forEach(appendItem);
    // Show the set's role as a hint rather than writing it into the box: a
    // written value would silently follow the visitor to the next company.
    if (els.role && !tidy(els.role.value)) els.role.placeholder = data.role || ROLE_HINT;
    setNote("Hand-written set · " + data.company + (data.role ? " · " + data.role : ""));
    wireDownload();
  }

  /* ------------------------------------------------------ live generation -- */
  function readStream(res, onMsg) {
    function each(line) {
      line = line.trim();
      if (!line) return;
      try { onMsg(JSON.parse(line)); } catch (e) { /* ignore a malformed line */ }
    }
    if (!res.body || !res.body.getReader || typeof TextDecoder === "undefined") {
      return res.text().then(function (t) { t.split("\n").forEach(each); });
    }
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = "";
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) { buf += dec.decode(); each(buf); return; }
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split("\n");
        buf = lines.pop();
        lines.forEach(each);
        return pump();
      });
    }
    return pump();
  }

  function onMessage(msg) {
    if (msg.type === "meta") {
      state.source = msg.source || "ai";
      if (msg.company) state.data.company = msg.company;
      if (msg.role) state.data.role = msg.role;
    } else if (msg.type === "item" && msg.item) {
      appendItem(msg.item);
      setPending(true, "Writing question " + (state.data.questions.length + 1) + "…");
      setNote("Generating live · " + state.data.questions.length + " written so far");
    } else if (msg.type === "done") {
      setPending(false);
      state.data.stack = msg.stack || [];
      state.known = msg.known !== false;
      var who = state.data.company + " · " + state.data.role;
      var n = state.data.questions.length;
      setNote((state.source === "cache" ? "Generated earlier" : "Generated live") + " by AI for " + who + ". " +
        (msg.partial
          ? "Only " + n + " question" + (n === 1 ? "" : "s") + " came through before the AI timed out. Generate again for the full set. "
          : msg.coding === "missing"
            ? "The coding question didn't come through this time; generate again to get it. "
            : "") +
        (state.known
          ? "Review before you rely on it."
          : "We don't have reliable public information about " + state.data.company +
            ", so company-specific details are left in [brackets] for you to fill in."));
      if (els.role && !tidy(els.role.value)) els.role.placeholder = state.data.role || ROLE_HINT;
      wireDownload();
    } else if (msg.type === "error") {
      showError(msg.message);
    }
  }

  function generate(company, role, id, key) {
    if (!API) {
      showError("Live generation is offline right now. Pick one of the hand-written companies above.");
      return;
    }
    reset(company, role || "Software Engineer");
    inflight = key;
    showStatus("Writing an interview set for <b style=\"color:var(--text);margin-left:4px\">" +
      esc(company) + "</b>…");
    setNote("Generating live…");

    // The API sleeps when idle; the first request after that can take a while.
    // Once it has answered, a quiet moment is the AI writing, not a cold start.
    var responded = false;
    var slow = setTimeout(function () {
      if (id === runId && !responded && !state.errored) {
        showStatus("Waking the server up. The first request after a quiet spell can take up to a minute…");
      }
    }, 5000);

    ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    fetch(API + "/qa/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: company, role: role }),
      signal: ctl ? ctl.signal : undefined,
    })
      .then(function (res) {
        responded = true;
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            var e = new Error(j.message || "Couldn't generate a set right now. Try again in a moment.");
            e.fromServer = true;
            throw e;
          });
        }
        return readStream(res, function (msg) { if (id === runId) onMessage(msg); });
      })
      .then(function () {
        if (id !== runId) return;
        setPending(false);
        if (!state.errored && !state.data.questions.length) {
          showError("No questions came back. Try again in a moment.");
        } else {
          wireDownload();   // a set that ended early is still downloadable
        }
      })
      .catch(function (err) {
        if (id !== runId || (err && err.name === "AbortError")) return;
        showError(err && err.fromServer ? err.message
          : "Couldn't reach the generator. Check your connection and try again.");
      })
      .then(function () {
        clearTimeout(slow);
        if (id === runId) inflight = "";
      });
  }

  /* ------------------------------------------------------------------ run -- */
  function run(opts) {
    opts = opts || {};
    var company = tidy(els.company.value);
    var role = tidy(els.role.value);
    if (!company) { els.company.focus(); return; }
    if (!role && els.role) els.role.placeholder = ROLE_HINT;

    // A double click or Enter-then-click must not pay for the same set twice.
    var key = norm(company) + "|" + (norm(role) || "software engineer");
    if (inflight && inflight === key) return;

    var id = ++runId;
    if (ctl) { try { ctl.abort(); } catch (e) {} ctl = null; }
    inflight = "";

    var slug = slugify(company);
    var tryCurated = !indexLoaded || (index[slug] && index[slug].curated);
    reset(company, role);
    showStatus("Loading <b style=\"color:var(--text);margin-left:4px\">" + esc(company) + "</b>…");
    setNote("Working…");

    (tryCurated ? fetchCurated(slug) : Promise.resolve(null)).then(function (data) {
      if (id !== runId) return;
      if (data && roleMatches(role, data, slug)) { showCurated(data); return; }
      if (opts.curatedOnly) { els.detail.innerHTML = ""; setNote(""); return; }
      generate(company, role, id, key);
    });
  }

  /* ------------------------------------------------ chips and first load -- */
  function warmUp() {
    // Wake the sleeping API while the visitor reads, so their first request is fast.
    if (!API || typeof fetch === "undefined") return;
    try { fetch(API + "/health", { mode: "no-cors", cache: "no-store" }).catch(function () {}); } catch (e) {}
  }

  function setupChips(companies) {
    if (els.chips) {
      els.chips.innerHTML = companies.slice(0, 10).map(function (c) {
        return '<button class="chip" type="button" data-company="' + esc(c.name) + '"' +
          (c.curated ? ">" + esc(c.name)
            : ' title="Generated live by AI" aria-label="' + esc(c.name) + ', generated live by AI">' +
              esc(c.name) + '<span class="chip__ai" aria-hidden="true">AI</span>') + "</button>";
      }).join("");
      els.chips.querySelectorAll(".chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          els.company.value = chip.getAttribute("data-company");
          els.role.value = "";   // a chip means "this company's standard set"
          run();
        });
      });
    }
    var dl = document.getElementById("genCompanies");
    if (dl) dl.innerHTML = companies.map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join("");
  }

  els.btn.addEventListener("click", function () { run(); });
  els.company.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
  els.role.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
  // A new company invalidates the previous set's role hint.
  els.company.addEventListener("input", function () {
    if (els.role && !tidy(els.role.value)) els.role.placeholder = ROLE_HINT;
  });

  setDownloadEnabled(false);
  warmUp();

  fetch(base + "/data/companies.json")
    .then(function (r) { if (!r.ok) throw new Error("companies.json " + r.status); return r.json(); })
    .then(function (idx) {
      var companies = idx.companies || [];
      companies.forEach(function (c) { index[c.slug || slugify(c.name)] = c; });
      indexLoaded = true;
      setupChips(companies);
    })
    .catch(function () { /* leave indexLoaded false: hand-written sets are still tried first */ })
    .then(function () {
      // Show the flagship hand-written set so the panel is never empty, unless
      // the visitor has already started typing or running. Never spends a live
      // generation on page load.
      if (runId === 0 && !tidy(els.company.value)) {
        els.company.value = "JPMorgan Chase";
        run({ curatedOnly: true });
      }
    });
})();
