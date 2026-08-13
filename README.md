# NLM Quiz Studio

A local-first browser utility that upgrades interactive NotebookLM-style quiz HTML exports into a cleaner study experience.

> Unofficial project. Not affiliated with Google or NotebookLM.

## What it adds

- NotebookLM-style quiz interaction instead of only changing CSS
- Six themes: **NLM Dark, NLM Light, Focus, Midnight, Paper, Mint**
- Correct answers highlighted in green
- Wrong selections highlighted in red while also revealing the correct answer
- Explanations embedded inside the relevant answer card
- Persistent answer state when moving between questions
- Question navigator for jumping directly to any question
- Previous / Next navigation
- End-of-quiz score summary
- Dedicated mistake review with your answer, the correct answer, and explanation
- Export missed questions as a print-ready **Theory Repair PDF**
- Generate a fresh standalone **wrong-only quiz** from missed questions
- One-click jump from the review screen back to a missed question
- Left / Right keyboard navigation and Escape to close the question navigator

## Privacy & security

The quiz is processed entirely in your browser. There is no backend, account, analytics SDK, database, API key, or upload endpoint.

Before previewing or exporting a quiz, Studio strips active content that the enhancer does not need, including scripts, embedded frames/objects, inline event handlers, remote stylesheet/resource hints, obvious scriptable/remote URLs, and remote CSS imports. The preview is additionally isolated in a sandboxed iframe.

This hardening is designed for the expected NotebookLM-style quiz export format; it is not a replacement for a general-purpose sanitizer for arbitrary hostile webpages. See [`SECURITY.md`](SECURITY.md).

## Usage

1. Open `index.html` (or a static deployment).
2. Drop the interactive `.html` file exported by your quiz extension.
3. Pick a theme.
4. Preview the result.
5. Download the enhanced standalone HTML file.
6. After the quiz, export missed questions to PDF or generate a wrong-only retry quiz.

## Compatibility

The enhancer is designed around exports containing these class/data patterns:

- `.question`
- `.q-text`
- `.option[data-correct]`
- `.option[data-rationale]`
- `.opt-text`

The original quiz engine is removed and replaced with Studio's navigation/review engine.

## Development

```text
index.html
styles.css
themes.js
enhancer.js
app.js
SECURITY.md
.gitignore
```

No package install is required. Serve the directory with any static server, or open `index.html` directly.

## License

MIT
