import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { beanName, combineSources, entityLabel } from "./entityLabel";

/** 백엔드가 실제로 던지는 모양 그대로 만든다. 화면은 `code`로만 분기한다. */
function apiError(status: number, code: string): ApiError {
  return new ApiError({ code, message: "테스트용", status });
}

describe("entityLabel", () => {
  it("AC-WEBNAME-10 · 레시피가 FORBIDDEN이면 비공개 레시피", () => {
    expect(entityLabel("recipe", { state: "failed", code: "FORBIDDEN" })).toBe(
      "비공개 레시피",
    );
  });

  it("AC-WEBNAME-11 · 레시피가 NOT_FOUND면 삭제된 레시피", () => {
    expect(entityLabel("recipe", { state: "failed", code: "NOT_FOUND" })).toBe(
      "삭제된 레시피",
    );
  });

  it("AC-WEBNAME-12 · 레시피가 그 밖의 이유로 실패하면 안내 문구", () => {
    expect(
      entityLabel("recipe", { state: "failed", code: "INTERNAL_ERROR" }),
    ).toBe("레시피를 불러오지 못했습니다");
  });

  it("AC-WEBNAME-13 · 레시피 조회 중이면 빈 문자열", () => {
    expect(entityLabel("recipe", { state: "loading" })).toBe("");
  });

  it("AC-WEBNAME-20 · 원두 배치가 FORBIDDEN이면 비공개 원두", () => {
    expect(entityLabel("bean", { state: "failed", code: "FORBIDDEN" })).toBe(
      "비공개 원두",
    );
  });

  it("AC-WEBNAME-21 · 원두 배치가 NOT_FOUND면 삭제된 원두", () => {
    expect(entityLabel("bean", { state: "failed", code: "NOT_FOUND" })).toBe(
      "삭제된 원두",
    );
  });

  it("AC-WEBNAME-22 · 원두가 그 밖의 이유로 실패하면 안내 문구", () => {
    expect(
      entityLabel("bean", { state: "failed", code: "INTERNAL_ERROR" }),
    ).toBe("원두를 불러오지 못했습니다");
  });

  it("AC-WEBNAME-23 · 원두 조회 중이면 빈 문자열", () => {
    expect(entityLabel("bean", { state: "loading" })).toBe("");
  });

  it("읽었으면 이름을 그대로 돌려준다", () => {
    expect(entityLabel("recipe", { state: "ready", name: "Kasuya 4:6" })).toBe(
      "Kasuya 4:6",
    );
    expect(
      entityLabel("bean", { state: "ready", name: "프릿츠 예가체프" }),
    ).toBe("프릿츠 예가체프");
  });
});

describe("beanName", () => {
  it("로스터와 제품을 공백 하나로 잇는다", () => {
    expect(beanName({ name: "예가체프" }, { name: "프릿츠" })).toBe(
      "프릿츠 예가체프",
    );
  });

  it("AC-WEBNAME-24 · 로스터를 못 찾으면 제품명만 쓴다", () => {
    expect(beanName({ name: "예가체프" }, undefined)).toBe("예가체프");
  });
});

describe("combineSources", () => {
  it("전부 성공이면 ready다", () => {
    expect(
      combineSources(
        [
          { isPending: false, error: null },
          { isPending: false, error: null },
        ],
        "프릿츠 예가체프",
      ),
    ).toEqual({ state: "ready", name: "프릿츠 예가체프" });
  });

  it("실패가 있으면 pending보다 실패가 이긴다", () => {
    // 배치가 403이면 뒤 조회는 enabled: false로 남아 영영 pending이다.
    // pending을 먼저 보면 폴백 대신 빈 자리가 나온다.
    expect(
      combineSources([
        { isPending: false, error: apiError(403, "FORBIDDEN") },
        { isPending: true, error: null },
      ]),
    ).toEqual({ state: "failed", code: "FORBIDDEN" });
  });

  it("첫 실패의 code를 쓴다", () => {
    expect(
      combineSources([
        { isPending: false, error: null },
        { isPending: false, error: apiError(500, "INTERNAL_ERROR") },
        { isPending: false, error: apiError(403, "FORBIDDEN") },
      ]),
    ).toEqual({ state: "failed", code: "INTERNAL_ERROR" });
  });

  it("실패가 없고 pending이 있으면 loading이다", () => {
    expect(
      combineSources([
        { isPending: false, error: null },
        { isPending: true, error: null },
      ]),
    ).toEqual({ state: "loading" });
  });

  it("ApiError가 아닌 오류도 실패로 본다", () => {
    // 네트워크가 끊기면 TypeError가 온다. code가 없으니 안내 문구로 떨어져야 한다.
    const source = combineSources([
      { isPending: false, error: new TypeError("Failed to fetch") },
    ]);
    expect(source).toEqual({ state: "failed", code: "" });
    expect(entityLabel("recipe", source)).toBe("레시피를 불러오지 못했습니다");
  });

  it("이름이 없으면 성공으로 보지 않는다", () => {
    // 조회는 끝났는데 조립할 이름이 없는 상태. 빈 이름을 그대로 그리면 자리가 비어 보인다.
    expect(combineSources([{ isPending: false, error: null }])).toEqual({
      state: "loading",
    });
  });
});
