import { z } from 'zod';

export const SearchSchema = z.object({
  embedding: z.array(z.number()).length(1536),
  matchCount: z.number().int().min(1).max(100).optional().default(10),
});

export type SearchInput = z.infer<typeof SearchSchema>;
