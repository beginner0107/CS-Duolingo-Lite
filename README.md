# CS Study App

> CS Study App (PWA) for spaced repetition learning

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)
[![Offline Support](https://img.shields.io/badge/Offline-Support-blue.svg)](https://developers.google.com/web/fundamentals/instant-and-offline/offline-first)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## Project Brief

- **Name**: CS Study App (PWA) for spaced repetition learning
- **Stack**: HTML/CSS/JS, Dexie (IndexedDB), Service Worker, Manifest
- **Main screens**: study/add/manage/stats/notes (tabs)
- **Key features**: decks & questions, SM-2 style reviews, import/export, offline-first
- **Goals**: clean UI/UX, modular JS, testability, performance, mobile-first
- **Constraints**: single-file HTML build, no server dependency for MVP
- **Style**: concise diffs, small iterative steps, keep responses ≤ 150 lines

## 개요

CS Study App은 SM-2 Spaced repetition 알고리즘을 구현하여 컴퓨터 과학 학습을 최적화하는 Progressive Web App입니다. Vanilla JavaScript와 현대적인 웹 기술로 구축되어 Offline 지원과 지능형 복습 스케줄링을 통해 네이티브 앱 경험을 제공합니다.

## 주요 기능

### 핵심 학습 시스템
- **다양한 문제 유형**
  - OX (O/X 선택형): 직관적인 dropdown 선택 인터페이스
  - Short Answer (단답형): fuzzy matching 및 synonyms 지원, 해설 기반 답안
  - Essay (서술형): 키워드 기반 N-of-M grading system

- **AI 지원 답안 채점**
  - Local 채점: 기존 규칙 기반 알고리즘
  - Cloud 채점: OpenAI, Anthropic, Gemini API 지원
  - Auto 모드: 불확실한 답안을 Cloud로 전송
  - Fallback 시스템: Cloud 실패 시 Local로 자동 전환

- **🆕 AI 문제 생성**
  - **주제 기반 생성**: 컴퓨터 과학 모든 분야 지원 (운영체제, 네트워크, 알고리즘 등)
  - **난이도 조절**: 초급/중급/고급 3단계 난이도 설정
  - **다양한 문제 유형**: OX, 단답형, 키워드형 문제 자동 생성
  - **미리보기 & 선택**: 생성된 문제를 검토하고 원하는 것만 선택 저장
  - **해설 포함**: 모든 생성 문제에 상세한 한국어 해설 자동 생성
  - **덱 통합**: 기존 덱 시스템과 완벽 연동하여 즉시 학습 가능

- **SM-2 Algorithm 통합**
  - 적응형 복습 스케줄링
  - 4단계 난이도 grading (Again/Hard/Good/Easy)
  - 개인 맞춤 학습 속도

### 사용자 Interface
- **Modern Design**: CSS variables를 활용한 dark/light theme toggle
- **Responsive Layout**: Touch 지원 mobile-first design
- **Keyboard Navigation**: 전체 keyboard shortcuts 지원
- **Drag & Drop**: 관리 interface에서 문제 순서 변경
- **Visual Feedback**: Loading states, animations, progress indicators
- **AI 설정 UI**: 사용자 친화적인 AI provider 및 API key 관리
- **개선된 문제 입력**: OX 문제는 O/X dropdown, 단답형은 해설 기반 입력
- **실시간 탭 동기화**: 탭 전환 시 학습 세션 자동 리셋으로 변경사항 즉시 반영

### Data 관리
- **Modular Architecture**: 9개의 전문화된 ES6 modules로 구성된 clean architecture
- **Database Abstraction**: 모든 IndexedDB 작업을 위한 centralized database layer
- **Import/Export**: Preview 및 validation을 포함한 CSV/TSV 지원
- **Backup System**: Undo 기능이 있는 완전한 data export
- **Notes System**: Deck 조직과 통합된 노트 작성
- **Validation Layer**: 모든 입력에 대한 comprehensive validation utilities

### Analytics & Visualization
- **Chart.js 통합**: 일일 복습 활동 및 streak visualization
- **Progress Tracking**: XP system, streaks, completion rates
- **Performance Metrics**: 정확도 분석 및 학습 패턴
- **AI 사용 통계**: Local/Cloud 채점 사용량 추적 및 메트릭

### PWA 기능
- **Offline 운영**: Internet 없이 완전한 기능
- **Service Worker**: Background sync 및 caching strategies
- **App Installation**: 기기에 네이티브 같은 설치
- **Push Notifications**: 학습 리마인더 및 스케줄링 알림
- **Docker 지원**: 개발 및 배포를 위한 컨테이너화

## 기술 Stack

### Frontend
- **HTML5**: Semantic markup 및 web 표준
- **CSS3**: Grid, Flexbox, CSS Variables, transitions
- **JavaScript ES6+**: Modules, async/await, 현대적 문법
- **Chart.js**: Data visualization library

### Data 저장소
- **IndexedDB**: Dexie.js wrapper를 통한 client-side database
- **LocalStorage**: 설정 및 임시 data
- **Service Worker**: Offline data 관리

### PWA 기술
- **Web App Manifest**: 설치 metadata
- **Service Worker**: Caching 및 background sync
- **Push API**: Notification system

## 설치 및 사용법

### 시스템 요구사항
- 최신 web browser (Chrome 88+, Firefox 84+, Safari 14+, Edge 88+)
- HTTPS 환경 (PWA 기능 사용 시 필수)

### 로컬 개발

#### Docker 사용 (권장)
```bash
# Repository clone
git clone https://github.com/your-username/cs-study-app.git
cd cs-study-app

# Frontend PWA 실행
docker-compose up frontend

# 또는 Backend API와 함께 실행
docker-compose up frontend backend

# Application 접속
open http://localhost:8000/cs-duolingo-lite.html
```

#### 직접 설치
```bash
# Local server 시작 (Python)
python -m http.server 8000

# 또는 Node.js 사용
npx serve .
# 또는
npm install -g http-server
http-server . -p 8000 -c-1

# Application 접속
open http://localhost:8000/cs-duolingo-lite.html
```

### AI 기능 설정 (선택사항)
AI 채점 및 문제 생성 기능을 사용하려면 애플리케이션의 설정 패널에서 구성하세요:

1. **관리 > 설정** 탭으로 이동
2. **AI 설정** 카드에서 다음 정보 입력:
   - **Provider**: OpenAI, Anthropic, 또는 Google Gemini 선택
   - **API Key**: 선택한 provider의 API 키
   - **Model**: 사용할 모델 (자동 선택 또는 수동 선택)
3. **AI 설정 저장** 버튼 클릭
4. **연결 테스트** 버튼으로 설정 확인
5. **AI 모드**를 Local/Auto/Cloud 중 선택

#### AI 문제 생성 사용법
AI 설정 완료 후 문제 자동 생성:

1. **관리** 탭의 **🤖 AI 문제 생성** 카드로 이동
2. 다음 항목 설정:
   - **주제**: CS 분야 입력 (예: "운영체제", "네트워크", "자료구조")
   - **난이도**: 초급/중급/고급 선택
   - **문제 유형**: OX/단답형/키워드형 선택
   - **덱 선택**: 저장할 덱 지정
   - **문제 수**: 3~15개 선택
3. **🚀 문제 생성** 버튼 클릭
4. 생성된 문제 미리보기에서 원하는 문제 선택
5. **선택된 문제 저장** 버튼으로 덱에 추가

지원되는 AI 모델:
- **OpenAI**: gpt-4o-mini, gpt-4o, gpt-3.5-turbo
- **Anthropic**: claude-3-haiku-20240307, claude-3-sonnet-20240229  
- **Google Gemini**: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.0-flash

**보안 참고**: API 키는 브라우저의 localStorage에만 저장되며 서버로 전송되지 않습니다.

### Production 배포

#### Docker 배포 (권장)
```bash
# Production build 및 실행
docker-compose --profile production up frontend-prod

# 또는 표준 Docker 명령어
docker build -t cs-study-app .
docker run -p 8000:8000 cs-study-app
```

#### 전통적 배포
1. HTTPS를 지원하는 web server에 파일 업로드
2. `.js` 및 `.json` 파일의 적절한 MIME types 확인
3. `sw.js`에서 service worker scope 구성
4. PWA 설치 및 offline 기능 테스트

### PWA 설치
1. 지원하는 browser에서 app URL 방문
2. 주소창의 "설치" 버튼 클릭
3. 기기 홈 화면에 app 아이콘 추가
4. Standalone application으로 실행

## Project 구조

```
cs-study-app/
├── cs-duolingo-lite.html     # Main application entry point
├── app.js                    # Core application with modular imports
├── src/
│   ├── modules/
│   │   ├── database.js       # Database operations abstraction layer
│   │   ├── statistics.js     # Statistics and calendar functionality
│   │   ├── session.js        # Learning session management
│   │   ├── data-management.js # Import/export operations
│   │   ├── theme.js          # Theme switching functionality
│   │   ├── notes.js          # Note management system
│   │   ├── drag-drop.js      # Drag and drop for question reordering
│   │   ├── spaced-repetition.js # SM-2 algorithm & scheduling
│   │   ├── scoring.js        # Answer checking & grading
│   │   └── ui-handlers.js    # Event handling & UI management
│   └── utils/
│       ├── validation.js     # Input validation utilities
│       └── dom.js           # DOM manipulation utilities
├── ai/
│   ├── adapter.js           # AI service adapters (Cloud/Local) + Question generation
│   ├── index.js            # AI factory and configuration
│   ├── router.js           # AI routing logic (Auto mode)
│   └── prompts.js          # AI prompt templates
├── styles.css                # Application stylesheet
├── manifest.json            # PWA manifest
├── sw.js                   # Service worker
├── offline.html            # Offline fallback page
├── server/
│   ├── index.js            # Express server entry (optional)
│   ├── router.js           # REST routes for questions (CRUD)
│   └── database.js         # SQLite wrapper
├── CLAUDE.md              # Development guidelines
└── README.md              # This file
```

### 선택 사항: SQLite API 서버 실행

#### Docker 사용
```bash
# Backend API 서버 실행
docker-compose up backend

# Frontend와 함께 실행
docker-compose up frontend backend
```

#### 직접 설치
- 의존성 설치: `npm i express sqlite3 cors node-fetch`
- 실행: `node server/index.js` (기본 포트 5174)

#### REST 엔드포인트
- `GET /api/questions`
- `GET /api/questions/:id`
- `POST /api/questions`
- `PUT /api/questions/:id`
- `DELETE /api/questions/:id`
- `POST /api/grade/essay` (OpenAI 기반 서술형 채점)

### 주요 구성 요소

| 파일 | 목적 | 역할 |
|------|------|------|
| `cs-duolingo-lite.html` | Application shell | UI 구조, module imports, 초기화 |
| `app.js` | Core application | Main logic with modular imports, global functions |
| `src/modules/database.js` | Data abstraction layer | Database operations for other modules |
| `src/modules/statistics.js` | Statistics & calendar | Stats display, learning calendar, achievements |
| `src/modules/session.js` | Learning session | Session management, grading logic |
| `src/modules/data-management.js` | Import/Export | CSV/TSV import, data validation, quick add |
| `src/modules/theme.js` | Theme management | Dark/light theme switching |
| `src/modules/notes.js` | Note system | Note creation, editing, markdown export |
| `src/modules/drag-drop.js` | Drag & drop | Question reordering functionality |
| `src/utils/validation.js` | Input validation | Form validation utilities |
| `src/utils/dom.js` | DOM utilities | Helper functions for DOM manipulation |
| `ai/adapter.js` | AI services | Cloud/Local AI adapters, question generation |
| `styles.css` | Styling | Theme variables, responsive design, animations |

## Algorithm 구현

### SM-2 Spaced Repetition
```javascript
function nextSchedule(correct, state, grade = null) {
  if (grade === 0) {
    // 실패: interval 초기화, ease 감소
    state.interval = 0;
    state.ease = Math.max(1.3, state.ease - 0.8);
  } else {
    // 성공: ease factor 기반 interval 증가
    const factor = grade === 1 ? 1.2 : grade === 2 ? state.ease : state.ease * 1.3;
    state.interval = Math.round(state.interval * factor);
  }
  
  return state;
}
```

### AI 답안 채점 & 문제 생성
```javascript
// Local 채점 (기존 규칙 기반)
function gradeWithFeedback(question, userAnswer) {
  // Fuzzy matching, 키워드 매칭, 정확한 답안 검사
  return { score, correct, hits, misses, rationale };
}

// Auto 모드 라우팅
async function decideGrade(input) {
  const localResult = await LocalAdapter.grade(input);
  
  // 불확실한 점수(0.6-0.8)면 Cloud로 전송
  if (localResult.score >= 0.6 && localResult.score < 0.8) {
    return await CloudAdapter.grade(input);
  }
  return localResult;
}

// 🆕 AI 문제 생성
async function generateQuestions(input) {
  const prompt = buildGenerationPrompt(input.topic, input.difficulty, input.questionType, input.count);
  const adapter = getAdapter('cloud');
  
  const result = await adapter.generateQuestions({
    prompt: prompt,
    questionType: input.questionType,
    count: input.count
  });
  
  return result.questions; // [{ prompt, answer, explanation, keywords? }]
}
```

### 문제 선택 전략
1. **Priority Queue**: 예정일, ease factor, 마지막 복습일 기준
2. **Group 기반 Scheduling**: `group:*` tags가 있는 문제들을 함께 복습
3. **일일 한계**: 설정 가능한 복습 한계 및 overflow 처리
4. **난이도 적응**: 낮은 ease 문제에 우선순위 부여

## Database Schema

### IndexedDB 테이블
```javascript
// 사용자 profile 및 진행 상황
profile: { id, xp, streak, lastStudy }

// 문제 decks/categories  
decks: { id, name, created }

// Metadata가 포함된 문제들
questions: { 
  id, deck, type, prompt, answer, 
  keywords, synonyms, explain, 
  tags, created, sortOrder 
}

// Spaced repetition 상태
review: { 
  id, questionId, ease, interval, 
  due, count, created, updated 
}

// 노트 작성 system
notes: { id, deckId, title, source }
note_items: { id, noteId, ts, text, tags }

// Application metadata
meta: { key, value }
```

## 개발 가이드

### Code 표준
- **ES6+ Modules**: 명시적 imports/exports를 가진 modular architecture
- **Async/Await**: 현대적 비동기 programming patterns
- **CSS Variables**: Custom properties를 활용한 theme-aware styling
- **Semantic HTML**: ARIA attributes를 포함한 접근 가능한 markup

### Development Approach
- **Concise Changes**: Small, iterative steps with focused diffs
- **Modular Design**: Clean separation of concerns across 9 specialized modules
- **Performance First**: Mobile-first design with optimal loading strategies
- **Testability**: Pure functions and clear interfaces for easy testing
- **Response Limit**: Keep code changes ≤ 150 lines for maintainability

### Build 과정
Build 단계 불필요 - ES6 modules로 browser에서 직접 실행

### 개발 도구
```bash
# Live reload server
npm install -g live-server
live-server --port=8000

# PWA testing (requires HTTPS)
# Use ngrok for local HTTPS tunnel
ngrok http 8000
```

### Debugging
- **IndexedDB**: Chrome DevTools > Application > Storage > IndexedDB
- **Service Worker**: Application > Service Workers > Update/Unregister
- **PWA Audit**: Lighthouse > Progressive Web App category
- **Module Loading**: ES6 module 의존성 분석을 위한 Network tab

## 최근 업데이트 (v2.2)

### 🆕 AI 문제 생성 기능
- **자동 문제 생성**: 주제만 입력하면 고품질 CS 문제 자동 생성
- **지능형 난이도 조절**: 초급/중급/고급 3단계 난이도별 문제 생성
- **다양한 문제 유형**: OX, 단답형, 키워드형 문제 타입 지원
- **미리보기 시스템**: 생성된 문제를 검토하고 선택적으로 저장
- **완벽한 덱 통합**: 기존 덱 시스템과 seamless 연동
- **한국어 해설**: 모든 생성 문제에 상세한 한국어 해설 포함

### 이전 업데이트 (v2.1)

#### UI/UX 개선사항
- **문제 입력 방식 개선**: OX 문제는 O/X dropdown 선택, 단답형은 해설 기반 입력으로 변경
- **AI 설정 자동 저장**: Provider 및 Model 변경 시 자동으로 설정 저장
- **탭 전환 개선**: 학습 탭 전환 시 세션 자동 리셋으로 다른 탭의 변경사항 즉시 반영
- **연속 학습 기록 수정**: Streak 카운트 로직 개선으로 정확한 연속 학습 일수 표시
- **문제 타입 간소화**: KEYWORD와 ESSAY 타입 통합으로 사용자 혼동 방지
- **피드백 UI 개선**: 한국어 기반 채점 결과 표시 및 괄호 형식 개선

#### 기술적 개선사항
- **AI 모드 최적화**: Local 모드에서 불필요한 AI API 호출 제거
- **Docker 지원**: 개발 및 배포를 위한 Docker 컨테이너 설정 추가
- **모듈화 개선**: UI handlers 및 scoring 로직 분리로 유지보수성 향상

## 기여하기

### 개발 환경 설정
1. Repository fork 및 feature branch 생성
2. 기존 code style 및 module 구조 준수
3. 여러 browser에서 PWA 기능 테스트
4. Offline 동작이 올바르게 작동하는지 확인
5. API 변경사항에 대한 문서 업데이트

### Commit 형식
```
type(scope): description

feat: add drag & drop question reordering
fix: resolve service worker cache invalidation
docs: update installation instructions
refactor: extract UI handlers into separate module
```

### Code Review 체크리스트
- [ ] Offline 기능 유지
- [ ] Modular architecture 준수
- [ ] 적절한 error handling 포함
- [ ] 관련 문서 업데이트
- [ ] PWA 설치 flow 테스트

## License

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

## 지원

- **Issues**: [GitHub Issues](https://github.com/your-username/cs-study-app/issues)
- **문서**: [Project Wiki](https://github.com/your-username/cs-study-app/wiki)
- **토론**: [GitHub Discussions](https://github.com/your-username/cs-study-app/discussions)

---

**컴퓨터 과학 교육을 위한 현대적 spaced repetition 학습 시스템**
