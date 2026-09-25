"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { RecipeSearchFilter } from "./api";

export type RecipeScope = RecipeSearchFilter["scope"];
export type RecipeTemp = NonNullable<RecipeSearchFilter["temp"]>;
export type RecipeRoast = RecipeSearchFilter["roast"] extends
  | Array<infer T>
  | undefined
  ? T
  : never;
export type RecipeDripper = RecipeSearchFilter["dripper"] extends
  | Array<infer T>
  | undefined
  ? T
  : never;
export type RecipeOwner = NonNullable<RecipeSearchFilter["owner"]>;
export type RecipeSort = NonNullable<RecipeSearchFilter["sort"]>;

export interface RecipeSearchState {
  scope: RecipeScope;
  q: string;
  temp?: RecipeTemp;
  roast: RecipeRoast[];
  doseMin?: number;
  doseMax?: number;
  dripper: RecipeDripper[];
  owner?: RecipeOwner;
  sort?: RecipeSort;
}

function parse(params: URLSearchParams): RecipeSearchState {
  const scope = params.get("scope") === "PUBLIC" ? "PUBLIC" : "DRAWER";
  const temp = params.get("temp");
  const doseMin = params.get("doseMin");
  const doseMax = params.get("doseMax");
  const owner = params.get("owner");
  const sort = params.get("sort");
  return {
    scope,
    q: params.get("q") ?? "",
    temp: temp === "HOT" || temp === "ICE" ? temp : undefined,
    roast: params.getAll("roast") as RecipeRoast[],
    doseMin: doseMin != null ? Number(doseMin) : undefined,
    doseMax: doseMax != null ? Number(doseMax) : undefined,
    dripper: params.getAll("dripper") as RecipeDripper[],
    owner: owner === "MINE" || owner === "SAVED" ? owner : undefined,
    sort: sort === "RECENT" ? sort : undefined,
  };
}

/** URL 쿼리 문자열을 만든다. scope→owner→q→temp→roast→doseMin→doseMax→dripper→sort 순서 고정(AC-RECIPESBREWS-65). */
export function buildSearchQuery(state: RecipeSearchState): string {
  const params = new URLSearchParams();
  if (state.scope !== "DRAWER") params.set("scope", state.scope);
  if (state.owner) params.set("owner", state.owner);
  if (state.q) params.set("q", state.q);
  if (state.temp) params.set("temp", state.temp);
  for (const r of state.roast) params.append("roast", r);
  if (state.doseMin != null) params.set("doseMin", String(state.doseMin));
  if (state.doseMax != null) params.set("doseMax", String(state.doseMax));
  for (const d of state.dripper) params.append("dripper", d);
  if (state.sort) params.set("sort", state.sort);
  return params.toString();
}

export function toSearchFilter(state: RecipeSearchState): RecipeSearchFilter {
  return {
    scope: state.scope,
    q: state.q || undefined,
    temp: state.temp,
    roast: state.roast.length > 0 ? state.roast : undefined,
    doseMin: state.doseMin,
    doseMax: state.doseMax,
    dripper: state.dripper.length > 0 ? state.dripper : undefined,
    owner: state.owner,
    sort: state.sort,
  };
}

/**
 * `/recipes`의 검색·필터·정렬·세그먼트 상태. URL이 정본이다 — 뒤로가기(AC-RECIPESBREWS-66)가
 * 복원하는 것도, 새로고침해도 남는 것도 URL이다.
 *
 * <p>상태는 `useState`로 한 번만 초기화한다. 값이 바뀔 때마다 `router.replace`로 URL을 다시 쓴다 —
 * 브라우저 뒤로/앞으로가기는 페이지를 다시 마운트하지 않으므로(Next App Router), 실제 복원은
 * 이 훅이 아니라 `useSearchParams()`가 바뀐 값을 들고 재렌더하는 데서 일어난다. 그래서 로컬
 * `state`는 `key`로 잡은 "이 URL에서 시작했다"는 스냅샷일 뿐, 매 렌더 URL과 동기화하려 들지
 * 않는다(그러면 타이핑 중 되돌아온다).
 */
export function useRecipeSearchState(): {
  state: RecipeSearchState;
  setState: (patch: Partial<RecipeSearchState>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setLocalState] = useState<RecipeSearchState>(() =>
    parse(searchParams),
  );

  const setState = useCallback(
    (patch: Partial<RecipeSearchState>) => {
      setLocalState((prev) => {
        const next = { ...prev, ...patch };
        const query = buildSearchQuery(next);
        router.replace(query ? `${pathname}?${query}` : pathname);
        return next;
      });
    },
    [router, pathname],
  );

  return { state, setState };
}
