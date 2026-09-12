import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { dateKey, clock, dayLabel } from '../lib/time.ts';
export type Env = {
    DB: any;
    BUCKET: any;
    [key: string]: any;
};
export type User = {
    id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
    phone: string;
    demo: number;
};
export const id = () => crypto.randomUUID();
export const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}
export function fail(status: number, message: string): never { throw new HttpError(status, message); }
export const stmt = (e: Env, s: string, ...p: any[]) => e.DB.prepare(s).bind(...p);
export const one = async (e: Env, s: string, ...p: any[]) => stmt(e, s, ...p).first();
export const all = async (e: Env, s: string, ...p: any[]) => ((await stmt(e, s, ...p).all()).results || []);
export const run = async (e: Env, s: string, ...p: any[]) => stmt(e, s, ...p).run();
export const batch = async (e: Env, ss: any[]) => { if (ss.length)
    return e.DB.batch(ss); };
export function guard(e: Env, condition: string, ...p: any[]) { const i = id(); return [stmt(e, `INSERT INTO transaction_guards(id,valid) SELECT ?,CASE WHEN (${condition}) THEN 1 ELSE 0 END`, i, ...p), stmt(e, 'DELETE FROM transaction_guards WHERE id=?', i)]; }
export const safeUser = (u: any) => ({ id: u.id, email: u.email, role: u.role, first_name: u.first_name, last_name: u.last_name, phone: u.phone, demo: u.demo });
export async function hashPassword(pass: string) { const salt = randomBytes(16).toString('hex'); const key = await new Promise<Buffer>((resolve, reject) => scrypt(pass, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key))); return `scrypt:32768:8:3:${salt}:${key.toString('hex')}`; }
export async function checkPassword(pass: string, encoded: string) { const [, n, r, p, salt, expected] = encoded.split(':'); if (!salt || n !== '32768' || r !== '8' || p !== '3')
    return false; const key = await new Promise<Buffer>((resolve, reject) => scrypt(pass, salt, 64, { N: +n, r: +r, p: +p, maxmem: 48 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key))); return same(key.toString('hex'), expected); }
export function same(a: string, b: string) { return timingSafeEqual(Buffer.from(sha(a)), Buffer.from(sha(b))); }
export function cookie(req: Request, token: string, seconds: number) { return `novelys_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`; }
export async function session(e: Env, req: Request, u: User) { const token = randomBytes(32).toString('hex'), seconds = u.role === 'ADMIN' ? 43200 : 604800; await run(e, 'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', sha(token), u.id, Date.now() + seconds * 1000); return cookie(req, token, seconds); }
export const sessionToken = (req: Request) => (req.headers.get('Cookie') || '').match(/(?:^|;\s*)novelys_session=([^;]+)/)?.[1] || '';
export async function currentUser(e: Env, req: Request) { const token = sessionToken(req); if (!token)
    return null; const u = await one(e, 'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?', sha(token), Date.now()); if (u?.demo && !demoAllowed(e, req))
    return null; return u ? safeUser(u) : null; }
export function admin(u: User) { if (u.role !== 'ADMIN')
    fail(403, 'Accès réservé à l’administrateur.'); }
export async function student(e: Env, u: User, sid: string) { const s = await one(e, 'SELECT * FROM students WHERE id=?', sid); if (!s || (u.role !== 'ADMIN' && s.parent_id !== u.id))
    fail(404, 'Élève introuvable.'); return s; }
export async function booking(e: Env, u: User, bid: string) { const b = await one(e, 'SELECT b.*,s.parent_id,s.first_name FROM bookings b JOIN students s ON s.id=b.student_id WHERE b.id=?', bid); if (!b || (u.role !== 'ADMIN' && b.parent_id !== u.id))
    fail(404, 'Séance introuvable.'); return b; }
