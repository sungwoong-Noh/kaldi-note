import type { ReactNode } from "react";

/**
 * 모든 화면의 공통 컨테이너.
 *
 * <p>이전에는 같은 클래스 문자열이 화면마다 복붙돼 있었고 두 변종으로 갈라져 있었다
 * (`flex flex-col gap-6`이 붙은 것과 아닌 것). 거터를 24px로 올릴 때 11곳을 동시에
 * 고쳐야 했던 것이 그 비용이다.
 *
 * @param stack 자식을 세로 스택으로 배치한다. 폼 화면이 쓰던 변형이다.
 */
export function Shell({
  children,
  stack = false,
  className = "",
}: {
  children: ReactNode;
  stack?: boolean;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto w-full max-w-2xl px-6 py-6 ${stack ? "flex flex-col gap-6" : ""} ${className}`
        .replace(/\s+/g, " ")
        .trim()}
    >
      {children}
    </main>
  );
}
