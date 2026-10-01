/**
 * Génère l'identité visuelle : logos SVG (texte vectorisé), favicon,
 * icônes PWA et images Open Graph.
 *
 *   npm run brand
 *
 * Les fichiers produits sont versionnés dans public/ : ce script n'est à relancer
 * que si l'identité change. Dépendances de développement : opentype.js, sharp.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => path.join(root, 'public', p);
const font = async (rel) => {
  const buf = await readFile(path.join(root, 'node_modules', rel));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};

const INK = '#0c0c0d';
const PAPER = '#f5f4f0';
const MUTED = '#646468';

const geist600 = await font('@fontsource/geist/files/geist-latin-600-normal.woff');
const geist500 = await font('@fontsource/geist/files/geist-latin-500-normal.woff');
const geist400 = await font('@fontsource/geist/files/geist-latin-400-normal.woff');
const serifItalic = await font('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff');

/** Texte → chemin SVG, avec approche (tracking) en em et crénage. */
function textPath(f, text, x, y, size, tracking = 0) {
  const scale = size / f.unitsPerEm;
  const glyphs = f.stringToGlyphs(text);
  let cx = x;
  let d = '';
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    const kern = i < glyphs.length - 1 ? f.getKerningValue(g, glyphs[i + 1]) : 0;
    cx += (g.advanceWidth + kern) * scale + (i < glyphs.length - 1 ? tracking * size : 0);
  });
  return { d, width: cx - x };
}
const measure = (f, text, size, tracking = 0) => textPath(f, text, 0, 0, size, tracking).width;
const capHeight = (f, size) => ((f.tables.os2?.sCapHeight || f.unitsPerEm * 0.7) / f.unitsPerEm) * size;

/* ---------- Monogramme : la confluence ---------- */
const STROKES = 'M13 20.5C24 20.5 28.5 32 36.5 32M13 43.5C24 43.5 28.5 32 36.5 32H51';
const mark = ({ bg = INK, fg = PAPER, rx = 18, size = 64, inset = 0 } = {}) => {
  const s = (64 - inset * 2) / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rx}" fill="${bg}"/>
  <g transform="translate(${inset} ${inset}) scale(${s})"><path d="${STROKES}" fill="none" stroke="${fg}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;
};
const markGroup = (x, y, size, { bg = INK, fg = PAPER } = {}) =>
  `<g transform="translate(${x} ${y}) scale(${size / 64})"><rect width="64" height="64" rx="18" fill="${bg}"/><path d="${STROKES}" fill="none" stroke="${fg}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;

/* ---------- Logos ---------- */
function logoHorizontal({ ink = INK, paper = PAPER } = {}) {
  const size = 22;
  const tracking = 0.16;
  const word = 'TAXI SAINT IRÉNÉE';
  const markSize = 64;
  const gap = 20;
  const ch = capHeight(geist600, size);
  const baseline = markSize / 2 + ch / 2;
  const t = textPath(geist600, word, markSize + gap, baseline, size, tracking);
  const w = Math.ceil(markSize + gap + t.width + 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${markSize}" width="${w}" height="${markSize}" role="img" aria-label="Taxi Saint Irénée">
  ${markGroup(0, 0, markSize, { bg: ink, fg: paper })}
  <path d="${t.d}" fill="${ink}"/>
</svg>`;
}

