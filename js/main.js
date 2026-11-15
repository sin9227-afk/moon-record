/* 달의 기록 — 앱 진입점 */
import { store } from './store.js';
import { navState, onRoute, onRefresh, onEditor, go, openEditor, refresh } from './nav.js';
import { applyTheme, closeTopSheet, hasOpenSheet, toast, showSheet } from './ui.js';
import { ICON, todayISO } from './util.js';
import { mountMonth } from './views/month.js';
import { mountDay } from './views/day.js';
import { mountSearch } from './views/search.js';
import { mountDday } from './views/dday.js';
import { mountSettings } from './views/settings.js';
import { openEditorSheet } from './views/editor.js';
import { showOnboarding } from './views/onboarding.js';
import { setInstallPrompt, clearInstallPrompt } from './install.js';

const viewEl = document.getElementById('view');
const tabEl = document.getElementById('tabbar');
const scrollMemory = new Map();

const TABS = [
  { view: 'month', label: '캘린더', icon: ICON.calendar },
  { view: 'search', label: '검색', icon: ICON.search },
  { write: true },
  { view: 'dday', label: '디데이', icon: ICON.dday },
  { view: 'settings', label: '설정', icon: ICON.settings },
];

function activeTab() {
  if (navState.view === 'day') return 'month';
  return navState.view;
}

function renderTabs() {
  tabEl.innerHTML = TABS.map((t) => {
    if (t.write) {
      return `<button class="tab tab-write" data-write aria-label="새 기록"><span class="pen">${ICON.nib}</span><span class="lbl">기록</span></button>`;
    }
    const on = activeTab() === t.view ? ' on' : '';
    return `<button class="tab${on}" data-goto="${t.view}" aria-label="${t.label}">${t.icon}<span class="lbl">${t.label}</span></button>`;
  }).join('');
}

function currentKey() {
  return `${navState.view}:${navState.view === 'day' ? navState.day : navState.searchQuery || ''}`;
}

function render() {
  const prevScroll = viewEl.querySelector('.scroll');
  const key = currentKey();
  if (prevScroll) scrollMemory.set(prevScroll.dataset.key || key, prevScroll.scrollTop);

  viewEl.innerHTML = '';
  const root = document.createElement('section');
  root.className = 'view';
  viewEl.appendChild(root);

  const view = navState.view;
  try {
    if (view === 'month') mountMonth(root);
    else if (view === 'day') mountDay(root);
    else if (view === 'search') mountSearch(root);
    else if (view === 'dday') mountDday(root);
    else if (view === 'settings') mountSettings(root);
    else mountMonth(root);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="empty-note">화면을 그리지 못했어요.<br>${String(err.message || err)}</div>`;
  }

  renderTabs();
  const sc = root.querySelector('.scroll');
  if (sc) {
    sc.dataset.key = key;
    sc.scrollTop = scrollMemory.get(key) || 0;
  }
  applyTheme();
}

/* ---------- 전역 이벤트 ---------- */
tabEl.addEventListener('click', (e) => {
  const write = e.target.closest('[data-write]');
  if (write) {
    openEditorSheet(null, { date: navState.view === 'day' ? navState.day : todayISO() });
    return;
  }
  const btn = e.target.closest('[data-goto]');
  if (!btn) return;
  const v = btn.dataset.goto;
  if (v === 'month') go('month', {});
  else go(v, {});
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && hasOpenSheet()) closeTopSheet();
});

onRoute(() => render());
onRefresh(() => render());
onEditor(({ entry, opts }) => openEditorSheet(entry, opts));

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  setInstallPrompt(e);
  document.dispatchEvent(new Event('mr:installable'));
});

/* ---------- 시작 ---------- */
function warnNoStorage() {
  const node = document.createElement('div');
  node.innerHTML = `
    <div class="sheet-head"><span class="grab"></span><h2>임시 모드로 열렸어요</h2></div>
    <div class="sheet-body">
      <div class="confirm-body">
        이 창에서는 브라우저 저장소를 쓸 수 없어서, 적은 기록이 창을 닫으면 사라집니다.<br><br>
        기록을 남기려면 <b>설정 → 백업 내보내기</b>로 파일에 저장해 두세요. 다음부터는 파일을 <b>다운로드 폴더</b>에 두고 크롬으로 열면 기록이 계속 쌓입니다.
      </div>
    </div>
    <div class="sheet-foot"><button class="btn btn-primary" data-ok style="flex:1">알겠어요</button></div>`;
  const h = showSheet(node, { small: true });
  node.querySelector('[data-ok]').addEventListener('click', () => h.close());
}

async function boot() {
  await store.init();
  applyTheme();
  render();

  const afterOnboarding = () => {
    applyTheme();
    render();
    if (store.persistMode === 'memory') warnNoStorage();
  };

  if (!store.settings.onboarded) showOnboarding(afterOnboarding);
  else if (store.persistMode === 'memory') warnNoStorage();

  // 서비스 워커 — http(s)에서만 등록 (file://·content:// 에서는 등록이 실패하므로 건너뜀)
  // 상대 경로 — GitHub Pages 하위 경로 대응. 단일 HTML 번들(window.__MOON_SINGLE_FILE__)에서는 sw.js가 없으므로 제외.
  const httpLike = location.protocol === 'http:' || location.protocol === 'https:';
  if (!window.__MOON_SINGLE_FILE__ && httpLike && 'serviceWorker' in navigator) {
    const registerSW = () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 등록 실패', e));
    // boot() 가 늦게 끝나 load 가 이미 지나갔을 수 있으므로 상태를 확인해 등록
    if (document.readyState === 'complete') registerSW();
    else window.addEventListener('load', registerSW);
  }

  // 시스템 테마 변경 반영
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (store.settings.theme === 'system') applyTheme();
    });
  }
}

document.addEventListener('mr:installable', () => render());

boot();

// 디버그/테스트용
window.__moon = { store, navState, go, refresh, render, toast };
