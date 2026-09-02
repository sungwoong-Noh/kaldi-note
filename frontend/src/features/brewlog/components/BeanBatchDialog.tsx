"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  createBeanProduct,
  createRoaster,
  useBeanProducts,
  useRoasters,
} from "@/features/catalog/api";
import type { RoastLevel } from "@/features/catalog/schema";
import { createBeanBatch } from "@/features/inventory/api";
import type { BeanBatch } from "@/features/inventory/schema";
import { ApiError } from "@/lib/api-client";
import { mapFieldErrors } from "@/lib/fieldErrors";

/** 스펙 「원두 등록 모달」이 정한 네 가지. 서버 enum의 `DARK`는 이번 화면에 두지 않는다. */
const ROAST_LEVELS: RoastLevel[] = [
  "LIGHT",
  "MEDIUM_LIGHT",
  "MEDIUM",
  "MEDIUM_DARK",
];

/** 어느 요청에서 실패했는가. 로스터와 제품이 둘 다 `name`으로 오류를 주므로 이게 없으면 붙일 자리를 못 정한다. */
type Stage = "roaster" | "product" | "batch";

/**
 * 원두 재고 등록 모달 — 로스터 → 제품 → 재고를 한 번에 만든다.
 *
 * <p><b>이미 만들어진 것은 상태로 승격한다.</b> 로스터가 만들어진 뒤 제품에서 400이 나면, 로스터 입력란이 "새로 만들기"에서
 * "방금 만든 로스터가 선택된 상태"로 바뀐다. 다시 누를 때 로스터 POST가 또 나가면 중복이 생기는데,
 * <b>로스터·제품에는 DELETE API가 없어 되돌릴 수 없다.</b> 중복을 만들지 않는 것이 유일한 방어다.
 */
export function BeanBatchDialog({
  onCreated,
  onCancel,
  onSessionLost,
}: {
  onCreated: (created: BeanBatch) => void;
  onCancel: () => void;
  onSessionLost?: () => void;
}) {
  const roasters = useRoasters(onSessionLost);
  const products = useBeanProducts(onSessionLost);

  const [roasterId, setRoasterId] = useState<number | null>(null);
  const [roasterName, setRoasterName] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [roastLevel, setRoastLevel] = useState<RoastLevel | "">("");
  const [country, setCountry] = useState("");
  const [weightG, setWeightG] = useState<number | null>(null);
  const [roastedAt, setRoastedAt] = useState("");
  const [failedStage, setFailedStage] = useState<Stage | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      let stage: Stage = "roaster";
      try {
        let resolvedRoasterId = roasterId;
        if (resolvedRoasterId === null) {
          const roaster = await createRoaster(
            { name: roasterName },
            onSessionLost,
          );
          resolvedRoasterId = roaster.id;
          setRoasterId(roaster.id);
        }

        stage = "product";
        let resolvedProductId = productId;
        if (resolvedProductId === null) {
          const product = await createBeanProduct(
            {
              roasterId: resolvedRoasterId,
              name: productName,
              roastLevel: roastLevel === "" ? "MEDIUM" : roastLevel,
              country,
            },
            onSessionLost,
          );
          resolvedProductId = product.id;
          setProductId(product.id);
        }

        stage = "batch";
        return await createBeanBatch(
          {
            beanProductId: resolvedProductId,
            weightG: weightG ?? 0,
            roastedAt,
          },
          onSessionLost,
        );
      } catch (error) {
        setFailedStage(stage);
        throw error;
      }
    },
    onSuccess: (created) => onCreated(created),
  });

  const mapped =
    submit.error instanceof ApiError
      ? mapFieldErrors(submit.error.fieldErrors)
      : null;
  /** `name` 오류는 실패한 단계의 입력칸에만 붙인다. */
  const nameErrorFor = (stage: Stage) =>
    failedStage === stage ? mapped?.byField.name : undefined;

  const productsOfRoaster = (products.data ?? []).filter(
    (product) => product.roasterId === roasterId,
  );

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bean-batch-title"
        className="flex max-h-full w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-lg bg-white p-5 dark:bg-neutral-900"
      >
        <h2 id="bean-batch-title" className="text-base font-semibold">
          원두 등록
        </h2>

        <SelectField
          label="로스터"
          value={roasterId}
          onChange={(id) => {
            setRoasterId(id);
            // 로스터가 바뀌면 그 아래에서 고른 제품은 더 이상 맞지 않는다.
            setProductId(null);
          }}
          options={(roasters.data ?? []).map((roaster) => ({
            id: roaster.id,
            label: roaster.name,
          }))}
        />

        {roasterId === null && (
          <TextField
            label="로스터 이름"
            value={roasterName}
            onChange={setRoasterName}
            error={nameErrorFor("roaster")}
          />
        )}

        {roasterId !== null && (
          <SelectField
            label="제품"
            value={productId}
            onChange={setProductId}
            options={productsOfRoaster.map((product) => ({
              id: product.id,
              label: product.name,
            }))}
          />
        )}

        {productId === null && (
          <>
            <TextField
              label="제품 이름"
              value={productName}
              onChange={setProductName}
              error={nameErrorFor("product")}
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">배전도</span>
              <select
                aria-label="배전도"
                value={roastLevel}
                onChange={(e) => setRoastLevel(e.target.value as RoastLevel)}
                className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
              >
                <option value="">선택 안 함</option>
                {ROAST_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="원산지 국가"
              value={country}
              onChange={setCountry}
              error={mapped?.byField.country}
            />
          </>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">중량</span>
          <input
            type="number"
            aria-label="중량"
            value={weightG ?? ""}
            onChange={(e) =>
              setWeightG(e.target.value === "" ? null : Number(e.target.value))
            }
            aria-describedby={
              mapped?.byField.weightG ? "bean-batch-weight-error" : undefined
            }
            className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
          />
          {mapped?.byField.weightG && (
            <span id="bean-batch-weight-error" className="text-xs text-red-600">
              {mapped.byField.weightG}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">로스팅일</span>
          <input
            type="date"
            aria-label="로스팅일"
            value={roastedAt}
            onChange={(e) => setRoastedAt(e.target.value)}
            aria-describedby={
              mapped?.byField.roastedAt ? "bean-batch-roasted-error" : undefined
            }
            className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
          />
          {mapped?.byField.roastedAt && (
            <span
              id="bean-batch-roasted-error"
              className="text-xs text-red-600"
            >
              {mapped.byField.roastedAt}
            </span>
          )}
        </label>

        {submit.error && (
          <p className="text-xs text-red-600">{submit.error.message}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            취소
          </button>
          <button
            type="button"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: { id: number; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
      >
        <option value="">새로 만들기</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = `bean-batch-${label}-error`;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? errorId : undefined}
        className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
      />
      {error && (
        <span id={errorId} className="text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
