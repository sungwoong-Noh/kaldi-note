/**
 * accessToken은 메모리에만 둔다.
 *
 * <p>localStorage에 넣으면 XSS로 탈취된다(docs/conventions/frontend.md「하지 말 것」). 탭을 새로 고치면 사라지지만, refresh
 * 쿠키가 살아 있으므로 첫 401에서 자동으로 복구된다.
 *
 * <p><b>서버에는 이 값이 없다.</b> React가 이 상태를 읽을 때는 반드시 {@link subscribeSession}과 함께
 * {@code useSyncExternalStore}를 써야 한다. 렌더 중에 그냥 읽으면 서버는 항상 null, 클라이언트는 로그인 값이라 하이드레이션이 깨진다.
 */
let accessToken: string | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

/** `useSyncExternalStore`용 구독. 반환값은 해지 함수다. */
export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  if (accessToken === token) return;
  accessToken = token;
  notify();
}

/** `useSyncExternalStore`의 클라이언트 스냅샷. 불리언이라 참조 동일성 문제가 없다. */
export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/**
 * 서버 스냅샷. **언제나 false다.**
 *
 * <p>서버는 브라우저 메모리를 볼 수 없으므로 "로그인 안 된 상태"로 그리는 것이 유일하게 정직한 답이다. 클라이언트도 이 값으로 하이드레이션한 뒤 실제 값으로
 * 다시 그린다.
 */
export function hasAccessTokenOnServer(): boolean {
  return false;
}

/** 로그아웃과 테스트에서 쓴다. */
export function clearSession(): void {
  setAccessToken(null);
}
