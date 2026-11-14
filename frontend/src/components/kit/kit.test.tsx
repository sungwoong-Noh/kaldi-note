import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import KitPage from "@/app/dev/kit/page";
import { clearToast, showToast, ToastViewport } from "@/components/Toast";
import { BottomSheet, NumberCell, Segmented, SidePanel, useNumberText } from "./index";

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

  it("숫자 입력은 앞자리 0을 남기지 않고 소수 0.x는 유지하며 포커스 시 전체 선택한다", () => {
    function Probe() {
      const [val, setVal] = useState<number | null>(0);
      const text = useNumberText(val, setVal);
      return <NumberCell label="시간" accessibleName="시간" unit="초" {...text} />;
    }

    render(<Probe />);
    const input = screen.getByRole("textbox", { name: "시간" }) as HTMLInputElement;
    const selectSpy = vi.spyOn(input, "select");

    fireEvent.focus(input);
    expect(selectSpy).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "040" } });
    expect(input.value).toBe("40");

    fireEvent.change(input, { target: { value: "0.5" } });
    expect(input.value).toBe("0.5");
  });

  it("Segmented는 선택 표시 위치 이동 애니메이션을 가진다", () => {
    function SegProbe() {
      const [val, setVal] = useState<"a" | "b">("a");
      return (
        <Segmented
          label="범위"
          options={[
            { value: "a", label: "내 서랍" },
            { value: "b", label: "둘러보기" },
          ]}
          value={val}
          onChange={setVal}
        />
      );
    }

    const { container } = render(<SegProbe />);
    const indicator = container.querySelector(
      "[data-segment-indicator]",
    ) as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.className).toContain("transition-transform");
    expect(indicator.className).toContain("duration-200");
    expect(indicator.className).toContain("ease-out");
    expect(indicator.style.transform).toContain("calc(0 *");

    fireEvent.click(screen.getByRole("radio", { name: "둘러보기" }));
    expect(indicator.style.transform).toContain("calc(1 *");
  });

  it("바텀시트와 사이드 패널은 열고 닫을 때 200ms ease-out 슬라이드 상태를 가진다", () => {
    const { rerender } = render(
      <>
        <BottomSheet title="필터" open>
          내용
        </BottomSheet>
        <SidePanel title="실행 상세" open>
          패널 내용
        </SidePanel>
      </>,
    );

    const sheet = screen.getByRole("dialog", { name: "필터" });
    const panel = screen.getByRole("complementary", { name: "실행 상세" });

    expect(sheet).toHaveAttribute("data-state", "open");
    expect(sheet.className).toContain("duration-200");
    expect(sheet.className).toContain("ease-out");
    expect(sheet.className).toContain("translate-y-0");

    expect(panel).toHaveAttribute("data-state", "open");
    expect(panel.className).toContain("duration-200");
    expect(panel.className).toContain("ease-out");
    expect(panel.className).toContain("translate-x-0");

    rerender(
      <>
        <BottomSheet title="필터" open={false}>
          내용
        </BottomSheet>
        <SidePanel title="실행 상세" open={false}>
          패널 내용
        </SidePanel>
      </>,
    );

    expect(sheet).toHaveAttribute("data-state", "closed");
    expect(sheet.className).toContain("translate-y-full");
    expect(panel).toHaveAttribute("data-state", "closed");
    expect(panel.className).toContain("translate-x-full");
  });

  it("/dev/kit에 모션 예시 섹션이 있다", () => {
    const { container } = render(<KitPage />);
    const showcase = container.querySelector("[data-kit='motion-showcase']");
    expect(showcase).not.toBeNull();
  });

  it("토스트 알림은 표시된 뒤 일정 시간이 지나면 저절로 사라진다", () => {
    vi.useFakeTimers();
    clearToast();
    render(<ToastViewport />);

    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      showToast("레시피를 저장했습니다.");
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "레시피를 저장했습니다.",
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByRole("status")).toBeNull();
    vi.useRealTimers();
  });
});
