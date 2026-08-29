import { z } from 'zod';

export const chatMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(8_000),
  })
  .strict();

export const chatMessagesSchema = z.array(chatMessageSchema).min(1).max(40);

export type ChatMessage = z.infer<typeof chatMessageSchema>;
