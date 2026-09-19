import { BrewLogForm } from "@/features/brewlog/components/BrewLogForm";

/**
 * Next 16에서 `searchParams`는 Promise다. 여기서 풀어 클라이언트 컴포넌트에 숫자로 넘긴다.
 *
 * <p>`use(searchParams)`를 쓰지 않는다 — Suspense 경계를 요구해서 없으면 화면이 통째로 비어 버린다(2026-08-30에 겪었다).
 */
export default async function BrewNewPage({
  searchParams,
}: {
  searchParams: Promise<{
    recipeId?: string;
    grinderModelId?: string;
    grindSettingValue?: string;
  }>;
}) {
  const { recipeId, grinderModelId, grindSettingValue } = await searchParams;

  /*
   * 환산기에서 「이 값으로 기록하기」로 넘어온 분쇄도다. 레시피 선택을 한 번 거치므로
   * 두 값이 여기까지 따라온다(docs/specs/2026-09-17-small-features.md).
   * 숫자가 아닌 값은 버린다 — 쿼리는 사용자가 손댈 수 있다.
   */
  const toNumber = (value: string | undefined): number | undefined => {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return (
    <BrewLogForm
      recipeId={Number(recipeId)}
      grind={{
        grinderModelId: toNumber(grinderModelId),
        grindSettingValue: toNumber(grindSettingValue),
      }}
    />
  );
}
