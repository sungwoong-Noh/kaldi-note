import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatGrams,
  formatGramsCompact,
  formatRatio,
  formatTemperature,
  formatTemperatureCompact,
} from "./format";

describe("formatDuration", () => {
  it("초를 m:ss로 바꾼다", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(15)).toBe("0:15");
    expect(formatDuration(45)).toBe("0:45");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(210)).toBe("3:30");
  });

  it("10분을 넘겨도 자릿수를 늘리지 않는다", () => {
    expect(formatDuration(600)).toBe("10:00");
    expect(formatDuration(3600)).toBe("60:00");
  });
});

describe("formatGrams", () => {
  it("AC-GRAMMAR-06 · 독립 값은 단위를 띄우고 끝의 .0을 뗀다", () => {
    expect(formatGrams(30)).toBe("30 g");
    expect(formatGrams(30.0)).toBe("30 g");
    expect(formatGrams(15.5)).toBe("15.5 g");
    expect(formatGrams(500)).toBe("500 g");
  });
});

describe("formatGramsCompact", () => {
  it("AC-GRAMMAR-07 · 요약 줄은 단위를 붙이고 끝의 .0을 뗀다", () => {
    expect(formatGramsCompact(16)).toBe("16g");
    expect(formatGramsCompact(15.5)).toBe("15.5g");
  });
});

describe("formatRatio", () => {
  it("1:N 형태로 만든다", () => {
    expect(formatRatio(16.7)).toBe("1:16.7");
    expect(formatRatio(15)).toBe("1:15.0");
  });
});

describe("formatTemperature", () => {
  it("AC-GRAMMAR-06 · 독립 값은 단위를 띄우고 끝의 .0을 뗀다", () => {
    expect(formatTemperature(92)).toBe("92 °C");
    expect(formatTemperature(92.5)).toBe("92.5 °C");
    expect(formatTemperature(100)).toBe("100 °C");
  });
});

describe("formatTemperatureCompact", () => {
  it("AC-GRAMMAR-07 · 요약 줄은 단위를 붙인다", () => {
    expect(formatTemperatureCompact(92)).toBe("92°C");
  });
});

describe("바뀌지 않는 표기", () => {
  it("AC-GRAMMAR-06 · 비율과 시간은 그대로다", () => {
    expect(formatRatio(15.6)).toBe("1:15.6");
    expect(formatDuration(210)).toBe("3:30");
  });
});
