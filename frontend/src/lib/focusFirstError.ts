/**
 * 폼 제출이 실패했을 때 포커스를 옮길 곳을 찾는다.
 * 우선순위: DOM 순서상 첫 번째 aria-invalid="true" 요소 → 없으면 [data-general-error].
 */
export function focusFirstInvalidField(container: HTMLElement | null): void {
  if (container === null) return;
  const target =
    container.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    container.querySelector<HTMLElement>("[data-general-error]");
  target?.focus();
}
