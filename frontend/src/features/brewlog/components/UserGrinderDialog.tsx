"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { createUserGrinder } from "@/features/gear/api";
import { useGrinders } from "@/features/gear/queries";
import type { UserGrinder } from "@/features/gear/schema";
import { ApiError } from "@/lib/api-client";
import { mapFieldErrors } from "@/lib/fieldErrors";

/**
 * 내 그라인더 등록 모달.
 *
 * <p>페이지가 아니라 모달인 이유는 <b>작성 중인 로그를 잃지 않기 위해서다.</b> 임시저장이 비목표라, 등록하러 페이지를 떠나면
 * 여기까지 채운 실측값이 전부 날아간다.
 */
export function UserGrinderDialog({
  onCreated,
  onCancel,
  onSessionLost,
}: {
  onCreated: (created: UserGrinder) => void;
  onCancel: () => void;
  onSessionLost?: () => void;
}) {
  const grinders = useGrinders(onSessionLost);
  const [grinderModelId, setGrinderModelId] = useState<number | null>(null);
  const [nickname, setNickname] = useState("");

  const create = useMutation({
    mutationFn: (id: number) =>
      createUserGrinder(
        // 별명은 비어 있으면 키째 뺀다. `""`를 보내면 "빈 이름"을 저장하는 셈이 된다.
        nickname === "" ? { grinderModelId: id } : { grinderModelId: id, nickname },
        onSessionLost,
      ),
    // 인자를 그대로 넘기지 않는다 — onSuccess는 (data, variables, context)를 주므로
    // `onSuccess: onCreated`로 두면 부르는 쪽이 쓰지 않을 인자까지 받게 된다.
    onSuccess: (created) => onCreated(created),
  });

  const fieldErrors =
    create.error instanceof ApiError
      ? mapFieldErrors(create.error.fieldErrors)
      : null;

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-grinder-title"
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-5 dark:bg-neutral-900"
      >
        <h2 id="user-grinder-title" className="text-base font-semibold">
          그라인더 등록
        </h2>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">모델</span>
          <select
            aria-label="모델"
            value={grinderModelId ?? ""}
            onChange={(e) =>
              setGrinderModelId(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
          >
            <option value="">선택 안 함</option>
            {(grinders.data ?? []).map((model) => (
              <option key={model.id} value={model.id}>
                {model.brand} {model.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">별명</span>
          <input
            aria-label="별명"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            aria-describedby={
              fieldErrors?.byField.nickname ? "user-grinder-nickname-error" : undefined
            }
            className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
          />
          {fieldErrors?.byField.nickname && (
            <span id="user-grinder-nickname-error" className="text-xs text-red-600">
              {fieldErrors.byField.nickname}
            </span>
          )}
        </label>

        {create.error && !fieldErrors?.byField.nickname && (
          <p className="text-xs text-red-600">{create.error.message}</p>
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
            disabled={grinderModelId === null || create.isPending}
            onClick={() => {
              if (grinderModelId !== null) create.mutate(grinderModelId);
            }}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
