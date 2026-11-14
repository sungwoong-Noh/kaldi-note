"use client";

import { closeQuickBrew, useQuickBrew } from "@/lib/quickBrew";
import { QuickBrewSheet } from "./QuickBrewSheet";

/** 앱에 한 번 마운트된다(`app/providers.tsx`). `openQuickBrew()`가 부르면 시트를 그린다. */
export function QuickBrewHost() {
  const open = useQuickBrew();
  if (!open) return null;
  return <QuickBrewSheet start={open.start} onClose={closeQuickBrew} />;
}
