/**
 * Réservation — parcours progressif en 5 étapes.
 *
 * Services externes (gratuits, sans clé, opérés par l'IGN / Géoplateforme) :
 *  - autocomplétion d'adresses : https://data.geopf.fr/geocodage/search
 *  - estimation distance / durée : https://data.geopf.fr/navigation/itineraire
 * En cas d'indisponibilité, la saisie libre reste possible et l'estimation est simplement masquée.
 */
import { iconSvg, type IconName } from '../lib/icons';
import {
  EMAIL_RE,
  isValidPhone,
  prettyPhone,
  makeReference,
  bookingSubject,
  bookingText,
  longDate,
  formatKm,
  formatDuration,
  type BookingPayload,
} from '../lib/booking-email';
import type { Dict } from '../i18n/fr';

type Strings = Dict['booking'];
type Kind = 'departure' | 'destination';
interface Place { id: string; label: string; lon: number; lat: number }
interface Config {
  lang: 'fr' | 'en';
  locale: string;
  endpoint: string;
  email: string;
  phone: string;
  siteName: string;
  places: Place[];
  s: Strings;
}
interface Loc { label: string; lon?: number; lat?: number }
interface Opt { kind: 'geo' | 'place' | 'result'; main: string; sub?: string; value: string; lon?: number; lat?: number; icon: IconName }

