import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

// Validate search input: embedding (1536 floats) and optional matchCount (1-100)
const SearchSchema = z.object({
  embedding: z.array(z.number()).length(1536),
  matchCount: z.number().int().min(1).max(100).optional().default(10),
});

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'server supabase unavailable' }, { status: 500 });

  try {
    const body = await req.json();
    
    // Validate input with Zod
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid search input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { embedding, matchCount } = parsed.data;

    // Call pgvector RPC with validated inputs
    // The RPC is defined in: backend-supabase/supabase/migrations/202605100001_comic_platform.sql
    const { data, error } = await supabase.rpc('search_stories', {
      query_embedding: embedding,
      match_count: matchCount,
    });

    if (error) throw error;

    return NextResponse.json({
      results: data || [],
      count: (data || []).length,
    });
  } catch (e: any) {
    console.error('Search error:', e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

/**
 * Semantic search endpoint
 * 
 * POST /api/rpc/search-stories
 * 
 * Body:
 * {
 *   "embedding": [float; 1536],  // pgvector embedding (required)
 *   "matchCount": number           // Results to return, 1-100 (optional, default 10)
 * }
 * 
 * Response:
 * {
 *   "results": [{ id, title, summary, cover_url, similarity }, ...],
 *   "count": number
 * }
 * 
 * Errors:
 * - 400: Invalid input (embedding length != 1536, matchCount out of range)
 * - 500: Server error
 */
