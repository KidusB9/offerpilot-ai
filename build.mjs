#!/usr/bin/env node
/**
 * OfferPilot AI — zero-dependency static site generator.
 *
 * Assembles pages from a base HTML shell + shared partials + per-page content,
 * injects SEO metadata / JSON-LD, rewrites root-absolute links to the deploy
 * base path, and emits a fully static `dist/` (deployable to any static host).
 *
 *   node build.mjs            # build using site.config.json basePath
 *   SITE_BASE="" node build.mjs   # build for a root/custom domain (no basePath)
 *
 * Page format — each directory under src/pages/<slug>/ holds:
 *   meta.json  { title, description, keywords?, ogType?, jsonld?, robots?, priority? }
 *   body.html  the inner HTML placed inside <main>
 * The home page uses slug "" (src/pages/home) -> dist/index.html.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, cpSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "src");
const DIST = join(__dirname, "dist");
const CFG = JSON.parse(readFileSync(join(__dirname, "site.config.json"), "utf8"));

// Deploy base path. Env override lets a custom-domain build drop the subpath.
const BASE = process.env.SITE_BASE !== undefined ? process.env.SITE_BASE : CFG.basePath;
const BASE_URL = process.env.SITE_URL !== undefined ? process.env.SITE_URL : CFG.baseUrl;
const YEAR = "2026";

const read = (p) => readFileSync(p, "utf8");
const exists = (p) => existsSync(p);

/** Rewrite root-absolute href/src ("/x") to the base path ("/offerpilot-ai/x").
 *  Leaves external URLs, anchors (#), mailto:, and already-based links alone. */
function rebase(html) {
  if (!BASE) return html;
  return html
    .replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`)
    .replace(/url\(\/(?!\/)/g, `url(${BASE}/`);
}

const base = read(join(SRC, "templates", "base.html"));
const nav = read(join(SRC, "partials", "nav.html"));
const footer = read(join(SRC, "partials", "footer.html"));

function render(slug, meta, body) {
  const url = slug ? `${BASE_URL}/${slug}/` : `${BASE_URL}/`;
  const ogImage = `${BASE_URL}/assets/og-default.png`;
  const jsonld = (meta.jsonld || [])
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join("\n");
  const keywords = meta.keywords ? `<meta name="keywords" content="${meta.keywords}">` : "";
  const robots = meta.robots ? `<meta name="robots" content="${meta.robots}">` : `<meta name="robots" content="index,follow,max-image-preview:large">`;

  let out = base
    .replaceAll("{{TITLE}}", meta.title)
    .replaceAll("{{DESCRIPTION}}", meta.description)
    .replaceAll("{{CANONICAL}}", url)
    .replaceAll("{{OG_TYPE}}", meta.ogType || "website")
    .replaceAll("{{OG_IMAGE}}", ogImage)
    .replaceAll("{{SITE_NAME}}", CFG.name)
    .replaceAll("{{TWITTER}}", CFG.twitter)
    .replaceAll("{{KEYWORDS}}", keywords)
    .replaceAll("{{ROBOTS}}", robots)
    .replaceAll("{{JSONLD}}", jsonld)
    .replaceAll("{{NAV}}", nav)
    .replaceAll("{{FOOTER}}", footer)
    .replaceAll("{{BODY}}", body)
    .replaceAll("{{YEAR}}", YEAR)
    .replaceAll("{{BASE}}", BASE || "");

  return rebase(out);
}

function collectPages() {
  const dir = join(SRC, "pages");
  const pages = [];
  for (const name of readdirSync(dir)) {
    const pdir = join(dir, name);
    if (!statSync(pdir).isDirectory()) continue;
    const metaPath = join(pdir, "meta.json");
    const bodyPath = join(pdir, "body.html");
    if (!exists(metaPath) || !exists(bodyPath)) {
      console.warn(`  skip ${name} (missing meta.json or body.html)`);
      continue;
    }
    const meta = JSON.parse(read(metaPath));
    const slug = name === "home" ? "" : (meta.slug ?? name);
    pages.push({ name, slug, meta, body: read(bodyPath) });
  }
  return pages;
}

function build() {
  if (exists(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const pages = collectPages();
  for (const p of pages) {
    const outDir = p.slug ? join(DIST, p.slug) : DIST;
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "index.html"), render(p.slug, p.meta, p.body));
    console.log(`  page  /${p.slug || ""}`);
  }

  // Static assets copied verbatim.
  for (const d of ["styles", "scripts", "data", "assets"]) {
    const from = join(SRC, d);
    if (exists(from)) cpSync(from, join(DIST, d), { recursive: true });
  }

  // sitemap.xml
  const urls = pages
    .filter((p) => p.meta.robots !== "noindex,nofollow")
    .map((p) => {
      const loc = p.slug ? `${BASE_URL}/${p.slug}/` : `${BASE_URL}/`;
      const pri = p.meta.priority ?? (p.slug ? "0.7" : "1.0");
      return `  <url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>${pri}</priority></url>`;
    })
    .join("\n");
  writeFileSync(
    join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );

  // robots.txt
  writeFileSync(
    join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`
  );

  // .nojekyll so GitHub Pages serves _underscore paths and doesn't run Jekyll.
  writeFileSync(join(DIST, ".nojekyll"), "");

  // 404 fallback (GitHub Pages serves /404.html on unknown paths).
  const nf = pages.find((p) => p.name === "notfound");
  if (nf) writeFileSync(join(DIST, "404.html"), render("404", nf.meta, nf.body));

  console.log(`\n✔ Built ${pages.length} pages -> dist/  (base "${BASE || "/"}")`);
}

build();
