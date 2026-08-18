// V8.2: shuffle question order without shuffling answer choices.
// The order is persisted separately from answer progress so Restart keeps the
// current order while Shuffle starts a fresh randomized run.

const V82_ORDER_STORAGE_PREFIX = 'nlm-quiz-order:';

function v82ShufflePrelude() {
  return `
    const nlmInitialQuestions = [...document.querySelectorAll('.question')];
    nlmInitialQuestions.forEach((q, i) => {
      if (!q.dataset.nlmOriginalIndex) q.dataset.nlmOriginalIndex = String(i);
    });

    const nlmCanonicalFingerprint = list => {
      const ordered = [...list].sort((a, b) => Number(a.dataset.nlmOriginalIndex) - Number(b.dataset.nlmOriginalIndex));
      const parts = ordered.map(q => {
        const question = q.querySelector('.q-text')?.textContent.trim() || '';
        const options = [...q.querySelectorAll('.option')].map(o => {
          const text = o.querySelector('.opt-text')?.textContent.trim() || o.textContent.trim();
          return (o.dataset.correct === 'true' ? '1:' : '0:') + text;
        });
        return [question, ...options].join('\\u241f');
      });
      const signature = parts.join('\\u241e');
      let hash = 2166136261;
      for (let i = 0; i < signature.length; i++) {
        hash ^= signature.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return 'q-' + parts.length + '-' + (hash >>> 0).toString(36);
    };

    const nlmShuffleQuizId = document.documentElement.dataset.nlmQuizId || nlmCanonicalFingerprint(nlmInitialQuestions);
    document.documentElement.dataset.nlmQuizId = nlmShuffleQuizId;
    const nlmOrderKey = '${V82_ORDER_STORAGE_PREFIX}' + nlmShuffleQuizId;
    const nlmIds = nlmInitialQuestions.map(q => q.dataset.nlmOriginalIndex);
    const nlmValidOrder = value => Array.isArray(value)
      && value.length === nlmIds.length
      && new Set(value.map(String)).size === nlmIds.length
      && value.every(id => nlmIds.includes(String(id)));

    let nlmSavedOrder = null;
    const nlmInitialOrder = document.documentElement.dataset.nlmInitialOrder;
    if (nlmInitialOrder) {
      try { nlmSavedOrder = JSON.parse(nlmInitialOrder); } catch (_) {}
      document.documentElement.removeAttribute('data-nlm-initial-order');
    }
    if (!nlmValidOrder(nlmSavedOrder)) {
      try {
        const raw = localStorage.getItem(nlmOrderKey);
        if (raw) nlmSavedOrder = JSON.parse(raw);
      } catch (_) {}
    }

    if (nlmValidOrder(nlmSavedOrder)) {
      const byId = new Map(nlmInitialQuestions.map(q => [q.dataset.nlmOriginalIndex, q]));
      const parent = nlmInitialQuestions[0]?.parentElement;
      const anchor = parent?.querySelector('#results') || null;
      if (parent) nlmSavedOrder.forEach(id => parent.insertBefore(byId.get(String(id)), anchor));
      try { localStorage.setItem(nlmOrderKey, JSON.stringify(nlmSavedOrder.map(String))); } catch (_) {}
    }
  `;
}

function v82ShuffleRuntimeScript() {
  return `(() => {
    const actions = document.querySelector('.nlm-top-actions');
    if (!actions || actions.querySelector('.nlm-shuffle-link')) return;

    const questions = [...document.querySelectorAll('.question')];
    if (questions.length < 2) return;
    questions.forEach((q, i) => {
      if (!q.dataset.nlmOriginalIndex) q.dataset.nlmOriginalIndex = String(i);
    });

    const quizId = document.documentElement.dataset.nlmQuizId || '';
    const orderKey = '${V82_ORDER_STORAGE_PREFIX}' + quizId;
    const progressKey = 'nlm-quiz-progress:' + quizId;

    const shuffle = document.createElement('button');
    shuffle.className = 'nlm-shuffle-link';
    shuffle.type = 'button';
    shuffle.textContent = 'Shuffle';
    const restart = actions.querySelector('.nlm-restart-link');
    if (restart) restart.insertAdjacentElement('afterend', shuffle);
    else actions.prepend(shuffle);

    const layer = document.createElement('div');
    layer.className = 'nlm-v82-shuffle-confirm';
    layer.innerHTML = '<div class="nlm-v82-shuffle-card" role="dialog" aria-modal="true" aria-labelledby="nlm-v82-shuffle-title"><strong id="nlm-v82-shuffle-title">Shuffle questions?</strong><p></p><div class="nlm-v82-shuffle-actions"><button type="button" data-v82-cancel>Cancel</button><button type="button" class="primary" data-v82-confirm>Shuffle</button></div></div>';
    document.body.appendChild(layer);

    const close = () => layer.classList.remove('open');
    const makeOrder = () => {
      const order = questions.map(q => q.dataset.nlmOriginalIndex);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const current = questions.map(q => q.dataset.nlmOriginalIndex);
      if (order.length > 1 && order.every((id, i) => id === current[i])) {
        [order[0], order[1]] = [order[1], order[0]];
      }
      return order;
    };

    const perform = () => {
      close();
      const order = makeOrder();
      try {
        localStorage.setItem(orderKey, JSON.stringify(order));
        localStorage.removeItem(progressKey);
      } catch (_) {}
      document.documentElement.removeAttribute('data-nlm-initial-progress');
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'nlm-quiz-shuffle', quizId, order }, '*'); } catch (_) {}
      } else {
        window.location.reload();
      }
    };

    shuffle.addEventListener('click', () => {
      const answered = document.querySelectorAll('.option.selected').length;
      layer.querySelector('p').textContent = answered
        ? 'This starts a fresh run in a new question order and clears your current answers.'
        : 'This starts a fresh run in a new randomized question order.';
      layer.classList.add('open');
    });
    layer.querySelector('[data-v82-cancel]').addEventListener('click', close);
    layer.querySelector('[data-v82-confirm]').addEventListener('click', perform);
    layer.addEventListener('click', event => { if (event.target === layer) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  })();`;
}

