import { NextResponse } from "next/server";
import { z } from "zod";
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from "@/features/auth/cookie";
import { loginResponseSchema } from "@/features/auth/schema";
import { backendUrl } from "@/lib/api-client";

/**
 * 테스트 로그인을 백엔드에 중계하고 refresh 쿠키를 심는다.
 *
 * <p><b>시크릿을 여기 저장하지 않는다.</b> 사람이 `/login/test`에서 입력한 값을 받아 백엔드 헤더로 흘려보내기만 한다. 환경변수에 두면 이
 * 경로가 곧 잠금 없는 로그인이 된다 — 아무나 URL만 치면 된다.
 */
const requestSchema = z.object({
  secret: z.string().min(1),
  userId: z.number().optional(),
  handle: z.string().optional(),
  nickname: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "요청 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  // 시크릿을 본문에서 떼어낸다 — 백엔드에는 헤더로만 간다.
  const { secret, ...body } = parsed.data;

  const upstream = await fetch(backendUrl("/api/v1/auth/login/test"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Login-Secret": secret,
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    // 백엔드의 code와 상태를 그대로 넘긴다. 쿠키는 심지 않는다.
    const failure = await upstream.json().catch(() => ({
      code: "CLIENT_ERROR",
      message: "일시적인 오류가 발생했습니다.",
    }));
    return NextResponse.json(failure, { status: upstream.status });
  }

  const login = loginResponseSchema.parse(await upstream.json());

  const response = NextResponse.json({
    accessToken: login.tokens.accessToken,
    expiresInSeconds: login.tokens.expiresInSeconds,
    userId: login.userId,
    nickname: login.nickname,
    newUser: login.newUser,
  });
  response.cookies.set(
    REFRESH_COOKIE_NAME,
    login.tokens.refreshToken,
    refreshCookieOptions,
  );
  return response;
}
