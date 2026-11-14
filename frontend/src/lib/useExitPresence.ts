import { useCallback, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isActive<T>(value: T): boolean {
  return value !== null && value !== undefined && value !== false;
}

/**
 * 시트·패널이 닫힐 때 닫힘 애니메이션(`animationend`/`transitionend`)이 끝날 때까지
 * 마운트를 유지했다가 언마운트한다. `prefers-reduced-motion: reduce`이거나
 * `immediate`가 참이면 즉시 언마운트한다.
 */
export function useExitPresence<T>(value: T, immediate = false) {
  const active = isActive(value);
  const skipExit = immediate || prefersReducedMotion();
  const [state, setState] = useState<{ rendered: T; exiting: boolean }>({
    rendered: value,
    exiting: false,
  });

  if (active) {
    if (state.rendered !== value || state.exiting) {
      setState({ rendered: value, exiting: false });
    }
  } else if (isActive(state.rendered)) {
    if (skipExit) {
      setState({ rendered: value, exiting: false });
    } else if (!state.exiting) {
      setState({ rendered: state.rendered, exiting: true });
    }
  }

  const onExitComplete = useCallback(() => {
    setState((prev) =>
      prev.exiting ? { rendered: value, exiting: false } : prev,
    );
  }, [value]);

  const present = active || (!skipExit && state.exiting);
  return {
    present,
    open: active,
    rendered: active ? value : state.rendered,
    onExitComplete,
  };
}
