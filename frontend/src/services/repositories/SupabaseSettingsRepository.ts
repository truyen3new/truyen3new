import { getServerSupabase } from '@/lib/supabase/server';
import { BaseRepository } from '@/shared/core';
import { SiteSetting } from '@/types/entities';
import { ISettingsRepository } from '@/types/repos';

export class SupabaseSettingsRepository extends BaseRepository<SiteSetting, string> implements ISettingsRepository {
  constructor() {
    super('SupabaseSettingsRepository');
  }

  async getSettingByKey(key: string): Promise<SiteSetting | null> {
    const supabase = getServerSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from('site_settings').select('*').eq('key', key).single();
    if (error) throw error;
    return data;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    const supabase = getServerSupabase();
    if (!supabase) throw new Error('Server supabase client not available');
    const { error } = await supabase
      .from('site_settings')
      .update({ value })
      .eq('key', key);
    if (error) throw error;
  }

  async findById(id: string): Promise<SiteSetting | null> {
    return this.getSettingByKey(id);
  }

  async save(entity: SiteSetting): Promise<void> {
    await this.updateSetting(entity.key, entity.value);
  }

  async delete(_id: string): Promise<void> {
    throw new Error('Delete is not supported for site settings');
  }
}

export default SupabaseSettingsRepository;
