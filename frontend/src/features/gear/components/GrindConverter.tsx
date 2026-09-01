"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessageOf } from "@/components/ErrorState";
import { convertGrind } from "../api";
import type { GrinderModel } from "../schema";

/**
 * 마스터 그라인더끼리 분쇄도를 환산한다.
 *
 * <p><b>경고 문구는 서버가 준 `warning`을 그대로 렌더한다.</b> 프론트가 다시 쓰면 두 곳이 어긋난다.
 * 범위 검증도 하지 않는다 — 400·422 문구를 그대로 보여주는 것이 화면의 몫이다.
 */
export function GrindConverter({
  grinders,
  onSessionLost,
}: {
  grinders: GrinderModel[];
  onSessionLost?: () => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [setting, setSetting] = useState("");
  const [targetId, setTargetId] = useState("");

  const convert = useMutation({
    mutationFn: () =>
      convertGrind(
        {
          sourceGrinderModelId: Number(sourceId),
          sourceSetting: Number(setting),
          targetGrinderModelId: Number(targetId),
        },
        onSessionLost,
      ),
    retry: false,
  });

  const result = convert.data;

  return (
    <div className="flex flex-col gap-4">
      <GrinderSelect
        label="원본 그라인더"
        grinders={grinders}
        value={sourceId}
        onChange={setSourceId}
      />

      <label className="flex items-center gap-2 text-sm">
        <span className="w-28 text-neutral-500">설정값</span>
        <input
          type="number"
          aria-label="설정값"
          value={setting}
          onChange={(e) => setSetting(e.target.value)}
          className="w-32 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
        />
      </label>

      <GrinderSelect
        label="대상 그라인더"
        grinders={grinders}
        value={targetId}
        onChange={setTargetId}
      />

      <button
        type="button"
        disabled={convert.isPending}
        onClick={() => convert.mutate()}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        환산
      </button>

      {convert.error && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessageOf(convert.error)}
        </p>
      )}

      {result && (
        <dl className="flex flex-col gap-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-neutral-500">입자 크기</dt>
            <dd>{result.micron} µm</dd>
          </div>
          {result.targetSetting !== undefined && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-neutral-500">대상 설정값</dt>
              <dd>
                {result.targetSetting}
                {result.targetOutOfRange && (
                  <span className="ml-2 text-xs text-red-600">범위 밖</span>
                )}
              </dd>
            </div>
          )}
          {result.estimated && (
            <p className="text-xs text-neutral-500">
              <span className="mr-1 rounded bg-neutral-200 px-1 py-0.5 dark:bg-neutral-800">
                추정치
              </span>
              {result.warning}
            </p>
          )}
        </dl>
      )}
    </div>
  );
}

function GrinderSelect({
  label,
  grinders,
  value,
  onChange,
}: {
  label: string;
  grinders: GrinderModel[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-28 text-neutral-500">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
      >
        <option value="">선택하세요</option>
        {grinders.map((grinder) => (
          <option key={grinder.id} value={grinder.id}>
            {grinder.brand} {grinder.name}
          </option>
        ))}
      </select>
    </label>
  );
}
