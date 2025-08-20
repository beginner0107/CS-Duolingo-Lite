# CS Study App (PWA)

## Project Overview / 프로젝트 개요
A lightweight CS learning app built as a Progressive Web App (PWA). It uses flashcards and spaced‑repetition scheduling (SM‑2 style) to help you practice networking, OS, DB, and data structure concepts. Everything runs in the browser with offline support and persistent local data.

간단한 플래시카드 기반의 CS 학습 PWA입니다. 네트워크/운영체제/데이터베이스/자료구조 개념을 SM‑2 방식의 간격 반복으로 연습할 수 있습니다. 브라우저에서 오프라인으로 동작하며, 학습 데이터는 로컬(IndexedDB)에 안전하게 저장됩니다.

## Features / 주요 기능
- Offline support: Service Worker caches core assets for use without a network.
- PWA installable: Add to home screen/desktop; responsive UI.
- Local persistence: IndexedDB (via Dexie) stores decks, questions, and review states.
- Spaced repetition: Four‑grade responses (Again/Hard/Good/Easy) with dynamic next‑due previews.
- Flexible grading: Short‑answer fuzzy/synonym matching; keyword N‑of‑M thresholds with per‑keyword synonyms.
- Import/Export: Full data export, deck‑level export/import, guided CSV/TSV import with preview and undo.

- 오프라인 지원: Service Worker가 핵심 자산을 캐싱하여 네트워크 없이도 사용 가능합니다.
- PWA 설치: 홈 화면/데스크탑에 설치 가능하며, 반응형 UI를 제공합니다.
- 로컬 저장: IndexedDB(Dexie 사용)로 덱/문제/복습 상태를 보관합니다.
- 간격 반복: Again/Hard/Good/Easy 4단계 채점과 다음 복습일(미리보기)을 지원합니다.
- 유연한 채점: 단답형 퍼지/동의어 매칭, 키워드형 N‑of‑M 임계값 및 키워드별 동의어를 지원합니다.
- 가져오기/내보내기: 전체/덱 단위 내보내기 및 가이드형 CSV/TSV 가져오기(미리보기, 되돌리기) 제공.

## Repository Structure / 저장소 구조
- `cs-duolingo-lite.html` — App entry point (UI markup)
- `app.js` — App logic (data, scheduling, UI handlers)
- `styles.css` — Styling
- `sw.js` — Service Worker (caching strategies, offline fallback)
- `manifest.json` — PWA metadata & icons
- `offline.html` — Offline fallback page
- `icons/` — PWA icons (SVG/PNG)

- `cs-duolingo-lite.html` — 앱 진입점(화면 마크업)
- `app.js` — 애플리케이션 로직(데이터, 스케줄링, UI 핸들러)
- `styles.css` — 스타일 시트
- `sw.js` — 서비스 워커(캐싱 전략, 오프라인 대체 페이지)
- `manifest.json` — PWA 메타데이터 및 아이콘
- `offline.html` — 오프라인 대체 페이지
- `icons/` — PWA 아이콘 (SVG/PNG)

## Installation Guide / 설치 안내

### Prerequisites / 사전 준비
- Node.js and npm (https://nodejs.org)
- http-server (installed globally via npm)

- Node.js와 npm 설치가 필요합니다.
- 단순 정적 서버 실행을 위해 `http-server`를 전역 설치합니다.

### macOS/Linux
아래 명령어를 순서대로 실행하세요.
```bash
# 1) Clone the repository
git clone <repo-url>
cd cs-duolingo-lite

# 2) Install a simple static server
npm install -g http-server

# 3) Start the server (recommended port 5173)
http-server . -p 5173 -c-1

# 4) Open the app in your browser
# (Use the HTML entry to enable SW/PWA behaviors)
open http://localhost:5173/cs-duolingo-lite.html
```

### Windows (PowerShell)
아래 명령어를 순서대로 실행하세요.
```powershell
# 1) Clone the repository
git clone <repo-url>
cd cs-duolingo-lite

# 2) Install a simple static server
npm install -g http-server

# 3) Start the server (recommended port 5173)
http-server . -p 5173 -c-1

# 4) Open the app in your browser
start http://localhost:5173/cs-duolingo-lite.html
```

Notes / 참고
- The `-c-1` flag disables caching at the dev server level; the Service Worker still manages runtime caching. If assets look stale, hard reload or unregister the SW in DevTools → Application → Service Workers.
- Data is saved locally (IndexedDB). Export your data before switching browsers or clearing site data.

- `-c-1` 옵션은 개발 서버 캐시를 비활성화합니다(실제 런타임 캐싱은 Service Worker가 관리). 리소스가 갱신되지 않으면 하드 리로드하거나 DevTools → Application → Service Workers에서 SW를 해제하세요.
- 데이터는 로컬 IndexedDB에 저장됩니다. 브라우저 변경 또는 사이트 데이터 삭제 전에 내보내기를 권장합니다.

## Usage Tips / 사용 팁
- Install as a PWA from the browser’s install prompt for a native‑like experience.
- After editing `sw.js` or `manifest.json`, refresh the Service Worker (DevTools → Application) to pick up changes.
- Use the “데이터 내보내기/가져오기” and deck‑level actions in the 관리 tab to back up or migrate subsets.

- 브라우저의 설치 안내를 통해 PWA로 설치하면 앱처럼 사용할 수 있습니다.
- `sw.js` 또는 `manifest.json`을 수정한 뒤에는 DevTools → Application에서 Service Worker를 새로고침해 변경 사항을 반영하세요.
- 관리 탭의 “데이터 내보내기/가져오기”와 덱 단위 내보내기/가져오기를 활용해 백업/이관을 진행하세요.
