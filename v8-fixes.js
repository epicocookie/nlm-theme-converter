// V8 compatibility fixes: content normalization, theme font consistency,
// persistence-safe quiz identity, and sandbox-safe restart behavior.

const V8_LATEX_TEXT_COMMANDS = new Set([
  'text', 'textrm', 'textsf', 'texttt', 'mathrm', 'mathbf', 'mathit', 'operatorname'
]);

function v8UnwrapLatexTextCommands(value) {
  let output = '';
  for (let i = 0; i < value.length;) {
    if (value[i] !== '\\') {
      output += value[i++];
      continue;
    }

    let slashEnd = i;
    while (slashEnd < value.length && value[slashEnd] === '\\') slashEnd++;
    let j = slashEnd;
    while (j < value.length && /[A-Za-z]/.test(value[j])) j++;
    const command = value.slice(slashEnd, j);
    if (!V8_LATEX_TEXT_COMMANDS.has(command) || value[j] !== '{') {
      output += value[i++];
      continue;
    }

    let depth = 1;
    let k = j + 1;
    while (k < value.length && depth > 0) {
      if (value[k] === '{') depth++;
      else if (value[k] === '}') depth--;
      k++;
    }
    if (depth !== 0) {
      output += value[i++];
      continue;
    }

    output += v8UnwrapLatexTextCommands(value.slice(j + 1, k - 1));
    i = k;
  }
  return output;
}

function v8NormalizeMathText(value, aggressive = false) {
  const source = value || '';
  const hadLatexSyntax = /\\[A-Za-z]+/.test(source);
  let output = v8UnwrapLatexTextCommands(source)
    .replace(/\\left\b/g, '')
    .replace(/\\right\b/g, '')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\\(?:leq|le)\b/g, '≤')
    .replace(/\\(?:geq|ge)\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\(?:rightarrow|to)\b/g, '→')
    .replace(/\\pm\b/g, '±')
    .replace(/\\infty\b/g, '∞');

  if (aggressive) {
    // Repair exporter artifacts such as `textHTKT-XH` only in formula-like content.
    const boundary = '(^|[\\s(=+\\-×·/:;,])';
    const uppercaseCommand = new RegExp(boundary + 'text(?=[A-ZĐ])', 'g');
    const commandCount = (output.match(new RegExp(boundary + 'text(?=[A-Za-zÀ-ỹĐđ])', 'g')) || []).length;
    const formulaLike = /[=+×·]/.test(output) || commandCount > 1;
    output = output.replace(uppercaseCommand, '$1');
    if (formulaLike) output = output.replace(new RegExp(boundary + 'text(?=[a-zà-ỹđ])', 'g'), '$1');
  }

  if (aggressive || hadLatexSyntax) output = output.replace(/\$\$?/g, '');
  return output.replace(/[ \t]{2,}/g, ' ');
}

function v8LooksLikeFlattenedLatex(value) {
  if (!/[=+×·]/.test(value || '')) return false;
  const matches = (value || '').match(/(^|[\s(=+\-×·/:;,])text(?=[A-Za-zÀ-ỹĐđ])/g) || [];
  return matches.length >= 2;
}

function v8NormalizeImportedQuizContent(doc) {
  doc.querySelectorAll('.q-text,.opt-text,.hint-content,.feedback-rationale').forEach(root => {
    const mathRoot = root.matches('.math,.math-block') || root.closest('.math,.math-block');
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const original = node.nodeValue || '';
      const inMath = mathRoot || node.parentElement?.closest('.math,.math-block');
      const normalized = v8NormalizeMathText(original, !!inMath || v8LooksLikeFlattenedLatex(original));
      if (normalized !== original) node.nodeValue = normalized;
    });
  });

  doc.querySelectorAll('.option[data-rationale]').forEach(option => {
    option.dataset.rationale = v8NormalizeMathText(option.dataset.rationale || '', false).trim();
  });
}

const v8BaseSanitizeImportedDocument = sanitizeImportedDocument;
sanitizeImportedDocument = function(doc) {
  v8BaseSanitizeImportedDocument(doc);
  v8NormalizeImportedQuizContent(doc);
};

// The preview and the generated quiz must derive their storage key from the same
// normalized question text or theme changes can appear to lose progress.
quizFingerprint = function(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  v8NormalizeImportedQuizContent(doc);
  return quizFingerprintFromDocument(doc);
};

const v8BaseThemeCss = themeCss;
themeCss = function(theme) {
  return v8BaseThemeCss(theme) + `
    button,input,select,textarea{font-family:var(--nlm-font)!important}
    .math,.math-block{font-family:var(--nlm-font)!important;font-style:normal!important}
    .math-block{font-size:1em!important}
    .frac,.sqrt,.sqrt-content{font-family:"Cambria Math","STIX Two Math","Times New Roman",serif!important}
  `;
};

