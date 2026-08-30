import { RecipeEditor } from "@/features/recipe/components/RecipeEditor";

/** Next 16에서 params는 Promise다. 여기서 풀어 클라이언트 컴포넌트에 숫자로 넘긴다. */
export default async function RecipeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <RecipeEditor id={Number(id)} />;
}
