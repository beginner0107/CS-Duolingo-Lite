// Backend Interview Data Loader
// Loads and processes backend interview questions for initial app data

import { parseBackendInterviewMarkdown, generateDecksFromQuestions } from './markdown-parser.js';

export async function loadBackendInterviewData() {
  try {
    console.log('Attempting to fetch backend interview data...');
    const response = await fetch('./sample/backend-interview.md');
    
    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${response.statusText}`);
      throw new Error(`Failed to load backend interview data: ${response.status} ${response.statusText}`);
    }
    
    console.log('Successfully fetched markdown file');
    const markdownText = await response.text();
    console.log(`Markdown text length: ${markdownText.length} characters`);
    
    const questions = parseBackendInterviewMarkdown(markdownText);
    const decks = generateDecksFromQuestions(questions);
    
    console.log(`Parsed ${questions.length} questions from ${decks.length} categories`);
    console.log('First few questions:', questions.slice(0, 3).map(q => q.prompt));
    
    return { questions, decks };
  } catch (error) {
    console.error('Failed to load backend interview data:', error);
    console.error('Error details:', error.message);
    return { questions: [], decks: [] };
  }
}

export function getBackendInterviewSampleData() {
  console.log('Using enhanced fallback sample data with more comprehensive questions');
  
  // Enhanced fallback sample data with more questions from the markdown file
  const sampleDecks = [
    { id: 'network', name: '네트워크', created: new Date() },
    { id: 'os', name: '운영체제', created: new Date() },
    { id: 'database', name: '데이터베이스', created: new Date() },
    { id: 'data-structure-algorithm', name: '자료구조/알고리즘', created: new Date() },
    { id: 'security', name: '보안', created: new Date() },
    { id: 'web-server', name: '웹서버', created: new Date() },
    { id: 'java', name: 'Java', created: new Date() },
    { id: 'spring', name: 'Spring', created: new Date() }
  ];
  
  const sampleQuestions = [
    // 네트워크 관련 문제들
    {
      type: 'ESSAY',
      deck: 'network',
      prompt: 'TCP와 UDP의 차이점에 대해서 설명해보세요.',
      answer: 'TCP는 연결 지향형 프로토콜이고 UDP는 데이터를 데이터그램단위로 전송하는 프로토콜입니다. TCP는 가상 회선을 만들어 신뢰성을 보장하도록(흐름 제어, 혼잡 제어, 오류 제어) 하는 프로토콜로 따로 신뢰성을 보장하기 위한 절차가 없는 UDP에 비해 속도가 느린편입니다. TCP는 그래서 파일전송과 같은 신뢰성이 중요한 서비스에 사용되고, UDP는 스트리밍, RTP와 같이 연속성이 더 중요한 서비스에 사용됩니다.',
      keywords: ['TCP', 'UDP', '연결 지향', '데이터그램', '신뢰성', '흐름 제어', '혼잡 제어'],
      keywordThreshold: 3, // Need at least 3 keywords for good answer
      explain: 'TCP는 연결 지향형으로 신뢰성을 보장하며, UDP는 비연결형으로 속도가 빠릅니다.',
      created: new Date()
    },
    {
      type: 'ESSAY',
      deck: 'network',
      prompt: 'TCP 3, 4 way handshake에 대해서 설명해보세요.',
      answer: 'TCP 3way handshake는 가상회선을 수립하는 단계입니다. 클라이언트는 서버에 요청을 전송할 수 있는지, 서버는 클라이언트에게 응답을 전송할 수 있는지 확인하는 과정입니다. SYN, ACK 패킷을 주고받으며, 임의의 난수로 SYN 플래그를 전송하고, ACK 플래그에는 1을 더한값을 전송합니다. TCP 4way handshake는 TCP연결을 해제하는 단계로, 클라이언트는 서버에게 연결해제를 통지하고 서버가 이를 확인하고 클라이언트에게 이를 받았음을 전송해주고 최종적으로 연결이 해제됩니다.',
      keywords: ['TCP', '3way handshake', '4way handshake', 'SYN', 'ACK', '가상회선'],
      keywordThreshold: 3,
      explain: 'TCP handshake는 연결 설정과 해제를 위한 프로토콜입니다.',
      created: new Date()
    },
    {
      type: 'ESSAY',
      deck: 'network',
      prompt: 'HTTP와 HTTPS의 차이점에 대해서 설명해보세요.',
      answer: 'HTTP는 따로 암호화 과정을 거치지 않기 때문에 중간에 패킷을 가로챌 수 있고, 수정할 수 있습니다. 따라서 보안이 취약해짐을 알 수 있습니다. 이를 보완하기 위해 나온 것이 HTTPS입니다. 중간에 암호화 계층을 거쳐서 패킷을 암호화합니다.',
      keywords: ['HTTP', 'HTTPS', '암호화', '보안', '패킷'],
      keywordThreshold: 3,
      explain: 'HTTP는 평문 통신으로 보안이 취약하고, HTTPS는 SSL/TLS를 통해 암호화된 통신을 제공합니다.',
      created: new Date()
    },
    {
      type: 'ESSAY',
      deck: 'network',
      prompt: 'HTTPS에 대해서 설명하고 SSL Handshake에 대해서 설명해보세요.',
      answer: 'HTTPS는 HTTP에 보안 계층을 추가한 것입니다. HTTPS는 제3자 인증, 공개키 암호화, 비밀키 암호화를 사용합니다. 클라이언트는 TCP 3way handshake를 수행한 이후 Client Hello를 전송합니다. 서버는 인증서를 보냅니다. 클라이언트는 받은 인증서를 신뢰하기 위해서 등록된 인증기관인지 확인합니다. 서버의 공개키로 통신에 사용할 비밀키를 암호화해서 서버에 보냅니다. 서버는 이를 개인키로 확인하고 이후 통신은 공유된 비밀키로 암호화되어 통신합니다.',
      keywords: ['HTTPS', 'SSL', 'Handshake', '공개키', '비밀키', '인증서'],
      keywordThreshold: 3,
      explain: 'HTTPS는 SSL/TLS를 통해 안전한 통신을 제공합니다.',
      created: new Date()
    },
    
    // 운영체제 관련 문제들
    {
      type: 'ESSAY',
      deck: 'os',
      prompt: '프로세스와 스레드의 차이점을 설명해보세요.',
      answer: '프로세스는 독립적인 메모리 공간을 가지며 운영체제로부터 자원을 할당받는 작업의 단위입니다. 스레드는 프로세스 내에서 실행되는 여러 흐름의 단위로, 프로세스의 메모리 공간을 공유합니다. 프로세스 간 통신은 IPC를 통해 이루어지지만, 스레드 간 통신은 공유 메모리를 통해 더 쉽게 이루어집니다.',
      keywords: ['프로세스', '스레드', '메모리', '독립', '공유', 'IPC'],
      keywordThreshold: 3,
      explain: '프로세스는 독립된 메모리 공간을 가지고, 스레드는 프로세스 내에서 메모리를 공유합니다.',
      created: new Date()
    },
    {
      type: 'ESSAY',
      deck: 'os',
      prompt: '스케줄링 알고리즘에 대해서 설명해보세요.',
      answer: 'CPU 스케줄링은 여러 프로세스가 CPU를 효율적으로 사용할 수 있도록 관리하는 방법입니다. FCFS(First Come First Served), SJF(Shortest Job First), RR(Round Robin), Priority Scheduling 등이 있습니다. 각각 장단점이 있어 시스템의 특성에 따라 적절한 알고리즘을 선택해야 합니다.',
      keywords: ['스케줄링', 'FCFS', 'SJF', 'Round Robin', 'Priority', 'CPU'],
      keywordThreshold: 3,
      explain: 'CPU 스케줄링은 프로세스들이 CPU를 공정하고 효율적으로 사용하도록 관리하는 방법입니다.',
      created: new Date()
    },
    
    // 데이터베이스 관련 문제들
    {
      type: 'ESSAY',
      deck: 'database',
      prompt: '트랜잭션의 ACID 속성에 대해 설명해보세요.',
      answer: 'ACID는 Atomicity(원자성), Consistency(일관성), Isolation(격리성), Durability(지속성)의 줄임말입니다. 원자성은 트랜잭션의 모든 연산이 완전히 수행되거나 전혀 수행되지 않아야 함을 의미합니다. 일관성은 트랜잭션 완료 후 데이터베이스가 일관된 상태를 유지해야 함을 의미합니다. 격리성은 동시에 실행되는 트랜잭션들이 서로 영향을 주지 않아야 함을 의미합니다. 지속성은 성공적으로 완료된 트랜잭션의 결과가 영구적으로 반영되어야 함을 의미합니다.',
      keywords: ['ACID', 'Atomicity', 'Consistency', 'Isolation', 'Durability', '트랜잭션'],
      keywordThreshold: 4,
      explain: 'ACID는 데이터베이스 트랜잭션의 안전성과 신뢰성을 보장하는 네 가지 속성입니다.',
      created: new Date()
    },
    {
      type: 'ESSAY',
      deck: 'database',
      prompt: 'SQL Injection에 대해서 설명해보세요.',
      answer: 'SQL Injection은 웹 애플리케이션의 보안 취약점 중 하나로, 사용자 입력값을 제대로 검증하지 않아 데이터베이스 쿼리가 변조되는 공격입니다. 공격자가 악의적인 SQL 코드를 입력하여 데이터베이스의 정보를 무단으로 조회, 수정, 삭제할 수 있습니다. 예방 방법으로는 Prepared Statement 사용, 입력값 검증, 최소 권한 원칙 적용 등이 있습니다.',
      keywords: ['SQL Injection', '보안', 'Prepared Statement', '입력값 검증', '취약점'],
      keywordThreshold: 3,
      explain: 'SQL Injection은 입력값 검증 부족으로 발생하는 데이터베이스 보안 취약점입니다.',
      created: new Date()
    },
    
    // 자료구조/알고리즘 관련 문제들
    {
      type: 'ESSAY',
      deck: 'data-structure-algorithm',
      prompt: 'HashMap의 동작 원리와 시간 복잡도에 대해 설명해보세요.',
      answer: 'HashMap은 해시 함수를 사용하여 키를 배열의 인덱스로 변환하고, 해당 위치에 값을 저장하는 자료구조입니다. 해시 함수가 잘 설계되어 있다면 평균적으로 O(1)의 시간 복잡도로 삽입, 삭제, 검색 연산을 수행할 수 있습니다. 하지만 해시 충돌이 많이 발생하면 최악의 경우 O(n)의 시간 복잡도를 가질 수 있습니다. 충돌 해결 방법으로는 체이닝과 개방 주소법이 있습니다.',
      keywords: ['HashMap', '해시함수', 'O(1)', '해시충돌', '체이닝', '개방 주소법'],
      keywordThreshold: 3,
      explain: 'HashMap은 해시 함수를 이용해 빠른 검색을 제공하는 자료구조입니다.',
      created: new Date()
    },
    {
      type: 'ESSAY',
      deck: 'data-structure-algorithm',
      prompt: 'Big O 표기법에 대해 설명해보세요.',
      answer: 'Big O 표기법은 알고리즘의 시간 복잡도나 공간 복잡도를 나타내는 방법으로, 입력 크기가 증가할 때 알고리즘의 실행 시간이나 메모리 사용량이 어떻게 변하는지를 표현합니다. O(1)은 상수 시간, O(log n)은 로그 시간, O(n)은 선형 시간, O(n²)은 이차 시간을 의미합니다. 최악의 경우를 기준으로 하며, 알고리즘의 효율성을 비교하는 데 사용됩니다.',
      keywords: ['Big O', '시간복잡도', '공간복잡도', '알고리즘', '효율성'],
      keywordThreshold: 3,
      explain: 'Big O 표기법은 알고리즘의 효율성을 분석하고 비교하는 도구입니다.',
      created: new Date()
    }
  ];
  
  console.log(`Providing ${sampleQuestions.length} fallback questions from ${sampleDecks.length} categories`);
  return { questions: sampleQuestions, decks: sampleDecks };
}