import { expect, test, type Page } from "@playwright/test";
import { installStubs } from "./stubs";
import { BUTTON_BASE, BUTTON_VARIANT } from "../src/components/ui/Button";
import { THEME_KEY } from "../src/lib/theme";

/**
 * 버튼 색 정합 — docs/specs/2026-09-21-button-color-fidelity.md
 *
 * <p>클래스 이름이 아니라 **브라우저가 실제로 칠한 색**을 재서 토큰 값과 대조한다
 * (`AC-DS2-19`처럼 클래스 문자열만 다르면 통과하는 검사로는 `bg-accent`가 그랬듯
 * 색이 어긋나도 잡히지 않는다).
 *
 * <p>`ghost` 변형은 이 앱 어디에서도 아직 쓰이지 않는다(사용처 0곳). 화면을 여는 방식으로는
 * 잴 수 없어서, `Button.tsx`가 내보내는 클래스 상수를 페이지에 직접 꽂는 하네스를 쓴다.
 * 이 export는 테스트를 위해 새로 뚫는 구멍이 아니라 `AC-BTN-15`(단일 출처)가 어차피
 * 요구하는 것이다.
 */

const HARNESS_ID = "btn-probe";

/** 토큰 이름을 브라우저가 계산한 색 문자열로 바꾼다. 비교의 기준이 된다. */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

/** 변형 클래스를 가진 버튼을 페이지에 꽂는다. */
async function mount(
  page: Page,
  variant: keyof typeof BUTTON_VARIANT,
  disabled = false,
): Promise<void> {
  await page.evaluate(
    ({ cls, id, off }) => {
      document.getElementById(id)?.remove();
      const el = document.createElement("button");
      el.id = id;
      el.className = cls;
      el.textContent = "저장";
      el.disabled = off;
      document.body.appendChild(el);
    },
    {
      cls: `${BUTTON_BASE} ${BUTTON_VARIANT[variant]}`,
      id: HARNESS_ID,
      off: disabled,
    },
  );
}

async function styleOf(page: Page): Promise<{
  background: string;
  color: string;
  borderWidth: string;
  borderColor: string;
  opacity: string;
}> {
  return page.locator(`#${HARNESS_ID}`).evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      color: s.color,
      borderWidth: s.borderTopWidth,
      borderColor: s.borderTopColor,
      opacity: s.opacity,
    };
  });
}

async function openLight(page: Page): Promise<void> {
  await installStubs(page);
  await page.goto("/more");
  await page.waitForLoadState("networkidle");
}

async function openDark(page: Page): Promise<void> {
  await installStubs(page);
  await page.addInitScript(
    ([key]) => window.localStorage.setItem(key, "dark"),
    [THEME_KEY],
  );
  await page.goto("/more");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
}

test.describe("버튼 색 — 라이트", () => {
  test("AC-BTN-04 · primary가 먹색으로 칠해진다", async ({ page }) => {
    await openLight(page);
    await mount(page, "primary");
    const style = await styleOf(page);

    expect(style.background).toBe(await token(page, "ink"));
    expect(style.color).toBe(await token(page, "on-ink"));
    expect(style.background).not.toBe(await token(page, "accent"));
  });

  test("AC-BTN-05 · secondary가 표면색 + 1px 테두리다", async ({ page }) => {
    await openLight(page);
    await mount(page, "secondary");
    const style = await styleOf(page);

    expect(style.background).toBe(await token(page, "surface"));
    expect(style.borderWidth).toBe("1px");
    expect(style.borderColor).toBe(await token(page, "border"));
    expect(style.color).toBe(await token(page, "ink"));
  });

  test("AC-BTN-06 · ghost는 배경이 없다", async ({ page }) => {
    await openLight(page);
    await mount(page, "ghost");
    const style = await styleOf(page);

    expect(style.background).toBe("rgba(0, 0, 0, 0)");
    expect(style.color).toBe(await token(page, "accent"));
  });

  test("AC-BTN-07 · disabled가 가라앉은 면으로 칠해진다", async ({ page }) => {
    await openLight(page);
    await mount(page, "primary", true);
    const style = await styleOf(page);

    expect(style.background).toBe(await token(page, "sunken"));
    expect(style.color).toBe(await token(page, "ink-disabled"));
    // opacity-50이 남아 있으면 sunken 위에 겹쳐 목업보다 흐려진다.
    expect(style.opacity).toBe("1");
  });
});

