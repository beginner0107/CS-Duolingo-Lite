## Project Brief (pinned)
- Name: CS Study App (PWA) for spaced repetition learning
- Stack: HTML/CSS/JS, Dexie (IndexedDB), Service Worker, Manifest
- Main screens: study/add/manage/stats/notes (tabs)
- Key features: decks & questions, SM-2 style reviews, import/export, offline-first
- Goals: clean UI/UX, modular JS, testability, performance, mobile-first
- Constraints: single-file HTML build, no server dependency for MVP
- Style: concise diffs, small iterative steps, keep responses ≤ 150 lines

## Directory Documentation
For detailed information about specific parts of the codebase:

- **[`ai/CLAUDE.md`](ai/CLAUDE.md)**: AI integration layer (CloudAdapter, LocalAdapter, question generation, answer grading)
- **[`server/CLAUDE.md`](server/CLAUDE.md)**: Express.js backend API (optional server-side components)
- **[`src/modules/CLAUDE.md`](src/modules/CLAUDE.md)**: Modular frontend components (session, scoring, statistics, etc.)
- **[`src/utils/CLAUDE.md`](src/utils/CLAUDE.md)**: Utility functions (DOM manipulation, validation, security)