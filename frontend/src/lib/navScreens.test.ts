import { describe, expect, it } from "vitest";
import { isActive, isHidden } from "./navScreens";

describe("isHidden", () => {
  it("로그인·작성·편집 화면은 숨긴다", () => {
    expect(isHidden("/login")).toBe(true);
    expect(isHidden("/auth/callback")).toBe(true);
    expect(isHidden("/recipes/new")).toBe(true);
    expect(isHidden("/brews/new")).toBe(true);
    expect(isHidden("/recipes/12/edit")).toBe(true);
    expect(isHidden("/brews/2/edit")).toBe(true);
  });

  it("목록·상세·더보기는 숨기지 않는다", () => {
    expect(isHidden("/")).toBe(false);
    expect(isHidden("/recipes")).toBe(false);
    expect(isHidden("/recipes/12")).toBe(false);
    expect(isHidden("/brews/2")).toBe(false);
    expect(isHidden("/more")).toBe(false);
    expect(isHidden("/gear/grind-converter")).toBe(false);
  });
});

describe("isActive", () => {
  it("홈은 정확히 일치할 때만 켜진다", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/recipes")).toBe(false);
  });

  it("나머지는 접두어로 켜진다", () => {
    expect(isActive("/recipes", "/recipes")).toBe(true);
    expect(isActive("/recipes", "/recipes/12")).toBe(true);
    expect(isActive("/recipes", "/brews")).toBe(false);
  });
});
