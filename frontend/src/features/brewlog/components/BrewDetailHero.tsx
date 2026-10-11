import { formatGrams } from "@/lib/format";
import { statusLabel } from "@/lib/statusLabel";
import { detailHeadline } from "../headline";
import type { BrewLog } from "../schema";

/**
 * 기록 상세의 히어로 — 대표 수치(수율 → 비율 → 물 온도) + TDS·음료·SCA 한 줄
 * (docs/specs/2026-10-11-brew-detail-fidelity.md AC-BDETAIL-02·03·16).
 *
 * <p>TDS가 없으면 TDS·SCA 칸과 진단 문장을 그리지 않는다 — 측정하지 않은 것이 결함처럼 보이면 안 된다(ADR 0004,
 * AC-WEBBREW-42). 진단 문장(`diagnosis`)은 TDS가 있을 때만 판 아래에 둔다(AC-WEBBREW-41).
 */
export function BrewDetailHero({ log }: { log: BrewLog }) {
  const lead = detailHeadline(log);
  const hasTds = log.tdsPercent !== undefined;
  const sca = hasTds ? scaLabel(log.strengthZone, log.extractionZone) : null;
  const cols = [
    hasTds && { label: "TDS", value: `${log.tdsPercent} %` },
    log.beverageWeightG !== undefined && {
      label: "음료",
      value: formatGrams(log.beverageWeightG),
    },
    sca !== null && { label: "SCA", value: sca },
  ].filter((col): col is { label: string; value: string } => Boolean(col));

  return (
    <div
      data-hero
      className="flex flex-col gap-[16px] rounded-[12px] border border-hero-line bg-hero p-[24px] text-on-hero"
    >
      <span
        data-eyebrow
        className="font-mono text-[10px] tracking-[0.14em] text-on-hero-dim uppercase"
      >
        {lead.label}
      </span>
      <span
        data-lead
        className="font-mono text-[44px] leading-none font-medium tracking-[-0.04em]"
      >
        {lead.value}
      </span>
      {cols.length > 0 && (
        <>
          <hr className="h-px border-0 bg-hero-line" />
          <div className="grid grid-cols-3 gap-[12px]">
            {cols.map((col) => (
              <div key={col.label} data-hero-col={col.label}>
                <div className="font-mono text-[9.5px] tracking-[0.1em] text-on-hero-dim uppercase">
                  {col.label}
                </div>
                <div
                  data-hero-value
                  className="mt-[4px] font-mono text-[16px] font-medium"
                >
                  {col.value}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {hasTds && log.diagnosis !== undefined && (
        <p className="text-[12.5px] leading-[1.6] text-on-hero-dim">
          {log.diagnosis}
        </p>
      )}
    </div>
  );
}

/** 둘 다 `IDEAL`이면 `적정`, 아니면 `IDEAL`이 아닌 것만 `농도 옅음 · 추출 과다`처럼. 구간이 없으면 `null`. */
function scaLabel(strength?: string, extraction?: string): string | null {
  if (strength === undefined && extraction === undefined) return null;
  const off = [
    strength !== undefined &&
      strength !== "IDEAL" &&
      `농도 ${statusLabel("strength", strength)}`,
    extraction !== undefined &&
      extraction !== "IDEAL" &&
      `추출 ${statusLabel("extraction", extraction)}`,
  ].filter(Boolean);
  return off.length === 0 ? "적정" : off.join(" · ");
}
