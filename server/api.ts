import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { type Env, type User, HttpError, fail, id, sha, same, one, all, run, stmt, batch, guard, json, body, limitedBody, hashPassword, checkPassword, session, sessionToken, cookie, currentUser, safeUser, admin, student, booking, settings, expire, demoAllowed, rate, profileSchema, passwordField, studentSchema, examSchema, subjectField, durationField, dateField, textField, audit, notify, admins, free, processJobs, opportunisticJobs } from './core.ts';
import { seedDemo } from './seed.ts';
import { dateKey, addDays, parisTime, weekday, clock } from '../lib/time.ts';
const now = () => Date.now();
const bookingSchema = z.object({ student_id: z.string(), starts_at: z.number().int(), duration: durationField, subject: subjectField, work_on: z.string().max(2000).default(''), preparation: z.string().max(6000).default(''), location: z.string().max(120).default('À convenir'), exam: examSchema.omit({ student_id: true }).optional() });
function insertBooking(e: Env, b: any, u: User, status: string, expiry: number | null, series: string | null = null, bid = id()) { return stmt(e, 'INSERT INTO bookings(id,student_id,series_id,starts_at,ends_at,subject,status,expires_at,work_on,preparation,location,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', bid, b.student_id, series, b.starts_at, b.starts_at + b.duration * 60000, b.subject, status, expiry, b.work_on || '', b.preparation || '', b.location || 'À convenir', now(), now()); }
function insertExam(e: Env, b: any) { return stmt(e, 'INSERT INTO upcoming_exams(id,student_id,date,subject,chapter,concepts,info,created_at) VALUES(?,?,?,?,?,?,?,?)', id(), b.student_id, b.date, b.subject, b.chapter, b.concepts || '', b.info || '', now()); }
function future(t: number) { if (t < now())
    fail(400, 'Choisissez une date future.'); if (t > now() + 366 * 86400000)
    fail(400, 'La réservation est limitée aux 12 prochains mois.'); }
async function ownedRequest(e: Env, u: User, rid: string) { const r = await one(e, 'SELECT r.*,s.parent_id,s.first_name FROM requests r JOIN students s ON s.id=r.student_id WHERE r.id=?', rid); if (!r || (u.role !== 'ADMIN' && r.parent_id !== u.id))
    fail(404, 'Demande introuvable.'); return r; }
