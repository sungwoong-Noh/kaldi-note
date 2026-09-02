import { describe, expect, it } from "vitest";
import { mapFieldErrors } from "./fieldErrors";

describe("mapFieldErrors", () => {
  it("스칼라 필드는 이름 그대로 매핑한다", () => {
    const mapped = mapFieldErrors([
      { field: "waterG", message: "3000 이하여야 합니다" },
    ]);

    expect(mapped.byField.waterG).toBe("3000 이하여야 합니다");
    expect(mapped.unmapped).toEqual([]);
  });

  it("배열 표기는 인덱스를 뽑아 스텝별로 모은다", () => {
    const mapped = mapFieldErrors([
      { field: "steps[2].waterG", message: "물량이 0보다 커야 합니다" },
    ]);

    expect(mapped.byStepIndex[2]).toBe("물량이 0보다 커야 합니다");
    expect(mapped.byField).toEqual({});
  });

  it("모르는 필드는 버리지 않고 unmapped에 남긴다", () => {
    const mapped = mapFieldErrors([
      { field: "unknownField", message: "알 수 없는 값입니다" },
    ]);

    expect(mapped.unmapped).toEqual(["unknownField: 알 수 없는 값입니다"]);
    expect(mapped.byField).toEqual({});
  });

  it("같은 스텝에 오류가 둘이면 줄바꿈으로 잇는다", () => {
    const mapped = mapFieldErrors([
      { field: "steps[0].waterG", message: "물량이 필요합니다" },
      { field: "steps[0].durationSeconds", message: "0 이상이어야 합니다" },
    ]);

    expect(mapped.byStepIndex[0]).toBe(
      "물량이 필요합니다\n0 이상이어야 합니다",
    );
  });

  it("빈 배열이면 전부 비어 있다", () => {
    const mapped = mapFieldErrors([]);

    expect(mapped).toEqual({ byField: {}, byStepIndex: {}, unmapped: [] });
  });

  it("브루잉 로그와 선행 데이터의 필드도 입력칸에 붙는다", () => {
    const mapped = mapFieldErrors([
      { field: "brewedAt", message: "미래 시각은 기록할 수 없습니다" },
      { field: "actualDoseG", message: "0보다 커야 합니다" },
      { field: "tdsPercent", message: "0 이상이어야 합니다" },
      { field: "rating", message: "5.0 이하여야 합니다" },
      { field: "overallNote", message: "1000자 이하여야 합니다" },
      { field: "weightG", message: "10.0 이상이어야 합니다" },
      { field: "roastedAt", message: "미래 날짜일 수 없습니다" },
      { field: "name", message: "100자 이하여야 합니다" },
      { field: "country", message: "필수입니다" },
    ]);

    expect(mapped.unmapped).toEqual([]);
    expect(mapped.byField.brewedAt).toBe("미래 시각은 기록할 수 없습니다");
    expect(mapped.byField.name).toBe("100자 이하여야 합니다");
    expect(mapped.byField.country).toBe("필수입니다");
  });
});
