// ========== Type-Safe Function Signatures for Core Quiz Logic ==========

import type {
  Question,
  TypedQuestion,
  OXQuestion,
  ShortQuestion,
  EssayQuestion,
  KeywordQuestion,
  QuestionType,
  UserPerformance,
  PerformanceRecord,
  SessionStats,
  GradingResult,
  Explanation,
  InteractiveExplanation,
  Grade,
  DifficultyLevel,
  Deck,
  UserProfile
} from './quiz-models.js';

// ========== Database Operations ==========

/**
 * Database interface for CRUD operations
 */
export interface QuizDatabase {
  // Question operations
  getQuestion(id: number): Promise<Question | undefined>;
  getQuestions(deckId?: number): Promise<Question[]>;
  addQuestion(question: Omit<Question, 'id'>): Promise<number>;
  updateQuestion(id: number, updates: Partial<Question>): Promise<void>;
  deleteQuestion(id: number): Promise<void>;
  
  // User performance operations
  getPerformance(questionId: number): Promise<UserPerformance | undefined>;
  getAllPerformance(): Promise<Record<number, UserPerformance>>;
  updatePerformance(questionId: number, performance: UserPerformance): Promise<void>;
  
  // Deck operations
  getDecks(): Promise<Deck[]>;
  getDeck(id: number): Promise<Deck | undefined>;
  addDeck(deck: Omit<Deck, 'id'>): Promise<number>;
  updateDeck(id: number, updates: Partial<Deck>): Promise<void>;
  deleteDeck(id: number): Promise<void>;
  
  // Profile operations
  getProfile(): Promise<UserProfile>;
  updateProfile(updates: Partial<UserProfile>): Promise<void>;
}

// ========== Question Management ==========

/**
 * Create a new question with type safety
 */
export declare function createQuestion<T extends QuestionType>(
  type: T,
  baseData: Omit<Question, 'id' | 'type'>,
  typeSpecificData: T extends 'OX' 
    ? { answer: boolean | 'true' | 'false' }
    : T extends 'SHORT'
    ? { answer: string; synonyms?: string[]; shortFuzzy?: boolean }
    : T extends 'ESSAY' | 'KEYWORD'
    ? { keywords: string[]; keywordThreshold?: string | number }
    : never
): TypedQuestion;

/**
 * Validate question data based on type
 */
export declare function validateQuestion(question: Question): {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
};

/**
 * Type guard to check if question is of specific type
 */
export declare function isQuestionType<T extends QuestionType>(
  question: Question,
  type: T
): question is T extends 'OX' 
  ? OXQuestion 
  : T extends 'SHORT' 
  ? ShortQuestion 
  : T extends 'ESSAY' 
  ? EssayQuestion 
  : KeywordQuestion;

// ========== Answer Grading System ==========

/**
 * Grade an answer for any question type
 */
export declare function gradeAnswer(
  question: TypedQuestion,
  userAnswer: string
): Promise<GradingResult>;

/**
 * Grade OX (True/False) questions
 */
export declare function gradeOXAnswer(
  question: OXQuestion,
  userAnswer: string | boolean
): GradingResult;

/**
 * Grade SHORT (short answer) questions with fuzzy matching
 */
export declare function gradeShortAnswer(
  question: ShortQuestion,
  userAnswer: string,
  options?: {
    enableFuzzy?: boolean;
    fuzzyThreshold?: number;
    caseSensitive?: boolean;
  }
): GradingResult;

/**
 * Grade KEYWORD questions with partial matching
 */
export declare function gradeKeywordAnswer(
  question: KeywordQuestion,
  userAnswer: string,
  options?: {
    threshold?: number | string;
    partialCredit?: boolean;
  }
): GradingResult;

/**
 * Grade ESSAY questions (potentially with AI assistance)
 */
export declare function gradeEssayAnswer(
  question: EssayQuestion,
  userAnswer: string,
  options?: {
    useAI?: boolean;
    aiModel?: string;
    keywordWeight?: number;
    contextWeight?: number;
  }
): Promise<GradingResult>;

// ========== Spaced Repetition Algorithm ==========

/**
 * Calculate next review schedule using SM-2 algorithm
 */
