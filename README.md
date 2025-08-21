# CS Study App

> 컴퓨터 과학 교육을 위한 Spaced repetition 학습 시스템

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)
[![Offline Support](https://img.shields.io/badge/Offline-Support-blue.svg)](https://developers.google.com/web/fundamentals/instant-and-offline/offline-first)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## 개요

CS Study App은 SM-2 Spaced repetition 알고리즘을 구현하여 컴퓨터 과학 학습을 최적화하는 Progressive Web App입니다. Vanilla JavaScript와 현대적인 웹 기술로 구축되어 Offline 지원과 지능형 복습 스케줄링을 통해 네이티브 앱 경험을 제공합니다.

## 주요 기능

### 핵심 학습 시스템
- **다양한 문제 유형**
  - OX (True/False)
  - Short Answer (fuzzy matching 및 synonyms 지원)
  - Keyword 기반 (N-of-M grading system)

- **AI 지원 답안 채점**
  - Local 채점: 기존 규칙 기반 알고리즘
  - Cloud 채점: OpenAI, Anthropic, Gemini API 지원
  - Auto 모드: 불확실한 답안을 Cloud로 전송
  - Fallback 시스템: Cloud 실패 시 Local로 자동 전환

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

### Data 관리
- **Modular Architecture**: Database, spaced repetition, UI handling을 위한 ES6 modules
- **Import/Export**: Preview 및 validation을 포함한 CSV/TSV 지원
- **Backup System**: Undo 기능이 있는 완전한 data export
- **Notes System**: Deck 조직과 통합된 노트 작성

### Analytics & Visualization
- **Chart.js 통합**: 일일 복습 활동 및 streak visualization
- **Progress Tracking**: XP system, streaks, completion rates
- **Performance Metrics**: 정확도 분석 및 학습 패턴

### PWA 기능
- **Offline 운영**: Internet 없이 완전한 기능
- **Service Worker**: Background sync 및 caching strategies
- **App Installation**: 기기에 네이티브 같은 설치
- **Push Notifications**: 학습 리마인더 및 스케줄링 알림

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
```bash
# Repository clone
git clone https://github.com/your-username/cs-study-app.git
cd cs-study-app

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
```javascript
// cs-duolingo-lite.html의 AI 설정 스크립트에서 주석 해제
window.__AI_CONF = {
  baseUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: 'your-api-key',
  provider: 'openai',          // 'openai' | 'anthropic' | 'gemini'
  model: 'gpt-4o-mini',        // 모델별 지원 모델명
  enableCloud: true           // Cloud 채점 활성화
};
```

### Production 배포
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
├── app.js                    # Legacy monolithic JavaScript
├── src/
│   └── modules/
│       ├── database.js       # Dexie/IndexedDB operations
│       ├── spaced-repetition.js # SM-2 algorithm & scheduling
│       ├── scoring.js        # Answer checking & grading
│       └── ui-handlers.js    # Event handling & UI management
├── ai/
│   ├── adapter.js           # AI service adapters (Cloud/Local)
│   ├── index.js            # AI factory and configuration
│   ├── router.js           # AI routing logic (Auto mode)
│   └── prompts.js          # AI prompt templates
├── styles.css                # Application stylesheet
├── manifest.json            # PWA manifest
├── sw.js                   # Service worker
├── offline.html            # Offline fallback page
├── CLAUDE.md              # 개발 가이드라인
└── README.md              # 이 파일
```

### 주요 구성 요소

| 파일 | 목적 | 역할 |
|------|------|------|
| `cs-duolingo-lite.html` | Application shell | UI 구조, module imports, 초기화 |
| `src/modules/database.js` | Data layer | IndexedDB schema, CRUD operations, migrations |
| `src/modules/spaced-repetition.js` | Learning engine | SM-2 algorithm, scheduling |
| `src/modules/scoring.js` | Grading engine | Answer checking, fuzzy matching, feedback |
| `src/modules/ui-handlers.js` | Presentation layer | Event binding, DOM manipulation, animations |
| `ai/adapter.js` | AI services | Cloud/Local AI adapters, fallback logic |
| `ai/router.js` | AI routing | Auto mode logic, metrics tracking |
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

### AI 답안 채점
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