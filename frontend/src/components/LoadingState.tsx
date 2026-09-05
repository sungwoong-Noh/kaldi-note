"use client";

import { useEffect, useState } from "react";

/** 이 값보다 빨리 끝나는 응답에서는 아무것도 그리지 않는다. */
const SHOW_AFTER_MS = 200;

/**
 * 로딩 중 표시.
 *
 * <p><b>즉시 그리지 않는 이유:</b> 빠른 응답에서 흰 화면 → 표시 → 콘텐츠로 세 번 바뀌면 빈 화면보다
 * 나빠 보인다. 200ms를 넘겨 실제로 기다리게 될 때만 나타난다
 * (docs/specs/2026-09-05-polish.md).
 */
export function LoadingState() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="불러오는 중"
      className="flex items-center justify-center py-12"
    >
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100"
      />
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
