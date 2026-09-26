import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoastDot } from "./RoastDot";

describe("RoastDot", () => {
  it("AC-HOMECAL-75 · roast dot 색이 로스팅 강도에 따라 다르다", () => {
    const { container: light } = render(<RoastDot roastLevel="LIGHT" />);
    const { container: dark } = render(<RoastDot roastLevel="DARK" />);
    const lightDot = light.querySelector("[data-roast-dot]");
    const darkDot = dark.querySelector("[data-roast-dot]");
    expect(lightDot).not.toBeNull();
    expect(darkDot).not.toBeNull();

    expect((lightDot as HTMLElement).style.backgroundColor).not.toBe(
      (darkDot as HTMLElement).style.backgroundColor,
    );
  });

  it("roastLevel이 없으면 아무것도 렌더하지 않는다", () => {
    const { container } = render(<RoastDot />);
    expect(container.querySelector("[data-roast-dot]")).toBeNull();
  });
});
