/* 일간 뷰 */
import {
  todayISO, isoAddDays, esc, fmtTime, fmtTimeShort, weekdayOf, WEEK_FULL, parseISO,
  ICON, relativeLabel,
} from '../util.js';
import { store } from '../store.js';
import { navState, go, openDay, refresh, openEditor } from '../nav.js';
import { occursOn, expandRange, isRepeating, repeatSummary } from '../repeat.js';
import { holidayNames } from '../holidays.js';
import { lunarLabel, ganjiOf, moonPhase } from '../lunar.js';
import { ddayOccurrencesInRange, ddayInfo } from '../dday.js';
import { entryCardHTML, moonSVG } from '../ui.js';

export function mountDay(root) {
  const s = store.settings;
  const date = navState.day;
  const dt = parseISO(date);
  const entries = store.entries
    .filter((e) => occursOn(e, date))
    .sort((a, b) => {
      const at = a.time || '00:00', bt = b.time || '00:00';
      if (!a.time !== !b.time) return a.time ? 1 : -1;
      return at.localeCompare(bt) || String(a.created || '').localeCompare(String(b.created || ''));
    });

  const dds = ddayOccurrencesInRange(store.ddays, date, date).get(date) || [];
  const hol = holidayNames(date);
  const week = Math.floor((dt - new Date(dt.getFullYear(), 0, 1, 12)) / 86400000 / 7) + 1;
  const phase = moonPhase(date);
  const rel = relativeLabel(date);

  const photosAll = entries.flatMap((e) => e.photos || []);

  const prevDate = isoAddDays(date, -1);
  const nextDate = isoAddDays(date, 1);
  const lastMonth = (() => { const d = new Date(dt); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const lastYear = `${dt.getFullYear() - 1}-${date.slice(5)}`;
  const pastLinks = [['한 달 전 오늘', lastMonth], ['1년 전 오늘', lastYear]]
    .map(([label, iso]) => ({ label, iso, count: store.entries.filter((e) => occursOn(e, iso)).length }))
    .filter((x) => x.count > 0);

  root.innerHTML = `
    <div class="scroll">
      <header class="d-head">
        <button class="back" data-act="to-month" aria-label="월간 보기">${ICON.chevLeft}</button>
        <div class="d-title">
          <div class="big">${dt.getMonth() + 1}월</div>
          <div class="sub">${dt.getFullYear()} · ${WEEK_FULL[weekdayOf(date)]}${rel ? ` · ${rel}` : ''}</div>
        </div>
        <button class="more" data-act="go-today" aria-label="오늘로">${ICON.calendar}</button>
      </header>

      <section class="d-hero">
        <button class="nav-arrow" data-act="prev-day" aria-label="이전 날">${ICON.chevLeft}</button>
        <span class="daynum">${String(dt.getDate()).padStart(2, '0')}</span>
        <div class="meta">
          <div class="lunar">${s.showLunar ? esc(lunarLabel(date)) : ''}</div>
          <div class="week">${week}주차 · ${ganjiOf(date) || ''}</div>
          ${hol.length ? `<div class="holiday">${esc(hol.join(' · '))}</div>` : ''}
        </div>
        <span class="moon-glyph">${moonSVG(phase)}</span>
        <button class="nav-arrow" data-act="next-day" aria-label="다음 날">${ICON.chevRight}</button>
      </section>

      <div class="d-body">
        ${dds.length ? dds.map((d) => {
          const info = ddayInfo(d, date);
          return `<div class="dday-banner">
            <span style="width:14px;height:14px;color:var(--gold);display:inline-flex">${ICON.dday}</span>
            <b>${esc(d.title || '디데이')}</b>
            <span class="num">${info.label}</span>
          </div>`;
        }).join('') : ''}

        ${entries.length ? renderEntries(entries, date, s) : `
          <div class="d-empty">
            <div class="moon-art">${moonSVG(0.18)}</div>
            <p>아직 이 날의 기록이 없어요.<br>작은 한 줄도 오래 남습니다.</p>
          </div>`}

        <button class="add-inline" data-act="add-here">${ICON.plus}<span>이 날의 기록 남기기</span></button>

        ${pastLinks.length ? `
          <div class="past-links">
            ${pastLinks.map((p) => `<button class="pill-btn" data-act="open-day" data-date="${p.iso}">${p.label} · ${p.count}</button>`).join('')}
          </div>` : ''}
      </div>
    </div>`;

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'to-month') { navState.year = dt.getFullYear(); navState.month = dt.getMonth() + 1; go('month'); }
    else if (act === 'go-today') { const now = new Date(); navState.year = now.getFullYear(); navState.month = now.getMonth() + 1; openDay(todayISO()); }
    else if (act === 'prev-day') openDay(prevDate);
    else if (act === 'next-day') openDay(nextDate);
    else if (act === 'open-day') openDay(t.dataset.date);
    else if (act === 'add-here') openEditor(null, { date });
    else if (act === 'edit-entry') {
      const entry = store.getEntry(t.dataset.id);
      if (entry) openEditor(entry, { date: t.dataset.date || date });
    } else if (act === 'view-photo') {
      const ids = (t.dataset.ids || '').split(',').filter(Boolean);
      import('../ui.js').then((m) => m.openViewer(ids, Number(t.dataset.index) || 0));
    }
  });

  // 좌우 스와이프로 날짜 이동
  let sx = 0, sy = 0, tracking = false;
  const body = root.querySelector('.d-body');
  body.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  body.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (dx < 0) openDay(nextDate); else openDay(prevDate);
  }, { passive: true });
}

function renderEntries(entries, date, s) {
  const style = s.dayStyle || 'card';
  const div = s.showDividers === false ? ' no-dividers' : '';

  if (style === 'chip') {
    return `<div class="timeline chip-list${div}">${entries.map((e) => `
      <div class="tl-row">
        <span class="tl-time ${e.time ? '' : 'all'}">${e.time ? esc(fmtTimeShort(e.time)) : '종일'}</span>
        <div class="tl-card">${entryCardHTML(e, date, { variant: 'chip' })}</div>
      </div>`).join('')}</div>`;
  }

  if (style === 'timeline') {
    return `<div class="timeline${div}">${entries.map((e, i) => `
      <div class="tl-row">
        <span class="tl-time ${e.time ? '' : 'all'}">${e.time ? esc(fmtTime(e.time)) : '종일'}</span>
        <div class="tl-dot"></div>
        <div class="tl-card">${entryCardHTML(e, date, { variant: 'card' })}</div>
      </div>`).join('')}</div>`;
  }

  return `<div class="card-list${div}">${entries.map((e) => `
    <div class="card-row">
      ${e.time ? `<div class="card-time">${esc(fmtTime(e.time))}</div>` : ''}
      ${entryCardHTML(e, date, { variant: 'card' })}
    </div>`).join('')}</div>`;
}
