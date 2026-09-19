import { RecipeListScreen } from "@/features/recipe/components/RecipeListScreen";

/**
 * Next 16에서 `searchParams`는 Promise다. 여기서 풀어 클라이언트 컴포넌트에 넘긴다 —
 * `/brews/new`와 같은 패턴이다.
 *
 * <p>클라이언트에서 `useSearchParams`로 읽으면 Suspense 경계를 요구해 프리렌더가 깨진다.
 */
export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{
    grinderModelId?: string;
    grindSettingValue?: string;
  }>;
}) {
  const { grinderModelId, grindSettingValue } = await searchParams;

  /** 숫자가 아닌 값은 버린다 — 쿼리는 사용자가 손댈 수 있다. */
  const toNumber = (value: string | undefined): number | undefined => {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return (
    <RecipeListScreen
      grind={{
        grinderModelId: toNumber(grinderModelId),
        grindSettingValue: toNumber(grindSettingValue),
      }}
    />
  );
}
