/* 저장소 — IndexedDB(사진·기록) + localStorage(설정·텍스트 기록 미러) */
import { todayISO } from './util.js';

const DB_NAME = 'moonrecord';
const DB_VER = 1;
const LS_SETTINGS = 'moonrecord.settings.v1';
const LS_ENTRIES = 'moonrecord.entries.v1';
const LS_DDAYS = 'moonrecord.ddays.v1';

export const DEFAULT_SETTINGS = {
  onboarded: false,
  theme: 'system',          // system | light | dark
  accent: 'violet',         // violet | rose | sage | amber | sky
  quote: '흐릿한 기록은 또렷한 기억보다 더 가치 있다.',
  motto: '',
  showQuote: true,
  weekStart: 0,             // 0=일요일, 1=월요일
  showLunar: true,
  calScale: 'md',           // sm | md | lg — 캘린더 글씨 크기
  showGrid: true,
  showHolidayName: true,
  dayStyle: 'card',         // chip | card | timeline
  showPhotosInList: true,
  showDoneInList: true,
  showDividers: true,
  fontSizeScale: 'md',      // sm | md | lg
};

const uid = (p = 'e') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function readLS(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('ddays')) db.createObjectStore('ddays', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb open failed'));
    req.onblocked = () => reject(new Error('idb blocked'));
  });
}

function tx(db, stores, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const res = fn(t);
    t.oncomplete = () => resolve(res);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('tx aborted'));
  });
}

function reqPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function dataURLToBlob(url) {
  const r = await fetch(url);
  return await r.blob();
}

/** 이미지 리사이징: 긴 변 maxSide, JPEG 압축 + 썸네일 */
async function makePhoto(file, maxSide = 1600, quality = 0.82) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const sw = bitmap.width, sh = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));

  const draw = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    return c;
  };
  const toBlob = (canvas, q) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));

  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const mainBlob = await toBlob(draw(w, h), quality);
  const tScale = Math.min(1, 420 / Math.max(sw, sh));
  const thumbBlob = await toBlob(draw(Math.round(sw * tScale), Math.round(sh * tScale)), 0.7);
  if (bitmap.close) bitmap.close();
  return { blob: mainBlob || file, thumb: thumbBlob || mainBlob || file, w, h };
}

