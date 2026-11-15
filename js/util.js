/* 공통 유틸 — 날짜, DOM, 아이콘, 토스트 */

export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const WEEK_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const DAY_MS = 86400000;

export const pad2 = (n) => String(n).padStart(2, '0');

export function isoOf(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }

export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function todayISO() {
  const n = new Date();
  return isoOf(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export function isoAddDays(s, n) {
  const dt = parseISO(s);
  dt.setDate(dt.getDate() + n);
  return isoOf(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function isoAddMonths(y, m, n) { // m: 1-12 → {y, m}
  const idx = (y * 12 + (m - 1)) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
export function weekdayOf(s) { return parseISO(s).getDay(); }
export function diffDays(a, b) { // b - a in days
  return Math.round((parseISO(b) - parseISO(a)) / DAY_MS);
}
export function monthsDiff(aISO, bISO) {
  const a = parseISO(aISO), b = parseISO(bISO);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
export function yearsBetween(y1, y2) { return y2 - y1; }

/** month matrix: 6 weeks of ISO strings */
export function monthMatrix(y, m, weekStart = 0) {
  const first = isoOf(y, m, 1);
  const lead = (weekdayOf(first) - weekStart + 7) % 7;
  const start = isoAddDays(first, -lead);
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(isoAddDays(start, i));
  return cells;
}

export function weekdayLabels(weekStart = 0) {
  return Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hh}:${pad2(m)}`;
}

export function fmtTimeShort(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? '오' : '오'} ${hh}:${pad2(m)}`;
}

export function relativeLabel(isoStr) {
  const d = diffDays(todayISO(), isoStr);
  if (d === 0) return '오늘';
  if (d === 1) return '내일';
  if (d === -1) return '어제';
  if (d === 2) return '모레';
  return '';
}

export function fmtDateLong(isoStr) {
  const dt = parseISO(isoStr);
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일`;
}

export function fmtDateShort(isoStr) {
  const dt = parseISO(isoStr);
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일`;
}

let toastTimer = null;
export function toast(msg) {
  const box = document.getElementById('toast');
  if (!box) return;
  box.textContent = msg;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 1900);
}

/* ---------- 아이콘 ---------- */
const S = (inner, stroke = true) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const ICON = {
  calendar: S('<rect x="3.2" y="4.6" width="17.6" height="15.8" rx="3"/><path d="M8 2.8v3.4M16 2.8v3.4M3.2 9.4h17.6"/>'),
  search: S('<circle cx="11" cy="11" r="6.6"/><path d="M16 16l4.2 4.2"/>'),
  nib: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2.4c2.7 3.3 4.7 6.9 4.7 10.1 0 3.3-2 6.3-4.7 9.1-2.7-2.8-4.7-5.8-4.7-9.1 0-3.2 2-6.8 4.7-10.1Z"/><circle cx="12" cy="9.1" r="1.55"/><path d="M12 10.7v8.4"/></svg>`,
  dday: S('<path d="M6 3.4v17.2"/><path d="M6 4.6h11.6l-2.6 4 2.6 4H6"/>'),
  settings: S('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.1"/><circle cx="8" cy="17" r="2.1"/>'),
  chevLeft: S('<path d="M14.6 5.4 8 12l6.6 6.6"/>'),
  chevRight: S('<path d="M9.4 5.4 16 12l-6.6 6.6"/>'),
  chevDown: S('<path d="M5.6 9.2 12 15.6l6.4-6.4"/>'),
  close: S('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  trash: S('<path d="M4.6 6.6h14.8M9.4 6.6V4.4h5.2v2.2M6.4 6.6l.8 13h9.6l.8-13"/>'),
  camera: S('<path d="M3.4 8.6h3.2l1.4-2h8l1.4 2h3.2v10H3.4z"/><circle cx="12" cy="13.4" r="3.2"/>'),
  image: S('<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.6"/><circle cx="8.6" cy="9.6" r="1.6"/><path d="m4.2 17.4 5-4.6 3.4 3 2.6-2.2 4.6 4"/>'),
  check: S('<path d="m4.6 12.4 4.4 4.4 10-10.4"/>'),
  location: S('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>'),
  repeat: S('<path d="M4 9.4A5.4 5.4 0 0 1 9.4 4H18"/><path d="m15.4 1.8 2.8 2.2-2.8 2.2"/><path d="M20 14.6a5.4 5.4 0 0 1-5.4 5.4H6"/><path d="m8.6 22.2-2.8-2.2 2.8-2.2"/>'),
  moon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 2.6a9.6 9.6 0 1 0 4.4 14.2A8.2 8.2 0 0 1 16.4 2.6Z"/></svg>`,
  star: S('<path d="m12 3.4 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.8l6.1-.8Z"/>'),
  heart: S('<path d="M12 20.4S3.6 15.2 3.6 9.6A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.4 3c0 5.6-8.4 10.8-8.4 10.8Z"/>'),
  circle: S('<circle cx="12" cy="12" r="7.2"/>'),
  triangle: S('<path d="M12 3.8 21 19.6H3z"/>'),
  diamond: S('<path d="M12 2.8 21.2 12 12 21.2 2.8 12z"/>'),
  square: S('<rect x="4.6" y="4.6" width="14.8" height="14.8" rx="2.6"/>'),
  list: S('<path d="M8 6.4h12M8 12h12M8 17.6h12"/><circle cx="4.2" cy="6.4" r="1"/><circle cx="4.2" cy="12" r="1"/><circle cx="4.2" cy="17.6" r="1"/>'),
  download: S('<path d="M12 3.6v11.2M7.6 10.6 12 15l4.4-4.4M4.6 18.6h14.8"/>'),
  upload: S('<path d="M12 15.4V4.2M7.6 8.4 12 4l4.4 4.4M4.6 18.6h14.8"/>'),
  pen: S('<path d="M4.4 19.6l1-4.2L16.2 4.6a2.2 2.2 0 0 1 3.2 3.2L8.6 18.6z"/><path d="M14.6 6.2l3.2 3.2"/>'),
  note: S('<rect x="4.4" y="3.6" width="15.2" height="16.8" rx="2.8"/><path d="M8.2 8.6h7.6M8.2 12.4h7.6M8.2 16.2h4.4"/>'),
  book: S('<path d="M4 4.6c3-.9 5.4-.6 8 1.2v14c-2.6-1.8-5-2.1-8-1.2z"/><path d="M20 4.6c-3-.9-5.4-.6-8 1.2v14c2.6-1.8 5-2.1 8-1.2z"/>'),
  more: S('<circle cx="5.6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.4" cy="12" r="1.5" fill="currentColor" stroke="none"/>'),
  quote: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 6C6.4 7.4 4.6 10 4.6 13.2c0 2.8 1.5 4.8 3.9 4.8 2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3.3-3-3.3-.3 0-.7 0-.9.1.3-1.6 1.7-3 3.6-3.8L9.4 6Zm9 0c-3 1.4-4.8 4-4.8 7.2 0 2.8 1.5 4.8 3.9 4.8 2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3.3-3-3.3-.3 0-.7 0-.9.1.3-1.6 1.7-3 3.6-3.8L18.4 6Z"/></svg>',
  cloud: S('<path d="M7 18.4a4 4 0 0 1 .4-8 5.6 5.6 0 0 1 10.7 1.6 3.4 3.4 0 0 1-.8 6.4z"/>'),
  spinner: S('<path d="M12 3.6a8.4 8.4 0 1 0 8.4 8.4"/>'),
};

export const SHAPES = ['circle', 'star', 'heart', 'check', 'triangle', 'diamond', 'moon', 'square'];
export const SHAPE_LABEL = { circle: '원', star: '별', heart: '하트', check: '체크', triangle: '세모', diamond: '다이아', moon: '달', square: '네모' };
export const COLORS = ['accent', 'rose', 'sage', 'amber', 'sky', 'sand'];
export const COLOR_LABEL = { accent: '테마', rose: '로즈', sage: '세이지', amber: '앰버', sky: '스카이', sand: '샌드' };

/** 12x12 viewBox shape used for small indicators */
export function shapeMark(shape, color) {
  const paths = {
    circle: '<circle cx="6" cy="6" r="4.4" fill="currentColor"/>',
    star: '<path d="M6 .9 7.6 4l3.5.4-2.6 2.4.7 3.4L6 8.5 2.8 10.2l.7-3.4L.9 4.4 4.4 4z" fill="currentColor"/>',
    heart: '<path d="M6 11S1 8 1 4.6A2.8 2.8 0 0 1 6 2.8a2.8 2.8 0 0 1 5 1.8C11 8 6 11 6 11Z" fill="currentColor"/>',
    check: '<path d="M1.6 6.2 4.4 9 10.4 2.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    triangle: '<path d="M6 1.4 11 10.6H1z" fill="currentColor"/>',
    diamond: '<path d="M6 .9 11.1 6 6 11.1.9 6z" fill="currentColor"/>',
    moon: '<path d="M8.6 1a5.1 5.1 0 1 0 2.3 7.6A4.3 4.3 0 0 1 8.6 1Z" fill="currentColor"/>',
    square: '<rect x="1.6" y="1.6" width="8.8" height="8.8" rx="1.6" fill="currentColor"/>',
  };
  return `<svg class="mark c-${color}" viewBox="0 0 12 12" aria-hidden="true">${paths[shape] || paths.circle}</svg>`;
}

/** 큰 아이콘 (선택기·카드용) */
export function shapeIcon(shape) {
  const map = { circle: ICON.circle, star: ICON.star, heart: ICON.heart, check: ICON.check, triangle: ICON.triangle, diamond: ICON.diamond, moon: ICON.moon, square: ICON.square };
  return map[shape] || ICON.circle;
}

export const TYPE_LABEL = { schedule: '일정', diary: '일기', both: '기록' };
export const TYPE_ICON = { schedule: ICON.calendar, diary: ICON.note, both: ICON.book };
