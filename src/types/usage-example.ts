// ========== TypeScript Usage Examples ==========
// This file demonstrates how to use the type-safe quiz interfaces

import type {
  Question,
  OXQuestion,
  ShortQuestion,
  EssayQuestion,
  KeywordQuestion,
  TypedQuestion,
  UserPerformance,
  GradingResult,
  StudySession,
  SessionConfig,
  DifficultyLevel,
  Grade,
  QuizDatabase
} from './index.js';

// ========== Type-Safe Question Creation ==========

/**
 * Example: Creating different types of questions with full type safety
 */
function createOXQuestion(): OXQuestion {
  return {
    id: 1,
    deck: 'computer-science',
    type: 'OX',
    prompt: 'TCP is a connection-oriented protocol.',
    answer: 'true', // Type-safe: must be 'true' | 'false' | boolean
    explain: 'TCP establishes a connection using 3-way handshake.',
    created: Date.now(),
    tags: ['networking', 'protocols']
    // synonyms, keywords are never allowed for OX questions
  };
}

function createShortQuestion(): ShortQuestion {
  return {
    id: 2,
    deck: 'algorithms',
    type: 'SHORT',
    prompt: 'What is the time complexity of binary search?',
    answer: 'O(log n)', // Type-safe: must be string
    synonyms: ['O(lg n)', 'logarithmic', 'log(n)'],
    shortFuzzy: true,
    explain: 'Binary search eliminates half the search space each iteration.',
    created: Date.now()
    // keywords are never allowed for SHORT questions
  };
}

function createEssayQuestion(): EssayQuestion {
  return {
    id: 3,
    deck: 'system-design',
    type: 'ESSAY',
    prompt: 'Explain how load balancing works in distributed systems.',
    keywords: ['load balancer', 'distribution', 'horizontal scaling', 'health checks'],
    keywordThreshold: '3/4', // Require 3 out of 4 keywords
    explain: 'Load balancers distribute incoming requests across multiple servers.',
    created: Date.now()
    // answer is optional for ESSAY questions
    // synonyms, shortFuzzy are never allowed
  };
}

// ========== Type-Safe Question Processing ==========

/**
 * Example: Type-safe question processing with union types
 */
function processQuestion(question: TypedQuestion): string {
  switch (question.type) {
    case 'OX':
      // TypeScript knows this is OXQuestion
      return `True/False: ${question.prompt} (Answer: ${question.answer})`;
      
    case 'SHORT':
      // TypeScript knows this is ShortQuestion
      const synonymsText = question.synonyms?.length 
        ? ` (Synonyms: ${question.synonyms.join(', ')})` 
        : '';
      return `Short Answer: ${question.prompt} (Answer: ${question.answer}${synonymsText})`;
      
    case 'ESSAY':
    case 'KEYWORD':
      // TypeScript knows this is EssayQuestion | KeywordQuestion
      return `Essay/Keyword: ${question.prompt} (Keywords: ${question.keywords.join(', ')})`;
      
    default:
      // TypeScript ensures exhaustive checking
      const _exhaustive: never = question;
      return `Unknown question type`;
  }
}

// ========== Type-Safe Grading Functions ==========

/**
 * Example: Type-safe answer grading with proper return types
 */
async function gradeQuestionExample(
  question: TypedQuestion, 
  userAnswer: string
): Promise<GradingResult> {
  switch (question.type) {
    case 'OX':
      return gradeOXAnswer(question, userAnswer);
      
    case 'SHORT':
      return gradeShortAnswer(question, userAnswer, {
        enableFuzzy: question.shortFuzzy ?? true,
        fuzzyThreshold: 0.85
      });
      
    case 'ESSAY':
      return await gradeEssayAnswer(question, userAnswer, {
        useAI: true,
        keywordWeight: 0.7,
        contextWeight: 0.3
      });
      
    case 'KEYWORD':
      return gradeKeywordAnswer(question, userAnswer, {
        threshold: question.keywordThreshold
      });
      
    default:
      const _exhaustive: never = question;
      throw new Error(`Unsupported question type`);
  }
}

function gradeOXAnswer(question: OXQuestion, userAnswer: string): GradingResult {
  const correct = question.answer.toString().toLowerCase() === userAnswer.toLowerCase();
  return {
    correct,
    score: correct ? 1 : 0,
    feedback: correct ? 'Correct!' : `Incorrect. The answer is ${question.answer}.`,
    hits: correct ? [question.answer.toString()] : [],
    misses: correct ? [] : [question.answer.toString()]
  };
}

