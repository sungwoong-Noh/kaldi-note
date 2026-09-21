import type { PublicProfile } from "@/features/user/queries";
import { Avatar } from "@/components/ui";

/**
 * 달력 위의 가로 목록. 첫 칸은 항상 「나」이고, 뒤에 맞팔로우 목록이 서버가 준 순서
 * 그대로 붙는다 — 프론트에서 다시 정렬하지 않는다. 정렬은 서버의 책임이고 두 곳에서
 * 하면 갈라진다(docs/specs/2026-09-19-home-calendar.md).
 *
 * <p>모바일은 아바타 위에 2px 링, 웹은 가로 pill로 채운다 — 가로 배치에서는 링이 약해
 * 선택 상태가 읽히지 않는다.
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
  return (
    <div role="tablist" className="flex gap-4 overflow-x-auto">
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
        className={`flex shrink-0 items-center gap-2 rounded-control py-2 pr-4 pl-2 ${
          selected ? "bg-ink text-on-ink" : "text-ink-2"
        }`}
      >
        <Avatar
          nickname={profile.nickname}
          profileImageUrl={profile.profileImageUrl}
          size={32}
          userId={profile.id}
        />
        <span className={`text-body-sm ${selected ? "font-semibold" : ""}`}>
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
      className="flex min-w-11 shrink-0 flex-col items-center gap-2"
    >
      {/* 원형 링이다. 그 유틸리티 클래스는 Avatar.tsx만 쓰기로 정했다
          (AC-SPACE-07, docs/specs/2026-09-09-spacing-system.md) — 인라인 스타일로 대신한다. */}
      <span
        style={{ borderRadius: "50%" }}
        className={selected ? "ring-2 ring-ink" : ""}
      >
        <Avatar
          nickname={profile.nickname}
          profileImageUrl={profile.profileImageUrl}
          size={50}
          userId={profile.id}
        />
      </span>
      <span className={`text-body-sm ${selected ? "font-semibold" : "text-ink-3"}`}>
        {label}
      </span>
    </button>
  );
}
