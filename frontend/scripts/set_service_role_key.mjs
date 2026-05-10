#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const key = args[0] || process.env.SERVICE_ROLE_KEY || '';
if (!key) {
  console.error('Usage: node set_service_role_key.mjs <sb_service_role_key>');
  process.exit(2);
}
if (!/^sb_service_role_/i.test(key.trim())) {
  console.error('Invalid key: must start with sb_service_role_');
  process.exit(3);
}

const repoRoot = path.resolve(process.cwd(), '..');
const target = path.join(repoRoot, 'frontend', '.env.local');
let existing = {};
if (fs.existsSync(target)) {
  const cur = fs.readFileSync(target, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const l of cur) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (!m) continue;
    existing[m[1]] = m[2];
  }
}
existing['SUPABASE_SERVICE_ROLE_KEY'] = key.trim();
const out = Object.entries(existing).map(([k,v]) => `${k}=${v}`);
fs.writeFileSync(target, out.join('\n') + '\n', 'utf8');
console.log('Wrote SUPABASE_SERVICE_ROLE_KEY to frontend/.env.local');
