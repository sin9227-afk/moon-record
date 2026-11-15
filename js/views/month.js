/* 월간 뷰 */
import {
  monthMatrix, weekdayLabels, WEEK, daysInMonth, todayISO, esc, shapeMark,
  isoOf, parseISO, TYPE_LABEL,
} from '../util.js';
import { store } from '../store.js';
import { navState, openDay, refresh } from '../nav.js';
import { expandRange } from '../repeat.js';
import { isHoliday, holidayNames, shortHoliday } from '../holidays.js';
import { lunarShort } from '../lunar.js';
import { ddayOccurrencesInRange } from '../dday.js';

export function mountMonth(root) {
  const s = store.settings;
  const { year, month } = navState;
  const cells = monthMatrix(year, month, s.weekStart);
  const occ = expandRange(store.entries, cells[0], cells[41]);
  const dds = ddayOccurrencesInRange(store.ddays, cells[0], cells[41]);
  const labels = weekdayLabels(s.weekStart);
  const today = todayISO();

  const items = [];
  for (const iso of cells) for (const it of occ.get(iso) || []) items.push({ iso, ...it });
  const monthItems = items.filter((it) => Number(it.iso.slice(0, 4)) === year && Number(it.iso.slice(5, 7)) === month);
  const diaries = monthItems.filter((it) => it.entry.type === 'diary').length;
  const schedules = monthItems.filter((it) => it.entry.type !== 'diary').length;
  const quoteLine = (s.motto && s.motto.trim()) || (s.showQuote ? s.quote : '');

  root.innerHTML = `
    <div class="scroll month-scroll">
      <header class="m-head">
        ${quoteLine ? `<div class="m-quote">${quoteLine.trim().split('\n').map(esc).join('<br>')}</div>` : '<div class="m-quote"></div>'}
        <div class="m-titlebar">
          <button class="nav-arrow" data-act="prev-month" aria-label="이전 달">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.6 5.4 8 12l6.6 6.6"/></svg>'}</button>
          <button class="m-title" data-act="go-today-month" aria-label="이번 달">
            <span class="year">${year}</span>
            <span class="month">${month}<em>월</em></span>
          </button>
          <button class="nav-arrow" data-act="next-month" aria-label="다음 달">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.4 5.4 16 12l-6.6 6.6"/></svg>'}</button>
        </div>
        <div class="m-tools">
          <button class="pill-btn" data-act="go-today-month">오늘</button>
          <button class="pill-btn" data-act="open-today">일간 보기</button>
        </div>
      </header>

      <div class="weekdays">
        ${labels.map((w) => `<span class="${w === 0 ? 'sun' : w === 6 ? 'sat' : ''}">${WEEK[w]}</span>`).join('')}
      </div>

      <div class="grid-wrap">
        <div class="grid ${s.showGrid ? 'lines' : ''}" id="monthGrid">
          ${cells.map((iso) => cellHTML(iso, year, month, occ, dds, today, s)).join('')}
        </div>
      </div>

      <div class="m-foot">
        <span>이번 달 <b style="color:var(--ink-2)">${monthItems.length}</b>개의 기록</span>
        <span class="dotsep">·</span>
        <span>일기 ${diaries} · 일정 ${schedules}</span>
      </div>
    </div>`;

  const grid = root.querySelector('#monthGrid');

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'prev-month' || act === 'next-month') {
      const dir = act === 'prev-month' ? -1 : 1;
      const idx = year * 12 + (month - 1) + dir;
      navState.year = Math.floor(idx / 12);
      navState.month = (idx % 12) + 1;
      refresh();
    } else if (act === 'go-today-month') {
      const now = new Date();
      navState.year = now.getFullYear();
      navState.month = now.getMonth() + 1;
      refresh();
    } else if (act === 'open-today') {
      openDay(todayISO());
    } else if (act === 'open-day') {
      openDay(t.dataset.date);
    }
  });

  // 좌우 스와이프로 달 이동
  let sx = 0, sy = 0, tracking = false;
  grid.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const dir = dx < 0 ? 1 : -1;
    const idx = navState.year * 12 + (navState.month - 1) + dir;
    navState.year = Math.floor(idx / 12);
    navState.month = (idx % 12) + 1;
    refresh();
  }, { passive: true });
}

function cellHTML(iso, year, month, occ, dds, today, s) {
  const d = Number(iso.slice(8));
  const isoY = Number(iso.slice(0, 4));
  const isoM = Number(iso.slice(5, 7));
  const inMonth = isoY === year && isoM === month;
  const w = new Date(isoY, isoM - 1, d).getDay();
  const hol = isHoliday(iso);
  const list = [...(occ.get(iso) || [])];
  list.sort((a, b) => (a.entry.time || '99:99').localeCompare(b.entry.time || '99:99'));

  const cls = ['cell'];
  if (!inMonth) cls.push('out');
  if (hol) cls.push('holiday');
  else if (w === 0) cls.push('sun');
  else if (w === 6) cls.push('sat');
  if (iso === today) cls.push('today');
  if (navState.view === 'day' && iso === navState.day) cls.push('sel');

  const shown = list.slice(0, s.calScale === 'lg' ? 1 : 2);
  const chips = shown.map((it) => {
    const e = it.entry;
    const title = (e.title && e.title.trim()) || '무제';
    return `<span class="ev c-${e.color || 'accent'}">${shapeMark(e.shape || 'circle', e.color || 'accent')}<i>${esc(title)}</i></span>`;
  }).join('');
  const more = list.length > shown.length ? `<span class="ev-more">+${list.length - shown.length}</span>` : '';
  const dd = (dds.get(iso) || [])[0];

  return `
    <button class="${cls.join(' ')}" data-act="open-day" data-date="${iso}" ${!inMonth ? 'tabindex="-1"' : ''}>
      ${dd ? '<span class="dday-badge"></span>' : ''}
      <span class="top">
        <span class="num">${d}</span>
        ${s.showLunar ? `<span class="lunar">${lunarShort(iso)}</span>` : ''}
      </span>
      ${hol && s.showHolidayName ? `<span class="hol-name">${esc(shortHoliday(iso))}</span>` : ''}
      <span class="marks">${chips}${more}</span>
    </button>`;
}
