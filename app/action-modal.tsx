'use client';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Field, Area, Choice, Button, CheckField, subjects, grades, goals, workOptions, days, request } from './ui';
import { dateKey, addDays, parisTime, clock, dayLabel, durationLabel } from '../lib/time';
function StudentFields({ f, set, parents, admin }: any) { return <>{admin && <Choice label="Parent responsable" name="parent_id" value={f.parent_id} onChange={(v: string) => set('parent_id', v)} options={parents.map((p: any) => ({ value: p.id, label: `${p.first_name} ${p.last_name} · ${p.email}` }))}/>}<div className="form-grid"><Field label="Prénom de l’élève" name="first_name" value={f.first_name} onChange={(v: string) => set('first_name', v)} required maxLength={150}/><Choice label="Classe" name="grade" value={f.grade} onChange={(v: string) => set('grade', v)} options={grades}/></div><Choice label="Matière souhaitée" name="subject" value={f.subject} onChange={(v: string) => set('subject', v)} options={subjects}/><div className="form-grid"><Choice label="Séances souhaitées par semaine" name="weekly_sessions" value={['1', '2', '3'].includes(f.weekly_sessions) ? f.weekly_sessions : 'Autre'} onChange={(v: string) => set('weekly_sessions', v)} options={['1', '2', '3', 'Autre']}/><Choice label="Durée habituelle" name="usual_duration" value={String(f.usual_duration)} onChange={(v: string) => set('usual_duration', +v)} options={[30, 60, 90, 120, 150, 180, 210, 240].map(n => ({ value: n, label: durationLabel(n) }))}/></div>{!['1', '2', '3'].includes(f.weekly_sessions) && <Field label="Nombre de séances souhaité" name="weekly_other" value={f.weekly_sessions === 'Autre' ? '' : f.weekly_sessions} onChange={(v: string) => set('weekly_sessions', v)} placeholder="Précisez votre rythme" required/>}<Choice label="Objectif principal" name="objectives" value={goals.includes(f.objectives) ? f.objectives : 'Autre'} onChange={(v: string) => set('objectives', v)} options={goals}/>{!goals.slice(0, -1).includes(f.objectives) && <Field label="Précisez votre objectif" name="objective_other" value={f.objectives === 'Autre' ? '' : f.objectives} onChange={(v: string) => set('objectives', v)}/>}<Area label="Principales difficultés de votre enfant" name="difficulties" value={f.difficulties} onChange={(v: string) => set('difficulties', v)} maxLength={4000}/></>; }
export function ActionModal({ action, data, onClose, onSaved }: any) {
    const a = action, b = a.booking || {}, s = a.student || {}, r = a.record || {}, admin = data.user.role === 'ADMIN';
    const defaultStart = a.starts_at || b.starts_at || JSON.parse(r.proposals || '[]')[0]?.starts_at;
    const [f, setForm] = useState<any>({ student_id: s.id || b.student_id || r.student_id || data.students[0]?.id || '', first_name: s.first_name || '', last_name: '', email: '', phone: '', password: '', role: 'PARENT', grade: s.grade || '6e', subject: s.subject || b.subject || r.subject || 'Mathématiques', weekly_sessions: s.weekly_sessions || '1', usual_duration: s.usual_duration || 60, objectives: s.objectives || 'Comprendre le cours', difficulties: s.difficulties || '', parent_id: s.parent_id || data.parents?.[0]?.id || '', date: defaultStart ? dateKey(defaultStart) : addDays(dateKey(), 1), end_date: addDays(dateKey(), 28), time: defaultStart ? clock(defaultStart) : '14:00', end: '19:00', duration: a.duration || (b.ends_at ? (b.ends_at - b.starts_at) / 60000 : r.duration) || 60, scope: 'one', reason: r.reason || '', response: r.response || '', kind: 'AVAILABLE', label: '', days: [3, 6], patternCount: 1, patterns: [{ day: 3, time: '16:00' }, { day: 5, time: '17:00' }, { day: 6, time: '14:00' }], chapter: '', concepts: '', info: '', work_on: workOptions[0], preparation: '', hasExam: false, exam_date: addDays(dateKey(), 2), exam_subject: 'Mathématiques', content: '', progress: '', homework: '', rating: 5, comment: data.reviews?.[0]?.comment || '', display_name: data.user.first_name, extra: [], ...a.initial });
    const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
    const [step, setStep] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState(''), [files, setFiles] = useState<File[]>([]), [newChild, setNewChild] = useState(!data.students.length), [createdBooking, setCreatedBooking] = useState('');
    const title: any = { student: s.id ? 'Modifier l’élève' : 'Ajouter un élève', parent: 'Ajouter un compte parent', admin: 'Créer mon compte administrateur', availability: 'Ajouter des disponibilités', recurring: 'Programmer des cours réguliers', booking: admin ? 'Ajouter un cours' : 'Réserver un cours', exam: 'Transmettre une évaluation', note: 'Mes notes pédagogiques', report: 'Bilan de la séance', document: 'Envoyer un document', custom: 'Demander un créneau personnalisé', move: admin ? 'Déplacer la séance' : 'Demander un déplacement', cancel: admin ? 'Annuler une séance' : 'Demander une annulation', alternative: 'Proposer un autre horaire', decision: a.decision === 'propose' ? 'Proposer un autre horaire' : a.decision === 'decline' ? 'Refuser la demande' : 'Accepter la demande', review: 'Partager votre avis', password: 'Changer mon mot de passe', waiting: 'Être prévenu si ce créneau se libère' };
    const chooseStudent = <Choice label="Élève concerné" name="student_id" value={f.student_id} onChange={(v: string) => set('student_id', v)} options={data.students.map((s: any) => ({ value: s.id, label: `${s.first_name} · ${s.grade}` }))}/>;
    const timing = <><div className="form-grid"><Field label="Date" name="date" type="date" min={dateKey()} value={f.date} onChange={(v: string) => set('date', v)} required/><Field label="Heure" name="time" type="time" step="1800" value={f.time} onChange={(v: string) => set('time', v)} required/></div><Choice label="Durée" name="duration" value={String(f.duration)} onChange={(v: string) => set('duration', +v)} options={(a.type === 'booking' && !admin ? data.settings.durations : [30, 60, 90, 120, 150, 180, 210, 240]).map((n: number) => ({ value: n, label: durationLabel(n) }))}/></>;
    const account = <><div className="form-grid"><Field label="Prénom" name="first_name" value={f.first_name} onChange={(v: string) => set('first_name', v)} required/><Field label="Nom" name="last_name" value={f.last_name} onChange={(v: string) => set('last_name', v)} required/></div><Field label="Adresse e-mail" name="email" type="email" value={f.email} onChange={(v: string) => set('email', v)} required/><Field label="Téléphone" name="phone" type="tel" value={f.phone} onChange={(v: string) => set('phone', v)} required minLength={6}/><Field label="Mot de passe initial" name="password" type="password" value={f.password} onChange={(v: string) => set('password', v)} required minLength={12} maxLength={128} autoComplete="new-password" hint="12 caractères minimum. À transmettre personnellement au titulaire du compte."/></>;
    const examFields = <><Field label="Date de l’évaluation" name="exam_date" type="date" value={f.exam_date} onChange={(v: string) => set('exam_date', v)} required/><Choice label="Matière de l’évaluation" name="exam_subject" value={f.exam_subject} onChange={(v: string) => set('exam_subject', v)} options={subjects}/><Field label="Chapitre" name="chapter" value={f.chapter} onChange={(v: string) => set('chapter', v)} required maxLength={150}/><Area label="Notions évaluées" name="concepts" value={f.concepts} onChange={(v: string) => set('concepts', v)} maxLength={2000}/><Area label="Informations supplémentaires" name="info" value={f.info} onChange={(v: string) => set('info', v)} maxLength={4000}/></>;
    const fileField = <label className="field upload-field"><span>Documents ou photos</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length > 5 || fs.some(f => f.size > 10 * 1024 * 1024)) {
        setError('5 fichiers maximum, 10 Mo par fichier.');
        return;
    } setFiles(fs); setError(''); }} required={a.type === 'document'}/><small>PDF, JPEG, PNG ou WebP. 10 Mo par fichier, 5 fichiers par envoi. Accès limité à votre famille et au professeur.</small>{files.length > 0 && <span>{files.map(x => x.name).join(', ')}</span>}</label>;
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setError('');
        if (a.type === 'booking' && step < 3) {
            if (step === 1 && newChild) {
                setBusy(true);
                try {
                    const result = await request('/students', 'POST', { ...f, parent_id: admin ? f.parent_id : undefined });
                    set('student_id', result.id);
                    setNewChild(false);
                    await onSaved(false);
                    setStep(2);
                }
                catch (e: any) {
                    setError(e.message);
                }
                finally {
                    setBusy(false);
                }
                return;
            }
            if (step === 1 && !f.student_id) {
                setError('Ajoutez ou choisissez un élève.');
                return;
            }
            setStep(step + 1);
            return;
        }
        setBusy(true);
        try {
            const starts_at = parisTime(f.date, f.time), duration = +f.duration;
            let result: any;
            switch (a.type) {
                case 'student':
                    result = await request('/students' + (s.id ? '/' + s.id : ''), s.id ? 'PATCH' : 'POST', f);
                    break;
                case 'parent':
                case 'admin':
                    result = await request('/parents', 'POST', { ...f, role: a.type === 'admin' ? 'ADMIN' : 'PARENT' });
                    break;
                case 'availability':
                    result = await request('/availabilities', 'POST', { date: f.date, end_date: f.end_date, start: f.time, end: f.end, kind: f.kind, label: f.label, days: f.days });
                    break;
                case 'recurring':
                    result = await request('/recurring', 'POST', { student_id: f.student_id, start_date: f.date, end_date: f.end_date, subject: f.subject, duration, patterns: f.patterns.slice(0, +f.patternCount) });
                    break;
                case 'booking': {
                    let bid = createdBooking;
                    if (!bid) {
                        result = await request('/bookings', 'POST', { student_id: f.student_id, starts_at, duration, subject: f.subject, work_on: f.work_on, preparation: f.preparation, ...(f.hasExam ? { exam: { date: f.exam_date, subject: f.exam_subject, chapter: f.chapter, concepts: f.concepts, info: f.info } } : {}) });
                        bid = result.id;
                        setCreatedBooking(bid);
                    }
                    for (const file of files) {
                        const form = new FormData();
                        form.set('student_id', f.student_id);
                        form.set('booking_id', bid);
                        form.set('file', file);
                        await request('/documents', 'POST', form);
                        setFiles(prev => prev.filter(x => x !== file));
                    }
                    break;
                }
                case 'exam':
                    result = await request('/exams', 'POST', { student_id: f.student_id, date: f.exam_date, subject: f.exam_subject, chapter: f.chapter, concepts: f.concepts, info: f.info });
                    break;
                case 'note':
                    result = await request('/notes', 'POST', { student_id: f.student_id, content: f.content });
                    break;
                case 'report':
                    result = await request('/reports', 'POST', { booking_id: b.id, concepts: f.concepts, difficulties: f.difficulties, progress: f.progress, homework: f.homework });
                    break;
                case 'document':
                    for (const file of files) {
                        const form = new FormData();
                        form.set('student_id', f.student_id);
                        form.set('file', file);
                        await request('/documents', 'POST', form);
                        setFiles(prev => prev.filter(x => x !== file));
                    }
                    break;
                case 'custom':
                    result = await request('/requests', 'POST', { student_id: f.student_id, subject: f.subject, duration, reason: f.reason, proposals: [{ starts_at, duration }, ...f.extra.map((p: any) => ({ starts_at: parisTime(p.date, p.time), duration }))] });
                    break;
                case 'move':
                case 'alternative':
                    result = await request(`/bookings/${b.id}/${a.type}`, 'POST', { starts_at, duration, scope: f.scope, reason: f.reason, response: f.response });
                    break;
                case 'cancel':
                    result = await request(`/bookings/${b.id}/cancel`, 'POST', { scope: f.scope, reason: f.reason });
                    break;
                case 'decision':
                    result = await request(`/requests/${r.id}/${a.decision}`, 'POST', { starts_at, duration, response: f.response });
                    break;
                case 'review':
                    result = await request('/reviews', 'POST', { rating: +f.rating, comment: f.comment, display_name: f.display_name });
                    break;
                case 'password':
                    result = await request('/password', 'POST', { current: f.current || '', password: f.password });
                    break;
                case 'waiting':
                    result = await request('/waiting', 'POST', { student_id: f.student_id, starts_at, duration });
                    break;
            }
            toast.success(a.type === 'booking' ? (admin ? 'Votre cours est confirmé.' : 'Demande envoyée — en attente de confirmation.') : a.type === 'recurring' ? `${result.count} séances créées.` : 'Votre demande a été enregistrée.');
            await onSaved(true);
            onClose();
        }
        catch (e: any) {
            setError(e.message + (createdBooking ? ' La réservation est enregistrée ; vous pouvez réessayer l’envoi du document.' : ''));
        }
        finally {
            setBusy(false);
        }
    }
    return <Dialog open onOpenChange={v => { if (!v && !busy)
        onClose(); }}><DialogContent className="action-dialog"><DialogHeader><DialogTitle>{title[a.type]}</DialogTitle><DialogDescription>{a.type === 'booking' ? `Étape ${step} sur 3 · ${['Élève et horaire', 'Préparer la séance', 'Vérifier et envoyer'][step - 1]}` : a.type === 'note' ? 'Ces notes sont visibles uniquement par le professeur.' : a.type === 'report' ? 'Ce bilan est partagé avec le parent. Les notes personnelles restent dans la fiche privée.' : a.type === 'custom' ? 'Cette demande ne réserve pas le créneau. Votre professeur vous répondra dans votre espace.' : 'Les champs marqués d’un astérisque sont obligatoires.'}</DialogDescription></DialogHeader><form onSubmit={submit} className="modal-form">
    {a.type === 'student' && <StudentFields f={f} set={set} parents={data.parents} admin={admin && !s.id}/>}
    {['parent', 'admin'].includes(a.type) && account}
    {a.type === 'booking' && <>{step === 1 && <>{!createdBooking && <>{data.students.length > 0 && <><CheckField label="Ajouter un nouvel enfant" checked={newChild} onChange={setNewChild}/>{!newChild && chooseStudent}</>}{newChild && <StudentFields f={f} set={set} parents={data.parents} admin={admin}/>}</>}{timing}<Choice label="Matière pour cette séance" name="subject" value={f.subject} onChange={(v: string) => set('subject', v)} options={subjects}/></>}{step === 2 && <><Choice label="Que souhaitez-vous travailler ?" name="work_on" value={f.work_on} onChange={(v: string) => set('work_on', v)} options={workOptions}/><Area label="Informations utiles pour préparer le cours" name="preparation" value={f.preparation} onChange={(v: string) => set('preparation', v)} maxLength={6000}/><CheckField label="Votre enfant a-t-il une évaluation prochainement ?" checked={f.hasExam} onChange={(v: boolean) => set('hasExam', v)}/>{f.hasExam && <div className="inset-form">{examFields}</div>}{fileField}</>}{step === 3 && <div className="booking-summary"><span className="eyebrow">VOTRE PROCHAINE SÉANCE</span><h3>{dayLabel(parisTime(f.date, f.time), true)} à {f.time}</h3><p>{data.students.find((x: any) => x.id === f.student_id)?.first_name || f.first_name} · {f.subject} · {durationLabel(+f.duration)}</p><p>{f.work_on}</p>{f.hasExam && <p>Évaluation : {f.chapter} · {f.exam_date}</p>}{files.length > 0 && <p>{files.length} document(s) à transmettre</p>}<div className="notice">{admin ? 'Le cours sera confirmé dans le calendrier.' : `Le créneau sera réservé pendant ${data.settings.pendingHours} heures maximum, le temps que votre professeur confirme votre demande.`}</div></div>}</>}
    {a.type === 'availability' && <><Choice label="Type" name="kind" value={f.kind} onChange={(v: string) => set('kind', v)} options={[{ value: 'AVAILABLE', label: 'Disponible à la réservation' }, { value: 'BLOCKED', label: 'Indisponibilité, absence ou vacances' }]}/><div className="form-grid"><Field label="À partir du" name="date" type="date" value={f.date} onChange={(v: string) => set('date', v)} required/><Field label="Jusqu’au" name="end_date" type="date" min={f.date} value={f.end_date} onChange={(v: string) => set('end_date', v)} required/></div><fieldset><legend>Jours concernés</legend><div className="checks-grid">{[1, 2, 3, 4, 5, 6, 0].map(d => <CheckField key={d} label={days[d]} checked={f.days.includes(d)} onChange={(v: boolean) => set('days', v ? [...f.days, d] : f.days.filter((x: number) => x !== d))}/>)}</div></fieldset><div className="form-grid"><Field label="Heure de début" name="time" type="time" value={f.time} onChange={(v: string) => set('time', v)} required/><Field label="Heure de fin" name="end" type="time" value={f.end} onChange={(v: string) => set('end', v)} required/></div><Field label="Libellé privé" name="label" value={f.label} onChange={(v: string) => set('label', v)} placeholder="Par exemple : vacances de la Toussaint"/></>}
    {a.type === 'recurring' && <>{chooseStudent}<div className="form-grid"><Field label="Date de début" name="date" type="date" min={dateKey()} value={f.date} onChange={(v: string) => set('date', v)} required/><Field label="Date de fin" name="end_date" type="date" min={f.date} value={f.end_date} onChange={(v: string) => set('end_date', v)} required/></div><Choice label="Séances par semaine" name="patternCount" value={String(f.patternCount)} onChange={(v: string) => set('patternCount', +v)} options={['1', '2', '3']}/>{f.patterns.slice(0, +f.patternCount).map((p: any, i: number) => <div className="form-grid inset-form" key={i}><Choice label={`Jour de la séance ${i + 1}`} name={`day-${i}`} value={String(p.day)} onChange={(v: string) => set('patterns', f.patterns.map((p: any, n: number) => n === i ? { ...p, day: +v } : p))} options={days.map((d, n) => ({ value: n, label: d }))}/><Field label="Heure" name={`time-${i}`} type="time" step="1800" value={p.time} onChange={(v: string) => set('patterns', f.patterns.map((p: any, n: number) => n === i ? { ...p, time: v } : p))} required/></div>)}<Choice label="Durée des séances" name="duration" value={String(f.duration)} onChange={(v: string) => set('duration', +v)} options={[60, 90, 120].map(n => ({ value: n, label: durationLabel(n) }))}/><Choice label="Matière" name="subject" value={f.subject} onChange={(v: string) => set('subject', v)} options={subjects}/><p className="notice">Tous les créneaux sont vérifiés ensemble. En cas de conflit, aucune séance de la série ne sera créée.</p></>}
    {a.type === 'exam' && <>{chooseStudent}{examFields}</>}
    {a.type === 'note' && <>{chooseStudent}<Area label="Note pédagogique privée" name="content" value={f.content} onChange={(v: string) => set('content', v)} required maxLength={10000}/></>}
    {a.type === 'report' && <><p>{b.student_name} · {dayLabel(b.starts_at, true)}</p><Area label="Notions travaillées" name="concepts" value={f.concepts} onChange={(v: string) => set('concepts', v)} required/><Area label="Difficultés constatées" name="difficulties" value={f.difficulties} onChange={(v: string) => set('difficulties', v)}/><Area label="Progression" name="progress" value={f.progress} onChange={(v: string) => set('progress', v)}/><Area label="Travail conseillé" name="homework" value={f.homework} onChange={(v: string) => set('homework', v)}/></>}
    {a.type === 'document' && <>{chooseStudent}{fileField}</>}
    {a.type === 'custom' && <>{chooseStudent}{timing}<Choice label="Matière" name="subject" value={f.subject} onChange={(v: string) => set('subject', v)} options={subjects}/>{f.extra.map((p: any, i: number) => <div className="inset-form" key={i}><div className="form-grid"><Field label={`Autre date ${i + 2}`} name={`extra-date-${i}`} type="date" min={dateKey()} value={p.date} onChange={(v: string) => set('extra', f.extra.map((p: any, n: number) => n === i ? { ...p, date: v } : p))} required/><Field label="Autre heure" name={`extra-time-${i}`} type="time" value={p.time} onChange={(v: string) => set('extra', f.extra.map((p: any, n: number) => n === i ? { ...p, time: v } : p))} required/></div><Button small secondary onClick={() => set('extra', f.extra.filter((_: any, n: number) => n !== i))}>Retirer cet horaire</Button></div>)}{f.extra.length < 2 && <Button secondary onClick={() => set('extra', [...f.extra, { date: f.date, time: f.time }])}>Proposer un autre horaire</Button>}<Area label="Raison et commentaire" name="reason" value={f.reason} onChange={(v: string) => set('reason', v)}/></>}
    {['move', 'alternative', 'cancel'].includes(a.type) && <><p className="notice">{b.student_name} · {dayLabel(b.starts_at, true)} à {clock(b.starts_at)}<br />{!admin && 'La séance actuelle reste inchangée jusqu’à validation de votre professeur.'}</p>{a.type !== 'cancel' && timing}{admin && b.series_id && a.type !== 'alternative' && <Choice label="Séances concernées" name="scope" value={f.scope} onChange={(v: string) => set('scope', v)} options={[{ value: 'one', label: 'Cette séance uniquement' }, { value: 'future', label: 'Cette séance et toutes les suivantes de la série' }]}/>}<Area label={a.type === 'alternative' ? 'Message au parent' : 'Raison ou commentaire'} name="reason" value={a.type === 'alternative' ? f.response : f.reason} onChange={(v: string) => set(a.type === 'alternative' ? 'response' : 'reason', v)}/></>}
    {a.type === 'decision' && <><p>{r.student_name} · {r.type === 'CUSTOM' ? 'Créneau personnalisé' : r.type === 'MOVE' ? 'Déplacement' : 'Annulation'}</p>{r.reason && <p className="notice">{r.reason}</p>}{a.decision !== 'decline' && r.type !== 'CANCEL' && timing}<Area label="Message au parent" name="response" value={f.response} onChange={(v: string) => set('response', v)}/></>}
    {a.type === 'review' && <><Choice label="Note" name="rating" value={String(f.rating)} onChange={(v: string) => set('rating', +v)} options={[5, 4, 3, 2, 1].map(n => ({ value: n, label: `${n} étoile${n > 1 ? 's' : ''}` }))}/><Area label="Votre commentaire" name="comment" value={f.comment} onChange={(v: string) => set('comment', v)} minLength={10} maxLength={2000} required/><Field label="Prénom à afficher (facultatif)" name="display_name" value={f.display_name} onChange={(v: string) => set('display_name', v)} maxLength={60}/><p className="notice">Votre avis sera vérifié avant publication. Évitez les informations personnelles concernant votre enfant.</p></>}
    {a.type === 'password' && <><Field label="Mot de passe actuel" name="current" type="password" value={f.current} onChange={(v: string) => set('current', v)} required autoComplete="current-password"/><Field label="Nouveau mot de passe" name="password" type="password" minLength={12} maxLength={128} value={f.password} onChange={(v: string) => set('password', v)} required autoComplete="new-password" hint="12 caractères minimum. Les autres sessions seront déconnectées."/></>}
    {a.type === 'waiting' && <>{chooseStudent}<p className="notice">{dayLabel(parisTime(f.date, f.time), true)} à {f.time} · {durationLabel(+f.duration)}<br />Vous recevrez une notification si le créneau se libère. Il ne vous est pas réservé automatiquement.</p></>}
    {error && <p role="alert" className="error-box">{error}</p>}<div className="form-footer">{a.type === 'booking' && step > 1 && !createdBooking && <Button secondary onClick={() => setStep(step - 1)}>Retour</Button>}<Button type="submit" disabled={busy || (['custom', 'waiting', 'document', 'exam', 'note', 'recurring'].includes(a.type) && !f.student_id)}>{busy ? 'Enregistrement…' : a.type === 'booking' && step < 3 ? 'Continuer' : a.type === 'booking' && !admin ? 'Envoyer la demande' : a.type === 'cancel' && !admin ? 'Envoyer la demande' : 'Enregistrer'}</Button></div></form></DialogContent></Dialog>;
}
