import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingState } from "./LoadingState";

describe("LoadingState", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("AC-POLISH-04 · 199ms까지는 한 번도 뜨지 않는다", () => {
    render(<LoadingState />);

    act(() => {
      vi.advanceTimersByTime(199);
    });

    expect(screen.queryByText("불러오는 중")).not.toBeInTheDocument();
  });

  it("AC-POLISH-05 · 200ms가 지나면 뜬다", () => {
    render(<LoadingState />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("불러오는 중")).toBeInTheDocument();
  });

  it("AC-POLISH-06 · role이 status이고 이름이 불러오는 중이다", () => {
    render(<LoadingState />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole("status", { name: "불러오는 중" })).toBeInTheDocument();
  });
});
