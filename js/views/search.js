/* 검색 뷰 */
import { esc, ICON, todayISO, fmtDateShort, weekdayOf, WEEK, TYPE_LABEL } from '../util.js';
import { store } from '../store.js';
import { navState, openDay, refresh, openEditor } from '../nav.js';
import { occursOn, isRepeating, repeatSummary } from '../repeat.js';
import { lunarLabel } from '../lunar.js';
import { ddayInfo } from '../dday.js';

export function mountSearch(root) {
  const s = store.settings;
  let query = navState.searchQuery || '';
  let filter = 'all';

  const allTags = [...new Set(store.entries.flatMap((e) => e.tags || []))].slice(0, 24);

  root.innerHTML = `
    <header class="page-head">
      <h1>검색</h1>
      <span class="sub">제목 · 본문 · 태그 · 장소</span>
    </header>
    <div class="search-box">
      ${ICON.search}
      <input type="search" placeholder="기억나지 않는 그 기록" value="${esc(query)}" enterkeyhint="search" autocomplete="off">
      <button class="clear" data-clear aria-label="지우기" style="${query ? '' : 'display:none'}">${ICON.close}</button>
    </div>
    <div class="filters">
      ${[['all', '전체'], ['schedule', '일정'], ['diary', '일기'], ['check', '체크리스트']].map(([v, l]) => `<button class="chip-btn ${filter === v ? 'on' : ''}" data-filter="${v}">${l}</button>`).join('')}
    </div>
    <div class="scroll" style="padding-top:2px">
      <div data-results></div>
    </div>`;

  const input = root.querySelector('input');
  const results = root.querySelector('[data-results]');
  const clearBtn = root.querySelector('[data-clear]');

  const escRe = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlight = (text, q) => {
    const safe = esc(text);
    if (!q) return safe;
    try {
      return safe.replace(new RegExp(`(${escRe(esc(q))})`, 'gi'), '<mark class="hit">$1</mark>');
    } catch { return safe; }
  };

  function textHit(e, q) {
    if (!q) return false;
    const hay = [e.title, e.body, (e.tags || []).join(' '), e.place, (e.checklist || []).map((c) => c.text).join(' ')]
      .filter(Boolean).join('\n').toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function passesFilter(e) {
    if (filter === 'all') return true;
    if (filter === 'check') return (e.checklist || []).length > 0;
    if (filter === 'diary') return e.type === 'diary';
    return e.type !== 'diary';
  }

  function snippet(e, q) {
    if (!e.body) return '';
    const body = e.body.replace(/\s+/g, ' ').trim();
    if (!q) return body.slice(0, 90);
    const i = body.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return body.slice(0, 90);
    const start = Math.max(0, i - 30);
    return (start > 0 ? '…' : '') + body.slice(start, i + q.length + 50) + (i + q.length + 50 < body.length ? '…' : '');
  }

  function render() {
    const q = query.trim();
    clearBtn.style.display = q ? '' : 'none';

    let list;
    if (!q) {
      list = [...store.entries].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30);
    } else {
      list = store.entries.filter((e) => textHit(e, q) && passesFilter(e))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    list = list.filter(passesFilter);

    const ddayHits = q ? store.ddays.filter((d) => (d.title || '').toLowerCase().includes(q.toLowerCase()) || (d.memo || '').toLowerCase().includes(q.toLowerCase())) : [];

    if (!q) {
      results.innerHTML = `
        ${allTags.length ? `<div class="search-hint" style="padding:4px 0 12px">자주 쓰는 태그<div class="recent-tags">${allTags.map((t) => `<button class="chip-btn" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div></div>` : ''}
        ${list.length ? renderGroups(list, q) : `<div class="search-hint">아직 기록이 없어요.<br>첫 기록을 남겨보세요.</div>`}`;
      return;
    }

    if (!list.length && !ddayHits.length) {
      results.innerHTML = `<div class="search-hint">‘${esc(q)}’에 대한 기록이 없어요.<br>다른 낱말로 찾아보세요.</div>`;
      return;
    }

    results.innerHTML = `
      <div class="stat-strip" style="justify-content:flex-start;margin:0 2px 12px">기록 <b>${list.length}</b>개${ddayHits.length ? ` · 디데이 ${ddayHits.length}` : ''}</div>
      ${ddayHits.length ? `<div class="result-group"><div class="rg-date">디데이</div><div class="dday-list">${ddayHits.map((d) => {
        const info = ddayInfo(d);
        return `<button class="dday-card" data-open-dday="${esc(d.id)}"><span class="d-ring"></span><div class="d-left"><div class="d-title">${highlight(d.title || '디데이', q)}</div><div class="d-date">${esc(d.date)}</div></div><div class="d-num">${info.label}</div></button>`;
      }).join('')}</div></div>` : ''}
      ${renderGroups(list, q)}`;
  }

  function renderGroups(list, q) {
    // 날짜별 묶음
    const groups = new Map();
    for (const e of list) {
      const key = e.date;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const keys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
    return `<div class="result-list">${keys.map((date) => {
      const items = groups.get(date);
      const w = weekdayOf(date);
      return `<div class="result-group">
        <button class="rg-date" data-open-day="${date}">
          <b>${esc(fmtDateShort(date))}</b>
          <span>${WEEK[w]}요일</span>
          <span>· ${esc(lunarLabel(date))}</span>
        </button>
        ${items.map((e) => `
          <button class="search-item c-${e.color || 'accent'}" data-id="${esc(e.id)}">
            <span class="si-title">
              ${isRepeating(e) ? `<span class="si-rep">${ICON.repeat}</span>` : ''}
              ${highlight(e.title || '무제', q)}
            </span>
            ${e.place ? `<span class="si-meta">${esc(e.place)}</span>` : ''}
            ${e.body ? `<span class="si-body">${highlight(snippet(e, q), q)}</span>` : ''}
            ${(e.tags || []).length ? `<span class="si-tags">${e.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</span>` : ''}
          </button>`).join('')}
      </div>`;
    }).join('')}</div>`;
  }

  const debounced = (() => { let t; return () => { clearTimeout(t); t = setTimeout(render, 110); }; })();

  input.addEventListener('input', () => {
    query = input.value;
    navState.searchQuery = query;
    debounced();
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-clear],[data-filter],[data-tag],[data-open-day],[data-id],[data-open-dday]');
    if (!t) return;
    if (t.hasAttribute('data-clear')) { input.value = ''; query = ''; navState.searchQuery = ''; render(); input.focus(); return; }
    if (t.dataset.filter) {
      filter = t.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('on', b.dataset.filter === filter));
      render();
      return;
    }
    if (t.dataset.tag) { query = t.dataset.tag; input.value = query; navState.searchQuery = query; render(); return; }
    if (t.dataset.openDay) { openDay(t.dataset.openDay); return; }
    if (t.dataset.id) { const entry = store.getEntry(t.dataset.id); if (entry) openEditor(entry, { date: entry.date }); return; }
    if (t.dataset.openDday) { navState.view = 'dday'; refresh(); }
  });

  render();
  // 모바일 자동 키보드 방지: 사용자가 직접 탭하면 열림
}
