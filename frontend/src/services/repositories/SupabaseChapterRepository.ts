import { Chapter } from '@/types/entities';
import { IChapterRepository } from '@/types/repos';
import { getPrivilegedAuthHeadersWithInternal as getPrivilegedAuthHeaders } from '@/lib/requestAuth';

async function getAuthHeaders(): Promise<Record<string, string>> {
  return getPrivilegedAuthHeaders();
}

export class SupabaseChapterRepository implements IChapterRepository {
  async getChapterById(id: string): Promise<Chapter | null> {
    const res = await fetch(`/api/chapters?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  }

  async getChaptersByStoryId(storyId: string): Promise<Chapter[]> {
    const res = await fetch(`/api/chapters?storyId=${encodeURIComponent(storyId)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  }

  async saveChapter(chapter: Partial<Chapter>): Promise<Chapter> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/internal/admin/manage-chapter', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ chapter }) });
    if (!res.ok) throw new Error('Request failed');
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    const created = await this.getChapterById(json.chapter.id);
    if (!created) throw new Error('Chapter was created but could not be retrieved');
    return created;
  }
}

export default SupabaseChapterRepository;
