"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type CachedRecipe, readCachedRecipes } from "@/lib/offline-cache";

/**
 * 네트워크가 없을 때 여는 화면.
 *
 * <p><b>세션을 요구하지 않는다.</b> `useRequireSession`을 쓰면 오프라인에서 이 화면조차 로그인으로 튕긴다 — 이 화면이 있는 이유가
 * 사라진다.
 */
export default function OfflinePage() {
  const [recipes, setRecipes] = useState<CachedRecipe[] | null>(null);

  useEffect(() => {
    void readCachedRecipes().then(setRecipes);
  }, []);

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">연결 없음</h1>
      <p className="text-muted">
        네트워크에 연결되어 있지 않습니다. 저장된 레시피는 볼 수 있습니다.
      </p>

      {recipes !== null &&
        (recipes.length === 0 ? (
          <p className="text-muted">
            저장된 레시피가 없습니다
          </p>
        ) : (
          <ul className="flex flex-col">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="flex min-h-11 min-w-11 items-center justify-center block rounded-md px-2 py-3 hover:bg-surface dark:hover:bg-brand"
                >
                  {recipe.title}
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
