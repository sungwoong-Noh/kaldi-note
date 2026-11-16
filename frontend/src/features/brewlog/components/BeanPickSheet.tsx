"use client";

import { useEffect, useState } from "react";
import { Tag } from "@/components/kit";
import { RoastDot } from "@/components/ui";
import {
  useBeanProduct,
  useBeanSearch,
  useBeanSummary,
} from "@/features/catalog/api";
import type {
  BeanProduct,
  BeanProductSummary,
  BeanSummary,
} from "@/features/catalog/schema";
import { ROAST_LEVEL_LABEL } from "../todayPresentation";
import { Heading, PrimaryButton, SecondaryButton } from "./quickBrewParts";

/** 빠른 기록 ①에서 고르는 원두 — 카탈로그 원두이거나 이름만 적은 원두. */
export type BeanChoice =
  { kind: "product"; id: number } | { kind: "name"; name: string };

const SEARCH_DEBOUNCE_MS = 250;

/**
 * 원두 고르기(시안 10 Brew First B8~B10 · 11 Beans U2). 빈 입력이면 최근 원두만, 입력하면 250ms 뒤 서버 검색 20개.
 * 결과 행을 누르면 바로 고르고, 오른쪽 「정보」는 원두 정보 시트(U1b)를 위에 쌓는다.
 * 규칙은 docs/specs/2026-11-15-bean-detail.md 「화면」.
 */
