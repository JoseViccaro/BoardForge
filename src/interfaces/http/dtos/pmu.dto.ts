import { z } from "zod";

export const PmuSequenceQuerySchema = z.object({
  board_id: z.string().min(1),
  trigger: z.string().default("VBUS"),
});

export type PmuSequenceQueryDto = z.infer<typeof PmuSequenceQuerySchema>;
