import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";

/** 카카오는 이메일 제공 동의가 선택이라 `email`이 없을 수 있다. */
export const meSchema = z.object({
  id: z.number(),
  email: z.string().optional(),
  nickname: z.string(),
  profileImageUrl: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]),
  createdAt: z.string(),
});

export type Me = z.infer<typeof meSchema>;

/**
 * 내 정보. 포크 버튼 노출 판정에 `id`가 필요하다.
 *
 * <p>로그인 응답의 `userId`를 메모리에 두는 방법도 있었으나, 새로고침하면 사라져 진실 원천이 둘이 된다. 이쪽 하나로 통일했다 — 캐시가 오래 살아 실제
 * 요청은 세션당 한 번이다.
 */
export function useMe(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/users/me"), {
        schema: meSchema,
        onSessionLost,
      }),
    staleTime: 5 * 60 * 1000,
  });
}