test.describe("버튼 색 — hover", () => {
  const CASES = [
    ["AC-BTN-08", "primary", "ink-hover"],
    ["AC-BTN-09", "secondary", "sunken"],
    ["AC-BTN-10", "ghost", "accent-wash"],
  ] as const;

  for (const [ac, variant, expected] of CASES) {
    test(`${ac} · ${variant} hover 배경이 ${expected}다`, async ({ page }) => {
      await openLight(page);
      await mount(page, variant);
      await page.locator(`#${HARNESS_ID}`).hover();

      expect((await styleOf(page)).background).toBe(
        await token(page, expected),
      );
    });
  }

  test("AC-BTN-11 · disabled는 hover해도 변하지 않는다", async ({ page }) => {
    await openLight(page);
    await mount(page, "primary", true);
    const before = (await styleOf(page)).background;

    await page.locator(`#${HARNESS_ID}`).hover({ force: true });
    const after = (await styleOf(page)).background;

    expect(after).toBe(await token(page, "sunken"));
    expect(after).toBe(before);
  });
});

test.describe("버튼 색 — 링크와 버튼이 같다", () => {
  const VARIANTS = ["primary", "secondary", "ghost"] as const;

  for (const variant of VARIANTS) {
    test(`AC-BTN-14 · ${variant} 링크와 버튼의 색이 같다`, async ({
      page,
    }) => {
      await openLight(page);

      const pair = await page.evaluate(
        ({ base, cls }) => {
          const make = (tag: "button" | "a") => {
            const el = document.createElement(tag);
            el.className = `${base} ${cls}`;
            el.textContent = "저장";
            document.body.appendChild(el);
            const s = getComputedStyle(el);
            const read = { bg: s.backgroundColor, fg: s.color };
            el.remove();
            return read;
          };
          return { button: make("button"), link: make("a") };
        },
        { base: BUTTON_BASE, cls: BUTTON_VARIANT[variant] },
      );

      expect(pair.link.bg).toBe(pair.button.bg);
      expect(pair.link.fg).toBe(pair.button.fg);
    });
  }

  test("AC-BTN-14 · 실제 화면의 링크 버튼도 먹색이다", async ({ page }) => {
    // 위 하네스는 컴포넌트가 실제로 이 상수를 쓰는지는 보증하지 않는다.
    // ButtonLink가 렌더한 진짜 CTA를 재야 그것이 드러난다.
    //
    // /recipes/3는 스텁에서 kasuyaRecipe(ownerUserId: 11 = me.id)로 매핑된다 —
    // /recipes/\d+ 기본 스텁은 hoffmann(제3자 소유)이라 "이 레시피로 내렸다" CTA가 안 뜬다.
    await installStubs(page);
    await page.goto("/recipes/3");
    await page.waitForLoadState("networkidle");

    const cta = page.getByRole("link", { name: "이 레시피로 내렸다" });
    await expect(cta).toBeVisible();

    expect(
      await cta.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(await token(page, "ink"));
  });
});

test.describe("버튼 색 — 다크", () => {
  test("AC-BTN-12 · 다크에서 primary가 저절로 반전된다", async ({ page }) => {
    await openDark(page);
    await mount(page, "primary");
    const style = await styleOf(page);

    expect(style.background).toBe(await token(page, "ink"));
    expect(style.color).toBe(await token(page, "on-ink"));
  });

  test("AC-BTN-13 · 다크에서 primary hover가 어두워진다", async ({ page }) => {
    await openDark(page);
    await mount(page, "primary");
    await page.locator(`#${HARNESS_ID}`).hover();

    expect((await styleOf(page)).background).toBe(
      await token(page, "ink-hover"),
    );
  });
});