export const store = {
  db: null,
  idbOK: false,
  persistMode: 'idb',   // idb | ls | memory
  entries: [],
  ddays: [],
  settings: { ...DEFAULT_SETTINGS },
  photos: new Map(),       // id -> { id, blob, thumb, w, h, mime }
  _urls: new Map(),
  _thumbUrls: new Map(),

  async init() {
    const lsSettings = readLS(LS_SETTINGS);
    this.settings = { ...DEFAULT_SETTINGS, ...(lsSettings || {}) };

    try {
      this.db = await idbOpen();
      this.idbOK = true;
    } catch (e) {
      this.idbOK = false;
      console.warn('IndexedDB 사용 불가, localStorage로 동작합니다.', e);
    }
    // 저장 방식: idb(권장) → ls(localStorage만) → memory(둘 다 막힘: content:// 등)
    this.persistMode = this.idbOK ? 'idb' : (writeLS('moonrecord.probe', 1) ? 'ls' : 'memory');

    if (this.idbOK) {
      try {
        this.entries = (await reqPromise(this.db.transaction('entries').objectStore('entries').getAll())) || [];
        this.ddays = (await reqPromise(this.db.transaction('ddays').objectStore('ddays').getAll())) || [];
        const metaSettings = await reqPromise(this.db.transaction('meta').objectStore('meta').get('settings'));
        if (metaSettings && metaSettings.v) this.settings = { ...this.settings, ...metaSettings.v };
        const photos = (await reqPromise(this.db.transaction('photos').objectStore('photos').getAll())) || [];
        for (const p of photos) this.photos.set(p.id, p);
      } catch (e) {
        console.warn('불러오기 실패', e);
      }
    }

    // localStorage 미러와 대조 (IndexedDB가 비었을 때 복구)
    if (!this.entries.length) {
      const lsEntries = readLS(LS_ENTRIES);
      if (Array.isArray(lsEntries)) this.entries = lsEntries;
    }
    if (!this.ddays.length) {
      const lsDdays = readLS(LS_DDAYS);
      if (Array.isArray(lsDdays)) this.ddays = lsDdays;
    }
    this.mirror();
    return this;
  },

  newId: uid,

  mirror() {
    writeLS(LS_SETTINGS, this.settings);
    writeLS(LS_ENTRIES, this.entries);
    writeLS(LS_DDAYS, this.ddays);
    if (this.idbOK && this.db) {
      try {
        const t = this.db.transaction('meta', 'readwrite');
        t.objectStore('meta').put({ k: 'settings', v: this.settings });
      } catch { /* ignore */ }
    }
  },

  saveSettings(patch = {}) {
    this.settings = { ...this.settings, ...patch };
    this.mirror();
    return this.settings;
  },

  getEntry(id) { return this.entries.find((e) => e.id === id) || null; },

  async saveEntry(entry) {
    const now = new Date().toISOString();
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    const rec = { ...entry, updated: now, created: entry.created || now };
    if (idx >= 0) this.entries[idx] = rec; else this.entries.push(rec);
    if (this.idbOK && this.db) {
      const t = this.db.transaction('entries', 'readwrite');
      t.objectStore('entries').put(rec);
    }
    this.mirror();
    return rec;
  },

  async deleteEntry(id, { onlyDate = null } = {}) {
    const entry = this.getEntry(id);
    if (!entry) return;
    if (onlyDate) {
      const ex = new Set(entry.exdates || []);
      ex.add(onlyDate);
      entry.exdates = [...ex];
      await this.saveEntry(entry);
      return;
    }
    for (const pid of entry.photos || []) await this.deletePhoto(pid);
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.idbOK && this.db) {
      const t = this.db.transaction('entries', 'readwrite');
      t.objectStore('entries').delete(id);
    }
    this.mirror();
  },

  async saveDday(dday) {
    const idx = this.ddays.findIndex((d) => d.id === dday.id);
    if (idx >= 0) this.ddays[idx] = dday; else this.ddays.push(dday);
    if (this.idbOK && this.db) {
      const t = this.db.transaction('ddays', 'readwrite');
      t.objectStore('ddays').put(dday);
    }
    this.mirror();
    return dday;
  },

  async deleteDday(id) {
    this.ddays = this.ddays.filter((d) => d.id !== id);
    if (this.idbOK && this.db) {
      const t = this.db.transaction('ddays', 'readwrite');
      t.objectStore('ddays').delete(id);
    }
    this.mirror();
  },

  /* ---------- 사진 ---------- */
  async addPhoto(file) {
    const { blob, thumb, w, h } = await makePhoto(file);
    const id = uid('ph');
    const rec = { id, blob, thumb, w, h, mime: blob.type || 'image/jpeg', created: Date.now() };
    this.photos.set(id, rec);
    if (this.idbOK && this.db) {
      const t = this.db.transaction('photos', 'readwrite');
      t.objectStore('photos').put(rec);
    }
    return { id, w, h };
  },

  async deletePhoto(id) {
    const rec = this.photos.get(id);
    if (this._urls.has(id)) { URL.revokeObjectURL(this._urls.get(id)); this._urls.delete(id); }
    if (this._thumbUrls.has(id)) { URL.revokeObjectURL(this._thumbUrls.get(id)); this._thumbUrls.delete(id); }
    this.photos.delete(id);
    if (rec && this.idbOK && this.db) {
      const t = this.db.transaction('photos', 'readwrite');
      t.objectStore('photos').delete(id);
    }
  },

  photoURL(id) {
    const rec = this.photos.get(id);
    if (!rec) return '';
    if (!this._urls.has(id)) this._urls.set(id, URL.createObjectURL(rec.blob));
    return this._urls.get(id);
  },

  thumbURL(id) {
    const rec = this.photos.get(id);
    if (!rec) return '';
    if (!this._thumbUrls.has(id)) this._thumbUrls.set(id, URL.createObjectURL(rec.thumb || rec.blob));
    return this._thumbUrls.get(id);
  },

  /* ---------- 백업 ---------- */
  async exportJSON({ includePhotos = true } = {}) {
    const photos = [];
    if (includePhotos) {
      for (const [id, p] of this.photos) {
        photos.push({ id, mime: p.mime || 'image/jpeg', data: await blobToDataURL(p.blob) });
      }
    }
    return JSON.stringify({
      app: 'moon-record',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      entries: this.entries,
      ddays: this.ddays,
      photos,
    }, null, 1);
  },

  async importJSON(text, { mode = 'merge' } = {}) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.entries)) throw new Error('백업 파일 형식이 아닙니다.');
    if (mode === 'replace') {
      for (const id of [...this.photos.keys()]) await this.deletePhoto(id);
      this.entries = [];
      this.ddays = [];
      if (this.idbOK && this.db) {
        for (const s of ['entries', 'ddays']) {
          const t = this.db.transaction(s, 'readwrite');
          t.objectStore(s).clear();
        }
      }
    }
    let addedEntries = 0, addedPhotos = 0;
    for (const p of data.photos || []) {
      if (!p.id || this.photos.has(p.id) || !p.data) continue;
      const blob = await dataURLToBlob(p.data);
      const rec = { id: p.id, blob, thumb: blob, w: 0, h: 0, mime: p.mime || blob.type, created: Date.now() };
      this.photos.set(p.id, rec);
      if (this.idbOK && this.db) {
        const t = this.db.transaction('photos', 'readwrite');
        t.objectStore('photos').put(rec);
      }
      addedPhotos++;
    }
    for (const e of data.entries) {
      if (!e || !e.id || !e.date) continue;
      const cur = this.getEntry(e.id);
      if (cur && cur.updated && e.updated && cur.updated >= e.updated) continue;
      const idx = this.entries.findIndex((x) => x.id === e.id);
      if (idx >= 0) this.entries[idx] = e; else this.entries.push(e);
      if (this.idbOK && this.db) {
        const t = this.db.transaction('entries', 'readwrite');
        t.objectStore('entries').put(e);
      }
      addedEntries++;
    }
    for (const d of data.ddays || []) {
      if (!d || !d.id || !d.date) continue;
      const idx = this.ddays.findIndex((x) => x.id === d.id);
      if (idx >= 0) this.ddays[idx] = d; else this.ddays.push(d);
      if (this.idbOK && this.db) {
        const t = this.db.transaction('ddays', 'readwrite');
        t.objectStore('ddays').put(d);
      }
    }
    if (mode === 'replace' && data.settings) this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    this.mirror();
    return { addedEntries, addedPhotos, totalEntries: data.entries.length };
  },

  async storageInfo() {
    let usage = 0, quota = 0;
    try {
      const est = await navigator.storage.estimate();
      usage = est.usage || 0;
      quota = est.quota || 0;
    } catch { /* ignore */ }
    let photoBytes = 0;
    for (const p of this.photos.values()) photoBytes += (p.blob?.size || 0) + (p.thumb?.size || 0);
    return { usage, quota, photoBytes, photoCount: this.photos.size, entries: this.entries.length, ddays: this.ddays.length, idbOK: this.idbOK, persistMode: this.persistMode };
  },

  async clearAll() {
    for (const id of [...this.photos.keys()]) await this.deletePhoto(id);
    this.entries = [];
    this.ddays = [];
    if (this.idbOK && this.db) {
      for (const s of ['entries', 'ddays', 'photos']) {
        const t = this.db.transaction(s, 'readwrite');
        t.objectStore(s).clear();
      }
    }
    try { localStorage.removeItem(LS_ENTRIES); localStorage.removeItem(LS_DDAYS); } catch { /* ignore */ }
    this.mirror();
  },
};

export { makePhoto, blobToDataURL };
export const TODAY = todayISO;
