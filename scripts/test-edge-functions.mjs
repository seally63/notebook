#!/usr/bin/env node
/**
 * Smoke-test the deployed Edge Functions (Phase 0 acceptance).
 *
 *   1) Deploy both functions + set secrets (see supabase/README.md).
 *   2) Put SUPABASE_URL + SUPABASE_ANON_KEY in .env (or the environment).
 *   3) node scripts/test-edge-functions.mjs
 *
 * The anon key is itself a project-signed JWT, so it satisfies the functions'
 * verify_jwt without a full user sign-in — enough for a connectivity smoke test.
 */
import fs from 'node:fs';
import path from 'node:path';

function loadDotEnv() {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;

if (!URL || !KEY || URL.includes('YOUR-PROJECT')) {
  console.error('✗ Set SUPABASE_URL + SUPABASE_ANON_KEY (in .env or env) first.');
  process.exit(1);
}

async function call(fn, body) {
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}`, apikey: KEY },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

(async () => {
  console.log(`→ ${URL}\n`);

  console.log('1) translate-phrase');
  const tr = await call('translate-phrase', {
    en: 'How was your weekend?',
    target_lang: 'pl-PL',
    for_person_context: 'Polish colleague at work, peer',
  });
  console.log(`   status ${tr.status}`);
  console.log('  ', JSON.stringify(tr.body));
  const ok1 = tr.status === 200 && tr.body?.tgt;

  console.log('\n2) synthesise-phrase');
  const tgt = ok1 ? tr.body.tgt : 'Jak minął weekend?';
  const sy = await call('synthesise-phrase', { tgt, lang: 'pl-PL' });
  const mp3len = typeof sy.body === 'object' && sy.body?.mp3_base64 ? sy.body.mp3_base64.length : 0;
  console.log(`   status ${sy.status}  audio_ref=${sy.body?.audio_ref ?? '—'}  mp3_base64 chars=${mp3len}`);
  if (sy.status !== 200) console.log('  ', JSON.stringify(sy.body));
  const ok2 = sy.status === 200 && mp3len > 0;

  console.log(`\n${ok1 ? '✓' : '✗'} translate   ${ok2 ? '✓' : '✗'} synthesise`);
  process.exit(ok1 && ok2 ? 0 : 1);
})();