const GEO_SEARCH = 'https://data.geopf.fr/geocodage/search';
const GEO_REVERSE = 'https://data.geopf.fr/geocodage/reverse';
const ROUTE_API = 'https://data.geopf.fr/navigation/itineraire';
const LYON = { lat: '45.764', lon: '4.8357' };
const STORE_KEY = 'tsi.contact';
const TOTAL = 5;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tpl = (str: string, vars: Record<string, string | number>) => str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/* ---------- Heure de Paris (les trajets sont exprimés en heure locale de Lyon) ---------- */
function parisParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: g('year'), m: g('month'), d: g('day'), h: g('hour'), min: g('minute'), s: g('second') };
}
const pad = (n: number) => String(n).padStart(2, '0');
function parisToday() {
  const p = parisParts(new Date());
  return { iso: `${p.y}-${pad(p.m)}-${pad(p.d)}`, minutes: p.h * 60 + p.min };
}
function isoPlus(days: number) {
  const [y, m, d] = parisToday().iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function daysBetween(a: string, b: string) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
function parisOffset(d: Date) {
  const p = parisParts(d);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}
function parisToUtc(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - parisOffset(new Date(guess));
  const off2 = parisOffset(new Date(utc));
  utc = guess - off2;
  return new Date(utc);
}

const root = document.querySelector<HTMLElement>('[data-booking]');
const cfgEl = document.getElementById('booking-config');
if (root && cfgEl) init(root, JSON.parse(cfgEl.textContent || '{}') as Config);

function init(root: HTMLElement, cfg: Config) {
  const s = cfg.s;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));

  const form = $<HTMLFormElement>('[data-form]');
  const flow = $('[data-flow]');
  const done = $('[data-done]');
  const steps = $$('[data-step]');
  const segs = $$('[data-seg]');
  const count = $('[data-step-count]');
  const live = $('[data-live]');
  const backBtn = $<HTMLButtonElement>('[data-back]');
  const nextBtn = $<HTMLButtonElement>('[data-next]');
  const nextLabel = $('[data-next-label]');
  const alertBox = $('[data-alert]');
  const alertText = $('[data-alert-text]');
  const alertActions = $('[data-alert-actions]');
  const alertMailto = $<HTMLAnchorElement>('[data-alert-mailto]');
  const honeypot = $<HTMLInputElement>('#website');
  const estBox = $('[data-estimate]');
  const estValue = $('[data-estimate-value]');
  const soonBox = $('[data-soon]');
  const remember = $<HTMLInputElement>('[data-remember]');
  const rememberedBox = $('[data-remembered]');
  const consent = $<HTMLInputElement>('#consent');
  const dateIn = $<HTMLInputElement>('#date');
  const timeIn = $<HTMLInputElement>('#time');
  const chips = $$<HTMLButtonElement>('[data-day]');

  const input = (name: string) => root.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  const val = (name: string) => input(name).value.trim();

  const state = {
    step: 1,
    departure: { label: '' } as Loc,
    destination: { label: '' } as Loc,
    estimate: null as BookingPayload['estimate'],
    passengers: 1,
    luggage: 0,
    sending: false,
    startedAt: 0,
  };
  let last: { ref: string; p: BookingPayload } | null = null;
  const touched = new Set<string>();

  /* ---------- Validation ---------- */
  const stepFields: Record<number, string[]> = {
    1: ['departure', 'destination'],
    2: ['date', 'time'],
    3: [],
    4: ['firstName', 'lastName', 'phone', 'email'],
    5: ['consent'],
  };

  function minutesUntil(): number | null {
    if (!dateIn.value || !timeIn.value) return null;
    const now = parisToday();
    const [hh, mm] = timeIn.value.split(':').map(Number);
    return daysBetween(now.iso, dateIn.value) * 1440 + (hh * 60 + mm) - now.minutes;
  }

  function fieldError(name: string): string | null {
    switch (name) {
      case 'departure':
        return val('departure').length >= 3 ? null : s.errors.departure;
      case 'destination': {
        const v = val('destination');
        if (v.length < 3) return s.errors.destination;
        if (norm(v) === norm(val('departure'))) return s.errors.same;
        return null;
      }
      case 'date': {
        const v = dateIn.value;
        if (!v) return s.errors.date;
        if (v < parisToday().iso) return s.errors.past;
        if (v > isoPlus(365)) return s.errors.tooFar;
        return null;
      }
      case 'time': {
        if (!timeIn.value) return s.errors.time;
        if (dateIn.value && dateIn.value >= parisToday().iso) {
          const m = minutesUntil();
          if (m !== null && m < 0) return s.errors.past;
        }
        return null;
      }
      case 'firstName':
        return val('firstName') ? null : s.errors.firstName;
      case 'lastName':
        return val('lastName') ? null : s.errors.lastName;
      case 'phone':
        return isValidPhone(val('phone')) ? null : s.errors.phone;
      case 'email':
        return EMAIL_RE.test(val('email')) ? null : s.errors.email;
      case 'consent':
        return consent.checked ? null : s.errors.consent;
    }
    return null;
  }

  function showError(name: string, msg: string | null) {
    const el = input(name);
    const wrap = el.closest<HTMLElement>('.field, .check');
    const err = document.getElementById(`${name}-error`);
    wrap?.classList.toggle('is-invalid', !!msg);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) {
      err.textContent = msg ?? '';
      err.classList.toggle('is-shown', !!msg);
    }
  }

  const revalidate = (name: string) => {
    if (touched.has(name)) showError(name, fieldError(name));
  };

  function validateStep(n: number): boolean {
    let first: string | null = null;
    for (const f of stepFields[n]) {
      touched.add(f);
      const e = fieldError(f);
      showError(f, e);
      if (e && !first) first = f;
    }
    if (first) {
      input(first).focus();
      return false;
    }
    return true;
  }

  /* ---------- Navigation entre étapes ---------- */
  function goTo(n: number, focus = true) {
    const dir = n < state.step ? 'back' : 'fwd';
    state.step = n;
    steps.forEach((el) => {
      const on = Number(el.dataset.step) === n;
      el.classList.toggle('is-active', on);
      if (on) el.dataset.dir = dir;
    });
    segs.forEach((el, i) => {
      el.classList.toggle('is-done', i < n - 1);
      el.classList.toggle('is-current', i === n - 1);
      if (i === n - 1) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
    const label = tpl(s.stepOf, { n, total: TOTAL });
    count.textContent = label;
    live.textContent = `${label} : ${s.steps[n - 1]}`;
    backBtn.hidden = n === 1;
    nextLabel.textContent = n === TOTAL ? s.submit : s.next;
    hideAlert();
    if (n === TOTAL) renderSummary();
    if (focus) {
      const top = root.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      }
      steps[n - 1].querySelector<HTMLElement>('.step__title')?.focus({ preventScroll: true });
    }
  }

  backBtn.addEventListener('click', () => {
    if (state.step > 1) goTo(state.step - 1);
  });
  $$<HTMLButtonElement>('[data-goto]').forEach((b) => b.addEventListener('click', () => goTo(Number(b.dataset.goto))));

  /* ---------- Adresses ---------- */
  const placeOpts: Opt[] = cfg.places.map((p) => ({
    kind: 'place',
    main: p.label,
    value: p.label,
    lon: p.lon,
    lat: p.lat,
    icon: p.id === 'lys' ? 'plane' : 'train',
  }));

  function setLoc(kind: Kind, loc: Loc) {
    state[kind] = { ...loc };
    input(kind).value = loc.label;
    input(kind).closest('.addr')?.classList.toggle('is-selected', loc.lon != null);
  }

  function parseFeatures(features: any[]): Opt[] {
    const seen = new Set<string>();
    const out: Opt[] = [];
    for (const f of features) {
      const p = f?.properties ?? {};
      const [lon, lat] = f?.geometry?.coordinates ?? [];
      const city = Array.isArray(p.city) ? p.city[0] : p.city;
      const postcode = Array.isArray(p.postcode) ? p.postcode[0] : p.postcode;
      let main = '';
      let value = '';
      if (p._type === 'poi') {
        main = p.toponym || (Array.isArray(p.name) ? p.name[0] : p.name) || '';
        value = city && !main.includes(city) ? `${main}, ${city}` : main;
      } else {
        main = p.name || p.label || '';
        value = p.label || main;
      }
      if (!main || seen.has(value) || typeof lon !== 'number') continue;
      seen.add(value);
      out.push({ kind: 'result', main, sub: [postcode, city].filter(Boolean).join(' '), value, lon, lat, icon: 'pin' });
    }
    // Priorité aux résultats du Rhône (69), sans masquer les autres : utile tant que la ville n'est pas tapée en entier.
    const local = (o: Opt) => (/^69/.test(o.sub ?? '') ? 0 : 1);
    return out
      .map((o, i) => ({ o, i }))
      .sort((a, b) => local(a.o) - local(b.o) || a.i - b.i)
      .map(({ o }) => o)
      .slice(0, 6);
  }

  function setupAddress(kind: Kind) {
    const el = input(kind);
    const list = $<HTMLUListElement>(`#${kind}-list`);
    let options: Opt[] = [];
    let active = -1;
    let ctrl: AbortController | null = null;
    let timer = 0;

    const open = () => {
      list.hidden = false;
      el.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      list.hidden = true;
      el.setAttribute('aria-expanded', 'false');
      el.removeAttribute('aria-activedescendant');
      active = -1;
    };

    function render(groups: { title?: string; opts: Opt[] }[], emptyMsg?: string) {
      list.replaceChildren();
      options = [];
      active = -1;
      el.removeAttribute('aria-activedescendant');
      for (const g of groups) {
        if (!g.opts.length) continue;
        if (g.title) {
          const li = document.createElement('li');
          li.className = 'addr__group';
          li.setAttribute('role', 'presentation');
          li.textContent = g.title;
          list.append(li);
        }
        for (const o of g.opts) {
          const idx = options.length;
          const li = document.createElement('li');
          li.className = 'addr__option';
          li.id = `${kind}-opt-${idx}`;
          li.setAttribute('role', 'option');
          li.setAttribute('aria-selected', 'false');
          li.innerHTML = `<span class="addr__option-icon">${iconSvg(o.icon)}</span><span class="addr__option-text"><span class="addr__option-main"></span><span class="addr__option-sub"></span></span>`;
          li.querySelector('.addr__option-main')!.textContent = o.main;
          const sub = li.querySelector('.addr__option-sub')!;
          if (o.sub) sub.textContent = o.sub;
          else sub.remove();
          li.addEventListener('pointerdown', (e) => e.preventDefault());
          li.addEventListener('click', () => choose(idx));
          list.append(li);
          options.push(o);
        }
      }
      if (!options.length) {
        if (emptyMsg) {
          const li = document.createElement('li');
          li.className = 'addr__empty';
          li.setAttribute('role', 'presentation');
          li.textContent = emptyMsg;
          list.append(li);
          open();
        } else close();
        return;
      }
      open();
    }

    function setActive(i: number) {
      if (!options.length) return;
      active = (i + options.length) % options.length;
      list.querySelectorAll<HTMLElement>('[role="option"]').forEach((li, j) => {
        li.setAttribute('aria-selected', String(j === active));
        if (j === active) li.scrollIntoView({ block: 'nearest' });
      });
      el.setAttribute('aria-activedescendant', `${kind}-opt-${active}`);
    }

    function showDefaults() {
      const geo: Opt[] =
        kind === 'departure' && 'geolocation' in navigator
          ? [{ kind: 'geo', main: s.myLocation, value: '', icon: 'locate' }]
          : [];
      render([{ opts: geo }, { title: s.places, opts: placeOpts }]);
    }

    async function search(q: string) {
      ctrl?.abort();
      ctrl = new AbortController();
      const local = placeOpts.filter((p) => norm(p.main).includes(norm(q)));
      const params = new URLSearchParams({ q, limit: '10', autocomplete: '1', index: 'address,poi', lat: LYON.lat, lon: LYON.lon });
      try {
        const res = await fetch(`${GEO_SEARCH}?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (el.value.trim() !== q || document.activeElement !== el) return;
        const results = parseFeatures(json.features ?? []).filter((r) => !local.some((l) => norm(l.main) === norm(r.main)));
        render([{ opts: local }, { title: s.suggestions, opts: results }], s.noResult);
        live.textContent = tpl(s.resultsCount, { n: local.length + results.length });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        // Service indisponible : saisie libre, lieux fréquents uniquement.
        if (document.activeElement === el) render([{ opts: local }]);
      }
    }

    function locate() {
      const ph = el.placeholder;
      el.value = '';
      el.placeholder = s.locating;
      const fail = () => {
        el.placeholder = ph;
        touched.add(kind);
        showError(kind, s.locationError);
        el.focus();
      };
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { longitude: lon, latitude: lat } = pos.coords;
          try {
            const params = new URLSearchParams({ lon: String(lon), lat: String(lat), index: 'address', limit: '1' });
            const res = await fetch(`${GEO_REVERSE}?${params}`);
            const j = await res.json();
            const label: string = j?.features?.[0]?.properties?.label ?? '';
            if (!label) return fail();
            el.placeholder = ph;
            setLoc(kind, { label, lon, lat });
            afterChoose();
          } catch {
            fail();
          }
        },
        fail,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    }

    function afterChoose() {
      touched.add(kind);
      showError(kind, fieldError(kind));
      const other: Kind = kind === 'departure' ? 'destination' : 'departure';
      if (touched.has(other)) revalidate(other);
      updateEstimate();
      if (kind === 'departure' && !val('destination')) input('destination').focus();
    }

    function choose(i: number) {
      const o = options[i];
      if (!o) return;
      close();
      if (o.kind === 'geo') return locate();
      setLoc(kind, { label: o.value, lon: o.lon, lat: o.lat });
      afterChoose();
    }

    el.addEventListener('focus', () => {
      if (!el.value.trim()) showDefaults();
    });
    el.addEventListener('click', () => {
      if (!el.value.trim() && list.hidden) showDefaults();
    });
    el.addEventListener('input', () => {
      const q = el.value.trim();
      state[kind] = { label: el.value };
      el.closest('.addr')?.classList.remove('is-selected');
      hideEstimate();
      revalidate(kind);
      window.clearTimeout(timer);
      if (!q) return showDefaults();
      if (q.length < 3) {
        const local = placeOpts.filter((p) => norm(p.main).includes(norm(q)));
        return local.length ? render([{ opts: local }]) : close();
      }
      timer = window.setTimeout(() => search(q), 220);
    });
    el.addEventListener('keydown', (e) => {
      if (list.hidden) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!el.value.trim()) showDefaults();
          else if (el.value.trim().length >= 3) search(el.value.trim());
        }
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActive(active + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActive(active - 1);
          break;
        case 'Enter':
          if (active >= 0) {
            e.preventDefault();
            choose(active);
          } else close();
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
        case 'Tab':
          close();
          break;
      }
    });
    el.addEventListener('blur', () => {
      window.setTimeout(close, 0);
      if (el.value.trim()) {
        touched.add(kind);
        showError(kind, fieldError(kind));
      }
    });
  }

  setupAddress('departure');
  setupAddress('destination');

  $('[data-swap]').addEventListener('click', () => {
    const a = state.departure;
    setLoc('departure', state.destination);
    setLoc('destination', a);
    revalidate('departure');
    revalidate('destination');
    updateEstimate();
  });

  /* ---------- Estimation (distance et durée indicatives, jamais de prix) ---------- */
  let estCtrl: AbortController | null = null;
  function hideEstimate() {
    estCtrl?.abort();
    state.estimate = null;
    estBox.hidden = true;
  }
  async function updateEstimate() {
    const a = state.departure;
    const b = state.destination;
    estCtrl?.abort();
    if (a.lon == null || b.lon == null || (a.lon === b.lon && a.lat === b.lat)) {
      state.estimate = null;
      estBox.hidden = true;
      return;
    }
    const ctrl = new AbortController();
    estCtrl = ctrl;
    const timeout = window.setTimeout(() => ctrl.abort(), 8000);
    const params = new URLSearchParams({
      resource: 'bdtopo-osrm',
      profile: 'car',
      optimization: 'fastest',
      start: `${a.lon},${a.lat}`,
      end: `${b.lon},${b.lat}`,
      distanceUnit: 'kilometer',
      timeUnit: 'minute',
      getSteps: 'false',
      getBbox: 'false',
    });
    try {
      const res = await fetch(`${ROUTE_API}?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      const km = Number(j.distance);
      const minutes = Number(j.duration);
      if (!(km > 0) || !(minutes > 0)) throw new Error('empty');
      state.estimate = { km, minutes };
      estValue.textContent = `≈ ${formatKm(km, cfg.locale)} km · ${formatDuration(minutes)}`;
      estBox.hidden = false;
    } catch {
      if (estCtrl === ctrl) {
        state.estimate = null;
        estBox.hidden = true;
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  /* ---------- Date et heure ---------- */
  dateIn.min = isoPlus(0);
  dateIn.max = isoPlus(365);
  const syncChips = () =>
    chips.forEach((c) => c.setAttribute('aria-pressed', String(dateIn.value === isoPlus(Number(c.dataset.day)))));
  const checkSoon = () => {
    const m = minutesUntil();
    soonBox.hidden = !(m !== null && m >= 0 && m < 120);
  };
  const onWhenChange = () => {
    syncChips();
    revalidate('date');
    revalidate('time');
    checkSoon();
  };
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      dateIn.value = isoPlus(Number(c.dataset.day));
      touched.add('date');
      onWhenChange();
      if (!timeIn.value) timeIn.focus();
    }),
  );
  dateIn.addEventListener('input', onWhenChange);
  dateIn.addEventListener('change', () => {
    touched.add('date');
    onWhenChange();
  });
  timeIn.addEventListener('input', onWhenChange);
  timeIn.addEventListener('change', () => {
    touched.add('time');
    onWhenChange();
  });

  /* ---------- Passagers et bagages ---------- */
  $$('[data-counter]').forEach((c) => {
    const key = c.dataset.counter as 'passengers' | 'luggage';
    const min = Number(c.dataset.min);
    const max = Number(c.dataset.max);
    const out = c.querySelector('output')!;
    const [dec, inc] = Array.from(c.querySelectorAll<HTMLButtonElement>('[data-delta]'));
    const set = (v: number, delta = 0) => {
      const next = Math.min(max, Math.max(min, v));
      state[key] = next;
      out.textContent = String(next);
      const focused = document.activeElement;
      dec.disabled = next <= min;
      inc.disabled = next >= max;
      if (focused === dec && dec.disabled) inc.focus();
      if (focused === inc && inc.disabled) dec.focus();
      if (delta) {
        out.style.setProperty('--bump', delta > 0 ? '6px' : '-6px');
        out.classList.remove('is-bump');
        void out.offsetWidth;
        out.classList.add('is-bump');
      }
    };
    [dec, inc].forEach((btn) =>
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.delta);
        set(state[key] + delta, delta);
      }),
    );
    (c as HTMLElement & { reset?: () => void }).reset = () => set(min);
  });

  /* ---------- Coordonnées ---------- */
  ['firstName', 'lastName', 'phone', 'email'].forEach((name) => {
    const el = input(name);
    el.addEventListener('input', () => revalidate(name));
    el.addEventListener('blur', () => {
      if (name === 'phone' && isValidPhone(el.value)) el.value = prettyPhone(el.value);
      if (el.value.trim()) {
        touched.add(name);
        showError(name, fieldError(name));
      }
    });
  });
  consent.addEventListener('change', () => {
    touched.add('consent');
    showError('consent', fieldError('consent'));
  });

  const contactKeys = ['firstName', 'lastName', 'phone', 'email'] as const;
  function loadContact() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const c = JSON.parse(raw) as Record<string, unknown>;
      contactKeys.forEach((k) => {
        if (typeof c[k] === 'string') input(k).value = c[k] as string;
      });
      remember.checked = true;
      rememberedBox.hidden = false;
    } catch {
      /* stockage indisponible : on ignore */
    }
  }
  function saveContact() {
    try {
      if (remember.checked) {
        const data = Object.fromEntries(contactKeys.map((k) => [k, val(k)]));
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } else localStorage.removeItem(STORE_KEY);
    } catch {
      /* stockage indisponible */
    }
  }
  $('[data-forget]').addEventListener('click', () => {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
    contactKeys.forEach((k) => {
      input(k).value = '';
      showError(k, null);
      touched.delete(k);
    });
    remember.checked = false;
    rememberedBox.hidden = true;
    input('firstName').focus();
  });
  loadContact();

  /* ---------- Récapitulatif ---------- */
  const plural = (n: number, one: string, many: string, none?: string) =>
    tpl(n === 0 && none ? none : n === 1 ? one : many, { n });
  const whenText = (p: { date: string; time: string }) =>
    `${cap(longDate(p.date, cfg.locale))} ${s.summary.at} ${p.time}`;
  const partyText = (p: { passengers: number; luggage: number }) =>
    `${plural(p.passengers, s.passengersOne, s.passengersMany)} · ${plural(p.luggage, s.luggageOne, s.luggageMany, s.luggageNone)}`;

  function renderSummary() {
    const set = (k: string, v: string) => {
      const el = root.querySelector<HTMLElement>(`[data-sum="${k}"]`);
      if (!el) return;
      el.textContent = v;
      el.hidden = !v;
    };
    set('departure', val('departure'));
    set('destination', val('destination'));
    set('estimate', state.estimate ? `≈ ${formatKm(state.estimate.km, cfg.locale)} km · ${formatDuration(state.estimate.minutes)} — ${s.estimateNote}` : '');
    set('when', dateIn.value && timeIn.value ? whenText({ date: dateIn.value, time: timeIn.value }) : '');
    set('party', partyText(state));
    set('name', `${val('firstName')} ${val('lastName')}`.trim());
    set('reach', [val('phone'), val('email')].filter(Boolean).join(' · '));
    set('message', val('message'));
    $('[data-sum-group="message"]').hidden = !val('message');
  }

  /* ---------- Envoi ---------- */
  form.addEventListener('input', () => {
    if (!state.startedAt) state.startedAt = Date.now();
  }, { once: false });

  function hideAlert() {
    alertBox.hidden = true;
  }
  function showAlert(msg: string, withActions: boolean, mailto?: string) {
    alertText.textContent = msg;
    alertActions.hidden = !withActions;
    if (mailto) alertMailto.href = mailto;
    alertBox.hidden = false;
  }
  function setSending(on: boolean) {
    state.sending = on;
    root.classList.toggle('is-sending', on);
    nextBtn.setAttribute('aria-busy', String(on));
    nextBtn.setAttribute('aria-disabled', String(on));
    nextLabel.textContent = on ? s.sending : state.step === TOTAL ? s.submit : s.next;
  }

  const payload = (): BookingPayload => ({
    lang: cfg.lang,
    departure: val('departure'),
    destination: val('destination'),
    date: dateIn.value,
    time: timeIn.value,
    passengers: state.passengers,
    luggage: state.luggage,
    firstName: val('firstName'),
    lastName: val('lastName'),
    phone: prettyPhone(val('phone')),
    email: val('email'),
    message: val('message'),
    estimate: state.estimate ? { km: Math.round(state.estimate.km * 10) / 10, minutes: Math.round(state.estimate.minutes) } : null,
    requestedAt: new Date().toISOString(),
  });

  const mailtoUrl = (p: BookingPayload, ref: string) =>
    `mailto:${cfg.email}?subject=${encodeURIComponent(bookingSubject(p))}&body=${encodeURIComponent(bookingText(p, ref))}`;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.sending) return;

    if (state.step < TOTAL) {
      if (validateStep(state.step)) goTo(state.step + 1);
      return;
    }

    // Vérification complète avant envoi : on renvoie vers la première étape incomplète.
    for (let i = 1; i < TOTAL; i++) {
      if (stepFields[i].some((f) => fieldError(f))) {
        goTo(i);
        validateStep(i);
        return;
      }
    }
    if (!validateStep(TOTAL)) return;

    const p = payload();

    // Robot détecté (champ invisible rempli) : on simule un succès sans rien envoyer.
    if (honeypot.value) {
      showDone(makeReference(), p, 'sent', false);
      return;
    }

    if (!cfg.endpoint) {
      const ref = makeReference();
      saveContact();
      window.location.href = mailtoUrl(p, ref);
      showDone(ref, p, 'mailto', false);
      return;
    }

    setSending(true);
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, website: honeypot.value, elapsed: state.startedAt ? Date.now() - state.startedAt : 0 }),
        signal: ctrl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reference?: string; acknowledged?: boolean };
      if (!res.ok || !data.ok) throw new Error('send');
      saveContact();
      showDone(data.reference || makeReference(), p, 'sent', !!data.acknowledged);
    } catch {
      showAlert(s.errors.send, true, mailtoUrl(p, makeReference()));
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  });

  /* ---------- Confirmation ---------- */
  function showDone(ref: string, p: BookingPayload, mode: 'sent' | 'mailto', acknowledged: boolean) {
    last = { ref, p };
    const set = (k: string, v: string) => {
      const el = root.querySelector<HTMLElement>(`[data-done="${k}"]`);
      if (el) el.textContent = v;
    };
    set('ref', ref);
    set('departure', p.departure);
    set('destination', p.destination);
    set('date', cap(longDate(p.date, cfg.locale)));
    set('time', p.time);
    $('[data-done-title]').textContent = mode === 'mailto' ? s.done.mailtoTitle : s.done.title;
    $('[data-done-text]').hidden = mode !== 'mailto';
    $('[data-mailto-retry]').hidden = mode !== 'mailto';
    $('[data-done-ack]').hidden = !acknowledged;
    flow.hidden = true;
    done.hidden = false;
    const top = root.getBoundingClientRect().top;
    if (top < 0) root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    done.focus({ preventScroll: true });
  }

  $('[data-mailto-retry]').addEventListener('click', () => {
    if (last) window.location.href = mailtoUrl(last.p, last.ref);
  });

  $('[data-ics]').addEventListener('click', () => {
    if (!last) return;
    const { ref, p } = last;
    const start = parisToUtc(p.date, p.time);
    const minutes = p.estimate ? Math.max(15, Math.round(p.estimate.minutes)) : 30;
    const end = new Date(start.getTime() + minutes * 60000);
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const fold = (line: string) => {
      const out: string[] = [];
      for (let i = 0; i < line.length; i += 72) out.push(line.slice(i, i + 72));
      return out.join('\r\n ');
    };
    const desc = [
      `${s.done.ref} : ${ref}`,
      `${s.departure} : ${p.departure}`,
      `${s.destination} : ${p.destination}`,
      partyText(p),
      '',
      s.done.driver,
      `${cfg.siteName} — ${cfg.phone}`,
    ].join('\n');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Taxi Saint Irenee//Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${ref}@taxi-saint-irenee`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(s.done.calendarTitle)}`,
      `LOCATION:${esc(p.departure)}`,
      `DESCRIPTION:${esc(desc)}`,
      'STATUS:TENTATIVE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(s.done.calendarTitle)}`,
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(fold)
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `taxi-saint-irenee-${ref}.ics`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const shareLabel = $('[data-share-label]');
  $('[data-share]').addEventListener('click', async () => {
    if (!last) return;
    const { ref, p } = last;
    const text = [
      s.done.shareTitle,
      `${s.done.ref} : ${ref} (${s.done.status.toLowerCase()})`,
      `${s.departure} : ${p.departure}`,
      `${s.destination} : ${p.destination}`,
      whenText(p),
    ].join('\n');
    if (navigator.share) {
      try {
        await navigator.share({ title: s.done.shareTitle, text });
      } catch {
        /* partage annulé */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      shareLabel.textContent = s.done.copied;
      window.setTimeout(() => (shareLabel.textContent = s.done.share), 2200);
    } catch {
      /* presse-papiers indisponible */
    }
  });

  $('[data-new]').addEventListener('click', () => {
    setLoc('departure', { label: '' });
    setLoc('destination', { label: '' });
    hideEstimate();
    dateIn.value = '';
    timeIn.value = '';
    syncChips();
    soonBox.hidden = true;
    input('message').value = '';
    consent.checked = false;
    $$('[data-counter]').forEach((c) => (c as HTMLElement & { reset?: () => void }).reset?.());
    if (!remember.checked) contactKeys.forEach((k) => (input(k).value = ''));
    touched.clear();
    root.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    root.querySelectorAll('.field__error').forEach((el) => {
      el.textContent = '';
      el.classList.remove('is-shown');
    });
    state.startedAt = 0;
    last = null;
    done.hidden = true;
    flow.hidden = false;
    goTo(1);
  });

  /* ---------- Accès rapide depuis les boutons "Réserver" ---------- */
  document.addEventListener('tsi:book', () => {
    if (!flow.hidden && state.step === 1 && window.matchMedia('(pointer: fine)').matches) {
      input('departure').focus({ preventScroll: true });
    } else if (!flow.hidden) {
      steps[state.step - 1].querySelector<HTMLElement>('.step__title')?.focus({ preventScroll: true });
    }
  });

  /* ---------- Reflet du verre : suit discrètement le pointeur ---------- */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced()) {
    let raf = 0;
    root.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = root.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        root.style.setProperty('--mx', `${(18 + (x - 50) * 0.35).toFixed(1)}%`);
        root.style.setProperty('--my', `${(y * 0.25).toFixed(1)}%`);
      });
    });
    root.addEventListener('pointerleave', () => {
      root.style.removeProperty('--mx');
      root.style.removeProperty('--my');
    });
  }
}
