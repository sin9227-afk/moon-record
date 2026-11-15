/* 첫 실행 온보딩 */
import { esc, ICON, COLORS, COLOR_LABEL } from '../util.js';
import { store } from '../store.js';
import { applyTheme, moonSVG } from '../ui.js';

export function showOnboarding(onDone) {
  const s = store.settings;
  let step = 0;
  const draft = { motto: s.motto || '', theme: s.theme || 'system', accent: s.accent || 'violet', quote: s.quote };

  const root = document.createElement('div');
  root.className = 'onboarding';
  root.innerHTML = `
    <div class="ob-step on" data-step="0">
      <div class="ob-hero">
        <div class="ob-moon">${moonSVG(0.16)}</div>
        <h1>달의 기록</h1>
        <p class="ob-quote">흐릿한 기록은<br>또렷한 기억보다 더 가치 있다.</p>
      </div>
      <div class="ob-actions">
        <button class="btn-next" data-next>시작하기</button>
        <button class="btn-skip" data-skip>건너뛰기</button>
      </div>
    </div>

    <div class="ob-step" data-step="1">
      <div class="ob-hero" style="flex:0 0 auto">
      <div class="ob-moon" style="transform:scale(.66);margin-bottom:-6px">${moonSVG(0.32)}</div>
      <h1 style="font-size:22px">이제 마지막입니다</h1>
      <p class="ob-quote" style="margin-bottom:22px">좌우명이나 목표가 있다면 적어보세요.<br>캘린더 위에 은은하게 머뭅니다.</p>
      </div>
      <div class="ob-label">나의 좌우명</div>
      <textarea class="ob-input" data-motto maxlength="120" placeholder="예) 기록하는 사람이 되자">${esc(draft.motto)}</textarea>
      <p class="ob-hint">비워두어도 괜찮아요. 설정에서 언제든 바꿀 수 있습니다.</p>
      <div style="flex:1"></div>
      <div class="ob-actions">
        <button class="btn-next" data-next>다음</button>
        <button class="btn-skip" data-skip>건너뛰기</button>
      </div>
    </div>

    <div class="ob-step" data-step="2">
      <div class="ob-hero" style="flex:0 0 auto">
      <div class="ob-moon" style="transform:scale(.66);margin-bottom:-6px">${moonSVG(0.62)}</div>
      <h1 style="font-size:22px">어떤 밤이 좋으세요?</h1>
      <p class="ob-quote" style="margin-bottom:20px">언제든 설정에서 바꿀 수 있어요.</p>
      </div>
      <div class="theme-row">
        ${[['light', '낮', '#f4f1ea'], ['dark', '밤', '#16131c'], ['system', '자동', 'linear-gradient(135deg,#f4f1ea 0 50%,#16131c 50% 100%)']].map(([v, l, bg]) => `
          <button class="theme-opt ${draft.theme === v ? 'on' : ''}" data-themeopt="${v}">
            <span style="background:${bg};border:1px solid var(--line)"></span>${l}
          </button>`).join('')}
      </div>
      <div class="ob-label" style="margin-top:20px">테마 색</div>
      <div class="swatches">
        ${COLORS.filter((c) => c !== 'sand').map((c) => `<button class="swatch c-${c} ${draft.accent === c ? 'on' : ''}" data-accentopt="${c}" aria-label="${COLOR_LABEL[c]}"><span style="display:block;width:100%;height:100%;border-radius:50%;background:currentColor"></span></button>`).join('')}
      </div>
      <div style="flex:1"></div>
      <div class="ob-actions">
        <button class="btn-next" data-next>달의 기록 시작하기</button>
      </div>
    </div>

    <div class="ob-dots">
      <i class="on" data-dot="0"></i><i data-dot="1"></i><i data-dot="2"></i>
    </div>`;
  document.body.appendChild(root);

  const show = (i) => {
    step = i;
    root.querySelectorAll('.ob-step').forEach((el) => el.classList.toggle('on', Number(el.dataset.step) === i));
    root.querySelectorAll('[data-dot]').forEach((el) => el.classList.toggle('on', Number(el.dataset.dot) === i));
  };

  const finish = () => {
    store.saveSettings({
      onboarded: true,
      motto: draft.motto.trim(),
      theme: draft.theme,
      accent: draft.accent,
    });
    applyTheme();
    root.style.transition = 'opacity .3s';
    root.style.opacity = '0';
    setTimeout(() => root.remove(), 300);
    if (onDone) onDone();
  };

  root.addEventListener('input', (e) => {
    if (e.target.hasAttribute('data-motto')) draft.motto = e.target.value;
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-next],[data-skip],[data-themeopt],[data-accentopt]');
    if (!t) return;
    if (t.dataset.themeopt) {
      draft.theme = t.dataset.themeopt;
      root.querySelectorAll('[data-themeopt]').forEach((b) => b.classList.toggle('on', b.dataset.themeopt === draft.theme));
      store.saveSettings({ theme: draft.theme });
      applyTheme();
      return;
    }
    if (t.dataset.accentopt) {
      draft.accent = t.dataset.accentopt;
      root.querySelectorAll('[data-accentopt]').forEach((b) => b.classList.toggle('on', b.dataset.accentopt === draft.accent));
      store.saveSettings({ accent: draft.accent });
      applyTheme();
      return;
    }
    if (t.hasAttribute('data-skip')) { finish(); return; }
    if (step < 2) show(step + 1);
    else finish();
  });
}
