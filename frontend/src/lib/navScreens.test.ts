import { describe, expect, it } from "vitest";
import { backHref, isActive, isHidden } from "./navScreens";

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

describe("backHref", () => {
  it("AC-GRAMMAR-12 · 상세·도구 화면은 고정 부모 경로로 돌아간다", () => {
    expect(backHref("/recipes/12")).toBe("/recipes");
    expect(backHref("/brews/2")).toBe("/brews");
    expect(backHref("/u/11")).toBe("/");
    expect(backHref("/gear/grind-converter")).toBe("/more");
  });

  it("AC-GRAMMAR-15 · 탭 화면은 뒤로가 없다", () => {
    for (const path of ["/", "/recipes", "/brews", "/more"]) {
      expect(backHref(path)).toBeNull();
    }
  });

  it("AC-GRAMMAR-16 · 새 레시피·편집 경로는 상세로 오인하지 않는다", () => {
    expect(backHref("/recipes/new")).toBeNull();
    expect(backHref("/recipes/1/edit")).toBeNull();
    expect(backHref("/brews/1/edit")).toBeNull();
  });
});
