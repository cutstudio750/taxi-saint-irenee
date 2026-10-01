/**
 * Format de l'email de réservation + validation des données.
 * Module PARTAGÉ : utilisé par le navigateur (mode email de secours)
 * et par le Worker Cloudflare (worker/src/index.ts). Aucune dépendance au DOM.
 */

export type TripType = 'standard' | 'medical';
export type Prescription = 'yes' | 'pending' | 'no';

/**
 * Informations propres au transport médical conventionné (CPAM).
 * Volontairement minimales : aucune information sur l'état de santé ni sur la nature des soins.
 */
export interface MedicalInfo {
  prescription: Prescription;
  roundTrip: boolean;
  returnTime: string; // HH:MM ou '' si inconnue
  recurring: boolean;
}

export interface BookingPayload {
  lang: 'fr' | 'en';
  tripType: TripType;
  departure: string;
  destination: string;
  date: string; // AAAA-MM-JJ
  time: string; // HH:MM (heure du rendez-vous pour un transport médical)
  passengers: number;
  luggage: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  message: string;
  estimate: { km: number; minutes: number } | null;
  medical: MedicalInfo | null;
  requestedAt: string; // ISO 8601
}

export const LIMITS = {
  address: 200,
  name: 80,
  phone: 24,
  email: 160,
  message: 1000,
  passengers: { min: 1, max: 7 },
  luggage: { min: 0, max: 10 },
} as const;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Accepte les formats français (06…, +33 6…) et internationaux (+xx…, 00xx…). */
export function isValidPhone(value: string): boolean {
  const v = value.trim();
  if (!/^[+\d][\d\s.\-()]*$/.test(v)) return false;
  let digits = v.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+')) return /^\+\d{8,15}$/.test(digits);
  if (digits.startsWith('0')) return /^0\d{9}$/.test(digits);
  return false;
}

/** Met en forme un numéro français : 06 61 88 27 07. Les autres formats sont laissés tels quels. */
export function prettyPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  if (/^33\d{9}$/.test(digits) && value.trim().startsWith('+')) {
    const rest = digits.slice(2);
    return `+33 ${rest[0]} ${rest.slice(1).replace(/(\d{2})(?=\d)/g, '$1 ').trim()}`;
  }
  return value.trim();
}

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Numéro de réservation lisible : TSI-AAMMJJ-XXXX (date de la demande, heure de Paris). */
export function makeReference(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
  return `TSI-${get('year')}${get('month')}${get('day')}-${suffix}`;
}

export const isReference = (s: unknown): s is string =>
  typeof s === 'string' && /^TSI-\d{6}-[A-Z0-9]{4}$/.test(s);

/* ---------- Mise en forme ---------- */

const dateFromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

export const shortDateFr = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const longDate = (iso: string, locale = 'fr-FR') =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    dateFromIso(iso),
  );

export const formatKm = (km: number, locale = 'fr-FR') =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km);

export const formatDuration = (minutes: number) => {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
};

const PRESCRIPTION_FR: Record<Prescription, string> = {
  yes: 'Oui, le patient l’a en sa possession',
  pending: 'Sera remise avant le transport',
  no: 'Aucune (trajet non pris en charge par l’Assurance Maladie)',
};

const isMedical = (p: BookingPayload) => p.tripType === 'medical' && !!p.medical;

/** Objet : "[NOUVELLE RÉSERVATION] Taxi Saint Irénée — JJ/MM/AAAA", suivi de la mention CPAM le cas échéant. */
export const bookingSubject = (p: BookingPayload) =>
  `[NOUVELLE RÉSERVATION] Taxi Saint Irénée — ${shortDateFr(p.date)}${isMedical(p) ? ' — Transport médical CPAM' : ''}`;

const requestedAtFr = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(iso));

