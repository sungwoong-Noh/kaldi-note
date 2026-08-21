/**
 * accessToken은 메모리에만 둔다.
 *
 * <p>localStorage에 넣으면 XSS로 탈취된다(docs/conventions/frontend.md「하지 말 것」). 탭을 새로 고치면 사라지지만, refresh
 * 쿠키가 살아 있으므로 첫 401에서 자동으로 복구된다.
 */
let accessToken: string | null = null;
let currentUserId: number | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getCurrentUserId(): number | null {
  return currentUserId;
}

export function setCurrentUserId(userId: number | null): void {
  currentUserId = userId;
}

/** 로그아웃과 테스트에서 쓴다. */
export function clearSession(): void {
  accessToken = null;
  currentUserId = null;
}
