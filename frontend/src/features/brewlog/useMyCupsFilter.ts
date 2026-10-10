"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { kstMonthOf, kstToday } from "@/lib/kstDate";
import type { BrewLogListFilter } from "./api";

/** 「내 잔」 알약. URL `?filter=`가 정본이다 — 모르는 값은 `all`로 본다(AC-MYCUPS-21). */
export type MyCupsFilter = "all" | "month" | "rated";

export const MY_CUPS_FILTERS: readonly { value: MyCupsFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "month", label: "이번 달" },
  { value: "rated", label: "★ 4 이상" },
];

/** 알약 → 목록 요청 파라미터. 「이번 달」은 오늘(KST)이 속한 달이다. */
export function toListFilter(filter: MyCupsFilter): BrewLogListFilter {
  if (filter === "month") return { month: kstMonthOf(kstToday()) };
  if (filter === "rated") return { minRating: 4 };
  return {};
}

export function useMyCupsFilter(): {
  filter: MyCupsFilter;
  setFilter: (next: MyCupsFilter) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const raw = useSearchParams().get("filter");
  const filter: MyCupsFilter = raw === "month" || raw === "rated" ? raw : "all";

  return {
    filter,
    setFilter: (next) =>
      router.replace(next === "all" ? pathname : `${pathname}?filter=${next}`),
  };
}
