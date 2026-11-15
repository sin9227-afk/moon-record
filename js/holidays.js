/* 대한민국 공휴일 (양력·음력·대체공휴일) */
import { lunarISO } from './lunar.js';

const FIXED = [
  [1, 1, '신정'], [3, 1, '삼일절'], [5, 5, '어린이날'], [6, 6, '현충일'],
  [8, 15, '광복절'], [10, 3, '개천절'], [10, 9, '한글날'], [12, 25, '기독탄신일'],
];
// 2026년 4월 관공서 공휴일 규정 개정으로 노동절·제헌절이 공휴일이 됨
const FIXED_NEW = [[5, 1, '노동절'], [7, 17, '제헌절']];

const ELECTIONS = {
  '2020-04-15': '국회의원 선거',
  '2022-03-09': '대통령 선거',
  '2022-06-01': '지방선거',
  '2024-04-10': '국회의원 선거',
  '2025-06-03': '대통령 선거',
  '2026-06-03': '지방선거',
};

const SUB_TARGETS = new Set(['삼일절', '어린이날', '부처님오신날', '광복절', '개천절', '한글날', '기독탄신일', '노동절', '제헌절']);

const yearCache = new Map();
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const serial = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const fromSerial = (n) => { const t = new Date(n * 86400000); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
const dow = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

function buildYear(y) {
  const map = new Map(); // iso -> [names]
  const add = (s, name) => {
    if (!s) return;
    const cur = map.get(s) || [];
    if (!cur.includes(name)) cur.push(name);
    map.set(s, cur);
  };

  for (const [m, d, name] of FIXED) add(iso(y, m, d), name);
  if (y >= 2026) for (const [m, d, name] of FIXED_NEW) add(iso(y, m, d), name);

  const sul = lunarISO(y, 1, 1);
  const groups = [];
  if (sul) {
    const arr = [-1, 0, 1].map((n) => fromSerial(serial(sul) + n));
    groups.push({ name: '설날', days: arr });
    arr.forEach((s, i) => add(s, i === 1 ? '설날' : '설날 연휴'));
  }
  const chu = lunarISO(y, 8, 15);
  if (chu) {
    const arr = [-1, 0, 1].map((n) => fromSerial(serial(chu) + n));
    groups.push({ name: '추석', days: arr });
    arr.forEach((s, i) => add(s, i === 1 ? '추석' : '추석 연휴'));
  }
  const bud = lunarISO(y, 4, 8);
  if (bud) add(bud, '부처님오신날');

  for (const [s, name] of Object.entries(ELECTIONS)) if (s.startsWith(`${y}-`)) add(s, name);

  // 대체공휴일
  const isHoliday = (s) => map.has(s);
  const isWeekend = (s) => { const w = dow(s); return w === 0 || w === 6; };
  const isSunday = (s) => dow(s) === 0;
  const findNextFree = (fromISO) => {
    let n = serial(fromISO) + 1;
    for (let i = 0; i < 40; i++) {
      const s = fromSerial(n);
      if (!isHoliday(s) && !isWeekend(s)) return s;
      n++;
    }
    return null;
  };

  // 설·추석 연휴: 일요일 또는 다른 공휴일과 겹칠 때만, 연휴 뒤 첫 평일 하루
  for (const g of groups) {
    const overlap = g.days.some((s) => isSunday(s) || (map.get(s) || []).some((nm) => !nm.startsWith(g.name)));
    if (!overlap) continue;
    const next = findNextFree(g.days[g.days.length - 1]);
    if (next) add(next, `대체공휴일(${g.name})`);
  }

  // 단일 공휴일: 토·일요일 또는 다른 공휴일과 겹칠 때
  const singleDates = [...map.keys()].filter((s) => {
    const names = map.get(s) || [];
    return names.some((n) => SUB_TARGETS.has(n));
  }).sort();

  for (const s of singleDates) {
    const names = map.get(s) || [];
    if (names.some((n) => n.startsWith('대체공휴일'))) continue;
    const overlaps = names.filter((n) => !n.startsWith('대체공휴일')).length > 1;
    if (!isWeekend(s) && !overlaps) continue; // 평일 단독 공휴일은 그대로
    const next = findNextFree(s);
    if (next) add(next, `대체공휴일(${names.filter((n) => !n.startsWith('대체공휴일')).join('·')})`);
  }

  // 이름 정리: 대체공휴일이 원 공휴일과 같은 날이면 제거
  return map;
}

function cacheOf(y) {
  if (!yearCache.has(y)) yearCache.set(y, buildYear(y));
  return yearCache.get(y);
}

export function holidayNames(isoStr) {
  const y = Number(isoStr.slice(0, 4));
  const map = cacheOf(y);
 return map.get(isoStr) || (isoStr.slice(5) === '01-01' ? ['신정'] : []);
}

export function holidayName(isoStr) {
  const names = holidayNames(isoStr);
  return names.length ? names[0] : '';
}

export function isHoliday(isoStr) { return holidayNames(isoStr).length > 0; }

const SHORT = {
  '신정': '신정', '설날': '설날', '설날 연휴': '설날', '추석': '추석', '추석 연휴': '추석',
  '삼일절': '삼일절', '어린이날': '어린이날', '현충일': '현충일', '광복절': '광복절',
  '개천절': '개천절', '한글날': '한글날', '기독탄신일': '성탄절', '부처님오신날': '부처님',
  '노동절': '노동절', '제헌절': '제헌절', '국회의원 선거': '선거일', '대통령 선거': '선거일',
  '지방선거': '선거일',
};

/** 달력 칸에 넣을 짧은 공휴일 이름 */
export function shortHoliday(isoStr) {
  const names = holidayNames(isoStr);
  if (!names.length) return '';
  const n = names[0];
  if (n.startsWith('대체공휴일(')) return '대체';
  return SHORT[n] || n.replace(' 연휴', '');
}

export function isRedDay(isoStr) {
  return isHoliday(isoStr) || dow(isoStr) === 0;
}

export function dayColorClass(isoStr, weekStart = 0) {
  const w = dow(isoStr);
  if (isHoliday(isoStr)) return 'holiday';
  if (w === 0) return 'sun';
  if (w === 6) return 'sat';
  return '';
}
