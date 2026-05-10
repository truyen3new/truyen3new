import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// This hook assumes you have `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` in env
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

export default function useChapterSubscription(storyId: string, onUpdate: (chapter: any) => void) {
  useEffect(() => {
    if (!storyId) return;
    const channel = supabase.channel('public:chapters')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `story_id=eq.${storyId}` }, (payload) => {
        onUpdate(payload.new || payload.old);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storyId, onUpdate]);
}