function gradeShortAnswer(
  question: ShortQuestion, 
  userAnswer: string,
  options: { enableFuzzy?: boolean; fuzzyThreshold?: number } = {}
): GradingResult {
  // Normalize answers for comparison
  const normalize = (text: string) => text.toLowerCase().trim();
  const normalizedUser = normalize(userAnswer);
  const normalizedCorrect = normalize(question.answer);
  
  // Exact match
  if (normalizedUser === normalizedCorrect) {
    return {
      correct: true,
      score: 1,
      feedback: 'Correct!',
      hits: [question.answer],
      misses: []
    };
  }
  
  // Check synonyms
  if (question.synonyms) {
    for (const synonym of question.synonyms) {
      if (normalize(synonym) === normalizedUser) {
        return {
          correct: true,
          score: 1,
          feedback: 'Correct! (Accepted synonym)',
          hits: [synonym],
          misses: []
        };
      }
    }
  }
  
  // TODO: Fuzzy matching implementation would go here
  
  return {
    correct: false,
    score: 0,
    feedback: `Incorrect. The answer is ${question.answer}.`,
    hits: [],
    misses: [question.answer]
  };
}

function gradeKeywordAnswer(
  question: KeywordQuestion | EssayQuestion,
  userAnswer: string,
  options: { threshold?: string | number } = {}
): GradingResult {
  const normalizedAnswer = userAnswer.toLowerCase();
  const hits: string[] = [];
  const misses: string[] = [];
  
  // Check each keyword
  for (const keyword of question.keywords) {
    if (normalizedAnswer.includes(keyword.toLowerCase())) {
      hits.push(keyword);
    } else {
      misses.push(keyword);
    }
  }
  
  // Calculate threshold
  let threshold = 0.5; // Default 50%
  if (options.threshold) {
    if (typeof options.threshold === 'string' && options.threshold.includes('/')) {
      const [num, denom] = options.threshold.split('/').map(Number);
      threshold = num / denom;
    } else if (typeof options.threshold === 'number') {
      threshold = options.threshold;
    }
  }
  
  const score = hits.length / question.keywords.length;
  const correct = score >= threshold;
  
  return {
    correct,
    score,
    feedback: `Found ${hits.length}/${question.keywords.length} keywords. ${correct ? 'Passed!' : 'Needs more keywords.'}`,
    hits,
    misses
  };
}

async function gradeEssayAnswer(
  question: EssayQuestion,
  userAnswer: string,
  options: { useAI?: boolean; keywordWeight?: number; contextWeight?: number } = {}
): Promise<GradingResult> {
  // Start with keyword-based grading
  const keywordResult = gradeKeywordAnswer(question, userAnswer);
  
  if (!options.useAI) {
    return keywordResult;
  }
  
  // TODO: AI-based grading would be implemented here
  // This would analyze context, coherence, and depth of understanding
  
  return {
    ...keywordResult,
    feedback: `${keywordResult.feedback} (AI-enhanced grading)`,
    aiGraded: true
  };
}

// ========== Type-Safe Session Management ==========

/**
 * Example: Type-safe study session with proper state management
 */
class TypeSafeStudySession {
  private session: StudySession | null = null;
  
  constructor(private database: QuizDatabase) {}
  
  async startSession(config: SessionConfig): Promise<StudySession> {
    // Get questions based on config
    const allQuestions = await this.database.getQuestions(config.deckId);
    const performances = await this.database.getAllPerformance();
    
    // Filter questions based on difficulty and other criteria
    let questions = allQuestions;
    
    if (config.difficultyLevel) {
      questions = this.filterByDifficulty(questions, performances, config.difficultyLevel);
    }
    
    // Limit number of questions
    if (config.questionCount) {
      questions = questions.slice(0, config.questionCount);
    }
    
    // Randomize if requested
    if (config.randomOrder) {
      questions = this.shuffleArray([...questions]);
    }
    
    this.session = {
      id: generateSessionId(),
      config,
      questions,
      currentIndex: 0,
      results: [],
      startTime: new Date(),
      isActive: true,
      stats: {
        total: questions.length,
        correct: 0,
        incorrect: 0,
        skipped: 0,
        accuracy: 0,
        xp: 0
      }
    };
    
    return this.session;
  }
  
