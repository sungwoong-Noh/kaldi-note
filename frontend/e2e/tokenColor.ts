import type { Page } from "@playwright/test";

/**
 * 색 토큰 하나를 **브라우저가 계산한 형식 그대로** 돌려준다.
 *
 * <p>값을 리터럴로 적지 않는 이유가 있다. 토큰이 oklch가 되면서 브라우저는
 * `getComputedStyle().color`를 `lab(32.3428 15.484 17.6531)` 형태로 돌려준다
 * (2026-09-17 실측, Chromium). 색공간 표기와 자릿수는 브라우저 버전에 따라 달라질 수 있어,
 * 문자열로 박으면 **토큰을 고치지 않아도 언젠가 깨진다.**
 *
 * <p>대신 같은 페이지에서 `color: var(--이름)`을 실제로 계산시켜 기준을 만든다. 그러면
 * 검사하는 것이 「색이 무슨 값인가」가 아니라 **「이 요소가 그 토큰을 쓰는가」**가 된다 —
 * 애초에 이 스위트가 잡으려던 것이 그것이다(클래스 이름을 틀리거나 토큰이 생성되지 않는 경우).
 *
 * <p>다크 모드에서도 그대로 쓴다. `emulateMedia`로 스킴을 바꾸면 `:root` 값이 바뀌고
 * 이 함수가 만드는 기준값도 함께 바뀐다.
 */
export async function tokenColor(page: Page, name: string): Promise<string> {
  return page.evaluate((token) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--${token})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}
