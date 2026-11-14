import { describe, expect, it } from "vitest";
import { beanProductSchema } from "@/features/catalog/schema";
import { brewLogWithoutTds, brewLogWithTds, fritzRoaster, yirgacheffeBatch, yirgacheffeProduct } from "@/test/fixtures";
import { brewLogSummarySchema } from "./schema";
import {
  formatLedgerGroupHeading,
  groupLogsByKstDate,
  resolveLedgerEntryPresentation,
} from "./brewLedgerPresentation";

const baseWithTds = brewLogSummarySchema.parse(brewLogWithTds);
const baseWithoutTds = brewLogSummarySchema.parse(brewLogWithoutTds);
const parsedYirgacheffeProduct = beanProductSchema.parse(yirgacheffeProduct);

describe("groupLogsByKstDate & formatLedgerGroupHeading", () => {
  it("KST 자정 경계에 맞춰 날짜별로 묶고 오늘·어제·같은 해·다른 해 머릿말을 만든다", () => {
    const groups = groupLogsByKstDate([
      { ...baseWithTds, id: 1, brewedAt: "2026-11-14T00:00:00Z" }, // KST 11.14 09:00
      { ...baseWithTds, id: 2, brewedAt: "2026-11-13T14:59:59Z" }, // KST 11.13 23:59
      { ...baseWithTds, id: 3, brewedAt: "2026-11-12T05:00:00Z" }, // KST 11.12 14:00
      { ...baseWithTds, id: 4, brewedAt: "2025-09-19T00:00:00Z" }, // 2025.09.19 금
    ]);

    expect(groups.map((g) => g.date)).toEqual([
      "2026-11-14",
      "2026-11-13",
      "2026-11-12",
      "2025-09-19",
    ]);
    expect(formatLedgerGroupHeading("2026-11-14", "2026-11-14")).toBe(
      "오늘 · 11.14 토",
    );
    expect(formatLedgerGroupHeading("2026-11-13", "2026-11-14")).toBe(
      "어제 · 11.13 금",
    );
    expect(formatLedgerGroupHeading("2026-11-12", "2026-11-14")).toBe("11.12 목");
    expect(formatLedgerGroupHeading("2025-09-19", "2026-11-14")).toBe(
      "2025.09.19 금",
    );
  });
});

describe("resolveLedgerEntryPresentation", () => {
  const beanSources = {
    productsById: new Map([[parsedYirgacheffeProduct.id, parsedYirgacheffeProduct]]),
    batchesById: new Map([[yirgacheffeBatch.id, yirgacheffeBatch]]),
    roastersById: new Map([[fritzRoaster.id, fritzRoaster]]),
  };

  it("원두 중심 기록(레시피 없음)과 레시피 중심 기록의 제목·수치·대표 수치를 가른다", () => {
    const beanEntry = resolveLedgerEntryPresentation(
      {
        ...baseWithoutTds,
        recipeId: undefined,
        beanBatchId: undefined,
        beanProductId: yirgacheffeProduct.id,
        actualDoseG: 16,
        actualWaterG: 250,
        brewRatio: 15.6,
        rating: 4,
      },
      { recipeLabels: new Map(), beanSources },
    );
    expect(beanEntry.isRecipeBrew).toBe(false);
    expect(beanEntry.title).toBe(yirgacheffeProduct.name);
    expect(beanEntry.compactDoseWater).toBe("16g → 250g");
    expect(beanEntry.ratioText).toBe("1:15.6");
    expect(beanEntry.metric).toBe("★ 4.0");

    const recipeEntry = resolveLedgerEntryPresentation(
      {
        ...baseWithTds,
        recipeId: 12,
        actualDoseG: 20,
        actualWaterG: 300,
        extractionYieldPercent: 17.6,
      },
      { recipeLabels: new Map([[12, "Kasuya 4:6"]]), beanSources },
    );
    expect(recipeEntry.isRecipeBrew).toBe(true);
    expect(recipeEntry.title).toBe("Kasuya 4:6");
    expect(recipeEntry.doseText).toBe("20 g");
    expect(recipeEntry.waterText).toBe("300 g");
    expect(recipeEntry.metric).toBe("17.6%");
  });
});
