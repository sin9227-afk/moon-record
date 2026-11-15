/* 설정 뷰 */
import { esc, ICON, todayISO, COLORS, COLOR_LABEL } from '../util.js';
import { store } from '../store.js';
import { refresh } from '../nav.js';
import { showSheet, confirmDialog, chooseDialog, toast, applyTheme } from '../ui.js';
import { getInstallPrompt, clearInstallPrompt } from '../install.js';

export function mountSettings(root) {
  const s = store.settings;

  root.innerHTML = `
    <header class="page-head">
      <h1>설정</h1>
      <span class="sub">달의 기록</span>
    </header>
    <div class="scroll">

      <div class="settings-group">
        <h2>테마</h2>
        <div class="card">
          <div class="row">
            <span class="r-label">모드</span>
            <div class="seg">
              ${[['system', '자동'], ['light', '라이트'], ['dark', '다크']].map(([v, l]) => `<button data-theme="${v}" class="${s.theme === v ? 'on' : ''}">${l}</button>`).join('')}
            </div>
          </div>
          <div class="row">
            <span class="r-label">테마 색</span>
            <div class="swatches">
              ${COLORS.filter((c) => c !== 'sand').map((c) => `<button class="swatch c-${c} ${s.accent === c ? 'on' : ''}" data-accent="${c}" aria-label="${COLOR_LABEL[c]}"><span style="display:block;width:100%;height:100%;border-radius:50%;background:currentColor"></span></button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <h2>캘린더 스타일</h2>
        <div class="card">
          <div class="row">
            <span class="r-label">캘린더 글씨 크기</span>
            <div class="seg">
              ${[['sm', '작게'], ['md', '보통'], ['lg', '크게']].map(([v, l]) => `<button data-calscale="${v}" class="${s.calScale === v ? 'on' : ''}">${l}</button>`).join('')}
            </div>
          </div>
          <div class="row">
            <span class="r-label">한 주의 시작</span>
            <div class="seg">
              ${[['0', '일요일'], ['1', '월요일']].map(([v, l]) => `<button data-weekstart="${v}" class="${String(s.weekStart) === v ? 'on' : ''}">${l}</button>`).join('')}
            </div>
          </div>
          <div class="row">
            <span class="r-label">음력 표시<div class="r-sub">날짜 아래 작은 음력</div></span>
            <button class="switch ${s.showLunar ? 'on' : ''}" data-toggle="showLunar" aria-label="음력 표시"></button>
          </div>
          <div class="row">
            <span class="r-label">격자선<div class="r-sub">달력 칸 구분선</div></span>
            <button class="switch ${s.showGrid ? 'on' : ''}" data-toggle="showGrid" aria-label="격자선"></button>
          </div>
          <div class="row">
            <span class="r-label">공휴일 이름</span>
            <button class="switch ${s.showHolidayName ? 'on' : ''}" data-toggle="showHolidayName" aria-label="공휴일 이름"></button>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <h2>일간 화면 · 목록</h2>
        <div class="card">
          <div class="row" style="flex-direction:column;align-items:stretch;gap:8px">
            <span class="r-label">일간 화면 표시 방식</span>
            <div class="seg" style="width:100%;display:flex">
              ${[['card', '카드'], ['chip', '간결'], ['timeline', '타임라인']].map(([v, l]) => `<button data-daystyle="${v}" class="${s.dayStyle === v ? 'on' : ''}" style="flex:1">${l}</button>`).join('')}
            </div>
          </div>
          <div class="row">
            <span class="r-label">사진 미리보기</span>
            <button class="switch ${s.showPhotosInList ? 'on' : ''}" data-toggle="showPhotosInList" aria-label="사진 미리보기"></button>
          </div>
          <div class="row">
            <span class="r-label">완료한 체크 표시</span>
            <button class="switch ${s.showDoneInList ? 'on' : ''}" data-toggle="showDoneInList" aria-label="완료 표시"></button>
          </div>
          <div class="row">
            <span class="r-label">목록 구분선</span>
            <button class="switch ${s.showDividers ? 'on' : ''}" data-toggle="showDividers" aria-label="구분선"></button>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <h2>명언 · 좌우명</h2>
        <div class="card" style="padding:12px">
          <div class="f-label">좌우명 <span class="opt">캘린더 위에 은은하게 표시</span></div>
          <textarea class="motto-input" data-text="motto" placeholder="나만의 좌우명이나 목표를 적어보세요">${esc(s.motto || '')}</textarea>
          <div class="f-label" style="margin-top:12px">명언</div>
          <textarea class="quote-input" data-text="quote">${esc(s.quote || '')}</textarea>
          <div class="row" style="padding:10px 2px 0;min-height:auto">
            <span class="r-label" style="font-size:12px;color:var(--ink-2)">명언 표시 <span style="color:var(--ink-3);font-size:10.5px">(좌우명이 없을 때)</span></span>
            <button class="switch ${s.showQuote ? 'on' : ''}" data-toggle="showQuote" aria-label="명언 표시"></button>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <h2>데이터</h2>
        <div class="card">
          <button class="row tap" data-export="full">
            ${ICON.download}<span class="r-label">백업 내보내기<div class="r-sub">기록·사진 모두 (JSON)</div></span>
          </button>
          <button class="row tap" data-export="text">
            ${ICON.download}<span class="r-label">데이터만 내보내기<div class="r-sub">사진 제외, 가벼운 백업</div></span>
          </button>
          <button class="row tap" data-import>
            ${ICON.upload}<span class="r-label">백업 가져오기<div class="r-sub">JSON 파일에서 복원</div></span>
          </button>
          <div class="row" style="flex-direction:column;align-items:stretch">
            <span class="r-label">저장 공간</span>
            <div class="r-sub" data-storage>불러오는 중…</div>
            <div class="usage-bar"><i data-usage style="width:0%"></i></div>
          </div>
          <button class="row tap danger" data-clear>${ICON.trash}<span class="r-label">모든 기록 지우기</span></button>
        </div>
        <input type="file" accept="application/json,.json" hidden data-import-file>
      </div>

      <div class="settings-group">
        <h2>앱</h2>
        <div class="card">
          <button class="row tap" data-install>
            ${ICON.cloud}<span class="r-label">홈 화면에 추가<div class="r-sub">앱처럼 전체 화면으로</div></span><span class="r-value" data-install-state></span>
          </button>
          <div class="row">
            <span class="r-label">버전</span><span class="r-value">1.0.0</span>
          </div>
          <div class="row" style="flex-direction:column;align-items:stretch">
            <span class="r-label">오프라인</span>
            <div class="r-sub">한 번 열어두면 인터넷 없이도 기록을 볼 수 있어요. 기록은 이 기기 브라우저에만 저장됩니다.</div>
          </div>
        </div>
      </div>

      <p class="empty-note" style="padding:4px 0 20px">흐릿한 기록은 또렷한 기억보다 더 가치 있다.</p>
    </div>`;

  const $ = (sel) => root.querySelector(sel);

  const saveAndRefresh = (patch = {}, quiet = true) => {
    store.saveSettings(patch);
    applyTheme();
    if (!quiet) refresh();
  };

  /* 저장 공간 */
  store.storageInfo().then((info) => {
    const mb = (n) => (n / 1024 / 1024).toFixed(1);
    const el = $('[data-storage]');
    if (!el) return;
    el.textContent = `기록 ${info.entries}개 · 디데이 ${info.ddays}개 · 사진 ${info.photoCount}장 (${mb(info.photoBytes)}MB)${info.persistMode === 'memory' ? ' · 임시 모드(창을 닫으면 사라짐)' : info.idbOK ? '' : ' · 저장소 제한'}`;
    const pct = info.quota ? Math.min(100, Math.round((info.usage / info.quota) * 100)) : 0;
    const bar = $('[data-usage]');
    if (bar) bar.style.width = `${Math.max(2, pct)}%`;
  });

  if (getInstallPrompt()) {
    const st = $('[data-install-state]');
    if (st) st.textContent = '설치 가능';
  }

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-theme],[data-accent],[data-font],[data-calscale],[data-weekstart],[data-toggle],[data-daystyle],[data-export],[data-import],[data-clear],[data-install]');
    if (!t) return;

    if (t.dataset.theme) {
      saveAndRefresh({ theme: t.dataset.theme }, false);
      root.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('on', b.dataset.theme === t.dataset.theme));
      return;
    }
    if (t.dataset.accent) {
      saveAndRefresh({ accent: t.dataset.accent });
      root.querySelectorAll('[data-accent]').forEach((b) => b.classList.toggle('on', b.dataset.accent === t.dataset.accent));
      return;
    }
    if (t.dataset.calscale) {
      saveAndRefresh({ calScale: t.dataset.calscale });
      root.querySelectorAll('[data-calscale]').forEach((b) => b.classList.toggle('on', b.dataset.calscale === t.dataset.calscale));
      return;
    }
    if (t.dataset.weekstart) {
      saveAndRefresh({ weekStart: Number(t.dataset.weekstart) });
      root.querySelectorAll('[data-weekstart]').forEach((b) => b.classList.toggle('on', b.dataset.weekstart === t.dataset.weekstart));
      return;
    }
    if (t.dataset.daystyle) {
      saveAndRefresh({ dayStyle: t.dataset.daystyle });
      root.querySelectorAll('[data-daystyle]').forEach((b) => b.classList.toggle('on', b.dataset.daystyle === t.dataset.daystyle));
      return;
    }
    if (t.dataset.toggle) {
      const key = t.dataset.toggle;
      const val = !store.settings[key];
      t.classList.toggle('on', val);
      saveAndRefresh({ [key]: val });
      return;
    }
    if (t.dataset.export) {
      const withPhotos = t.dataset.export === 'full';
      toast('백업 파일을 만드는 중…');
      try {
        const json = await store.exportJSON({ includePhotos: withPhotos });
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `달의기록-백업-${todayISO()}${withPhotos ? '' : '-데이터만'}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
        toast(withPhotos ? '사진까지 담아 백업했어요' : '데이터만 백업했어요');
      } catch (err) {
        console.error(err);
        toast('백업에 실패했어요');
      }
      return;
    }
    if (t.hasAttribute('data-import')) { $('[data-import-file]').click(); return; }
    if (t.hasAttribute('data-clear')) {
      const ok = await confirmDialog({ title: '모든 기록 지우기', message: '기록·사진·디데이가 모두 지워집니다.<br>되돌릴 수 없으니 먼저 백업해 두세요.', ok: '모두 지우기', danger: true });
      if (!ok) return;
      await store.clearAll();
      refresh();
      toast('모두 지웠어요');
      return;
    }
    if (t.hasAttribute('data-install')) {
      const prompt = getInstallPrompt();
      if (prompt) {
        prompt.prompt();
        const res = await prompt.userChoice;
        if (res.outcome === 'accepted') toast('홈 화면에 추가되었어요');
        clearInstallPrompt();
        refresh();
      } else {
        const infoNode = document.createElement('div');
        infoNode.innerHTML = `
            <div class="sheet-head"><span class="grab"></span><h2>홈 화면에 추가</h2></div>
            <div class="sheet-body">
              <div class="confirm-body">
                <b>안드로이드 크롬</b><br>
                오른쪽 위 ⋮ 메뉴 → <b>홈 화면에 추가</b> → <b>설치</b>를 누르면 앱처럼 열립니다.<br><br>
                <b>아이폰 사파리</b><br>
                공유 버튼 → <b>홈 화면에 추가</b>.
              </div>
            </div>
            <div class="sheet-foot"><button class="btn btn-ghost" data-ok style="flex:1">확인</button></div>`;
        const h = showSheet(infoNode, { small: true });
        infoNode.querySelector('[data-ok]').addEventListener('click', () => h.close());
      }
    }
  });

  /* 텍스트 입력 (포커스 유지: blur 시 저장) */
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.text) {
      store.saveSettings({ [t.dataset.text]: t.value });
    }
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.text) store.saveSettings({ [t.dataset.text]: t.value });
    if (t.matches('[data-import-file]')) handleImport(t);
  });

  async function handleImport(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { toast('JSON 파일을 읽지 못했어요'); return; }
    if (!parsed || !Array.isArray(parsed.entries)) { toast('달의 기록 백업 파일이 아닙니다'); return; }
    const mode = await chooseDialog({
      title: '백업 가져오기',
      message: `기록 ${parsed.entries.length}개${parsed.photos?.length ? ` · 사진 ${parsed.photos.length}장` : ''}이 들어 있습니다.`,
      options: [
        { label: '기존 기록에 더하기', value: 'merge', sub: '겹치면 최신 유지' },
        { label: '모두 지우고 복원', value: 'replace', sub: '주의' },
      ],
    });
    if (!mode) return;
    try {
      const r = await store.importJSON(text, { mode });
      toast(`기록 ${r.addedEntries}개를 가져왔어요`);
      refresh();
    } catch (err) {
      console.error(err);
      toast('가져오기에 실패했어요');
    }
  }
}
