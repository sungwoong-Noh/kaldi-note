import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicProfile } from "@/features/user/queries";
import { FollowRail } from "./FollowRail";

const me: PublicProfile = { id: 11, nickname: "노성웅" };
const 지연: PublicProfile = { id: 12, nickname: "지연" };
const 민재: PublicProfile = { id: 13, nickname: "민재" };

describe("FollowRail", () => {
  it("AC-HOMECAL-36 · 첫 칸이 나이고 기본 선택이다", () => {
    render(
      <FollowRail me={me} mutuals={[지연, 민재]} selectedUserId={me.id} onSelect={() => {}} variant="mobile" />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("나");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("AC-HOMECAL-44 · profileImageUrl이 없으면 닉네임 첫 글자가 뜬다", () => {
    render(
      <FollowRail me={me} mutuals={[지연]} selectedUserId={me.id} onSelect={() => {}} variant="mobile" />,
    );

    const tab = screen.getByRole("tab", { name: /지연/ });
    expect(tab.querySelector("img")).toBeNull();
    expect(tab).toHaveTextContent("지");
  });

  it("profileImageUrl이 있으면 img로 그린다", () => {
    const withPhoto: PublicProfile = {
      id: 14,
      nickname: "하은",
      profileImageUrl: "https://k.kakaocdn.net/dn/xxxx/profile.jpg",
    };
    render(
      <FollowRail me={me} mutuals={[withPhoto]} selectedUserId={me.id} onSelect={() => {}} variant="mobile" />,
    );

    const tab = screen.getByRole("tab", { name: /하은/ });
    expect(tab.querySelector("img")).not.toBeNull();
  });

  it("AC-HOMECAL-47 · tablist 역할을 갖는다", () => {
    render(
      <FollowRail me={me} mutuals={[지연]} selectedUserId={me.id} onSelect={() => {}} variant="mobile" />,
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("칸을 누르면 onSelect가 그 사람의 id로 불린다", async () => {
    const onSelect = vi.fn();
    render(
      <FollowRail me={me} mutuals={[지연]} selectedUserId={me.id} onSelect={onSelect} variant="mobile" />,
    );

    screen.getByRole("tab", { name: /지연/ }).click();
    expect(onSelect).toHaveBeenCalledWith(12);
  });

  it("AC-HOMECAL-71 · 웹에서 선택된 칸이 채운 pill이다", () => {
    render(
      <FollowRail me={me} mutuals={[지연]} selectedUserId={me.id} onSelect={() => {}} variant="web" />,
    );

    const selected = screen.getByRole("tab", { name: /나/ });
    const unselected = screen.getByRole("tab", { name: /지연/ });
    expect(selected.className).toContain("bg-ink");
    expect(unselected.className).not.toContain("bg-ink");
  });
});
