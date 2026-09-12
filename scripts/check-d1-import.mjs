import { Miniflare } from 'miniflare';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'novelys-migration-check-'));
const mf = new Miniflare({ cf: false, modules: true, script: 'export default {fetch(){return new Response("ok")}}', compatibilityDate: '2026-05-01', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], d1Persist: join(dir, 'd1') });
try {
  const db = await mf.getD1Database('DB');
  const first = readFileSync('drizzle/0000_natural_revanche.sql', 'utf8');
  const second = readFileSync('drizzle/0001_booking_guards.sql', 'utf8');
  try { await db.exec(first); console.log('D1.exec 0000 success'); }
  catch (e) { console.log('D1.exec 0000:', e.message.slice(0, 500)); }
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.results.map(r => r.name));
  if (!tables.results.some(r => r.name === 'users')) for (const part of first.split('--> statement-breakpoint')) if (part.trim()) await db.prepare(part).run();
  try { await db.exec(second); console.log('D1.exec 0001 success'); }
  catch (e) { console.log('D1.exec 0001:', e.message.slice(0, 500)); }
  const compact = second.split('--> statement-breakpoint').map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean).join('\n');
  try { await db.exec(compact); console.log('D1.exec single-line triggers success'); }
  catch (e) { console.log('D1.exec single-line:', e.message.slice(0, 500)); }
} finally { await mf.dispose(); rmSync(dir, { recursive: true, force: true }); }
