import { z } from "zod";

export const CreateDeviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  boardNumber: z.string().min(1),
  boardId: z.string().min(1),
  organizationId: z.string().optional(),
});

export type CreateDeviceDto = z.infer<typeof CreateDeviceSchema>;

export const DeviceParamsSchema = z.object({
  id: z.string().min(1),
});

export const BoardParamsSchema = z.object({
  id: z.string().min(1),
});
