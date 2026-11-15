/* 디데이 계산 */
import { diffDays, todayISO, isoAddDays, weekdayOf, WEEK, parseISO } from './util.js';
import { solarToLunarISO, lunarISO } from './lunar.js';

export function ddayNext(dday, from = todayISO()) {
  if (!dday.repeat || dday.repeat === 'none') return dday.date;
  if (dday.calendar === 'lunar') {
    const base = solarToLunarISO(dday.date);
    if (!base) return dday.date;
    let ly = solarToLunarISO(from)?.y ?? Number(from.slice(0, 4));
    for (let i = 0; i < 3; i++) {
      const iso = lunarISO(ly + i, base.m, base.d, base.isLeap) || lunarISO(ly + i, base.m, base.d, false);
      if (iso && iso >= from) return iso;
    }
    return dday.date;
  }
  const md = dday.date.slice(5);
  const y = Number(from.slice(0, 4));
  let cand = `${y}-${md}`;
  if (md === '02-29' && !isLeap(y)) cand = `${y}-02-28`;
  if (cand < from) {
    const ny = y + 1;
    cand = md === '02-29' && !isLeap(ny) ? `${ny}-02-28` : `${ny}-${md}`;
  }
  return cand;
}

function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

export function ddayInfo(dday, from = todayISO()) {
  const next = ddayNext(dday, from);
  const days = diffDays(from, next);
  let label;
  if (days === 0) label = 'D-DAY';
  else if (days > 0) label = `D-${days}`;
  else label = `D+${-days}`;
  return { next, days, label, passed: days < 0 };
}

/** 기간 내 디데이 날짜 */
export function ddayOccurrencesInRange(ddays, startISO, endISO) {
  const map = new Map();
  const push = (iso, d) => {
    if (iso >= startISO && iso <= endISO) {
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso).push(d);
    }
  };
  for (const d of ddays) {
    if (!d.repeat || d.repeat === 'none') { push(d.date, d); continue; }
    const startYear = Number(startISO.slice(0, 4));
    const endYear = Number(endISO.slice(0, 4));
    for (let y = startYear - 1; y <= endYear + 1; y++) {
      if (d.calendar === 'lunar') {
        const base = solarToLunarISO(d.date);
        if (!base) continue;
        const iso = lunarISO(y, base.m, base.d, base.isLeap) || lunarISO(y, base.m, base.d, false);
        if (iso) push(iso, d);
      } else {
        const md = d.date.slice(5);
        const iso = md === '02-29' && !isLeap(y) ? `${String(y).padStart(4, '0')}-02-28` : `${String(y).padStart(4, '0')}-${md}`;
        push(iso, d);
      }
    }
  }
  return map;
}

export function fmtDdayDate(dday) {
  const dt = parseISO(dday.date);
  const base = `${dt.getFullYear()}. ${dt.getMonth() + 1}. ${dt.getDate()}.`;
  if (dday.calendar === 'lunar') {
    const l = solarToLunarISO(dday.date);
    return l ? `${base} (음력 ${l.isLeap ? '윤' : ''}${l.m}. ${l.d}.)` : base;
  }
  return base;
}
