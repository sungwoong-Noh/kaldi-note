import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import { userGrinderSchema, type UserGrinder } from "./schema";

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
