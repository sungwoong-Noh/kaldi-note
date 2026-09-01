import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import {
  grindConversionSchema,
  userGrinderSchema,
  type GrindConversion,
  type UserGrinder,
} from "./schema";

export type GrindConversionRequestBody = {
  sourceGrinderModelId: number;
  sourceSetting: number;
  targetGrinderModelId: number;
};

/**
 * 그라인더 간 분쇄도 환산.
 *
 * <p>`useGrindPreview`와 달리 두 그라인더를 직접 고른다 — 미리보기는 source와 target이 같은 특수 케이스였다.
 * 범위 판정은 서버 몫이라 화면이 미리 막지 않는다.
 */
export function convertGrind(
  body: GrindConversionRequestBody,
  onSessionLost?: () => void,
): Promise<GrindConversion> {
  return authedRequest(backendUrl("/api/v1/gear/grind-conversions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: grindConversionSchema,
    onSessionLost,
  });
}

export type UserGrinderRequestBody = {
  grinderModelId: number;
  nickname?: string;
};

/** 내 그라인더 등록. 별명은 선택이라, 비어 있으면 부르는 쪽에서 키째 빼고 넘긴다. */
export function createUserGrinder(
  body: UserGrinderRequestBody,
  onSessionLost?: () => void,
): Promise<UserGrinder> {
  return authedRequest(backendUrl("/api/v1/gear/user-grinders"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: userGrinderSchema,
    onSessionLost,
  });
}
