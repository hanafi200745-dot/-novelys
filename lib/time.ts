export const ZONE = 'Europe/Paris';
export function dateKey(value: number | Date = Date.now()) { return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value); }
export function clock(value: number) { return new Intl.DateTimeFormat('fr-FR', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' }).format(value); }
export function dayLabel(value: number, long = false) { return new Intl.DateTimeFormat('fr-FR', { timeZone: ZONE, weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short' }).format(value); }
export function addDays(date: string, n: number) { return new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
export function weekday(date: string) { return new Date(date + 'T12:00:00Z').getUTCDay(); }
export function parisTime(date: string, time: string) { const target = Date.parse(`${date}T${time}:00Z`); if (!Number.isFinite(target))
    throw new Error('Date ou heure invalide.'); let result = target; for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(result).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    const delta = target - local;
    result += delta;
    if (!delta)
        break;
} if (dateKey(result) !== date || clock(result) !== time)
    throw new Error('Cette heure n’existe pas lors du changement d’heure.'); return result; }
export function durationLabel(m: number) { return `${Math.floor(m / 60) ? `${Math.floor(m / 60)} h` : ''}${m % 60 ? ` ${m % 60} min` : ''}`.trim(); }
export function examLabel(date: string) { const d = Math.round((Date.parse(date) - Date.parse(dateKey())) / 86400000); return d === 0 ? 'Aujourd’hui' : d === 1 ? 'Demain' : d < 0 ? 'Passée' : d <= 7 ? `Dans ${d} jours` : d <= 14 ? 'La semaine prochaine' : dayLabel(parisTime(date, '12:00')); }
