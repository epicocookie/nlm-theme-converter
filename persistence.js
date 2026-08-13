function quizFingerprintFromDocument(doc) {
  const parts = [...doc.querySelectorAll('.question')].map(q => {
    const question = q.querySelector('.q-text')?.textContent.trim() || '';
    const options = [...q.querySelectorAll('.option')].map(o => {
      const text = o.querySelector('.opt-text')?.textContent.trim() || o.textContent.trim();
      return (o.dataset.correct === 'true' ? '1:' : '0:') + text;
    });
    return [question, ...options].join('\u241f');
  });
  const signature = parts.join('\u241e');
  let hash = 2166136261;
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'q-' + parts.length + '-' + (hash >>> 0).toString(36);
}

function quizFingerprint(html) {
  return quizFingerprintFromDocument(new DOMParser().parseFromString(html, 'text/html'));
}

function persistenceRuntimeScript() {
  return `(() => {
    const questions = [...document.querySelectorAll('.question')];
    if (!questions.length || document.documentElement.dataset.nlmPersistenceReady === '1') return;
    document.documentElement.dataset.nlmPersistenceReady = '1';

    const fingerprint = () => {
      const parts = questions.map(q => {
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

    const quizId = fingerprint();
    const storageKey = 'nlm-quiz-progress:' + quizId;
    let restoring = false;

    const readProgress = () => {
      let saved = null;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) saved = JSON.parse(raw);
      } catch (_) {}
      if (!saved) {
        const initial = document.documentElement.dataset.nlmInitialProgress;
        if (initial) {
          try { saved = JSON.parse(initial); } catch (_) {}
        }
      }
      document.documentElement.removeAttribute('data-nlm-initial-progress');
      return saved;
    };

    const snapshot = () => {
      const active = questions.findIndex(q => q.classList.contains('active'));
      const results = document.querySelector('.nlm-results');
      return {
        version: 1,
        total: questions.length,
        current: active >= 0 ? active : 0,
        inResults: !!results && !results.hidden,
        state: questions.map(q => {
          const options = [...q.querySelectorAll('.option')];
          const selected = options.findIndex(o => o.classList.contains('selected'));
          return { selected: selected >= 0 ? selected : null };
        }),
        updatedAt: Date.now()
      };
    };

    const sendToParent = progress => {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'nlm-quiz-progress', quizId, progress }, '*');
        }
      } catch (_) {}
    };

    const saveProgress = () => {
      if (restoring) return;
      const progress = snapshot();
      try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch (_) {}
      sendToParent(progress);
    };

    const clearProgress = () => {
      try { localStorage.removeItem(storageKey); } catch (_) {}
      sendToParent(null);
    };

    const addUi = () => {
      const actions = document.querySelector('.nlm-top-actions');
      if (actions && !actions.querySelector('.nlm-restart-link')) {
        const restart = document.createElement('button');
        restart.className = 'nlm-restart-link';
        restart.type = 'button';
        restart.textContent = 'Restart';
        actions.prepend(restart);
        restart.addEventListener('click', () => {
          if (!window.confirm('Restart this run? All saved answers for this quiz will be cleared.')) return;
          clearProgress();
          document.documentElement.removeAttribute('data-nlm-initial-progress');
          if (window.parent && window.parent !== window) {
            try { window.parent.postMessage({ type: 'nlm-quiz-restart', quizId }, '*'); } catch (_) {}
          } else {
            window.location.reload();
          }
        });
      }

      const style = document.createElement('style');
      style.id = 'nlm-persistence-style';
      style.textContent = '.nlm-restart-link{appearance:none;border:0;background:transparent;color:var(--nlm-muted);font:inherit;font-size:12px;cursor:pointer;padding:7px 8px}.nlm-restart-link:hover{color:var(--nlm-text)}.nlm-resume-toast{position:fixed;z-index:1500;top:66px;left:50%;transform:translate(-50%,-8px);opacity:0;pointer-events:none;padding:9px 13px;border:1px solid var(--nlm-line);border-radius:999px;background:var(--nlm-drawer);color:var(--nlm-text);font-size:12px;box-shadow:0 10px 30px #0003;transition:opacity .2s,transform .2s;white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis}.nlm-resume-toast.show{opacity:1;transform:translate(-50%,0)}';
      document.head.appendChild(style);
    };

    const showResumeToast = saved => {
      const answered = saved.state?.filter(item => Number.isInteger(item?.selected)).length || 0;
      if (!answered && !saved.inResults && !saved.current) return;
      const toast = document.createElement('div');
      toast.className = 'nlm-resume-toast';
      toast.textContent = saved.inResults
        ? 'Restored your completed run · ' + answered + '/' + questions.length + ' answered'
        : 'Resumed at question ' + ((saved.current || 0) + 1) + '/' + questions.length + ' · ' + answered + ' answered';
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 20);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 220);
      }, 3200);
    };

    const restore = saved => {
      if (!saved || saved.total !== questions.length || !Array.isArray(saved.state)) return false;
      restoring = true;
      saved.state.forEach((entry, qi) => {
        if (!Number.isInteger(entry?.selected)) return;
        const options = [...questions[qi].querySelectorAll('.option')];
        const option = options[entry.selected];
        if (option && !option.classList.contains('selected')) option.click();
      });

      const target = Number.isInteger(saved.current) ? Math.max(0, Math.min(questions.length - 1, saved.current)) : 0;
      const counter = document.querySelector('.nlm-counter');
      if (counter) {
        counter.click();
        const jumps = [...document.querySelectorAll('.nlm-qjump')];
        jumps[target]?.click();
      }
      if (saved.inResults) document.querySelector('.nlm-review-link')?.click();
      restoring = false;
      saveProgress();
      showResumeToast(saved);
      return true;
    };

    addUi();
    const saved = readProgress();
    if (saved) restore(saved);

    document.addEventListener('click', event => {
      const relevant = event.target.closest?.('.option,.nlm-nav-btn,.nlm-qjump,.nlm-counter,.nlm-review-link');
      if (!relevant) return;
      setTimeout(saveProgress, 30);
    });
  })();`;
}

const baseEnhancerScript = enhancerScript;
enhancerScript = function () {
  return baseEnhancerScript() + '\n' + persistenceRuntimeScript();
};

const baseEnhanceHtml = enhanceHtml;
enhanceHtml = function (html, initialProgress = null) {
  const output = baseEnhanceHtml(html);
  const doc = new DOMParser().parseFromString(output, 'text/html');
  doc.documentElement.dataset.nlmQuizId = quizFingerprintFromDocument(doc);
  if (initialProgress) doc.documentElement.dataset.nlmInitialProgress = JSON.stringify(initialProgress);
  else doc.documentElement.removeAttribute('data-nlm-initial-progress');
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
};