function v8RestartRuntimeScript() {
  return `(() => {
    const restart = document.querySelector('.nlm-restart-link');
    if (!restart || document.querySelector('.nlm-v8-restart-confirm')) return;
    const quizId = document.documentElement.dataset.nlmQuizId || '';
    const layer = document.createElement('div');
    layer.className = 'nlm-v8-restart-confirm';
    layer.innerHTML = '<div class="nlm-v8-restart-card" role="dialog" aria-modal="true" aria-labelledby="nlm-v8-restart-title"><strong id="nlm-v8-restart-title">Restart this run?</strong><p>All saved answers for this quiz will be cleared.</p><div class="nlm-v8-restart-actions"><button type="button" data-v8-cancel>Cancel</button><button type="button" class="danger" data-v8-confirm>Restart</button></div></div>';
    document.body.appendChild(layer);

    const style = document.createElement('style');
    style.id = 'nlm-v8-runtime-style';
    style.textContent = '.nlm-v8-restart-confirm{position:fixed;inset:0;z-index:1800;display:none;align-items:center;justify-content:center;padding:20px;background:#0007}.nlm-v8-restart-confirm.open{display:flex}.nlm-v8-restart-card{width:min(360px,100%);border:1px solid var(--nlm-line);border-radius:16px;background:var(--nlm-drawer);color:var(--nlm-text);padding:20px;box-shadow:0 18px 60px #0005}.nlm-v8-restart-card strong{display:block;font-size:16px}.nlm-v8-restart-card p{margin:8px 0 18px;color:var(--nlm-muted);font-size:13px;line-height:1.5}.nlm-v8-restart-actions{display:flex;justify-content:flex-end;gap:8px}.nlm-v8-restart-actions button{border:1px solid var(--nlm-line);border-radius:10px;background:var(--nlm-option);color:var(--nlm-text);font:inherit;font-size:13px;font-weight:600;padding:9px 13px;cursor:pointer}.nlm-v8-restart-actions .danger{border-color:var(--nlm-red);background:var(--nlm-red-bg);color:var(--nlm-red-text)}';
    document.head.appendChild(style);

    const close = () => layer.classList.remove('open');
    const perform = () => {
      close();
      try { if (quizId) localStorage.removeItem('nlm-quiz-progress:' + quizId); } catch (_) {}
      document.documentElement.removeAttribute('data-nlm-initial-progress');
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'nlm-quiz-restart', quizId }, '*'); } catch (_) {}
      } else {
        window.location.reload();
      }
    };

    // Capture phase prevents the older window.confirm handler from running inside
    // the sandbox, where native modals are intentionally unavailable.
    restart.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      layer.classList.add('open');
    }, true);
    layer.querySelector('[data-v8-cancel]').addEventListener('click', close);
    layer.querySelector('[data-v8-confirm]').addEventListener('click', perform);
    layer.addEventListener('click', event => { if (event.target === layer) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  })();`;
}

// Fix wrong-only exports carrying runtime-only persistence markers, and append
// the sandbox-safe restart controller. Keep the patch scoped to exact engine
// snippets so unrelated imported content is untouched.
const v8BaseEnhancerScript = enhancerScript;
enhancerScript = function() {
  let code = v8BaseEnhancerScript();

  const cleanupNeedle = "doc.querySelectorAll('.nlm-topbar,.nlm-footer-nav,.nlm-drawer-backdrop,.nlm-results,.nlm-print-sheet').forEach(el => el.remove());";
  if (code.includes(cleanupNeedle)) {
    code = code.replace(cleanupNeedle, cleanupNeedle + `
      doc.getElementById('nlm-persistence-style')?.remove();
      doc.getElementById('nlm-v8-runtime-style')?.remove();
      doc.querySelectorAll('.nlm-v8-restart-confirm').forEach(el => el.remove());
      doc.documentElement.removeAttribute('data-nlm-persistence-ready');
      doc.documentElement.removeAttribute('data-nlm-quiz-id');
      doc.documentElement.removeAttribute('data-nlm-initial-progress');`);
  }

  const resetNeedle = "doc.querySelectorAll('.question').forEach((q, i) => q.classList.toggle('active', i === 0));";
  if (code.includes(resetNeedle)) {
    code = code.replace(resetNeedle, `const keptQuestions = [...doc.querySelectorAll('.question')];
      keptQuestions.forEach((q, i) => {
        q.classList.toggle('active', i === 0);
        q.dataset.index = i;
        const qNumber = q.querySelector('.q-number');
        if (qNumber) qNumber.textContent = (i + 1) + '/' + keptQuestions.length;
        const qOf = q.querySelector('.q-of');
        if (qOf) qOf.textContent = '/ ' + keptQuestions.length;
      });
      const meta = doc.querySelector('.header .meta');
      if (meta) meta.textContent = keptQuestions.length + ' question' + (keptQuestions.length === 1 ? '' : 's');
      const fill = doc.querySelector('.progress-fill');
      if (fill) fill.style.width = '0%';`);
  }

  return code + '\n' + v8RestartRuntimeScript();
};
