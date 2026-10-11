import { StatTile } from "@/components/kit";
import { formatGrams } from "@/lib/format";
import type { BrewLogStats } from "../schema";

/**
 * 내 잔 통계 — 목업 BW1(웹 4칸)·BM1(모바일 2칸). docs/specs/2026-10-10-my-cups-ledger.md AC-MYCUPS-10.
 * 필터와 무관하게 늘 전체 기준이다(`/brew-logs/stats`).
 */
export function StatsCards({
  stats,
  isMobile,
}: {
  stats: BrewLogStats;
  isMobile: boolean;
}) {
  const web = !isMobile;
  return (
    <div className={`flex ${web ? "gap-[14px]" : "gap-[10px]"}`}>
      <StatTile web={web} label="이번 달" value={`${stats.monthCount}잔`} />
      <StatTile
        web={web}
        label="평균 별점"
        value={stats.averageRating !== undefined ? `★ ${stats.averageRating}` : "—"}
      />
      {web && (
        <StatTile
          web
          label="가장 많이 쓴 원두량"
          value={stats.favoriteDoseG !== undefined ? formatGrams(stats.favoriteDoseG) : "—"}
        />
      )}
      {web && (
        <StatTile web prose label="즐겨 쓴 레시피" value={stats.favoriteRecipeTitle ?? "—"} />
      )}
    </div>
  );
}