const v82BaseThemeCss = themeCss;
themeCss = function(theme) {
  return v82BaseThemeCss(theme) + `
    .nlm-shuffle-link{appearance:none;border:0;background:transparent;color:var(--nlm-muted);font-family:Arial,"Helvetica Neue",sans-serif!important;font-size:12px;cursor:pointer;padding:6px 8px;border-radius:8px}
    .nlm-shuffle-link:hover{color:var(--nlm-text);background:var(--nlm-option-hover)}
    .nlm-v82-shuffle-confirm{position:fixed;inset:0;z-index:1820;display:none;align-items:center;justify-content:center;padding:20px;background:#0007}.nlm-v82-shuffle-confirm.open{display:flex}.nlm-v82-shuffle-card{width:min(370px,100%);border:1px solid var(--nlm-line);border-radius:16px;background:var(--nlm-drawer);color:var(--nlm-text);padding:20px;box-shadow:0 18px 60px #0005}.nlm-v82-shuffle-card strong{display:block;font-size:16px}.nlm-v82-shuffle-card p{margin:8px 0 18px;color:var(--nlm-muted);font-family:Arial,"Helvetica Neue",sans-serif;font-size:13px;line-height:1.5}.nlm-v82-shuffle-actions{display:flex;justify-content:flex-end;gap:8px}.nlm-v82-shuffle-actions button{border:1px solid var(--nlm-line);border-radius:10px;background:var(--nlm-option);color:var(--nlm-text);font-family:Arial,"Helvetica Neue",sans-serif!important;font-size:13px;font-weight:600;padding:9px 13px;cursor:pointer}.nlm-v82-shuffle-actions .primary{border-color:var(--nlm-accent);background:var(--nlm-btn);color:var(--nlm-btn-text)}
  `;
};

const v82BaseEnhancerScript = enhancerScript;
enhancerScript = function() {
  let code = v82BaseEnhancerScript();
  const startNeedle = "(() => {\n    const questions = [...document.querySelectorAll('.question')];";
  if (code.includes(startNeedle)) {
    code = code.replace(startNeedle, "(() => {" + v82ShufflePrelude() + "\n    const questions = [...document.querySelectorAll('.question')];");
  }

  // Persistence should use the canonical quiz id assigned before any runtime
  // reordering so saved answers stay attached to the same quiz across shuffles.
  code = code.replace(
    "const quizId = fingerprint();",
    "const quizId = document.documentElement.dataset.nlmQuizId || fingerprint();"
  );

  return code + '\n' + v82ShuffleRuntimeScript();
};

const v82BaseEnhanceHtml = enhanceHtml;
enhanceHtml = function(html, initialProgress = null, initialOrder = null) {
  const output = v82BaseEnhanceHtml(html, initialProgress);
  const doc = new DOMParser().parseFromString(output, 'text/html');
  [...doc.querySelectorAll('.question')].forEach((q, i) => {
    if (!q.dataset.nlmOriginalIndex) q.dataset.nlmOriginalIndex = String(i);
  });
  if (Array.isArray(initialOrder)) doc.documentElement.dataset.nlmInitialOrder = JSON.stringify(initialOrder.map(String));
  else doc.documentElement.removeAttribute('data-nlm-initial-order');
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
};
