"use client";

import { useRequireSession } from "@/features/auth/useRequireSession";
import {
  type FollowStatus,
  useFollowStatus,
  useMe,
  usePublicProfile,
  useToggleFollow,
} from "@/features/user/queries";
import { LoadingState } from "@/components/LoadingState";

/** 상태 넷을 문구 하나로 접는다. 화면이 boolean 셋을 직접 읽으면 조합을 빠뜨린다. */
function noticeFor(status: FollowStatus): string | null {
  if (status.mutual) return "맞팔로우 — 서로의 기록이 보입니다";
  if (status.following) return "상대도 나를 팔로우하면 서로의 기록이 보입니다";
  if (status.followedBy) return "나를 팔로우하고 있습니다";
  return null;
}

export function UserProfile({ id }: { id: number }) {
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);
  const profile = usePublicProfile(id, onSessionLost);

  const isMe = me.data?.id === id;
  const status = useFollowStatus(
    id,
    ready && me.isSuccess && !isMe,
    onSessionLost,
  );

  if (!ready || profile.isPending) {
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
  }

  if (profile.error) {
    return (
      <Shell>
        <p className="text-muted">
          사용자를 찾을 수 없습니다
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-4">
        {profile.data.profileImageUrl !== undefined && (
          // eslint-disable-next-line @next/next/no-img-element -- 카카오 CDN은 next/image 설정 밖이다
          <img
            src={profile.data.profileImageUrl}
            alt=""
            className="size-16 rounded-full object-cover"
          />
        )}
        <h1 className="text-xl font-semibold">{profile.data.nickname}</h1>
      </div>

      {isMe ? (
        <p className="text-muted">나</p>
      ) : (
        status.isSuccess && <FollowSection id={id} status={status.data} />
      )}
    </Shell>
  );
}

function FollowSection({ id, status }: { id: number; status: FollowStatus }) {
  const toggle = useToggleFollow(id);
  const notice = noticeFor(status);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ follow: !status.following })}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-3 text-on-accent disabled:opacity-50"
      >
        {status.following ? "팔로우 취소" : "팔로우"}
      </button>
      {notice !== null && (
        <p className="text-muted">{notice}</p>
      )}
      {toggle.error !== null && (
        <p className="text-danger">{toggle.error.message}</p>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-col gap-5 px-4 py-6">{children}</main>;
}
