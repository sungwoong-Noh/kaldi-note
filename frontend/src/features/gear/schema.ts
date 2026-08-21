import { z } from "zod";

export const brewerSchema = z.object({
  id: z.number(),
  brand: z.string(),
  name: z.string(),
  type: z.string().optional(),
  isSystem: z.boolean().optional(),
});

export const brewFilterSchema = z.object({
  id: z.number(),
  name: z.string(),
  material: z.string().optional(),
  shape: z.string().optional(),
  isSystem: z.boolean().optional(),
});

export const brewerListSchema = z.array(brewerSchema);
export const brewFilterListSchema = z.array(brewFilterSchema);

export type Brewer = z.infer<typeof brewerSchema>;
export type BrewFilter = z.infer<typeof brewFilterSchema>;
