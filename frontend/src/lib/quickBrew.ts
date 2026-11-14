"use client";

import { useSyncExternalStore } from "react";

/**
 * 빠른 기록 시트를 어디서든 연다(시안 10 B — 「어느 화면에서든 열리는 시트」). Toast와 같은 모듈 저장소다 —
 * 상단 바·기록 탭·홈이 서로를 몰라도 같은 시트 하나를 연다. 시트 자체는 `QuickBrewHost`가 그린다.
 */
export type QuickBrewOpen = { start: "record" | "same" } | null;

let current: QuickBrewOpen = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openQuickBrew(start: "record" | "same" = "record") {
  current = { start };
  emit();
}

export function closeQuickBrew() {
  current = null;
  emit();
}

export function useQuickBrew(): QuickBrewOpen {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}
