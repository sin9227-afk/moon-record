/* 기록 작성/수정 시트 */
import {
  todayISO, esc, ICON, SHAPES, SHAPE_LABEL, COLORS, COLOR_LABEL,
  shapeIcon, shapeMark, WEEK, weekdayOf, parseISO, fmtDateLong, pad2,
} from '../util.js';
import { store } from '../store.js';
import { refresh, navState } from '../nav.js';
import { showSheet, confirmDialog, chooseDialog, toast, openViewer } from '../ui.js';
import { repeatSummary, nextOccurrence, isRepeating } from '../repeat.js';
import { lunarLabel, lunarShort } from '../lunar.js';
import { holidayNames } from '../holidays.js';

const FREQS = [
  ['none', '없음'], ['daily', '매일'], ['weekly', '매주'], ['monthly', '매월'], ['yearly', '매년'],
];

export function openEditorSheet(existing, opts = {}) {
  const baseDate = opts.date || (existing && existing.date) || todayISO();
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: null, type: 'schedule', title: '', date: baseDate, time: '',
    place: '', tags: [], color: 'accent', shape: 'circle', body: '',
    photos: [], checklist: [],
    repeat: { freq: 'none', interval: 1, weekdays: [], until: '', calendar: 'solar' },
    exdates: [], created: null, updated: null,
  };
  draft.tags = Array.isArray(draft.tags) ? draft.tags : [];
  draft.photos = Array.isArray(draft.photos) ? draft.photos : [];
  draft.checklist = Array.isArray(draft.checklist) ? draft.checklist : [];
  draft.repeat = { freq: 'none', interval: 1, weekdays: [], until: '', calendar: 'solar', ...(draft.repeat || {}) };
  draft.exdates = Array.isArray(draft.exdates) ? draft.exdates : [];
  if (!draft.date) draft.date = baseDate;

  const isNew = !draft.id;
  let timeOn = !!draft.time;
  const node = document.createElement('div');
  node.innerHTML = `
    <div class="sheet-head">
      <button class="ghost" data-cancel>취소</button>
      <h2>${isNew ? '새 기록' : '기록 수정'}</h2>
      <button class="primary" data-save>저장</button>
    </div>
    <div class="sheet-body">
      <div class="f-row">
        <div class="type-seg">
          <button data-type="schedule" class="${draft.type === 'schedule' ? 'on' : ''}">${ICON.calendar}<span>일정</span></button>
          <button data-type="diary" class="${draft.type === 'diary' ? 'on' : ''}">${ICON.note}<span>일기</span></button>
          <button data-type="both" class="${draft.type === 'both' ? 'on' : ''}">${ICON.book}<span>기록</span></button>
        </div>
      </div>

      <div class="f-row">
        <input class="f-input big" data-f="title" value="${esc(draft.title)}" placeholder="제목" enterkeyhint="next">
      </div>

      <div class="f-row">
        <div class="f-label">날짜 <span class="opt" data-lunar-hint></span></div>
        <div class="f-inline">
          <input class="f-input" type="date" data-f="date" value="${esc(draft.date)}" style="flex:1">
          <button class="pill-btn ${draft.time ? '' : 'on'}" data-allday style="height:44px;padding:0 14px;border-radius:12px">종일</button>
        </div>
        ${holidayNames(draft.date).length ? `<div class="f-note">${esc(holidayNames(draft.date).join(' · '))}</div>` : ''}
      </div>

      <div class="f-row" data-time-row style="${draft.time ? '' : 'display:none'}">
        <div class="f-label">시간</div>
        <input class="f-input" type="time" data-f="time" value="${esc(draft.time || '')}">
      </div>

      <div class="f-row">
        <div class="f-label">장소</div>
        <input class="f-input" data-f="place" value="${esc(draft.place || '')}" placeholder="어디에서">
      </div>

      <div class="f-row">
        <div class="f-label">태그</div>
        <div class="tag-box" data-tags></div>
        <div class="check-add">
          <input data-tag-input placeholder="태그 입력 후 Enter">
          <button data-tag-add>추가</button>
        </div>
      </div>

      <div class="f-row">
        <div class="f-label">모양</div>
        <div class="icon-picker">
          ${SHAPES.map((sh) => `<button class="icon-opt ${draft.shape === sh ? 'on' : ''}" data-shape="${sh}" title="${SHAPE_LABEL[sh]}">${shapeIcon(sh)}</button>`).join('')}
        </div>
      </div>

      <div class="f-row">
        <div class="f-label">색</div>
        <div class="color-picker">
          ${COLORS.map((c) => `<button class="color-opt c-${c} ${draft.color === c ? 'on' : ''}" data-color="${c}" title="${COLOR_LABEL[c]}"><span></span></button>`).join('')}
        </div>
      </div>

      <div class="f-row">
        <div class="f-label">반복</div>
        <div class="seg" style="width:100%;display:flex">
          ${FREQS.map(([v, l]) => `<button data-freq="${v}" class="${draft.repeat.freq === v ? 'on' : ''}" style="flex:1">${l}</button>`).join('')}
        </div>
        <div class="repeat-panel" data-repeat-panel style="margin-top:10px"></div>
      </div>

      <div class="f-row">
        <div class="f-label">사진 <span class="opt" data-photo-count></span></div>
        <div class="photo-grid" data-photos></div>
        <input type="file" accept="image/*" multiple hidden data-file-gallery>
        <input type="file" accept="image/*" capture="environment" hidden data-file-camera>
      </div>

      <div class="f-row">
        <div class="f-label">체크리스트 <span class="opt" data-check-count></span></div>
        <div class="checklist" data-checks></div>
        <div class="check-add">
          <input data-check-input placeholder="할 일을 적어보세요">
          <button data-check-add>추가</button>
        </div>
      </div>

      <div class="f-row">
        <div class="f-label">본문 <span class="opt">일기</span></div>
        <textarea class="f-input" data-f="body" placeholder="오늘의 마음, 기억하고 싶은 것들…">${esc(draft.body || '')}</textarea>
      </div>
    </div>
    <div class="sheet-foot">
      ${!isNew ? `<button class="btn btn-danger" data-delete>${ICON.trash}</button>` : ''}
      <button class="btn btn-primary" data-save>${ICON.check}<span>저장</span></button>
    </div>`;

  const sheet = showSheet(node, { onClose: () => { } });
  const $ = (sel) => node.querySelector(sel);

  /* ---------- 조각 렌더 ---------- */
  const renderLunarHint = () => {
    const hint = $('[data-lunar-hint]');
    const l = lunarLabel(draft.date);
    hint.textContent = l ? `· ${l}` : '';
    const hol = holidayNames(draft.date);
    node.querySelectorAll('[data-holiday-note]').forEach((n) => n.remove());
    if (hol.length) {
      const d = document.createElement('div');
      d.className = 'f-note';
      d.dataset.holidayNote = '1';
      d.textContent = hol.join(' · ');
      $('[data-f="date"]').closest('.f-row').appendChild(d);
    }
  };

  const renderTags = () => {
    const box = $('[data-tags]');
    box.innerHTML = draft.tags.length
      ? draft.tags.map((t, i) => `<span class="tag-chip">#${esc(t)}<button data-tag-rm="${i}" aria-label="삭제">${ICON.close}</button></span>`).join('')
      : '<span class="f-note" style="margin:0">태그를 더하면 검색이 쉬워져요</span>';
  };

  const renderPhotos = () => {
    const grid = $('[data-photos]');
    grid.innerHTML = draft.photos.map((pid, i) => `
      <div class="photo-cell">
        <img src="${store.thumbURL(pid)}" alt="첨부 사진" data-photo-open="${i}">
        <button class="del" data-photo-rm="${i}" aria-label="사진 삭제">${ICON.close}</button>
      </div>`).join('') + `
      <button class="photo-add" data-photo-add>
        ${ICON.camera}
        <span>사진</span>
        <small>${draft.photos.length ? '더 추가' : '카메라·갤러리'}</small>
      </button>`;
    $('[data-photo-count]').textContent = draft.photos.length ? `· ${draft.photos.length}장` : '';
  };

  const renderChecks = () => {
    const list = $('[data-checks]');
    const done = draft.checklist.filter((c) => c.done).length;
    list.innerHTML = draft.checklist.map((c, i) => `
      <div class="check-row ${c.done ? 'done' : ''}">
        <button class="box" data-check-toggle="${i}" aria-label="완료">${ICON.check}</button>
        <input data-check-text="${i}" value="${esc(c.text)}" placeholder="할 일">
        <button class="rm" data-check-rm="${i}" aria-label="삭제">${ICON.close}</button>
      </div>`).join('');
    $('[data-check-count]').textContent = draft.checklist.length ? `· ${done}/${draft.checklist.length}` : '';
  };

  const renderRepeat = () => {
    const p = $('[data-repeat-panel]');
    const r = draft.repeat;
    if (!r.freq || r.freq === 'none') {
      p.innerHTML = '';
      return;
    }
    const weekdays = (r.weekdays && r.weekdays.length) ? r.weekdays : [weekdayOf(draft.date)];
    const summary = repeatSummary({ ...draft, repeat: { ...r, weekdays } });
    const next = nextOccurrence({ ...draft, repeat: { ...r, weekdays } }, todayISO());
    p.innerHTML = `
      <div class="f-inline" style="margin-bottom:8px">
        <label class="f-label" style="margin:0;flex:none">간격</label>
        <input class="f-input" type="number" min="1" max="99" inputmode="numeric" data-f="interval" value="${r.interval || 1}" style="width:78px;text-align:center">
        <span style="font-size:12px;color:var(--ink-3)">${r.freq === 'daily' ? '일마다' : r.freq === 'weekly' ? '주마다' : r.freq === 'monthly' ? '개월마다' : '년마다'}</span>
      </div>
      ${r.freq === 'weekly' ? `<div class="weekday-pick">${[0, 1, 2, 3, 4, 5, 6].map((d) => `<button data-weekday="${d}" class="${weekdays.includes(d) ? 'on' : ''}">${WEEK[d]}</button>`).join('')}</div>` : ''}
      ${r.freq === 'yearly' ? `
        <div class="f-inline" style="margin-bottom:8px">
          <div class="seg" style="flex:1;display:flex">
            <button data-cal="solar" class="${r.calendar !== 'lunar' ? 'on' : ''}" style="flex:1">양력</button>
            <button data-cal="lunar" class="${r.calendar === 'lunar' ? 'on' : ''}" style="flex:1">음력</button>
          </div>
        </div>` : ''}
      <div class="f-inline" style="margin-bottom:8px">
        <label class="f-label" style="margin:0;flex:none">종료일</label>
        <input class="f-input" type="date" data-f="until" value="${esc(r.until || '')}" style="flex:1">
        ${r.until ? '<button class="pill-btn" data-until-clear>지움</button>' : ''}
      </div>
      <div class="repeat-summary">${ICON.repeat}<span>${esc(summary)}${next ? `<br>다음 기록 <b>${esc(fmtDateLong(next))}</b>` : ''}</span></div>`;
  };

  renderTags(); renderPhotos(); renderChecks(); renderRepeat(); renderLunarHint();

  /* ---------- 이벤트 ---------- */
  const setType = (t) => {
    draft.type = t;
    node.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('on', b.dataset.type === t));
  };

  node.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f === 'title') draft.title = t.value;
    else if (t.dataset.f === 'place') draft.place = t.value;
    else if (t.dataset.f === 'body') draft.body = t.value;
    else if (t.dataset.f === 'time') draft.time = t.value;
    else if (t.dataset.f === 'interval') {
      draft.repeat.interval = Math.max(1, Number(t.value) || 1);
      renderRepeat();
    } else if (t.dataset.f === 'until') {
      draft.repeat.until = t.value;
      renderRepeat();
    } else if (t.dataset.f === 'date') {
      draft.date = t.value;
      renderLunarHint();
      renderRepeat();
    } else if (t.dataset.checkText !== undefined) {
      const i = Number(t.dataset.checkText);
      if (draft.checklist[i]) draft.checklist[i].text = t.value;
    }
  });

  node.addEventListener('change', (e) => {
    if (e.target.dataset.f === 'date') {
      draft.date = e.target.value;
      renderLunarHint();
      renderRepeat();
    }
    if (e.target.matches('[data-file-gallery], [data-file-camera]')) {
      handleFiles([...e.target.files || []]);
      e.target.value = '';
    }
  });

  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-tag-input], [data-check-input]')) {
      e.preventDefault();
      if (e.target.matches('[data-tag-input]')) addTag(e.target.value);
      else addCheck(e.target.value);
    }
  });

  function addTag(raw) {
    const v = String(raw || '').replace(/^#/, '').trim();
    if (!v) return;
    if (!draft.tags.includes(v)) draft.tags.push(v);
    const inp = $('[data-tag-input]');
    if (inp) inp.value = '';
    renderTags();
  }
  function addCheck(raw) {
    const v = String(raw || '').trim();
    if (!v) return;
    draft.checklist.push({ id: store.newId('c'), text: v, done: false });
    const inp = $('[data-check-input]');
    if (inp) inp.value = '';
    renderChecks();
  }

  async function handleFiles(files) {
    if (!files.length) return;
    toast('사진을 저장하는 중…');
    for (const f of files) {
      try {
        const { id } = await store.addPhoto(f);
        draft.photos.push(id);
      } catch (err) {
        console.warn(err);
        toast('사진을 넣지 못했어요');
      }
    }
    renderPhotos();
    toast(`사진 ${files.length}장을 담았어요`);
  }

  node.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-cancel],[data-save],[data-delete],[data-type],[data-shape],[data-color],[data-freq],[data-weekday],[data-cal],[data-until-clear],[data-tag-add],[data-tag-rm],[data-photo-add],[data-photo-rm],[data-photo-open],[data-check-add],[data-check-toggle],[data-check-rm],[data-allday]');
    if (!t) return;

    if (t.hasAttribute('data-cancel')) { sheet.close(); return; }
    if (t.hasAttribute('data-save')) { await save(); return; }
    if (t.hasAttribute('data-delete')) { await remove(); return; }
    if (t.dataset.type) { setType(t.dataset.type); return; }
    if (t.dataset.shape) {
      draft.shape = t.dataset.shape;
      node.querySelectorAll('[data-shape]').forEach((b) => b.classList.toggle('on', b.dataset.shape === draft.shape));
      return;
    }
    if (t.dataset.color) {
      draft.color = t.dataset.color;
      node.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === draft.color));
      return;
    }
    if (t.dataset.freq) {
      draft.repeat.freq = t.dataset.freq;
      if (draft.repeat.freq === 'weekly' && !draft.repeat.weekdays.length) draft.repeat.weekdays = [weekdayOf(draft.date)];
      node.querySelectorAll('[data-freq]').forEach((b) => b.classList.toggle('on', b.dataset.freq === draft.repeat.freq));
      renderRepeat();
      return;
    }
    if (t.dataset.weekday !== undefined) {
      const d = Number(t.dataset.weekday);
      const set = new Set(draft.repeat.weekdays.length ? draft.repeat.weekdays : [weekdayOf(draft.date)]);
      if (set.has(d)) set.delete(d); else set.add(d);
      draft.repeat.weekdays = [...set].sort();
      renderRepeat();
      return;
    }
    if (t.dataset.cal) {
      draft.repeat.calendar = t.dataset.cal;
      renderRepeat();
      return;
    }
    if (t.hasAttribute('data-until-clear')) { draft.repeat.until = ''; renderRepeat(); return; }
    if (t.hasAttribute('data-tag-add')) { addTag($('[data-tag-input]').value); return; }
    if (t.dataset.tagRm !== undefined) { draft.tags.splice(Number(t.dataset.tagRm), 1); renderTags(); return; }
    if (t.hasAttribute('data-photo-add')) {
      const pick = await chooseDialog({
        title: '사진 추가',
        options: [
          { label: '카메라로 찍기', value: 'camera' },
          { label: '갤러리에서 고르기', value: 'gallery' },
        ],
      });
      if (pick === 'camera') $('[data-file-camera]').click();
      else if (pick === 'gallery') $('[data-file-gallery]').click();
      return;
    }
    if (t.dataset.photoRm !== undefined) {
      const idx = Number(t.dataset.photoRm);
      const pid = draft.photos[idx];
      draft.photos.splice(idx, 1);
      if (pid) await store.deletePhoto(pid);
      renderPhotos();
      return;
    }
    if (t.dataset.photoOpen !== undefined) {
      openViewer(draft.photos, Number(t.dataset.photoOpen));
      return;
    }
    if (t.hasAttribute('data-check-add')) { addCheck($('[data-check-input]').value); return; }
    if (t.dataset.checkToggle !== undefined) {
      const i = Number(t.dataset.checkToggle);
      draft.checklist[i].done = !draft.checklist[i].done;
      renderChecks();
      return;
    }
    if (t.dataset.checkRm !== undefined) { draft.checklist.splice(Number(t.dataset.checkRm), 1); renderChecks(); return; }
    if (t.hasAttribute('data-allday')) {
      timeOn = !timeOn;
      if (!timeOn) {
        draft.time = '';
      } else if (!draft.time) {
        draft.time = '09:00';
      }
      $('[data-time-row]').style.display = timeOn ? '' : 'none';
      if (timeOn) $('[data-f="time"]').value = draft.time;
      $('[data-allday]').classList.toggle('on', !timeOn);
      return;
    }
  });

  async function save() {
    const hasContent = draft.title.trim() || draft.body.trim() || draft.checklist.length || draft.photos.length;
    if (!hasContent) { toast('제목이나 내용을 적어주세요'); return; }
    if (!draft.date) { toast('날짜를 골라주세요'); return; }
    const rec = {
      ...draft,
      id: draft.id || store.newId(),
      title: draft.title.trim(),
      body: draft.body || '',
      repeat: { ...draft.repeat },
      updated: new Date().toISOString(),
      created: draft.created || new Date().toISOString(),
    };
    await store.saveEntry(rec);
    navState.day = rec.date;
    sheet.close();
    refresh();
    toast(isNew ? '기록을 남겼어요' : '수정했어요');
  }

  async function remove() {
    if (isRepeating(draft)) {
      const pick = await chooseDialog({
        title: '기록 삭제',
        message: '반복되는 기록입니다. 어떻게 지울까요?',
        options: [
          { label: '이 날짜만 지우기', value: 'one', sub: draft.date },
          { label: '반복 전체 지우기', value: 'all', sub: '모든 날짜' },
        ],
      });
      if (!pick) return;
      if (pick === 'one') { await store.deleteEntry(draft.id, { onlyDate: opts.date || draft.date }); }
      else { await store.deleteEntry(draft.id); }
    } else {
      const ok = await confirmDialog({ title: '기록 삭제', message: '이 기록을 지울까요?<br>사진도 함께 지워집니다.', ok: '삭제', danger: true });
      if (!ok) return;
      await store.deleteEntry(draft.id);
    }
    sheet.close();
    refresh();
    toast('지웠어요');
  }
}
