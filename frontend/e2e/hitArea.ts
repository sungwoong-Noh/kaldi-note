/**
 * 주어진 요소 중 **누르는 영역(hit area)**이 44×44에 못 미치는 것. 사람이 읽을 수 있는 문자열로 돌려준다.
 *
 * <p><b>보이는 크기가 아니라 누르는 영역을 잰다</b>(docs/decisions/0010). 박스와 `::before`·`::after`
 * 중 큰 쪽이다 — 의사 요소는 그 요소의 히트 테스트에 포함되므로, 보이는 박스가 36px여도 `hit-44`
 * 레이어가 44px를 채우면 실제로 누를 수 있다.
 *
 * <p><b>브라우저 안에서 돈다.</b> `evaluateAll`이 이 함수의 소스만 넘기므로 바깥의 것을 참조하지
 * 않는다 — 그래서 `meetsTouchTarget`을 못 쓰고 44가 여기 한 번 더 적힌다. 경계값 자체는
 * `AC-TOUCH-11`이 단위 테스트로 못박는다.
 */
export function undersized(elements: Element[]): string[] {
  const exempt = new Set(
    document.querySelectorAll(":is(p, h1, h2, h3, h4, h5, h6) a"),
  );
  return (
    elements
      .filter((el) => !exempt.has(el))
      // 미디어 쿼리로 숨긴 컨트롤(웹 상단 바 등)은 이 뷰포트에서 탭할 수 없다 —
      // 2026-09-19 홈 달력의 WebTopBar가 처음으로 이 경우를 만들었다.
      .filter((el) => (el as HTMLElement).checkVisibility())
      .map((el) => {
        // 라벨에 감싸인 컨트롤은 라벨 전체가 탭을 받는다. 사람이 실제로 누르는 것을 잰다
        // (docs/specs/2026-09-15-structure.md AC-STRUCT-04).
        const label = el.closest("label");
        const target = label !== null && label.contains(el) ? label : el;
        const r = target.getBoundingClientRect();
        let w = r.width;
        let h = r.height;
        for (const owner of new Set([target, el])) {
          for (const pseudo of ["::before", "::after"]) {
            const s = getComputedStyle(owner, pseudo);
            if (s.content === "none" || s.display === "none") continue;
            // 인라인 의사 요소는 width가 "auto"다 — NaN이면 박스만 본다.
            w = Math.max(w, parseFloat(s.width) || 0);
            h = Math.max(h, parseFloat(s.height) || 0);
          }
        }
        const name =
          (el as HTMLElement).innerText?.trim().slice(0, 20) ||
          el.getAttribute("aria-label") ||
          (el as HTMLInputElement).type ||
          el.tagName.toLowerCase();
        return { name: name.replace(/\s+/g, " "), w, h };
      })
      .filter((b) => b.w < 44 || b.h < 44)
      .map((b) => `${b.name} ${Math.round(b.w)}x${Math.round(b.h)}`)
  );
}

/** 화면의 모든 상호작용 요소. */
export const TARGETS = "button, a, input, select, textarea";
