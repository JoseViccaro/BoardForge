import { z } from "zod";

export const BoardViewParamsSchema = z.object({
  board_id: z.string().min(1),
});

export const NetQueryParamsSchema = z.object({
  search: z.string().optional(),
});

export const NetDetailParamsSchema = z.object({
  board_id: z.string().min(1),
  net_name: z.string().min(1),
});
