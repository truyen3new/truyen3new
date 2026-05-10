#!/usr/bin/env node
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH = parseInt(process.env.BATCH_SIZE || '50', 10);
const VECTOR_DIM = parseInt(process.env.VECTOR_DIM || '1536', 10);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function fetchToEmbed(limit = BATCH) {
  const { data, error } = await supabase
    .from('stories')
    .select('id, title, summary')
    .is('search_vector', null)
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// Replace this with your embedding provider integration
async function embedTexts(items) {
  // If OPENAI_API_KEY is set, call real API; otherwise produce deterministic pseudo-embeddings for local testing
  if (process.env.OPENAI_API_KEY) {
    // Minimal OpenAI Embedding example (user must install openai or implement their client)
    // This is a placeholder; users should replace with their preferred embedding provider.
    const fetch = (await import('node-fetch')).default;
    const url = 'https://api.openai.com/v1/embeddings';
    const out = [];
    for (const it of items) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'text-embedding-3-large', input: (it.title || '') + '\n' + (it.summary || '') })
      });
      const j = await resp.json();
      out.push({ id: it.id, vector: j.data[0].embedding });
    }
    return out;
  }

  // Mock embedding: simple hashed floats (not useful for production)
  return items.map((it) => {
    const seed = (it.title || '') + '|' + (it.summary || '');
    const vec = new Array(VECTOR_DIM).fill(0).map((_, i) => {
      let v = 0;
      for (let j = 0; j < seed.length; j++) v = (v * 31 + seed.charCodeAt(j) + i) % 1000;
      return (v % 1000) / 1000;
    });
    return { id: it.id, vector: vec };
  });
}

async function applyBatch(pairs) {
  // Use RPC upsert pattern: update each id with its embedding
  for (const p of pairs) {
    const { error } = await supabase
      .from('stories')
      .update({ search_vector: p.vector })
      .eq('id', p.id);
    if (error) console.error('update-error', p.id, error.message || error);
    else process.stdout.write('.');
  }
}

async function run() {
  while (true) {
    const items = await fetchToEmbed(BATCH);
    if (!items.length) break;
    const embeddings = await embedTexts(items);
    await applyBatch(embeddings);
  }
  console.log('\nBackfill complete (or no rows found).');
}

run().catch((e) => { console.error(e); process.exit(1); });
