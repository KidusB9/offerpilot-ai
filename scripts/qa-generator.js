/* OfferPilot AI, Company Q&A Generator.
 *
 * Pick a company + role; the tool builds a sample interview Q&A database in the
 * exact schema the desktop Interview Copilot consumes ({questions:[{section,
 * question,answer,code,lang,keywords}]}). Popular companies ship curated,
 * hand-tuned sets; any other company gets a structured sample generated from a
 * role-aware template so the demo always returns something useful.
 */
(function () {
  "use strict";

  var base = (document.querySelector('meta[name="base-path"]') || {}).content || "";
  var root = document.getElementById("qaGen");
  if (!root) return;

  var els = {
    company: root.querySelector("#genCompany"),
    role: root.querySelector("#genRole"),
    btn: root.querySelector("#genRun"),
    chips: root.querySelector("#genChips"),
    list: root.querySelector("#genList"),
    detail: root.querySelector("#genDetail"),
    title: root.querySelector("#genTitle"),
    download: root.querySelector("#genDownload"),
  };
  var state = { data: null };

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function slugify(s) {
    return String(s || "").toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function highlight(code) {
    return esc(code)
      .replace(/(\/\/[^\n]*)/g, '<span class="cm">$1</span>')
      .replace(/(&quot;[^&]*?&quot;)/g, '<span class="st">$1</span>')
      .replace(/\b(public|private|static|void|int|var|new|return|class|if|else|for|foreach|while|using|SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|WITH|OVER|PARTITION BY|def|import|for|in|self|None|True|False)\b/g,
        '<span class="kw">$1</span>');
  }

  /* ---- template generator for companies without a curated set ---- */
  function generateTemplate(company, role) {
    var stackByRole = /data|analy|quant/i.test(role) ? ["Python", "SQL", "pandas"]
      : /front|react|ui/i.test(role) ? ["TypeScript", "React", "CSS"]
      : /sql|database|etl/i.test(role) ? ["SQL", "T-SQL", "Python"]
      : ["C#", ".NET", "SQL"];
    var lang = stackByRole[0] === "Python" ? "python" : stackByRole[0] === "SQL" || stackByRole[0] === "T-SQL" ? "sql" : "csharp";
    var codeSample = lang === "python"
      ? "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []  # O(n) time, O(n) space"
      : lang === "sql"
      ? "SELECT customer_id, SUM(amount) AS total\nFROM payments\nWHERE status = 'settled'\nGROUP BY customer_id\nORDER BY total DESC;  -- index (status, customer_id)"
      : "public int[] TwoSum(int[] nums, int target) {\n    var seen = new Dictionary<int,int>();\n    for (int i = 0; i < nums.Length; i++) {\n        if (seen.TryGetValue(target - nums[i], out var j)) return new[]{ j, i };\n        seen[nums[i]] = i;\n    }\n    return System.Array.Empty<int>(); // O(n) time, O(n) space\n}";

    return {
      company: company,
      role: role || "Software Engineer",
      generated: true,
      stack: stackByRole,
      questions: [
        { section: "Opening", question: "Tell me about yourself and why " + company + ".",
          answer: "Lead with a 60-second arc: who you are, your most relevant project, and one sentence on why " + company + " specifically, tie your strengths to what this team ships. End on a hook so you hand the conversation back.",
          keywords: ["intro", "background", "why", company.toLowerCase()] },
        { section: "Behavioral (STAR)", question: "Tell me about the most challenging project you've owned.",
          answer: "Use STAR. Spend most of the time on the Action in first person ('I…'), and land on a quantified Result plus the lesson. Pick a story whose lesson maps to what " + company + " values, correctness, reliability, or user impact.",
          keywords: ["star", "challenge", "ownership", "impact"] },
        { section: "Fundamentals", question: "Walk me through a core concept in " + stackByRole.join(", ") + ".",
          answer: "Define it crisply, then give the practical 'why it matters here', the performance or correctness consequence in production. Interviewers reward the trade-off framing, not the textbook definition.",
          keywords: stackByRole.map(function (s) { return s.toLowerCase(); }) },
        { section: "Coding", question: "Write an efficient solution and state its complexity.",
          answer: "Restate the problem and confirm assumptions, work one tiny example by hand, state the plan in 2 to 3 steps, THEN code the optimal approach and call out its Big-O time and space. Dry-run the example through your code before you say you're done.",
          code: codeSample, lang: lang,
          keywords: ["algorithm", "complexity", "optimal", "coding"] },
        { section: "System / Domain", question: "How would you design a reliable service for " + company + "'s domain?",
          answer: "Clarify scale and the failure you most fear, then reason about idempotency, retries, data consistency, and observability. Name what's downstream of your service, the 'who depends on this' instinct is the senior signal.",
          keywords: ["system design", "reliability", "idempotency", "scale"] },
        { section: "Closing", question: "Do you have any questions for us?",
          answer: "Always yes. Ask about how the team measures success in the first 90 days, the biggest technical challenge they're facing, and how they balance velocity with reliability, questions that show you're already thinking like a teammate.",
          keywords: ["questions", "closing", "culture"] },
      ],
    };
  }

  function fetchCurated(slug) {
    return fetch(base + "/data/qa/" + slug + ".json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function renderList(data) {
    els.title.textContent = data.company + (data.role ? " · " + data.role : "");
    var html = data.questions.map(function (q, i) {
      return '<div class="gen__qitem' + (i === 0 ? " is-active" : "") + '" data-i="' + i + '">' +
        '<div class="sec">' + esc(q.section) + "</div>" +
        '<div class="q">' + esc(q.question) + "</div></div>";
    }).join("");
    els.list.innerHTML = html;
    els.list.querySelectorAll(".gen__qitem").forEach(function (item) {
      item.addEventListener("click", function () {
        els.list.querySelectorAll(".gen__qitem").forEach(function (x) { x.classList.remove("is-active"); });
        item.classList.add("is-active");
        renderDetail(data.questions[+item.dataset.i]);
      });
    });
    renderDetail(data.questions[0]);
  }

  function renderDetail(q) {
    if (!q) { els.detail.innerHTML = ""; return; }
    var code = q.code ? '<pre class="code">' + highlight(q.code) + "</pre>" : "";
    els.detail.innerHTML =
      '<div class="sec">' + esc(q.section) + "</div>" +
      "<h3>" + esc(q.question) + "</h3>" +
      "<p>" + esc(q.answer) + "</p>" + code +
      (q.keywords && q.keywords.length
        ? '<p class="mono" style="font-size:12px;color:var(--muted-2);margin-top:14px">match keywords: ' + esc(q.keywords.join(", ")) + "</p>"
        : "");
    els.detail.scrollTop = 0;
  }

  function setLoading(company) {
    els.list.innerHTML = "";
    els.detail.innerHTML =
      '<div class="gen__loading"><span class="spinner"></span> Generating a sample Q&amp;A database for <b style="color:var(--text);margin-left:4px">' +
      esc(company) + "</b>…</div>";
    els.title.textContent = "Working…";
  }

  function run() {
    var company = (els.company.value || "").trim();
    var role = (els.role.value || "").trim();
    if (!company) { els.company.focus(); return; }
    setLoading(company);
    var slug = slugify(company);
    fetchCurated(slug).then(function (curated) {
      // Small delay so the "generating" state reads as real work.
      setTimeout(function () {
        var data = curated || generateTemplate(company, role);
        if (role && curated && !curated.role) data.role = role;
        state.data = data;
        renderList(data);
        wireDownload(data, slug);
      }, curated ? 380 : 620);
    });
  }

  function wireDownload(data, slug) {
    if (!els.download) return;
    var payload = { company: data.company, role: data.role, stack: data.stack || [], questions: data.questions };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    els.download.href = URL.createObjectURL(blob);
    els.download.download = slug + "_qa.json";
  }

  /* ---- chips (popular companies) from companies.json ---- */
  fetch(base + "/data/companies.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : { companies: [] }; })
    .then(function (idx) {
      var list = (idx.companies || []).slice(0, 10);
      if (els.chips) {
        els.chips.innerHTML = list.map(function (c) {
          return '<button class="chip" data-company="' + esc(c.name) + '" data-role="' + esc(c.role || "") + '">' + esc(c.name) + "</button>";
        }).join("");
        els.chips.querySelectorAll(".chip").forEach(function (chip) {
          chip.addEventListener("click", function () {
            els.company.value = chip.dataset.company;
            if (chip.dataset.role) els.role.value = chip.dataset.role;
            run();
          });
        });
      }
      // datalist for the input
      var dl = document.getElementById("genCompanies");
      if (dl) dl.innerHTML = (idx.companies || []).map(function (c) {
        return '<option value="' + esc(c.name) + '">';
      }).join("");
    });

  els.btn.addEventListener("click", run);
  els.company.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
  els.role.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });

  // Auto-run the flagship example on load so the panel is never empty.
  els.company.value = "JPMorgan Chase";
  els.role.value = "Software Engineer II, C#/.NET";
  run();
})();