/** Sections de l'email, dans l'ordre demandé par l'entreprise. */
export function bookingSections(p: BookingPayload, reference: string) {
  const trajet: [string, string][] = [
    ['Départ', p.departure],
    ['Destination', p.destination],
  ];
  if (p.estimate) {
    trajet.push(['Estimation indicative', `${formatKm(p.estimate.km)} km · ${formatDuration(p.estimate.minutes)} (hors circulation)`]);
  }

  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: 'CLIENT',
      rows: [
        ['Nom', p.lastName],
        ['Prénom', p.firstName],
        ['Téléphone', p.phone],
        ['Email', p.email],
        ['Langue du client', p.lang === 'en' ? 'Anglais' : 'Français'],
      ],
    },
    { title: 'TRAJET', rows: trajet },
    {
      title: 'VOYAGE',
      rows: [
        ['Date', longDate(p.date)],
        [isMedical(p) ? 'Heure du rendez-vous' : 'Heure', p.time],
        ['Passagers', String(p.passengers)],
        ['Bagages', String(p.luggage)],
      ],
    },
  ];

  if (isMedical(p)) {
    const m = p.medical!;
    sections.push({
      title: 'TRANSPORT MÉDICAL (CPAM)',
      rows: [
        ['Type', 'Transport médical conventionné'],
        ['Prescription médicale de transport', PRESCRIPTION_FR[m.prescription]],
        ['Trajet', m.roundTrip ? `Aller-retour, ${m.returnTime ? `retour vers ${m.returnTime}` : 'heure de retour à définir'}` : 'Aller simple'],
        ['Transports réguliers (séances)', m.recurring ? 'Oui' : 'Non'],
      ],
    });
  }

  sections.push({ title: 'MESSAGE', rows: [['Informations complémentaires', p.message.trim() || '—']] });

  return { reference, sections, requestedAt: requestedAtFr(p.requestedAt) };
}

