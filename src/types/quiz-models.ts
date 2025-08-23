// ========== Core Quiz TypeScript Models ==========

/**
 * Question Types supported by the CS Study App
 */
export type QuestionType = 'OX' | 'SHORT' | 'ESSAY' | 'KEYWORD';

/**
 * Difficulty levels for adaptive learning system
 */
export enum DifficultyLevel {
  BEGINNER = 1,
  EASY = 2,
  MEDIUM = 3,
  HARD = 4,
  EXPERT = 5
}

/**
 * Spaced repetition grade levels
 */
export enum Grade {
  AGAIN = 0,
  HARD = 1,
  GOOD = 2,
  EASY = 3
}

/**
 * Core Question model with all possible fields
 */
export interface Question {
  /** Unique identifier for the question */
  id: number;
  
  /** Deck ID this question belongs to */
  deck: number | string;
  
  /** Type of question (OX, SHORT, ESSAY, KEYWORD) */
  type: QuestionType;
  
  /** The question text/prompt */
  prompt: string;
  
  /** The correct answer (varies by question type) */
  answer?: string | boolean;
  
  /** Detailed explanation of the answer */
  explain?: string;
  
  /** Creation timestamp */
  created?: number;
  
  /** Sort order for manual arrangement */
  sortOrder?: number;
  
  /** Tags for categorization and filtering */
  tags?: string[];
  
  // Type-specific fields
  
  /** Keywords for KEYWORD/ESSAY type questions */
  keywords?: string[];
  
  /** Keyword matching threshold (e.g., "3/5" or 0.6) */
  keywordThreshold?: string | number;
  
  /** Synonyms for SHORT type questions */
  synonyms?: string[];
  
  /** Whether fuzzy matching is enabled for SHORT questions */
  shortFuzzy?: boolean;
  
  /** AI-generated flag */
  generated?: boolean;
}

/**
 * Type-safe question variants for each question type
 */
export interface OXQuestion extends Question {
  type: 'OX';
  answer: 'true' | 'false' | boolean;
  keywords?: never;
  synonyms?: never;
  keywordThreshold?: never;
  shortFuzzy?: never;
}

export interface ShortQuestion extends Question {
  type: 'SHORT';
  answer: string;
  synonyms?: string[];
  shortFuzzy?: boolean;
  keywords?: never;
  keywordThreshold?: never;
}

export interface EssayQuestion extends Question {
  type: 'ESSAY';
  answer?: string | undefined;
  keywords: string[];
  keywordThreshold?: string | number;
  synonyms?: never;
  shortFuzzy?: never;
}

export interface KeywordQuestion extends Question {
  type: 'KEYWORD';
  answer?: string | undefined;
  keywords: string[];
  keywordThreshold?: string | number;
  synonyms?: never;
  shortFuzzy?: never;
}

/**
 * Union type for type-safe question handling
 */
export type TypedQuestion = OXQuestion | ShortQuestion | EssayQuestion | KeywordQuestion;

/**
 * User performance data for spaced repetition
 */
export interface UserPerformance {
  /** Unique identifier */
  id?: number;
  
  /** Question this performance data relates to */
  questionId: number;
  
  /** Ease factor for spaced repetition algorithm (SM-2) */
  ease: number;
  
  /** Current interval in days */
  interval: number;
  
  /** Next due date (ISO string) */
  due: string;
  
  /** Total number of times this question has been reviewed */
  count: number;
  
  /** Number of correct answers */
  correct?: number;
  
  /** Number of "again" grades */
  againCount?: number;
  
  /** Last result ('ok' or 'ng') */
  lastResult?: 'ok' | 'ng';
  
  /** Creation timestamp */
  created: string;
  
  /** Last updated timestamp */
  updated: string;
  
  // Adaptive difficulty fields
  
  /** Current difficulty level (1-5) */
  difficulty?: DifficultyLevel;
  
  /** When difficulty was last updated */
  difficultyUpdated?: string;
  
  /** Reason for last difficulty change */
  difficultyReason?: string;
  
  /** Recent performance history for trend analysis */
  recentPerformance?: PerformanceRecord[];
}

