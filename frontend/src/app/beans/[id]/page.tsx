import { BeanDetail } from "@/features/brewlog/components/BeanDetail";

/** 카탈로그 원두 상세. Next 16에서 params는 Promise다. */
export default async function BeanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BeanDetail id={Number(id)} />;
}
