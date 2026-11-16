"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LoadingState } from "@/components/LoadingState";
import { RoastDot, Shell } from "@/components/ui";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useBeanProduct, useBeanSummary } from "@/features/catalog/api";
import type { BeanProduct, BeanSummary } from "@/features/catalog/schema";
import { useMe } from "@/features/user/queries";
import { ApiError } from "@/lib/api-client";
import { formatRatio, trimTrailingZero } from "@/lib/format";
import { formatKstStamp } from "@/lib/kstDate";
import { openQuickBrew, type QuickBrewPrefill } from "@/lib/quickBrew";
import { fetchBrewLogPage } from "../api";
import { ROAST_LEVEL_LABEL } from "../todayPresentation";

/**
 * 원두 상세 — 시안 11 Beans U1a · U1c~U1k · UW. 순서: 로스터 → 이름 → 요약 칩 → 컵노트 → 산지 원장 → 내 기록 →
 * 주 버튼 · 구매처 링크. 웹(≥1024)은 왼쪽 원두 정보 + 오른쪽 내 기록 2열. 규칙은 docs/specs/2026-11-15-bean-detail.md.
 */
export function BeanDetail({ id }: { id: number }) {
  const { ready, onSessionLost } = useRequireSession();
  const product = useBeanProduct(id, onSessionLost, ready);
  const summary = useBeanSummary({ beanProductId: id }, onSessionLost, ready);

  if (!ready || product.isPending) {
    return (
      <Shell stack>
        <LoadingState />
      </Shell>
    );
  }
  if (product.isError) {
    const notFound =
      product.error instanceof ApiError && product.error.code === "NOT_FOUND";
    return (
      <Shell stack>
        <BackButton />
        {notFound ? (
          <p className="py-12 text-center text-[15px] text-ink-2">
            찾을 수 없는 원두입니다.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-[12px] py-12">
            <p className="text-[15px] text-ink-2">
              원두 정보를 불러오지 못했어요
            </p>
            <button
              type="button"
              onClick={() => void product.refetch()}
              className="kn-press hit-44 rounded-[8px] border border-border px-[16px] py-[10px] text-[14px] text-ink"
            >
              다시 시도
            </button>
          </div>
        )}
      </Shell>
    );
  }

  const p = product.data;
  return (
    <Layout
      info={
        <>
          <Title eyebrow={p.roasterName} name={p.name} />
          {p.hidden ? (
            <p className="rounded-[10px] bg-sunken px-[16px] py-[14px] text-[14px] text-ink-2">
              카탈로그에서 내려간 원두예요. 내 기록은 그대로 남아 있어요.
            </p>
          ) : (
            <CatalogInfo product={p} />
          )}
        </>
      }
      summary={summary.data}
      prefill={{ beanProductId: id }}
      productUrl={p.hidden ? undefined : p.productUrl}
    />
  );
}

/** 직접 적은 원두(U1g) — 이름 + 내 기록만. 카탈로그 상세는 부르지 않는다. */
export function BeanNamedDetail({ name }: { name: string }) {
  const { ready, onSessionLost } = useRequireSession();
  const summary = useBeanSummary({ beanName: name }, onSessionLost, ready);

  if (!ready) {
    return (
      <Shell stack>
        <LoadingState />
      </Shell>
    );
  }
  return (
    <Layout
      info={
        <>
          <Title name={name} />
          <p className="text-[14px] text-ink-3">
            내가 이름만 적어 만든 원두 · 나만 보여요
          </p>
        </>
      }
      summary={summary.data}
      prefill={{ beanName: name }}
    />
  );
}

function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="hit-44 self-start text-[14.5px] text-ink-2"
    >
      ‹ 이전
    </button>
  );
}

function Title({ eyebrow, name }: { eyebrow?: string; name: string }) {
  return (
    <div className="flex flex-col gap-[6px]">
      {eyebrow && <div className="text-[13.5px] text-ink-3">{eyebrow}</div>}
      <h1 className="text-[24px] leading-[1.3] font-semibold tracking-[-0.025em] text-ink min-[1024px]:text-[34px] min-[1024px]:leading-[1.2] min-[1024px]:tracking-[-0.03em]">
        {name}
      </h1>
    </div>
  );
}

