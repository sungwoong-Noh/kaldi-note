import { BeanNamedDetail } from "@/features/brewlog/components/BeanDetail";

/** 직접 적은 원두 — `/beans/named?name=하늘 블렌드`. searchParams도 Promise다. */
export default async function BeanNamedPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  return <BeanNamedDetail name={(name ?? "").trim()} />;
}