export function bookingText(p: BookingPayload, reference: string): string {
  const s = bookingSections(p, reference);
  const out: string[] = [
    isMedical(p) ? 'NOUVELLE DEMANDE DE RÉSERVATION — TRANSPORT MÉDICAL CPAM' : 'NOUVELLE DEMANDE DE RÉSERVATION',
    `Numéro de réservation : ${reference}`,
    '',
  ];
  for (const sec of s.sections) {
    out.push(sec.title);
    for (const [k, v] of sec.rows) out.push(`${k} : ${v}`);
    out.push('');
  }
  out.push(`Demande effectuée le : ${s.requestedAt}`);
  out.push('');
  out.push('Cette demande n’est pas encore confirmée. Merci de recontacter le client pour confirmer la réservation.');
  return out.join('\n');
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function bookingHtml(p: BookingPayload, reference: string): string {
  const s = bookingSections(p, reference);
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#646468;font-size:13px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#0c0c0d;font-size:15px;white-space:pre-line">${esc(v)}</td></tr>`;
  const sections = s.sections
    .map(
      (sec) =>
        `<h2 style="margin:28px 0 8px;font-size:11px;letter-spacing:.14em;color:#646468;font-weight:600">${sec.title}</h2><table role="presentation" style="border-collapse:collapse;width:100%">${sec.rows
          .map(([k, v]) => row(k, v))
          .join('')}</table>`,
    )
    .join('');
  const title = isMedical(p) ? 'Nouvelle demande — transport médical CPAM' : 'Nouvelle demande de réservation';
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f4f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff">
<p style="margin:0;font-size:11px;letter-spacing:.16em;color:#646468;font-weight:600">TAXI SAINT IRÉNÉE</p>
<h1 style="margin:12px 0 4px;font-size:22px;color:#0c0c0d;font-weight:600">${title}</h1>
<p style="margin:0;font-size:15px;color:#0c0c0d">Numéro de réservation : <strong>${esc(reference)}</strong></p>
${sections}
<p style="margin:28px 0 0;font-size:13px;color:#646468">Demande effectuée le ${esc(s.requestedAt)}</p>
<p style="margin:16px 0 0;padding:12px 14px;background:#f5f4f0;border-radius:8px;font-size:13px;color:#39393c">Cette demande n’est pas encore confirmée. Merci de recontacter le client pour confirmer la réservation.</p>
</div></body></html>`;
}

/** Accusé de réception envoyé au client (facultatif, côté Worker). */
export function acknowledgementText(p: BookingPayload, reference: string): { subject: string; text: string } {
  const medical = isMedical(p);
  if (p.lang === 'en') {
    return {
      subject: `Your ride request ${reference} — Taxi Saint Irénée`,
      text: [
        `Hello ${p.firstName},`,
        '',
        'We have received your ride request. It is not confirmed yet: your driver will get back to you shortly to confirm your booking.',
        '',
        `Booking no.: ${reference}`,
        `Pick-up: ${p.departure}`,
        `Destination: ${p.destination}`,
        `Date: ${longDate(p.date, 'en-GB')}, ${medical ? 'appointment at' : 'at'} ${p.time}`,
        `Passengers: ${p.passengers} · Luggage: ${p.luggage}`,
        ...(medical
          ? ['', 'Medical transport: on the day, please bring your medical transport prescription and your carte Vitale.']
          : []),
        '',
        'Taxi Saint Irénée — Lyon, since 2014',
        '+33 6 61 88 27 07',
      ].join('\n'),
    };
  }
  return {
    subject: `Votre demande ${reference} — Taxi Saint Irénée`,
    text: [
      `Bonjour ${p.firstName},`,
      '',
      'Nous avons bien reçu votre demande de trajet. Elle n’est pas encore confirmée : le chauffeur reviendra vers vous afin de confirmer votre réservation.',
      '',
      `N° de réservation : ${reference}`,
      `Départ : ${p.departure}`,
      `Destination : ${p.destination}`,
      `Date : ${longDate(p.date)}, ${medical ? 'rendez-vous à' : 'à'} ${p.time}`,
      `Passagers : ${p.passengers} · Bagages : ${p.luggage}`,
      ...(medical
        ? ['', 'Transport médical : le jour du trajet, munissez-vous de votre prescription médicale de transport et de votre carte Vitale.']
        : []),
      '',
      'Taxi Saint Irénée — Lyon, depuis 2014',
      '06 61 88 27 07',
    ].join('\n'),
  };
}

/* ---------- Validation (serveur et client) ---------- */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : Number.NaN);

export function parsePayload(raw: unknown): { ok: true; data: BookingPayload } | { ok: false; errors: string[] } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const data: BookingPayload = {
    lang: r.lang === 'en' ? 'en' : 'fr',
    tripType: r.tripType === 'medical' ? 'medical' : 'standard',
    departure: str(r.departure, LIMITS.address),
    destination: str(r.destination, LIMITS.address),
    date: str(r.date, 10),
    time: str(r.time, 5),
    passengers: int(r.passengers),
    luggage: int(r.luggage),
    firstName: str(r.firstName, LIMITS.name),
    lastName: str(r.lastName, LIMITS.name),
    phone: str(r.phone, LIMITS.phone),
    email: str(r.email, LIMITS.email),
    message: str(r.message, LIMITS.message),
    estimate: null,
    medical: null,
    requestedAt: new Date().toISOString(),
  };

  if (data.departure.length < 3) errors.push('departure');
  if (data.destination.length < 3) errors.push('destination');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(dateFromIso(data.date).getTime())) errors.push('date');
  if (!TIME_RE.test(data.time)) errors.push('time');
  if (!(data.passengers >= LIMITS.passengers.min && data.passengers <= LIMITS.passengers.max)) errors.push('passengers');
  if (!(data.luggage >= LIMITS.luggage.min && data.luggage <= LIMITS.luggage.max)) errors.push('luggage');
  if (!data.firstName) errors.push('firstName');
  if (!data.lastName) errors.push('lastName');
  if (!isValidPhone(data.phone)) errors.push('phone');
  if (!EMAIL_RE.test(data.email)) errors.push('email');

  if (data.tripType === 'medical') {
    const m = (r.medical ?? {}) as Record<string, unknown>;
    const prescription = m.prescription;
    if (prescription !== 'yes' && prescription !== 'pending' && prescription !== 'no') errors.push('prescription');
    const roundTrip = m.roundTrip === true;
    const returnTime = roundTrip ? str(m.returnTime, 5) : '';
    if (returnTime && !TIME_RE.test(returnTime)) errors.push('returnTime');
    data.medical = {
      prescription: (prescription as Prescription) ?? 'no',
      roundTrip,
      returnTime,
      recurring: m.recurring === true,
    };
  }

  const est = r.estimate as Record<string, unknown> | null | undefined;
  if (est && typeof est.km === 'number' && typeof est.minutes === 'number' && est.km > 0 && est.km < 3000 && est.minutes > 0 && est.minutes < 3000) {
    data.estimate = { km: Math.round(est.km * 10) / 10, minutes: Math.round(est.minutes) };
  }

  return errors.length ? { ok: false, errors } : { ok: true, data };
}
