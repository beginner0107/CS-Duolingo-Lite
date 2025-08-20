# 🧠 CS Study App - 스마트 학습 시스템

> 간격 반복 학습을 활용한 컴퓨터 과학 학습 Progressive Web App

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)
[![Offline Support](https://img.shields.io/badge/Offline-Support-blue.svg)](https://developers.google.com/web/fundamentals/instant-and-offline/offline-first)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## 📋 목차

- [🎯 프로젝트 소개](#-프로젝트-소개)
- [✨ 주요 기능](#-주요-기능)
- [🛠️ 기술 스택](#️-기술-스택)
- [🚀 설치 및 실행](#-설치-및-실행)
- [📖 사용법](#-사용법)
- [📁 프로젝트 구조](#-프로젝트-구조)
- [🧮 핵심 알고리즘](#-핵심-알고리즘)
- [💾 데이터 구조](#-데이터-구조)
- [🔧 PWA 기능](#-pwa-기능)
- [🔄 개발 가이드](#-개발-가이드)
- [🤝 기여하기](#-기여하기)

## 🎯 프로젝트 소개

CS Study App은 **간격 반복 학습(Spaced Repetition)** 기법을 활용하여 컴퓨터 과학 지식을 효율적으로 학습할 수 있도록 설계된 Progressive Web App입니다.

### 🔥 주요 특징

- **🧠 과학적 학습법**: SM-2 알고리즘 기반 최적화된 복습 스케줄링
- **📱 PWA 지원**: 앱처럼 설치 가능하며 오프라인에서도 완벽 작동
- **💾 로컬 저장**: IndexedDB를 활용한 빠르고 안전한 데이터 관리
- **🎨 모던 UI**: 다크 테마 기반의 깔끔하고 직관적인 인터페이스
- **🔄 실시간 동기화**: 백그라운드 동기화로 데이터 손실 방지

## ✨ 주요 기능

### 📚 학습 기능
- **다양한 문제 유형**
  - `OX 문제`: True/False 형태의 간단한 문제
  - `단답형`: 정확한 답변이 필요한 문제 (퍼지 매칭 및 동의어 지원)
  - `키워드형`: 여러 키워드를 포함한 유연한 채점 (N-of-M 방식)

- **스마트 학습 시스템**
  - 개인 맞춤형 복습 일정 자동 생성
  - 4단계 난이도별 응답 (Again/Hard/Good/Easy)
  - 학습 진도 실시간 추적 및 XP 시스템

### 📊 진도 관리
- **통계 대시보드**: XP, 연속 학습일, 일일 목표 추적
- **성과 분석**: 정답률, 학습 패턴, 취약 분야 분석
- **시각적 진도 표시**: 진행률 바와 목표 달성 현황
- **노트 기능**: 학습 내용 정리 및 관리

### 🛠️ 데이터 관리
- **가져오기/내보내기**: CSV, TSV 형식의 완전한 데이터 백업
- **가이드형 가져오기**: 미리보기 및 되돌리기 기능 지원
- **자연어 처리**: 복사-붙여넣기로 빠른 문제 생성
- **덱 관리**: 주제별 문제 그룹 관리 및 태그 시스템

### 🔔 알림 및 리마인더
- **학습 알림**: 복습 시간 도달 시 푸시 알림
- **목표 추적**: 일일 학습 목표 설정 및 추적
- **연속 학습**: 스트릭 시스템으로 동기 부여

## 🛠️ 기술 스택

### Frontend
- **HTML5**: 시맨틱 마크업과 웹 표준 준수
- **CSS3**: CSS Grid, Flexbox, CSS Variables 활용
- **Vanilla JavaScript**: 프레임워크 없는 순수 자바스크립트
- **Progressive Web App**: 네이티브 앱 경험 제공

### 데이터 저장
- **IndexedDB**: 브라우저 내 구조화된 데이터 저장
- **Dexie.js**: IndexedDB 래퍼 라이브러리
- **LocalStorage**: 설정 및 임시 데이터 저장

### PWA 기술
- **Service Worker**: 오프라인 지원 및 캐싱
- **Web App Manifest**: 앱 설치 및 메타데이터
- **Push API**: 백그라운드 알림
- **Background Sync**: 오프라인 데이터 동기화

## 🚀 설치 및 실행

### 시스템 요구사항
- 모던 웹 브라우저 (Chrome 88+, Firefox 84+, Safari 14+, Edge 88+)
- HTTPS 환경 (PWA 기능 사용 시 필수)

### 로컬 실행
```bash
# 1. 저장소 클론
git clone https://github.com/your-username/cs-study-app.git
cd cs-study-app

# 2. 로컬 서버 실행 (Python 3.x)
python -m http.server 8000

# 또는 Node.js 환경에서
npx serve .
# 또는 http-server 사용
npm install -g http-server
http-server . -p 8000 -c-1

# 3. 브라우저에서 접속
open http://localhost:8000/cs-duolingo-lite.html
```

### PWA 설치
1. 브라우저에서 앱 접속
2. 주소창의 "설치" 버튼 클릭
3. 홈 화면에 앱 아이콘 추가 완료

## 📖 사용법

### 1️⃣ 첫 시작
1. **덱 생성**: '관리' 탭에서 새로운 학습 덱 생성
2. **문제 추가**: '문제 추가' 탭에서 학습할 문제들 입력
3. **학습 시작**: '학습' 탭에서 덱 선택 후 학습 시작

### 2️⃣ 문제 유형별 사용법

#### OX 문제
```
문제: "TCP는 연결 지향 프로토콜이다."
정답: true
```

#### 단답형 문제
```
문제: "HTTP의 기본 포트 번호는?"
정답: 80
동의어: eighty, 팔십 (선택사항)
```

#### 키워드형 문제
```
문제: "프로세스 스케줄링의 주요 알고리즘 3가지는?"
키워드: FCFS|선입선출, SJF|최단작업우선, RR|라운드로빈
임계값: 2/3 (3개 중 2개 이상 맞춰야 정답)
```

### 3️⃣ 데이터 관리

#### CSV 가져오기 형식
```csv
덱,유형,문제,정답,동의어,해설
네트워킹,OX,TCP는 신뢰성 있는 프로토콜이다,true,,TCP는 데이터 전송의 신뢰성을 보장합니다
운영체제,SHORT,프로세스의 상태 전환 중 실행 중인 상태는?,Running,"실행중,실행",프로세스가 CPU를 할당받아 실행 중인 상태
```

#### 자연어 붙여넣기
```
• 데이터베이스, 관계형, ACID
• 네트워크, OSI 7계층, TCP/IP
• 알고리즘, 정렬, 버블정렬
```

## 📁 프로젝트 구조

```
cs-study-app/
├── 📄 cs-duolingo-lite.html    # 메인 애플리케이션
├── 📄 app.js                   # 핵심 비즈니스 로직
├── 📄 styles.css               # UI 스타일시트
├── 📄 manifest.json            # PWA 매니페스트
├── 📄 sw.js                    # 서비스 워커
├── 📄 offline.html             # 오프라인 페이지
├── 📄 CLAUDE.md                # 개발 가이드라인
├── 📁 icons/                   # 앱 아이콘
│   ├── 🖼️ app-icon-192.svg
│   └── 🖼️ app-icon-512.svg
└── 📄 README.md                # 프로젝트 문서 (이 파일)
```

### 핵심 파일 설명

| 파일 | 역할 | 주요 기능 |
|------|------|-----------|
| `cs-duolingo-lite.html` | 메인 UI | 탭 기반 인터페이스, HTML 구조 정의 |
| `app.js` | 핵심 로직 | 학습 알고리즘, 데이터 관리, 이벤트 처리 |
| `styles.css` | 스타일링 | 다크 테마, 반응형 디자인, 애니메이션 |
| `sw.js` | 서비스 워커 | 오프라인 캐싱, 푸시 알림, 백그라운드 동기화 |

## 🧮 핵심 알고리즘

### SM-2 간격 반복 알고리즘
```javascript
function calculateNextReview(ease, interval, grade) {
  if (grade < 3) {
    // 틀린 경우: 1일 후 재복습
    return { ease: Math.max(1.3, ease - 0.2), interval: 1 };
  }
  
  // 맞춘 경우: 간격 확대
  const newEase = ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  const newInterval = interval * newEase;
  
  return { 
    ease: Math.max(1.3, newEase), 
    interval: Math.ceil(newInterval) 
  };
}
```

### 문제 선택 알고리즘
1. **우선순위**: 복습 예정일이 지난 문제
2. **난이도 조정**: 사용자 정답률 기반 문제 필터링
3. **분산 학습**: 같은 덱 내에서도 다양한 주제 순환

## 💾 데이터 구조

### IndexedDB 스키마
```javascript
// 사용자 프로필
profile: {
  id: number,
  xp: number,           // 경험치
  streak: number,       // 연속 학습일
  lastStudy: Date       // 마지막 학습일
}

// 문제 덱
decks: {
  id: number,
  name: string,         // 덱 이름
  created: Date
}

// 문제
questions: {
  id: number,
  deck: number,         // 덱 ID
  type: string,         // 'OX' | 'SHORT' | 'KEYWORD'
  prompt: string,       // 문제 내용
  answer: string,       // 정답
  keywords: string[],   // 키워드 (KEYWORD 타입용)
  synonyms: string[],   // 동의어 (SHORT 타입용)
  explain: string,      // 해설
  tags: string[],       // 태그
  created: Date
}

// 복습 기록
review: {
  id: number,
  questionId: number,   // 문제 ID
  ease: number,         // 난이도 (SM-2)
  interval: number,     // 복습 간격 (일)
  due: Date,           // 다음 복습일
  count: number,       // 복습 횟수
  created: Date,
  updated: Date
}

// 노트 (v4 추가)
notes: {
  id: number,
  deckId: number,       // 덱 ID
  title: string,        // 노트 제목
  source: string        // 출처
}

note_items: {
  id: number,
  noteId: number,       // 노트 ID
  ts: Date,            // 타임스탬프
  text: string,        // 내용
  tags: string[]       // 태그
}
```

## 🔧 PWA 기능

### 서비스 워커 캐싱 전략
- **네트워크 우선**: 네비게이션 요청
- **캐시 우선**: 정적 자원 (CSS, JS, 이미지)
- **스테일 와일 리밸리데이트**: API 응답

### 오프라인 지원
- 완전한 오프라인 학습 가능
- 데이터 변경사항 로컬 저장
- 온라인 복귀 시 자동 동기화

### 푸시 알림
```javascript
// 학습 리마인더 설정
const reminderOptions = {
  body: '복습할 문제가 준비되었습니다!',
  icon: '/icons/app-icon-192.svg',
  actions: [
    { action: 'study', title: '학습 시작' },
    { action: 'later', title: '나중에' }
  ]
};
```

## 🔄 개발 가이드

### 코드 스타일
- **ES6+ 문법** 활용
- **함수형 프로그래밍** 선호
- **명명 규칙**: camelCase (변수), PascalCase (상수)
- **주석**: JSDoc 스타일 권장

### 개발 환경 설정
```bash
# 개발 서버 실행
npm install -g live-server
live-server --port=8000

# 또는 Python
python -m http.server 8000
```

### 디버깅
- **Chrome DevTools**: Application > Storage > IndexedDB
- **Service Worker**: Application > Service Workers  
- **PWA**: Lighthouse 감사 도구 활용

### 테스트
```bash
# 로컬 테스트
npm install -g http-server
http-server -p 8000 -c-1

# PWA 기능 테스트 (HTTPS 필요)
# ngrok 또는 GitHub Pages 활용 권장
```

### 주요 개발 팁
- **캐시 관리**: `-c-1` 옵션으로 개발 서버 캐시 비활성화
- **Service Worker**: 수정 후 DevTools에서 직접 갱신 필요
- **데이터 백업**: IndexedDB 데이터는 브라우저별 독립 저장

## 🚀 향후 개발 계획

### Phase 1: 핵심 기능 강화
- [ ] **다크/라이트 모드 토글**: 사용자 선호 테마 전환
- [ ] **키보드 단축키**: 빠른 학습을 위한 단축키 지원  
- [ ] **학습 통계 강화**: Chart.js 기반 시각화 대시보드
- [ ] **문제 이미지 첨부**: 시각적 학습 자료 지원

### Phase 2: AI 기능 추가
- [ ] **GPT API 연동**: 자동 문제 생성 시스템
- [ ] **학습 패턴 AI 분석**: 취약점 분석 및 개인화
- [ ] **적응형 학습**: 난이도 자동 조정 알고리즘
- [ ] **음성 인식**: Web Speech API 활용 음성 답변

### Phase 3: 소셜 기능
- [ ] **덱 공유 시스템**: 사용자간 학습 자료 공유
- [ ] **스터디 그룹**: 팀 기반 협업 학습
- [ ] **리더보드**: 친구들과 학습 경쟁 시스템
- [ ] **토론 기능**: 문제별 커뮤니티 토론

### Phase 4: 기술적 개선
- [ ] **TypeScript 마이그레이션**: 타입 안정성 향상
- [ ] **모듈화 및 번들링**: Vite 기반 개발 환경
- [ ] **단위 테스트**: Jest + Testing Library
- [ ] **성능 최적화**: 가상화, Web Workers 활용

## 🤝 기여하기

### 기여 방법
1. **이슈 등록**: 버그 리포트나 기능 제안
2. **포크 및 브랜치**: `feature/your-feature-name`
3. **커밋**: Conventional Commits 형식 준수
4. **풀 리퀘스트**: 상세한 변경사항 설명

### 커밋 메시지 규칙
```
feat: 새로운 기능 추가
fix: 버그 수정  
docs: 문서 수정
style: 코드 스타일 변경
refactor: 코드 리팩터링
test: 테스트 추가/수정
chore: 빌드 및 설정 변경
```

### 코드 리뷰 기준
- 기능 동작 완전성
- 코드 품질 및 가독성
- PWA 표준 준수
- 접근성 고려사항
- 성능 영향 분석

## 📞 지원 및 피드백

- **이슈 트래커**: [GitHub Issues](https://github.com/your-username/cs-study-app/issues)
- **토론**: [GitHub Discussions](https://github.com/your-username/cs-study-app/discussions)
- **문서**: [프로젝트 위키](https://github.com/your-username/cs-study-app/wiki)

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE) 하에 배포됩니다.

---

<div align="center">

**🧠 더 스마트하게 학습하세요!**

[🚀 시작하기](#-설치-및-실행) | [📖 문서](https://github.com/your-username/cs-study-app/wiki) | [💡 기여하기](#-기여하기)

Made with ❤️ by CS Study Community

</div>
