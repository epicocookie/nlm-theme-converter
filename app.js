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

function renderPreview() {
  if (!sourceHtml) return;
  previewFrame.srcdoc = enhanceHtml(sourceHtml);
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
  if (sourceHtml) renderPreview();
});

previewBtn.addEventListener('click', renderPreview);
downloadBtn.addEventListener('click', () => {
  if (!sourceHtml) return;
  const output = enhanceHtml(sourceHtml);
  const blob = new Blob([output], { type:'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sourceName.replace(/\.html?$/i,'') + '-' + activeTheme + '-nlm-studio.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusEl.textContent = 'Enhanced quiz downloaded.';
});
