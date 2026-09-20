/** 사진이 있으면 사진, 없으면 닉네임 첫 글자로 대체한다. 카카오·구글은 사진이 선택이라 없을 수 있다. */
export function Avatar({
  nickname,
  profileImageUrl,
  size,
}: {
  nickname: string;
  profileImageUrl?: string;
  size: number;
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
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-sunken"
    >
      {nickname.charAt(0)}
    </span>
  );
}