export function BeanPickSheet({
  recent,
  productName,
  onPick,
}: {
  recent: BeanChoice[];
  productName: (id: number) => string;
  onPick: (choice: BeanChoice) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);
  const search = useBeanSearch({ q: debounced }, undefined, debounced !== "");
  const settled = q !== "" && q === debounced && search.isSuccess;
  const matches = settled ? search.data.content : [];
  const total = settled ? search.data.totalElements : 0;
  const [infoId, setInfoId] = useState<number | null>(null);

  const row =
    "kn-press hit-44 block w-full py-[12px] text-left text-[15px] text-ink";

  return (
    <>
      <Heading>어떤 원두인가요?</Heading>
      <input
        aria-label="원두 검색"
        placeholder="원두 이름이나 로스터로 찾기"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="rounded-[8px] border border-border bg-paper px-[14px] py-[12px] text-[15px] text-ink"
      />
      {!q && (
        <ul aria-label="최근 고른 원두" className="divide-y divide-border">
          {recent.map((choice) => (
            <li
              key={
                choice.kind === "product" ? `p${choice.id}` : `n${choice.name}`
              }
            >
              <button
                type="button"
                className={row}
                onClick={() => onPick(choice)}
              >
                {choice.kind === "product"
                  ? productName(choice.id)
                  : choice.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {matches.length > 0 && (
        <div>
          <div className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
            카탈로그 · {total}개
          </div>
          <ul aria-label="카탈로그" className="mt-[8px]">
            {matches.map((p) => (
              <ResultRow
                key={p.id}
                bean={p}
                onPick={() => onPick({ kind: "product", id: p.id })}
                onInfo={() => setInfoId(p.id)}
              />
            ))}
          </ul>
          {total > matches.length && (
            <p className="mt-[10px] text-[13px] text-ink-3">
              {matches.length}개까지 보여요 — 더 좁혀 보세요
            </p>
          )}
        </div>
      )}
      {settled && matches.length === 0 && (
        <p className="text-[14px] text-ink-2">「{q}」를 찾지 못했어요</p>
      )}
      {q && (
        <SecondaryButton onClick={() => onPick({ kind: "name", name: q })}>
          {`「${q}」로 기록`}
        </SecondaryButton>
      )}
      {infoId !== null && (
        <BeanInfoSheet
          id={infoId}
          onBack={() => setInfoId(null)}
          onPick={() => onPick({ kind: "product", id: infoId })}
        />
      )}
    </>
  );
}

/** 배전도를 모르면 점선 점(U2). 자리는 같은 11px. */
function Dot({ roastLevel }: { roastLevel?: BeanProduct["roastLevel"] }) {
  return roastLevel ? (
    <span className="flex size-[11px] shrink-0">
      <RoastDot roastLevel={roastLevel} size={11} />
    </span>
  ) : (
    <span
      data-roast-dot-unknown
      aria-hidden
      className="size-[11px] shrink-0 rounded-full border border-dashed border-ink-disabled"
    />
  );
}

/** `북쪽 커피 · 중강배전 · 블렌드 · 3개국` — 없는 항목은 글자도 빼고 다음으로. */
function resultCaption(p: BeanProductSummary): string {
  const origin =
    p.beanMix === "BLEND"
      ? p.countries.length > 0
        ? `블렌드 · ${p.countries.length}개국`
        : null
      : (p.countries[0] ?? null);
  return [
    p.roasterName,
    p.roastLevel ? ROAST_LEVEL_LABEL[p.roastLevel] : null,
    origin,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ResultRow({
  bean,
  onPick,
  onInfo,
}: {
  bean: BeanProductSummary;
  onPick: () => void;
  onInfo: () => void;
}) {
  return (
    <li className="flex items-center gap-[4px] border-t border-divider">
      <button
        type="button"
        onClick={onPick}
        className="kn-press flex min-w-0 flex-1 items-center gap-[11px] py-[13px] text-left"
      >
        <Dot roastLevel={bean.roastLevel} />
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex min-w-0 items-center gap-[6px] text-[14.5px] font-medium text-ink">
            <span className="truncate">{bean.name}</span>
            {bean.decaf && <Tag accent>디카페인</Tag>}
          </span>
          <span className="text-[12px] text-ink-3">{resultCaption(bean)}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`${bean.name} 정보`}
        onClick={onInfo}
        className="min-h-[44px] min-w-[52px] shrink-0 border-l border-divider text-[13px] text-accent"
      >
        정보
      </button>
    </li>
  );
}

/** `5잔 · ★ 4.1 · 1:15.6` — 없는 값은 뺀다. 0잔이면 null. */
function summaryLine(s: BeanSummary): string | null {
  if (s.brewCount === 0) return null;
  return [
    `${s.brewCount}잔`,
    s.averageRating !== undefined && `★ ${s.averageRating.toFixed(1)}`,
    s.frequentRatio !== undefined && `1:${s.frequentRatio.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function altitude(o: BeanProduct["origins"][number]): string | null {
  const fmt = (m: number) => m.toLocaleString("en-US");
  if (o.altitudeMinM === undefined) return null;
  return o.altitudeMaxM !== undefined && o.altitudeMaxM !== o.altitudeMinM
    ? `${fmt(o.altitudeMinM)}–${fmt(o.altitudeMaxM)} m`
    : `${fmt(o.altitudeMinM)} m`;
}

/** 원장 행 — 산지 · 고도 · 품종 · 가공. 값이 없는 행은 빠진다. */
function originRows(p: BeanProduct): [string, string][] {
  if (p.beanMix === "BLEND") {
    const countries = p.origins.map((o) => o.country);
    return countries.length > 0 ? [["산지", countries.join(" · ")]] : [];
  }
  const o = p.origins[0];
  if (!o) return [];
  const rows: [string, string | null][] = [
    ["산지", [o.country, o.region, o.farm].filter(Boolean).join(" · ")],
    ["고도", altitude(o)],
    [
      "품종 · 가공",
      [o.varietyName, o.processName].filter(Boolean).join(" · ") || null,
    ],
  ];
  return rows.filter((r): r is [string, string] => r[1] !== null);
}

/**
 * 원두 정보 시트(U1b) — 원두 고르기 위에 한 장 더 쌓인다. 모바일은 아래 시트가 56px 보이게, 웹(≥760)은 패널 내용을 덮는다.
 * 요약판이라 최근 기록 행 대신 한 줄 요약이다.
 */
function BeanInfoSheet({
  id,
  onBack,
  onPick,
}: {
  id: number;
  onBack: () => void;
  onPick: () => void;
}) {
  const product = useBeanProduct(id);
  const summary = useBeanSummary({ beanProductId: id });
  const p = product.data;
  const line = summary.data ? summaryLine(summary.data) : null;

  return (
    <section
      role="dialog"
      aria-label={p?.name ?? "원두 정보"}
      className="absolute inset-x-0 top-[56px] bottom-0 z-10 flex animate-[sheet-slide-in_240ms_cubic-bezier(0.2,0.8,0.2,1)] flex-col gap-[18px] overflow-y-auto rounded-t-[14px] border-t border-border bg-paper px-[20px] pt-[10px] pb-[20px] min-[760px]:top-0 min-[760px]:rounded-none min-[760px]:border-t-0 min-[760px]:px-[28px] motion-reduce:animate-none"
    >
      <div className="flex items-center justify-between text-[14px] text-ink-2">
        <button type="button" onClick={onBack} className="hit-44">
          ‹ 이전
        </button>
      </div>
      {product.isError && (
        <div className="flex flex-col gap-[12px]">
          <p className="text-[14px] text-ink-2">
            원두 정보를 불러오지 못했어요
          </p>
          <SecondaryButton onClick={() => void product.refetch()}>
            다시 시도
          </SecondaryButton>
        </div>
      )}
      {p && (
        <>
          <div className="flex flex-col gap-[6px]">
            {p.roasterName && (
              <div className="text-[13.5px] text-ink-3">{p.roasterName}</div>
            )}
            <h3 className="text-[24px] leading-[1.3] font-semibold tracking-[-0.025em] text-ink">
              {p.name}
            </h3>
            <div className="flex flex-wrap items-center gap-[6px]">
              <Tag>{p.beanMix === "BLEND" ? "블렌드" : "싱글"}</Tag>
              {p.roastLevel && <Tag>{ROAST_LEVEL_LABEL[p.roastLevel]}</Tag>}
              {p.roastLevelAgtron !== undefined && (
                <Tag>{`Agtron ${p.roastLevelAgtron}`}</Tag>
              )}
              {p.decaf && <Tag accent>디카페인</Tag>}
            </div>
          </div>
          {p.description && (
            <div className="flex flex-col gap-[6px]">
              <div className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
                컵노트 · 로스터 설명 원문
              </div>
              <p className="text-[15.5px] leading-[1.6] text-ink-2 italic">
                “{p.description}”
              </p>
            </div>
          )}
          {originRows(p).length > 0 ? (
            <dl className="border-b border-divider-strong">
              {originRows(p).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-[12px] border-t border-divider py-[13px] first:border-divider-strong"
                >
                  <dt className="text-[13.5px] text-ink-2">{label}</dt>
                  <dd className="text-right font-mono text-[14px] font-medium text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            !p.description && (
              <p className="text-[14px] text-ink-2">
                로스터가 알려 준 정보가 아직 많지 않습니다.
              </p>
            )
          )}
          {summary.data && (
            <div className="flex items-center justify-between rounded-[10px] bg-sunken px-[16px] py-[14px]">
              <span className="text-[13.5px] text-ink-2">
                {line
                  ? "이 원두로 내린 기록"
                  : "아직 이 원두로 내린 기록이 없어요"}
              </span>
              {line && (
                <span className="font-mono text-[14px] font-medium">
                  {line}
                </span>
              )}
            </div>
          )}
          <div className="mt-auto">
            <PrimaryButton onClick={onPick}>이 원두 고르기</PrimaryButton>
          </div>
        </>
      )}
    </section>
  );
}
