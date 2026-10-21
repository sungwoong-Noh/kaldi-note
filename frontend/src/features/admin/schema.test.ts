import { describe, expect, it } from "vitest";
import { z } from "zod";
import running from "@/test/admin/run-running.json";
import unspecialty from "@/test/admin/run-unspecialty.json";
import runsPage from "@/test/admin/runs-page.json";
import sources from "@/test/admin/sources.json";
import {
  crawlRunPageSchema,
  crawlRunSchema,
  crawlSourceSchema,
} from "./schema";

// 픽스처는 2026-10-19 로컬 실제 응답이다. finishedAt·lastRun이 키째 빠지는 것까지 그대로다.
describe("admin schema", () => {
  it("실제 응답을 파싱한다", () => {
    expect(z.array(crawlSourceSchema).parse(sources)).toHaveLength(2);
    expect(crawlRunSchema.parse(running).finishedAt).toBeUndefined();
    expect(crawlRunSchema.parse(unspecialty).unmapped).toHaveLength(41);
    expect(crawlRunPageSchema.parse(runsPage).content.length).toBeGreaterThan(
      0,
    );
  });
});
