/**
 * 터치 타깃의 최소 변. `docs/conventions/frontend.md:179` —
 * 「터치 타깃은 최소 44×44px. 부엌에서 젖은 손으로 쓴다」.
 */
export const TOUCH_TARGET_PX = 44;

/**
 * 두 변이 **모두** 기준 이상인가.
 *
 * <p><b>반올림하지 않고 허용 오차도 두지 않는다.</b> `43.99`는 미달이다. 오차를 두는 순간
 * 「44px」이 사실상 43px가 되고, 다음 사람은 진짜 경계가 어디인지 알 수 없게 된다.
 */
export function meetsTouchTarget(box: {
  width: number;
  height: number;
}): boolean {
  return box.width >= TOUCH_TARGET_PX && box.height >= TOUCH_TARGET_PX;
}
