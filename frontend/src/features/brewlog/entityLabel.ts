import { ApiError } from "@/lib/api-client";

/** 이름을 얻으려 부른 조회의 결과. 화면은 이것 하나만 만들어 `entityLabel`에 넘긴다. */
export type LabelSource =
  | { state: "loading" }
  | { state: "ready"; name: string }
  | { state: "failed"; code: string };

export type LabelKind = "recipe" | "bean";

/** 대상마다 문구가 다르다. 스펙 「폴백 문구」 표와 문자 하나까지 같아야 한다. */
const WORDS: Record<LabelKind, { noun: string; unreadable: string }> = {
  recipe: { noun: "레시피", unreadable: "레시피를 불러오지 못했습니다" },
  bean: { noun: "원두", unreadable: "원두를 불러오지 못했습니다" },
};

/**
 * 조회 결과를 화면에 그대로 넣을 문자열로 바꾼다.
 *
 * <p>이름을 못 읽는 것은 정상 동작이다 — 남의 로그는 보이되 그 레시피는 못 읽을 수 있다. 그래서 `레시피 12` 같은 id
 * 폴백 대신 <b>왜 못 읽었는지</b>를 보여준다. 사용자가 비공개인지 삭제됐는지 통신 실패인지 구분할 수 있어야 한다.
 *
 * <p>조회 중에는 빈 문자열이다. 폴백 문구를 먼저 그리면 성공하는 경우에도 `비공개 레시피`가 한 번 깜빡인다.
 */
export function entityLabel(kind: LabelKind, source: LabelSource): string {
  const { noun, unreadable } = WORDS[kind];

  switch (source.state) {
    case "loading":
      return "";
    case "ready":
      return source.name;
    case "failed":
      if (source.code === "FORBIDDEN") return `비공개 ${noun}`;
      if (source.code === "NOT_FOUND") return `삭제된 ${noun}`;
      return unreadable;
  }
}

/**
 * 원두 이름을 조립한다. `프릿츠 예가체프`.
 *
 * <p>로스터를 못 찾으면 제품명만 쓴다 — 앞에 공백이 남지 않도록 빈 값을 먼저 걸러낸다.
 */
export function beanName(
  product: { name: string } | undefined,
  roaster: { name: string } | undefined,
): string {
  return [roaster?.name, product?.name].filter(Boolean).join(" ");
}

/** `useQuery`가 돌려주는 것 중 판정에 필요한 두 가지만 본다. */
export interface QuerySnapshot {
  readonly isPending: boolean;
  readonly error: unknown;
}

/**
 * 조회 여러 건을 `LabelSource` 하나로 접는다.
 *
 * <p><b>실패를 pending보다 먼저 본다.</b> 원두 이름은 배치 → 제품 → 로스터 연쇄인데, 배치가 403이면 뒤 조회는
 * `enabled: false`로 남고 그 상태의 `isPending`은 `true`다. pending을 먼저 보면 폴백 대신 빈 자리가 나온다.
 *
 * @param name 전부 성공했을 때 쓸 이름. 비어 있으면 아직 조립되지 않은 것으로 본다.
 */
export function combineSources(
  snapshots: readonly QuerySnapshot[],
  name?: string,
): LabelSource {
  const failed = snapshots.find((snapshot) => snapshot.error != null);
  if (failed !== undefined) {
    const { error } = failed;
    return {
      state: "failed",
      code: error instanceof ApiError ? error.code : "",
    };
  }

  if (snapshots.some((snapshot) => snapshot.isPending)) {
    return { state: "loading" };
  }

  // 조회는 끝났는데 조립할 이름이 없다. 빈 이름을 그리면 자리가 비어 보이므로 아직 로딩으로 둔다.
  if (name === undefined || name === "") {
    return { state: "loading" };
  }

  return { state: "ready", name };
}
