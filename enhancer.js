const ENHANCER_STYLE_ID = 'nlm-studio-style';
const ENHANCER_SCRIPT_ID = 'nlm-studio-script';

function enhancerScript() {
  return `(() => {
    const questions = [...document.querySelectorAll('.question')];
    if (!questions.length) return;
    const total = questions.length;
    const state = questions.map(() => ({ selected: null, correct: null }));
    let current = 0;
    let inResults = false;

    const originalResults = document.getElementById('results');
    if (originalResults) originalResults.remove();
    document.querySelectorAll('.option-feedback').forEach(f => f.remove());

    const topbar = document.createElement('div');
    topbar.className = 'nlm-topbar';
    topbar.innerHTML = '<div class="nlm-topbar-inner"><button class="nlm-counter" type="button"></button><div class="nlm-top-actions"><button class="nlm-review-link" type="button">Review</button><button class="nlm-kebab" type="button" aria-label="Question navigator">⋮</button></div></div>';
    document.body.prepend(topbar);

    const footer = document.createElement('div');
    footer.className = 'nlm-footer-nav';
    footer.innerHTML = '<div class="nlm-footer-inner"><button class="nlm-nav-btn" data-action="prev" type="button">Previous</button><button class="nlm-nav-btn primary" data-action="next" type="button">Next</button></div>';
    document.body.appendChild(footer);

    const backdrop = document.createElement('div');
    backdrop.className = 'nlm-drawer-backdrop';
    backdrop.innerHTML = '<aside class="nlm-drawer"><div class="nlm-drawer-head"><strong>Jump to question</strong><button class="nlm-close" type="button">×</button></div><div class="nlm-question-grid"></div><div class="nlm-legend"><span><i class="nlm-dot green"></i>Correct</span><span><i class="nlm-dot red"></i>Wrong</span></div></aside>';
    document.body.appendChild(backdrop);

    const results = document.createElement('section');
    results.className = 'nlm-results';
    results.hidden = true;
    document.body.appendChild(results);

    const counter = topbar.querySelector('.nlm-counter');
    const prevBtn = footer.querySelector('[data-action="prev"]');
    const nextBtn = footer.querySelector('[data-action="next"]');
    const grid = backdrop.querySelector('.nlm-question-grid');

    questions.forEach((q, qi) => {
      q.dataset.nlmIndex = qi;
      q.querySelectorAll('.next-btn').forEach(b => b.remove());
      const hintBox = q.querySelector('.hint-box');
      const hintToggle = q.querySelector('.hint-toggle');
      if (hintBox && hintToggle) hintToggle.addEventListener('click', () => hintBox.classList.toggle('show'));
      q.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected','correct','incorrect','disabled','show-correct');
        opt.addEventListener('click', () => answer(qi, opt));
      });
    });

    function answer(qi, opt) {
      if (state[qi].selected !== null) return;
      const q = questions[qi];
      const options = [...q.querySelectorAll('.option')];
      const selectedIndex = options.indexOf(opt);
      const correctIndex = options.findIndex(o => o.dataset.correct === 'true');
      state[qi] = { selected: selectedIndex, correct: selectedIndex === correctIndex };
      options.forEach(o => o.classList.add('disabled'));
      opt.classList.add('selected', state[qi].correct ? 'correct' : 'incorrect');
      addFeedback(opt, state[qi].correct ? 'correct' : 'incorrect', opt.dataset.rationale || '');
      if (!state[qi].correct && correctIndex >= 0) {
        const correctOpt = options[correctIndex];
        correctOpt.classList.add('show-correct');
        addFeedback(correctOpt, 'correct', correctOpt.dataset.rationale || '');
      }
      renderNav();
      renderChrome();
    }

    function addFeedback(opt, type, rationale) {
      if (opt.querySelector('.nlm-inline-feedback')) return;
      const box = document.createElement('div');
      box.className = 'nlm-inline-feedback';
      box.innerHTML = '<div class="nlm-feedback-status"><span class="nlm-feedback-icon"></span><span class="nlm-feedback-label"></span></div><div class="nlm-rationale"></div>';
      const status = box.querySelector('.nlm-feedback-status');
      status.classList.add(type);
      box.querySelector('.nlm-feedback-icon').textContent = type === 'correct' ? '✓' : '✕';
      box.querySelector('.nlm-feedback-label').textContent = type === 'correct' ? "That's right!" : 'Not quite';
      box.querySelector('.nlm-rationale').textContent = rationale;
      opt.appendChild(box);
    }

    function showQuestion(index) {
      inResults = false;
      results.hidden = true;
      const quizContainer = document.getElementById('quiz-container');
      if (quizContainer) quizContainer.style.display = '';
      current = Math.max(0, Math.min(total - 1, index));
      questions.forEach((q, i) => q.classList.toggle('active', i === current));
      renderChrome();
      renderNav();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderChrome() {
      const answered = state[current].selected !== null;
      counter.textContent = (current + 1) + '/' + total;
      prevBtn.disabled = current === 0;
      nextBtn.textContent = current === total - 1 ? 'See results' : 'Next';
      nextBtn.disabled = !answered;
      footer.hidden = inResults;
      topbar.hidden = inResults;
    }

    function renderNav() {
      grid.replaceChildren();
      state.forEach((s, i) => {
        const b = document.createElement('button');
        b.className = 'nlm-qjump' + (i === current && !inResults ? ' current' : '') + (s.selected === null ? '' : s.correct ? ' correct' : ' wrong');
        b.textContent = i + 1;
        b.type = 'button';
        b.addEventListener('click', () => { closeDrawer(); showQuestion(i); });
        grid.appendChild(b);
      });
    }

    function openDrawer() { renderNav(); backdrop.classList.add('open'); }
    function closeDrawer() { backdrop.classList.remove('open'); }

    function showResults() {
      inResults = true;
      const quizContainer = document.getElementById('quiz-container');
      if (quizContainer) quizContainer.style.display = 'none';
      footer.hidden = true;
      topbar.hidden = true;
      const correctCount = state.filter(s => s.correct === true).length;
      const pct = Math.round((correctCount / total) * 100);
      const wrong = state.map((s,i)=>({s,i})).filter(x => x.s.selected !== null && !x.s.correct);
      const unanswered = state.map((s,i)=>({s,i})).filter(x => x.s.selected === null);
      results.replaceChildren();

      const hero = document.createElement('div');
      hero.className = 'nlm-result-hero';
      hero.innerHTML = '<small>Quiz complete</small><div class="nlm-score"></div><div class="nlm-result-summary"></div><div class="nlm-result-actions"><button class="nlm-nav-btn" data-result="restart">Try again</button><button class="nlm-nav-btn primary" data-result="review"></button><button class="nlm-nav-btn" data-result="pdf">Export Theory Repair PDF</button><button class="nlm-nav-btn" data-result="wrong-quiz">Create Wrong-Only Quiz</button></div>';
      hero.querySelector('.nlm-score').textContent = pct + '%';
      hero.querySelector('.nlm-result-summary').textContent = correctCount + ' correct · ' + wrong.length + ' wrong' + (unanswered.length ? ' · ' + unanswered.length + ' unanswered' : '');
      const reviewButton = hero.querySelector('[data-result="review"]');
      reviewButton.textContent = wrong.length ? 'Review mistakes' : 'Review answers';
      results.appendChild(hero);

      const section = document.createElement('div');
      section.className = 'nlm-result-section';
      const heading = document.createElement('h3');
      heading.textContent = wrong.length ? 'Questions to repair' : 'Review';
      section.appendChild(heading);
      const list = document.createElement('div');
      list.className = 'nlm-mistakes';
      section.appendChild(list);

      if (!wrong.length) {
        const p = document.createElement('div');
        p.className = 'nlm-perfect';
        p.textContent = unanswered.length ? 'No wrong answers yet. Finish the unanswered questions to get a complete score.' : 'Clean sweep. No wrong answers to review.';
        list.appendChild(p);
      } else {
        wrong.forEach(({s,i}) => {
          const q = questions[i];
          const opts = [...q.querySelectorAll('.option')];
          const selected = opts[s.selected];
          const correct = opts.find(o => o.dataset.correct === 'true');
          const card = document.createElement('article');
          card.className = 'nlm-mistake';
          card.innerHTML = '<div class="nlm-mistake-top"><div><div class="nlm-mistake-number"></div><div class="nlm-mistake-question"></div></div></div><div class="nlm-answer-row wrong"><b>Your answer</b><span></span></div><div class="nlm-answer-row correct"><b>Correct answer</b><span></span></div><div class="nlm-answer-row explanation"><b>Explanation</b><span></span></div><button class="nlm-review-q" type="button">Open question →</button>';
          card.querySelector('.nlm-mistake-number').textContent = 'QUESTION ' + (i + 1);
          card.querySelector('.nlm-mistake-question').textContent = q.querySelector('.q-text')?.textContent.trim() || '';
          card.querySelector('.wrong span').textContent = selected?.querySelector('.opt-text')?.textContent.trim() || '';
          card.querySelector('.correct span').textContent = correct?.querySelector('.opt-text')?.textContent.trim() || '';
          card.querySelector('.explanation span').textContent = correct?.dataset.rationale || '';
          card.querySelector('.nlm-review-q').addEventListener('click', () => showQuestion(i));
          list.appendChild(card);
        });
      }
      results.appendChild(section);
      results.hidden = false;
      hero.querySelector('[data-result="restart"]').addEventListener('click', restart);
      reviewButton.addEventListener('click', () => showQuestion(wrong.length ? wrong[0].i : 0));
      const pdfButton = hero.querySelector('[data-result="pdf"]');
      const wrongQuizButton = hero.querySelector('[data-result="wrong-quiz"]');
      pdfButton.disabled = !wrong.length;
      wrongQuizButton.disabled = !wrong.length;
      pdfButton.title = wrong.length ? 'Open the browser print dialog with only missed questions' : 'No wrong answers to export';
      wrongQuizButton.title = wrong.length ? 'Download a fresh quiz containing only missed questions' : 'No wrong answers to retry';
      pdfButton.addEventListener('click', () => exportTheoryRepair(wrong));
      wrongQuizButton.addEventListener('click', () => downloadWrongOnlyQuiz(wrong));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function getWrongDetails(wrong) {
      return wrong.map(({s,i}) => {
        const q = questions[i];
        const opts = [...q.querySelectorAll('.option')];
        const selected = opts[s.selected];
        const correct = opts.find(o => o.dataset.correct === 'true');
        return {
          originalIndex: i,
          question: q.querySelector('.q-text')?.textContent.trim() || '',
          hint: q.querySelector('.hint-content')?.textContent.trim() || '',
          selectedText: selected?.querySelector('.opt-text')?.textContent.trim() || '',
          selectedWhy: selected?.dataset.rationale || '',
          correctText: correct?.querySelector('.opt-text')?.textContent.trim() || '',
          correctWhy: correct?.dataset.rationale || ''
        };
      });
    }

    function exportTheoryRepair(wrong) {
      if (!wrong.length) return;
      document.querySelector('.nlm-print-sheet')?.remove();
      const sheet = document.createElement('section');
      sheet.className = 'nlm-print-sheet';
      const title = document.createElement('h1');
      title.textContent = 'Theory Repair — Missed Questions';
      sheet.appendChild(title);
      const meta = document.createElement('p');
      meta.className = 'nlm-print-meta';
      meta.textContent = wrong.length + ' question' + (wrong.length === 1 ? '' : 's') + ' to repair';
      sheet.appendChild(meta);

      getWrongDetails(wrong).forEach((item) => {
        const card = document.createElement('article');
        card.className = 'nlm-print-card';
        const number = document.createElement('div');
        number.className = 'nlm-print-number';
        number.textContent = 'QUESTION ' + (item.originalIndex + 1);
        const q = document.createElement('h2');
        q.textContent = item.question;
        card.append(number, q);

        const addRow = (label, text, cls) => {
          if (!text) return;
          const row = document.createElement('div');
          row.className = 'nlm-print-row ' + (cls || '');
          const b = document.createElement('b');
          b.textContent = label;
          const span = document.createElement('span');
          span.textContent = text;
          row.append(b, span);
          card.appendChild(row);
        };

        addRow('Your answer', item.selectedText, 'wrong');
        addRow('Why it missed', item.selectedWhy, 'wrong-note');
        addRow('Correct answer', item.correctText, 'correct');
        addRow('Core explanation', item.correctWhy, 'explanation');
        addRow('Recall cue', item.hint, 'hint');
        const prompt = document.createElement('div');
        prompt.className = 'nlm-repair-prompt';
        prompt.textContent = 'Repair prompt: Explain the distinction in your own words, then state the trap that made the wrong option tempting.';
        card.appendChild(prompt);
        sheet.appendChild(card);
      });

      document.body.appendChild(sheet);
      const cleanup = () => {
        sheet.remove();
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
      setTimeout(() => { if (document.body.contains(sheet)) cleanup(); }, 30000);
    }

    function downloadWrongOnlyQuiz(wrong) {
      if (!wrong.length) return;
      const wrongSet = new Set(wrong.map(x => x.i));
      const doc = new DOMParser().parseFromString('<!doctype html>\\n' + document.documentElement.outerHTML, 'text/html');
      doc.querySelectorAll('.nlm-topbar,.nlm-footer-nav,.nlm-drawer-backdrop,.nlm-results,.nlm-print-sheet').forEach(el => el.remove());
      const quizContainer = doc.getElementById('quiz-container');
      if (quizContainer) quizContainer.style.removeProperty('display');
      [...doc.querySelectorAll('.question')].forEach((q, i) => {
        if (!wrongSet.has(i)) {
          q.remove();
          return;
        }
        q.classList.remove('active');
        q.removeAttribute('data-nlm-index');
        q.querySelectorAll('.nlm-inline-feedback').forEach(el => el.remove());
        q.querySelectorAll('.option').forEach(opt => {
          opt.classList.remove('selected','correct','incorrect','disabled','show-correct');
        });
      });
      doc.querySelectorAll('.question').forEach((q, i) => q.classList.toggle('active', i === 0));
      const title = doc.querySelector('title');
      if (title) title.textContent = 'Wrong-Only Review Quiz';
      const blob = new Blob(['<!doctype html>\\n' + doc.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wrong-only-quiz-' + wrong.length + '-questions.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function restart() {
      state.forEach((_,i) => state[i] = { selected:null, correct:null });
      questions.forEach(q => q.querySelectorAll('.option').forEach(o => {
        o.classList.remove('selected','correct','incorrect','disabled','show-correct');
        o.querySelector('.nlm-inline-feedback')?.remove();
      }));
      showQuestion(0);
    }

    prevBtn.addEventListener('click', () => showQuestion(current - 1));
    nextBtn.addEventListener('click', () => current === total - 1 ? showResults() : showQuestion(current + 1));
    counter.addEventListener('click', openDrawer);
    topbar.querySelector('.nlm-kebab').addEventListener('click', openDrawer);
    topbar.querySelector('.nlm-review-link').addEventListener('click', showResults);
    backdrop.querySelector('.nlm-close').addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeDrawer(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'ArrowLeft' && !inResults && current > 0) showQuestion(current - 1);
      if (e.key === 'ArrowRight' && !inResults && state[current].selected !== null) current === total - 1 ? showResults() : showQuestion(current + 1);
    });

    showQuestion(0);
  })();`;
}

