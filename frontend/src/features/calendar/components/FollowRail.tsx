import Link from "next/link";
import type { PublicProfile } from "@/features/user/queries";
import { Avatar } from "@/components/ui";

/**
 * 달력 위의 가로 목록. 첫 칸은 항상 「나」이고, 뒤에 맞팔로우 목록이 서버가 준 순서
 * 그대로 붙는다 — 프론트에서 다시 정렬하지 않는다. 정렬은 서버의 책임이고 두 곳에서
 * 하면 갈라진다(docs/specs/2026-09-19-home-calendar.md).
 *
 * <p>모바일은 아바타 위에 2px 링, 웹은 가로 pill로 채운다 — 가로 배치에서는 링이 약해
 * 선택 상태가 읽히지 않는다. 웹은 상단 바 아래 전폭 띠이고, 끝 칸은 「+ 초대」로 내 초대 링크가
 * 있는 `/more`에 보낸다 — 값은 목업 01 CW1·C1(docs/specs/2026-10-11-home-fidelity.md AC-HOMEFIT-01~04).
 */
export function FollowRail({
  me,
  mutuals,
  selectedUserId,
  onSelect,
  variant,
}: {
  me: PublicProfile;
  mutuals: PublicProfile[];
  selectedUserId: number;
  onSelect: (userId: number) => void;
  variant: "mobile" | "web";
}) {
  const web = variant === "web";
  return (
    <div
      data-testid="follow-rail"
      className={
        web
          ? "flex shrink-0 items-center gap-[18px] overflow-x-auto border-b border-divider px-12 py-4"
          : "flex gap-[14px] overflow-x-auto"
      }
    >
      <div
        role="tablist"
        className={`flex ${web ? "gap-[18px]" : "gap-[14px]"}`}
      >
        <RailTab
          profile={me}
          label="나"
          selected={selectedUserId === me.id}
          onSelect={onSelect}
          variant={variant}
        />
        {mutuals.map((profile) => (
          <RailTab
            key={profile.id}
            profile={profile}
            label={profile.nickname}
            selected={selectedUserId === profile.id}
            onSelect={onSelect}
            variant={variant}
          />
        ))}
      </div>
      {web && (
        <span
          aria-hidden="true"
          className="h-6 w-px shrink-0 bg-divider-strong"
        />
      )}
      <InviteLink variant={variant} />
    </div>
  );
}

function InviteLink({ variant }: { variant: "mobile" | "web" }) {
  if (variant === "web") {
    return (
      <Link
        href="/more"
        className="flex shrink-0 items-center gap-2.5 py-1.5 pr-3.5 pl-1.5"
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-border font-mono text-[15px] text-ink-3">
          +
        </span>
        <span className="text-[13.5px] text-ink-3">초대</span>
      </Link>
    );
  }
  return (
    <Link
      href="/more"
      className="flex shrink-0 flex-col items-center gap-[7px]"
    >
      <span className="flex size-[50px] items-center justify-center rounded-full border border-dashed border-border font-mono text-[18px] text-ink-3">
        +
      </span>
      <span className="text-[11.5px] text-ink-3">초대</span>
    </Link>
  );
}

function RailTab({
  profile,
  label,
  selected,
  onSelect,
  variant,
}: {
  profile: PublicProfile;
  label: string;
  selected: boolean;
  onSelect: (userId: number) => void;
  variant: "mobile" | "web";
}) {
  if (variant === "web") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={() => onSelect(profile.id)}
        className={`flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pr-3.5 pl-1.5 ${
          selected ? "bg-ink text-on-ink" : "text-ink-2"
        }`}
      >
        <Avatar
          nickname={profile.nickname}
          profileImageUrl={profile.profileImageUrl}
          size={32}
          userId={profile.id}
        />
        <span className={`text-[13.5px] ${selected ? "font-semibold" : ""}`}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(profile.id)}
      className="flex shrink-0 flex-col items-center gap-[7px]"
    >
      {/* 링은 안쪽 외곽선이다 — 목업처럼 50px 안에 그려 라벨을 밀지 않는다(AC-HOMEFIT-04). */}
      <span
        className={`flex rounded-full ${selected ? "outline-2 -outline-offset-2 outline-ink" : ""}`}
      >
        <Avatar
          nickname={profile.nickname}
          profileImageUrl={profile.profileImageUrl}
          size={50}
          userId={profile.id}
        />
      </span>
      <span
        className={`text-[11.5px] ${selected ? "font-semibold" : "text-ink-3"}`}
      >
        {label}
      </span>
    </button>
  );
}