async function dashboard(e: Env, u: User) {
    const isAdmin = u.role === 'ADMIN', where = isAdmin ? '' : ' WHERE s.parent_id=?', p = isAdmin ? [] : [u.id];
    const ss = await all(e, `SELECT s.*,u.first_name parent_first_name,u.last_name parent_last_name,u.email parent_email,u.phone parent_phone FROM students s JOIN users u ON u.id=s.parent_id${where} ORDER BY s.first_name`, ...p);
    const names = (table: string) => all(e, `SELECT t.*,s.first_name student_name,s.grade,s.parent_id FROM ${table} t JOIN students s ON s.id=t.student_id${where} ORDER BY t.created_at DESC`, ...p);
    const [bs, exams, docs, requests, wait, reports, notes, notifs, reviews, parents, availability, privacy, cfg, emails] = await Promise.all([names('bookings'), names('upcoming_exams'), names('documents'), names('requests'), names('waiting_list'), names('lesson_reports'), isAdmin ? names('private_teacher_notes') : [], all(e, 'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100', u.id), isAdmin ? all(e, 'SELECT r.*,u.first_name parent_name,u.demo FROM reviews r JOIN users u ON u.id=r.parent_id ORDER BY created_at DESC') : all(e, 'SELECT * FROM reviews WHERE parent_id=?', u.id), isAdmin ? all(e, "SELECT id,email,first_name,last_name,phone,demo,last_active_at FROM users WHERE role='PARENT' ORDER BY first_name") : [], isAdmin ? all(e, 'SELECT * FROM availabilities WHERE ends_at>? ORDER BY starts_at', now() - 86400000) : [], isAdmin ? all(e, "SELECT p.*,u.first_name,u.last_name,u.email FROM privacy_requests p JOIN users u ON u.id=p.user_id WHERE p.status='PENDING'") : [], settings(e), isAdmin ? all(e, 'SELECT status,count(*) count FROM email_outbox GROUP BY status') : []]);
    const publicCfg = { pendingHours: cfg.pendingHours, cancellationHours: cfg.cancellationHours, allowDirectCancel: cfg.allowDirectCancel, durations: cfg.durations, contactEmail: cfg.contactEmail, teacherName: cfg.teacherName };
    return { user: u, students: ss, bookings: bs, exams: exams.sort((a: any, b: any) => a.date.localeCompare(b.date)), documents: docs.map(({ object_key, ...d }: any) => d), requests, waiting: wait, reports, notes, notifications: notifs, reviews, parents, availabilities: availability, privacy, settings: isAdmin ? cfg : publicCfg, emailStatus: emails, emailConfigured: isAdmin ? !!(e.RESEND_API_KEY && e.EMAIL_FROM) : undefined };
}
export async function api(req: Request, e: Env, ctx?: {
    waitUntil(p: Promise<any>): void;
}): Promise<Response> {
    try {
        const url = new URL(req.url), path = url.pathname.replace(/\/$/, ''), method = req.method;
        if (!e.DB || !e.BUCKET)
            fail(503, 'Le stockage est momentanément indisponible.');
        if (path === '/api/jobs') {
            if (method !== 'POST')
                fail(405, 'Méthode non autorisée.');
            if (!e.CRON_SECRET || !same(req.headers.get('Authorization') || '', `Bearer ${e.CRON_SECRET}`))
                fail(401, 'Accès refusé.');
            await processJobs(e);
            return json({ ok: true });
        }
        if (!['GET', 'HEAD'].includes(method)) {
            if (req.headers.get('Origin') !== url.origin)
                fail(403, 'Origine du formulaire non autorisée.');
        }
        if (demoAllowed(e, req))
            await seedDemo(e);
        await expire(e);
        if (path === '/api/public' && method === 'GET') {
            const cfg = await settings(e);
            return json({ demo: demoAllowed(e, req) && !cfg.demoRetired, bootstrap: !await one(e, "SELECT id FROM users WHERE role='ADMIN' LIMIT 1"), teacherName: cfg.teacherName, contactEmail: cfg.contactEmail, legalName: cfg.legalName, legalAddress: cfg.legalAddress, retentionMonths: cfg.retentionMonths, durations: cfg.durations, reviews: await all(e, "SELECT r.id,r.rating,r.comment,r.display_name,u.demo FROM reviews r JOIN users u ON u.id=r.parent_id WHERE r.status='PUBLISHED' ORDER BY r.created_at DESC") });
        }
        if (path === '/api/calendar' && method === 'GET') {
            const start = Number(url.searchParams.get('start')), end = Number(url.searchParams.get('end')), duration = durationField.parse(Number(url.searchParams.get('duration') || 60));
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 45 * 86400000)
                fail(400, 'Période invalide.');
            const av = await all(e, 'SELECT starts_at,ends_at,kind FROM availabilities WHERE starts_at<? AND ends_at>?', end, start), bs = await all(e, "SELECT starts_at,ends_at,status FROM bookings WHERE starts_at<? AND ends_at>? AND (status='CONFIRMED' OR status='PENDING')", end, start), slots = new Map();
            for (const a of av.filter((a: any) => a.kind === 'AVAILABLE')) {
                for (let t = Math.max(a.starts_at, start); t + duration * 60000 <= Math.min(a.ends_at, end); t += 1800000) {
                    if (t < now())
                        continue;
                    const until = t + duration * 60000;
                    const b = bs.find((b: any) => b.starts_at < until && b.ends_at > t);
                    const blocked = av.some((a: any) => a.kind === 'BLOCKED' && a.starts_at < until && a.ends_at > t);
                    slots.set(t, { starts_at: t, ends_at: until, status: blocked ? 'UNAVAILABLE' : b ? b.status : 'AVAILABLE' });
                }
            }
            return json({ slots: [...slots.values()].sort((a: any, b: any) => a.starts_at - b.starts_at), revision: (await settings(e)).calendarRevision });
        }
        if (path === '/api/events' && method === 'GET') {
            let timer: any, closed = false;
            const stream = new ReadableStream({ start(controller) { let previous = '', ticks = 0; const poll = async () => { try {
                    const revision = String((await settings(e)).calendarRevision || '0');
                    if (revision !== previous) {
                        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ revision })}\n\n`));
                        previous = revision;
                    }
                    if (++ticks >= 12) {
                        closed = true;
                        clearInterval(timer);
                        controller.close();
                    }
                }
                catch {
                    if (!closed) {
                        closed = true;
                        clearInterval(timer);
                        controller.close();
                    }
                } }; controller.enqueue(new TextEncoder().encode('retry: 2000\n\n')); timer = setInterval(poll, 2000); void poll(); }, cancel() { closed = true; clearInterval(timer); } });
            return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' } });
        }
        if (path.startsWith('/api/auth/') && method === 'POST') {
            const action = path.split('/').pop(), b = await body(req);
            const ip = req.headers.get('CF-Connecting-IP') || 'local';
            await rate(e, 'auth-ip:' + ip, 60);
            if (action === 'logout') {
                await run(e, 'DELETE FROM sessions WHERE token_hash=?', sha(sessionToken(req)));
                return json({ ok: true }, 200, { 'Set-Cookie': cookie(req, '', 0) });
            }
            if (action === 'demo') {
                if (!demoAllowed(e, req) || (await settings(e)).demoRetired)
                    fail(403, 'Démonstration désactivée.');
                const role = z.enum(['admin', 'parent', 'family2']).parse(b.role);
                const u = await one(e, 'SELECT * FROM users WHERE id=?', 'demo-' + role);
                if (!u)
                    fail(503, 'Démonstration indisponible.');
                return json({ user: safeUser(u) }, 200, { 'Set-Cookie': await session(e, req, u) });
            }
            if (action === 'register' || action === 'bootstrap') {
                const data = profileSchema.extend({ password: passwordField, consent: z.literal(true), secret: z.string().optional() }).parse(b);
                await rate(e, 'register:' + ip, 8);
                if (action === 'bootstrap' && (!e.BOOTSTRAP_SECRET || !same(data.secret || '', e.BOOTSTRAP_SECRET)))
                    fail(403, 'Code d’initialisation incorrect.');
                const uid = id(), hash = await hashPassword(data.password), ss = [];
                if (action === 'bootstrap')
                    ss.push(...guard(e, "NOT EXISTS(SELECT 1 FROM users WHERE role='ADMIN')"));
                ss.push(stmt(e, 'INSERT INTO users(id,email,password_hash,role,first_name,last_name,phone,created_at,last_active_at) VALUES(?,?,?,?,?,?,?,?,?)', uid, data.email, hash, action === 'bootstrap' ? 'ADMIN' : 'PARENT', data.first_name, data.last_name, data.phone, now(), now()));
                await batch(e, ss);
                const u = await one(e, 'SELECT * FROM users WHERE id=?', uid);
                return json({ user: safeUser(u) }, 201, { 'Set-Cookie': await session(e, req, u) });
            }
            if (action === 'login') {
                const b2 = z.object({ email: z.string().email().transform(s => s.toLowerCase().trim()), password: z.string().max(128) }).parse(b);
                await rate(e, 'login:' + b2.email, 10);
                const u = await one(e, 'SELECT * FROM users WHERE email=?', b2.email);
                const valid = await checkPassword(b2.password, u?.password_hash || 'scrypt:32768:8:3:00000000000000000000000000000000:00');
                if (!u || !valid || (u.demo && !demoAllowed(e, req)))
                    fail(401, 'Adresse e-mail ou mot de passe incorrect.');
                await run(e, 'UPDATE users SET last_active_at=? WHERE id=?', now(), u.id);
                return json({ user: safeUser(u) }, 200, { 'Set-Cookie': await session(e, req, u) });
            }
            if (action === 'forgot') {
                const email = z.string().email().transform(s => s.toLowerCase().trim()).parse(b.email);
                await rate(e, 'reset:' + email, 3);
                const u = await one(e, 'SELECT * FROM users WHERE email=? AND demo=0', email);
                if (u && e.APP_URL && e.RESEND_API_KEY && e.EMAIL_FROM) {
                    const token = randomBytes(32).toString('hex');
                    await batch(e, [stmt(e, 'DELETE FROM auth_tokens WHERE user_id=?', u.id), stmt(e, 'INSERT INTO auth_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)', sha(token), u.id, now() + 1800000), stmt(e, 'INSERT INTO email_outbox(id,user_id,recipient,subject,body,available_at,created_at) VALUES(?,?,?,?,?,?,?)', id(), u.id, email, 'Réinitialiser votre mot de passe Novélys', `Ouvrez ce lien dans les 30 minutes : ${e.APP_URL}/connexion?reset=${token}`, now(), now())]);
                    ctx?.waitUntil(processJobs(e));
                }
                return json({ message: 'Si un compte correspond à cette adresse, un lien vous sera envoyé lorsque le service e-mail est activé.' });
            }
            if (action === 'reset') {
                const { token, password } = z.object({ token: z.string().min(30), password: passwordField }).parse(b);
                const t = await one(e, 'SELECT * FROM auth_tokens WHERE token_hash=? AND expires_at>?', sha(token), now());
                if (!t)
                    fail(400, 'Lien expiré ou déjà utilisé.');
                const hash = await hashPassword(password);
                await batch(e, [...guard(e, 'EXISTS(SELECT 1 FROM auth_tokens WHERE token_hash=? AND expires_at>?)', sha(token), now()), stmt(e, 'UPDATE users SET password_hash=? WHERE id=?', hash, t.user_id), stmt(e, 'DELETE FROM auth_tokens WHERE user_id=?', t.user_id), stmt(e, 'DELETE FROM sessions WHERE user_id=?', t.user_id)]);
                return json({ ok: true });
            }
            fail(404, 'Action inconnue.');
        }
        const u = await currentUser(e, req);
        if (path === '/api/me' && method === 'GET')
            return json({ user: u });
        if (!u)
            fail(401, 'Connectez-vous pour continuer.');
        if (!['GET', 'HEAD'].includes(method))
            await rate(e, 'write:' + u.id, 250);
        if (path === '/api/dashboard' && method === 'GET') {
            ctx?.waitUntil(opportunisticJobs(e));
            return json(await dashboard(e, u));
        }
        if (path === '/api/profile' && method === 'PATCH') {
            const b = profileSchema.parse(await body(req));
            await run(e, 'UPDATE users SET first_name=?,last_name=?,email=?,phone=? WHERE id=?', b.first_name, b.last_name, b.email, b.phone, u.id);
            return json({ ok: true });
        }
        if (path === '/api/password' && method === 'POST') {
            const b = z.object({ current: z.string(), password: passwordField }).parse(await body(req));
            const account = await one(e, 'SELECT password_hash FROM users WHERE id=?', u.id);
            if (!await checkPassword(b.current, account.password_hash))
                fail(400, 'Le mot de passe actuel est incorrect.');
            await batch(e, [stmt(e, 'UPDATE users SET password_hash=? WHERE id=?', await hashPassword(b.password), u.id), stmt(e, 'DELETE FROM sessions WHERE user_id=?', u.id)]);
            return json({ ok: true }, 200, { 'Set-Cookie': await session(e, req, u) });
        }
        if (path === '/api/parents' && method === 'POST') {
            admin(u);
            const b = profileSchema.extend({ password: passwordField, role: z.enum(['PARENT', 'ADMIN']).default('PARENT') }).parse(await body(req));
            await run(e, 'INSERT INTO users(id,email,password_hash,role,first_name,last_name,phone,created_at,last_active_at) VALUES(?,?,?,?,?,?,?,?,?)', id(), b.email, await hashPassword(b.password), b.role, b.first_name, b.last_name, b.phone, now(), now());
            return json({ ok: true }, 201);
        }
        if (path === '/api/students' && method === 'POST') {
            const b = studentSchema.parse(await body(req)), pid = u.role === 'ADMIN' ? b.parent_id : u.id;
            if (!pid || !await one(e, "SELECT id FROM users WHERE id=? AND role='PARENT'", pid))
                fail(400, 'Choisissez un compte parent.');
            const sid = id();
            await batch(e, [stmt(e, 'INSERT INTO students(id,parent_id,first_name,grade,subject,weekly_sessions,usual_duration,objectives,difficulties,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', sid, pid, b.first_name, b.grade, b.subject, b.weekly_sessions, b.usual_duration, b.objectives, b.difficulties, now()), audit(e, u, 'student.create', sid)]);
            return json({ id: sid }, 201);
        }
        const studentMatch = path.match(/^\/api\/students\/([^/]+)$/);
        if (studentMatch && method === 'PATCH') {
            await student(e, u, studentMatch[1]);
            const b = studentSchema.parse(await body(req));
            await run(e, 'UPDATE students SET first_name=?,grade=?,subject=?,weekly_sessions=?,usual_duration=?,objectives=?,difficulties=? WHERE id=?', b.first_name, b.grade, b.subject, b.weekly_sessions, b.usual_duration, b.objectives, b.difficulties, studentMatch[1]);
            return json({ ok: true });
        }
        if (path === '/api/availabilities' && method === 'POST') {
            admin(u);
            const b = z.object({ date: dateField, end_date: dateField.optional(), days: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]), start: z.string().regex(/^\d\d:\d\d$/), end: z.string().regex(/^\d\d:\d\d$/), kind: z.enum(['AVAILABLE', 'BLOCKED']), label: z.string().max(200).default('') }).parse(await body(req));
            const end = b.end_date || b.date;
            if (end < b.date || Date.parse(end) - Date.parse(b.date) > 180 * 86400000)
                fail(400, 'Choisissez une période de 6 mois maximum.');
            const ss = [];
            for (let d = b.date; d <= end; d = addDays(d, 1)) {
                if (!b.days.includes(weekday(d)))
                    continue;
                const s = parisTime(d, b.start), t = parisTime(d, b.end);
                if (t <= s)
                    fail(400, 'L’heure de fin doit suivre l’heure de début.');
                ss.push(stmt(e, 'INSERT INTO availabilities(id,starts_at,ends_at,kind,label) VALUES(?,?,?,?,?)', id(), s, t, b.kind, b.label));
            }
            if (!ss.length)
                fail(400, 'Aucun jour sélectionné dans cette période.');
            await batch(e, [...ss, audit(e, u, 'availability.create')]);
            return json({ count: ss.length }, 201);
        }
        const avMatch = path.match(/^\/api\/availabilities\/([^/]+)$/);
        if (avMatch && method === 'DELETE') {
            admin(u);
            await run(e, 'DELETE FROM availabilities WHERE id=?', avMatch[1]);
            return json({ ok: true });
        }
        if (path === '/api/bookings' && method === 'POST') {
            const b = bookingSchema.parse(await body(req));
            await student(e, u, b.student_id);
            future(b.starts_at);
            const cfg = await settings(e);
            if (u.role !== 'ADMIN' && !cfg.durations.includes(b.duration))
                fail(400, 'Durée indisponible. Vous pouvez demander un créneau personnalisé.');
            const bid = id(), ss = [insertBooking(e, b, u, u.role === 'ADMIN' ? 'CONFIRMED' : 'PENDING', u.role === 'ADMIN' ? null : now() + cfg.pendingHours * 3600000, null, bid)];
            if (b.exam)
                ss.push(insertExam(e, { ...b.exam, student_id: b.student_id }), ...await admins(e, 'Nouvelle évaluation', b.exam.chapter, '/evaluations'));
            ss.push(audit(e, u, 'booking.create', bid));
            await batch(e, ss);
            ctx?.waitUntil(processJobs(e));
            return json({ id: bid, status: u.role === 'ADMIN' ? 'CONFIRMED' : 'PENDING' }, 201);
        }
        const bm = path.match(/^\/api\/bookings\/([^/]+)(?:\/(confirm|decline|cancel|complete|move|alternative))?$/);
        if (bm && method === 'POST') {
            const b = await booking(e, u, bm[1]), action = bm[2], data = await body(req);
            if (action === 'confirm' || action === 'decline' || action === 'complete') {
                admin(u);
                if (action === 'complete' && (b.status !== 'CONFIRMED' || b.starts_at > now()))
                    fail(400, 'Seule une séance confirmée ayant commencé peut être terminée.');
                if (action !== 'complete' && b.status !== 'PENDING')
                    fail(409, 'Cette demande a déjà été traitée.');
                const status = action === 'confirm' ? 'CONFIRMED' : action === 'decline' ? 'DECLINED' : 'COMPLETED';
                await batch(e, [...guard(e, 'EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?)', b.id, b.status), stmt(e, 'UPDATE bookings SET status=?,updated_at=? WHERE id=?', status, now(), b.id), audit(e, u, 'booking.' + action, b.id)]);
            }
            else if (action === 'cancel') {
                if (!['PENDING', 'CONFIRMED'].includes(b.status))
                    fail(409, 'Cette séance ne peut plus être annulée.');
                const cfg = await settings(e);
                if (u.role === 'ADMIN' || (cfg.allowDirectCancel && b.starts_at - now() >= cfg.cancellationHours * 3600000)) {
                    const ids = u.role === 'ADMIN' && data.scope === 'future' && b.series_id ? await all(e, "SELECT id FROM bookings WHERE series_id=? AND starts_at>=? AND status IN ('PENDING','CONFIRMED')", b.series_id, b.starts_at) : [{ id: b.id }];
                    await batch(e, ids.map((x: any) => stmt(e, "UPDATE bookings SET status='CANCELLED',updated_at=? WHERE id=?", now(), x.id)));
                }
                else {
                    await batch(e, [stmt(e, "INSERT INTO requests(id,student_id,booking_id,type,reason,created_at) VALUES(?,?,?,'CANCEL',?,?)", id(), b.student_id, b.id, z.string().max(3000).parse(data.reason || ''), now()), ...await admins(e, 'Demande d’annulation', b.first_name)]);
                }
            }
            else if (action === 'move') {
                const m = z.object({ starts_at: z.number().int(), duration: durationField, scope: z.enum(['one', 'future']).default('one'), reason: z.string().max(3000).default('') }).parse(data);
                future(m.starts_at);
                if (!['PENDING', 'CONFIRMED'].includes(b.status))
                    fail(409, 'Cette séance ne peut plus être déplacée.');
                if (u.role !== 'ADMIN') {
                    await batch(e, [stmt(e, "INSERT INTO requests(id,student_id,booking_id,type,proposals,subject,duration,reason,created_at) VALUES(?,?,?,'MOVE',?,?,?,?,?)", id(), b.student_id, b.id, JSON.stringify([{ starts_at: m.starts_at, duration: m.duration }]), b.subject, m.duration, m.reason, now()), ...await admins(e, 'Demande de déplacement', b.first_name)]);
                }
                else {
                    const series = m.scope === 'future' && b.series_id ? await all(e, "SELECT * FROM bookings WHERE series_id=? AND starts_at>=? AND status IN ('CONFIRMED','PENDING') ORDER BY starts_at", b.series_id, b.starts_at) : [b];
                    const days = Math.round((Date.parse(dateKey(m.starts_at)) - Date.parse(dateKey(b.starts_at))) / 86400000);
                    const updates = series.map((x: any) => ({ ...x, target: parisTime(addDays(dateKey(x.starts_at), days), clock(m.starts_at)) }));
                    if (m.starts_at > b.starts_at)
                        updates.reverse();
                    await batch(e, updates.map((x: any) => stmt(e, 'UPDATE bookings SET starts_at=?,ends_at=?,updated_at=? WHERE id=?', x.target, x.target + m.duration * 60000, now(), x.id)));
                }
            }
            else if (action === 'alternative') {
                admin(u);
                if (b.status !== 'PENDING')
                    fail(409, 'Seules les demandes en attente peuvent recevoir une proposition.');
                const m = z.object({ starts_at: z.number().int(), duration: durationField, response: z.string().max(3000).default('') }).parse(data);
                future(m.starts_at);
                await batch(e, [stmt(e, "INSERT INTO requests(id,student_id,booking_id,type,status,proposals,subject,duration,response,created_at) VALUES(?,?,?,'MOVE','PROPOSED',?,?,?,?,?)", id(), b.student_id, b.id, JSON.stringify([{ starts_at: m.starts_at, duration: m.duration }]), b.subject, m.duration, m.response, now()), notify(e, b.parent_id, 'Un autre horaire vous est proposé', 'Consultez la proposition dans votre espace.', '/demandes')]);
            }
            else
                fail(404, 'Action inconnue.');
            ctx?.waitUntil(processJobs(e));
            return json({ ok: true });
        }
        if (path === '/api/recurring' && method === 'POST') {
            admin(u);
            const b = z.object({ student_id: z.string(), start_date: dateField, end_date: dateField, subject: subjectField, duration: durationField, patterns: z.array(z.object({ day: z.number().int().min(0).max(6), time: z.string().regex(/^\d\d:\d\d$/) })).min(1).max(3) }).parse(await body(req));
            await student(e, u, b.student_id);
            if (b.end_date < b.start_date || Date.parse(b.end_date) - Date.parse(b.start_date) > 180 * 86400000)
                fail(400, 'Une série est limitée à 6 mois.');
            const sid = id(), ss = [stmt(e, 'INSERT INTO recurring_bookings(id,student_id,starts_on,ends_on,pattern,created_at) VALUES(?,?,?,?,?,?)', sid, b.student_id, b.start_date, b.end_date, JSON.stringify(b.patterns), now())];
            let count = 0;
            for (let d = b.start_date; d <= b.end_date; d = addDays(d, 1))
                for (const p of b.patterns.filter(p => p.day === weekday(d))) {
                    const s = parisTime(d, p.time);
                    future(s);
                    count++;
                    ss.push(insertBooking(e, { ...b, starts_at: s }, u, 'CONFIRMED', null, sid));
                }
            if (!count || count > 78)
                fail(400, 'Choisissez une série de 1 à 78 séances.');
            await batch(e, [...ss, audit(e, u, 'series.create', sid)]);
            ctx?.waitUntil(processJobs(e));
            return json({ id: sid, count }, 201);
        }
        if (path === '/api/requests' && method === 'POST') {
            const b = z.object({ student_id: z.string(), subject: subjectField, duration: durationField, proposals: z.array(z.object({ starts_at: z.number().int(), duration: durationField })).min(1).max(3), reason: z.string().max(4000).default('') }).parse(await body(req));
            const s = await student(e, u, b.student_id);
            b.proposals.forEach(p => future(p.starts_at));
            const rid = id();
            await batch(e, [stmt(e, "INSERT INTO requests(id,student_id,type,proposals,subject,duration,reason,created_at) VALUES(?,?,'CUSTOM',?,?,?,?,?)", rid, s.id, JSON.stringify(b.proposals), b.subject, b.duration, b.reason, now()), ...await admins(e, 'Demande de créneau personnalisé', s.first_name)]);
            ctx?.waitUntil(processJobs(e));
            return json({ id: rid }, 201);
        }
        const rm = path.match(/^\/api\/requests\/([^/]+)\/(accept|decline|propose)$/);
        if (rm && method === 'POST') {
            const r = await ownedRequest(e, u, rm[1]), action = rm[2], d = await body(req);
            if (!['PENDING', 'PROPOSED'].includes(r.status))
                fail(409, 'Cette demande a déjà été traitée.');
            if (u.role !== 'ADMIN' && (r.status !== 'PROPOSED' || action === 'propose'))
                fail(403, 'Cette action est réservée à votre professeur.');
            const ss: any[] = [...guard(e, 'EXISTS(SELECT 1 FROM requests WHERE id=? AND status=? AND proposals=?)', r.id, r.status, r.proposals)];
            const options = JSON.parse(r.proposals);
            if (action === 'propose') {
                const p = z.object({ starts_at: z.number().int(), duration: durationField, response: z.string().max(3000).default('') }).parse(d);
                future(p.starts_at);
                ss.push(stmt(e, "UPDATE requests SET status='PROPOSED',proposals=?,duration=?,response=? WHERE id=?", JSON.stringify([{ starts_at: p.starts_at, duration: p.duration }]), p.duration, p.response, r.id), notify(e, r.parent_id, 'Un autre horaire vous est proposé', p.response || 'Consultez la proposition dans votre espace.', '/demandes'));
            }
            else if (action === 'decline') {
                ss.push(stmt(e, "UPDATE requests SET status='DECLINED',response=? WHERE id=?", z.string().max(3000).parse(d.response || ''), r.id), notify(e, r.parent_id, 'Demande clôturée', d.response || 'La demande n’a pas été retenue.', '/demandes'));
            }
            else {
                if (r.type === 'CANCEL') {
                    const b = await booking(e, u, r.booking_id);
                    if (!['PENDING', 'CONFIRMED'].includes(b.status))
                        fail(409, 'Cette séance a déjà été traitée.');
                    ss.push(stmt(e, "UPDATE bookings SET status='CANCELLED',updated_at=? WHERE id=?", now(), b.id));
                }
                else {
                    const p = u.role === 'ADMIN' ? { starts_at: d.starts_at ?? options[0]?.starts_at, duration: d.duration ?? options[0]?.duration } : options[0];
                    const v = z.object({ starts_at: z.number().int(), duration: durationField }).parse(p);
                    future(v.starts_at);
                    if (r.type === 'MOVE') {
                        const b = await booking(e, u, r.booking_id);
                        if (!['PENDING', 'CONFIRMED'].includes(b.status))
                            fail(409, 'La séance d’origine n’est plus active.');
                        ss.push(stmt(e, "UPDATE bookings SET starts_at=?,ends_at=?,status='CONFIRMED',updated_at=? WHERE id=?", v.starts_at, v.starts_at + v.duration * 60000, now(), b.id));
                    }
                    else
                        ss.push(insertBooking(e, { ...v, student_id: r.student_id, subject: r.subject, preparation: r.reason }, u, 'CONFIRMED', null));
                }
                ss.push(stmt(e, "UPDATE requests SET status='ACCEPTED',response=? WHERE id=?", z.string().max(3000).parse(d.response || ''), r.id), notify(e, r.parent_id, 'Demande acceptée', 'Votre calendrier a été mis à jour.', '/espace'));
                if (u.role !== 'ADMIN')
                    ss.push(...await admins(e, 'Proposition acceptée', r.first_name, '/calendrier'));
            }
            ss.push(audit(e, u, 'request.' + action, r.id));
            await batch(e, ss);
            ctx?.waitUntil(processJobs(e));
            return json({ ok: true });
        }
        if (path === '/api/waiting' && method === 'POST') {
            const b = z.object({ student_id: z.string(), starts_at: z.number().int(), duration: durationField }).parse(await body(req));
            await student(e, u, b.student_id);
            future(b.starts_at);
            if (await free(e, b.starts_at, b.starts_at + b.duration * 60000))
                fail(400, 'Ce créneau est disponible : vous pouvez le réserver.');
            await run(e, 'INSERT INTO waiting_list(id,student_id,starts_at,ends_at,created_at) VALUES(?,?,?,?,?)', id(), b.student_id, b.starts_at, b.starts_at + b.duration * 60000, now());
            return json({ ok: true }, 201);
        }
        const wm = path.match(/^\/api\/waiting\/([^/]+)(?:\/(offer))?$/);
        if (wm) {
            const w = await one(e, 'SELECT w.*,s.parent_id FROM waiting_list w JOIN students s ON s.id=w.student_id WHERE w.id=?', wm[1]);
            if (!w || (u.role !== 'ADMIN' && w.parent_id !== u.id))
                fail(404, 'Inscription introuvable.');
            if (method === 'DELETE') {
                await run(e, 'DELETE FROM waiting_list WHERE id=?', w.id);
                return json({ ok: true });
            }
            if (method === 'POST' && wm[2] === 'offer') {
                admin(u);
                future(w.starts_at);
                if (!await free(e, w.starts_at, w.ends_at))
                    fail(409, 'Le créneau n’est pas encore disponible.');
                const s = await student(e, u, w.student_id);
                await batch(e, [...guard(e, "EXISTS(SELECT 1 FROM waiting_list WHERE id=? AND status!='OFFERED')", w.id), stmt(e, "INSERT INTO requests(id,student_id,type,status,proposals,subject,duration,response,created_at) VALUES(?,?,'CUSTOM','PROPOSED',?,?,?,?,?)", id(), s.id, JSON.stringify([{ starts_at: w.starts_at, duration: (w.ends_at - w.starts_at) / 60000 }]), s.subject, (w.ends_at - w.starts_at) / 60000, 'Un créneau de votre liste d’attente est disponible.', now()), stmt(e, "UPDATE waiting_list SET status='OFFERED' WHERE id=?", w.id), notify(e, w.parent_id, 'Un créneau vous est proposé', 'Acceptez la proposition dans votre espace.', '/demandes')]);
                return json({ ok: true });
            }
        }
        if (path === '/api/exams' && method === 'POST') {
            const b = examSchema.parse(await body(req));
            const s = await student(e, u, b.student_id);
            await batch(e, [insertExam(e, b), ...await admins(e, 'Nouvelle évaluation', `${s.first_name} · ${b.chapter}`, '/evaluations')]);
            ctx?.waitUntil(processJobs(e));
            return json({ ok: true }, 201);
        }
        const em = path.match(/^\/api\/exams\/([^/]+)$/);
        if (em && method === 'DELETE') {
            const ex = await one(e, 'SELECT * FROM upcoming_exams WHERE id=?', em[1]);
            if (!ex)
                fail(404, 'Évaluation introuvable.');
            await student(e, u, ex.student_id);
            await run(e, 'DELETE FROM upcoming_exams WHERE id=?', ex.id);
            return json({ ok: true });
        }
        if (path === '/api/notes' && method === 'POST') {
            admin(u);
            const b = z.object({ student_id: z.string(), content: z.string().trim().min(1).max(10000) }).parse(await body(req));
            await student(e, u, b.student_id);
            await run(e, 'INSERT INTO private_teacher_notes(id,student_id,content,created_at) VALUES(?,?,?,?)', id(), b.student_id, b.content, now());
            return json({ ok: true }, 201);
        }
        if (path === '/api/reports' && method === 'POST') {
            admin(u);
            const b = z.object({ booking_id: z.string(), concepts: z.string().min(1).max(6000), difficulties: z.string().max(6000).default(''), progress: z.string().max(6000).default(''), homework: z.string().max(6000).default('') }).parse(await body(req));
            const lesson = await booking(e, u, b.booking_id);
            if (!['CONFIRMED', 'COMPLETED'].includes(lesson.status) || lesson.starts_at > now())
                fail(400, 'Le compte rendu est disponible après le début du cours.');
            await batch(e, [stmt(e, 'INSERT INTO lesson_reports(id,booking_id,student_id,concepts,difficulties,progress,homework,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET concepts=excluded.concepts,difficulties=excluded.difficulties,progress=excluded.progress,homework=excluded.homework', id(), lesson.id, lesson.student_id, b.concepts, b.difficulties, b.progress, b.homework, now()), ...(lesson.status === 'CONFIRMED' ? [stmt(e, "UPDATE bookings SET status='COMPLETED',updated_at=? WHERE id=?", now(), lesson.id)] : []), notify(e, lesson.parent_id, 'Le bilan de la séance est disponible', lesson.first_name, '/eleves')]);
            return json({ ok: true }, 201);
        }
        if (path === '/api/documents' && method === 'POST') {
            const bytes = await limitedBody(req, 11 * 1024 * 1024);
            const form = await new Request(req.url, { method: 'POST', headers: { 'Content-Type': req.headers.get('Content-Type') || '' }, body: bytes }).formData();
            const sid = String(form.get('student_id') || ''), s = await student(e, u, sid), file = form.get('file'), bid = String(form.get('booking_id') || '');
            if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024)
                fail(400, 'Choisissez un PDF ou une image de moins de 10 Mo.');
            if (bid && (await booking(e, u, bid)).student_id !== sid)
                fail(400, 'La séance doit appartenir à cet élève.');
            const data = new Uint8Array(await file.arrayBuffer()), prefix = Array.from(data.slice(0, 12));
            let mime = '';
            if (new TextDecoder().decode(data.slice(0, 5)) === '%PDF-')
                mime = 'application/pdf';
            else if (prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255)
                mime = 'image/jpeg';
            else if (prefix.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10')
                mime = 'image/png';
            else if (new TextDecoder().decode(data.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(data.slice(8, 12)) === 'WEBP')
                mime = 'image/webp';
            if (!mime)
                fail(400, 'Format refusé. Seuls les vrais fichiers PDF, JPEG, PNG et WebP sont acceptés.');
            const usage = await one(e, 'SELECT COALESCE(sum(size),0) total FROM documents WHERE student_id=?', sid);
            if (usage.total + file.size > 200 * 1024 * 1024)
                fail(400, 'La limite de 200 Mo par élève est atteinte.');
            const did = id(), key = `private/${sid}/${did}`, name = file.name.replace(/[\r\n\x00-\x1f]/g, '').slice(0, 180) || 'document';
            await e.BUCKET.put(key, data, { httpMetadata: { contentType: mime } });
            try {
                await batch(e, [...guard(e, '(SELECT COALESCE(sum(size),0) FROM documents WHERE student_id=?)+?<=?', sid, file.size, 200 * 1024 * 1024), stmt(e, 'INSERT INTO documents(id,student_id,booking_id,object_key,name,mime,size,created_at) VALUES(?,?,?,?,?,?,?,?)', did, sid, bid || null, key, name, mime, file.size, now()), ...await admins(e, 'Nouveau document', `${s.first_name} · ${name}`, '/documents')]);
            }
            catch (err) {
                await e.BUCKET.delete(key);
                throw err;
            }
            ctx?.waitUntil(processJobs(e));
            return json({ id: did }, 201);
        }
        const dm = path.match(/^\/api\/documents\/([^/]+)$/);
        if (dm) {
            const d = await one(e, 'SELECT * FROM documents WHERE id=?', dm[1]);
            if (!d)
                fail(404, 'Document introuvable.');
            await student(e, u, d.student_id);
            if (method === 'GET') {
                const object = await e.BUCKET.get(d.object_key);
                if (!object)
                    fail(404, 'Document introuvable.');
                return new Response(object.body, { headers: { 'Content-Type': d.mime, 'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(d.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
            }
            if (method === 'DELETE') {
                await e.BUCKET.delete(d.object_key);
                await run(e, 'DELETE FROM documents WHERE id=?', d.id);
                return json({ ok: true });
            }
        }
        if (path === '/api/reviews' && method === 'POST') {
            if (u.role !== 'PARENT')
                fail(403, 'Seuls les parents peuvent laisser un avis.');
            const b = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().min(10).max(2000), display_name: z.string().max(60).default('') }).parse(await body(req));
            await batch(e, [stmt(e, "INSERT INTO reviews(id,parent_id,rating,comment,display_name,status,created_at) VALUES(?,?,?,?,?,'PENDING',?) ON CONFLICT(parent_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment,display_name=excluded.display_name,status='PENDING',created_at=excluded.created_at", id(), u.id, b.rating, b.comment, b.display_name, now()), ...await admins(e, 'Nouvel avis à modérer', u.first_name, '/avis')]);
            return json({ ok: true }, 201);
        }
        const rv = path.match(/^\/api\/reviews\/([^/]+)$/);
        if (rv) {
            admin(u);
            if (method === 'PATCH') {
                const b = z.object({ status: z.enum(['PUBLISHED', 'HIDDEN']) }).parse(await body(req));
                await run(e, 'UPDATE reviews SET status=? WHERE id=?', b.status, rv[1]);
                return json({ ok: true });
            }
            if (method === 'DELETE') {
                await run(e, 'DELETE FROM reviews WHERE id=?', rv[1]);
                return json({ ok: true });
            }
        }
        if (path === '/api/notifications/read' && method === 'POST') {
            await run(e, 'UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', now(), u.id);
            return json({ ok: true });
        }
        if (path === '/api/settings' && method === 'PATCH') {
            admin(u);
            const b = z.object({ pendingHours: z.number().int().min(1).max(168), cancellationHours: z.number().int().min(0).max(168), allowDirectCancel: z.boolean(), reminderHours: z.number().int().min(1).max(168), retentionMonths: z.number().int().min(1).max(120), durations: z.array(durationField).min(1).max(8), teacherName: textField, contactEmail: z.union([z.string().email(), z.literal('')]), legalName: z.string().max(200), legalAddress: z.string().max(1000) }).parse(await body(req));
            await batch(e, [...Object.entries(b).map(([k, v]) => stmt(e, 'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, JSON.stringify(v))), audit(e, u, 'settings.update')]);
            return json({ ok: true });
        }
        if (path === '/api/export' && method === 'GET') {
            const data = await dashboard(e, u);
            delete data.notes;
            delete data.parents;
            delete data.privacy;
            return json(data, 200, { 'Content-Disposition': 'attachment; filename="novelys-mes-donnees.json"' });
        }
        if (path === '/api/privacy' && method === 'POST') {
            if (u.role !== 'PARENT')
                fail(400, 'Cette demande concerne les comptes familles.');
            await batch(e, [...guard(e, "NOT EXISTS(SELECT 1 FROM privacy_requests WHERE user_id=? AND status='PENDING')", u.id), stmt(e, 'INSERT INTO privacy_requests(id,user_id,created_at) VALUES(?,?,?)', id(), u.id, now()), ...await admins(e, 'Demande de suppression des données', u.first_name, '/parametres')]);
            return json({ ok: true }, 201);
        }
        const pm = path.match(/^\/api\/privacy\/([^/]+)\/erase$/);
        if (pm && method === 'POST') {
            admin(u);
            const p = await one(e, "SELECT p.*,u.role FROM privacy_requests p JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.status='PENDING'", pm[1]);
            if (!p || p.role !== 'PARENT')
                fail(404, 'Demande introuvable.');
            for (const d of await all(e, 'SELECT d.object_key FROM documents d JOIN students s ON s.id=d.student_id WHERE s.parent_id=?', p.user_id))
                await e.BUCKET.delete(d.object_key);
            await batch(e, [stmt(e, 'DELETE FROM users WHERE id=?', p.user_id), audit(e, u, 'family.erased')]);
            return json({ ok: true });
        }
        if (path === '/api/demo/retire' && method === 'POST') {
            admin(u);
            if (u.demo)
                fail(400, 'Connectez-vous d’abord avec votre compte administrateur personnel.');
            for (const d of await all(e, 'SELECT d.object_key FROM documents d JOIN students s ON s.id=d.student_id JOIN users u ON u.id=s.parent_id WHERE u.demo=1'))
                await e.BUCKET.delete(d.object_key);
            await batch(e, [stmt(e, "INSERT INTO settings(key,value) VALUES('demoRetired','true') ON CONFLICT(key) DO UPDATE SET value='true'"), stmt(e, 'DELETE FROM users WHERE demo=1'), stmt(e, 'DELETE FROM availabilities WHERE demo=1'), audit(e, u, 'demo.retired')]);
            return json({ ok: true });
        }
        if (path === '/api/jobs/run' && method === 'POST') {
            admin(u);
            await processJobs(e);
            return json({ ok: true });
        }
        fail(404, 'Ressource introuvable.');
    }
    catch (err: any) {
        if (err instanceof HttpError)
            return json({ error: err.message }, err.status);
        if (err instanceof z.ZodError)
            return json({ error: err.errors.map(x => `${x.path.join(' ')} : ${x.message}`).join(' · ') }, 400);
        const msg = String(err?.message || err);
        if (/BOOKING_CONFLICT|BLOCK_CONFLICT/.test(msg))
            return json({ error: 'Ce créneau est déjà réservé ou indisponible. Aucune modification n’a été enregistrée.' }, 409);
        if (/OUTSIDE_AVAILABILITY/.test(msg))
            return json({ error: 'Ce créneau ne fait pas partie des disponibilités.' }, 409);
        if (/INVALID_TRANSITION|PENDING_EXPIRED|REQUEST_PROCESSED|OPERATION_CHANGED/.test(msg))
            return json({ error: 'La demande a déjà changé ou a expiré. Actualisez votre espace.' }, 409);
        if (/UNIQUE constraint/.test(msg))
            return json({ error: 'Cette entrée existe déjà, ou une demande est déjà en cours.' }, 409);
        console.error('Novelys API:', msg);
        return json({ error: 'Le service est momentanément indisponible. Vos informations saisies sont conservées ; réessayez.' }, 503);
    }
}
