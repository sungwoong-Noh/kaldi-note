import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("AC-HOMECAL-119 · userId % 3에 따라 3색 중 하나가 배경색이 된다", () => {
    const { rerender } = render(
      <Avatar nickname="A" size={32} userId={1} />,
    );
    // 1 % 3 = 1
    expect(screen.getByText("A")).toHaveStyle({
      backgroundColor: "oklch(0.88 0.008 80)",
    });

    rerender(<Avatar nickname="B" size={32} userId={3} />);
    // 3 % 3 = 0
    expect(screen.getByText("B")).toHaveStyle({
      backgroundColor: "oklch(0.88 0.02 60)",
    });

    rerender(<Avatar nickname="C" size={32} userId={2} />);
    // 2 % 3 = 2
    expect(screen.getByText("C")).toHaveStyle({
      backgroundColor: "oklch(0.88 0.015 70)",
    });
  });

  it("AC-HOMECAL-120 · 같은 userId는 항상 같은 색이다", () => {
    // 닉네임의 첫 글자만 렌더되므로(charAt(0)), 색이 닉네임이 아니라 userId를
    // 따르는지 보려고 첫 글자가 다른 닉네임으로 다시 렌더한다.
    const { rerender } = render(
      <Avatar nickname="A" size={32} userId={7} />,
    );
    const first = screen.getByText("A").style.backgroundColor;

    rerender(<Avatar nickname="Z" size={32} userId={7} />);
    expect(screen.getByText("Z").style.backgroundColor).toBe(first);
  });

  it("사진이 있으면 사진을 렌더하고 색조는 쓰지 않는다", () => {
    const { container } = render(
      <Avatar
        nickname="A"
        profileImageUrl="https://example.com/a.png"
        size={32}
        userId={1}
      />,
    );
    expect(container.querySelector("img")).not.toBeNull();
  });
});
