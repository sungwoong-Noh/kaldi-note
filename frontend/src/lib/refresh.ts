import { z } from "zod";
import { setAccessToken } from "./session";

const refreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresInSeconds: z.number(),
});

/**
 * 진행 중인 refresh 요청.
 *
 * <p>합치지 않으면 안 되는 이유가 둘이다. (1) 상세 화면은 레시피·브루어·필터·내정보를 함께 부르므로 넷이 동시에 401을 받을 수 있다. (2) 개발
 * 모드(StrictMode)는 effect를 두 번 실행한다. **백엔드가 refresh 토큰을 회전시키므로 두 번 보내면 뒤엣것이 이미 무효해진 토큰을 쓰게 된다.**
 */
let inFlight: Promise<string | null> | null = null;

/** 테스트 전용. 모듈 스코프 상태를 테스트 사이에 지운다. */
export function __resetRefreshState(): void {
  inFlight = null;
}

/**
 * 쿠키의 refresh token으로 access token을 새로 받는다.
 *
 * @returns 새 access token, 실패하면 null. 성공 시 세션에 이미 반영돼 있다.
 */
export function refreshSession(): Promise<string | null> {
  inFlight ??= (async () => {
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST" });
      if (!response.ok) return null;

      const { accessToken } = refreshResponseSchema.parse(
        await response.json(),
      );
      setAccessToken(accessToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      // 다음 401은 새로 갱신을 시도할 수 있어야 한다.
      inFlight = null;
    }
  })();

  return inFlight;
}
