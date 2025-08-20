# Repository Guidelines

## Project Structure & Modules
- `cs-duolingo-lite.html`: App entry point and DOM scaffolding.
- `app.js`: Main client logic and event handlers.
- `styles.css`: Global styles; mobile-first.
- `sw.js`: Service Worker for caching/offline.
- `manifest.json`: PWA/extension metadata and icons.

Keep feature code modular inside `app.js` using small functions grouped by feature (e.g., review, progress, storage). Co-locate helper constants near usage or extract into a top-level section in `app.js`.

## Build, Test, and Dev Commands
- Local serve (recommended): `python3 -m http.server 5173` then open `http://localhost:5173/cs-duolingo-lite.html`.
- Quick open: double-click `cs-duolingo-lite.html` (may bypass Service Worker features).
- Refresh SW: Hard-reload and/or unregister in DevTools > Application > Service Workers after changes to `sw.js`.

No build step is required; this is a static client app.

## Coding Style & Naming
- Indentation: 2 spaces; trim trailing whitespace.
- JavaScript: ES2017+; prefer `const`/`let`, arrow functions for callbacks, early returns, and pure helpers.
- Naming: `camelCase` for variables/functions, `PascalCase` for classes, `kebab-case` for files.
- CSS: BEM-ish class names (e.g., `.lesson-card__title`). Group variables, layout, components, utilities.
- Formatting: Prettier-style line width ~100; if using tools, run `prettier --write` locally before PRs.

## Testing Guidelines
- Current state: no automated tests.
- Additions: prefer light unit tests (Jest) for pure functions extracted from `app.js` into `app.test.js` or `tests/*.test.js`.
- Naming: `*.test.js`. Keep tests deterministic; mock network and storage.
- Manual checks: load, offline behavior, cache updates, and basic flows (start lesson, review, progress save).

## Commit & PR Guidelines
- Commits: imperative, concise, scoped. Example: `feat(review): add spaced-repetition scheduler` or `fix(sw): bust old cache on activate`.
- PRs: include summary, rationale, before/after screenshot or GIF if UI changes, and steps to verify (including offline/SW notes). Link related issues.
- Size: favor small, focused PRs; keep diffs under 300 lines when possible.

## Security & Configuration Tips
- Minimize permissions in `manifest.json`; avoid dangerous CSP relaxations.
- Sanitize any user-generated content before rendering.
- In `sw.js`, version caches and delete old ones on `activate` to prevent stale assets.

