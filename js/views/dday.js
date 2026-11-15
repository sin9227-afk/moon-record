/* 디데이 뷰 */
import { esc, ICON, COLORS, COLOR_LABEL, todayISO, parseISO, pad2, fmtDateLong, daysInMonth } from '../util.js';
import { store } from '../store.js';
import { refresh } from '../nav.js';
import { ddayInfo, ddayNext, fmtDdayDate } from '../dday.js';
import { showSheet, confirmDialog, toast } from '../ui.js';
import { lunarLabel, solarToLunarISO } from '../lunar.js';
import { holidayNames } from '../holidays.js';

export function mountDday(root) {
  const today = todayISO();
  const items = store.ddays.map((d) => ({ d, info: ddayInfo(d, today) }));
  const upcoming = items.filter((x) => !x.info.passed).sort((a, b) => a.info.days - b.info.days);
  const past = items.filter((x) => x.info.passed).sort((a, b) => b.info.days - a.info.days);

  root.innerHTML = `
    <header class="page-head">
      <h1>디데이</h1>
      <button class="pill-btn" data-add style="display:flex;align-items:center;gap:4px">${ICON.plus}<span>추가</span></button>
    </header>
    <div class="scroll">
      ${items.length ? '' : `
        <div class="d-empty" style="padding-top:60px">
          <div class="moon-art" style="color:var(--line)">${ICON.dday}</div>
          <p>기다리는 날을 적어두면<br>달력이 조금 더 다정해집니다.</p>
        </div>`}
      ${upcoming.length ? `<div class="section-label">다가오는 날</div><div class="dday-list">
        ${upcoming.map(({ d, info }) => card(d, info)).join('')}
      </div>` : ''}
      ${past.length ? `<div class="section-label">지나온 날</div><div class="dday-list">
        ${past.map(({ d, info }) => card(d, info)).join('')}
      </div>` : ''}
      <button class="add-inline" data-add style="margin-top:16px">${ICON.plus}<span>디데이 추가</span></button>
    </div>`;

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-add],[data-id]');
    if (!t) return;
    if (t.hasAttribute('data-add')) { openDdaySheet(null); return; }
    if (t.dataset.id) {
      const d = store.ddays.find((x) => x.id === t.dataset.id);
      if (d) openDdaySheet(d);
    }
  });
}

function card(d, info) {
  const color = d.color || 'accent';
  return `
    <button class="dday-card c-${color}" data-id="${esc(d.id)}">
      <span class="d-ring"></span>
      <div class="d-left">
        <div class="d-title">${esc(d.title || '디데이')}</div>
        <div class="d-date">
          <span>${esc(fmtDdayDate(d))}</span>
          ${d.repeat === 'yearly' ? `<span style="color:var(--gold)">매년</span>` : ''}
        </div>
        ${d.memo ? `<div class="d-memo">${esc(d.memo)}</div>` : ''}
      </div>
      <div class="d-num">${info.label}<small>${esc(info.next.replace(/-/g, '. '))}</small></div>
    </button>`;
}

function openDdaySheet(existing) {
  const draft = existing ? { ...existing } : {
    id: null, title: '', date: todayISO(), calendar: 'solar', repeat: 'none', color: 'amber', memo: '',
  };
  const node = document.createElement('div');
  node.innerHTML = `
    <div class="sheet-head">
      <button class="ghost" data-cancel>취소</button>
      <h2>${existing ? '디데이 수정' : '새 디데이'}</h2>
      <button class="primary" data-save>저장</button>
    </div>
    <div class="sheet-body">
      <div class="f-row">
        <input class="f-input big" data-f="title" value="${esc(draft.title)}" placeholder="기다리는 날 (예: 여행, 생일)">
      </div>
      <div class="f-row">
        <div class="f-label">날짜 <span class="opt" data-lunar-hint></span></div>
        <input class="f-input" type="date" data-f="date" value="${esc(draft.date)}">
        ${draft.calendar === 'lunar' ? '<div class="f-note">음력을 기준으로 매년 반복됩니다.</div>' : ''}
      </div>
      <div class="f-row">
        <div class="f-label">기준</div>
        <div class="seg" style="display:flex;width:100%">
          <button data-cal="solar" class="${draft.calendar !== 'lunar' ? 'on' : ''}" style="flex:1">양력</button>
          <button data-cal="lunar" class="${draft.calendar === 'lunar' ? 'on' : ''}" style="flex:1">음력</button>
        </div>
      </div>
      <div class="f-row">
        <div class="row" style="padding:0;min-height:auto">
          <span class="r-label">매년 반복</span>
          <button class="switch ${draft.repeat === 'yearly' ? 'on' : ''}" data-repeat aria-label="매년 반복"></button>
        </div>
      </div>
      <div class="f-row">
        <div class="f-label">색</div>
        <div class="color-picker">
          ${COLORS.map((c) => `<button class="color-opt c-${c} ${draft.color === c ? 'on' : ''}" data-color="${c}" title="${COLOR_LABEL[c]}"><span></span></button>`).join('')}
        </div>
      </div>
      <div class="f-row">
        <div class="f-label">메모</div>
        <textarea class="f-input" data-f="memo" style="min-height:76px" placeholder="이 날을 기다리는 마음">${esc(draft.memo || '')}</textarea>
      </div>
    </div>
    <div class="sheet-foot">
      ${existing ? `<button class="btn btn-danger" data-delete>${ICON.trash}</button>` : ''}
      <button class="btn btn-primary" data-save>${ICON.check}<span>저장</span></button>
    </div>`;

  const sheet = showSheet(node);
  const $ = (s) => node.querySelector(s);

  const hint = () => {
    const l = lunarLabel(draft.date);
    $('[data-lunar-hint]').textContent = l ? `· ${l}` : '';
  };
  hint();

  node.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (f) draft[f] = e.target.value;
    if (f === 'date') hint();
  });
  node.addEventListener('change', (e) => {
    if (e.target.dataset.f === 'date') { draft.date = e.target.value; hint(); }
  });

  node.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-cancel],[data-save],[data-delete],[data-cal],[data-repeat],[data-color]');
    if (!t) return;
    if (t.hasAttribute('data-cancel')) { sheet.close(); return; }
    if (t.dataset.cal) {
      draft.calendar = t.dataset.cal;
      node.querySelectorAll('[data-cal]').forEach((b) => b.classList.toggle('on', b.dataset.cal === draft.calendar));
      return;
    }
    if (t.hasAttribute('data-repeat')) {
      draft.repeat = draft.repeat === 'yearly' ? 'none' : 'yearly';
      t.classList.toggle('on', draft.repeat === 'yearly');
      return;
    }
    if (t.dataset.color) {
      draft.color = t.dataset.color;
      node.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === draft.color));
      return;
    }
    if (t.hasAttribute('data-delete')) {
      const ok = await confirmDialog({ title: '디데이 삭제', message: '이 디데이를 지울까요?', ok: '삭제', danger: true });
      if (!ok) return;
      await store.deleteDday(draft.id);
      sheet.close(); refresh(); toast('지웠어요');
      return;
    }
    if (t.hasAttribute('data-save')) {
      if (!draft.title.trim()) { toast('이름을 적어주세요'); return; }
      if (!draft.date) { toast('날짜를 골라주세요'); return; }
      await store.saveDday({ ...draft, id: draft.id || store.newId('d'), title: draft.title.trim() });
      sheet.close(); refresh(); toast('디데이를 저장했어요');
    }
  });
}