  async submitAnswer(userAnswer: string): Promise<GradingResult | null> {
    if (!this.session || this.session.currentIndex >= this.session.questions.length) {
      return null;
    }
    
    const currentQuestion = this.session.questions[this.session.currentIndex];
    const gradingResult = await gradeQuestionExample(currentQuestion, userAnswer);
    
    // Record the result
    this.session.results.push({
      questionId: currentQuestion.id,
      userAnswer,
      gradingResult,
      responseTime: Date.now() - this.session.startTime.getTime()
    });
    
    // Update stats
    if (gradingResult.correct) {
      this.session.stats.correct++;
    } else {
      this.session.stats.incorrect++;
    }
    
    this.session.stats.accuracy = this.session.stats.correct / (this.session.stats.correct + this.session.stats.incorrect);
    
    return gradingResult;
  }
  
  moveToNext(): Question | null {
    if (!this.session) return null;
    
    this.session.currentIndex++;
    
    if (this.session.currentIndex >= this.session.questions.length) {
      this.session.isActive = false;
      return null;
    }
    
    return this.session.questions[this.session.currentIndex];
  }
  
  private filterByDifficulty(
    questions: Question[], 
    performances: Record<number, UserPerformance>,
    targetDifficulty: DifficultyLevel
  ): Question[] {
    return questions.filter(q => {
      const performance = performances[q.id];
      const questionDifficulty = performance?.difficulty ?? DifficultyLevel.MEDIUM;
      return Math.abs(questionDifficulty - targetDifficulty) <= 1;
    });
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// ========== Utility Functions ==========

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Type guard to check if a question is of a specific type
 */
function isOXQuestion(question: Question): question is OXQuestion {
  return question.type === 'OX';
}

function isShortQuestion(question: Question): question is ShortQuestion {
  return question.type === 'SHORT';
}

function isEssayQuestion(question: Question): question is EssayQuestion {
  return question.type === 'ESSAY';
}

function isKeywordQuestion(question: Question): question is KeywordQuestion {
  return question.type === 'KEYWORD';
}

// ========== Advanced Type Usage ==========

/**
 * Example: Creating a type-safe question builder
 */
class QuestionBuilder<T extends TypedQuestion['type']> {
  private question: Partial<Question> = {};
  
  constructor(private type: T) {
    this.question.type = type;
  }
  
  setPrompt(prompt: string): this {
    this.question.prompt = prompt;
    return this;
  }
  
  setDeck(deck: number | string): this {
    this.question.deck = deck;
    return this;
  }
  
  setExplanation(explain: string): this {
    this.question.explain = explain;
    return this;
  }
  
  setTags(tags: string[]): this {
    this.question.tags = tags;
    return this;
  }
  
  // Type-safe method that only appears for OX questions
  setAnswer(this: T extends 'OX' ? QuestionBuilder<T> : never, answer: boolean | 'true' | 'false'): this {
    this.question.answer = answer;
    return this;
  }
  
  // Type-safe method that only appears for SHORT questions
  setShortAnswer(
    this: T extends 'SHORT' ? QuestionBuilder<T> : never, 
    answer: string, 
    synonyms?: string[], 
    fuzzy?: boolean
  ): this {
    this.question.answer = answer;
    (this.question as any).synonyms = synonyms;
    (this.question as any).shortFuzzy = fuzzy;
    return this;
  }
  
  // Type-safe method that only appears for ESSAY/KEYWORD questions
  setKeywords(
    this: T extends 'ESSAY' | 'KEYWORD' ? QuestionBuilder<T> : never,
    keywords: string[],
    threshold?: string | number
  ): this {
    (this.question as any).keywords = keywords;
    if (threshold) {
      (this.question as any).keywordThreshold = threshold;
    }
    return this;
  }
  
  build(): TypedQuestion {
    if (!this.question.prompt) {
      throw new Error('Question prompt is required');
    }
    if (!this.question.deck) {
      throw new Error('Question deck is required');
    }
    
    return this.question as TypedQuestion;
  }
}

// Usage examples:
const oxQuestion = new QuestionBuilder('OX')
  .setPrompt('Is TypeScript a superset of JavaScript?')
  .setDeck('programming')
  .setAnswer(true)
  .setExplanation('TypeScript adds static typing to JavaScript')
  .build();

const shortQuestion = new QuestionBuilder('SHORT')
  .setPrompt('What does CPU stand for?')
  .setDeck('hardware')
  .setShortAnswer('Central Processing Unit', ['CPU', 'Processor'])
  .build();

const essayQuestion = new QuestionBuilder('ESSAY')
  .setPrompt('Explain the principles of object-oriented programming')
  .setDeck('programming')
  .setKeywords(['encapsulation', 'inheritance', 'polymorphism', 'abstraction'], '3/4')
  .build();

// Export examples for documentation
export {
  TypeSafeStudySession,
  QuestionBuilder,
  createOXQuestion,
  createShortQuestion,
  createEssayQuestion,
  processQuestion,
  gradeQuestionExample
};