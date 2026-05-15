#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

function readEnvFile(root) {
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = {};
  for (const l of lines) {
    const m = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(l);
    if (m) {
      out[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  }
  return out;
}

async function main() {
  try {
    const repoRoot = path.resolve(__dirname, '..');
    const env = readEnvFile(repoRoot);
    const token = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    const account = env.CF_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
    if (!token || !account) {
      console.error('Missing CF_ACCOUNT_ID or CF_API_TOKEN. Check .env or environment.');
      process.exit(1);
    }

    function request(method, path, body) {
      return new Promise((resolve, reject) => {
        const opts = {
          hostname: 'api.cloudflare.com',
          path: '/client/v4/' + path,
          method,
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
        };
        const req = https.request(opts, res => {
          let b = '';
          res.on('data', c => (b += c));
          res.on('end', () => {
            try { resolve(JSON.parse(b)); } catch (e) { resolve(b); }
          });
        });
        req.on('error', e => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    }

    console.log('Listing D1 databases for account', account);
    const list = await request('GET', `accounts/${account}/d1/database`);
    if (!list || !list.success || !Array.isArray(list.result)) {
      console.error('Failed to list databases:', JSON.stringify(list, null, 2));
      process.exit(1);
    }

    const candidates = list.result.filter(db => typeof db.name === 'string' && db.name.startsWith('tenant-provision'));
    if (candidates.length === 0) {
      console.log('No tenant-provision databases found to delete.');
      process.exit(0);
    }

    console.log('Found', candidates.length, 'databases to delete. Names:');
    for (const c of candidates) console.log('-', c.name, c.uuid || c.id);

    for (const db of candidates) {
      const id = db.uuid || db.id;
      if (!id) {
        console.warn('Skipping db without id/uuid:', db);
        continue;
      }
      console.log('Deleting', db.name, id);
      const res = await request('DELETE', `accounts/${account}/d1/database/${id}`);
      console.log('Delete response:', JSON.stringify(res));
    }

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
