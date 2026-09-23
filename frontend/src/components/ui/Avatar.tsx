/**
 * 사진이 없을 때 이니셜 아바타의 배경 톤 3종(AC-HOMECAL-119·120,
 * docs/design/design_handoff_kaldi_note/README.md 「Avatar」). userId 기반이라 같은
 * 사용자는 화면이 바뀌어도(팔로우 레일·프로필) 항상 같은 색을 받는다.
 */
const AVATAR_TONES = [
  "oklch(0.88 0.02 60)",
  "oklch(0.88 0.008 80)",
  "oklch(0.88 0.015 70)",
] as const;

function toneFor(userId: number): string {
  return AVATAR_TONES[userId % AVATAR_TONES.length];
}

/** 사진이 있으면 사진, 없으면 닉네임 첫 글자로 대체한다. 카카오·구글은 사진이 선택이라 없을 수 있다. */
export function Avatar({
  nickname,
  profileImageUrl,
  size,
  userId,
}: {
  nickname: string;
  profileImageUrl?: string;
  size: number;
  userId: number;
}) {
  if (profileImageUrl !== undefined) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 카카오·구글 CDN은 next/image 설정 밖이다
      <img
        src={profileImageUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, backgroundColor: toneFor(userId) }}
      className="flex items-center justify-center rounded-full"
    >
      {nickname.charAt(0)}
    </span>
  );
}