function Layout({
  info,
  summary,
  prefill,
  productUrl,
}: {
  info: ReactNode;
  summary: BeanSummary | undefined;
  prefill: QuickBrewPrefill;
  productUrl?: string;
}) {
  return (
    <Shell stack wide className="max-w-[1080px]">
      <BackButton />
      <div className="flex flex-col gap-[20px] min-[1024px]:grid min-[1024px]:grid-cols-[minmax(0,1fr)_320px] min-[1024px]:items-start min-[1024px]:gap-[48px] min-[1280px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-[20px] min-[1024px]:gap-[24px]">
          {info}
        </div>
        <div className="flex flex-col gap-[12px]">
          {summary && <MyCups summary={summary} />}
          <div className="sticky bottom-0 -mx-[24px] flex flex-col gap-[2px] border-t border-divider bg-paper px-[24px] pt-[12px] pb-[6px] min-[1024px]:static min-[1024px]:mx-0 min-[1024px]:border-t-0 min-[1024px]:p-0">
            <RecordButton summary={summary} prefill={prefill} />
            {productUrl && (
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hit-44 self-center px-[8px] py-[10px] text-[13.5px] text-accent"
              >
                구매처에서 보기 ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/**
 * 「이 원두로 기록하기」 — 빠른 기록 ①을 이 원두 + 이 원두의 지난 값(`recent[0]`)으로 연다.
 * 이 원두로 내린 적이 없으면 전체 「지난번」 값을 쓴다(AC-BEANDETAIL-30).
 */
function RecordButton({
  summary,
  prefill,
}: {
  summary: BeanSummary | undefined;
  prefill: QuickBrewPrefill;
}) {
  const me = useMe();
  const last = useQuery({
    queryKey: ["brew-logs", "quick", me.data?.id],
    enabled: me.data !== undefined && summary?.recent.length === 0,
    queryFn: () => fetchBrewLogPage(0, 1, undefined, { userId: me.data?.id }),
  });
  const fromBean = summary?.recent[0];
  const fromLast = last.data?.content[0];
  const amounts = fromBean ?? fromLast;

  return (
    <button
      type="button"
      onClick={() =>
        openQuickBrew("record", {
          ...prefill,
          doseG: amounts?.actualDoseG ?? null,
          waterG: amounts?.actualWaterG ?? null,
        })
      }
      className="kn-press block w-full rounded-[8px] bg-ink p-[15px] text-center text-[15px] font-medium text-on-ink"
    >
      이 원두로 기록하기
    </button>
  );
}

const sectionLabel =
  "font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase";

/** 정보가 이름 · 로스터뿐인지. 그러면 칩 · 컵노트 · 산지 대신 안내 한 줄. */
function isSparse(p: BeanProduct): boolean {
  return (
    !p.roastLevel &&
    !p.roastLevelCustom &&
    !p.decaf &&
    !p.description &&
    p.origins.length === 0
  );
}

function CatalogInfo({ product: p }: { product: BeanProduct }) {
  if (isSparse(p)) {
    return (
      <p className="text-[14px] text-ink-2">
        로스터가 알려 준 정보가 아직 많지 않습니다.
      </p>
    );
  }
  return (
    <>
      <Chips product={p} />
      {p.description && <CupNote text={p.description} />}
      {p.beanMix === "BLEND" ? (
        <BlendOrigins origins={p.origins} />
      ) : (
        <SingleOrigin origin={p.origins[0]} />
      )}
    </>
  );
}

const chip =
  "inline-flex items-center gap-[6px] rounded-[3px] px-[9px] py-[5px] font-mono text-[11.5px] whitespace-nowrap";

/** 싱글/블렌드 · 배전도(없으면 원문) · Agtron · 디카페인. 디카페인이 아니면 칩이 없다(질문 01). */
function Chips({ product: p }: { product: BeanProduct }) {
  return (
    <ul
      aria-label="원두 요약"
      className="flex flex-wrap items-center gap-[6px]"
    >
      <li className={`${chip} bg-sunken text-ink-2`}>
        {p.beanMix === "BLEND" ? "블렌드" : "싱글"}
      </li>
      {p.roastLevel ? (
        <li className={`${chip} bg-sunken text-ink-2`}>
          <RoastDot roastLevel={p.roastLevel} size={8} />
          {ROAST_LEVEL_LABEL[p.roastLevel]}
        </li>
      ) : (
        p.roastLevelCustom && (
          <li className={`${chip} bg-sunken text-ink-2`}>
            {p.roastLevelCustom}
          </li>
        )
      )}
      {p.roastLevel && p.roastLevelAgtron !== undefined && (
        <li className={`${chip} bg-sunken text-ink-2`}>
          {`Agtron ${p.roastLevelAgtron}`}
        </li>
      )}
      {p.decaf && (
        <li className={`${chip} bg-accent-wash text-accent`}>디카페인</li>
      )}
    </ul>
  );
}

/** 컵노트 원문. 2줄에서 접히고 누르면 펼쳐진다. */
function CupNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-[6px]">
      <div className={sectionLabel}>컵노트 · 로스터 설명 원문</div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={
          open
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
              }
        }
        className="text-left text-[15.5px] leading-[1.6] text-ink-2 italic"
      >
        “{text}”
      </button>
    </div>
  );
}

function altitude(o: BeanProduct["origins"][number]): string | null {
  if (o.altitudeMinM === undefined) return null;
  const fmt = (m: number) => m.toLocaleString("en-US");
  return o.altitudeMaxM !== undefined && o.altitudeMaxM !== o.altitudeMinM
    ? `${fmt(o.altitudeMinM)}–${fmt(o.altitudeMaxM)} m`
    : `${fmt(o.altitudeMinM)} m`;
}

/** 싱글 산지 원장 — 산지 · 고도 · 품종 · 가공. 값이 없는 행은 빠진다. */
function SingleOrigin({
  origin: o,
}: {
  origin: BeanProduct["origins"][number] | undefined;
}) {
  if (!o) return null;
  const rows: [string, string | null | undefined][] = [
    ["산지", [o.country, o.region, o.farm].filter(Boolean).join(" · ")],
    ["고도", altitude(o)],
    ["품종", o.varietyName],
    ["가공", o.processName],
  ];
  return (
    <dl className="border-b border-divider-strong">
      {rows
        .filter((r): r is [string, string] => !!r[1])
        .map(([label, value], i) => (
          <div
            key={label}
            className={`flex items-center justify-between gap-[12px] border-t py-[13px] ${i === 0 ? "border-divider-strong" : "border-divider"}`}
          >
            <dt className="text-[13.5px] text-ink-2">{label}</dt>
            <dd className="text-right font-mono text-[14px] font-medium text-ink">
              {value}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** 블렌드 산지 — 비율 막대 + 산지마다 비율(U1c). 짙은 순서대로 색을 준다. */
const BLEND_SHADES = ["bg-ink", "bg-ink-3", "bg-divider-strong", "bg-border"];

function BlendOrigins({ origins }: { origins: BeanProduct["origins"] }) {
  if (origins.length === 0) return null;
  const percent = (r: number) => `${trimTrailingZero(r)}%`;
  const hasRatio = origins.every((o) => o.ratioPercent !== undefined);
  return (
    <div className="flex flex-col gap-[10px]">
      <div className={sectionLabel}>산지 · 블렌드 {origins.length}곳</div>
      {hasRatio && (
        <div
          role="img"
          aria-label={origins
            .map((o) => `${o.country} ${percent(o.ratioPercent ?? 0)}`)
            .join(", ")}
          className="flex h-[8px] gap-[2px] overflow-hidden rounded-[3px]"
        >
          {origins.map((o, i) => (
            <span
              key={o.id}
              style={{ flex: o.ratioPercent }}
              className={BLEND_SHADES[i % BLEND_SHADES.length]}
            />
          ))}
        </div>
      )}
      <div>
        {origins.map((o, i) => (
          <div
            key={o.id}
            data-testid="blend-origin"
            className={`flex items-center gap-[12px] border-t py-[13px] ${i === 0 ? "border-divider-strong" : "border-divider"}`}
          >
            <span
              aria-hidden
              className={`size-[10px] shrink-0 rounded-[2px] ${BLEND_SHADES[i % BLEND_SHADES.length]}`}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className="text-[14px] text-ink">
                {[o.country, o.region].filter(Boolean).join(" · ")}
              </span>
              {(o.processName || o.varietyName) && (
                <span className="text-[12px] text-ink-3">
                  {[o.processName, o.varietyName].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            {o.ratioPercent !== undefined && (
              <span className="font-mono text-[15px] font-medium text-ink">
                {percent(o.ratioPercent)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 내 기록 — 잔 수 카드 + 최근 3잔. 0잔이면 안내 한 줄. */
function MyCups({ summary: s }: { summary: BeanSummary }) {
  if (s.brewCount === 0) {
    return (
      <p className="rounded-[10px] bg-sunken px-[16px] py-[14px] text-[14px] text-ink-2">
        아직 이 원두로 내린 기록이 없어요
      </p>
    );
  }
  const rating =
    s.averageRating === undefined
      ? "—"
      : s.ratedCount !== s.brewCount
        ? `★ ${s.averageRating.toFixed(1)} · ${s.ratedCount}잔 기준`
        : `★ ${s.averageRating.toFixed(1)}`;
  const amounts =
    s.frequentDoseG !== undefined && s.frequentWaterG !== undefined
      ? `${trimTrailingZero(s.frequentDoseG)}→${trimTrailingZero(s.frequentWaterG)}`
      : "—";
  return (
    <>
      <section
        aria-label="이 원두로 내린 기록"
        className="flex flex-col gap-[14px] rounded-[14px] bg-hero px-[20px] pt-[20px] pb-[18px] text-on-hero"
      >
        <div className="font-mono text-[9.5px] tracking-[0.16em] text-on-hero-dim uppercase">
          이 원두로 내린 기록
        </div>
        <div className="flex items-baseline gap-[8px]">
          <span className="font-mono text-[40px] leading-none font-medium tracking-[-0.04em]">
            {s.brewCount}
          </span>
          <span className="text-[13px] text-on-hero-dim">잔</span>
        </div>
        <div className="grid grid-cols-3 gap-[10px] border-t border-hero-line pt-[14px]">
          <Stat label="평균 별점" value={rating} />
          <Stat
            label="자주 쓴 비율"
            value={
              s.frequentRatio !== undefined ? formatRatio(s.frequentRatio) : "—"
            }
          />
          <Stat label="원두량→물량" value={amounts} />
        </div>
      </section>
      <div>
        {s.recent.map((cup, i) => (
          <Link
            key={cup.id}
            href={`/brews/${cup.id}`}
            data-testid="bean-recent-cup"
            className={`flex items-center gap-[12px] border-t py-[14px] ${i === 0 ? "border-divider-strong" : "border-divider"} ${i === s.recent.length - 1 ? "border-b border-b-divider-strong" : ""}`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[14.5px] font-medium text-ink">
                {formatKstStamp(cup.brewedAt)}
              </span>
              <span className="font-mono text-[11.5px] text-ink-3">
                {`${trimTrailingZero(cup.actualDoseG)}g → ${trimTrailingZero(cup.actualWaterG)}g · ${formatRatio(cup.brewRatio)}`}
              </span>
            </div>
            {cup.rating !== undefined && (
              <span className="font-mono text-[14px] font-medium text-ink">
                ★ {cup.rating.toFixed(1)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="font-mono text-[9px] tracking-[0.1em] text-on-hero-dim uppercase">
        {label}
      </span>
      <span className="font-mono text-[14.5px]">{value}</span>
    </div>
  );
}