function logoStacked({ ink = INK, paper = PAPER, muted = MUTED } = {}) {
  const markSize = 64;
  const gap = 18;
  const s1 = 12;
  const s2 = 21;
  const t1 = textPath(geist500, 'TAXI', markSize + gap, 26, s1, 0.32);
  const t2 = textPath(geist600, 'SAINT IRÉNÉE', markSize + gap, 26 + 8 + capHeight(geist600, s2), s2, 0.16);
  const w = Math.ceil(markSize + gap + Math.max(t1.width, t2.width) + 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${markSize}" width="${w}" height="${markSize}" role="img" aria-label="Taxi Saint Irénée">
  ${markGroup(0, 0, markSize, { bg: ink, fg: paper })}
  <path d="${t1.d}" fill="${muted}"/>
  <path d="${t2.d}" fill="${ink}"/>
</svg>`;
}

/* ---------- Image Open Graph ---------- */
function ogImage(lang) {
  const W = 1200;
  const H = 630;
  const pad = 80;
  const lines = Array.from({ length: 9 }, (_, i) => {
    const dx = i * 13;
    const ex = 980 + i * 3.5;
    return `M${700 + dx} -20 C${690 + dx} 120 ${860 + dx} 170 ${840 + dx * 0.8} 290 S${940 + dx * 0.4} 470 ${ex} 560 L${ex} 660`;
  })
    .concat(
      Array.from({ length: 9 }, (_, j) => {
        const dy = j * 13;
        const ex = 1015 + j * 3.5;
        return `M1240 ${70 + dy} C1120 ${100 + dy} 1080 ${240 + dy} 1040 ${330 + dy * 0.7} S${1020 + j * 2} 480 ${ex} 560 L${ex} 660`;
      }),
    )
    .map((d) => `<path d="${d}"/>`)
    .join('');

  const brand = textPath(geist600, 'TAXI SAINT IRÉNÉE', pad + 64 + 18, pad + 32 + capHeight(geist600, 17) / 2, 17, 0.16);
  const titleA = lang === 'fr' ? 'Votre trajet à Lyon,' : 'Your ride in Lyon,';
  const titleB = lang === 'fr' ? 'simplement.' : 'made simple.';
  const footer = lang === 'fr' ? 'Depuis 2014  ·  Lyon et sa région  ·  06 61 88 27 07' : 'Since 2014  ·  Lyon and region  ·  +33 6 61 88 27 07';
  const a = textPath(geist500, titleA, pad, 330, 80, -0.04);
  const b = textPath(serifItalic, titleB, pad, 430, 100, -0.01);
  const f = textPath(geist400, footer, pad, H - pad, 22, 0.01);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g" cx="85%" cy="10%" r="70%"><stop offset="0" stop-color="#8a6f4d" stop-opacity=".16"/><stop offset="1" stop-color="#8a6f4d" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <g fill="none" stroke="${INK}" stroke-opacity=".12" stroke-width="1.2">${lines}</g>
  ${markGroup(pad, pad, 64)}
  <path d="${brand.d}" fill="${INK}"/>
  <path d="${a.d}" fill="${INK}"/>
  <path d="${b.d}" fill="${INK}"/>
  <path d="${f.d}" fill="${MUTED}"/>
</svg>`;
}

/* ---------- Écriture ---------- */
await mkdir(pub('brand'), { recursive: true });

const files = {
  'favicon.svg': mark({ rx: 16 }),
  'brand/mark.svg': mark(),
  'brand/mark-light.svg': mark({ bg: PAPER, fg: INK }),
  'brand/logo.svg': logoHorizontal(),
  'brand/logo-light.svg': logoHorizontal({ ink: PAPER, paper: INK }),
  'brand/logo-mobile.svg': logoStacked(),
  'brand/logo-mobile-light.svg': logoStacked({ ink: PAPER, paper: INK, muted: '#9d9ca1' }),
};
for (const [name, svg] of Object.entries(files)) await writeFile(pub(name), svg + '\n');

const png = (svg, size, out) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(pub(out));
await png(mark({ rx: 16 }), 32, 'favicon-32.png');
await png(mark({ rx: 0, inset: 6 }), 180, 'apple-touch-icon.png');
await png(mark(), 192, 'icon-192.png');
await png(mark(), 512, 'icon-512.png');
await png(mark({ rx: 0, inset: 14 }), 512, 'icon-maskable-512.png');

for (const lang of ['fr', 'en']) {
  await sharp(Buffer.from(ogImage(lang))).png({ compressionLevel: 9 }).toFile(pub(`og-${lang}.png`));
}

console.log('Identité générée dans public/ :', Object.keys(files).join(', '), '+ PNG');
