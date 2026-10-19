import type { CrawlRun } from "./schema";

/** 목업 `Admin.dc.html`의 문구 그대로. 순서가 곧 화면의 묶음 순서다. */
export const SKIP_REASONS: Record<string, string> = {
  USER_OWNED: "사용자가 등록한 원두 — 덮어쓰지 않음",
  FETCH_FAILED: "상품 페이지를 읽지 못함",
  PARSE_FAILED: "페이지 구조를 해석하지 못함",
};

export const FIELD_LABELS: Record<string, string> = {
  process: "가공법",
  variety: "품종",
  roastLevel: "로스팅",
  origin: "산지",
};

export type Group<T> = { code: string; label: string; items: T[] };

function groupBy<T>(items: readonly T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

export function groupSkipped(skipped: CrawlRun["skipped"]) {
  const map = groupBy(skipped, (s) => s.reason);
  const order = [...Object.keys(SKIP_REASONS), ...map.keys()];
  return [...new Set(order)]
    .filter((code) => map.has(code))
    .map((code) => ({
      code,
      label: SKIP_REASONS[code] ?? code,
      items: map.get(code)!,
    }));
}

export function groupUnmapped(unmapped: CrawlRun["unmapped"]) {
  return [...groupBy(unmapped, (u) => u.field)]
    .map(([code, items]) => ({
      code,
      label: FIELD_LABELS[code] ?? code,
      items,
    }))
    .sort((a, b) => b.items.length - a.items.length);
}

export function observation(run: CrawlRun): string {
  switch (run.status) {
    case "RUNNING":
      return "수집 중입니다. 3초마다 상태를 다시 읽습니다. 생성·갱신 집계와 목록은 실행이 끝나면 표시됩니다.";
    case "FAILED":
      return "실행 전체가 실패했습니다. 이번 실행으로 생성되거나 갱신된 원두는 없습니다.";
    case "INTERRUPTED":
      // 목업 문구와 다르다 — 서버는 집계를 끝날 때 한 번에 쓰므로 중단된 실행의 집계는 늘 0이다(AC-ADMIN-22).
      return "앱이 재시작되어 실행이 중단되었습니다. 중단 전에 반영된 원두는 집계에 남지 않았습니다.";
  }
  const sk = run.skipped.length;
  const un = run.unmapped.length;
  if (sk === 0 && un === 0)
    return "이번 실행에서 건너뛴 상품과 매핑하지 못한 원문이 없습니다.";
  const base = `이번 실행에서 상품 ${sk}건을 건너뛰고, 원문 ${un}건을 매핑하지 못했습니다.`;
  if (un < 40) return base;
  const top = groupUnmapped(run.unmapped)[0];
  return `${base} ${top.label}(${top.code})이 ${top.items.length}건으로 가장 많습니다.`;
}

/** 집계를 보여 줄 수 있는 상태인가. RUNNING·INTERRUPTED는 서버 집계가 아직(또는 영영) 없다. */
export function hasTotals(run: { status: CrawlRun["status"] }) {
  return run.status === "SUCCEEDED" || run.status === "FAILED";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function duration(
  run: Pick<CrawlRun, "status" | "startedAt" | "finishedAt">,
  now: Date = new Date(),
): string {
  if (run.status === "INTERRUPTED") return "—";
  const end = run.finishedAt ? new Date(run.finishedAt) : now;
  const sec = Math.max(
    0,
    Math.floor((end.getTime() - new Date(run.startedAt).getTime()) / 1000),
  );
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}

export function clock(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
