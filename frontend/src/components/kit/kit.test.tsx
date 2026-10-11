import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KitPage from "@/app/dev/kit/page";
import { NumberCell } from "./index";

/** 기록 폼 시안의 공용 부품 — docs/specs/2026-10-11-brew-form-fidelity.md */
describe("키트 부품", () => {
  it("AC-BREWFIT-01 · 공용 부품 4종이 /dev/kit에 있다", () => {
    const { container } = render(<KitPage />);

    for (const name of [
      "section-label",
      "number-cell",
      "ledger-field",
      "taste-dots",
    ]) {
      expect(
        container.querySelectorAll(`[data-kit="${name}"]`).length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("AC-BREWFIT-02 · 숫자 셀은 라벨이 칸 안에 있고 단위가 값 뒤에 붙는다", () => {
    render(
      <NumberCell
        label="원두"
        accessibleName="원두량"
        unit="g"
        value="30.5"
        readOnly
      />,
    );

    const input = screen.getByRole("textbox", { name: "원두량" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveValue("30.5");

    const cell = input.closest("[data-kit='number-cell']") as HTMLElement;
    expect(within(cell).getByText("원두")).toBeInTheDocument();
    expect(within(cell).getByText("g")).toBeInTheDocument();
  });

  it("AC-BREWFIT-27 · 새 부품은 색 토큰만 쓴다", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "index.tsx"),
      "utf8",
    );

    for (const name of [
      "SectionLabel",
      "NumberCell",
      "LedgerField",
      "TasteDots",
    ]) {
      const start = source.indexOf(`export function ${name}(`);
      expect(start, `${name}가 없다`).toBeGreaterThanOrEqual(0);
      const next = source.indexOf("\nexport function ", start + 1);
      const body = source.slice(start, next === -1 ? undefined : next);

      expect(body).not.toMatch(/oklch\(|#[0-9a-fA-F]{3,6}\b|rgb\(/);
    }
  });
});
