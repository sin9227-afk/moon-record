/* 화면 공통 요소 — 테마, 시트, 사진 뷰어, 기록 카드 */
import { esc, ICON, shapeMark, shapeIcon, TYPE_LABEL, TYPE_ICON, fmtTime, fmtDateShort, weekdayOf, WEEK, parseISO, toast } from './util.js';
export { toast };
import { store } from './store.js';
import { holidayNames } from './holidays.js';
import { repeatSummary, isRepeating } from './repeat.js';
import { lunarLabel } from './lunar.js';

/* ---------- 테마 ---------- */
export function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme() {
  const s = store.settings;
  const theme = resolveTheme(s.theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = s.accent || 'violet';
  document.body.classList.toggle('scale-sm', s.calScale === 'sm');
  document.body.classList.toggle('scale-lg', s.calScale === 'lg');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#121016' : '#f4f1ea');
}

/* ---------- 시트 ---------- */
const sheetStack = [];

export function showSheet(node, { small = false, onClose = null, dismissible = true } = {}) {
  const depth = sheetStack.length;
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.style.zIndex = String(60 + depth * 2);
  node.classList.add('sheet');
  if (small) node.classList.add('small');
  node.style.zIndex = String(61 + depth * 2);
  document.body.append(backdrop, node);
  document.body.style.overflow = 'hidden';

  const entry = { node, backdrop, closed: false };
  const close = (result) => {
    if (entry.closed) return;
    entry.closed = true;
    node.classList.add('closing');
    backdrop.style.transition = 'opacity .2s';
    backdrop.style.opacity = '0';
    setTimeout(() => {
      node.remove();
      backdrop.remove();
      const i = sheetStack.indexOf(entry);
      if (i >= 0) sheetStack.splice(i, 1);
      if (!sheetStack.length) document.body.style.overflow = '';
      if (onClose) onClose(result);
    }, 210);
  };
  entry.close = close;
  sheetStack.push(entry);
  if (dismissible) backdrop.addEventListener('click', () => close());
  return entry;
}

export function closeTopSheet() {
  const top = sheetStack[sheetStack.length - 1];
  if (top) top.close();
  return !!top;
}

export function hasOpenSheet() { return sheetStack.length > 0; }

export function confirmDialog({ title = '확인', message = '', ok = '확인', cancel = '취소', danger = false } = {}) {
  return new Promise((resolve) => {
    const node = document.createElement('div');
    node.innerHTML = `
      <div class="sheet-head"><span class="grab"></span><h2>${esc(title)}</h2></div>
      <div class="sheet-body"><div class="confirm-body">${message}</div></div>
      <div class="sheet-foot">
        <button class="btn btn-ghost" data-no>${esc(cancel)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(ok)}</button>
      </div>`;
    const h = showSheet(node, { small: true, onClose: () => resolve(false) });
    node.querySelector('[data-yes]').addEventListener('click', () => { resolve(true); h.close(); });
    node.querySelector('[data-no]').addEventListener('click', () => h.close());
  });
}

export function chooseDialog({ title = '선택', message = '', options = [] } = {}) {
  return new Promise((resolve) => {
    const node = document.createElement('div');
    node.innerHTML = `
      <div class="sheet-head"><span class="grab"></span><h2>${esc(title)}</h2></div>
      <div class="sheet-body">
        ${message ? `<div class="confirm-body" style="padding-bottom:10px">${message}</div>` : ''}
        <div class="card">
          ${options.map((o, i) => `<button class="row tap" data-opt="${i}"><span class="r-label">${esc(o.label)}</span>${o.sub ? `<span class="r-value">${esc(o.sub)}</span>` : ''}</button>`).join('')}
        </div>
      </div>
      <div class="sheet-foot"><button class="btn btn-ghost" data-no style="flex:1">취소</button></div>`;
    const h = showSheet(node, { small: true, onClose: () => resolve(null) });
    node.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
      const v = options[Number(b.dataset.opt)]?.value;
      resolve(v);
      h.close();
    }));
    node.querySelector('[data-no]').addEventListener('click', () => h.close());
  });
}