export declare function calculateNextReview(
  performance: UserPerformance,
  grade: Grade,
  options?: {
    easeFactor?: number;
    intervalModifier?: number;
    minimumInterval?: number;
    maximumInterval?: number;
  }
): UserPerformance;

/**
 * Determine if a question is due for review
 */
export declare function isQuestionDue(
  performance: UserPerformance,
  currentDate?: Date
): boolean;

/**
 * Get questions due for review
 */
export declare function getDueQuestions(
  questions: Question[],
  performances: Record<number, UserPerformance>,
  currentDate?: Date
): Question[];

/**
 * Simulate next due date for grade preview
 */
export declare function simulateNextDueDate(
  performance: UserPerformance,
  grade: Grade
): string;

// ========== Adaptive Difficulty System ==========

/**
 * Calculate user's current accuracy
 */
export declare function calculateAccuracy(
  performance: UserPerformance
): number;

/**
 * Determine if difficulty should be adjusted
 */
export declare function shouldAdjustDifficulty(
  accuracy: number,
  currentDifficulty: DifficultyLevel
): {
  shouldAdjust: boolean;
  newDifficulty: DifficultyLevel;
  reason: string;
};

/**
 * Update user performance with difficulty adjustment
 */
export declare function updateUserPerformance(
  questionId: number,
  currentPerformance: UserPerformance,
  isCorrect: boolean
): UserPerformance;

/**
 * Select questions based on difficulty level
 */
export declare function selectQuestionsByDifficulty(
  questions: Question[],
  performances: Record<number, UserPerformance>,
  targetDifficulty: DifficultyLevel,
  tolerance?: number
): Question[];

/**
 * Get difficulty statistics for user
 */
export declare function getDifficultyStats(
  performances: Record<number, UserPerformance>
): {
  currentLevel: DifficultyLevel;
  currentLevelName: string;
  recentAccuracy: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  isAdaptive: boolean;
};

// ========== Session Management ==========

/**
 * Study session configuration
 */
export interface SessionConfig {
  deckId?: number;
  questionCount?: number;
  difficultyLevel?: DifficultyLevel;
  enableAdaptiveDifficulty?: boolean;
  includeNew?: boolean;
  includeReview?: boolean;
  randomOrder?: boolean;
}

/**
 * Active study session state
 */
export interface StudySession {
  id: string;
  config: SessionConfig;
  questions: Question[];
  currentIndex: number;
  results: {
    questionId: number;
    userAnswer: string;
    gradingResult: GradingResult;
    responseTime: number;
    grade?: Grade;
  }[];
  startTime: Date;
  currentQuestion?: Question;
  isActive: boolean;
  stats: SessionStats;
}

/**
 * Start a new study session
 */
export declare function startStudySession(
  config: SessionConfig,
  database: QuizDatabase
): Promise<StudySession>;

/**
 * Submit an answer in the current session
 */
export declare function submitSessionAnswer(
  session: StudySession,
  userAnswer: string
): Promise<{
  gradingResult: GradingResult;
  nextQuestion?: Question;
  isSessionComplete: boolean;
}>;

/**
 * Grade the current question and move to next
 */
export declare function gradeSessionAnswer(
  session: StudySession,
  grade: Grade
): Promise<{
  updatedPerformance: UserPerformance;
  nextQuestion?: Question;
  isSessionComplete: boolean;
}>;

/**
 * End the current session and calculate final stats
 */
export declare function endStudySession(
  session: StudySession,
  database: QuizDatabase
): Promise<SessionStats>;

// ========== Explanation System ==========

/**
 * Generate explanation for a question
 */
export declare function generateExplanation(
  question: Question,
  userAnswer?: string,
  gradingResult?: GradingResult,
  options?: {
    type?: 'basic' | 'detailed' | 'ai-generated';
    targetDifficulty?: DifficultyLevel;
    includeExamples?: boolean;
    useAI?: boolean;
  }
): Promise<Explanation>;

/**
 * Create interactive explanation with follow-ups
 */
export declare function createInteractiveExplanation(
  question: Question,
  baseExplanation: Explanation,
  options?: {
    generateFollowUps?: boolean;
    includeResources?: boolean;
    includeVisuals?: boolean;
  }
): Promise<InteractiveExplanation>;

