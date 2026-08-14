/* Generate the 1200x630 Open Graph card as a PNG using sharp (if available).
 * Run: node scripts/make-og.mjs   ->   src/assets/og-default.png
 * Falls back gracefully: if sharp isn't installed it prints instructions. */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "assets", "og-default.png");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="aur" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6EE7FF"/><stop offset="0.55" stop-color="#7DB4FF"/><stop offset="1" stop-color="#8B7BFF"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.1" r="0.9">
      <stop offset="0" stop-color="#8B7BFF" stop-opacity="0.5"/><stop offset="1" stop-color="#05070A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.05" cy="0.05" r="0.7">
      <stop offset="0" stop-color="#6EE7FF" stop-opacity="0.35"/><stop offset="1" stop-color="#05070A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#05070A"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <g transform="translate(84,150)">
    <g transform="translate(0,-42)">
      <path d="M28 0 4 13v26l24 13 24-13V13L28 0Z" stroke="url(#aur)" stroke-width="2.4" fill="rgba(110,231,255,0.06)"/>
      <path d="M28 13v26M12 19v14l16 8.6 16-8.6v-14" stroke="url(#aur)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="28" cy="26" r="4.6" fill="#37E39B"/>
      <text x="70" y="34" font-family="Space Grotesk, Segoe UI, sans-serif" font-size="34" font-weight="700" fill="#E8EEF5">OfferPilot<tspan fill="#6EE7FF"> AI</tspan></text>
    </g>
    <text x="0" y="118" font-family="Space Grotesk, Segoe UI, sans-serif" font-size="82" font-weight="700" fill="#E8EEF5" letter-spacing="-2">The interview help</text>
    <text x="0" y="212" font-family="Space Grotesk, Segoe UI, sans-serif" font-size="82" font-weight="700" letter-spacing="-2">
      <tspan fill="#E8EEF5">only </tspan><tspan fill="url(#aur)">you</tspan><tspan fill="#E8EEF5"> can see.</tspan>
    </text>
    <text x="0" y="272" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="27" fill="#93A1B2">Real-time, screen-share-safe copilot for live interviews &amp; coding tests.</text>
    <g transform="translate(0,312)" font-family="IBM Plex Mono, monospace" font-size="20">
      <rect x="0" y="0" width="16" height="16" rx="8" fill="#37E39B"/>
      <text x="26" y="14" fill="#93A1B2">On-device STT</text>
      <text x="220" y="14" fill="#93A1B2">·  Undetectable overlay</text>
      <text x="520" y="14" fill="#93A1B2">·  Company Q&amp;A</text>
      <text x="770" y="14" fill="#6EE7FF">·  from $0</text>
    </g>
  </g>
</svg>`;

try {
  const sharp = (await import("sharp")).default;
  await sharp(Buffer.from(svg)).png().toFile(OUT);
  console.log("✔ wrote", OUT);
} catch (e) {
  // Fallback: write the SVG so the reference at least resolves to an image.
  writeFileSync(OUT.replace(/\.png$/, ".svg"), svg);
  console.log("sharp unavailable (" + e.message + "). Wrote og-default.svg instead.");
  console.log("To get the PNG: npm i sharp && node scripts/make-og.mjs");
}