/* ---------- 사진 뷰어 ---------- */
export function openViewer(ids, start = 0) {
  if (!ids || !ids.length) return;
  let index = Math.max(0, Math.min(start, ids.length - 1));
  let zoomed = false;

  const root = document.createElement('div');
  root.className = 'viewer';
  root.innerHTML = `
    <div class="v-head">
      <button data-close aria-label="닫기">${ICON.close}</button>
      <span class="v-count"></span>
      <button data-actual aria-label="원본 크기">${ICON.image}</button>
    </div>
    <div class="v-stage">
      <button class="v-nav left" data-prev aria-label="이전 사진">${ICON.chevLeft}</button>
      <img alt="첨부 사진" />
      <button class="v-nav right" data-next aria-label="다음 사진">${ICON.chevRight}</button>
    </div>
    <div class="v-foot">좌우로 넘겨 사진을 볼 수 있어요</div>`;
  document.body.appendChild(root);

  const img = root.querySelector('img');
  const counter = root.querySelector('.v-count');
  const navL = root.querySelector('[data-prev]');
  const navR = root.querySelector('[data-next]');

  const draw = () => {
    img.src = store.photoURL(ids[index]);
    counter.textContent = ids.length > 1 ? `${index + 1} / ${ids.length}` : '';
    navL.style.display = index > 0 ? '' : 'none';
    navR.style.display = index < ids.length - 1 ? '' : 'none';
    zoomed = false;
    img.style.transform = 'none';
  };
  draw();

  const close = () => { root.remove(); };
  root.querySelector('[data-close]').addEventListener('click', close);
  root.querySelector('[data-actual]').addEventListener('click', () => {
    zoomed = !zoomed;
    img.style.transform = zoomed ? 'scale(1.9)' : 'none';
  });
  navL.addEventListener('click', (e) => { e.stopPropagation(); if (index > 0) { index--; draw(); } });
  navR.addEventListener('click', (e) => { e.stopPropagation(); if (index < ids.length - 1) { index++; draw(); } });
  img.addEventListener('click', () => { zoomed = !zoomed; img.style.transform = zoomed ? 'scale(1.9)' : 'none'; });

  let sx = 0, sy = 0, moved = false;
  root.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false; }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) moved = true;
    if (moved && !zoomed) img.style.transform = `translateX(${dx * 0.4}px)`;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (!zoomed) {
      if (moved && dx < -50 && index < ids.length - 1) { index++; draw(); }
      else if (moved && dx > 50 && index > 0) { index--; draw(); }
      else { img.style.transform = 'none'; }
    }
  });
  return { close };
}

