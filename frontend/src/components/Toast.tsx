"use client";

import { useSyncExternalStore } from "react";

const TOAST_DURATION_MS = 2400;

let currentMessage: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentMessage;
}

/** 짧은 성공 알림을 띄운다. 일정 시간 뒤 저절로 사라진다. */
export function showToast(message: string) {
  if (timer !== null) {
    clearTimeout(timer);
  }
  currentMessage = message;
  notify();
  timer = setTimeout(() => {
    currentMessage = null;
    timer = null;
    notify();
  }, TOAST_DURATION_MS);
}

/** 떠 있는 토스트를 즉시 지운다(테스트 격리용). */
export function clearToast() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (currentMessage !== null) {
    currentMessage = null;
    notify();
  }
}

/**
 * 성공 토스트 뷰포트 — 목업 README 「성공 토스트」(바텀 네비 위 16px 고정, `--ink` 배경 + `--on-ink` 본문).
 */
export function ToastViewport() {
  const message = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (message === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-toast
      className="pointer-events-none fixed inset-x-4 bottom-[75px] z-50 mx-auto flex max-w-[420px] items-center justify-between rounded-[9px] bg-ink px-[16px] py-[14px] text-[13.5px] text-on-ink animate-[toast-slide-in_200ms_ease-out] min-[1100px]:bottom-6 motion-reduce:animate-none"
    >
      <span>{message}</span>
      <span className="font-mono text-[11px] text-on-hero-dim">방금</span>
    </div>
  );
}
