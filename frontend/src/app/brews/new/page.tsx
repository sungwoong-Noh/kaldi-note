import { BrewLogForm } from "@/features/brewlog/components/BrewLogForm";

/**
 * Next 16에서 `searchParams`는 Promise다. 여기서 풀어 클라이언트 컴포넌트에 숫자로 넘긴다.
 *
 * <p>`use(searchParams)`를 쓰지 않는다 — Suspense 경계를 요구해서 없으면 화면이 통째로 비어 버린다(2026-08-30에 겪었다).
 */
export default async function BrewNewPage({
  searchParams,
}: {
  searchParams: Promise<{ recipeId?: string }>;
}) {
  const { recipeId } = await searchParams;

  return <BrewLogForm recipeId={Number(recipeId)} />;
}
