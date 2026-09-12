import { type Env, all, one, stmt, batch, id, hashPassword, settings } from './core.ts';
import { dateKey, addDays, parisTime } from '../lib/time.ts';
export async function seedDemo(e: Env) {
    if ((await settings(e)).demoRetired)
        return;
    if (await one(e, "SELECT key FROM settings WHERE key='demoSeed'"))
        return;
    if (!e.DEMO_PASSWORD)
        throw new Error('DEMO_PASSWORD missing');
    const hash = await hashPassword(e.DEMO_PASSWORD), now = Date.now(), today = dateKey();
    const ss: any[] = [stmt(e, "INSERT INTO settings(key,value) VALUES('demoSeed','true')")];
    const users = [['demo-admin', 'ADMIN', 'Camille', 'Professeur', 'professeur@novelys.test'], ['demo-parent', 'PARENT', 'Sophie', 'Martin', 'sophie@novelys.test'], ['demo-family2', 'PARENT', 'Julien', 'Moreau', 'julien@novelys.test']];
    for (const [i, role, first, last, email] of users)
        ss.push(stmt(e, 'INSERT INTO users(id,email,password_hash,role,first_name,last_name,phone,demo,created_at,last_active_at) VALUES(?,?,?,?,?,?,?,1,?,?)', i, email, hash, role, first, last, '0600000000', now, now));
    const kids = [['demo-axel', 'demo-parent', 'Axel', '4e', 'Mathématiques', 'Comprendre le cours', 'Le théorème de Pythagore'], ['demo-louise', 'demo-parent', 'Louise', 'Seconde', 'Physique-chimie', 'Préparer les contrôles', 'Quantité de matière et conversions'], ['demo-matheo', 'demo-family2', 'Mathéo', '6e', 'Mathématiques', 'Remonter ses notes', 'Fractions et priorités opératoires']];
    for (const [i, p, f, g, s, o, d] of kids)
        ss.push(stmt(e, 'INSERT INTO students(id,parent_id,first_name,grade,subject,objectives,difficulties,created_at) VALUES(?,?,?,?,?,?,?,?)', i, p, f, g, s, o, d, now));
    for (let d = 0; d < 28; d++) {
        const date = addDays(today, d);
        ss.push(stmt(e, "INSERT INTO availabilities(id,starts_at,ends_at,kind,label,demo) VALUES(?,?,?,'AVAILABLE','Disponibilité de démonstration',1)", `demo-avail-${d}`, parisTime(date, '10:00'), parisTime(date, '19:00')));
    }
    for (let d = 0; d < 8; d++) {
        const date = addDays(today, d), k = kids[d % 3], bid = `demo-booking-${d}`;
        ss.push(stmt(e, 'INSERT INTO bookings(id,student_id,starts_at,ends_at,subject,status,expires_at,work_on,preparation,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', bid, k[0], parisTime(date, d % 2 ? '16:00' : '14:00'), parisTime(date, d % 2 ? '17:00' : '15:00'), k[4], d === 3 ? 'PENDING' : 'CONFIRMED', d === 3 ? now + 86400000 : null, d % 2 ? 'Exercices' : 'Préparation d’une évaluation', d % 2 ? 'Reprendre les exercices du chapitre.' : 'Préparer un entraînement progressif.', now, now));
    }
    for (let i = 0; i < 3; i++)
        ss.push(stmt(e, 'INSERT INTO upcoming_exams(id,student_id,date,subject,chapter,concepts,created_at) VALUES(?,?,?,?,?,?,?)', id(), kids[i][0], addDays(today, i * 3 + 2), kids[i][4], ['Théorème de Pythagore', 'Quantité de matière', 'Fractions'][i], 'Exercices et application du cours', now));
    ss.push(stmt(e, "INSERT INTO private_teacher_notes(id,student_id,content,created_at) VALUES(?,?,?,?)", id(), 'demo-axel', 'Pythagore compris. Travailler la rédaction et vérifier les unités.', now));
    ss.push(stmt(e, "INSERT INTO requests(id,student_id,type,proposals,reason,created_at) VALUES(?,?,'CUSTOM',?,?,?)", id(), 'demo-matheo', JSON.stringify([{ starts_at: parisTime(addDays(today, 5), '19:00'), duration: 60 }]), 'Un entraînement avant le contrôle de fractions.', now));
    ss.push(stmt(e, "INSERT INTO waiting_list(id,student_id,starts_at,ends_at,created_at) VALUES(?,?,?,?,?)", id(), 'demo-matheo', parisTime(addDays(today, 2), '14:00'), parisTime(addDays(today, 2), '15:00'), now));
    for (let i = 0; i < 2; i++)
        ss.push(stmt(e, "INSERT INTO reviews(id,parent_id,rating,comment,display_name,status,created_at) VALUES(?,?,?,?,?,'PUBLISHED',?)", id(), users[i + 1][0], 5, ['Des explications claires et une vraie progression. Axel aborde ses contrôles avec plus de confiance.', 'Un accompagnement très attentif. Les séances sont bien préparées et adaptées à Mathéo.'][i], users[i + 1][2], now));
    try {
        await batch(e, ss);
    }
    catch (err) {
        if (!await one(e, "SELECT key FROM settings WHERE key='demoSeed'"))
            throw err;
    }
}
