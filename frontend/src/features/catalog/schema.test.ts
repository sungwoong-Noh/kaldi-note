import { describe, expect, it } from "vitest";
import { crawledMomosProduct } from "@/test/fixtures";
import { beanProductSchema } from "./schema";

describe("beanProductSchema", () => {
  it("AC-CRAWL-45 · roastLevel이 없는 실제 응답을 받는다", () => {
    const parsed = beanProductSchema.parse(crawledMomosProduct);

    expect(parsed.roastLevel).toBeUndefined();
  });

  it("AC-CRAWL-42 · roastLevel: null을 받는다", () => {
    const parsed = beanProductSchema.parse({
      ...crawledMomosProduct,
      roastLevel: null,
    });

    expect(parsed.roastLevel).toBeNull();
  });
});
