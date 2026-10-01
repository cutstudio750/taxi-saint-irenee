/**
 * Taxi Saint Irénée — fonction d'envoi des demandes de réservation.
 *
 * Cloudflare Worker (gratuit jusqu'à 100 000 requêtes / jour) + Resend (API email).
 * La clé RESEND_API_KEY est un secret Cloudflare : elle n'apparaît jamais dans le site
 * ni dans le dépôt GitHub.
 *
 * Protections : liste blanche d'origines (CORS), type et taille du contenu,
 * champ piège anti-robot, délai minimal de saisie, validation stricte des champs,
 * limitation de débit facultative (binding RATE_LIMITER).
 */
import {
  parsePayload,
  makeReference,
  bookingSubject,
  bookingText,
  bookingHtml,
  acknowledgementText,
} from '../../src/lib/booking-email.ts';

interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  RESEND_API_KEY: string;
  BOOKING_FROM_EMAIL: string;
  BOOKING_TO_EMAIL?: string;
  ALLOWED_ORIGINS: string;
  SEND_ACKNOWLEDGEMENT?: string;
  RATE_LIMITER?: RateLimiter;
}

const DEFAULT_TO = 'taxisaintirenee@gmail.com';
const MAX_BODY = 10_000;
const MIN_FILL_MS = 2500;

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

async function sendEmail(env: Env, payload: Record<string, unknown>, idempotencyKey?: string) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors: Record<string, string> = originOk
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        }
      : { Vary: 'Origin' };

    if (request.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, { ...cors, Allow: 'POST, OPTIONS' });
    if (!originOk) return json({ ok: false, error: 'origin' }, 403, cors);

    if (!env.RESEND_API_KEY || !env.BOOKING_FROM_EMAIL) {
      console.error('Configuration incomplète : RESEND_API_KEY ou BOOKING_FROM_EMAIL manquant.');
      return json({ ok: false, error: 'config' }, 500, cors);
    }

    const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim();
    if (type !== 'application/json') return json({ ok: false, error: 'type' }, 415, cors);

    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ ok: false, error: 'rate' }, 429, cors);
    }

    const text = await request.text();
    if (text.length > MAX_BODY) return json({ ok: false, error: 'size' }, 413, cors);

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text);
    } catch {
      return json({ ok: false, error: 'json' }, 400, cors);
    }

    // Robots : réponse identique à un succès, mais rien n'est envoyé.
    const elapsed = typeof raw.elapsed === 'number' ? raw.elapsed : 0;
    if ((typeof raw.website === 'string' && raw.website.trim() !== '') || (elapsed > 0 && elapsed < MIN_FILL_MS)) {
      return json({ ok: true, reference: makeReference(), acknowledged: false }, 200, cors);
    }

    const parsed = parsePayload(raw);
    if (!parsed.ok) return json({ ok: false, error: 'invalid', fields: parsed.errors }, 422, cors);

    const p = parsed.data;
    const reference = makeReference();
    const to = env.BOOKING_TO_EMAIL || DEFAULT_TO;

    const res = await sendEmail(
      env,
      {
        from: env.BOOKING_FROM_EMAIL,
        to: [to],
        reply_to: p.email,
        subject: bookingSubject(p),
        text: bookingText(p, reference),
        html: bookingHtml(p, reference),
        tags: [{ name: 'type', value: 'booking' }],
      },
      `booking-${reference}`,
    );
    if (!res.ok) {
      console.error('Resend error', res.status, await res.text());
      return json({ ok: false, error: 'send' }, 502, cors);
    }

    // Accusé de réception au client (nécessite un domaine vérifié chez Resend).
    let acknowledged = false;
    if (env.SEND_ACKNOWLEDGEMENT === 'true') {
      const ack = acknowledgementText(p, reference);
      const r2 = await sendEmail(env, {
        from: env.BOOKING_FROM_EMAIL,
        to: [p.email],
        reply_to: to,
        subject: ack.subject,
        text: ack.text,
      }).catch(() => null);
      acknowledged = !!r2?.ok;
      if (r2 && !r2.ok) console.error('Acknowledgement error', r2.status, await r2.text());
    }

    return json({ ok: true, reference, acknowledged }, 200, cors);
  },
};
