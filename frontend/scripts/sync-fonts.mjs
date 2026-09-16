/**
 * `@fontsource`에서 **필요한 조각만** `public/fonts/`로 복사하고 `src/app/fonts.css`를 만든다.
 *
 * <p>패키지 CSS를 `@import`하지 않는 이유가 둘 있다.
 *
 * <ol>
 *   <li><b>`korean` 통짜 서브셋이 505KB다.</b> 조각 방식(94개)이면 브라우저가 페이지에 실제로
 *       쓰인 글자가 있는 조각만 받는다. 통짜를 링크하면 한 글자 때문에 505KB를 받는다.
 *   <li><b>`woff` fallback이 딸려온다.</b> woff2는 2016년 이후 모든 브라우저가 지원하므로
 *       woff는 용량만 두 배로 만든다.
 * </ol>
 *
 * <p>웨이트를 제한하는 이유는 `docs/specs/2026-09-17-design-system-v2.md`에 있다 —
 * 하나가 늘 때마다 한글 조각 전체(94개 · 약 1.3MB)가 한 벌 더 붙는다.
 *
 * <p>사용법: `node scripts/sync-fonts.mjs`
 */
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

const PKG = "node_modules/@fontsource";
const OUT_DIR = "public/fonts";
const OUT_CSS = "src/app/fonts.css";

/**
 * 어떤 폰트의 어떤 웨이트를 쓸지. **스펙이 정한 목록이고 임의로 늘리지 않는다.**
 *
 * `subsets`가 있으면 그 이름이 들어간 조각만 가져온다(Mono는 수치 전용이라 라틴만 쓴다).
 * 없으면 그 웨이트의 조각 전부를 가져온다(Sans는 한글이 필요하다).
 */
const WANTED = [
  { pkg: "ibm-plex-sans-kr", weights: ["400", "600"] },
  {
    pkg: "ibm-plex-mono",
    weights: ["400", "500"],
    subsets: ["latin", "latin-ext"],
  },
];

/** 주석 한 줄 + 그 뒤의 `@font-face { … }`를 통째로 뽑는다. */
function blocks(css) {
  return [...css.matchAll(/\/\*[^*]*\*\/\s*@font-face\s*\{[^}]*\}/g)].map(
    (match) => match[0],
  );
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const chunks = [];
const copied = new Set();

for (const { pkg, weights, subsets } of WANTED) {
  for (const weight of weights) {
    const css = await readFile(join(PKG, pkg, `${weight}.css`), "utf8");

    for (const block of blocks(css)) {
      const woff2 = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
      if (woff2 === undefined) continue;

      // 통짜 서브셋은 파일 하나가 505KB다. 조각으로만 간다.
      if (woff2.includes("-korean-")) continue;

      if (subsets !== undefined) {
        const stem = woff2
          .replace(`${pkg}-`, "")
          .replace(`-${weight}-normal.woff2`, "");
        if (!subsets.includes(stem)) continue;
      }

      // woff fallback을 버리고 서빙 경로로 바꾼다.
      chunks.push(
        block.replace(
          /src:[^;]+;/,
          `src: url(/fonts/${woff2}) format('woff2');`,
        ),
      );

      if (!copied.has(woff2)) {
        await copyFile(join(PKG, pkg, "files", woff2), join(OUT_DIR, woff2));
        copied.add(woff2);
      }
    }
  }
}

const header = `/*
 * ★ 이 파일은 \`scripts/sync-fonts.mjs\`가 만든다. **손으로 고치지 않는다.**
 *
 * 웨이트와 서브셋은 그 스크립트의 WANTED가 정하고, 근거는
 * docs/specs/2026-09-17-design-system-v2.md에 있다.
 *
 * face ${chunks.length}개 · 파일 ${copied.size}개
 */
`;

await writeFile(OUT_CSS, `${header}\n${chunks.join("\n\n")}\n`, "utf8");

const sizes = await Promise.all(
  [...copied].map(async (name) => (await readdir(OUT_DIR), name)),
);
console.log(`✓ ${OUT_CSS} — @font-face ${chunks.length}개`);
console.log(`✓ ${OUT_DIR} — woff2 ${sizes.length}개`);
