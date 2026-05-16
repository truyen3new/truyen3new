import { z } from "zod";

export const ComicStatus = z.enum(["draft", "published", "pending", "archived"]);
export type ComicStatus = z.infer<typeof ComicStatus>;

export const ComicCmsFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  artist: z.string().optional().default(""),
  translator: z.string().optional().default(""),
  source: z.string().optional().default(""),
  description: z.string().optional().default(""),
  status: ComicStatus.default("draft"),
  scheduledAt: z.string().nullable().optional().default(null),
  genres: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  rankScore: z.number().optional().default(0),
  coverUrl: z.string().optional().default(""),
});
export type ComicCmsFormValues = z.infer<typeof ComicCmsFormSchema>;

export const ComicChapterFormSchema = z.object({
  chapterNumber: z.number().min(1, "Chapter number must be at least 1"),
  title: z.string().optional().default(""),
  status: ComicStatus.default("draft"),
  scheduledAt: z.string().nullable().optional().default(null),
});
export type ComicChapterFormValues = z.infer<typeof ComicChapterFormSchema>;

export const ComicReportedCommentStatus = z.enum(["open", "resolved", "dismissed"]);

export const ComicReportedComment = z.object({
  id: z.string(),
  comicId: z.string(),
  commentId: z.string(),
  reporter: z.string(),
  comment: z.string(),
  status: ComicReportedCommentStatus,
  createdAt: z.string(),
});
export type ComicReportedComment = z.infer<typeof ComicReportedComment>;

export const ComicModerationSchema = z.object({
  keywords: z.array(z.string()).default(["spoiler", "pirated", "leak"]),
  reportedComments: z.array(ComicReportedComment).default([]),
});
export type ComicModerationState = z.infer<typeof ComicModerationSchema>;