/**
 * Get contextual hint based on user's mistake
 */
export declare function getContextualHint(
  question: Question,
  userAnswer: string,
  gradingResult: GradingResult
): Promise<string>;

// ========== Import/Export System ==========

/**
 * Import questions from various formats
 */
export interface ImportOptions {
  format: 'csv' | 'tsv' | 'json' | 'txt';
  deckId?: number;
  createDeck?: boolean;
  skipDuplicates?: boolean;
  validateOnly?: boolean;
}

export declare function importQuestions(
  data: string | File,
  options: ImportOptions
): Promise<{
  imported: number;
  skipped: number;
  errors: { row: number; message: string; data?: any }[];
  createdQuestions?: Question[];
}>;

/**
 * Export questions to various formats
 */
export interface ExportOptions {
  format: 'csv' | 'tsv' | 'json' | 'markdown';
  deckIds?: number[];
  includePerformance?: boolean;
  includeStats?: boolean;
}

export declare function exportQuestions(
  questions: Question[],
  performances?: Record<number, UserPerformance>,
  options?: ExportOptions
): Promise<string>;

// ========== Statistics and Analytics ==========

/**
 * Calculate comprehensive study statistics
 */
export declare function calculateStudyStats(
  questions: Question[],
  performances: Record<number, UserPerformance>,
  sessions?: StudySession[]
): Promise<{
  overall: {
    totalQuestions: number;
    questionsStudied: number;
    averageAccuracy: number;
    totalStudyTime: number;
    currentStreak: number;
  };
  byDifficulty: Record<DifficultyLevel, {
    count: number;
    accuracy: number;
    averageInterval: number;
  }>;
  byType: Record<QuestionType, {
    count: number;
    accuracy: number;
    averageScore: number;
  }>;
  trends: {
    accuracyTrend: number[]; // Last 30 days
    volumeTrend: number[];   // Questions per day
    difficultyProgression: DifficultyLevel[];
  };
}>;

/**
 * Get personalized study recommendations
 */
export declare function getStudyRecommendations(
  questions: Question[],
  performances: Record<number, UserPerformance>,
  profile: UserProfile
): Promise<{
  suggestedDeck?: number;
  suggestedDifficulty?: DifficultyLevel;
  focusAreas: string[];
  dailyGoalAdjustment?: number;
  weakTopics: { topic: string; accuracy: number }[];
  strengths: string[];
}>;

// ========== Utility Types and Helpers ==========

/**
 * Type for question creation based on type
 */
export type QuestionCreationData<T extends QuestionType> = 
  T extends 'OX' ? Omit<OXQuestion, 'id'>
  : T extends 'SHORT' ? Omit<ShortQuestion, 'id'>
  : T extends 'ESSAY' ? Omit<EssayQuestion, 'id'>
  : T extends 'KEYWORD' ? Omit<KeywordQuestion, 'id'>
  : never;

/**
 * Result type for async operations
 */
export type AsyncResult<T, E = Error> = Promise<{
  success: boolean;
  data?: T;
  error?: E;
  message?: string;
}>;

/**
 * Pagination parameters
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: keyof Question;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Generic filter type for questions
 */
export interface QuestionFilter {
  deckIds?: number[];
  types?: QuestionType[];
  tags?: string[];
  difficulties?: DifficultyLevel[];
  searchTerm?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Apply filters to question list
 */
export declare function filterQuestions(
  questions: Question[],
  performances: Record<number, UserPerformance>,
  filter: QuestionFilter,
  pagination?: PaginationOptions
): PaginatedResult<Question>;

// ========== Error Types ==========

export class QuizError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'QuizError';
  }
}

export class ValidationError extends QuizError {
  constructor(message: string, public field: string, public value?: any) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

export class GradingError extends QuizError {
  constructor(message: string, public questionType: QuestionType) {
    super(message, 'GRADING_ERROR', { questionType });
    this.name = 'GradingError';
  }
}

export class SessionError extends QuizError {
  constructor(message: string, public sessionId?: string) {
    super(message, 'SESSION_ERROR', { sessionId });
    this.name = 'SessionError';
  }
}