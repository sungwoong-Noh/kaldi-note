/**
 * 홈화면 아이콘 3장을 굽는다. **한 번 굽고 나면 다시 돌릴 일이 거의 없다** — 결과 PNG를
 * 저장소에 커밋하므로 빌드가 이 스크립트에 의존하지 않는다.
 *
 *   cd frontend && node scripts/make-icons.mjs
 *
 * 의존성을 새로 넣지 않으려고 Playwright(이미 devDependency다)로 SVG를 렌더해 캡처한다.
 *
 * ★ 도형의 원본은 `src/app/icon.svg`다(docs/specs/2026-09-05-polish.md).
 *   64px 기준 rx=12·font-size=40이므로 비율은 각각 0.1875·0.625다. 한쪽만 바꾸면
 *   파비콘과 홈화면 아이콘이 다른 앱처럼 보인다.
 *
 * maskable만 도형이 다르다 — 안드로이드 런처가 가장자리를 최대 20%까지 깎으므로
 * 모서리를 둥글리지 않고(런처가 깎는다) 글자를 더 작게 그린다.
 */
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const OUT = new URL("../public/icons/", import.meta.url);

/** `src/app/icon.svg`의 비율. 바꾸면 그쪽도 함께 바꾼다. */
const CORNER_RATIO = 12 / 64;
const GLYPH_RATIO = 40 / 64;

/**
 * 바탕색은 `globals.css`의 `--brand`를 **읽어서** 쓴다. 베껴 적으면 토큰을 고쳐도
 * 아이콘만 옛 색으로 남는다(docs/design/2026-09-08-brand.md).
 *
 * <p>라이트 값을 쓴다 — 진한 브라운 위에 흰 글자가 7.44:1이다. 다크 값(`#c9a98a`)은
 * 밝아서 흰 글자가 2.20:1로 읽히지 않는다.
 */
const GLOBALS_CSS = new URL("../src/app/globals.css", import.meta.url);
const css = await readFile(GLOBALS_CSS, "utf8");
const brand = css
  .slice(0, css.indexOf("@media (prefers-color-scheme: dark)"))
  .match(/--brand:\s*(#[0-9a-fA-F]{6})\s*;/)?.[1];

if (!brand) throw new Error("globals.css의 :root에서 --brand를 찾지 못했다");
console.log(`바탕색 ${brand} (globals.css의 --brand)`);

/**
 * @param {number} size 캔버스 한 변
 * @param {number} glyphRatio 글자 높이가 캔버스에서 차지할 비율
 * @param {number} cornerRatio 모서리 반지름 비율. maskable은 0이다
 */
const svg = (size, glyphRatio, cornerRatio) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * cornerRatio)}" fill="${brand}"/>
  <text x="50%" y="50%" fill="#ffffff" font-family="Helvetica, Arial, sans-serif"
        font-weight="700" font-size="${Math.round(size * glyphRatio)}"
        text-anchor="middle" dominant-baseline="central">k</text>
</svg>`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const [name, size, glyphRatio, cornerRatio] of [
  ["icon-192.png", 192, GLYPH_RATIO, CORNER_RATIO],
  ["icon-512.png", 512, GLYPH_RATIO, CORNER_RATIO],
  ["icon-512-maskable.png", 512, 0.42, 0],
]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(svg(size, glyphRatio, cornerRatio));
  await page.screenshot({
    path: new URL(name, OUT).pathname,
    omitBackground: false,
  });
  await page.close();
  console.log(`✓ ${name} (${size}x${size})`);
}

await browser.close();
