import type { ComicCmsFormValues, ComicChapterFormValues, ComicStatus } from "@/lib/validation/comicCmsSchemas";

export type TabKey = "catalog" | "editor" | "chapters" | "moderation";

export type PageDraft = {
  id: string;
  file: File;
  order: number;
  previewUrl: string;
  sizeBytes: number;
  fileName: string;
};

export const MAX_PAGE_SIZE_BYTES = 2 * 1024 * 1024;

export const DEFAULT_FORM: ComicCmsFormValues = {
  title: "",
  author: "",
  artist: "",
  translator: "",
  source: "",
  description: "",
  status: "draft",
  scheduledAt: null,
  genres: [],
  tags: [],
  rankScore: 0,
  coverUrl: "",
};

export const DEFAULT_CHAPTER_FORM: ComicChapterFormValues = {
  chapterNumber: 1,
  title: "",
  status: "draft",
  scheduledAt: null,
};

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "comic"
  );
}

export function uniqueTokens(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function normalizePageOrder(pages: PageDraft[]): PageDraft[] {
  return pages.map((page, index) => ({ ...page, order: index + 1 }));
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTimeLocalInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function toFormState(record: { status: ComicStatus; title: string; author: string; artist?: string; translator?: string; source?: string; description?: string; scheduledAt?: string | null; genres?: string[]; tags?: string[]; rankScore?: number; coverUrl?: string }): ComicCmsFormValues {
  return {
    title: record.title,
    author: record.author,
    artist: record.artist ?? "",
    translator: record.translator ?? "",
    source: record.source ?? "",
    description: record.description ?? "",
    status: record.status,
    scheduledAt: record.scheduledAt ?? null,
    genres: record.genres ?? [],
    tags: record.tags ?? [],
    rankScore: record.rankScore ?? 0,
    coverUrl: record.coverUrl ?? "",
  };
}

export function statusTone(status: ComicStatus): string {
  switch (status) {
    case "published":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    case "pending":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20";
    case "archived":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20";
    default:
      return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20";
  }
}
