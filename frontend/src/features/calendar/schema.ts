import { z } from "zod";
import { publicProfileSchema } from "@/features/user/queries";

/** 기록이 있는 날 하나. `primaryRecipeName`은 그날 가장 늦게 내린 기록의 레시피 제목이다. */
export const calendarDaySchema = z.object({
  date: z.string(),
  count: z.number(),
  primaryRecipeName: z.string().optional(),
});

/** 한 달치 기록일 집계. `days`는 희소 배열이다 — 기록이 없는 날은 항목 자체가 없다. */
export const calendarSchema = z.object({
  month: z.string(),
  totalCount: z.number(),
  days: z.array(calendarDaySchema),
});

export type CalendarDay = z.infer<typeof calendarDaySchema>;
export type Calendar = z.infer<typeof calendarSchema>;

/** 맞팔로우 목록. 페이지 봉투가 아니라 배열이다. */
export const mutualFollowListSchema = z.array(publicProfileSchema);
