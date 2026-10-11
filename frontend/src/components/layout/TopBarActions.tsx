"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TOPBAR_ACTIONS_ID } from "./WebTopBar";

/**
 * 화면의 동작 버튼을 상단 바 오른쪽 자리(`#topbar-actions`)에 넣는다 — 기록 작성·편집·상세
 * (docs/specs/2026-10-11-brew-form-fidelity.md AC-BREWFIT-03, docs/specs/2026-10-11-brew-detail-fidelity.md AC-BDETAIL-11).
 *
 * <p>자리가 없으면(단위 테스트처럼 상단 바 없이 그릴 때) 제자리에 그린다.
 */
export function TopBarActions({ children }: { children: ReactNode }) {
  const slot = useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById(TOPBAR_ACTIONS_ID),
    () => null,
  );
  if (slot !== null) return createPortal(children, slot);
  return <div className="flex justify-end gap-2">{children}</div>;
}

function noopSubscribe() {
  return () => {};
}
