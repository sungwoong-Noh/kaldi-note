import { BrewDetail } from "@/features/brewlog/components/BrewDetail";

/** Next 16에서 params는 Promise다. 여기서 풀어 클라이언트 컴포넌트에 숫자로 넘긴다. */
export default async function BrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BrewDetail id={Number(id)} />;
}
