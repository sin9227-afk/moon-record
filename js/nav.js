/* 화면 이동 상태 */
import { todayISO } from './util.js';

const now = new Date();

export const navState = {
  view: 'month',     // month | day | search | dday | settings
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  day: todayISO(),
  query: '',
};

const fire = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

export function go(view, params = {}) {
  Object.assign(navState, params, { view });
  fire('mr:route', { view });
}

export function openDay(date) {
  navState.day = date;
  go('day');
}

export function refresh() { fire('mr:refresh', {}); }

export function openEditor(entry = null, opts = {}) { fire('mr:editor', { entry, opts }); }

export function onRoute(fn) { document.addEventListener('mr:route', fn); }
export function onRefresh(fn) { document.addEventListener('mr:refresh', fn); }
export function onEditor(fn) { document.addEventListener('mr:editor', (e) => fn(e.detail)); }