export const defaults = { pendingHours: 24, cancellationHours: 24, allowDirectCancel: false, reminderHours: 24, retentionMonths: 24, durations: [60, 90, 120], teacherName: 'Novélys', contactEmail: '', legalName: '', legalAddress: '', demoRetired: false };
export async function settings(e: Env) { const out: any = { ...defaults }; for (const r of await all(e, 'SELECT * FROM settings')) {
    try {
        out[r.key] = JSON.parse(r.value);
    }
    catch {
        out[r.key] = r.value;
    }
} return out; }
export async function expire(e: Env) { await run(e, "UPDATE bookings SET status='DECLINED',updated_at=? WHERE status='PENDING' AND expires_at<=?", Date.now(), Date.now()); }
export function demoAllowed(e: Env, req: Request) { return e.DEMO_MODE === 'true' && (!!req.headers.get('oai-authenticated-user-id') || (e.LOCAL_DEMO === 'true' && ['localhost', '127.0.0.1', 'terminal.local'].includes(new URL(req.url).hostname))); }
export async function rate(e: Env, key: string, max: number) { const now = Date.now(); const r = await one(e, `INSERT INTO rate_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END RETURNING attempts`, key, now + 900000, now, now); if (r.attempts > max)
    fail(429, 'Trop de tentatives. Réessayez dans 15 minutes.'); }
export async function limitedBody(req: Request, limit = 128 * 1024) { if (Number(req.headers.get('content-length')) > limit)
    fail(413, 'Envoi trop volumineux.'); if (!req.body)
    return new Uint8Array(); const reader = req.body.getReader(); const parts: Uint8Array[] = []; let len = 0; while (true) {
    const { done, value } = await reader.read();
    if (done)
        break;
    len += value.length;
    if (len > limit) {
        await reader.cancel();
        fail(413, 'Envoi trop volumineux.');
    }
    parts.push(value);
} const bytes = new Uint8Array(len); let offset = 0; for (const p of parts) {
    bytes.set(p, offset);
    offset += p.length;
} return bytes; }
export async function body(req: Request) { try {
    return JSON.parse(new TextDecoder().decode(await limitedBody(req)));
}
catch (err) {
    if (err instanceof HttpError)
        throw err;
    fail(400, 'Formulaire invalide.');
} }
export const json = (data: any, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export const textField = z.string().trim().min(1).max(150);
export const subjectField = z.enum(['Mathématiques', 'Physique-chimie', 'Mathématiques + Physique-chimie']);
export const gradeField = z.enum(['Primaire', '6e', '5e', '4e', '3e', 'Seconde', 'Première', 'Terminale']);
export const durationField = z.number().int().min(30).max(240).refine(n => n % 30 === 0);
export const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v);
export const passwordField = z.string().min(12, 'Le mot de passe doit contenir au moins 12 caractères.').max(128);
export const profileSchema = z.object({ first_name: textField, last_name: textField, email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), phone: z.string().trim().min(6).max(30) });
export const studentSchema = z.object({ first_name: textField, grade: gradeField, subject: subjectField, weekly_sessions: z.string().max(80).default('1'), usual_duration: durationField.default(60), objectives: z.string().max(2000).default(''), difficulties: z.string().max(4000).default(''), parent_id: z.string().optional() });
export const examSchema = z.object({ student_id: z.string(), date: dateField, subject: subjectField, chapter: textField, concepts: z.string().max(2000).default(''), info: z.string().max(4000).default('') });
export function audit(e: Env, u: User, action: string, entity?: string) { return stmt(e, 'INSERT INTO audit_log(id,user_id,action,entity_id,created_at) VALUES(?,?,?,?,?)', id(), u.id, action, entity || null, Date.now()); }
export function notify(e: Env, userId: string, title: string, body: string, link = '/espace', dedupe?: string) { return stmt(e, 'INSERT OR IGNORE INTO notifications(id,user_id,title,body,link,created_at,dedupe_key) VALUES(?,?,?,?,?,?,?)', id(), userId, title, body, link, Date.now(), dedupe || null); }
export async function admins(e: Env, title: string, message: string, link = '/demandes') { return (await all(e, "SELECT id FROM users WHERE role='ADMIN'")).map((u: any) => notify(e, u.id, title, message, link)); }
export const activeSQL = "(status='CONFIRMED' OR (status='PENDING' AND expires_at>unixepoch()*1000))";
export async function free(e: Env, start: number, end: number, requireAvailability = true) { if (await one(e, `SELECT id FROM bookings WHERE ${activeSQL} AND starts_at<? AND ends_at>? LIMIT 1`, end, start))
    return false; if (await one(e, "SELECT id FROM availabilities WHERE kind='BLOCKED' AND starts_at<? AND ends_at>? LIMIT 1", end, start))
    return false; return !requireAvailability || !!(await one(e, "SELECT id FROM availabilities WHERE kind='AVAILABLE' AND starts_at<=? AND ends_at>=? LIMIT 1", start, end)); }
