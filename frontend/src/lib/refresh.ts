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
/**
 * refresh의 결과.
 *
 * <p><b>실패를 둘로 가르는 이유:</b> 오프라인에서 앱을 열면 `fetch`가 예외로 끝나는데, 이것을 인증 만료와 같이 다루면 캐시가 차 있어도 로그인
 * 화면으로 튕긴다(`docs/specs/2026-09-05-web-pwa.md`).
 */
export type RefreshResult =
  | { readonly kind: "ok"; readonly accessToken: string }
  | { readonly kind: "unauthorized" }
  | { readonly kind: "offline" };

let inFlight: Promise<RefreshResult> | null = null;

/** 테스트 전용. 모듈 스코프 상태를 테스트 사이에 지운다. */
export function __resetRefreshState(): void {
  inFlight = null;
}

/**
 * 쿠키의 refresh token으로 access token을 새로 받는다.
 *
 * @returns `ok`면 세션에 이미 반영돼 있다. 응답을 받았는데 ok가 아니면 `unauthorized`, `fetch`가 예외로 끝나면 `offline`이다.
 */
export function refreshSession(): Promise<RefreshResult> {
  inFlight ??= (async (): Promise<RefreshResult> => {
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST" });
      // 응답을 받았다면 네트워크는 살아 있다. ok가 아니면 인증 문제로 본다.
      if (!response.ok) return { kind: "unauthorized" };

      const { accessToken } = refreshResponseSchema.parse(
        await response.json(),
      );
      setAccessToken(accessToken);
      return { kind: "ok", accessToken };
    } catch {
      return { kind: "offline" };
    } finally {
      // 다음 401은 새로 갱신을 시도할 수 있어야 한다.
      inFlight = null;
    }
  })();

  return inFlight;
}
