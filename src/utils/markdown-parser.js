// Markdown Parser for Backend Interview Questions
// Converts markdown formatted Q&A to question objects

export function parseBackendInterviewMarkdown(markdownText) {
  console.log('Starting markdown parsing...');
  const questions = [];
  let currentCategory = '';
  let currentCategoryId = '';
  
  // Split into lines and process
  const lines = markdownText.split('\n');
  console.log(`Processing ${lines.length} lines`);
  let i = 0;
  let categoriesFound = 0;
  let questionsFound = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Check for category headers (### Network, ### OS, etc.)
    if (line.startsWith('###')) {
      currentCategory = line.replace(/^#{1,6}\s*/, '').trim(); // Remove all # characters and whitespace
      currentCategoryId = generateCategoryId(currentCategory);
      categoriesFound++;
      console.log(`Found category ${categoriesFound}: "${currentCategory}" -> ${currentCategoryId}`);
      i++;
      continue;
    }
    
    // Check for question details blocks
    if (line.includes('<details>')) {
      const questionData = parseDetailsBlock(lines, i);
      if (questionData && questionData.prompt && questionData.answer && currentCategoryId) {
        questions.push({
          ...questionData,
          deck: currentCategoryId,
          category: currentCategory
        });
        questionsFound++;
        if (questionsFound <= 3) {
          console.log(`Question ${questionsFound}: "${questionData.prompt.substring(0, 50)}..."`);
        }
        i = questionData.endIndex;
      } else {
        console.log(`Skipped invalid question data at line ${i}`);
        i++;
      }
      continue;
    }
    
    i++;
  }
  
  console.log(`Parsing complete: ${categoriesFound} categories, ${questionsFound} questions`);
  return questions;
}

function generateCategoryId(categoryName) {
  const categoryMap = {
    '네트워크': 'network',
    '운영체제': 'os', 
    '운영체제 / 논리회로 일반': 'os-logic',
    '데이터베이스': 'database',
    '자료구조/알고리즘': 'data-structure-algorithm',
    '자료 구조 및 알고리즘': 'data-structure-algorithm',
    '암호학/보안(간단한 정도)': 'security',
    '웹서버의 동작과정': 'web-server',
    'Web': 'web',
    'Java': 'java',
    'Java / JVM': 'java-jvm',
    'Python': 'python',
    'nodeJS': 'nodejs',
    'Spring': 'spring',
    'JPA': 'jpa',
    '디자인 및 테스트': 'design-test',
    '디자인 패턴': 'design-pattern',
    '컴파일러': 'compiler',
    '테스트': 'test',
    '인프라/클라우드': 'infra-cloud',
    '컨테이너': 'container',
    'DevOps': 'devops',
    '최신기술에 관심이 있는지': 'latest-tech',
    '트러블 슈팅': 'troubleshooting',
    '커뮤니케이션': 'communication',
    '개인의 역량': 'personal-skills',
    '기타': 'misc'
  };
  
  const mapped = categoryMap[categoryName];
  if (mapped) {
    console.log(`Mapped category "${categoryName}" -> "${mapped}"`);
    return mapped;
  }
  
  // Fallback: clean up the category name
  const fallback = categoryName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[\/()]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  console.log(`Fallback category mapping "${categoryName}" -> "${fallback}"`);
  return fallback;
}

function parseDetailsBlock(lines, startIndex) {
  let i = startIndex;
  let prompt = '';
  let answer = '';
  let inAnswer = false;
  
  // Find the summary (question prompt)
  while (i < lines.length && !lines[i].includes('<summary>')) {
    i++;
  }
  
  if (i >= lines.length) {
    console.log(`No summary found starting at line ${startIndex}`);
    return { endIndex: startIndex + 1 };
  }
  
  // Extract prompt from summary
  const summaryLine = lines[i];
  prompt = summaryLine.replace(/<\/?summary>/g, '').trim();
  console.log(`Extracted prompt: "${prompt.substring(0, 50)}..."`);
  
  // Find the answer content between <p> tags
  i++;
  while (i < lines.length && !lines[i].includes('</details>')) {
    const line = lines[i].trim();
    
    if (line.includes('<p>') || inAnswer) {
      inAnswer = true;
      
      // Clean HTML tags and collect answer text
      let cleanLine = line
        .replace(/<\/?p>/g, '')
        .replace(/<\/?li>/g, '')
        .replace(/<\/?ul>/g, '')
        .replace(/<\/?ol>/g, '')
        .replace(/<\/?strong>/g, '')
        .replace(/<\/?em>/g, '')
        .replace(/<\/?b>/g, '')
        .replace(/<\/?i>/g, '')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/&#46;/g, '.')
        .replace(/&nbsp;/g, ' ')
        .trim();
        
      if (cleanLine) {
        answer += (answer ? '\n' : '') + cleanLine;
      }
      
      if (line.includes('</p>')) {
        // Continue collecting until we find </details>
      }
    }
    
    i++;
  }
  
  console.log(`Extracted answer length: ${answer.length} characters`);
  
  if (prompt && answer) {
    const keywords = extractKeywords(answer);
    const questionData = {
      type: 'ESSAY', // Descriptive questions are essay type
      prompt: prompt,
      answer: answer.trim(),
      keywords: keywords,
      keywordThreshold: Math.max(2, Math.min(4, Math.ceil(keywords.length * 0.5))), // 50% of keywords, min 2, max 4
      explain: answer.trim(), // Full answer as explanation
      endIndex: i + 1
    };
    console.log(`Successfully parsed question with ${questionData.keywords.length} keywords`);
    return questionData;
  }
  
  console.log(`Failed to parse question - prompt: ${!!prompt}, answer: ${!!answer}`);
  return { endIndex: i + 1 };
}

function extractKeywords(text) {
  // Extract key technical terms for keyword matching
  const keywords = [];
  
  // Common technical terms and patterns
  const technicalTerms = [
    'TCP', 'UDP', 'HTTP', 'HTTPS', 'SSL', 'DNS', 'OSI',
    'handshake', 'protocol', 'packet', 'connection',
    'server', 'client', 'request', 'response',
    '프로토콜', '연결', '패킷', '서버', '클라이언트',
    '신뢰성', '흐름제어', '혼잡제어', '오류제어'
  ];
  
  technicalTerms.forEach(term => {
    if (text.includes(term)) {
      keywords.push(term);
    }
  });
  
  // Extract words in parentheses (often key concepts)
  const parenthesesMatches = text.match(/\([^)]+\)/g);
  if (parenthesesMatches) {
    parenthesesMatches.forEach(match => {
      const term = match.replace(/[()]/g, '').trim();
      if (term.length > 2) {
        keywords.push(term);
      }
    });
  }
  
  // Remove duplicates and return first 5
  return [...new Set(keywords)].slice(0, 5);
}

export function generateDecksFromQuestions(questions) {
  const deckMap = new Map();
  
  questions.forEach(q => {
    if (!deckMap.has(q.deck)) {
      deckMap.set(q.deck, {
        id: q.deck,
        name: q.category || q.deck,
        created: new Date()
      });
    }
  });
  
  return Array.from(deckMap.values());
}

// Sample function to test parsing
export function testMarkdownParsing() {
  const sampleMarkdown = `### 네트워크

<details>
  <summary>TCP와 UDP의 차이점에 대해서 설명해보세요.</summary>
  </br>
  <p>TCP는 연결 지향형 프로토콜이고 UDP는 데이터를 데이터그램단위로 전송하는 프로토콜입니다.</p>
  <p>TCP는 가상 회선을 만들어 신뢰성을 보장하도록(흐름 제어, 혼잡 제어, 오류 제어) 하는 프로토콜로 따로 신뢰성을 보장하기 위한 절차가 없는 UDP에 비해 속도가 느린편입니다.</p>
</details>`;
  
  return parseBackendInterviewMarkdown(sampleMarkdown);
}