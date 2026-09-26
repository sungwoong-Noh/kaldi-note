"use client";

import { Button, RoastDot, cardClass } from "@/components/ui";
import type { BeanProduct } from "@/features/catalog/schema";
import type { BeanBatch } from "@/features/inventory/schema";

type Roaster = { id: number; name: string };

/**
 * 원두 고르기 — docs/specs/2026-09-27-brew-form-redesign.md AC-BREWFORM-07·08·15.
 *
 * <p>760px 미만에서는 화면 아래에 붙는 시트, 그 이상은 가운데 다이얼로그다. 등록 단계는 따로 만들지 않고
 * `+ 새 원두`로 기존 `BeanBatchDialog`에 넘긴다 — 로스터·제품 중복 방지 로직이 거기 있다.
 */
export function BeanPickerDialog({
  batches,
  products,
  roasters,
  onPick,
  onAddNew,
  onCancel,
}: {
  batches: readonly BeanBatch[];
  products: readonly BeanProduct[];
  roasters: readonly Roaster[];
  onPick: (id: number) => void;
  onAddNew: () => void;
  onCancel: () => void;
}) {
  // 로스팅일 최신순. 같은 날 볶은 것은 나중에 등록한(id가 큰) 것이 먼저다.
  const sorted = [...batches].sort(
    (a, b) => b.roastedAt.localeCompare(a.roastedAt) || b.id - a.id,
  );

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 min-[760px]:items-center min-[760px]:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bean-picker-title"
        className={cardClass(
          "flex max-h-full w-full flex-col gap-3 overflow-y-auto min-[760px]:max-w-sm",
          { tone: "raised" },
        )}
      >
        <h2 id="bean-picker-title" className="text-card-title font-semibold">
          원두 고르기
        </h2>

        {sorted.length === 0 ? (
          <p className="text-body text-ink-3">등록된 원두가 없습니다.</p>
        ) : (
          <ul className="flex flex-col">
            {sorted.map((batch) => (
              <li key={batch.id}>
                <button
                  type="button"
                  onClick={() => onPick(batch.id)}
                  className="flex min-h-11 w-full items-center gap-3 border-t border-divider py-2 text-left"
                >
                  <RoastDot
                    roastLevel={
                      products.find((p) => p.id === batch.beanProductId)
                        ?.roastLevel
                    }
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body">
                      {beanName(batch, products, roasters)}
                    </span>
                    <span className="text-body-sm text-ink-3">
                      {batchCaption(batch)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>닫기</Button>
          <Button onClick={onAddNew}>+ 새 원두</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * `프릿츠 예가체프`. 재고 응답은 `beanProductId`만, 제품 응답은 `roasterId`만 준다 — 세 목록을 조합한다.
 * 아직 도착하지 않은 목록이 있으면 있는 것만으로 만들고, 아무것도 없으면 `재고 9`다.
 */
export function beanName(
  batch: BeanBatch,
  products: readonly { id: number; name: string; roasterId: number }[],
  roasters: readonly Roaster[],
): string {
  const product = products.find((p) => p.id === batch.beanProductId);
  const roaster = roasters.find((r) => r.id === product?.roasterId);
  const name = [roaster?.name, product?.name].filter(Boolean).join(" ");
  return name === "" ? `재고 ${batch.id}` : name;
}

/** `로스팅 09.10 · 2일차 · 남은 200 g`. 경과일은 서버가 계산해 준다 — 없으면 뺀다. */
function batchCaption(batch: BeanBatch): string {
  const [, month, day] = batch.roastedAt.split("-");
  return [
    `로스팅 ${month}.${day}`,
    batch.daysOffRoast !== undefined && `${batch.daysOffRoast}일차`,
    `남은 ${batch.remainingG} g`,
  ]
    .filter(Boolean)
    .join(" · ");
}