export async function opportunisticJobs(e: Env) { const n = Date.now(); const claimed = await one(e, "INSERT INTO settings(key,value) VALUES('lastJobsTick',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER)<? RETURNING key", String(n), n - 60000); if (claimed)
    await processJobs(e); }
export async function processJobs(e: Env) {
    await expire(e);
    const now = Date.now(), config = await settings(e);
    await batch(e, [stmt(e, 'DELETE FROM sessions WHERE expires_at<?', now), stmt(e, 'DELETE FROM auth_tokens WHERE expires_at<?', now), stmt(e, 'DELETE FROM rate_limits WHERE reset_at<?', now)]);
    for (const b of await all(e, "SELECT b.*,s.parent_id,s.first_name FROM bookings b JOIN students s ON s.id=b.student_id WHERE b.status='CONFIRMED' AND b.starts_at>? AND b.starts_at<=?", now, now + config.reminderHours * 3600000))
        await batch(e, [notify(e, b.parent_id, 'Rappel de votre cours', `${b.first_name} · ${b.subject} · ${dayLabel(b.starts_at, true)} à ${clock(b.starts_at)} · ${(b.ends_at - b.starts_at) / 60000} min`, `/espace?cours=${b.id}`, `reminder:${b.id}:${b.starts_at}`)]);
    for (const w of await all(e, "SELECT w.*,s.parent_id FROM waiting_list w JOIN students s ON s.id=w.student_id WHERE w.status='WAITING' AND w.starts_at>? LIMIT 100", now)) {
        if (await free(e, w.starts_at, w.ends_at))
            await batch(e, [notify(e, w.parent_id, 'Un créneau s’est libéré', `${dayLabel(w.starts_at, true)} à ${clock(w.starts_at)}. Vous pouvez envoyer une demande ; le créneau reste accessible aux autres familles.`, '/calendrier', `wait:${w.id}`), stmt(e, "UPDATE waiting_list SET status='NOTIFIED' WHERE id=? AND status='WAITING'", w.id)]);
    }
    await run(e, "INSERT INTO settings(key,value) VALUES('lastJobsRun',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", String(now));
    if (!e.RESEND_API_KEY || !e.EMAIL_FROM)
        return;
    for (const mail of await all(e, "SELECT * FROM email_outbox WHERE status='PENDING' AND available_at<=? AND attempts<5 ORDER BY created_at LIMIT 20", now)) {
        try {
            let content = mail.body;
            const n = mail.notification_id ? await one(e, 'SELECT link FROM notifications WHERE id=?', mail.notification_id) : null;
            const bid = n?.link?.match(/cours=([\w-]+)/)?.[1];
            if (bid) {
                const b = await one(e, 'SELECT * FROM bookings WHERE id=?', bid);
                if (b)
                    content += `\n${dayLabel(b.starts_at, true)} à ${clock(b.starts_at)} — ${(b.ends_at - b.starts_at) / 60000} minutes — ${b.subject}`;
            }
            const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${e.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': mail.id }, body: JSON.stringify({ from: e.EMAIL_FROM, to: [mail.recipient], subject: mail.subject, text: content + (e.APP_URL ? `\n\nVotre espace : ${e.APP_URL}` : '') }) });
            if (!response.ok)
                throw new Error('EMAIL_RETRY');
            await run(e, "UPDATE email_outbox SET status='SENT',attempts=attempts+1 WHERE id=?", mail.id);
        }
        catch {
            await run(e, "UPDATE email_outbox SET attempts=attempts+1,available_at=?,status=CASE WHEN attempts>=4 THEN 'FAILED' ELSE 'PENDING' END WHERE id=?", now + 300000, mail.id);
        }
    }
}