/* ---------- 기록 카드 ---------- */
export function entryCardHTML(entry, dateISO, { variant = 'card' } = {}) {
  const cfg = store.settings || {};
  const showPhotos = cfg.showPhotosInList !== false;
  const showDone = cfg.showDoneInList !== false;
  const color = entry.color || 'accent';
  const shape = entry.shape || 'circle';
  const title = entry.title && entry.title.trim() ? entry.title : '무제';
  const isUntitled = !(entry.title && entry.title.trim());
  const checks = entry.checklist || [];
  const done = checks.filter((c) => c.done).length;
  const photos = entry.photos || [];
  const tags = entry.tags || [];
  const repeat = repeatSummary(entry);
  const rep = isRepeating(entry);

  if (variant === 'chip') {
    return `
      <button class="entry-chip c-${color}" data-act="edit-entry" data-id="${esc(entry.id)}" data-date="${esc(dateISO)}">
        <span class="chip-shape">${shapeMark(shape, color)}</span>
        <span class="chip-title ${isUntitled ? 'untitled' : ''}">${esc(title)}</span>
        ${photos.length ? `<span class="chip-badge">${ICON.image}<i>${photos.length}</i></span>` : ''}
        ${checks.length ? `<span class="chip-badge">${ICON.check}<i>${done}/${checks.length}</i></span>` : ''}
        ${rep ? `<span class="chip-badge">${ICON.repeat}</span>` : ''}
      </button>`;
  }

  return `
    <button class="entry-card ${entry.type === 'diary' ? 'diary' : ''} c-${color}" data-act="edit-entry" data-id="${esc(entry.id)}" data-date="${esc(dateISO)}">
      <div class="ec-top">
        ${shapeMark(shape, color)}
        <span class="ec-kind">${TYPE_LABEL[entry.type] || '기록'}</span>
        ${rep ? `<span class="ec-kind" style="display:inline-flex;align-items:center;gap:3px;color:var(--ink-3)"><span style="width:11px;height:11px;display:inline-flex">${ICON.repeat}</span></span>` : ''}
      </div>
      <div class="ec-title ${isUntitled ? 'untitled' : ''}">${esc(title)}</div>
      ${entry.place ? `<div class="ec-place">${ICON.location}<span>${esc(entry.place)}</span></div>` : ''}
      ${entry.body && entry.body.trim() ? `<div class="ec-body">${esc(entry.body)}</div>` : ''}
      ${tags.length ? `<div class="ec-tags">${tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      ${photos.length && showPhotos ? `<div class="ec-thumbs">${photos.slice(0, 4).map((pid) => `<img src="${store.thumbURL(pid)}" alt="" loading="lazy" data-act="view-photo" data-ids="${esc(photos.join(','))}" data-index="${photos.indexOf(pid)}">`).join('')}${photos.length > 4 ? `<span class="more-photos">+${photos.length - 4}</span>` : ''}</div>` : ''}
      ${checks.length ? `
        <div class="check-progress" style="color:var(--${color === 'accent' ? 'accent' : color})">
          <span class="bar"><i style="width:${checks.length ? Math.round((done / checks.length) * 100) : 0}%"></i></span>
          <span class="txt">${done}/${checks.length}</span>
        </div>
        ${(() => {
          const visible = showDone ? checks : checks.filter((c) => !c.done);
          if (!visible.length) return '';
          return `<div class="mini-checks">
            ${visible.slice(0, 4).map((c) => `<span class="mini-check ${c.done ? 'done' : ''}"><span class="box">${ICON.check}</span>${esc(c.text)}</span>`).join('')}
            ${visible.length > 4 ? `<span class="mini-check" style="opacity:.6">외 ${visible.length - 4}개</span>` : ''}
          </div>`;
        })()}` : ''}
      ${repeat ? `<div class="ec-foot"><span class="ec-kind" style="display:inline-flex;gap:4px;align-items:center"><span style="width:11px;height:11px;display:inline-flex">${ICON.repeat}</span>${esc(repeat)}</span></div>` : ''}
    </button>`;
}

/* ---------- 달의 위상 ---------- */
export function moonSVG(phase = 0.5) {
  const p = ((phase % 1) + 1) % 1;
  const r = 9, cx = 12, cy = 12;
  let lit = p <= 0.5 ? p * 2 : (1 - p) * 2;
  if (lit < 0.08) lit = 0.08; // 삭(朔)에도 가는 달빛 한 줄은 남긴다
  const waxing = p <= 0.5;
  const disc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" opacity=".1" stroke="currentColor" stroke-opacity=".3" stroke-width=".6"/>`;
  if (lit > 0.97) return `<svg viewBox="0 0 24 24"><circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor"/></svg>`;

  const a = r * (1 - 2 * lit); // >0: 초승달, <0: 차오른 달
  const pts = [];
  const N = 36;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI / 2 - (Math.PI * i) / N; // 아래(+90°) → 위(-90°)
    const x = waxing ? cx + a * Math.cos(th) : cx - a * Math.cos(th);
    const y = cy + r * Math.sin(th);
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const outer = waxing
    ? `M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r}`
    : `M${cx} ${cy - r} A${r} ${r} 0 0 0 ${cx} ${cy + r}`;
  const d = `${outer} L${pts.join(' L')} Z`;
  return `<svg viewBox="0 0 24 24">${disc}<path d="${d}" fill="currentColor"/></svg>`;
}

export function dayHeading(isoStr) {
  const dt = parseISO(isoStr);
  const h = holidayNames(isoStr);
  return {
    date: dt,
    long: `${dt.getMonth() + 1}월 ${dt.getDate()}일`,
    weekday: WEEK[weekdayOf(isoStr)],
    lunar: lunarLabel(isoStr),
    holiday: h.length ? h.join(' · ') : '',
  };
}
