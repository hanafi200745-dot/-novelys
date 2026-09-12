'use client';
import React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { CalendarDays, ArrowRight, Check, Clock, FileText, ShieldCheck } from 'lucide-react';
import { dayLabel, clock, durationLabel } from '../lib/time';
export const subjects = ['Mathématiques', 'Physique-chimie', 'Mathématiques + Physique-chimie'];
export const grades = ['Primaire', '6e', '5e', '4e', '3e', 'Seconde', 'Première', 'Terminale'];
export const goals = ['Remonter ses notes', 'Comprendre le cours', 'Combler ses lacunes', 'Aide aux devoirs', 'Préparer les contrôles', 'Préparer un examen', 'Prendre de l’avance', 'Autre'];
export const workOptions = ['Devoirs', 'Exercices', 'Révision du cours', 'Préparation d’une évaluation', 'Correction d’un ancien contrôle', 'Remise à niveau', 'Approfondissement', 'Préparation d’un examen', 'Autre'];
export const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export async function request(path: string, method = 'GET', data?: any) { const response = await fetch('/api' + path, { method, headers: data instanceof FormData ? {} : { 'Content-Type': 'application/json' }, ...(data !== undefined ? { body: data instanceof FormData ? data : JSON.stringify(data) } : {}) }); const result = await response.json().catch(() => ({ error: 'La réponse du serveur est indisponible.' })); if (!response.ok)
    throw new Error(result.error || 'Une erreur est survenue.'); return result; }
export function Brand() { return <a className="brand" href="/" aria-label="Novélys, accueil"><span className="monogram">N<span /></span><span><b>novélys</b><small>COURS PARTICULIERS</small></span></a>; }
export function Button({ children, secondary = false, danger = false, small = false, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    secondary?: boolean;
    danger?: boolean;
    small?: boolean;
}) { return <button type="button" className={`btn ${secondary ? 'secondary' : ''} ${danger ? 'danger' : ''} ${small ? 'small' : ''} ${className}`} {...props}>{children}</button>; }
export function LinkButton({ children, href, secondary = false }: {
    children: React.ReactNode;
    href: string;
    secondary?: boolean;
}) { return <a href={href} className={`btn ${secondary ? 'secondary' : ''}`}>{children}</a>; }
export function Field({ label, name, value, onChange, type = 'text', required = false, hint, ...props }: any) { return <label className="field" htmlFor={name}><span>{label}{required ? ' *' : ''}</span><input id={name} name={name} type={type} required={required} value={value ?? ''} onChange={e => onChange(e.target.value)} {...props}/>{hint && <small>{hint}</small>}</label>; }
export function Area({ label, name, value, onChange, required = false, ...props }: any) { return <label className="field" htmlFor={name}><span>{label}{required ? ' *' : ''}</span><textarea rows={3} id={name} name={name} value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} {...props}/></label>; }
export function Choice({ label, name, value, onChange, options, required = true }: any) { return <div className="field"><label htmlFor={name}>{label}{required ? ' *' : ''}</label><Select name={name} value={String(value ?? '')} onValueChange={onChange} required={required}><SelectTrigger id={name} className="choice"><SelectValue placeholder="Choisir"/></SelectTrigger><SelectContent>{options.map((o: any) => { const val = typeof o === 'object' ? String(o.value) : String(o), text = typeof o === 'object' ? o.label : String(o); return <SelectItem key={val} value={val}>{text}</SelectItem>; })}</SelectContent></Select></div>; }
export function CheckField({ label, checked, onChange }: any) { const id = React.useId(); return <label className="check-field" htmlFor={id}><Checkbox id={id} checked={checked} onCheckedChange={v => onChange(v === true)}/><span>{label}</span></label>; }
export const labels: any = { PENDING: 'En attente', CONFIRMED: 'Confirmé', COMPLETED: 'Terminé', CANCELLED: 'Annulé', DECLINED: 'Refusé', AVAILABLE: 'Disponible', UNAVAILABLE: 'Indisponible', PROPOSED: 'Horaire proposé', ACCEPTED: 'Acceptée', WAITING: 'En liste d’attente', NOTIFIED: 'Famille prévenue', OFFERED: 'Proposition envoyée', PUBLISHED: 'Publié', HIDDEN: 'Masqué' };
export function Status({ value }: {
    value: string;
}) { return <span className={`status status-${value?.toLowerCase()}`}>{labels[value] || value}</span>; }
export function EmptyState({ title = 'Rien pour le moment', description = 'Les nouvelles informations apparaîtront ici.', children }: any) { return <Empty className="empty-state"><EmptyHeader><CalendarDays size={26}/><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{children}</Empty>; }
export function SectionTitle({ title, subtitle, action }: any) { return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
export function Avatar({ name, large = false }: {
    name: string;
    large?: boolean;
}) { return <span className={`avatar ${large ? 'large' : ''}`}>{name?.slice(0, 1).toUpperCase()}</span>; }
export function CourseCard({ b, admin = false, onAction, onStudent, compact = false }: any) { return <article className={`course-card ${b.status === 'PENDING' ? 'pending' : ''}`}><div className="course-time"><b>{clock(b.starts_at)}</b><small>{clock(b.ends_at)}</small></div><div className="course-info"><div className="row wrap"><button className="text-button name-button" onClick={() => onStudent(b.student_id)}>{b.student_name || b.first_name}</button><span className="muted">{b.grade}</span>{b.series_id && <small className="series-tag">Régulier</small>}</div><p>{b.subject} <span className="muted">· {durationLabel((b.ends_at - b.starts_at) / 60000)}</span></p><div className="row wrap"><Status value={b.status}/><span className="meta">{dayLabel(b.starts_at)}</span></div>{!compact && (b.work_on || b.preparation) && <div className="prep"><FileText size={15}/><span>{b.work_on}{b.work_on && b.preparation ? ' · ' : ''}{b.preparation}</span></div>}{!compact && b.next_exam && <div className="exam-inline">Évaluation : {b.next_exam.chapter} · {b.next_exam.date}</div>}{!compact && <div className="course-actions">{admin && b.status === 'PENDING' && <><Button small onClick={() => onAction({ type: 'direct', path: `/bookings/${b.id}/confirm`, label: 'Confirmer ce cours ?' })}>Confirmer</Button><Button small secondary onClick={() => onAction({ type: 'alternative', booking: b })}>Autre horaire</Button><Button small secondary danger onClick={() => onAction({ type: 'direct', path: `/bookings/${b.id}/decline`, label: 'Refuser cette réservation ?', description: 'Le créneau redevient disponible.' })}>Refuser</Button></>}{['CONFIRMED', 'PENDING'].includes(b.status) && <><Button small secondary onClick={() => onAction({ type: 'move', booking: b })}>{admin ? 'Déplacer' : 'Demander un déplacement'}</Button><Button small secondary onClick={() => onAction({ type: 'cancel', booking: b })}>{admin ? 'Annuler' : 'Demander une annulation'}</Button></>}{admin && ['CONFIRMED', 'COMPLETED'].includes(b.status) && b.starts_at < Date.now() && <Button small onClick={() => onAction({ type: 'report', booking: b })}>Bilan de séance</Button>}</div>}</div></article>; }
export function TrustLine() { return <div className="trust-line"><span><ShieldCheck size={17}/> Espace familial privé</span><span><Check size={17}/> Réservation sous validation</span><span><Clock size={17}/> En quelques minutes</span></div>; }