function stripRemoteCss(cssText) {
  return cssText
    .replace(/@import\s+[^;]+;/gi, '/* removed remote import */')
    .replace(/url\s*\(\s*(['"]?)(?:https?:|\/\/)[^)]*\)/gi, 'none');
}

function sanitizeImportedDocument(doc) {
  doc.querySelectorAll('script,iframe,object,embed,applet,form,base').forEach(el => el.remove());
  doc.querySelectorAll('meta[http-equiv]').forEach(el => el.remove());
  doc.querySelectorAll('link[rel]').forEach(link => {
    const rel = (link.getAttribute('rel') || '').toLowerCase();
    if (/stylesheet|preload|prefetch|preconnect|dns-prefetch|modulepreload/.test(rel)) link.remove();
  });

  doc.querySelectorAll('style').forEach(style => {
    style.textContent = stripRemoteCss(style.textContent || '');
  });

  doc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      const lower = value.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if (name === 'style' && /url\s*\(|expression\s*\(|behavior\s*:|@import/i.test(value)) {
        el.removeAttribute(attr.name);
        return;
      }
      if (['href','src','xlink:href','formaction'].includes(name)) {
        if (/^(?:javascript|vbscript):/i.test(lower) || /^data:text\/html/i.test(lower) || /^(?:https?:)?\/\//i.test(lower)) {
          el.removeAttribute(attr.name);
        }
      }
    });
  });
}

function enhanceHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeImportedDocument(doc);

  doc.getElementById(ENHANCER_STYLE_ID)?.remove();
  doc.getElementById(ENHANCER_SCRIPT_ID)?.remove();

  const style = doc.createElement('style');
  style.id = ENHANCER_STYLE_ID;
  style.textContent = themeCss(activeTheme);
  doc.head.appendChild(style);

  const script = doc.createElement('script');
  script.id = ENHANCER_SCRIPT_ID;
  script.textContent = enhancerScript();
  doc.body.appendChild(script);

  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}

function detectQuiz(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const questions = doc.querySelectorAll('.question').length;
  const options = doc.querySelectorAll('.option[data-correct]').length;
  const rationales = [...doc.querySelectorAll('.option[data-rationale]')].filter(o => o.dataset.rationale?.trim()).length;
  return { questions, options, rationales, compatible: questions > 0 && options >= questions * 2 };
}
