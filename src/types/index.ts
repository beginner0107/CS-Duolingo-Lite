// ========== TypeScript Type Definitions Index ==========

// Re-export all core models
export * from './quiz-models.js';

// Re-export all function signatures
export * from './quiz-functions.js';

// Import and re-export all types from models
import type {
  Question,
  TypedQuestion,
  OXQuestion,
  ShortQuestion,
  EssayQuestion,
  KeywordQuestion,
  UserPerformance,
  PerformanceRecord,
  SessionStats,
  GradingResult,
  Explanation,
  InteractiveExplanation,
  Deck,
  UserProfile,
  QuestionType,
  DifficultyLevel,
  Grade
} from './quiz-models.js';

// Import and re-export all types from functions
import type {
  QuizDatabase,
  StudySession,
  SessionConfig,
  ImportOptions,
  ExportOptions,
  QuestionFilter,
  PaginationOptions,
  PaginatedResult,
  QuestionCreationData,
  AsyncResult,
  QuizError,
  ValidationError,
  GradingError,
  SessionError
} from './quiz-functions.js';

// Re-export all types
export type {
  // Core models
  Question,
  TypedQuestion,
  OXQuestion,
  ShortQuestion,
  EssayQuestion,
  KeywordQuestion,
  UserPerformance,
  PerformanceRecord,
  SessionStats,
  GradingResult,
  Explanation,
  InteractiveExplanation,
  Deck,
  UserProfile,
  
  // Function interfaces
  QuizDatabase,
  StudySession,
  SessionConfig,
  ImportOptions,
  ExportOptions,
  QuestionFilter,
  PaginationOptions,
  PaginatedResult,
  
  // Creation helpers
  QuestionCreationData,
  AsyncResult,
  
  // Enums and unions
  QuestionType,
  DifficultyLevel,
  Grade,
  
  // Error types
  QuizError,
  ValidationError,
  GradingError,
  SessionError
};

// Type guards and utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  { [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>> }[Keys];

export type OptionalExcept<T, K extends keyof T> = 
  Pick<T, K> & Partial<Omit<T, K>>;

// Database operation result types
export type DatabaseResult<T> = AsyncResult<T>;
export type QuestionResult = DatabaseResult<Question>;
export type PerformanceResult = DatabaseResult<UserPerformance>;
export type SessionResult = DatabaseResult<StudySession>;

// Configuration types
export interface AppConfig {
  database: {
    name: string;
    version: number;
  };
  spaced_repetition: {
    default_ease: number;
    minimum_ease: number;
    maximum_ease: number;
    ease_bonus: number;
    ease_penalty: number;
    minimum_interval: number;
    maximum_interval: number;
  };
  adaptive_difficulty: {
    increase_threshold: number;
    decrease_threshold: number;
    stable_range_min: number;
    stable_range_max: number;
  };
  ui: {
    questions_per_page: number;
    default_daily_goal: number;
    enable_animations: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
  ai: {
    enabled: boolean;
    api_endpoint?: string;
    model?: string;
    timeout: number;
  };
}

// Event system types for reactive updates
export interface QuizEvent {
  type: string;
  timestamp: Date;
  source: string;
  data?: any;
}

export interface QuestionEvent extends QuizEvent {
  type: 'question_created' | 'question_updated' | 'question_deleted';
  data: {
    questionId: number;
    question?: Question;
  };
}

export interface SessionEvent extends QuizEvent {
  type: 'session_started' | 'session_ended' | 'answer_submitted' | 'answer_graded';
  data: {
    sessionId: string;
    session?: StudySession;
    questionId?: number;
    gradingResult?: GradingResult;
  };
}

export interface PerformanceEvent extends QuizEvent {
  type: 'performance_updated' | 'difficulty_adjusted' | 'streak_updated';
  data: {
    questionId?: number;
    performance?: UserPerformance;
    oldDifficulty?: DifficultyLevel;
    newDifficulty?: DifficultyLevel;
  };
}

export type QuizEventType = QuestionEvent | SessionEvent | PerformanceEvent;

// Plugin system types for extensibility
export interface QuizPlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  
  // Lifecycle hooks
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
  
  // Event handlers
  onQuestionCreated?(question: Question): Promise<void>;
  onAnswerGraded?(result: GradingResult, question: Question): Promise<void>;
  onSessionCompleted?(session: StudySession): Promise<void>;
  
  // UI extensions
  renderQuestionExtension?(question: Question): string | HTMLElement;
  renderExplanationExtension?(explanation: Explanation): string | HTMLElement;
}

// Migration types for database schema updates
export interface Migration {
  version: number;
  description: string;
  up: (database: any) => Promise<void>;
  down?: (database: any) => Promise<void>;
}

// Backup and restore types
export interface BackupData {
  version: string;
  timestamp: string;
  questions: Question[];
  decks: Deck[];
  performances: Record<number, UserPerformance>;
  profile: UserProfile;
  metadata?: {
    appVersion: string;
    exportedBy: string;
    totalQuestions: number;
    totalDecks: number;
  };
}

export interface RestoreOptions {
  mergeStrategy: 'replace' | 'merge' | 'skip_existing';
  validateIntegrity: boolean;
  createBackup: boolean;
}

// Analytics and telemetry types (privacy-focused)
export interface StudyAnalytics {
  // Aggregated, anonymized data only
  sessionCount: number;
  averageSessionLength: number;
  questionsPerSession: number;
  accuracyDistribution: Record<string, number>;
  difficultyProgression: number[];
  featureUsage: Record<string, number>;
  
  // No personal information stored
  userId?: never;
  personalData?: never;
}