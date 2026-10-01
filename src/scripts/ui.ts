/**
 * Interactions globales : navbar, menu mobile, apparitions au scroll,
 * barre d'actions mobile, langue, service worker.
 * Aucune bibliothèque : quelques centaines d'octets suffisent.
 */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LANG_KEY = 'tsi.lang';
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* stockage indisponible */
    }
  },
};

/* ---------- Navbar : plus opaque après le début du défilement ---------- */
const header = document.querySelector<HTMLElement>('[data-header]');
if (header) {
  let ticking = false;
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 12);
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

/* ---------- Menu mobile ---------- */
const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
if (menuBtn && menu) {
  const label = menuBtn.querySelector('[data-menu-label]')!;
  const setOpen = (open: boolean, restoreFocus = true) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? menuBtn.dataset.labelClose! : menuBtn.dataset.labelOpen!;
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    if (open) menu.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
    else if (restoreFocus) menuBtn.focus({ preventScroll: true });
  };
  menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('[data-menu-link]').forEach((a) => a.addEventListener('click', () => setOpen(false, false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('is-open')) return;
    const t = e.target as Node;
    if (!menu.contains(t) && !menuBtn.contains(t)) setOpen(false, false);
  });
  window.matchMedia('(min-width: 64rem)').addEventListener('change', (m) => {
    if (m.matches) setOpen(false, false);
  });
}

/* ---------- Boutons "Réserver" : défilement vers le panneau + focus utile ---------- */
document.querySelectorAll<HTMLAnchorElement>('a[data-book]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const hash = a.hash;
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (!target || a.pathname.replace(/\/$/, '') !== location.pathname.replace(/\/$/, '')) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', hash);
    window.setTimeout(() => document.dispatchEvent(new CustomEvent('tsi:book')), reduced() ? 0 : 450);
  });
});

/* ---------- Apparitions au scroll ---------- */
const revealables = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window && !reduced()) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  revealables.forEach((el) => io.observe(el));
} else {
  revealables.forEach((el) => el.classList.add('is-in'));
}

/* ---------- Lien actif dans la navigation ---------- */
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'));
if (navLinks.length && 'IntersectionObserver' in window) {
  const byId = new Map(navLinks.map((a) => [a.dataset.navLink!, a]));
  const sections = Array.from(byId.keys())
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);
  const visible = new Set<string>();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => (en.isIntersecting ? visible.add(en.target.id) : visible.delete(en.target.id)));
      const current = sections.find((s) => visible.has(s.id))?.id;
      navLinks.forEach((a) => {
        const on = a.dataset.navLink === current;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => io.observe(s));
}

/* ---------- Barre d'actions mobile : visible seulement quand elle est utile ---------- */
const bar = document.querySelector<HTMLElement>('[data-action-bar]');
if (bar && 'IntersectionObserver' in window) {
  const watched = ['hero-actions', 'contact-actions'].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  const booking = document.querySelector<HTMLElement>('[data-booking]');
  if (booking) watched.push(booking);
  const footer = document.querySelector<HTMLElement>('.site-footer');
  const inView = new Set<Element>();
  const update = () => bar.classList.toggle('is-visible', inView.size === 0);
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => (en.isIntersecting ? inView.add(en.target) : inView.delete(en.target)));
      update();
    },
    { threshold: 0 },
  );
  watched.forEach((el) => io.observe(el));
  if (footer) io.observe(footer);
  if (!watched.length) update();
}

/* ---------- Langue : choix explicite mémorisé, suggestion discrète ---------- */
document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]').forEach((a) =>
  a.addEventListener('click', () => store.set(LANG_KEY, a.dataset.langLink!)),
);
const toast = document.querySelector<HTMLElement>('[data-lang-toast]');
if (toast && !store.get(LANG_KEY)) {
  const pageLang = document.documentElement.lang;
  const prefersFr = (navigator.languages?.length ? navigator.languages : [navigator.language]).some((l) =>
    l.toLowerCase().startsWith('fr'),
  );
  const browserLang = prefersFr ? 'fr' : 'en';
  if (browserLang !== pageLang && toast.dataset.langToast === browserLang) {
    window.setTimeout(() => (toast.hidden = false), 1200);
    toast.querySelector('[data-lang-dismiss]')?.addEventListener('click', () => {
      store.set(LANG_KEY, pageLang);
      toast.hidden = true;
    });
  }
}

/* ---------- PWA : service worker (production uniquement) ---------- */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL.replace(/\/?$/, '/')}sw.js`).catch(() => {});
  });
}
