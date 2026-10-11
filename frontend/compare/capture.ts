import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test, type Page } from "@playwright/test";
import { installStubs } from "../e2e/stubs";

/**
 * 앱 화면과 목업 프레임을 나란히 붙인 PNG를 만든다 — `pnpm compare` (#152).
 *
 * <p>결과는 `compare-out/<이름>-<폭>.png`. PR 본문에 그대로 붙인다.
 * 목업은 `support.js`·`<x-dc>`·`<helmet>`을 걷어낸 plain HTML로 연다 — 런타임 없이도 정적 마크업이라
 * 그대로 그려진다.
 */

const DESIGN = resolve(__dirname, "../../docs/design/kaldi-note-design");
const OUT = resolve(__dirname, "../compare-out");

/**
 * 「오늘」. 스텁 픽스처가 2026-09에 몰려 있어 실제 날짜로 찍으면 홈 달력이 빈 달이 된다.
 * e2e(home-calendar)와 같은 값이고, 목업 CW1도 09.19를 선택한 상태다.
 */
const TODAY = new Date("2026-09-19T01:00:00Z");

const VIEWPORT = {
  390: { width: 390, height: 844 },
  1440: { width: 1440, height: 900 },
} as const;

interface Shot {
  /** 목업 파일 — `docs/design/kaldi-note-design/` 기준 경로. */
  readonly file: string;
  /** 그 파일에서 이 폭의 프레임 중 몇 번째인가. `null`이면 프레임 없이 페이지 전체. */
  readonly frame: number | null;
  /** 이미지 위에 붙는 목업 쪽 이름. */
  readonly label: string;
}

interface Pair {
  readonly name: string;
  readonly path: string;
  readonly shots: Partial<Record<keyof typeof VIEWPORT, Shot>>;
}

const HOME_M = "screens/01 Home - Mobile.dc.html";
const HOME_W = "screens/01 Home - Web.dc.html";
const RECIPES_M = "screens/02 Recipes and Cups - Mobile.dc.html";
const RECIPES_W = "screens/02 Recipes and Cups - Web.dc.html";
const MORE = "screens/05 More and Settings.dc.html";

/** 프레임 번호는 파일 안 등장 순서다. 라벨은 목업의 프레임 배지 그대로. */
const PAIRS: readonly Pair[] = [
  {
    name: "home",
    path: "/",
    shots: {
      390: { file: HOME_M, frame: 0, label: "C1 홈 — 내 기록" },
      1440: { file: HOME_W, frame: 0, label: "CW1 홈 — 내 기록" },
    },
  },
  {
    name: "recipes",
    path: "/recipes",
    shots: {
      390: { file: RECIPES_M, frame: 0, label: "RM1 레시피 · 내 서랍" },
      1440: { file: RECIPES_W, frame: 1, label: "RW2 내 서랍" },
    },
  },
  {
    name: "recipes-public",
    path: "/recipes?scope=PUBLIC",
    shots: {
      390: { file: RECIPES_M, frame: 1, label: "RM2 둘러보기" },
      1440: { file: RECIPES_W, frame: 0, label: "RW1 레시피 둘러보기" },
    },
  },
  {
    name: "brews",
    path: "/brews",
    shots: {
      390: { file: RECIPES_M, frame: 5, label: "BM1 내 잔" },
      1440: { file: RECIPES_W, frame: 3, label: "BW1 내 잔" },
    },
  },
  {
    name: "more",
    path: "/more",
    shots: {
      390: { file: MORE, frame: 0, label: "M1 더보기" },
      // 목업에 웹 /more가 없다 — 그 자리를 대체하는 /settings + 아바타 메뉴 프레임이다.
      1440: { file: MORE, frame: 0, label: "W /settings + 아바타 메뉴" },
    },
  },
  {
    name: "kit",
    path: "/dev/kit",
    shots: {
      1440: {
        file: "system/Design System.dc.html",
        frame: null,
        label: "Design System",
      },
    },
  },
];

/** `.dc.html`에서 런타임을 걷어낸 plain HTML 파일을 만들고 그 URL을 준다. */
function plainMockup(file: string): string {
  const source = readFileSync(join(DESIGN, file), "utf8");
  const open = /<x-dc[^>]*>/.exec(source);
  const close = source.lastIndexOf("</x-dc>");
  if (open === null || close === -1) throw new Error(`<x-dc>가 없다: ${file}`);

  const inner = source.slice(open.index + open[0].length, close);
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(inner)?.[1] ?? "";
  const body = inner.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  // 이미지 같은 상대 경로가 원래 폴더를 보도록 base를 단다.
  const base = pathToFileURL(dirname(join(DESIGN, file))).href + "/";
  const html = `<!doctype html><html><head><meta charset="utf-8"><base href="${base}">${helmet}</head><body>${body}</body></html>`;

  const out = join(OUT, "_mockup", file.replace(/[/ ]/g, "_"));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return pathToFileURL(out).href;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

async function mockupShot(page: Page, width: 390 | 1440, shot: Shot) {
  await page.setViewportSize(
    shot.frame === null ? VIEWPORT[width] : { width: 1600, height: 1000 },
  );
  await page.goto(plainMockup(shot.file));
  await settle(page);
  if (shot.frame === null) return page.screenshot({ fullPage: true });

  const { height } = VIEWPORT[width];
  return page
    .locator(`div[style*="width:${width}px; height:${height}px"]`)
    .nth(shot.frame)
    .screenshot();
}

async function sideBySide(
  page: Page,
  panels: readonly { label: string; png: Buffer }[],
): Promise<Buffer> {
  const figures = panels
    .map(
      ({ label, png }) =>
        `<figure style="margin:0"><figcaption style="margin:0 0 8px;color:#fff">${label}</figcaption>` +
        `<img style="display:block" src="data:image/png;base64,${png.toString("base64")}"></figure>`,
    )
    .join("");
  await page.setViewportSize({ width: 800, height: 600 });
  await page.setContent(
    `<body style="margin:0;padding:24px;display:flex;gap:24px;align-items:flex-start;width:max-content;background:#555;font:600 14px system-ui">${figures}</body>`,
  );
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete),
  );
  return page.screenshot({ fullPage: true });
}

for (const pair of PAIRS) {
  for (const [w, shot] of Object.entries(pair.shots)) {
    const width = Number(w) as 390 | 1440;
    test(`${pair.path} · ${width}`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.clock.setFixedTime(TODAY);
      await installStubs(page);
      await page.setViewportSize(VIEWPORT[width]);
      await page.goto(pair.path);
      await settle(page);
      const app = await page.screenshot({ fullPage: shot!.frame === null });

      const mock = await mockupShot(page, width, shot!);
      const png = await sideBySide(page, [
        { label: `앱 ${pair.path} · ${width}`, png: app },
        { label: `목업 ${shot!.file.split("/").pop()} · ${shot!.label}`, png: mock },
      ]);

      mkdirSync(OUT, { recursive: true });
      writeFileSync(join(OUT, `${pair.name}-${width}.png`), png);
    });
  }
}
