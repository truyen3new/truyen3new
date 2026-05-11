import { z } from 'zod';

export const ChapterSchema = z.object({
  story_id: z.string().uuid('story_id must be a valid UUID'),
  chapter_number: z.number().int().positive('chapter_number must be a positive integer'),
  title: z.string().min(1).max(500, 'title must be between 1 and 500 characters'),
  content: z.string().min(1, 'content is required'),
  vip_content: z.boolean().optional().default(false),
});

export type ChapterInput = z.infer<typeof ChapterSchema>;

export const StorySchema = z.object({
  title: z.string().min(1).max(500, 'title must be between 1 and 500 characters'),
  summary: z.string().max(2000, 'summary must be at most 2000 characters').optional(),
  cover_url: z.string().url('cover_url must be a valid URL').optional(),
  author_id: z.string().uuid('author_id must be a valid UUID'),
  category_id: z.string().uuid('category_id must be a valid UUID'),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
});

export type StoryInput = z.infer<typeof StorySchema>;

export const ViewSchema = z.object({
  storyId: z.string().uuid('storyId must be a valid UUID'),
});

export type ViewInput = z.infer<typeof ViewSchema>;
