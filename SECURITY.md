# Security Policy

NLM Quiz Studio is a dependency-free, client-side utility. It does not require API keys, accounts, a database, or a backend.

## Current security model

- Imported quiz files are processed locally in the browser.
- The live preview uses a sandboxed iframe without `allow-same-origin`.
- Imported active content is sanitized before preview/export:
  - scripts and embedded browsing contexts are removed;
  - inline event handlers are removed;
  - remote stylesheet/resource hints are removed;
  - obvious remote or scriptable `src`/`href` values are removed;
  - remote CSS `@import` / `url(...)` references are stripped.
- The enhanced quiz uses a freshly injected local quiz engine.
- Files larger than 25 MB are rejected to reduce accidental browser freezes; files over 10 MB show a performance warning.
- There are currently no third-party runtime dependencies.

## Secrets

The application currently needs no secrets. `.env`, private keys, and common credential files are ignored by Git. If a future feature requires an API, never place a secret in client-side JavaScript: browser-delivered code cannot keep a server secret private.

## Scope and limitations

The sanitizer is defense-in-depth for the expected NotebookLM-style quiz export format; it is **not** a general-purpose HTML sanitizer for arbitrary hostile webpages. Use exports from sources you trust.

## Reporting a vulnerability

Please open a GitHub issue with a minimal reproduction that does not contain real credentials or private data.
