"use client";

import { closeQuickBrew, useQuickBrew } from "@/lib/quickBrew";
import { useExitPresence } from "@/lib/useExitPresence";
import { QuickBrewSheet } from "./QuickBrewSheet";

/** 앱에 한 번 마운트된다(`app/providers.tsx`). `openQuickBrew()`가 부르면 시트·패널을 그린다. */
export function QuickBrewHost() {
  const { present, open, rendered, onExitComplete } =
    useExitPresence(useQuickBrew());
  if (!present || !rendered) return null;
  return (
    <QuickBrewSheet
      start={rendered.start}
      prefill={rendered.prefill}
      open={open}
      onClose={closeQuickBrew}
      onExitComplete={onExitComplete}
    />
  );
}
