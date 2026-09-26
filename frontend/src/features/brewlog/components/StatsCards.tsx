import { Card } from "@/components/ui";
import { formatGrams } from "@/lib/format";
import type { BrewLogStats } from "../schema";

/** 이번 달·평균 별점·최빈 원두량·즐겨 쓴 레시피(AC-RECIPESBREWS-76). 모바일은 앞 2칸만. */
export function StatsCards({
  stats,
  isMobile,
}: {
  stats: BrewLogStats;
  isMobile: boolean;
}) {
  return (
    <div
      className={`mb-4 grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}
    >
      <StatCard label="이번 달" value={`${stats.monthCount}잔`} />
      <StatCard
        label="평균 별점"
        value={
          stats.averageRating !== undefined ? `★ ${stats.averageRating}` : "—"
        }
      />
      {!isMobile && (
        <StatCard
          label="최빈 원두량"
          value={
            stats.favoriteDoseG !== undefined
              ? formatGrams(stats.favoriteDoseG)
              : "—"
          }
        />
      )}
      {!isMobile && (
        <StatCard
          label="즐겨 쓴 레시피"
          value={stats.favoriteRecipeTitle ?? "—"}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card pad="tight">
      <p className="text-body-sm text-ink-3">{label}</p>
      <p className="mt-1 text-metric font-semibold">{value}</p>
    </Card>
  );
}