/**
 * Individual performance record for tracking trends
 */
export interface PerformanceRecord {
  /** Whether the answer was correct */
  correct: boolean;
  
  /** Difficulty level at time of answer */
  difficulty: DifficultyLevel;
  
  /** Timestamp of the attempt */
  timestamp: string;
  
  /** Grade given (0-3) */
  grade?: Grade;
}

/**
 * Session performance statistics
 */
export interface SessionStats {
  /** Total questions attempted */
  total: number;
  
  /** Number of correct answers */
  correct: number;
  
  /** Number of incorrect answers */
  incorrect: number;
  
  /** Number of skipped questions */
  skipped: number;
  
  /** Overall accuracy percentage */
  accuracy: number;
  
  /** Total XP gained */
  xp: number;
  
  /** Session duration in milliseconds */
  duration?: number;
  
  /** Average response time per question */
  avgResponseTime?: number;
  
  /** Difficulty distribution */
  difficultyBreakdown?: Record<DifficultyLevel, number>;
}

/**
 * Answer validation and grading result
 */
export interface GradingResult {
  /** Whether the answer is correct */
  correct: boolean;
  
  /** Numerical score (0-1 for most types, 0-100 for essays) */
  score: number;
  
  /** Detailed feedback message */
  feedback: string;
  
  /** Keywords/terms that matched */
  hits: string[];
  
  /** Keywords/terms that were missed */
  misses: string[];
  
  /** Additional notes from grading */
  notes?: string;
  
  /** Whether AI was used for grading */
  aiGraded?: boolean;
  
  /** Grade suggestion based on performance */
  suggestedGrade?: Grade;
}

/**
 * Explanation and feedback system
 */
export interface Explanation {
  /** The explanation text */
  content: string;
  
  /** Type of explanation */
  type: 'basic' | 'detailed' | 'ai-generated';
  
  /** Associated question ID */
  questionId: number;
  
  /** Confidence level of explanation (0-1) */
  confidence?: number;
  
  /** Source of explanation (manual, AI, etc.) */
  source?: string;
  
  /** Related concepts or topics */
  relatedConcepts?: string[];
  
  /** Difficulty level this explanation targets */
  targetDifficulty?: DifficultyLevel;
  
  /** Language/locale */
  locale?: string;
  
  /** When explanation was created/updated */
  timestamp?: string;
}

/**
 * Enhanced explanation with interactive elements
 */
export interface InteractiveExplanation extends Explanation {
  /** Follow-up questions for deeper understanding */
  followUpQuestions?: string[];
  
  /** Related examples */
  examples?: string[];
  
  /** Links to additional resources */
  resources?: {
    title: string;
    url: string;
    type: 'article' | 'video' | 'documentation' | 'tutorial';
  }[];
  
  /** Visual aids or diagrams */
  visuals?: {
    type: 'diagram' | 'code' | 'flowchart' | 'image';
    content: string;
    caption?: string;
  }[];
}

/**
 * Study deck information
 */
export interface Deck {
  /** Unique identifier */
  id: number;
  
  /** Deck name */
  name: string;
  
  /** Creation timestamp */
  created: number;
  
  /** Optional description */
  description?: string;
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Number of questions in deck */
  questionCount?: number;
  
  /** Last studied timestamp */
  lastStudied?: string;
}

/**
 * App profile and user progress
 */
export interface UserProfile {
  /** Unique identifier */
  id?: number;
  
  /** Total XP earned */
  xp: number;
  
  /** Current study streak in days */
  streak: number;
  
  /** Last study session date */
  lastStudy: string;
  
  /** User preferences */
  preferences?: {
    dailyGoal?: number;
    preferredDifficulty?: DifficultyLevel;
    enableAdaptiveDifficulty?: boolean;
    enableAI?: boolean;
  };
  
  /** Achievement badges */
  achievements?: string[];
  
  /** Study statistics */
  stats?: {
    totalQuestions?: number;
    totalSessions?: number;
    averageAccuracy?: number;
    favoriteDecks?: number[];
  };
}