const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const fileCard = document.getElementById('fileCard');
const fileName = document.getElementById('fileName');
const fileMeta = document.getElementById('fileMeta');
const statusEl = document.getElementById('status');
const previewBtn = document.getElementById('previewBtn');
const downloadBtn = document.getElementById('downloadBtn');
const previewFrame = document.getElementById('previewFrame');
const previewEmpty = document.getElementById('previewEmpty');
const themeList = document.getElementById('themeList');

let sourceHtml = '';
let sourceName = 'quiz.html';
let activeTheme = 'nlm-dark';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const LARGE_FILE_WARNING_BYTES = 10 * 1024 * 1024;
const WORKSPACE_DB_NAME = 'nlm-quiz-studio';
const WORKSPACE_STORE = 'workspace';
const WORKSPACE_KEY = 'last-imported-quiz';
const PREVIEW_PROGRESS_PREFIX = 'nlm-preview-progress:';
const PREVIEW_ORDER_PREFIX = 'nlm-preview-order:';
const THEME_STORAGE_KEY = 'nlm-studio-theme';

function openWorkspaceDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(WORKSPACE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

async function cacheWorkspace() {
  if (!sourceHtml) return;
  try {
    const db = await openWorkspaceDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
      tx.objectStore(WORKSPACE_STORE).put({ id: WORKSPACE_KEY, sourceHtml, sourceName, savedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (_) {}
}

async function readCachedWorkspace() {
  try {
    const db = await openWorkspaceDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_STORE, 'readonly');
      const request = tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  } catch (_) {
    return null;
  }
}

function readPreviewProgress(quizId) {
  try {
    const raw = localStorage.getItem(PREVIEW_PROGRESS_PREFIX + quizId);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function readPreviewOrder(quizId) {
  try {
    const raw = localStorage.getItem(PREVIEW_ORDER_PREFIX + quizId);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function renderPreview() {
  if (!sourceHtml) return;
  const quizId = quizFingerprint(sourceHtml);
  previewFrame.srcdoc = enhanceHtml(sourceHtml, readPreviewProgress(quizId), readPreviewOrder(quizId));
  previewFrame.hidden = false;
  previewEmpty.hidden = true;
}

async function loadFile(file) {
  if (!file || !file.name.toLowerCase().endsWith('.html')) {
    statusEl.textContent = 'Choose an .html quiz export.';
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    statusEl.textContent = 'That file is over 25 MB. Split the quiz bank into smaller exports so the browser stays responsive.';
    return;
  }
  sourceHtml = await file.text();
  sourceName = file.name;
  const detection = detectQuiz(sourceHtml);
  fileName.textContent = file.name;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(file.size >= 1024 * 1024 ? 1 : 2);
  fileMeta.textContent = detection.compatible ? `${detection.questions} questions · ${detection.rationales} explanations · ${sizeMb} MB` : `HTML loaded · ${sizeMb} MB · compatibility uncertain`;
  fileCard.hidden = false;
  previewBtn.disabled = false;
  downloadBtn.disabled = false;
  const largeWarning = file.size > LARGE_FILE_WARNING_BYTES ? ' Large file detected; preview/export may take a few seconds.' : '';
  statusEl.textContent = detection.compatible ? 'Quiz structure detected. Active content will be sanitized before preview/export.' + largeWarning : 'Loaded, but the export structure looks different from the tested NotebookLM format.' + largeWarning;
  await cacheWorkspace();
  try { localStorage.setItem(THEME_STORAGE_KEY, activeTheme); } catch (_) {}
  renderPreview();
}

fileInput.addEventListener('change', e => loadFile(e.target.files[0]));
['dragenter','dragover'].forEach(type => dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.add('dragging'); }));
['dragleave','drop'].forEach(type => dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.remove('dragging'); }));
dropzone.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));

themeList.addEventListener('click', e => {
  const btn = e.target.closest('.theme-card');
  if (!btn) return;
  activeTheme = btn.dataset.theme;
  themeList.querySelectorAll('.theme-card').forEach(b => b.classList.toggle('active', b === btn));
  try { localStorage.setItem(THEME_STORAGE_KEY, activeTheme); } catch (_) {}
  if (sourceHtml) renderPreview();
});

previewBtn.addEventListener('click', renderPreview);
downloadBtn.addEventListener('click', () => {
  if (!sourceHtml) return;
  const quizId = quizFingerprint(sourceHtml);
  const output = enhanceHtml(sourceHtml, null, readPreviewOrder(quizId));
  const blob = new Blob([output], { type:'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sourceName.replace(/\.html?$/i,'') + '-' + activeTheme + '-nlm-studio.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusEl.textContent = 'Enhanced quiz downloaded.';
});

window.addEventListener('message', event => {
  if (event.source !== previewFrame.contentWindow) return;
  const data = event.data;
  if (!data || typeof data.quizId !== 'string') return;
  try {
    const key = PREVIEW_PROGRESS_PREFIX + data.quizId;
    if (data.type === 'nlm-quiz-restart') {
      localStorage.removeItem(key);
      renderPreview();
      return;
    }
    if (data.type === 'nlm-quiz-shuffle') {
      if (Array.isArray(data.order)) localStorage.setItem(PREVIEW_ORDER_PREFIX + data.quizId, JSON.stringify(data.order.map(String)));
      localStorage.removeItem(key);
      renderPreview();
      return;
    }
    if (data.type !== 'nlm-quiz-progress') return;
    if (data.progress) localStorage.setItem(key, JSON.stringify(data.progress));
    else localStorage.removeItem(key);
  } catch (_) {}
});

async function restoreCachedWorkspace() {
  const cached = await readCachedWorkspace();
  if (!cached?.sourceHtml) return;
  sourceHtml = cached.sourceHtml;
  sourceName = cached.sourceName || 'quiz.html';
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && THEMES[savedTheme]) activeTheme = savedTheme;
  } catch (_) {}
  themeList.querySelectorAll('.theme-card').forEach(b => b.classList.toggle('active', b.dataset.theme === activeTheme));
  const detection = detectQuiz(sourceHtml);
  fileName.textContent = sourceName;
  const sizeMb = (new Blob([sourceHtml]).size / (1024 * 1024)).toFixed(2);
  fileMeta.textContent = detection.compatible
    ? `${detection.questions} questions · ${detection.rationales} explanations · ${sizeMb} MB`
    : `Cached HTML · ${sizeMb} MB · compatibility uncertain`;
  fileCard.hidden = false;
  previewBtn.disabled = false;
  downloadBtn.disabled = false;
  statusEl.textContent = detection.compatible
    ? 'Restored your last quiz from this browser. Saved quiz progress will resume automatically.'
    : 'Restored your last HTML file, but its quiz structure looks unfamiliar.';
  renderPreview();
}

restoreCachedWorkspace();