"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 메뉴가 「원두 수집」 하나뿐이다. 메뉴가 늘면 첫 화면을 다시 정한다(AC-ADMIN-13). */
export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/crawl");
  }, [router]);
  return null;
}
