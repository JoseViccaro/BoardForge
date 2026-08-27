import { z } from "zod";

export const SchematicSearchParamsSchema = z.object({
  schematic_id: z.string().min(1),
});

export const SchematicSearchQuerySchema = z.object({
  query: z.string().min(1),
});

export const SchematicPageParamsSchema = z.object({
  schematic_id: z.string().min(1),
  page_number: z.coerce.number().int().min(1),
});
