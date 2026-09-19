import type { PublicProfile } from "@/features/user/queries";

/**
 * 달력 위의 가로 목록. 첫 칸은 항상 「나」이고, 뒤에 맞팔로우 목록이 서버가 준 순서
 * 그대로 붙는다 — 프론트에서 다시 정렬하지 않는다. 정렬은 서버의 책임이고 두 곳에서
 * 하면 갈라진다(docs/specs/2026-09-19-home-calendar.md).
 */
export function FollowRail({
  me,
  mutuals,
  selectedUserId,
  onSelect,
}: {
  me: PublicProfile;
  mutuals: PublicProfile[];
  selectedUserId: number;
  onSelect: (userId: number) => void;
}) {
  return (
    <div role="tablist" className="flex gap-3 overflow-x-auto">
      <RailTab
        profile={me}
        label="나"
        selected={selectedUserId === me.id}
        onSelect={onSelect}
      />
      {mutuals.map((profile) => (
        <RailTab
          key={profile.id}
          profile={profile}
          label={profile.nickname}
          selected={selectedUserId === profile.id}
          onSelect={onSelect}
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
}: {
  profile: PublicProfile;
  label: string;
  selected: boolean;
  onSelect: (userId: number) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(profile.id)}
      className="flex flex-col items-center gap-1"
    >
      <Avatar profile={profile} />
      <span className="text-body-sm">{label}</span>
    </button>
  );
}

function Avatar({ profile }: { profile: PublicProfile }) {
  if (profile.profileImageUrl !== undefined) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 카카오·구글 CDN은 next/image 설정 밖이다
      <img
        src={profile.profileImageUrl}
        alt=""
        width={50}
        height={50}
        className="rounded-full"
      />
    );
  }
  return (
    <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-sunken">
      {profile.nickname.charAt(0)}
    </span>
  );
}
