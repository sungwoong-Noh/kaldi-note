import { z } from "zod";

/** 백엔드 `TokenPair`. refreshToken은 BFF가 쿠키로 옮기므로 브라우저까지 내려가지 않는다. */
export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresInSeconds: z.number(),
});

/** 백엔드 `LoginResponse`. */
export const loginResponseSchema = z.object({
  tokens: tokenPairSchema,
  userId: z.number(),
  nickname: z.string(),
  newUser: z.boolean(),
});

/** BFF가 브라우저에 돌려주는 것. refreshToken이 없다. */
export const sessionSchema = z.object({
  accessToken: z.string(),
  expiresInSeconds: z.number(),
  userId: z.number(),
  nickname: z.string(),
  newUser: z.boolean(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type Session = z.infer<typeof sessionSchema>;
