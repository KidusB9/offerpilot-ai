# OfferPilot AI — build contract for page authors

You are adding pages/data to a **zero-dependency static site generator**. Follow this exactly so everything stays consistent and the build passes.

## The generator
- Each page lives in `web/src/pages/<name>/` with **two files**:
  - `meta.json` — `{ "title", "description", "keywords"?, "slug"?, "ogType"?, "priority"?, "robots"?, "jsonld"?: [ ... ] }`
    - `title` ≤ 60 chars, `description` 140–160 chars, both unique per page and SEO-tuned.
    - `slug` defaults to the folder name; nested paths are allowed (e.g. folder `compare-lockedin-ai` with `"slug": "compare/lockedin-ai"`).
    - `jsonld` is an array of schema.org objects; include the most relevant type(s).
  - `body.html` — the inner HTML placed inside `<main>`. **No** `<html>`, `<head>`, `<nav>`, or `<footer>` — those are injected.
- Links are **root-absolute**: write `href="/pricing/"`, `src="/scripts/x.js"`. The build rewrites `/` to the deploy base path automatically. Never hardcode the base path or the domain.
- Internal page URLs always end with a trailing slash: `/interview-copilot/`, `/blog/slug/`.

## Design system (already in `/styles/main.css` — do not add new CSS files)
- Fonts: Space Grotesk (display/headings), IBM Plex Sans (body), IBM Plex Mono (`.mono`, labels, code).
- Color tokens: `--cyan #6EE7FF`, `--iris #8B7BFF`, `--live #37E39B` (status only), `--ink #05070A`, `--text`, `--muted`. Aurora = cyan→iris gradient (`.grad-text`, `.btn--solid`).
- Reusable classes: `.wrap` (max-width container), `.section` / `.section--tight`, `.eyebrow` (mono label; add `.eyebrow--num` with `data-num`), `h1/h2/h3`, `.lede`, `.balance`, `.grad-text`.
  - Buttons: `.btn .btn--solid|--ghost` + optional `.btn--lg .btn--block`; arrow uses `<span class="btn__arr">→</span>`.
  - Surfaces: `.card`, `.pill`, `.grid .grid--2|3|4`, `.split (.split--rev)` with `.split__body`/`.split__media`.
  - Sections: `.section-head (.center)`, `.steps`/`.step` (auto-numbered), `.stats`/`.stat`, `.feat`/`.feat__icon`.
  - Pricing: `.plans`/`.plan (.plan--feat)`, `.plan__badge/__name/__price/__was`, `<ul>` auto-bullets.
  - Comparison: `.cmp > table`, `thead th.us`, `td.col-us`, `.yes`/`.no`.
  - Testimonials: `.quote`/`.quote__who`/`.quote__ava`. FAQ: `.faq > details > summary + p`.
  - CTA: `.cta-band`. Prose/blog: `.prose`, `.article-head .meta`, `.postcard`.
  - Add `class="reveal"` to major blocks for scroll-in animation.
  - Status dot: `<span class="dot dot--live"></span>`.
- Icons: inline `<svg ... stroke="currentColor" stroke-width="1.6">`, 22×22, no external icon libs.

## Voice & copy
- Confident, technical, plain. Active voice. Sentence case headings. No hype filler.
- This is a **preparation & accessibility** tool. Emphasize on-device transcription, screen-share-safe overlay, company-specific prep, and price. Never claim to help cheat; frame as prep/assist.
- Product names: **OfferPilot AI** (umbrella), **Interview Copilot**, **Code Copilot**.
- Pricing: Free (20 min/day), Pro **$19/mo**, Ultimate **$29/mo** unlimited, Lifetime **$299**. Competitor LockedIn AI: $29.99–$54.99/mo, ~$1,499 lifetime. We are cheaper.

## Reference before you write
Read these for the exact pattern: `web/src/pages/home/body.html`, `web/src/pages/home/meta.json`, `web/src/styles/main.css`, `web/src/partials/nav.html`, `web/src/data/qa/jpmorgan-chase.json`.
