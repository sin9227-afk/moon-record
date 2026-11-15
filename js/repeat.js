/* 반복 일정 계산 (양력·음력) */
import { diffDays, monthsDiff, weekdayOf, daysInMonth, isoAddDays } from './util.js';
import { solarToLunarISO } from './lunar.js';

export const FREQ_LABEL = { none: '반복 없음', daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년' };

export function lunarBaseOf(entry) { return solarToLunarISO(entry.date); }

export function repeatSummary(entry) {
  const r = entry.repeat || {};
  if (!r.freq || r.freq === 'none') return '';
  const n = Math.max(1, Number(r.interval) || 1);
  const every = n > 1 ? `${n}${r.freq === 'daily' ? '일' : r.freq === 'weekly' ? '주' : r.freq === 'monthly' ? '개월' : '년'}마다` : FREQ_LABEL[r.freq];
  let out = every;
  if (r.freq === 'weekly') {
    const days = (r.weekdays && r.weekdays.length) ? r.weekdays : [weekdayOf(entry.date)];
    const names = ['일', '월', '화', '수', '목', '금', '토'];
    out += ' · ' + days.slice().sort().map((d) => names[d]).join('·');
  }
  if (r.freq === 'yearly' && r.calendar === 'lunar') {
    const b = lunarBaseOf(entry);
    if (b) out += ` · 음력 ${b.isLeap ? '윤' : ''}${b.m}월 ${b.d}일`;
  }
  if (r.until) out += ` · ${r.until.slice(0, 4)}.${r.until.slice(5, 7)}.${r.until.slice(8, 10)}까지`;
  return out;
}

export function isRepeating(entry) { return !!(entry.repeat && entry.repeat.freq && entry.repeat.freq !== 'none'); }

function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

/** 해당 날짜에 이 기록이 나타나는가 */
export function occursOn(entry, date) {
  if (entry.exdates && entry.exdates.includes(date)) return false;
  const r = entry.repeat || {};
  if (!r.freq || r.freq === 'none') return date === entry.date;
  if (date < entry.date) return false;
  if (r.until && date > r.until) return false;
  const interval = Math.max(1, Number(r.interval) || 1);

  switch (r.freq) {
    case 'daily':
      return diffDays(entry.date, date) % interval === 0;
    case 'weekly': {
      const days = (r.weekdays && r.weekdays.length) ? r.weekdays : [weekdayOf(entry.date)];
      if (!days.includes(weekdayOf(date))) return false;
      const baseWeek = isoAddDays(entry.date, -weekdayOf(entry.date));
      const thisWeek = isoAddDays(date, -weekdayOf(date));
      const weeks = Math.round(diffDays(baseWeek, thisWeek) / 7);
      return weeks >= 0 && weeks % interval === 0;
    }
    case 'monthly': {
      const md = monthsDiff(entry.date, date);
      if (md < 0 || md % interval !== 0) return false;
      const baseDay = Number(entry.date.slice(8, 10));
      const dim = daysInMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
      return Number(date.slice(8, 10)) === Math.min(baseDay, dim);
    }
    case 'yearly': {
      if (r.calendar === 'lunar') {
        const b = lunarBaseOf(entry);
        const l = solarToLunarISO(date);
        if (!b || !l) return false;
        if (l.m !== b.m || l.d !== b.d || !!l.isLeap !== !!b.isLeap) return false;
        const yrs = l.y - b.y;
        return yrs >= 0 && yrs % interval === 0;
      }
      const md = entry.date.slice(5);
      if (md === '02-29') {
        const y = Number(date.slice(0, 4));
        const okDay = isLeapYear(y) ? '02-29' : '02-28';
        if (date.slice(5) !== okDay) return false;
      } else if (date.slice(5) !== md) return false;
      const yrs = Number(date.slice(0, 4)) - Number(entry.date.slice(0, 4));
      return yrs >= 0 && yrs % interval === 0;
    }
    default:
      return false;
  }
}

/** 기간 내 발생 날짜 목록 */
export function occurrencesIn(entry, startISO, endISO) {
  if (entry.date > endISO) return [];
  if (entry.repeat?.until && entry.repeat.until < startISO) return [];
  if (!isRepeating(entry)) return (entry.date >= startISO && entry.date <= endISO) ? [entry.date] : [];
  const out = [];
  let d = startISO < entry.date ? entry.date : startISO;
  let guard = 0;
  while (d <= endISO && guard++ < 800) {
    if (occursOn(entry, d)) out.push(d);
    d = isoAddDays(d, 1);
  }
  return out;
}

/** 기간 내 모든 기록 펼치기: Map<date, [{entry, date}]> */
export function expandRange(entries, startISO, endISO) {
  const map = new Map();
  for (const entry of entries) {
    for (const date of occurrencesIn(entry, startISO, endISO)) {
      if (!map.has(date)) map.set(date, []);
      map.get(date).push({ entry, date, repeated: isRepeating(entry) });
    }
  }
  return map;
}

/** 다음 발생일 (편집 미리보기) */
export function nextOccurrence(entry, fromISO) {
  if (!isRepeating(entry)) return entry.date >= fromISO ? entry.date : null;
  let d = entry.date >= fromISO ? entry.date : fromISO;
  for (let i = 0; i < 1500; i++) {
    if (occursOn(entry, d)) return d;
    d = isoAddDays(d, 1);
    if (entry.repeat?.until && d > entry.repeat.until) return null;
  }
  return null;
}
