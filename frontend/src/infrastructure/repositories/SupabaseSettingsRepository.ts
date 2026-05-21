import { SiteSetting } from '@/types/entities';
import { ISettingsRepository } from '@/domain/interfaces';
import { apiClient } from '@/lib/apiClient';

export class SupabaseSettingsRepository implements ISettingsRepository {
  async getSettingByKey(key: string): Promise<SiteSetting | null> {
    const rows = await apiClient.get<SiteSetting[]>(`/api/admin/site-settings?keys=${encodeURIComponent(key)}`);
    return rows[0] ?? null;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    await apiClient.post('/api/admin/site-settings', { key, value });
  }
}

export default SupabaseSettingsRepository;
